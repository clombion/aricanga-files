#!/usr/bin/env node
/**
 * mise start - Create a new interactive story from a template
 *
 * This tool helps writers create new narrative experiences by:
 * 1. Selecting an experience template (local or from URL)
 * 2. Answering simple prompts about their project
 * 3. Generating all the necessary files
 *
 * Usage:
 *   mise start                              # Interactive mode
 *   mise start --template ./my-template.zip # Use specific template
 *   mise start --dry-run                    # Preview without creating files
 *   mise start --help                       # Show help
 */

import { createReadStream, createWriteStream } from 'node:fs';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { join, basename, dirname } from 'node:path';
import { getProjectRoot } from '../lib/locale-config.js';

const PROJECT_ROOT = getProjectRoot();
const TEMPLATES_DIR = join(PROJECT_ROOT, 'templates');

// Parse CLI arguments
const args = process.argv.slice(2);
const templateArgIndex = args.indexOf('--template');
const FLAGS = {
  help: args.includes('--help') || args.includes('-h'),
  dryRun: args.includes('--dry-run'),
  template: args.find((a) => a.startsWith('--template='))?.split('=')[1] ||
    (templateArgIndex !== -1 && !args[templateArgIndex + 1]?.startsWith('--')
      ? args[templateArgIndex + 1]
      : null),
};

// Locale display names
const LOCALE_NAMES = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

/**
 * Show help message
 */
function showHelp() {
  console.log(`
mise start - Create a new interactive story

USAGE
  mise start [options]

OPTIONS
  --template <path>   Path to experience template (directory or URL)
  --dry-run           Preview what will be created without writing files
  --help              Show this help

WHAT IT DOES
  1. Shows you available story types (templates)
  2. Asks simple questions about your project
  3. Creates all the files you need to start writing

EXAMPLES
  mise start                              # Interactive - choose a template
  mise start --template smartphone        # Use smartphone chat template
  mise start --dry-run                    # See what would be created

AFTER CREATING
  1. Edit the story files in experiences/your-project/ink/
  2. Build: IMPL=your-project mise run build
  3. Preview: IMPL=your-project mise run serve
  4. Open http://localhost:8000/experiences/your-project/

Need help? See docs/getting-started.md
`);
  process.exit(0);
}

/**
 * Create readline interface for prompts
 */
function createPrompt() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question and get user input
 */
async function ask(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Ask a yes/no question
 */
async function askConfirm(rl, question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(rl, `${question} ${hint}`, '');
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

/**
 * Find available templates in the templates directory
 */
function findTemplates() {
  const templates = [];

  if (!existsSync(TEMPLATES_DIR)) {
    return templates;
  }

  for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = join(TEMPLATES_DIR, entry.name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      templates.push({
        id: entry.name,
        path: join(TEMPLATES_DIR, entry.name),
        manifest,
      });
    } catch (e) {
      console.warn(`Warning: Invalid manifest in ${entry.name}`);
    }
  }

  return templates;
}

/**
 * Load template from path (directory or URL)
 */
async function loadTemplate(templatePath) {
  // If it's a URL, we'd need to download it - for now, just support local
  if (templatePath.startsWith('http://') || templatePath.startsWith('https://')) {
    console.error('\nURL templates are not yet supported.');
    console.error('Please download the template and use a local path.\n');
    process.exit(1);
  }

  // Check if it's a template ID (name only)
  let fullPath = templatePath;
  if (!templatePath.includes('/') && !templatePath.includes('\\')) {
    fullPath = join(TEMPLATES_DIR, templatePath);
  }

  if (!existsSync(fullPath)) {
    console.error(`\nTemplate not found: ${templatePath}`);
    console.error('Available templates:');
    for (const t of findTemplates()) {
      console.error(`  - ${t.id}: ${t.manifest.displayName}`);
    }
    console.error('');
    process.exit(1);
  }

  const manifestPath = join(fullPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`\nInvalid template: missing manifest.json`);
    process.exit(1);
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    return { path: fullPath, manifest };
  } catch (e) {
    console.error(`\nInvalid template: could not parse manifest.json`);
    console.error(e.message);
    process.exit(1);
  }
}

/**
 * Validate user input against a pattern
 */
function validateInput(value, validation, fieldName) {
  if (!validation) return { valid: true };

  if (validation.pattern) {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(value)) {
      return {
        valid: false,
        message: validation.message || `Invalid ${fieldName}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Update mise.toml to set IMPL to the new project name
 */
function updateMiseConfig(projectName, dryRun) {
  const miseTomlPath = join(PROJECT_ROOT, 'mise.toml');

  if (!existsSync(miseTomlPath)) {
    return false;
  }

  const content = readFileSync(miseTomlPath, 'utf-8');

  // Replace IMPL = "..." in [env] section
  const updated = content.replace(
    /^IMPL\s*=\s*"[^"]*"/m,
    `IMPL = "${projectName}"`
  );

  if (updated === content) {
    // No IMPL line found, try to add after [env]
    const withImpl = content.replace(
      /^\[env\]\s*$/m,
      `[env]\nIMPL = "${projectName}"`
    );
    if (withImpl !== content) {
      if (!dryRun) {
        writeFileSync(miseTomlPath, withImpl);
      }
      return true;
    }
    return false;
  }

  if (!dryRun) {
    writeFileSync(miseTomlPath, updated);
  }
  return true;
}

/**
 * Check if implementation already exists
 */
function checkNameConflict(name, reservedNames = []) {
  // Check reserved names
  if (reservedNames.includes(name)) {
    return { conflict: true, reason: `"${name}" is reserved` };
  }

  // Check existing experiences
  const implDir = join(PROJECT_ROOT, 'experiences', name);
  if (existsSync(implDir)) {
    return { conflict: true, reason: `"${name}" already exists` };
  }

  return { conflict: false };
}

/**
 * Apply template variables to a string
 */
function applyVariables(content, variables) {
  let result = content;

  for (const [key, value] of Object.entries(variables)) {
    // Simple replacement: {{key}}
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);

    // Title case: {{key|titlecase}}
    const titleCase = value
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    result = result.replace(
      new RegExp(`\\{\\{${key}\\|titlecase\\}\\}`, 'g'),
      titleCase,
    );
  }

  // Also handle namePascal (camelCase with first letter uppercase)
  if (variables.name) {
    const pascalCase = variables.name
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    result = result.replace(/\{\{namePascal\}\}/g, pascalCase);
  }

  return result;
}

/**
 * Process a template file
 */
function processTemplateFile(templatePath, outputPath, variables, dryRun) {
  const content = readFileSync(templatePath, 'utf-8');
  const processed = applyVariables(content, variables);

  if (dryRun) {
    console.log(`  Would create: ${outputPath}`);
    return;
  }

  // Ensure directory exists
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, processed);
  console.log(`  ✓ Created: ${outputPath}`);
}

/**
 * Main entry point
 */
async function main() {
  if (FLAGS.help) {
    showHelp();
  }

  console.log('\n🎬 Let\'s create your new story!\n');

  const rl = createPrompt();
  let template;

  try {
    // Step 1: Select template
    if (FLAGS.template) {
      template = await loadTemplate(FLAGS.template);
      console.log(`Using template: ${template.manifest.displayName}\n`);
    } else {
      const templates = findTemplates();

      if (templates.length === 0) {
        console.error('No templates found in templates/');
        console.error('Please add a template or specify one with --template');
        process.exit(1);
      }

      console.log('What kind of experience do you want to build?\n');
      templates.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.manifest.displayName}`);
        console.log(`     ${t.manifest.description}\n`);
      });

      const choice = await ask(rl, 'Enter number', '1');
      const index = parseInt(choice, 10) - 1;

      if (index < 0 || index >= templates.length) {
        console.error('\nInvalid choice. Please run again and select a valid number.');
        process.exit(1);
      }

      template = templates[index];
      console.log(`\nGreat! Let's set up your ${template.manifest.displayName.toLowerCase()}.\n`);
    }

    // Step 2: Gather prompt values
    const variables = {};
    const manifest = template.manifest;

    for (const prompt of manifest.prompts || []) {
      let value;
      let valid = false;

      while (!valid) {
        if (prompt.type === 'confirm') {
          value = await askConfirm(rl, prompt.label, prompt.default !== false);
          valid = true;
        } else {
          // Show hint if available
          if (prompt.hint) {
            console.log(`  (${prompt.hint})`);
          }

          const defaultVal = prompt.default
            ? applyVariables(prompt.default, variables)
            : '';
          value = await ask(rl, prompt.label, defaultVal);

          // Validate
          const validation = validateInput(value, prompt.validation, prompt.label);
          if (!validation.valid) {
            console.log(`\n  Oops! ${validation.message}`);
            console.log('  Try again:\n');
            continue;
          }

          // Check for name conflicts
          if (prompt.key === 'name') {
            const conflict = checkNameConflict(value, manifest.validation?.reservedNames);
            if (conflict.conflict) {
              console.log(`\n  Oops! ${conflict.reason}`);
              console.log('  Try again:\n');
              continue;
            }
          }

          valid = true;
        }
      }

      variables[prompt.key] = value;
    }

    // Add derived variables
    if (variables.locale) {
      variables.localeName = LOCALE_NAMES[variables.locale] || variables.locale.toUpperCase();
    }

    // Step 3: Preview and confirm
    console.log('\n' + '─'.repeat(50));
    console.log('Ready to create your project:\n');
    console.log(`  Name: ${variables.name}`);
    console.log(`  Title: ${variables.title || variables.name}`);
    console.log(`  Language: ${variables.localeName || 'English'}`);
    if (FLAGS.dryRun) {
      console.log('\n  [DRY RUN - no files will be created]');
    }
    console.log('');

    const proceed = await askConfirm(rl, 'Create project?', true);
    if (!proceed) {
      console.log('\nNo worries! Run mise start again when you\'re ready.\n');
      process.exit(0);
    }

    rl.close();

    // Step 4: Generate files
    console.log('\nCreating your project...\n');

    // Create directories first
    for (const dir of manifest.directories || []) {
      const dirPath = join(PROJECT_ROOT, applyVariables(dir, variables));
      if (!FLAGS.dryRun) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    // Process template files
    for (const file of manifest.files || []) {
      const templatePath = join(template.path, file.template);
      const outputPath = join(PROJECT_ROOT, applyVariables(file.output, variables));
      processTemplateFile(templatePath, outputPath, variables, FLAGS.dryRun);
    }

    // Process conditional files
    for (const conditional of manifest.conditionalFiles || []) {
      if (variables[conditional.condition]) {
        for (const file of conditional.files || []) {
          const templatePath = join(template.path, file.template);
          const outputPath = join(PROJECT_ROOT, applyVariables(file.output, variables));
          processTemplateFile(templatePath, outputPath, variables, FLAGS.dryRun);
        }
      }
    }

    // Create .gitkeep in generated directory
    const generatedDir = join(PROJECT_ROOT, 'experiences', variables.name, 'src/generated');
    if (!FLAGS.dryRun) {
      mkdirSync(generatedDir, { recursive: true });
      writeFileSync(join(generatedDir, '.gitkeep'), '');
    }

    // Update mise.toml with new IMPL
    const miseUpdated = updateMiseConfig(variables.name, FLAGS.dryRun);
    if (miseUpdated) {
      if (FLAGS.dryRun) {
        console.log(`  Would update mise.toml: IMPL = "${variables.name}"`);
      } else {
        console.log(`  ✓ Updated mise.toml: IMPL = "${variables.name}"`);
      }
    }

    // Step 5: Show next steps
    const postCreate = manifest.postCreate || {};
    console.log('\n' + '─'.repeat(50));
    console.log(`\n🎉 ${postCreate.message || 'Your story is ready!'}\n`);
    console.log('Next steps:\n');

    const steps = postCreate.steps || [
      `Open experiences/${variables.name}/ink/${variables.locale}/ to write your narrative`,
      `Run: IMPL=${variables.name} mise run build`,
      `Run: IMPL=${variables.name} mise run serve`,
      `Open http://localhost:8000/ in your browser`,
    ];

    steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${applyVariables(step, variables)}`);
    });

    if (postCreate.helpDoc) {
      console.log(`\nNeed help? See ${postCreate.helpDoc}`);
    }

    console.log('');
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

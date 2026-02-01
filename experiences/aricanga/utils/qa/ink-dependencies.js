#!/usr/bin/env node
/**
 * Ink Dependency Analyzer
 * Tracks variable assignments and reads across ink files to identify cross-chat dependencies
 *
 * Usage:
 *   node scripts/ink-dependencies.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed parsing output
 *   --locale=XX    Use specific locale (default: from config)
 *
 * Exit codes:
 *   0 - Analysis completed successfully
 *   1 - Analysis failed
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLocale, getLocalePaths } from '../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// Parse CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
ink-dependencies.js - Analyze cross-chat variable dependencies in ink files

USAGE
  node scripts/ink-dependencies.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed parsing output
  --locale=XX    Use specific locale (default: from config)

ANALYSIS PERFORMED
  • Parses VAR declarations from variables.ink
  • Tracks variable assignments (~ var = value) across all ink files
  • Tracks variable reads ({var}, {not var:}, etc.) across all ink files
  • Identifies cross-chat dependencies (var set in chat A, read in chat B)
  • Builds critical path (recommended play order)
  • Identifies choice-gated variables

OUTPUT
  docs/story-dependencies.json    JSON report with all dependency data

EXIT CODES
  0  Analysis completed successfully
  1  Analysis failed

EXAMPLES
  node scripts/ink-dependencies.js           # Run analysis
  node scripts/ink-dependencies.js -v        # Verbose output
  node scripts/ink-dependencies.js --locale=fr  # Analyze French locale
`);
  process.exit(0);
}

// Show help if requested
if (ARGS.help) {
  showHelp();
}

const locale = getLocale();
const localePaths = getLocalePaths(locale);

const CONFIG = {
  inkDir: localePaths.inkDir,
  variablesFile: localePaths.variablesFile,
  outputDir: join(PROJECT_ROOT, 'generated'),
  outputFile: 'story-dependencies.json',
};

// ============ Parsing ============

/**
 * Extract all VAR declarations from variables.ink
 */
function parseVariableDeclarations(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const variables = {};

  const varRegex = /^VAR\s+(\w+)\s*=\s*(.+)$/gm;
  let match;

  while ((match = varRegex.exec(content)) !== null) {
    const [, name, defaultValue] = match;
    variables[name] = {
      name,
      defaultValue: defaultValue.trim(),
      setIn: [],
      readIn: [],
    };
  }

  return variables;
}

/**
 * Parse a single ink file for variable assignments and reads
 */
function parseInkFile(filePath, variables) {
  const content = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath);
  const chatId = fileName.replace('.ink', '');
  const lines = content.split('\n');

  let currentKnot = null;
  let currentStitch = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track current knot/stitch
    const knotMatch = line.match(/^===\s*(\w+)\s*===/);
    if (knotMatch) {
      currentKnot = knotMatch[1];
      currentStitch = null;
      continue;
    }

    const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
    if (stitchMatch) {
      currentStitch = stitchMatch[1];
      continue;
    }

    // Find assignments: ~ var = value
    const assignRegex = /~\s*(\w+)\s*=\s*(.+)/g;
    let assignMatch;
    while ((assignMatch = assignRegex.exec(line)) !== null) {
      const [, varName, value] = assignMatch;
      if (variables[varName]) {
        variables[varName].setIn.push({
          file: fileName,
          chat: chatId,
          knot: currentKnot,
          stitch: currentStitch,
          line: lineNum,
          value: value.trim(),
        });
      }
    }

    // Find reads: {var}, {not var}, {var:}, {var and ...}, etc.
    // Ink conditionals can be:
    // 1. Single line: {var: something}
    // 2. Multi-line start: {var:  or {not var:  or {var and other:
    // 3. Inline: {var} for interpolation

    // Check for conditional start (multi-line): {condition:
    const multiLineCondMatch = line.match(/\{([^}:]+):/);
    if (multiLineCondMatch) {
      const condition = multiLineCondMatch[1];
      for (const varName of Object.keys(variables)) {
        const varRegex = new RegExp(`\\b${varName}\\b`);
        if (varRegex.test(condition)) {
          const existing = variables[varName].readIn.find(
            (r) => r.file === fileName && r.line === lineNum,
          );
          if (!existing) {
            variables[varName].readIn.push({
              file: fileName,
              chat: chatId,
              knot: currentKnot,
              stitch: currentStitch,
              line: lineNum,
              condition: condition.trim(),
            });
          }
        }
      }
    }

    // Also check for single-line conditionals and interpolations: {var} or {var: x}
    const singleLineCondRegex = /\{([^}]+)\}/g;
    let condMatch;
    while ((condMatch = singleLineCondRegex.exec(line)) !== null) {
      const condition = condMatch[1];
      // Skip if already captured as multi-line
      if (condition.includes(':') && !condition.includes('::')) continue;

      for (const varName of Object.keys(variables)) {
        const varRegex = new RegExp(`\\b${varName}\\b`);
        if (varRegex.test(condition)) {
          const existing = variables[varName].readIn.find(
            (r) => r.file === fileName && r.line === lineNum,
          );
          if (!existing) {
            variables[varName].readIn.push({
              file: fileName,
              chat: chatId,
              knot: currentKnot,
              stitch: currentStitch,
              line: lineNum,
              condition: condition.trim(),
            });
          }
        }
      }
    }
  }

  return variables;
}

/**
 * Parse all ink files in the chats directory
 */
function parseAllInkFiles(inkDir, variables) {
  const files = readdirSync(inkDir).filter(
    (f) => f.endsWith('.ink') && f !== 'variables.ink',
  );

  for (const file of files) {
    parseInkFile(join(inkDir, file), variables);
  }

  return variables;
}

// ============ Analysis ============

/**
 * Identify cross-chat dependencies (var set in file A, read in file B)
 */
function findCrossChatDependencies(variables) {
  const dependencies = [];

  for (const [varName, varInfo] of Object.entries(variables)) {
    // Get unique files that set this variable
    const setFiles = [...new Set(varInfo.setIn.map((s) => s.chat))];
    // Get unique files that read this variable
    const readFiles = [...new Set(varInfo.readIn.map((r) => r.chat))];

    // Find cross-chat pairs
    for (const setFile of setFiles) {
      for (const readFile of readFiles) {
        if (setFile !== readFile) {
          dependencies.push({
            variable: varName,
            from: setFile,
            to: readFile,
            setLocations: varInfo.setIn.filter((s) => s.chat === setFile),
            readLocations: varInfo.readIn.filter((r) => r.chat === readFile),
          });
        }
      }
    }
  }

  return dependencies;
}

/**
 * Build the critical path (order chats must be visited for full progression)
 * Handles cycles by identifying the recommended sequence based on variable flow
 */
function buildCriticalPath(dependencies) {
  // Group dependencies by variable to understand the flow
  const allChats = new Set();
  const firstSetters = new Map(); // variable -> first chat that sets it
  const outgoing = new Map(); // chat -> Set of chats it unlocks

  for (const dep of dependencies) {
    allChats.add(dep.from);
    allChats.add(dep.to);

    if (!outgoing.has(dep.from)) outgoing.set(dep.from, new Set());
    outgoing.get(dep.from).add(dep.to);

    // Track which chat first sets each variable
    if (!firstSetters.has(dep.variable)) {
      firstSetters.set(dep.variable, dep.from);
    }
  }

  // Find entry points (chats that set variables but have no incoming deps)
  const hasIncoming = new Set();
  for (const dep of dependencies) {
    hasIncoming.add(dep.to);
  }

  const entryPoints = [];
  for (const chat of allChats) {
    if (!hasIncoming.has(chat)) {
      entryPoints.push(chat);
    }
  }

  // Build recommended order using BFS from entry points
  // This handles cycles by visiting each chat only once
  const visited = new Set();
  const order = [];
  const queue = [...entryPoints];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    order.push(current);

    // Add unvisited neighbors
    const neighbors = outgoing.get(current) || new Set();
    for (const next of neighbors) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  // Add any remaining chats not reached
  for (const chat of allChats) {
    if (!visited.has(chat)) {
      order.push(chat);
    }
  }

  return order;
}

/**
 * Identify which variables gate which stitches
 */
function findGatedContent(variables) {
  const gated = [];

  for (const [varName, varInfo] of Object.entries(variables)) {
    for (const read of varInfo.readIn) {
      // Check if this is a routing conditional (leads to -> divert)
      if (read.stitch === null && read.knot) {
        gated.push({
          variable: varName,
          chat: read.chat,
          knot: read.knot,
          condition: read.condition,
          setBy: varInfo.setIn.map((s) => `${s.chat}.${s.stitch || s.knot}`),
        });
      }
    }
  }

  return gated;
}

/**
 * Identify choice-gated variables (set inside a choice block)
 */
function findChoiceGatedVariables(inkDir, variables) {
  const choiceGated = [];
  const files = readdirSync(inkDir).filter(
    (f) => f.endsWith('.ink') && f !== 'variables.ink',
  );

  for (const file of files) {
    const content = readFileSync(join(inkDir, file), 'utf-8');
    const lines = content.split('\n');

    let inChoiceBlock = false;
    let choiceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect choice start
      if (line.match(/^\s*\*\s+\[/)) {
        inChoiceBlock = true;
        choiceDepth = 1;
      } else if (line.match(/^\s*\*\s*\*\s+\[/)) {
        choiceDepth = 2;
      }

      // Detect choice end (next choice, knot, stitch, or unindented line)
      if (
        inChoiceBlock &&
        (line.match(/^===/) ||
          line.match(/^=\s+\w/) ||
          (line.match(/^\s*\*\s+\[/) && choiceDepth === 1))
      ) {
        inChoiceBlock = false;
        choiceDepth = 0;
      }

      // Check for variable assignment inside choice
      if (inChoiceBlock) {
        const assignMatch = line.match(/~\s*(\w+)\s*=\s*true/);
        if (assignMatch && variables[assignMatch[1]]) {
          const existing = choiceGated.find(
            (c) => c.variable === assignMatch[1] && c.file === file,
          );
          if (!existing) {
            choiceGated.push({
              variable: assignMatch[1],
              file,
              line: i + 1,
            });
          }
        }
      }
    }
  }

  return choiceGated;
}

// ============ Output ============

/**
 * Generate the full dependency report
 */
function generateReport(
  variables,
  dependencies,
  criticalPath,
  gatedContent,
  choiceGated,
) {
  return {
    generated: new Date().toISOString(),
    summary: {
      totalVariables: Object.keys(variables).length,
      crossChatDependencies: dependencies.length,
      criticalPathLength: criticalPath.length,
      choiceGatedVariables: choiceGated.length,
    },
    criticalPath,
    crossChatDependencies: dependencies,
    choiceGatedVariables: choiceGated,
    gatedContent,
    variables: Object.fromEntries(
      Object.entries(variables).map(([name, info]) => [
        name,
        {
          defaultValue: info.defaultValue,
          setIn: info.setIn.map((s) => `${s.chat}:${s.line}`),
          readIn: info.readIn.map((r) => `${r.chat}:${r.line}`),
        },
      ]),
    ),
  };
}

/**
 * Print human-readable summary
 */
function printSummary(report) {
  console.log('=== Ink Dependency Analysis ===\n');

  console.log('Critical Path (recommended play order):');
  console.log(`  ${report.criticalPath.join(' → ')}\n`);

  console.log('Cross-Chat Dependencies:');
  for (const dep of report.crossChatDependencies) {
    console.log(`  ${dep.from} ──(${dep.variable})──► ${dep.to}`);
  }
  console.log('');

  if (report.choiceGatedVariables.length > 0) {
    console.log('Choice-Gated Variables (require specific player choice):');
    for (const cg of report.choiceGatedVariables) {
      console.log(`  ${cg.variable} (set in ${cg.file}:${cg.line})`);
    }
    console.log('');
  }

  console.log('Summary:');
  console.log(`  Total variables: ${report.summary.totalVariables}`);
  console.log(
    `  Cross-chat dependencies: ${report.summary.crossChatDependencies}`,
  );
  console.log(
    `  Choice-gated variables: ${report.summary.choiceGatedVariables}`,
  );
}

// ============ Main ============

async function main() {
  console.log(`Analyzing ink dependencies (locale: ${locale})...\n`);

  // Parse variable declarations
  if (ARGS.verbose)
    console.log(`Reading variables from: ${CONFIG.variablesFile}`);
  const variables = parseVariableDeclarations(CONFIG.variablesFile);
  console.log(
    `Found ${Object.keys(variables).length} variables in variables.ink`,
  );
  if (ARGS.verbose) {
    console.log(
      `  Variables: ${Object.keys(variables).slice(0, 10).join(', ')}${Object.keys(variables).length > 10 ? '...' : ''}`,
    );
  }

  // Parse all ink files for assignments and reads
  if (ARGS.verbose) console.log(`\nParsing ink files in: ${CONFIG.inkDir}`);
  parseAllInkFiles(CONFIG.inkDir, variables);
  if (ARGS.verbose) {
    const assignCount = Object.values(variables).reduce(
      (sum, v) => sum + v.setIn.length,
      0,
    );
    const readCount = Object.values(variables).reduce(
      (sum, v) => sum + v.readIn.length,
      0,
    );
    console.log(`  Found ${assignCount} assignments, ${readCount} reads`);
  }

  // Analyze dependencies
  if (ARGS.verbose) console.log('\nAnalyzing dependencies...');
  const dependencies = findCrossChatDependencies(variables);
  if (ARGS.verbose)
    console.log(`  Cross-chat dependencies: ${dependencies.length}`);

  const criticalPath = buildCriticalPath(dependencies);
  if (ARGS.verbose)
    console.log(`  Critical path length: ${criticalPath.length}`);

  const gatedContent = findGatedContent(variables);
  if (ARGS.verbose)
    console.log(`  Gated content locations: ${gatedContent.length}`);

  const choiceGated = findChoiceGatedVariables(CONFIG.inkDir, variables);
  if (ARGS.verbose)
    console.log(`  Choice-gated variables: ${choiceGated.length}`);

  // Generate report
  const report = generateReport(
    variables,
    dependencies,
    criticalPath,
    gatedContent,
    choiceGated,
  );

  // Ensure output directory exists
  if (!existsSync(CONFIG.outputDir)) {
    mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Write JSON output
  const outputPath = join(CONFIG.outputDir, CONFIG.outputFile);
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote: ${outputPath}`);

  // Print summary
  console.log('');
  printSummary(report);
}

main().catch(console.error);

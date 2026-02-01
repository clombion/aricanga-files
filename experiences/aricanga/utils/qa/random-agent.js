#!/usr/bin/env node

/**
 * Random Agent - Headless ink story runner for coverage analysis
 * Runs N playthroughs with random choices, reports visit counts per stitch
 *
 * Usage:
 *   node scripts/random-agent.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed coverage output
 *   --locale=XX    Use specific locale (default: from config)
 *
 * Exit codes:
 *   0 - Analysis completed successfully
 *   1 - Story load failed
 */

import { readdirSync, readFileSync } from 'fs';
import { Story } from 'inkjs';
import {
  createExternalFunctions,
  bindExternalFunctions,
} from '../../../../packages/framework/src/systems/conversation/ink/external-functions.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
random-agent.js - Coverage analysis via random playthroughs

USAGE
  node scripts/random-agent.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed coverage output
  --locale=XX    Use specific locale (default: from config)

HOW IT WORKS
  1. Loads the compiled ink story
  2. Runs 500 playthroughs with random choices
  3. Visits each chat in random order per playthrough
  4. Records visit counts for every stitch
  5. Reports coverage percentage and unreachable content

OUTPUT
  Prints coverage report to stdout including:
  - Summary statistics (playthroughs, steps, loops detected)
  - Coverage percentage (stitches visited / total)
  - Unreachable content (0 visits after 500 runs)
  - Per-stitch visit counts

EXIT CODES
  0  Analysis completed successfully
  1  Story load failed

EXAMPLES
  node scripts/random-agent.js              # Run coverage analysis
  node scripts/random-agent.js -v           # Verbose output
  node scripts/random-agent.js --locale=fr  # Analyze French locale
`);
  process.exit(0);
}

// Show help if requested
if (ARGS.help) {
  showHelp();
}

const locale = getLocale();
const localePaths = getLocalePaths(locale);

// Configuration
const CONFIG = {
  storyPath: localePaths.storyPath,
  inkDir: localePaths.inkDir,
  playthroughs: 500,
  maxStepsPerRun: 200,
  entryKnots: [
    'news_chat',
    'pat_chat',
    'notes_chat',
    'spectre_chat',
    'activist_chat',
  ],
};

/**
 * Parse ink files to extract all knots and stitches for coverage mapping
 */
function extractInkStructure(inkDir) {
  const structure = {};
  const files = readdirSync(inkDir).filter((f) => f.endsWith('.ink'));

  for (const file of files) {
    const content = readFileSync(join(inkDir, file), 'utf-8');
    const lines = content.split('\n');
    let currentKnot = null;

    for (const line of lines) {
      // Detect knot (=== name ===)
      const knotMatch = line.match(/^===\s*(\w+)\s*===/);
      if (knotMatch) {
        currentKnot = knotMatch[1];
        structure[currentKnot] = { stitches: new Set(), file };
        continue;
      }

      // Detect stitch (= name)
      const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
      if (stitchMatch && currentKnot) {
        structure[currentKnot].stitches.add(stitchMatch[1]);
      }
    }
  }

  return structure;
}

/**
 * Random Agent - runs story headlessly with random choices
 */
class RandomAgent {
  constructor(storyJson, inkStructure = null) {
    this.storyJson = storyJson;
    this.inkStructure = inkStructure;
    this.visitCounts = {}; // "knot.stitch" -> count
    this.textVisits = {}; // Track unique text outputs
    this.loopsDetected = 0;
    this.completedRuns = 0;
    this.totalSteps = 0;
    this.errors = [];
  }

  /**
   * Create a fresh story instance with stubbed external functions
   */
  createStory() {
    const story = new Story(this.storyJson);

    const fns = createExternalFunctions({
      getName: (id) => id,
      requestData: () => {
        try {
          story.variablesState['data_found'] = true;
          story.variablesState['ministry_claimed_revenue'] = '$50M';
          story.variablesState['data_median_revenue'] = '$12M';
          story.variablesState['data_sample_size'] = '15';
        } catch (_e) {
          /* ignore */
        }
      },
    });
    bindExternalFunctions(story, fns);

    return story;
  }

  /**
   * Run a single full game playthrough visiting multiple chats
   */
  runFullPlaythrough(maxSteps) {
    const story = this.createStory();
    const visitedTextHashes = new Set();
    let steps = 0;
    let consecutiveLoops = 0;

    // Simulate a full game session - visit chats in various orders
    const chatOrder = this.shuffleArray([...CONFIG.entryKnots]);

    for (const entryKnot of chatOrder) {
      if (steps >= maxSteps) break;

      const result = this.runKnotSession(
        story,
        entryKnot,
        maxSteps - steps,
        visitedTextHashes,
      );
      steps += result.steps;

      if (result.status === 'loop') {
        consecutiveLoops++;
        if (consecutiveLoops >= 3) {
          this.loopsDetected++;
          // Collect visit counts before returning
          if (this.inkStructure) {
            this.collectVisitCounts(story, this.inkStructure);
          }
          return { status: 'loop', steps };
        }
      } else {
        consecutiveLoops = 0;
      }
    }

    // Collect visit counts from ink's built-in tracking
    if (this.inkStructure) {
      this.collectVisitCounts(story, this.inkStructure);
    }

    this.completedRuns++;
    this.totalSteps += steps;
    return { status: 'complete', steps };
  }

  /**
   * Run a session within a single knot
   */
  runKnotSession(story, knotName, maxSteps, visitedTextHashes) {
    let steps = 0;

    try {
      // Set current_chat variable for routing
      const chatId = knotName.replace('_chat', '');
      story.variablesState['current_chat'] = chatId;

      // Jump to entry knot
      story.ChoosePathString(knotName);

      // Track that we visited this knot
      this.recordVisit(knotName, null);

      while (steps < maxSteps) {
        // Continue until we need a choice or story ends
        while (story.canContinue && steps < maxSteps) {
          const text = story.Continue().trim();
          const tags = story.currentTags || [];
          steps++;

          // Record visits based on tags and path
          this.recordVisitFromTags(knotName, tags);
          this.recordVisitFromPath(story);

          // Track unique text for debugging
          if (text) {
            const hash = this.hashText(text);
            if (visitedTextHashes.has(hash)) {
              // Same text seen - might be a loop
            }
            visitedTextHashes.add(hash);
            this.textVisits[hash] = (this.textVisits[hash] || 0) + 1;
          }
        }

        // Handle choices
        if (story.currentChoices.length > 0) {
          const choiceIndex = Math.floor(
            Math.random() * story.currentChoices.length,
          );
          story.ChooseChoiceIndex(choiceIndex);
          steps++;
        } else {
          // No choices and can't continue = done with this knot
          break;
        }
      }

      return { status: 'complete', steps };
    } catch (error) {
      this.errors.push({ knot: knotName, error: error.message });
      return { status: 'error', steps, error: error.message };
    }
  }

  /**
   * Record visit from ink tags (# chat:xxx style)
   */
  recordVisitFromTags(currentKnot, tags) {
    for (const tag of tags) {
      // Look for stitch indicators in tags
      const chatMatch = tag.match(/^chat:(\w+)/);
      if (chatMatch) {
        this.recordVisit(`${chatMatch[1]}_chat`, null);
      }
    }
  }

  /**
   * Record visit from story path
   */
  recordVisitFromPath(story) {
    // Note: currentPathString returns numeric indices, not stitch names
    // We rely on collectVisitCounts() to get named stitch visits
  }

  /**
   * Collect visit counts from ink's built-in tracking using named paths
   */
  collectVisitCounts(story, structure) {
    for (const [knotName, knotInfo] of Object.entries(structure)) {
      // Check knot root visits
      try {
        const knotVisits = story.state.VisitCountAtPathString(knotName);
        if (knotVisits > 0) {
          const knotKey = `${knotName}._root`;
          this.visitCounts[knotKey] = (this.visitCounts[knotKey] || 0) + knotVisits;
        }
      } catch (_e) { /* ignore */ }

      // Check each stitch
      for (const stitchName of knotInfo.stitches) {
        try {
          const path = `${knotName}.${stitchName}`;
          const visits = story.state.VisitCountAtPathString(path);
          if (visits > 0) {
            this.visitCounts[path] = (this.visitCounts[path] || 0) + visits;
          }
        } catch (_e) { /* ignore */ }
      }
    }
  }

  /**
   * Record a visit to a knot/stitch
   */
  recordVisit(knot, stitch) {
    if (stitch && !/^\d+$/.test(stitch)) {
      // Valid stitch name (not just a number index)
      const key = `${knot}.${stitch}`;
      this.visitCounts[key] = (this.visitCounts[key] || 0) + 1;
    }
    // Also record knot-level visit
    const knotKey = `${knot}._root`;
    this.visitCounts[knotKey] = (this.visitCounts[knotKey] || 0) + 1;
  }

  /**
   * Simple text hash for loop detection
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Shuffle array (Fisher-Yates)
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Run multiple full playthroughs
   */
  runCoverage(numPlaythroughs) {
    for (let i = 0; i < numPlaythroughs; i++) {
      this.runFullPlaythrough(CONFIG.maxStepsPerRun);
    }
  }

  /**
   * Generate coverage report
   */
  generateReport(inkStructure) {
    const report = {
      summary: {
        totalPlaythroughs: this.completedRuns + this.loopsDetected,
        completedRuns: this.completedRuns,
        loopsDetected: this.loopsDetected,
        totalSteps: this.totalSteps,
        avgStepsPerRun:
          this.completedRuns > 0
            ? Math.round(this.totalSteps / this.completedRuns)
            : 0,
        uniqueTexts: Object.keys(this.textVisits).length,
        errors: this.errors.length,
      },
      coverage: [],
      unreachable: [],
    };

    // Build coverage data from ink structure
    for (const [knot, data] of Object.entries(inkStructure)) {
      for (const stitch of data.stitches) {
        const key = `${knot}.${stitch}`;
        const visits = this.visitCounts[key] || 0;
        const entry = { knot, stitch, visits, file: data.file };

        report.coverage.push(entry);

        if (visits === 0) {
          report.unreachable.push(entry);
        }
      }
    }

    // Sort by visits ascending (least visited first)
    report.coverage.sort((a, b) => a.visits - b.visits);

    return report;
  }
}

/**
 * Format report for console output
 * @param {object} report - Coverage report
 * @param {boolean} verbose - Show detailed output
 */
function formatReport(report, verbose = false) {
  const lines = [];

  lines.push('\n=== Random Agent Coverage Report ===\n');

  // Summary
  lines.push('Summary:');
  lines.push(`  Total playthroughs: ${report.summary.totalPlaythroughs}`);
  lines.push(`  Completed: ${report.summary.completedRuns}`);
  lines.push(`  Loops detected: ${report.summary.loopsDetected}`);
  lines.push(`  Total steps: ${report.summary.totalSteps}`);
  lines.push(`  Avg steps/run: ${report.summary.avgStepsPerRun}`);
  if (verbose) {
    lines.push(`  Unique texts: ${report.summary.uniqueTexts}`);
  }
  if (report.summary.errors > 0) {
    lines.push(`  Errors: ${report.summary.errors}`);
  }
  lines.push('');

  // Coverage summary
  const totalStitches = report.coverage.length;
  const visitedStitches = report.coverage.filter((e) => e.visits > 0).length;
  const coveragePercent =
    totalStitches > 0 ? Math.round((visitedStitches / totalStitches) * 100) : 0;
  lines.push(
    `Coverage: ${visitedStitches}/${totalStitches} stitches (${coveragePercent}%)`,
  );
  lines.push('');

  // Unreachable content (potential bugs)
  if (report.unreachable.length > 0) {
    lines.push('UNREACHABLE CONTENT (0 visits):');
    for (const entry of report.unreachable) {
      lines.push(`  ${entry.file}: ${entry.knot}.${entry.stitch}`);
    }
    lines.push('');
    lines.push('Note: Some content may require specific game state to reach.');
    lines.push('');
  } else {
    lines.push('All stitches visited at least once!\n');
  }

  // Coverage table (show all in verbose, top/bottom in normal)
  if (verbose) {
    lines.push('Coverage by stitch:');
    lines.push('  visits  knot.stitch');
    lines.push('  ------  -----------');
    for (const entry of report.coverage) {
      const visits = String(entry.visits).padStart(6);
      lines.push(`  ${visits}  ${entry.knot}.${entry.stitch}`);
    }
  } else {
    // Show top 5 most visited and bottom 5 least visited
    const sorted = [...report.coverage].sort((a, b) => b.visits - a.visits);
    lines.push('Most visited (top 5):');
    for (const entry of sorted.slice(0, 5)) {
      const visits = String(entry.visits).padStart(6);
      lines.push(`  ${visits}  ${entry.knot}.${entry.stitch}`);
    }
    lines.push('');
    lines.push('Least visited (bottom 5):');
    for (const entry of sorted.slice(-5).reverse()) {
      const visits = String(entry.visits).padStart(6);
      lines.push(`  ${visits}  ${entry.knot}.${entry.stitch}`);
    }
    lines.push('');
    lines.push('(Use --verbose to see all stitches)');
  }

  return lines.join('\n');
}

// Main execution
async function main() {
  console.log(`Loading story (locale: ${locale})...`);
  if (ARGS.verbose) console.log(`  Story path: ${CONFIG.storyPath}`);

  // Load compiled story
  let storyJson;
  try {
    const storyContent = readFileSync(CONFIG.storyPath, 'utf-8');
    storyJson = JSON.parse(storyContent);
  } catch (error) {
    console.error(`Failed to load story: ${error.message}`);
    console.error('Run "mise run build" first to compile the ink story.');
    process.exit(1);
  }

  // Extract ink structure for coverage mapping
  console.log('Analyzing ink structure...');
  if (ARGS.verbose) console.log(`  Ink directory: ${CONFIG.inkDir}`);
  const inkStructure = extractInkStructure(CONFIG.inkDir);
  const totalStitches = Object.values(inkStructure).reduce(
    (sum, data) => sum + data.stitches.size,
    0,
  );
  console.log(
    `Found ${Object.keys(inkStructure).length} knots, ${totalStitches} stitches`,
  );

  if (ARGS.verbose) {
    console.log('  Knots:');
    for (const [knot, data] of Object.entries(inkStructure)) {
      console.log(`    ${knot}: ${data.stitches.size} stitches (${data.file})`);
    }
  }

  // Run random agent
  console.log(`\nRunning ${CONFIG.playthroughs} playthroughs...`);
  if (ARGS.verbose) {
    console.log(`  Max steps per run: ${CONFIG.maxStepsPerRun}`);
    console.log(`  Entry knots: ${CONFIG.entryKnots.join(', ')}`);
  }
  const agent = new RandomAgent(storyJson, inkStructure);
  agent.runCoverage(CONFIG.playthroughs);

  // Generate and print report
  const report = agent.generateReport(inkStructure);
  console.log(formatReport(report, ARGS.verbose));

  // Don't fail on unreachable - just report (some content is state-dependent)
  console.log('\nCoverage analysis complete.');
}

main().catch(console.error);

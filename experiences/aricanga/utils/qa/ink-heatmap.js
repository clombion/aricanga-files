#!/usr/bin/env node

/**
 * Ink Heatmap - Combines coverage data with graph visualization
 * Generates a color-coded DOT graph showing visit frequency
 *
 * Usage:
 *   node scripts/ink-heatmap.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed coverage output
 *   --locale=XX    Use specific locale (default: from config)
 *
 * Exit codes:
 *   0 - Heatmap generated successfully
 *   1 - Generation failed
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { Story } from 'inkjs';
import {
  createExternalFunctions,
  bindExternalFunctions,
} from '../../../../packages/framework/src/systems/conversation/ink/external-functions.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getLocale, getLocalePaths } from '../../../../utils/lib/locale-config.js';
import { renderDotToSvg } from '../../../../utils/lib/render-dot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// Parse CLI arguments
const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  keepDot: process.argv.includes('--dot') || process.argv.includes('--keep-dot'),
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
ink-heatmap.js - Generate coverage heatmap visualization

USAGE
  node scripts/ink-heatmap.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed coverage output
  --locale=XX    Use specific locale (default: from config)
  --dot          Also output intermediate .dot file (for debugging)

HOW IT WORKS
  1. Runs 500 random playthroughs of the story
  2. Records visit counts for each stitch
  3. Generates an SVG graph with heat-colored nodes:
     - Hot (red): >50% of max visits
     - Warm (yellow): 10-50% of max visits
     - Cold (green): <10% of max visits
     - Gray: Never visited (0 visits)

OUTPUT FILES
  generated/story-heatmap.svg   Rendered SVG image
  generated/story-heatmap.dot   (only with --dot flag)

EXIT CODES
  0  Heatmap generated successfully
  1  Generation failed (story load error)

EXAMPLES
  node scripts/ink-heatmap.js              # Generate heatmap
  node scripts/ink-heatmap.js -v           # Verbose output
  node scripts/ink-heatmap.js --dot        # Also output .dot file
  node scripts/ink-heatmap.js --locale=fr  # Heatmap for French locale
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
  storyPath: localePaths.storyPath,
  inkDir: localePaths.inkDir,
  outputDir: join(PROJECT_ROOT, 'generated'),
  outputFile: 'story-heatmap',
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

// ============ Coverage Collection (from random-agent.js) ============

function extractInkStructure(inkDir) {
  const structure = {};
  const files = readdirSync(inkDir).filter((f) => f.endsWith('.ink'));

  for (const file of files) {
    const content = readFileSync(join(inkDir, file), 'utf-8');
    const lines = content.split('\n');
    let currentKnot = null;

    for (const line of lines) {
      const knotMatch = line.match(/^===\s*(\w+)\s*===/);
      if (knotMatch) {
        currentKnot = knotMatch[1];
        structure[currentKnot] = { stitches: new Set(), file };
        continue;
      }

      const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
      if (stitchMatch && currentKnot) {
        structure[currentKnot].stitches.add(stitchMatch[1]);
      }
    }
  }

  return structure;
}

class CoverageCollector {
  constructor(storyJson, inkStructure = null) {
    this.storyJson = storyJson;
    this.inkStructure = inkStructure;
    this.visitCounts = {};
  }

  createStory() {
    const story = new Story(this.storyJson);
    const fns = createExternalFunctions({
      getName: (id) => id,
      requestData: () => {
        story._awaitingData = false;
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

  runPlaythrough(maxSteps) {
    const story = this.createStory();
    let steps = 0;

    const chatOrder = this.shuffleArray([...CONFIG.entryKnots]);

    for (const entryKnot of chatOrder) {
      if (steps >= maxSteps) break;
      steps += this.runKnotSession(story, entryKnot, maxSteps - steps);
    }

    // Collect visit counts from ink's built-in tracking
    if (this.inkStructure) {
      this.collectVisitCounts(story, this.inkStructure);
    }
  }

  /**
   * Collect visit counts from ink's built-in tracking using named paths
   */
  collectVisitCounts(story, structure) {
    for (const [knotName, knotInfo] of Object.entries(structure)) {
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

  runKnotSession(story, knotName, maxSteps) {
    let steps = 0;
    try {
      const chatId = knotName.replace('_chat', '');
      story.variablesState['current_chat'] = chatId;
      story.ChoosePathString(knotName);
      this.recordVisit(knotName, null);

      while (steps < maxSteps) {
        while (story.canContinue && steps < maxSteps) {
          story.Continue();
          const tags = story.currentTags || [];
          steps++;

          // Record visits based on tags and path
          this.recordVisitFromTags(knotName, tags);
          this.recordVisitFromPath(story);
        }

        if (story.currentChoices.length > 0) {
          const choiceIndex = Math.floor(
            Math.random() * story.currentChoices.length,
          );
          story.ChooseChoiceIndex(choiceIndex);
          steps++;
        } else {
          break;
        }
      }
    } catch (_error) {
      /* ignore */
    }
    return steps;
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
    try {
      const pathStr = story.state.currentPathString;
      if (pathStr) {
        const parts = pathStr.split('.');
        if (parts.length >= 1) {
          const knot = parts[0];
          const stitch = parts.length >= 2 ? parts[1] : null;
          this.recordVisit(knot, stitch);
        }
      }
    } catch (_e) {
      /* ignore */
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

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  runCoverage(numPlaythroughs) {
    for (let i = 0; i < numPlaythroughs; i++) {
      this.runPlaythrough(CONFIG.maxStepsPerRun);
    }
  }
}

// ============ Graph Parsing (from ink-graph.js) ============

function parseInkFiles(inkDir) {
  const files = readdirSync(inkDir).filter((f) => f.endsWith('.ink'));
  const result = {
    knots: [],
    stitches: [],
    diverts: [],
  };

  for (const file of files) {
    const filePath = join(inkDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let currentKnot = null;
    let currentStitch = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const knotMatch = line.match(/^===\s*(\w+)\s*===/);
      if (knotMatch) {
        currentKnot = knotMatch[1];
        currentStitch = null;
        result.knots.push({ name: currentKnot, line: lineNum, file });
        continue;
      }

      const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
      if (stitchMatch && currentKnot) {
        currentStitch = stitchMatch[1];
        result.stitches.push({
          name: currentStitch,
          parent: currentKnot,
          line: lineNum,
          file,
        });
        continue;
      }

      const divertMatches = line.matchAll(/->\s*([a-zA-Z_][a-zA-Z0-9_.]*)/g);
      for (const match of divertMatches) {
        const target = match[1];
        if (target === 'DONE') continue;
        const from = currentStitch
          ? `${currentKnot}.${currentStitch}`
          : currentKnot;
        result.diverts.push({ from, to: target, file, line: lineNum });
      }
    }
  }

  return result;
}

// ============ Heatmap Generation ============

function getHeatColor(visits, maxVisits) {
  if (visits === 0) {
    return { fill: '#DEE2E6', border: '#ADB5BD', label: 'gray (0)' }; // Soft gray - unreachable
  }

  const ratio = visits / maxVisits;

  if (ratio >= 0.5) {
    // Hot (coral red) - frequently visited
    return { fill: '#FF8787', border: '#FA5252', label: 'hot' };
  } else if (ratio >= 0.1) {
    // Warm (amber) - moderately visited
    return { fill: '#FFE066', border: '#FCC419', label: 'warm' };
  } else {
    // Cold (teal) - rarely visited
    return { fill: '#63E6BE', border: '#20C997', label: 'cold' };
  }
}

function generateHeatmapDot(parsed, visitCounts) {
  const lines = [];

  // Find max visits for normalization
  const maxVisits = Math.max(...Object.values(visitCounts), 1);

  lines.push('digraph InkHeatmap {');
  lines.push('  // Graph settings - compact layout');
  lines.push('  rankdir=TB;');
  lines.push('  nodesep=0.4;');
  lines.push('  ranksep=0.5;');
  lines.push('  splines=polyline;');
  lines.push('  overlap=scalexy;');
  lines.push('  pack=true;');
  lines.push('  packmode=clust;');
  lines.push('  compound=true;');
  lines.push('  newrank=true;');
  lines.push('  node [fontname="Inter, -apple-system, system-ui, sans-serif", fontsize=10, margin="0.15,0.08", penwidth=1.2];');
  lines.push('  edge [fontname="Inter, -apple-system, system-ui, sans-serif", fontsize=8, color="#CED4DA", penwidth=1, arrowsize=0.6];');
  lines.push('  bgcolor="#FAFBFC";');
  lines.push('  graph [fontname="Inter, -apple-system, system-ui, sans-serif"];');
  lines.push('');

  // Legend - compact horizontal layout
  lines.push('  // Legend');
  lines.push('  subgraph cluster_legend {');
  lines.push('    label="Coverage";');
  lines.push('    labeljust=l;');
  lines.push('    fontsize=10;');
  lines.push('    fontcolor="#495057";');
  lines.push('    style="filled,rounded";');
  lines.push('    fillcolor="white";');
  lines.push('    color="#DEE2E6";');
  lines.push('    penwidth=1;');
  lines.push('    margin=6;');
  lines.push('    rank=same;');
  lines.push(
    '    legend_hot [label="Hot >50%", shape=box, style="filled,rounded", fillcolor="#FF8787", color="#FA5252", fontcolor="#C92A2A", fontsize=8];',
  );
  lines.push(
    '    legend_warm [label="Warm 10-50%", shape=box, style="filled,rounded", fillcolor="#FFE066", color="#FCC419", fontcolor="#E67700", fontsize=8];',
  );
  lines.push(
    '    legend_cold [label="Cold <10%", shape=box, style="filled,rounded", fillcolor="#63E6BE", color="#20C997", fontcolor="#087F5B", fontsize=8];',
  );
  lines.push(
    '    legend_gray [label="Unreached", shape=box, style="filled,rounded", fillcolor="#DEE2E6", color="#ADB5BD", fontcolor="#495057", fontsize=8];',
  );
  lines.push(
    '    legend_hot -> legend_warm -> legend_cold -> legend_gray [style=invis];',
  );
  lines.push('  }');
  lines.push('');

  // Group by knot
  const knotGroups = {};
  for (const knot of parsed.knots) {
    knotGroups[knot.name] = { knot, stitches: [] };
  }
  for (const stitch of parsed.stitches) {
    if (knotGroups[stitch.parent]) {
      knotGroups[stitch.parent].stitches.push(stitch);
    }
  }

  // Generate subgraphs with heatmap colors
  for (const [knotName, group] of Object.entries(knotGroups)) {
    lines.push(`  // ${knotName} (${group.knot.file})`);
    lines.push(`  subgraph cluster_${knotName} {`);
    lines.push(`    label="${knotName}";`);
    lines.push(`    labeljust=l;`);
    lines.push(`    fontsize=10;`);
    lines.push(`    fontcolor="#495057";`);
    lines.push(`    style="filled,rounded";`);
    lines.push(`    fillcolor="white";`);
    lines.push(`    color="#DEE2E6";`);
    lines.push(`    penwidth=1;`);
    lines.push(`    margin=8;`);
    lines.push('');

    // Knot root node (always visited via ChoosePathString)
    const knotId = sanitizeId(knotName);
    lines.push(
      `    ${knotId} [label="${knotName}\\n(entry)", shape=box, style="filled,rounded,bold", fillcolor="#5B8DEE", fontcolor="white", color="#3D6FD4"];`,
    );

    // Stitch nodes with heatmap colors
    for (const stitch of group.stitches) {
      const stitchId = sanitizeId(`${knotName}_${stitch.name}`);
      const key = `${knotName}.${stitch.name}`;
      const visits = visitCounts[key] || 0;
      const color = getHeatColor(visits, maxVisits);
      const label = `${stitch.name}\\n(${visits})`;
      lines.push(
        `    ${stitchId} [label="${label}", shape=ellipse, style="filled", fillcolor="${color.fill}", color="${color.border}", fontcolor="#343A40"];`,
      );
    }

    lines.push('  }');
    lines.push('');
  }

  // Generate edges
  lines.push('  // Diverts (edges)');
  const edgeSet = new Set();

  for (const divert of parsed.diverts) {
    const fromId = sanitizeId(divert.from.replace('.', '_'));
    let toId;

    if (divert.to.includes('.')) {
      toId = sanitizeId(divert.to.replace('.', '_'));
    } else {
      const fromKnot = divert.from.split('.')[0];
      const isLocalStitch = parsed.stitches.some(
        (s) => s.parent === fromKnot && s.name === divert.to,
      );
      if (isLocalStitch) {
        toId = sanitizeId(`${fromKnot}_${divert.to}`);
      } else {
        toId = sanitizeId(divert.to);
      }
    }

    const edgeKey = `${fromId}->${toId}`;
    if (edgeSet.has(edgeKey)) continue;
    edgeSet.add(edgeKey);

    lines.push(`  ${fromId} -> ${toId};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ============ Main ============

async function main() {
  console.log(`=== Ink Coverage Heatmap Generator (locale: ${locale}) ===\n`);

  // Load story
  console.log('Loading story...');
  if (ARGS.verbose) console.log(`  Story path: ${CONFIG.storyPath}`);
  let storyJson;
  try {
    const storyContent = readFileSync(CONFIG.storyPath, 'utf-8');
    storyJson = JSON.parse(storyContent);
  } catch (error) {
    console.error(`Failed to load story: ${error.message}`);
    console.error('Run "mise run build" first.');
    process.exit(1);
  }

  // Extract ink structure first (needed for visit count collection)
  const inkStructure = extractInkStructure(CONFIG.inkDir);

  // Collect coverage data
  console.log(
    `Running ${CONFIG.playthroughs} playthroughs for coverage data...`,
  );
  if (ARGS.verbose)
    console.log(`  Max steps per run: ${CONFIG.maxStepsPerRun}`);
  const collector = new CoverageCollector(storyJson, inkStructure);
  collector.runCoverage(CONFIG.playthroughs);

  const visitCounts = collector.visitCounts;
  const totalVisits = Object.values(visitCounts).reduce((a, b) => a + b, 0);
  const visitedCount = Object.values(visitCounts).filter((v) => v > 0).length;

  console.log(`  Total visits recorded: ${totalVisits}`);
  console.log(`  Unique locations visited: ${visitedCount}`);

  // Parse ink structure
  console.log('\nParsing ink files...');
  if (ARGS.verbose) console.log(`  Ink directory: ${CONFIG.inkDir}`);
  const parsed = parseInkFiles(CONFIG.inkDir);
  console.log(
    `  Found: ${parsed.knots.length} knots, ${parsed.stitches.length} stitches, ${parsed.diverts.length} diverts`,
  );

  // Generate heatmap
  console.log('\nGenerating heatmap DOT...');
  const dot = generateHeatmapDot(parsed, visitCounts);
  if (ARGS.verbose) {
    const maxVisits = Math.max(...Object.values(visitCounts), 1);
    console.log(`  Max visits (normalizer): ${maxVisits}`);
  }

  // Ensure output directory
  if (!existsSync(CONFIG.outputDir)) {
    mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Optionally write DOT file (for debugging)
  if (ARGS.keepDot) {
    const dotPath = join(CONFIG.outputDir, `${CONFIG.outputFile}.dot`);
    writeFileSync(dotPath, dot);
    console.log(`Wrote: ${dotPath}`);
  }

  // Render SVG
  console.log('Rendering SVG...');
  const svg = await renderDotToSvg(dot);
  const svgPath = join(CONFIG.outputDir, `${CONFIG.outputFile}.svg`);
  writeFileSync(svgPath, svg);
  console.log(`Wrote: ${svgPath}`);

  // Print summary
  console.log('\n=== Coverage Summary ===');
  const sortedCounts = Object.entries(visitCounts).sort((a, b) => b[1] - a[1]);

  if (ARGS.verbose) {
    console.log('\nMost visited:');
    for (const [loc, count] of sortedCounts.slice(0, 10)) {
      console.log(`  ${count.toString().padStart(5)} - ${loc}`);
    }
  } else {
    console.log('\nMost visited:');
    for (const [loc, count] of sortedCounts.slice(0, 5)) {
      console.log(`  ${count.toString().padStart(5)} - ${loc}`);
    }
  }

  const zeroVisits = parsed.stitches.filter((s) => {
    const key = `${s.parent}.${s.name}`;
    return !visitCounts[key] || visitCounts[key] === 0;
  });

  if (zeroVisits.length > 0) {
    console.log('\nUnreached (gray in heatmap):');
    for (const s of zeroVisits) {
      console.log(`  ${s.parent}.${s.name} (${s.file})`);
    }
  }

  if (ARGS.verbose) {
    console.log(`\nSVG size: ${Math.round(svg.length / 1024)}KB`);
  }
}

main().catch(console.error);

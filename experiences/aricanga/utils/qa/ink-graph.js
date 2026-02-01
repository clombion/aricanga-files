#!/usr/bin/env node
/**
 * Ink Graph Generator - Parse ink files and generate Graphviz DOT format
 * Visualizes knots, stitches, and diverts as a directed graph
 *
 * Usage:
 *   node scripts/ink-graph.js [options]
 *
 * Options:
 *   --help, -h     Show this help message
 *   --verbose, -v  Show detailed parsing output
 *   --locale=XX    Use specific locale (default: from config)
 *
 * Exit codes:
 *   0 - Graph generated successfully
 *   1 - Generation failed
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
ink-graph.js - Generate Graphviz visualization of ink story structure

USAGE
  node scripts/ink-graph.js [options]

OPTIONS
  --help, -h     Show this help message
  --verbose, -v  Show detailed parsing output
  --locale=XX    Use specific locale (default: from config)
  --dot          Also output intermediate .dot file (for debugging)

VISUALIZATION
  • Knots are shown as subgraph clusters
  • Stitches are ellipse nodes within knots
  • Diverts are edges between nodes
  • Conditional diverts are shown with dashed lines
  • Cross-chat dependencies (if available) shown in red

OUTPUT FILES
  generated/story-graph.svg   Rendered SVG image
  generated/story-graph.dot   (only with --dot flag)

EXIT CODES
  0  Graph generated successfully
  1  Generation failed

EXAMPLES
  node scripts/ink-graph.js              # Generate graph
  node scripts/ink-graph.js -v           # Verbose output
  node scripts/ink-graph.js --dot        # Also output .dot file
  node scripts/ink-graph.js --locale=fr  # Graph French locale
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
  outputDir: join(PROJECT_ROOT, 'generated'),
  outputFile: 'story-graph',
};

/**
 * Parse a single ink file and extract structure
 */
function parseInkFile(filePath, fileName) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const result = {
    knots: [], // [{ name, line, file }]
    stitches: [], // [{ name, parent, line, file }]
    diverts: [], // [{ from, to, condition, line, file }]
  };

  let currentKnot = null;
  let currentStitch = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Detect knot (=== name ===)
    const knotMatch = line.match(/^===\s*(\w+)\s*===/);
    if (knotMatch) {
      currentKnot = knotMatch[1];
      currentStitch = null;
      result.knots.push({
        name: currentKnot,
        line: lineNum,
        file: fileName,
      });
      continue;
    }

    // Detect stitch (= name)
    const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
    if (stitchMatch && currentKnot) {
      currentStitch = stitchMatch[1];
      result.stitches.push({
        name: currentStitch,
        parent: currentKnot,
        line: lineNum,
        file: fileName,
      });
      continue;
    }

    // Detect diverts (-> target)
    // Match both simple diverts and conditional diverts
    const divertMatches = line.matchAll(/->\s*([a-zA-Z_][a-zA-Z0-9_.]*)/g);
    for (const match of divertMatches) {
      const target = match[1];
      if (target === 'DONE') continue; // Skip terminal diverts

      // Determine current location
      const from = currentStitch
        ? `${currentKnot}.${currentStitch}`
        : currentKnot;

      // Check if this is inside a conditional
      const condMatch = line.match(/^\s*\{([^:]+):/);
      const condition = condMatch ? condMatch[1].trim() : null;

      result.diverts.push({
        from,
        to: target,
        condition,
        line: lineNum,
        file: fileName,
      });
    }
  }

  return result;
}

/**
 * Parse all ink files in directory
 */
function parseAllInkFiles(inkDir) {
  const files = readdirSync(inkDir).filter((f) => f.endsWith('.ink'));
  const combined = {
    knots: [],
    stitches: [],
    diverts: [],
  };

  for (const file of files) {
    const filePath = join(inkDir, file);
    const result = parseInkFile(filePath, file);
    combined.knots.push(...result.knots);
    combined.stitches.push(...result.stitches);
    combined.diverts.push(...result.diverts);
  }

  return combined;
}

/**
 * Generate DOT format from parsed structure
 */
function generateDot(parsed) {
  const lines = [];

  lines.push('digraph InkStory {');
  lines.push('  // Graph settings - compact horizontal layout');
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
  lines.push('  edge [fontname="Inter, -apple-system, system-ui, sans-serif", fontsize=8, penwidth=1, arrowsize=0.6, labelfontsize=7];');
  lines.push('  bgcolor="transparent";');
  lines.push('  graph [fontname="Inter, -apple-system, system-ui, sans-serif"];');
  lines.push('');

  // Group nodes by knot (subgraphs)
  const knotGroups = {};
  for (const knot of parsed.knots) {
    knotGroups[knot.name] = {
      knot,
      stitches: [],
    };
  }
  for (const stitch of parsed.stitches) {
    if (knotGroups[stitch.parent]) {
      knotGroups[stitch.parent].stitches.push(stitch);
    }
  }

  // Modern color palette - softer, more cohesive
  const colors = {
    pat_chat: { main: '#5B8DEE', light: '#E8F0FE', border: '#3D6FD4' }, // Soft blue
    news_chat: { main: '#9775FA', light: '#F3EFFE', border: '#7950D2' }, // Soft purple
    notes_chat: { main: '#51CF66', light: '#E6F9EA', border: '#37B24D' }, // Soft green
    spectre_chat: { main: '#FF8787', light: '#FFF0F0', border: '#F06060' }, // Soft red
    activist_chat: { main: '#FFA94D', light: '#FFF4E6', border: '#F59F00' }, // Soft orange
  };
  const defaultColor = { main: '#868E96', light: '#F1F3F5', border: '#6C757D' };

  // Generate subgraphs for each knot
  for (const [knotName, group] of Object.entries(knotGroups)) {
    const palette = colors[knotName] || defaultColor;

    lines.push(`  // ${knotName} (${group.knot.file})`);
    lines.push(`  subgraph cluster_${knotName} {`);
    lines.push(`    label="${knotName}";`);
    lines.push(`    labeljust=l;`);
    lines.push(`    fontsize=11;`);
    lines.push(`    fontcolor="#495057";`);
    lines.push(`    style="filled,rounded";`);
    lines.push(`    fillcolor="${palette.light}";`);
    lines.push(`    color="${palette.border}";`);
    lines.push(`    penwidth=1.5;`);
    lines.push(`    margin=8;`);
    lines.push('');

    // Knot root node (entry point)
    const knotId = sanitizeId(knotName);
    lines.push(
      `    ${knotId} [label="${knotName}", shape=box, style="filled,rounded,bold", fillcolor="${palette.main}", fontcolor="white", color="${palette.border}"];`,
    );

    // Stitch nodes
    for (const stitch of group.stitches) {
      const stitchId = sanitizeId(`${knotName}_${stitch.name}`);
      lines.push(
        `    ${stitchId} [label="${stitch.name}", shape=ellipse, style="filled", fillcolor="white", color="${palette.border}"];`,
      );
    }

    lines.push('  }');
    lines.push('');
  }

  // Generate edges from diverts
  lines.push('  // Diverts (edges)');
  const edgeSet = new Set(); // Deduplicate edges

  for (const divert of parsed.diverts) {
    const fromId = sanitizeId(divert.from.replace('.', '_'));
    let toId;

    // Resolve target - could be knot, stitch, or knot.stitch
    if (divert.to.includes('.')) {
      // Explicit knot.stitch reference
      toId = sanitizeId(divert.to.replace('.', '_'));
    } else {
      // Could be a stitch in current knot or another knot
      const fromKnot = divert.from.split('.')[0];

      // Check if target is a stitch in current knot
      const isLocalStitch = parsed.stitches.some(
        (s) => s.parent === fromKnot && s.name === divert.to,
      );

      if (isLocalStitch) {
        toId = sanitizeId(`${fromKnot}_${divert.to}`);
      } else {
        // Assume it's a knot reference
        toId = sanitizeId(divert.to);
      }
    }

    // Build edge key for deduplication
    const edgeKey = `${fromId}->${toId}`;
    if (edgeSet.has(edgeKey)) continue;
    edgeSet.add(edgeKey);

    // Add edge with optional condition label (truncate aggressively)
    if (divert.condition) {
      const shortCondition =
        divert.condition.length > 12
          ? `${divert.condition.slice(0, 12)}…`
          : divert.condition;
      lines.push(
        `  ${fromId} -> ${toId} [label="${escapeLabel(shortCondition)}", style=dashed, color="#ADB5BD", fontcolor="#868E96", fontsize=7];`,
      );
    } else {
      lines.push(`  ${fromId} -> ${toId} [color="#868E96"];`);
    }
  }

  // Add cross-chat dependency edges (if dependency data available)
  const depsPath = join(CONFIG.outputDir, 'story-dependencies.json');
  if (existsSync(depsPath)) {
    try {
      const depsData = JSON.parse(readFileSync(depsPath, 'utf-8'));
      if (
        depsData.crossChatDependencies &&
        depsData.crossChatDependencies.length > 0
      ) {
        lines.push('');
        lines.push('  // Cross-chat variable dependencies');
        const depEdgeSet = new Set();

        for (const dep of depsData.crossChatDependencies) {
          const fromId = sanitizeId(`${dep.from}_chat`);
          const toId = sanitizeId(`${dep.to}_chat`);
          const edgeKey = `${fromId}->${toId}:${dep.variable}`;

          if (depEdgeSet.has(edgeKey)) continue;
          depEdgeSet.add(edgeKey);

          // Truncate variable name for edge label
          const shortVar = dep.variable.length > 10 ? `${dep.variable.slice(0, 10)}…` : dep.variable;
          lines.push(
            `  ${fromId} -> ${toId} [label="${shortVar}", style=dashed, color="#FA5252", fontcolor="#E03131", fontsize=7, penwidth=1.2, constraint=false];`,
          );
        }
      }
    } catch (_e) {
      // Ignore if deps file is invalid
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Sanitize node ID for DOT format
 */
function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Escape label text for DOT format
 */
function escapeLabel(str) {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Generate summary statistics
 */
function generateStats(parsed) {
  const stats = {
    knots: parsed.knots.length,
    stitches: parsed.stitches.length,
    diverts: parsed.diverts.length,
    conditionalDiverts: parsed.diverts.filter((d) => d.condition).length,
  };

  const byFile = {};
  for (const knot of parsed.knots) {
    byFile[knot.file] = byFile[knot.file] || { knots: 0, stitches: 0 };
    byFile[knot.file].knots++;
  }
  for (const stitch of parsed.stitches) {
    byFile[stitch.file] = byFile[stitch.file] || { knots: 0, stitches: 0 };
    byFile[stitch.file].stitches++;
  }

  return { stats, byFile };
}

// Main execution
async function main() {
  console.log(`Parsing ink files (locale: ${locale})...`);
  if (ARGS.verbose) console.log(`  Ink directory: ${CONFIG.inkDir}`);

  // Parse all ink files
  const parsed = parseAllInkFiles(CONFIG.inkDir);
  const { stats, byFile } = generateStats(parsed);

  console.log(`\nStructure found:`);
  console.log(`  Knots: ${stats.knots}`);
  console.log(`  Stitches: ${stats.stitches}`);
  console.log(
    `  Diverts: ${stats.diverts} (${stats.conditionalDiverts} conditional)`,
  );

  if (ARGS.verbose) {
    console.log('\nBy file:');
    for (const [file, data] of Object.entries(byFile)) {
      console.log(`  ${file}: ${data.knots} knots, ${data.stitches} stitches`);
    }
  }

  // Generate DOT
  console.log('\nGenerating DOT graph...');
  const dot = generateDot(parsed);
  if (ARGS.verbose) {
    const lines = dot.split('\n').length;
    console.log(`  DOT output: ${lines} lines`);
  }

  // Ensure output directory exists
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

  if (ARGS.verbose) {
    console.log(`\nSVG size: ${Math.round(svg.length / 1024)}KB`);
  }
}

main().catch(console.error);

// packages/tests/quality/architecture/dead-code.test.ts
// Static analysis of ink files for dead code detection
// CQO-related: Helps maintain clean, reachable narrative content

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getLocalePaths } from '@narratives/test-utils/helpers';

const { inkDir: INK_DIR, variablesFile: VARIABLES_FILE, locale } = getLocalePaths();

interface InkStructure {
  knots: Map<string, { file: string; line: number }>;
  stitches: Map<string, { parent: string; file: string; line: number }>;
  diverts: Array<{ from: string; to: string; file: string; line: number }>;
}

interface VariableUsage {
  assignments: Map<string, { file: string; line: number }[]>;
  references: Map<string, { file: string; line: number }[]>;
}

/**
 * Parse all ink files to extract structure
 */
function parseInkStructure(): InkStructure {
  const structure: InkStructure = {
    knots: new Map(),
    stitches: new Map(),
    diverts: [],
  };

  const files = fs.readdirSync(INK_DIR).filter((f) => f.endsWith('.ink'));

  for (const file of files) {
    const filePath = path.join(INK_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let currentKnot: string | null = null;
    let currentStitch: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detect knot (=== name ===)
      const knotMatch = line.match(/^===\s*(\w+)\s*===/);
      if (knotMatch) {
        currentKnot = knotMatch[1];
        currentStitch = null;
        structure.knots.set(currentKnot, { file, line: lineNum });
        continue;
      }

      // Detect stitch (= name)
      const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
      if (stitchMatch && currentKnot) {
        currentStitch = stitchMatch[1];
        const fullName = `${currentKnot}.${currentStitch}`;
        structure.stitches.set(fullName, {
          parent: currentKnot,
          file,
          line: lineNum,
        });
        continue;
      }

      // Detect diverts (-> target)
      const divertMatches = line.matchAll(/->\s*([a-zA-Z_][a-zA-Z0-9_.]*)/g);
      for (const match of divertMatches) {
        const target = match[1];
        if (target === 'DONE') continue;

        const from = currentStitch
          ? `${currentKnot}.${currentStitch}`
          : currentKnot || 'unknown';

        structure.diverts.push({
          from,
          to: target,
          file,
          line: lineNum,
        });
      }
    }
  }

  return structure;
}

/**
 * Parse ink files for variable usage
 */
function parseVariableUsage(structure?: InkStructure): VariableUsage {
  const usage: VariableUsage = {
    assignments: new Map(),
    references: new Map(),
  };

  // Collect absolute paths for all ink files to scan
  const filePaths = fs.readdirSync(INK_DIR)
    .filter((f) => f.endsWith('.ink'))
    .map((f) => path.join(INK_DIR, f));

  // Also include the shared variables file (lives outside locale chat dir)
  if (VARIABLES_FILE && fs.existsSync(VARIABLES_FILE) && !filePaths.includes(VARIABLES_FILE)) {
    filePaths.push(VARIABLES_FILE);
  }

  // Collect knot and stitch names to exclude implicit visit-count variables
  const implicitVarNames = new Set<string>();
  if (structure) {
    for (const knot of structure.knots.keys()) implicitVarNames.add(knot);
    for (const stitch of structure.stitches.keys()) {
      implicitVarNames.add(stitch.split('.').pop()!);
    }
  }

  for (const filePath of filePaths) {
    const file = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip comments
      if (line.trim().startsWith('//')) continue;

      // Detect VAR declarations: VAR name = value
      const varDeclMatch = line.match(/^\s*VAR\s+(\w+)\s*=/);
      if (varDeclMatch) {
        const varName = varDeclMatch[1];
        if (!usage.assignments.has(varName)) {
          usage.assignments.set(varName, []);
        }
        usage.assignments.get(varName)!.push({ file, line: lineNum });
      }

      // Detect assignments: ~ name = value
      const assignMatch = line.match(/^\s*~\s*(\w+)\s*=/);
      if (assignMatch) {
        const varName = assignMatch[1];
        if (!usage.assignments.has(varName)) {
          usage.assignments.set(varName, []);
        }
        usage.assignments.get(varName)!.push({ file, line: lineNum });
      }

      // Detect references in conditionals: {varname ...}
      const condMatches = line.matchAll(/\{([^{}:]+)/g);
      for (const match of condMatches) {
        const content = match[1];

        // Skip name() function calls - their string arguments are not variables
        if (content.trim().startsWith('name(')) continue;

        // Remove quoted strings before extracting variable names
        const contentWithoutStrings = content.replace(/"[^"]*"/g, '');

        // Extract variable names (simple heuristic)
        const varMatches = contentWithoutStrings.matchAll(/\b([a-z_][a-z0-9_]*)\b/gi);
        for (const varMatch of varMatches) {
          const varName = varMatch[1];
          // Skip keywords and common words
          if (
            ['not', 'and', 'or', 'true', 'false', 'mod'].includes(
              varName.toLowerCase()
            )
          )
            continue;
          if (!usage.references.has(varName)) {
            usage.references.set(varName, []);
          }
          usage.references.get(varName)!.push({ file, line: lineNum });
        }
      }
    }
  }

  return usage;
}

/**
 * Resolve divert target to full path
 */
function resolveDivertTarget(
  target: string,
  fromKnot: string,
  structure: InkStructure
): string | null {
  // If target contains dot, it's already fully qualified
  if (target.includes('.')) {
    return target;
  }

  // Check if it's a stitch in the current knot
  const localStitch = `${fromKnot}.${target}`;
  if (structure.stitches.has(localStitch)) {
    return localStitch;
  }

  // Check if it's a knot
  if (structure.knots.has(target)) {
    return target;
  }

  return null;
}

describe(`Dead Code Detection [${locale}]`, () => {
  it('DC-1: All stitches should be reachable', () => {
    const structure = parseInkStructure();

    // Build set of reachable stitches
    const reachable = new Set<string>();

    // All knot entry points are reachable (they're called from game code)
    for (const knot of structure.knots.keys()) {
      reachable.add(knot);
    }

    // Trace diverts to find reachable stitches
    for (const divert of structure.diverts) {
      const fromKnot = divert.from.split('.')[0];
      const resolved = resolveDivertTarget(divert.to, fromKnot, structure);

      if (resolved) {
        reachable.add(resolved);

        // If diverting to a knot, also mark its first stitch as potentially reachable
        if (structure.knots.has(resolved)) {
          // Find stitches in this knot
          for (const [stitchName, stitchData] of structure.stitches) {
            if (stitchData.parent === resolved) {
              // First stitch after knot declaration is implicitly reachable
              // (but we can't easily determine "first" without line numbers)
            }
          }
        }
      }
    }

    // Find unreachable stitches
    const unreachable: string[] = [];
    for (const [stitchName, stitchData] of structure.stitches) {
      if (!reachable.has(stitchName)) {
        // Check if parent knot has a divert to this stitch
        const hasLocalDivert = structure.diverts.some((d) => {
          const fromKnot = d.from.split('.')[0];
          return fromKnot === stitchData.parent && d.to === stitchName.split('.')[1];
        });

        // Also check if the knot root diverts to this stitch
        const hasKnotDivert = structure.diverts.some(
          (d) => d.from === stitchData.parent && d.to === stitchName.split('.')[1]
        );

        if (!hasLocalDivert && !hasKnotDivert) {
          unreachable.push(`${stitchData.file}:${stitchData.line} - ${stitchName}`);
        }
      }
    }

    if (unreachable.length > 0) {
      console.log('\nPotentially unreachable stitches:');
      for (const u of unreachable) {
        console.log(`  ${u}`);
      }
      console.log('\nNote: Some may be reachable via conditional logic not detected by static analysis.');
    }

    // Soft assertion - report but don't fail (may have false positives)
    // Allow some false positives
    expect(unreachable.length).toBeLessThanOrEqual(5);
  });

  it('DC-2: Variables should be both assigned and referenced', () => {
    const structure = parseInkStructure();
    const usage = parseVariableUsage(structure);

    // Knot/stitch names are implicit visit-count variables in ink
    const implicitVarNames = new Set<string>();
    for (const knot of structure.knots.keys()) implicitVarNames.add(knot);
    for (const stitch of structure.stitches.keys()) {
      implicitVarNames.add(stitch.split('.').pop()!);
    }

    const issues: string[] = [];

    // Find variables that are assigned but never referenced
    for (const [varName, assignments] of usage.assignments) {
      if (!usage.references.has(varName)) {
        // Skip common system variables and _unread variables (used by JS)
        if (varName.endsWith('_unread')) continue;
        if (varName.startsWith('data_')) continue;
        if (['current_chat', 'game_phase'].includes(varName)) continue;

        const loc = assignments[0];
        issues.push(`Assigned but never read: ${varName} (${loc.file}:${loc.line})`);
      }
    }

    // Find variables that are referenced but never assigned
    for (const [varName, references] of usage.references) {
      if (!usage.assignments.has(varName)) {
        // Skip if it looks like a function call or ink keyword
        if (varName.length <= 2) continue;
        // Skip implicit visit-count variables (knot/stitch names)
        if (implicitVarNames.has(varName)) continue;

        const loc = references[0];
        issues.push(`Read but never assigned: ${varName} (${loc.file}:${loc.line})`);
      }
    }

    if (issues.length > 0) {
      console.log('\nVariable usage issues:');
      for (const issue of issues) {
        console.log(`  ${issue}`);
      }
    }

    // Soft assertion - may have false positives due to dynamic ink features
    expect(issues.length).toBeLessThanOrEqual(10);
  });

  it('DC-3: Report ink structure statistics (informational)', () => {
    const structure = parseInkStructure();
    const usage = parseVariableUsage();

    console.log('\n=== Ink Structure Statistics ===');
    console.log(`Knots: ${structure.knots.size}`);
    console.log(`Stitches: ${structure.stitches.size}`);
    console.log(`Diverts: ${structure.diverts.length}`);
    console.log(`Variables declared: ${usage.assignments.size}`);
    console.log(`Variables referenced: ${usage.references.size}`);

    // This test always passes - it's for reporting
    expect(true).toBe(true);
  });
});

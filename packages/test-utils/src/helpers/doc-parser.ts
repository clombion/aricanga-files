// Doc-code contract test helpers
// Parse documentation and code to extract APIs for contract verification

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();

// ============================================================================
// External Functions Parser
// ============================================================================

/**
 * INTENT: Extract external function names that ink stories can call at runtime.
 * Used to verify documented external functions match the actual code bindings.
 *
 * ASSUMPTION: External functions are defined in createExternalFunctions() in
 * packages/framework/src/systems/conversation/ink/external-functions.js.
 * The function returns an object with function names as keys.
 *
 * BREAKS if:
 * - External functions move to a different file
 * - Function definition pattern changes (no longer object literal return)
 * - Build-time vs runtime functions diverge significantly
 *
 * @param impl - Implementation name (unused, kept for API compatibility)
 */
export function extractBoundFunctions(impl?: string): string[] {
  // External functions are now defined in the shared framework module
  const filePath = 'packages/framework/src/systems/conversation/ink/external-functions.js';
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const functions: string[] = [];

  // Pattern 1: Function names in createExternalFunctions return object
  // Matches: name: (key, variant) => { or name: function(...
  // Look within the return { ... } block of createExternalFunctions
  const returnBlockMatch = content.match(
    /export function createExternalFunctions[\s\S]*?return\s*\{([\s\S]*?)\n\s*\};/
  );

  if (returnBlockMatch) {
    const returnBlock = returnBlockMatch[1];
    // Match function property definitions: name: (...) => or name: function
    const funcPattern = /^\s*(\w+)\s*:\s*(?:\([^)]*\)\s*=>|[^,]+\|\|\s*\(\s*\(\)\s*=>)/gm;
    let match;
    while ((match = funcPattern.exec(returnBlock)) !== null) {
      functions.push(match[1]);
    }
  }

  // Pattern 2: Also check createBuildExternalFunctions for completeness
  const buildReturnMatch = content.match(
    /export function createBuildExternalFunctions[\s\S]*?return\s*\{([\s\S]*?)\n\s*\};/
  );

  if (buildReturnMatch) {
    const buildBlock = buildReturnMatch[1];
    const funcPattern = /^\s*(\w+)\s*:/gm;
    let match;
    while ((match = funcPattern.exec(buildBlock)) !== null) {
      if (!functions.includes(match[1])) {
        functions.push(match[1]);
      }
    }
  }

  return functions.sort();
}

/**
 * INTENT: Extract function names documented in inkjs-features.md for contract testing.
 * Verifies that documented external functions match what's actually bound in code.
 *
 * ASSUMPTION: External functions are documented in inkjs-features.md using:
 * - Table rows: | `function_name(args)` |
 * - Ink usage: ~ function_name( or {function_name(
 * - Section headers: ### function_name(
 *
 * BREAKS if:
 * - Documentation moves to a different file
 * - Table format changes significantly
 * - Function documentation pattern changes
 */
export function extractDocumentedExternalFunctions(
  filePath: string = 'docs/reference/inkjs-features.md'
): string[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const functions = new Set<string>();

  // Pattern 1: Table cell with function signature like | `delay_next(ms)` |
  const tablePattern = /\|\s*`?(\w+)\s*\([^)]*\)`?\s*\|/g;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    // Skip common inkjs API methods
    if (!isInkjsApi(match[1])) {
      functions.add(match[1]);
    }
  }

  // Pattern 2: Ink usage examples: ~ function_name( or {function_name(
  const inkUsagePattern = /(?:~\s+|{)(\w+)\s*\(/g;
  while ((match = inkUsagePattern.exec(content)) !== null) {
    // Skip ink built-ins and common patterns
    if (!isInkBuiltin(match[1]) && !isInkjsApi(match[1])) {
      functions.add(match[1]);
    }
  }

  // Pattern 3: Dedicated section headers like "### delay_next" or "#### delay_next(ms)"
  const sectionPattern = /^#{2,4}\s+(\w+)\s*\(/gm;
  while ((match = sectionPattern.exec(content)) !== null) {
    if (!isInkjsApi(match[1])) {
      functions.add(match[1]);
    }
  }

  return Array.from(functions).sort();
}

// inkjs Story API methods (not external functions)
function isInkjsApi(name: string): boolean {
  const inkjsApis = [
    'Continue', 'ChooseChoiceIndex', 'ChoosePathString', 'BindExternalFunction',
    'ObserveVariable', 'StateSnapshot', 'RestoreStateSnapshot', 'DiscardSnapshot',
    'SwitchFlow', 'RemoveFlow', 'ToJson', 'LoadJson', 'TagsForContentAtPath',
    'VisitCountAtPathString', 'TurnsSinceForContainer', 'Story',
  ];
  return inkjsApis.includes(name);
}

// Ink language built-ins and generic example words
function isInkBuiltin(name: string): boolean {
  const builtins = [
    'INCLUDE', 'VAR', 'CONST', 'LIST', 'TURNS', 'CHOICE_COUNT',
    'function', 'functionName',  // Generic example placeholders
  ];
  return builtins.includes(name);
}

// ============================================================================
// Component API Parser
// ============================================================================

export interface ComponentMethod {
  component: string;
  method: string;
}

export interface ComponentEvent {
  component: string;
  event: string;
}

/**
 * INTENT: Extract component methods documented in component-api.md for contract testing.
 * Verifies documented methods match actual implementations.
 *
 * ASSUMPTION: Methods are documented under "### Methods" sections with table format:
 * | `methodName(params)` | description |
 *
 * BREAKS if:
 * - Section header changes from "### Methods"
 * - Table format changes
 * - Documentation moves to different file
 */
export function extractDocumentedComponentMethods(
  filePath: string = 'docs/reference/component-api.md'
): ComponentMethod[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const methods: ComponentMethod[] = [];

  // Split by component sections (## component-name)
  const componentSections = content.split(/^## /m).slice(1);

  for (const section of componentSections) {
    const lines = section.split('\n');
    const componentName = lines[0].trim().toLowerCase();

    // Skip non-component sections
    if (!componentName.includes('-') && !componentName.includes('_')) {
      continue;
    }

    // Find Methods table
    let inMethodsTable = false;
    for (const line of lines) {
      if (line.includes('### Methods')) {
        inMethodsTable = true;
        continue;
      }
      if (inMethodsTable && line.startsWith('###')) {
        inMethodsTable = false;
        continue;
      }
      if (inMethodsTable && line.startsWith('|') && !line.includes('Method') && !line.includes('---')) {
        // Parse table row: | `methodName(params)` | ...
        const methodMatch = line.match(/\|\s*`?(\w+)\s*\([^)]*\)`?\s*\|/);
        if (methodMatch) {
          methods.push({
            component: componentName,
            method: methodMatch[1],
          });
        }
      }
    }
  }

  return methods;
}

/**
 * INTENT: Extract component events documented in component-api.md for contract testing.
 * Verifies documented events match actual dispatchEvent calls.
 *
 * ASSUMPTION: Events are documented under "### Events Emitted" sections with table format:
 * | `event-name` | description |
 *
 * BREAKS if:
 * - Section header changes from "### Events Emitted"
 * - Table format changes
 * - Documentation moves to different file
 */
export function extractDocumentedComponentEvents(
  filePath: string = 'docs/reference/component-api.md'
): ComponentEvent[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const events: ComponentEvent[] = [];

  // Split by component sections
  const componentSections = content.split(/^## /m).slice(1);

  for (const section of componentSections) {
    const lines = section.split('\n');
    const componentName = lines[0].trim().toLowerCase();

    // Skip non-component sections
    if (!componentName.includes('-') && !componentName.includes('_')) {
      continue;
    }

    // Find Events Emitted table
    let inEventsTable = false;
    for (const line of lines) {
      if (line.includes('### Events Emitted')) {
        inEventsTable = true;
        continue;
      }
      if (inEventsTable && line.startsWith('###')) {
        inEventsTable = false;
        continue;
      }
      if (inEventsTable && line.startsWith('|') && !line.includes('Event') && !line.includes('---')) {
        // Parse table row: | `event-name` | ...
        const eventMatch = line.match(/\|\s*`?([\w-]+)`?\s*\|/);
        if (eventMatch && eventMatch[1] !== 'none') {
          events.push({
            component: componentName,
            event: eventMatch[1],
          });
        }
      }
    }
  }

  return events;
}

// ============================================================================
// Component Code Parser
// ============================================================================

/**
 * INTENT: Extract method names from component source files for contract testing.
 * Verifies code matches documentation.
 *
 * ASSUMPTION: Methods are defined as `methodName(params) {` with 2-space indent.
 * Skips constructor, lifecycle methods, and private methods starting with _.
 *
 * BREAKS if:
 * - Indentation changes
 * - Method definition syntax changes
 * - Private method convention changes
 */
export function extractComponentMethods(filePath: string): string[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const methods: string[] = [];

  // Match method definitions: methodName( or methodName = (
  // Skip private methods starting with # or _
  const methodPattern = /^\s+(\w+)\s*\([^)]*\)\s*{/gm;
  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    const name = match[1];
    // Skip constructor and lifecycle methods
    if (name !== 'constructor' && name !== 'connectedCallback' &&
        name !== 'disconnectedCallback' && name !== 'attributeChangedCallback' &&
        !name.startsWith('_') && !name.startsWith('render')) {
      methods.push(name);
    }
  }

  return methods;
}

/**
 * INTENT: Extract events dispatched by component source files for contract testing.
 * Verifies code matches documentation.
 *
 * ASSUMPTION: Events are dispatched via dispatchEvent(new CustomEvent('name', ...))
 * with event names as string literals.
 *
 * BREAKS if:
 * - CustomEvent creation pattern changes
 * - Event names become dynamic/computed
 * - Event dispatch moves to utility function
 */
export function extractComponentEvents(filePath: string): string[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const events: string[] = [];

  // Match: dispatchEvent(new CustomEvent('event-name'
  const eventPattern = /dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = eventPattern.exec(content)) !== null) {
    events.push(match[1]);
  }

  return [...new Set(events)]; // dedupe
}

// ============================================================================
// Analytics API Parser
// ============================================================================

/**
 * INTENT: Extract EventLogger public methods for contract testing.
 * Verifies analytics API matches documentation.
 *
 * ASSUMPTION: Methods are defined at 2-space indent in class body.
 * Includes both sync and async methods.
 *
 * BREAKS if:
 * - Class structure changes
 * - Method indentation changes
 * - EventLogger moves to different file
 */
export function extractEventLoggerMethods(
  filePath: string = 'packages/framework/src/foundation/services/event-logger.js'
): string[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const methods: string[] = [];

  // Match public method definitions (not starting with #)
  // Pattern: methodName( at start of line (with indentation)
  const methodPattern = /^\s{2}(\w+)\s*\([^)]*\)\s*{/gm;
  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    const name = match[1];
    // Skip constructor and async keyword artifacts
    if (name !== 'constructor' && name !== 'async') {
      methods.push(name);
    }
  }

  // Also catch async methods
  const asyncPattern = /^\s{2}async\s+(\w+)\s*\([^)]*\)\s*{/gm;
  while ((match = asyncPattern.exec(content)) !== null) {
    methods.push(match[1]);
  }

  return [...new Set(methods)].sort();
}

/**
 * INTENT: Extract EventLogger methods documented in analytics.md for contract testing.
 * Verifies documented API matches actual implementation.
 *
 * ASSUMPTION: Methods are documented as logger.methodName() in code examples
 * or as inline code `methodName()`.
 *
 * BREAKS if:
 * - Documentation format changes
 * - Logger variable name changes in examples
 * - Documentation moves to different file
 */
export function extractDocumentedAnalyticsMethods(
  filePath: string = 'docs/reference/analytics.md'
): string[] {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const methods = new Set<string>();

  // Pattern 1: logger.methodName( in code examples
  const loggerPattern = /logger\.(\w+)\s*\(/g;
  let match;
  while ((match = loggerPattern.exec(content)) !== null) {
    methods.add(match[1]);
  }

  // Pattern 2: EventLogger methods in API descriptions
  // Look for inline code like `methodName()`
  const inlinePattern = /`(\w+)\s*\([^)]*\)`/g;
  while ((match = inlinePattern.exec(content)) !== null) {
    // Filter to likely EventLogger methods
    const name = match[1];
    if (['start', 'stop', 'log', 'getSessionId', 'newSession',
         'getSessionEntries', 'getStore'].includes(name)) {
      methods.add(name);
    }
  }

  return Array.from(methods).sort();
}

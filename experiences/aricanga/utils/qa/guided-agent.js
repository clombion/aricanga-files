#!/usr/bin/env node

/**
 * Guided Agent - Follows the intended story path to verify progression
 * Enhanced with narrative analysis: consequences, dependencies, divergence, dead-ends
 *
 * Usage:
 *   node scripts/guided-agent.js [options]
 *
 * Options:
 *   --help, -h        Show this help message
 *   --verbose, -v     Show detailed analysis output
 *   --split           Write separate transcript files per path
 *   --no-transcript   Skip transcript generation
 *   --locale=XX       Use specific locale (default: from config)
 *
 * Exit codes:
 *   0 - Analysis completed successfully
 *   1 - Story load failed
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
import { getLocale, getLocalePaths, requireImpl } from '../../../../utils/lib/locale-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

// QA scripts are implementation-specific - require IMPL
const impl = requireImpl();
const locale = getLocale();
const localePaths = getLocalePaths(locale, impl);

// Generated output directory
const generatedDir = join(PROJECT_ROOT, 'generated');

const CONFIG = {
  storyPath: localePaths.storyPath,
  inkDir: localePaths.inkDir,
  depsPath: join(generatedDir, 'story-dependencies.json'),
  transcriptPath: join(generatedDir, 'story-transcript.md'),
  transcriptDir: join(generatedDir, 'transcripts'),
};

// ============ CLI Arguments ============

const ARGS = {
  help: process.argv.includes('--help') || process.argv.includes('-h'),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  split: process.argv.includes('--split'),
  noTranscript: process.argv.includes('--no-transcript'),
};

/**
 * Print help message and exit
 */
function showHelp() {
  console.log(`
guided-agent.js - Story path verification and narrative analysis

USAGE
  node scripts/guided-agent.js [options]

OPTIONS
  --help, -h        Show this help message
  --verbose, -v     Show detailed analysis output
  --split           Write separate transcript files per path
  --no-transcript   Skip transcript generation
  --locale=XX       Use specific locale (default: from config)

ANALYSIS PERFORMED
  • Choice Consequence Analysis - Identifies consequential vs cosmetic choices
  • Dependency Graph - Maps variable dependencies between chats
  • Divergence Analysis - Compares alternate paths to golden path
  • Dead-End Detection - Finds orphaned/unreachable stitches
  • Comparison with Random Agent - Identifies progression-gated content

OUTPUTS
  docs/story-transcript.md          Combined transcript (or docs/transcripts/ with --split)
  docs/story-dependencies.json      Cross-chat dependency data

EXIT CODES
  0  Analysis completed successfully
  1  Story load failed

EXAMPLES
  node scripts/guided-agent.js              # Run full analysis
  node scripts/guided-agent.js -v           # Verbose output
  node scripts/guided-agent.js --split      # Separate transcript files
  node scripts/guided-agent.js --locale=fr  # Analyze French locale
`);
  process.exit(0);
}

// Show help if requested
if (ARGS.help) {
  showHelp();
}

// ============ Ink Source Analysis ============

/**
 * Parse ink files to extract structure, choices, and variable assignments
 */
function analyzeInkSource(inkDir) {
  const analysis = {
    knots: {},
    stitches: {},
    variables: new Set(),
    choices: [],
    conditionals: [],
    diverts: [],
  };

  const files = readdirSync(inkDir).filter((f) => f.endsWith('.ink'));

  for (const file of files) {
    const content = readFileSync(join(inkDir, file), 'utf-8');
    const lines = content.split('\n');
    let currentKnot = null;
    let currentStitch = null;
    let inChoice = false;
    let choiceDepth = 0;
    let currentChoice = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detect knot (=== name ===)
      const knotMatch = line.match(/^===\s*(\w+)\s*===/);
      if (knotMatch) {
        currentKnot = knotMatch[1];
        currentStitch = null;
        analysis.knots[currentKnot] = { file, line: lineNum, stitches: [] };
        continue;
      }

      // Detect stitch (= name)
      const stitchMatch = line.match(/^=\s*(\w+)\s*$/);
      if (stitchMatch && currentKnot) {
        currentStitch = stitchMatch[1];
        const stitchKey = `${currentKnot}.${currentStitch}`;
        analysis.knots[currentKnot].stitches.push(currentStitch);
        analysis.stitches[stitchKey] = {
          file,
          line: lineNum,
          knot: currentKnot,
          stitch: currentStitch,
          incomingDiverts: [],
          outgoingDiverts: [],
        };
        continue;
      }

      // Detect VAR declarations
      const varDeclMatch = line.match(/^VAR\s+(\w+)\s*=/);
      if (varDeclMatch) {
        analysis.variables.add(varDeclMatch[1]);
        continue;
      }

      // Detect choice (* or +)
      const choiceMatch = line.match(/^(\*+|\++)(\s*\[.*?\])?\s*(.*)/);
      if (choiceMatch) {
        inChoice = true;
        choiceDepth = choiceMatch[1].length;
        currentChoice = {
          file,
          line: lineNum,
          knot: currentKnot,
          stitch: currentStitch,
          text: choiceMatch[3] || choiceMatch[2] || '',
          variablesSet: [],
          diverts: [],
          triggerAlerts: [],
          isCosmetic: true, // Assume cosmetic until we find variable assignment
        };
        analysis.choices.push(currentChoice);
        continue;
      }

      // Detect variable assignment (~ var = value) - can be indented in choices
      const assignMatch = line.match(/^\s*~\s*(\w+)\s*=\s*(.+)/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const value = assignMatch[2].trim();
        analysis.variables.add(varName);

        if (inChoice && currentChoice) {
          currentChoice.variablesSet.push({ variable: varName, value });
          currentChoice.isCosmetic = false;
        }
        continue;
      }

      // Detect conditional checks ({variable:} or {not variable:})
      const condMatch = line.match(/\{(not\s+)?(\w+)(\s*[><=!]+\s*\d+)?:/);
      if (condMatch) {
        const varName = condMatch[2];
        if (!['DONE', 'END'].includes(varName)) {
          analysis.conditionals.push({
            file,
            line: lineNum,
            knot: currentKnot,
            stitch: currentStitch,
            variable: varName,
            isNegated: !!condMatch[1],
          });
        }
      }

      // Detect diverts (-> target)
      const divertMatch = line.match(/->\s*(\w+)(?:\.(\w+))?/);
      if (divertMatch) {
        const target = divertMatch[2]
          ? `${divertMatch[1]}.${divertMatch[2]}`
          : divertMatch[1];

        if (!['DONE', 'END'].includes(target)) {
          const divert = {
            file,
            line: lineNum,
            from: currentStitch
              ? `${currentKnot}.${currentStitch}`
              : currentKnot,
            to: target,
          };
          analysis.diverts.push(divert);

          if (inChoice && currentChoice) {
            currentChoice.diverts.push(target);
          }
        }
      }

      // End choice context only on new stitch/knot (NOT empty lines - choices span multiple lines)
      // New choices are handled above by starting a new currentChoice
      if (line.match(/^=\s*\w+\s*$/) || line.match(/^===\s*\w+\s*===/)) {
        inChoice = false;
        currentChoice = null;
      }
    }
  }

  return analysis;
}

/**
 * Build dependency graph from conditionals
 */
function buildDependencyGraph(analysis) {
  const graph = {
    nodes: new Map(), // variable -> { setBy: [], requiredBy: [] }
    edges: [], // { from: variable, to: stitch/choice, type: 'enables'|'requires' }
  };

  // Initialize nodes for all variables
  for (const varName of analysis.variables) {
    graph.nodes.set(varName, { setBy: [], requiredBy: [] });
  }

  // Map where variables are set (by choices)
  for (const choice of analysis.choices) {
    for (const { variable } of choice.variablesSet) {
      const node = graph.nodes.get(variable);
      if (node) {
        node.setBy.push({
          location: `${choice.knot}.${choice.stitch || 'root'}`,
          choiceText: choice.text.substring(0, 40),
        });
      }
    }
  }

  // Map where variables are required (by conditionals)
  for (const cond of analysis.conditionals) {
    const node = graph.nodes.get(cond.variable);
    if (node) {
      node.requiredBy.push({
        location: `${cond.knot}.${cond.stitch || 'root'}`,
        isNegated: cond.isNegated,
      });
    }
  }

  // Build edges for dependency chains
  for (const [varName, node] of graph.nodes) {
    for (const setter of node.setBy) {
      for (const requirer of node.requiredBy) {
        if (!requirer.isNegated) {
          graph.edges.push({
            from: setter.location,
            to: requirer.location,
            via: varName,
            type: 'enables',
          });
        }
      }
    }
  }

  return graph;
}

/**
 * Find orphaned content (stitches with no incoming diverts)
 */
function findOrphanedContent(analysis) {
  const orphans = [];
  const reachable = new Set();

  // Mark all divert targets as reachable
  for (const divert of analysis.diverts) {
    reachable.add(divert.to);
  }

  // Entry points are always reachable
  for (const knot of Object.keys(analysis.knots)) {
    reachable.add(knot);
  }

  // Check each stitch
  for (const [stitchKey, stitch] of Object.entries(analysis.stitches)) {
    // First stitch in a knot is reachable from knot entry
    const knotData = analysis.knots[stitch.knot];
    const isFirstStitch = knotData.stitches[0] === stitch.stitch;

    if (!isFirstStitch && !reachable.has(stitchKey)) {
      orphans.push({
        location: stitchKey,
        file: stitch.file,
        line: stitch.line,
        reason: 'No incoming diverts found',
      });
    }
  }

  return orphans;
}

/**
 * Detect narrative design patterns present in the story
 */
function detectDesignPatterns(analysis, depGraph) {
  const patterns = {
    cosmetic: [],
    gating: [],
    nonBlocking: [],
    delayedConsequence: [],
  };

  // Build set of variables checked by conditionals
  const checkedVars = new Set();
  for (const cond of analysis.conditionals) {
    checkedVars.add(cond.variable);
  }

  // Build map of which chat each variable is set/checked in
  const varSetInChat = new Map();
  const varCheckedInChat = new Map();

  for (const choice of analysis.choices) {
    const chatId = choice.knot?.replace('_chat', '') || 'unknown';
    for (const { variable } of choice.variablesSet) {
      if (!varSetInChat.has(variable)) varSetInChat.set(variable, new Set());
      varSetInChat.get(variable).add(chatId);
    }
  }

  for (const cond of analysis.conditionals) {
    const chatId = cond.knot?.replace('_chat', '') || 'unknown';
    if (!varCheckedInChat.has(cond.variable))
      varCheckedInChat.set(cond.variable, new Set());
    varCheckedInChat.get(cond.variable).add(chatId);
  }

  // Analyze each choice
  for (const choice of analysis.choices) {
    const chatId = choice.knot?.replace('_chat', '') || 'unknown';

    // Cosmetic: no variables set
    if (choice.isCosmetic) {
      patterns.cosmetic.push({
        location: `${choice.knot}.${choice.stitch || 'root'}`,
        text: choice.text.substring(0, 40),
      });
      continue;
    }

    // Analyze each variable set by this choice
    for (const { variable, value } of choice.variablesSet) {
      const isChecked = checkedVars.has(variable);
      const hasAlert = choice.triggerAlerts.length > 0;
      const setChats = varSetInChat.get(variable) || new Set();
      const checkChats = varCheckedInChat.get(variable) || new Set();

      // Delayed consequence: set in one chat, checked in different chat
      const crossChat = [...checkChats].some((c) => !setChats.has(c));

      if (crossChat) {
        patterns.delayedConsequence.push({
          variable,
          setIn: chatId,
          checkedIn: [...checkChats].filter((c) => c !== chatId),
          choiceText: choice.text.substring(0, 40),
        });
      }

      // Non-blocking: sets variable but no cross-chat message (# targetChat:) follows
      if (isChecked && !hasAlert && value === 'true') {
        patterns.nonBlocking.push({
          variable,
          location: `${choice.knot}.${choice.stitch || 'root'}`,
          choiceText: choice.text.substring(0, 40),
        });
      }

      // Gating: variable is checked elsewhere
      if (isChecked && hasAlert) {
        patterns.gating.push({
          variable,
          location: `${choice.knot}.${choice.stitch || 'root'}`,
          choiceText: choice.text.substring(0, 40),
        });
      }
    }
  }

  return patterns;
}

/**
 * Generate preamble text based on detected patterns
 */
function generateTranscriptPreamble(patterns) {
  const lines = [];

  lines.push('## Design Context\n');
  lines.push(
    '*This section explains narrative design patterns detected in this story.*',
  );
  lines.push('*For the full taxonomy, see docs/NARRATIVE-DESIGN.md*\n');

  // Only include sections for patterns actually detected
  const hasCosmetic = patterns.cosmetic.length > 0;
  const hasNonBlocking = patterns.nonBlocking.length > 0;
  const hasDelayed = patterns.delayedConsequence.length > 0;
  const hasGating = patterns.gating.length > 0;

  if (hasCosmetic) {
    lines.push('### Cosmetic Choices');
    lines.push('');
    lines.push(
      "Choices that affect dialogue flavor but don't change story outcomes.",
    );
    lines.push(
      `This story has **${patterns.cosmetic.length}** cosmetic choices.`,
    );
    lines.push('');
  }

  if (hasNonBlocking) {
    lines.push('### Non-Blocking Consequential Choices');
    lines.push('');
    lines.push(
      "**Key design pattern:** Choices that set state but don't force the player to act on it.",
    );
    lines.push('The player must remember to follow through themselves.');
    lines.push('');
    lines.push(
      "This reflects real-world agency: noting something down doesn't guarantee action.",
    );
    lines.push(
      'Players who write "contact Maria" in their notes must remember to actually open her chat.',
    );
    lines.push('');
    lines.push('**Detected non-blocking choices:**');
    for (const nb of patterns.nonBlocking) {
      lines.push(`- \`${nb.variable}\` set at ${nb.location}`);
    }
    lines.push('');
  }

  if (hasDelayed) {
    lines.push('### Delayed Consequence Choices');
    lines.push('');
    lines.push(
      'Choices whose effects appear in later conversations, not immediately.',
    );
    lines.push('');
    lines.push('**Cross-chat dependencies detected:**');
    // Deduplicate by variable
    const seen = new Set();
    for (const dc of patterns.delayedConsequence) {
      if (!seen.has(dc.variable)) {
        seen.add(dc.variable);
        lines.push(
          `- \`${dc.variable}\` set in **${dc.setIn}**, affects **${dc.checkedIn.join(', ')}**`,
        );
      }
    }
    lines.push('');
  }

  if (hasGating) {
    lines.push('### Gating Choices');
    lines.push('');
    lines.push(
      'Choices that unlock or block access to content, with notifications.',
    );
    lines.push('');
    lines.push('**Detected gating choices:**');
    // Deduplicate by variable
    const seen = new Set();
    for (const g of patterns.gating) {
      const key = `${g.variable}:${g.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(`- \`${g.variable}\` at ${g.location}`);
      }
    }
    lines.push('');
  }

  // Characters section (always included for context)
  lines.push('### Characters\n');
  lines.push(
    "- **Pat (Editor)** — Player's boss at the Capital Chronicle. Pragmatic, deadline-focused.",
  );
  lines.push(
    '- **Maria Santos** — Environmental activist. Optional source who rewards players who seek her out.',
  );
  lines.push(
    '- **Spectre** — Unknown contact who appears post-publication. Claims player missed the real story.',
  );
  lines.push(
    '- **Player** — Journalist navigating speed vs. depth, access vs. independence.',
  );
  lines.push('');

  return lines.join('\n');
}

// ============ Playthrough Script ============

/**
 * Define the golden path - specific choices to make at each decision point
 */
const GOLDEN_PATH_CHOICES = {
  'pat_chat.ask_angle': 0,
  'notes_chat.research_phase': 1, // Reach out to Maria Santos
  'activist_chat.can_ask': 0,
  'activist_chat.can_ask.1': 0,
  'pat_chat.waiting_for_draft': 0,
  'spectre_chat.first_contact': 0,
  'spectre_chat.first_contact.1': 0,
  'activist_chat.post_publication': 0,
};

/**
 * Alternate paths for divergence analysis
 */
const ALTERNATE_PATHS = {
  no_maria: {
    'notes_chat.research_phase': 0, // Ministry only
  },
  decline_pat_first: {
    'pat_chat.ask_angle': 1, // Give me a day
  },
};

// ============ Story Runner ============

class GuidedAgent {
  constructor(storyJson) {
    this.storyJson = storyJson;
    this.visitedStates = new Set();
    this.visitedKnots = new Set();
    this.stateVisitCounts = {};
    this.choicesMade = [];
    this.variableSnapshots = [];
    this.errors = [];
  }

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
        } catch (_e) {}
      },
    });
    bindExternalFunctions(story, fns);

    return story;
  }

  recordVisit(knot, stitch) {
    const state = stitch ? `${knot}.${stitch}` : knot;
    this.visitedStates.add(state);
    this.visitedKnots.add(knot);
    this.stateVisitCounts[state] = (this.stateVisitCounts[state] || 0) + 1;
  }

  getCurrentState(story) {
    try {
      const pathStr = story.state.currentPathString;
      if (pathStr) {
        const parts = pathStr.split('.');
        return {
          knot: parts[0],
          stitch:
            parts.length >= 2 && !/^\d+$/.test(parts[1]) ? parts[1] : null,
        };
      }
    } catch (e) {}
    return { knot: null, stitch: null };
  }

  getChoiceKey(knot, stitch, depth = 0) {
    const base = stitch ? `${knot}.${stitch}` : knot;
    return depth > 0 ? `${base}.${depth}` : base;
  }

  captureVariables(story, label) {
    const vars = {};
    const trackVars = [
      'player_agreed',
      'draft_sent',
      'article_published',
      'research_started',
      'research_complete',
      'can_request_activist_comment',
      'activist_comment_requested',
      'spectre_contacted',
      'agreed_to_meet',
    ];

    for (const v of trackVars) {
      try {
        vars[v] = story.variablesState[v];
      } catch (e) {}
    }

    this.variableSnapshots.push({ label, vars });
    return vars;
  }

  selectChoiceWithContext(story, knot, stitch, choiceDepth, overrides = {}) {
    const choices = story.currentChoices;
    if (choices.length === 0) return -1;

    const key = this.getChoiceKey(knot, stitch, choiceDepth);
    const prescribed = overrides[key] ?? GOLDEN_PATH_CHOICES[key];

    let choiceIndex = 0;

    if (prescribed !== undefined) {
      if (typeof prescribed === 'number') {
        choiceIndex = Math.min(prescribed, choices.length - 1);
      } else if (typeof prescribed === 'string') {
        const found = choices.findIndex((c) =>
          c.text.toLowerCase().includes(prescribed.toLowerCase()),
        );
        if (found >= 0) choiceIndex = found;
      }
    }

    this.choicesMade.push({
      knot,
      stitch,
      key,
      choice: choices[choiceIndex].text.substring(0, 50),
      index: choiceIndex,
      totalOptions: choices.length,
    });

    return choiceIndex;
  }

  parseTagsToMeta(tags) {
    const meta = {};
    for (const tag of tags) {
      const [key, ...valueParts] = tag.split(':');
      const value = valueParts.join(':').trim();
      if (key && value) {
        meta[key.trim()] = value;
      } else if (key && !value) {
        meta[key.trim()] = true;
      }
    }
    return meta;
  }

  runChat(story, chatKnot, maxSteps = 100, choiceOverrides = {}) {
    let steps = 0;
    let choiceDepth = 0;
    let lastKnot = chatKnot;
    let lastStitch = null;
    const textCollected = [];
    const transcriptEntries = [];
    let currentSpeaker = null;
    let currentTime = null;
    let currentType = null;

    try {
      const chatId = chatKnot.replace('_chat', '');
      story.variablesState['current_chat'] = chatId;
      story.ChoosePathString(chatKnot);
      this.recordVisit(chatKnot, null);

      // Record chat entry in transcript
      transcriptEntries.push({
        type: 'chat_start',
        chatId,
        chatKnot,
      });

      while (steps < maxSteps) {
        while (story.canContinue && steps < maxSteps) {
          const text = story.Continue().trim();
          const tags = story.currentTags || [];
          const meta = this.parseTagsToMeta(tags);

          // Update current speaker/time/type from tags
          if (meta.speaker) currentSpeaker = meta.speaker;
          if (meta.time) currentTime = meta.time;
          if (meta.type) currentType = meta.type;

          if (text) {
            textCollected.push(text);
            transcriptEntries.push({
              type: 'message',
              speaker: currentSpeaker,
              time: currentTime,
              msgType: currentType,
              text,
              attachment: meta.attachment,
              image: meta.image,
              audio: meta.audio,
              duration: meta.duration,
            });
          }

          const { knot, stitch } = this.getCurrentState(story);
          if (knot) {
            lastKnot = knot;
            lastStitch = stitch;
            if (stitch) {
              this.recordVisit(knot, stitch);
            }
          }
          steps++;
        }

        if (story.currentChoices.length > 0) {
          const choices = story.currentChoices.map((c) => c.text);
          const choiceIndex = this.selectChoiceWithContext(
            story,
            lastKnot,
            lastStitch,
            choiceDepth,
            choiceOverrides,
          );

          // Record choice in transcript
          transcriptEntries.push({
            type: 'choice',
            location: `${lastKnot}.${lastStitch || 'root'}`,
            options: choices,
            selected: choiceIndex,
            selectedText: choices[choiceIndex],
          });

          story.ChooseChoiceIndex(choiceIndex);
          choiceDepth++;
          steps++;
        } else {
          break;
        }
      }
    } catch (error) {
      this.errors.push({ chat: chatKnot, error: error.message });
    }

    return { steps, textCollected, transcriptEntries };
  }

  runGuidedPlaythrough(choiceOverrides = {}) {
    const story = this.createStory();

    const chatOrder = [
      'news_chat',
      'pat_chat',
      'notes_chat',
      'activist_chat',
      'notes_chat',
      'pat_chat',
      'pat_chat',
      'spectre_chat',
      'activist_chat',
    ];

    const allText = [];
    const allTranscript = [];

    for (const chat of chatOrder) {
      this.captureVariables(story, `before_${chat}`);
      const result = this.runChat(story, chat, 100, choiceOverrides);
      allText.push(...result.textCollected);
      allTranscript.push(...result.transcriptEntries);
    }

    this.captureVariables(story, 'final');

    return {
      summary: {
        totalStatesVisited: this.visitedStates.size,
        totalKnotsVisited: this.visitedKnots.size,
        choicesMade: this.choicesMade.length,
        errors: this.errors.length,
      },
      visitedStates: [...this.visitedStates].sort(),
      visitedKnots: [...this.visitedKnots].sort(),
      stateVisitCounts: this.stateVisitCounts,
      choicesMade: this.choicesMade,
      variableSnapshots: this.variableSnapshots,
      textCollected: allText,
      transcript: allTranscript,
      errors: this.errors,
    };
  }
}

// ============ Divergence Analysis ============

function runDivergenceAnalysis(storyJson) {
  const results = {};

  // Run golden path
  const goldenAgent = new GuidedAgent(storyJson);
  results.golden = goldenAgent.runGuidedPlaythrough();

  // Run alternate paths
  for (const [pathName, overrides] of Object.entries(ALTERNATE_PATHS)) {
    const agent = new GuidedAgent(storyJson);
    results[pathName] = agent.runGuidedPlaythrough(overrides);
  }

  // Calculate divergence
  const divergence = {
    paths: Object.keys(results),
    textDiff: {},
    stateDiff: {},
    variableDiff: {},
  };

  const goldenText = new Set(results.golden.textCollected);
  const goldenStates = new Set(results.golden.visitedStates);

  for (const [pathName, result] of Object.entries(results)) {
    if (pathName === 'golden') continue;

    const pathText = new Set(result.textCollected);
    const pathStates = new Set(result.visitedStates);

    // Text unique to this path
    const uniqueToPath = [...pathText].filter((t) => !goldenText.has(t));
    const uniqueToGolden = [...goldenText].filter((t) => !pathText.has(t));

    divergence.textDiff[pathName] = {
      uniqueLines: uniqueToPath.length,
      missingLines: uniqueToGolden.length,
      totalPath: pathText.size,
      totalGolden: goldenText.size,
      divergencePercent: Math.round(
        ((uniqueToPath.length + uniqueToGolden.length) /
          (pathText.size + goldenText.size)) *
          100,
      ),
    };

    // States unique to this path
    const statesOnlyPath = [...pathStates].filter((s) => !goldenStates.has(s));
    const statesOnlyGolden = [...goldenStates].filter(
      (s) => !pathStates.has(s),
    );

    divergence.stateDiff[pathName] = {
      uniqueToPath: statesOnlyPath,
      uniqueToGolden: statesOnlyGolden,
    };

    // Variable differences
    const pathFinal = result.variableSnapshots.find((s) => s.label === 'final');
    const goldenFinal = results.golden.variableSnapshots.find(
      (s) => s.label === 'final',
    );

    if (pathFinal && goldenFinal) {
      const diffs = {};
      for (const [key, val] of Object.entries(goldenFinal.vars)) {
        if (pathFinal.vars[key] !== val) {
          diffs[key] = { golden: val, [pathName]: pathFinal.vars[key] };
        }
      }
      divergence.variableDiff[pathName] = diffs;
    }
  }

  return { results, divergence };
}

// ============ Comparison with Random Agent ============

const RANDOM_PLAYTHROUGHS = 100; // Fewer than heatmap since we just need comparison data

/**
 * Run random playthroughs to collect coverage data for comparison
 */
function runRandomCoverage(storyJson, inkStructure) {
  const visitCounts = {};
  const entryKnots = ['news_chat', 'pat_chat', 'notes_chat', 'spectre_chat', 'activist_chat'];

  for (let i = 0; i < RANDOM_PLAYTHROUGHS; i++) {
    const story = new Story(storyJson);

    const fns = createExternalFunctions({
      getName: (id) => id,
      requestData: () => {
        try {
          story.variablesState['data_found'] = true;
          story.variablesState['ministry_claimed_revenue'] = '$50M';
          story.variablesState['data_median_revenue'] = '$12M';
          story.variablesState['data_sample_size'] = '15';
        } catch (_e) {}
      },
    });
    bindExternalFunctions(story, fns);

    // Shuffle entry knots
    const chatOrder = [...entryKnots].sort(() => Math.random() - 0.5);

    for (const knotName of chatOrder) {
      try {
        story.variablesState['current_chat'] = knotName.replace('_chat', '');
        story.ChoosePathString(knotName);

        let steps = 0;
        while (steps < 50) {
          while (story.canContinue && steps < 50) {
            story.Continue();
            steps++;
          }
          if (story.currentChoices.length > 0) {
            const idx = Math.floor(Math.random() * story.currentChoices.length);
            story.ChooseChoiceIndex(idx);
            steps++;
          } else {
            break;
          }
        }
      } catch (_e) {}
    }

    // Collect visit counts using ink's built-in tracking
    for (const [knotName, knotInfo] of Object.entries(inkStructure)) {
      for (const stitchName of knotInfo.stitches) {
        try {
          const path = `${knotName}.${stitchName}`;
          const visits = story.state.VisitCountAtPathString(path);
          if (visits > 0) {
            visitCounts[path] = (visitCounts[path] || 0) + visits;
          }
        } catch (_e) {}
      }
    }
  }

  return visitCounts;
}

function compareResults(guidedReport, randomCounts) {
  if (!randomCounts) {
    return {
      comparison:
        'Random agent data not available. Run "mise run test:coverage" first.',
    };
  }

  const guidedOnly = [];
  const bothReached = [];

  for (const state of guidedReport.visitedStates) {
    if (randomCounts[state] === 0 || randomCounts[state] === undefined) {
      guidedOnly.push(state);
    } else {
      bothReached.push(state);
    }
  }

  return {
    guidedOnlyStates: guidedOnly,
    bothReached: bothReached.length,
    guidedTotal: guidedReport.visitedStates.length,
    interpretation:
      guidedOnly.length > 0
        ? `${guidedOnly.length} states require guided progression`
        : 'All states reachable by random exploration',
  };
}

// ============ Transcript Generation ============

const CHAT_TITLES = {
  news: 'Gov News Wire',
  pat: 'Pat (Editor)',
  notes: 'My Notes',
  activist: 'Maria Santos',
  spectre: 'Unknown Number',
};

/**
 * Format a single transcript entry as markdown
 */
function formatTranscriptEntry(entry) {
  if (entry.type === 'chat_start') {
    const title = CHAT_TITLES[entry.chatId] || entry.chatId;
    return `\n## ${title}\n`;
  }

  if (entry.type === 'message') {
    const lines = [];
    const speaker =
      entry.msgType === 'sent' ? '**You**' : `**${entry.speaker || 'System'}**`;
    const time = entry.time ? ` *(${entry.time})*` : '';

    // Handle different message types
    if (entry.audio) {
      lines.push(
        `${speaker}${time}: 🎤 *[Voice memo: ${entry.duration || 'audio'}]*`,
      );
      lines.push(`> ${entry.text}`);
    } else if (entry.image) {
      lines.push(`${speaker}${time}: 📷 *[Image: ${entry.image}]*`);
      if (entry.text) lines.push(`> ${entry.text}`);
    } else if (entry.attachment) {
      lines.push(`${speaker}${time}: 📎 *[Attachment: ${entry.attachment}]*`);
      if (entry.text) lines.push(`> ${entry.text}`);
    } else if (entry.msgType === 'system') {
      lines.push(`*${entry.text}*`);
    } else {
      lines.push(`${speaker}${time}: ${entry.text}`);
    }

    return lines.join('\n');
  }

  if (entry.type === 'choice') {
    const lines = ['\n> **CHOICE POINT** `' + entry.location + '`'];
    entry.options.forEach((opt, i) => {
      const marker = i === entry.selected ? '→' : ' ';
      lines.push(`> ${marker} ${i + 1}. ${opt}`);
    });
    lines.push('');
    return lines.join('\n');
  }

  return '';
}

/**
 * Generate markdown transcript for a single path
 */
function generateTranscript(pathName, report, preamble = '') {
  const lines = [];

  // Header
  lines.push(`# Story Transcript: ${pathName}`);
  lines.push('');
  lines.push(`*Generated by guided-agent.js*`);
  lines.push('');

  // Include preamble if provided
  if (preamble) {
    lines.push(preamble);
  }

  lines.push('---');

  // Format each entry
  let lastChatId = null;
  for (const entry of report.transcript) {
    // Skip duplicate chat headers when revisiting
    if (entry.type === 'chat_start') {
      if (entry.chatId === lastChatId) continue;
      lastChatId = entry.chatId;
    }

    const formatted = formatTranscriptEntry(entry);
    if (formatted) {
      lines.push(formatted);
    }
  }

  // Footer with stats
  lines.push('\n---\n');
  lines.push('## Summary\n');
  lines.push(`- States visited: ${report.summary.totalStatesVisited}`);
  lines.push(`- Choices made: ${report.summary.choicesMade}`);
  if (report.errors.length > 0) {
    lines.push(`- Errors: ${report.errors.length}`);
  }

  return lines.join('\n');
}

/**
 * Generate combined transcript with all paths
 */
function generateCombinedTranscript(pathResults, preamble = '') {
  const lines = [];

  lines.push('# Story Transcripts');
  lines.push('');
  lines.push('*Linear screenplay format for narrative coherence review.*');
  lines.push('');
  lines.push('Use this document to:');
  lines.push('- Review dialogue flow without playing the game');
  lines.push('- Check character responses match prior context');
  lines.push('- Feed to LLM for automated coherence analysis');
  lines.push('');

  // Include preamble with design context
  if (preamble) {
    lines.push(preamble);
  }

  lines.push('---');

  for (const [pathName, report] of Object.entries(pathResults)) {
    lines.push('');
    lines.push(`# Path: ${pathName}`);
    lines.push('');

    // Describe the path
    if (pathName === 'golden') {
      lines.push('*The intended progression: contact Maria, get her comment.*');
    } else if (pathName === 'no_maria') {
      lines.push('*Player skips contacting Maria Santos.*');
    } else if (pathName === 'decline_pat_first') {
      lines.push('*Player initially hesitates on the assignment.*');
    }
    lines.push('');
    lines.push('---');

    // Format each entry
    let lastChatId = null;
    for (const entry of report.transcript) {
      if (entry.type === 'chat_start') {
        if (entry.chatId === lastChatId) continue;
        lastChatId = entry.chatId;
      }

      const formatted = formatTranscriptEntry(entry);
      if (formatted) {
        lines.push(formatted);
      }
    }

    lines.push('\n---\n');
  }

  return lines.join('\n');
}

/**
 * Write transcripts to files
 */
function writeTranscripts(pathResults, split = false, preamble = '') {
  if (split) {
    // Create directory if needed
    if (!existsSync(CONFIG.transcriptDir)) {
      mkdirSync(CONFIG.transcriptDir, { recursive: true });
    }

    // Write individual files
    for (const [pathName, report] of Object.entries(pathResults)) {
      const content = generateTranscript(pathName, report, preamble);
      const filePath = join(CONFIG.transcriptDir, `${pathName}.md`);
      writeFileSync(filePath, content);
      console.log(`  Wrote: ${filePath}`);
    }
  } else {
    // Write combined file
    const content = generateCombinedTranscript(pathResults, preamble);
    writeFileSync(CONFIG.transcriptPath, content);
    console.log(`  Wrote: ${CONFIG.transcriptPath}`);
  }
}

// ============ Main Output ============

function printChoiceConsequenceAnalysis(inkAnalysis) {
  console.log('\n' + '='.repeat(60));
  console.log('CHOICE CONSEQUENCE ANALYSIS');
  console.log('='.repeat(60) + '\n');

  const consequential = inkAnalysis.choices.filter((c) => !c.isCosmetic);
  const cosmetic = inkAnalysis.choices.filter((c) => c.isCosmetic);

  console.log(`Total choices found: ${inkAnalysis.choices.length}`);
  console.log(
    `  With consequences: ${consequential.length} (affect story variables)`,
  );
  console.log(`  Cosmetic only: ${cosmetic.length} (dialogue flavor)\n`);

  if (consequential.length > 0) {
    console.log('Choices That Affect Story State:');
    for (const choice of consequential) {
      const loc = `${choice.knot}.${choice.stitch || 'root'}`;
      const vars = choice.variablesSet
        .map((v) => `${v.variable}=${v.value}`)
        .join(', ');
      console.log(`  [${loc}] "${choice.text.substring(0, 35)}..."`);
      console.log(`    → Sets: ${vars}`);
    }
    console.log('');
  }

  if (cosmetic.length > 0) {
    console.log('Cosmetic Choices (no variable changes):');
    for (const choice of cosmetic.slice(0, 5)) {
      const loc = `${choice.knot}.${choice.stitch || 'root'}`;
      console.log(`  [${loc}] "${choice.text.substring(0, 45)}..."`);
    }
    if (cosmetic.length > 5) {
      console.log(`  ... and ${cosmetic.length - 5} more`);
    }
  }
}

function printDependencyGraph(depGraph, inkAnalysis) {
  console.log('\n' + '='.repeat(60));
  console.log('DEPENDENCY GRAPH (What Unlocks What)');
  console.log('='.repeat(60) + '\n');

  // Find key progression variables
  const keyVars = [
    'player_agreed',
    'research_complete',
    'draft_sent',
    'article_published',
    'can_request_activist_comment',
  ];

  console.log('Key Story Progression:');
  for (const varName of keyVars) {
    const node = depGraph.nodes.get(varName);
    if (node && (node.setBy.length > 0 || node.requiredBy.length > 0)) {
      console.log(`\n  ${varName}:`);
      if (node.setBy.length > 0) {
        console.log(`    Set by:`);
        for (const setter of node.setBy) {
          console.log(`      - ${setter.location}`);
        }
      }
      if (node.requiredBy.length > 0) {
        console.log(`    Unlocks:`);
        for (const req of node.requiredBy.filter((r) => !r.isNegated)) {
          console.log(`      - ${req.location}`);
        }
      }
    }
  }

  // Print chain summary
  console.log('\n\nProgression Chain:');
  console.log('  news (seen_announcement)');
  console.log('    └→ pat.ask_angle (player_agreed)');
  console.log('         └→ notes.research_phase (research_complete)');
  console.log(
    '              ├→ [optional] activist.can_ask (can_request_activist_comment)',
  );
  console.log('              └→ pat.waiting_for_draft (draft_sent)');
  console.log('                   └→ pat.publishing (article_published)');
  console.log('                        ├→ spectre.first_contact');
  console.log('                        └→ activist.post_publication');
}

function printDivergenceAnalysis(divergence) {
  console.log('\n' + '='.repeat(60));
  console.log('BRANCH DIVERGENCE ANALYSIS');
  console.log('='.repeat(60) + '\n');

  console.log(`Paths analyzed: ${divergence.paths.join(', ')}\n`);

  for (const [pathName, diff] of Object.entries(divergence.textDiff)) {
    console.log(`Path "${pathName}" vs golden path:`);
    console.log(`  Content divergence: ${diff.divergencePercent}%`);
    console.log(`  Unique dialogue lines: ${diff.uniqueLines}`);
    console.log(`  Missing from golden: ${diff.missingLines}`);

    const stateDiff = divergence.stateDiff[pathName];
    if (stateDiff) {
      if (stateDiff.uniqueToPath.length > 0) {
        console.log(
          `  States only in this path: ${stateDiff.uniqueToPath.join(', ')}`,
        );
      }
      if (stateDiff.uniqueToGolden.length > 0) {
        console.log(`  States missed: ${stateDiff.uniqueToGolden.join(', ')}`);
      }
    }

    const varDiff = divergence.variableDiff[pathName];
    if (varDiff && Object.keys(varDiff).length > 0) {
      console.log('  Variable differences:');
      for (const [varName, vals] of Object.entries(varDiff)) {
        console.log(
          `    ${varName}: golden=${vals.golden}, ${pathName}=${vals[pathName]}`,
        );
      }
    }
    console.log('');
  }
}

function printOrphanAnalysis(orphans) {
  console.log('\n' + '='.repeat(60));
  console.log('DEAD-END / ORPHAN DETECTION');
  console.log('='.repeat(60) + '\n');

  if (orphans.length === 0) {
    console.log('No orphaned content detected. All stitches are reachable.');
  } else {
    console.log(`Found ${orphans.length} potentially orphaned stitch(es):\n`);
    for (const orphan of orphans) {
      console.log(`  ${orphan.location} (${orphan.file}:${orphan.line})`);
      console.log(`    Reason: ${orphan.reason}`);
    }
    console.log('\nNote: Some may be intentionally gated by conditions.');
  }
}

function printInterpretation(report, comparison, divergence, inkAnalysis) {
  console.log('\n' + '='.repeat(60));
  console.log('INTERPRETATION FOR WRITERS');
  console.log('='.repeat(60) + '\n');

  const totalStates = report.visitedStates.length;
  const randomReachable = comparison.bothReached || 0;
  const guidedOnly = comparison.guidedOnlyStates?.length || 0;

  const freelyExplorable = Math.round((randomReachable / totalStates) * 100);
  const progressionGated = Math.round((guidedOnly / totalStates) * 100);

  console.log('Story Health Summary:');
  console.log(`  Total states verified: ${totalStates}`);
  console.log(`  Freely explorable: ${randomReachable} (${freelyExplorable}%)`);
  console.log(`  Progression-gated: ${guidedOnly} (${progressionGated}%)`);
  console.log('');

  // Choice impact summary
  const consequential = inkAnalysis.choices.filter((c) => !c.isCosmetic).length;
  const cosmetic = inkAnalysis.choices.filter((c) => c.isCosmetic).length;

  console.log('Choice Impact:');
  console.log(
    `  ${consequential} choices with consequences (affect variables)`,
  );
  console.log(`  ${cosmetic} cosmetic choices (dialogue only)`);
  console.log('');

  // Divergence summary
  if (divergence) {
    const avgDivergence =
      Object.values(divergence.textDiff).reduce(
        (sum, d) => sum + d.divergencePercent,
        0,
      ) / Object.keys(divergence.textDiff).length;

    console.log('Branch Impact:');
    console.log(`  Average content divergence: ${Math.round(avgDivergence)}%`);
    if (avgDivergence < 10) {
      console.log('  → Story is mostly linear with minor variations');
    } else if (avgDivergence < 30) {
      console.log('  → Moderate branching with meaningful alternate content');
    } else {
      console.log('  → High divergence - significantly different paths exist');
    }
    console.log('');
  }

  // Critical path
  console.log('Critical Path:');
  console.log('  1. news_chat → Read announcement');
  console.log('  2. pat_chat → Agree to article');
  console.log('  3. notes_chat → Research (optional: contact Maria)');
  console.log('  4. pat_chat → Submit draft');
  console.log('  5. [auto] Article publishes');
  console.log('  6. spectre_chat + activist_chat → Post-publication responses');
  console.log('');

  // Verification
  console.log('Verification Result:');
  if (report.errors.length === 0) {
    console.log('  ✓ All states reachable via intended progression');
  } else {
    console.log('  ✗ Errors found:');
    for (const err of report.errors) {
      console.log(`    ${err.chat}: ${err.error}`);
    }
  }
}

// ============ Main ============

async function main() {
  const startTime = Date.now();
  console.log(
    `=== Guided Agent - Story Path Verification (locale: ${locale}) ===\n`,
  );

  // Load story
  if (ARGS.verbose) console.log(`Loading story from: ${CONFIG.storyPath}`);
  let storyJson;
  try {
    const storyContent = readFileSync(CONFIG.storyPath, 'utf-8');
    storyJson = JSON.parse(storyContent);
  } catch (error) {
    console.error(`Failed to load story: ${error.message}`);
    console.error('Run "mise run build" first.');
    process.exit(1);
  }

  // Analyze ink source
  console.log('Analyzing ink source...');
  if (ARGS.verbose) console.log(`  Ink directory: ${CONFIG.inkDir}`);
  const inkAnalysis = analyzeInkSource(CONFIG.inkDir);
  console.log(
    `  Found: ${Object.keys(inkAnalysis.knots).length} knots, ${Object.keys(inkAnalysis.stitches).length} stitches`,
  );
  console.log(
    `  Choices: ${inkAnalysis.choices.length}, Variables: ${inkAnalysis.variables.size}`,
  );

  // Build dependency graph
  if (ARGS.verbose) console.log('\nBuilding dependency graph...');
  const depGraph = buildDependencyGraph(inkAnalysis);
  if (ARGS.verbose) {
    console.log(`  Nodes: ${depGraph.nodes.size}`);
    console.log(`  Edges: ${depGraph.edges.length}`);
  }

  // Find orphaned content
  if (ARGS.verbose) console.log('\nSearching for orphaned content...');
  const orphans = findOrphanedContent(inkAnalysis);
  if (ARGS.verbose) console.log(`  Found: ${orphans.length} potential orphans`);

  // Run guided playthrough
  console.log('\nRunning guided playthrough...\n');
  const agent = new GuidedAgent(storyJson);
  const report = agent.runGuidedPlaythrough();

  // Print basic results
  console.log('=== Results ===\n');
  console.log(`States visited: ${report.summary.totalStatesVisited}`);
  console.log(`Knots visited: ${report.summary.totalKnotsVisited}`);
  console.log(`Choices made: ${report.summary.choicesMade}`);
  if (ARGS.verbose && report.errors.length > 0) {
    console.log(`Errors encountered: ${report.errors.length}`);
  }

  // Run divergence analysis
  console.log('\nRunning divergence analysis...');
  if (ARGS.verbose) {
    console.log(
      `  Alternate paths: ${Object.keys(ALTERNATE_PATHS).join(', ')}`,
    );
  }
  const { results: pathResults, divergence } = runDivergenceAnalysis(storyJson);

  // Compare with random agent
  console.log('\n=== Comparison with Random Agent ===\n');
  console.log(`Running ${RANDOM_PLAYTHROUGHS} random playthroughs for comparison...`);
  // Convert inkAnalysis format to structure format for runRandomCoverage
  const inkStructure = {};
  for (const [knotName, knotInfo] of Object.entries(inkAnalysis.knots)) {
    inkStructure[knotName] = { stitches: new Set(knotInfo.stitches), file: knotInfo.file };
  }
  const randomCounts = runRandomCoverage(storyJson, inkStructure);
  const comparison = compareResults(report, randomCounts);

  if (comparison.comparison) {
    console.log(comparison.comparison);
  } else {
    console.log(`States reached by both: ${comparison.bothReached}`);
    console.log(
      `States only reached by guided: ${comparison.guidedOnlyStates.length}`,
    );
    console.log(comparison.interpretation);
    if (ARGS.verbose && comparison.guidedOnlyStates.length > 0) {
      console.log('  Guided-only states:');
      for (const state of comparison.guidedOnlyStates) {
        console.log(`    - ${state}`);
      }
    }
  }

  // Print enhanced analysis sections
  printChoiceConsequenceAnalysis(inkAnalysis);
  printDependencyGraph(depGraph, inkAnalysis);
  printDivergenceAnalysis(divergence);
  printOrphanAnalysis(orphans);
  printInterpretation(report, comparison, divergence, inkAnalysis);

  // Generate transcripts with design context
  if (!ARGS.noTranscript) {
    console.log('\n=== Generating Transcripts ===\n');

    // Detect design patterns and generate preamble
    const patterns = detectDesignPatterns(inkAnalysis, depGraph);
    const preamble = generateTranscriptPreamble(patterns);

    console.log(`  Detected patterns:`);
    console.log(`    - Cosmetic choices: ${patterns.cosmetic.length}`);
    console.log(
      `    - Non-blocking consequential: ${patterns.nonBlocking.length}`,
    );
    console.log(
      `    - Delayed consequence: ${patterns.delayedConsequence.length}`,
    );
    console.log(`    - Gating choices: ${patterns.gating.length}`);
    console.log('');

    writeTranscripts(pathResults, ARGS.split, preamble);
  } else if (ARGS.verbose) {
    console.log('\n(Transcript generation skipped via --no-transcript)');
  }

  const elapsed = Date.now() - startTime;
  console.log(`\nFinished in ${elapsed}ms`);
}

main().catch(console.error);

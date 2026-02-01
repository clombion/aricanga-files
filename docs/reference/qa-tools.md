# QA Tools for Writers

This guide explains how to use the QA testing tools to verify your story works correctly. No programming knowledge required.

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `mise run test:coverage` | Random exploration report |
| `mise run test:guided` | Guided path verification + transcript |
| `mise run test:guided --split` | Separate transcript per path |
| `mise run ink:graph:svg` | Story structure diagram |
| `mise run ink:heatmap:svg` | Coverage visualization |
| `mise run ink:deps` | Cross-chat dependency analysis |
| `mise run lint:dead-code` | Find unreachable content |
| `mise run lint:tags:compiled` | Validate compiled story tags |

All outputs go to the `docs/` folder.

---

## Random Agent Coverage (`mise run test:coverage`)

### What It Does

Runs 500 playthroughs of your story, making random choices at each decision point. Reports how many times each state was visited.

### Sample Output

```
=== Coverage Summary ===

Most visited:
  1714 - pat_chat.ask_angle
   552 - notes_chat.continue_research
   324 - notes_chat.research_phase
    56 - activist_chat.can_ask

Unreached (gray in heatmap):
  pat_chat.waiting (pat.ink)
  pat_chat.waiting_for_draft (pat.ink)
  spectre_chat.silent (spectre.ink)
```

### How to Interpret

| Visit Count | What It Means |
|-------------|---------------|
| **High (1000+)** | Early state visited every playthrough |
| **Medium (100-999)** | Sometimes reached depending on random path |
| **Low (1-99)** | Requires specific choices to reach |
| **Zero (0)** | Either gated (intentional) or broken (bug) |

### Why Zero Visits Isn't Always Bad

The random agent can't follow your intended story progression. States that require:

- **Completing a sequence** (e.g., finishing all research before draft)
- **Making specific choices** (e.g., choosing to contact Maria)
- **Cross-chat progression** (e.g., publishing article unlocks TonyGov)

...will show 0 visits because random clicking can't stumble into the right order.

### When to Worry

- A state you expect players to reach easily shows 0 visits
- An early-game state (before any choices) shows 0 visits
- The random agent used to reach a state but now can't

---

## Guided Agent (`mise run test:guided`)

### What It Does

Follows the **intended story path** to verify that all states are reachable when played correctly. Unlike the random agent, it makes specific choices at decision points.

The enhanced guided agent provides **four analysis sections**:

1. **Choice Consequence Analysis** - Which choices affect story variables vs cosmetic-only
2. **Dependency Graph** - What unlocks what (progression chain)
3. **Branch Divergence** - How much content differs between paths
4. **Dead-End Detection** - Orphaned content with no incoming connections

### Sample Output

```
============================================================
CHOICE CONSEQUENCE ANALYSIS
============================================================

Total choices found: 17
  With consequences: 6 (affect story variables)
  Cosmetic only: 11 (dialogue flavor)

Choices That Affect Story State:
  [notes_chat.research_phase] " [Also reach out to Maria Santos]..."
    → Sets: can_request_activist_comment=true
  [pat_chat.ask_angle] " [Quick write-up from the release. ..."
    → Sets: player_agreed=true

============================================================
DEPENDENCY GRAPH (What Unlocks What)
============================================================

Progression Chain:
  news (seen_announcement)
    └→ pat.ask_angle (player_agreed)
         └→ notes.research_phase (research_complete)
              ├→ [optional] activist.can_ask (can_request_activist_comment)
              └→ pat.waiting_for_draft (draft_sent)
                   └→ pat.publishing (article_published)
                        ├→ spectre.first_contact
                        └→ activist.post_publication

============================================================
BRANCH DIVERGENCE ANALYSIS
============================================================

Path "no_maria" vs golden path:
  Content divergence: 30%
  Unique dialogue lines: 5
  States missed: activist_chat.can_ask, activist_chat.post_publication
  Variable differences:
    can_request_activist_comment: golden=true, no_maria=false

============================================================
INTERPRETATION FOR WRITERS
============================================================

Story Health Summary:
  Total states verified: 14
  Freely explorable: 4 (29%)
  Progression-gated: 10 (71%)

Choice Impact:
  6 choices with consequences (affect variables)
  11 cosmetic choices (dialogue only)

Branch Impact:
  Average content divergence: 19%
  → Moderate branching with meaningful alternate content

Verification Result:
  ✓ All states reachable via intended progression
```

### Understanding the Analysis Sections

#### Choice Consequence Analysis

| Type | What It Means |
|------|---------------|
| **With consequences** | Choice sets a variable (e.g., `player_agreed=true`) |
| **Cosmetic only** | Choice changes dialogue but no variables |

High cosmetic count is fine - it means players have dialogue flavor options that don't gate content.

#### Dependency Graph

Shows the progression chain:
- Which variables are set by which locations
- Which locations require which variables to unlock
- The critical path through your story

#### Branch Divergence

Compares alternate paths against the "golden path" (intended progression):

| Metric | What It Means |
|--------|---------------|
| **Content divergence %** | How different the dialogue is |
| **Unique lines** | Lines only in this alternate path |
| **States missed** | States the alternate path doesn't visit |
| **Variable differences** | Which flags end up different |

| Divergence | Interpretation |
|------------|----------------|
| **<10%** | Mostly linear, minor variations |
| **10-30%** | Moderate branching, meaningful choices |
| **>30%** | High divergence, significantly different paths |

#### Dead-End Detection

Finds orphaned stitches with no incoming diverts. These might be:
- **Intentional** - gated by conditions checked elsewhere
- **Bugs** - content that can't be reached

### When to Use

- **After running random agent** - to verify gray states are intentional
- **After major story changes** - to confirm nothing is broken
- **Before release** - as final verification
- **When adding new branches** - to verify divergence metrics

### What "Progression-Gated" Means

States that require the player to:
1. Visit specific chats in order
2. Make certain choices to unlock content
3. Complete sequences before new options appear

This is normal for narrative games. High progression-gated percentage (>60%) indicates a linear story.

---

## Story Transcripts

### What They Are

The guided agent automatically generates **screenplay-format transcripts** showing all dialogue in linear order. These make it easy to review narrative coherence without playing through the game.

### Output Files

| Mode | Command | Output |
|------|---------|--------|
| Combined | `mise run test:guided` | `docs/story-transcript.md` |
| Split | `mise run test:guided --split` | `docs/transcripts/golden.md`, etc. |

### Sample Transcript

```markdown
## Pat

**Pat** *(9:23 AM)*: Morning. You see the Aricanga release?
**Pat** *(9:23 AM)*: Need something for tonight's edition.

> **CHOICE POINT** `pat_chat.ask_angle`
> → 1. Quick write-up from the release.
>   2. Give me a day. Something feels off.

**You** *(9:23 AM)*: Quick write-up from the release.
```

### Using for Narrative Review

**Manual review:**
- Read through each path linearly
- Check that character responses match prior context
- Verify dialogue makes sense given player choices

**LLM-assisted review:**

Copy the transcript and prompt:

> "Review this transcript for narrative coherence. Flag dialogue where:
> - Characters reference things that didn't happen
> - Player responses don't match prior actions
> - Reactions don't fit the context"

### Available Paths

| Path | Description |
|------|-------------|
| `golden` | Full progression - contact Maria, get comment |
| `no_maria` | Skip contacting Maria Santos |
| `decline_pat_first` | Initially hesitate on assignment |

See `docs/transcripts/README.md` for detailed format documentation.

---

## Dependency Analysis (`mise run ink:deps`)

### What It Does

Shows which variables connect which chats. Helps you understand how choices in one conversation affect others.

### Sample Output

```
Cross-Chat Dependencies:
  news ──(seen_announcement)──► pat
  pat ──(player_agreed)──► notes
  notes ──(can_request_activist_comment)──► activist
  pat ──(article_published)──► spectre
```

### Reading the Output

- **Arrow direction**: `from ──(variable)──► to`
- The `from` chat sets the variable
- The `to` chat reads/requires the variable

### Graph Enhancement

When you run `mise run ink:graph:svg` after `mise run ink:deps`, the graph will include **red dashed lines** showing these cross-chat dependencies.

---

## Story Graph (`mise run ink:graph:svg`)

### What It Does

Generates a diagram showing all states in your story and how they connect.

**Output:** `docs/story-graph.svg` (open in browser or image viewer)

### How to Read the Diagram

| Shape | Meaning |
|-------|---------|
| **Rectangle** (bold) | Knot - entry point for a chat conversation |
| **Oval** | Stitch - a state within that conversation |
| **Arrow** | Divert - possible transition between states |
| **Colored box** | Groups all states from one ink file |

### Example

```
┌─────────────────────────────────┐
│         pat_chat (blue)         │
│  ┌───────────┐                  │
│  │ pat_chat  │──→ waiting       │
│  │  (entry)  │──→ ask_angle     │
│  └───────────┘──→ publishing    │
└─────────────────────────────────┘
```

### Cross-Chat Dependencies

If you run `mise run ink:deps` first, the graph will include **red dashed lines** showing variable dependencies between chats:

| Line Style | Meaning |
|------------|---------|
| **Solid black** | Structural divert (`-> target`) |
| **Dashed red** | Variable dependency (e.g., `seen_announcement`) |

### Limitations

The graph shows structure but not:

- Which choices unlock which content
- The intended play order
- Visit frequency (use heatmap for that)

---

## Coverage Heatmap (`mise run ink:heatmap:svg`)

### What It Does

Colors the story graph based on how often each state was visited during random exploration.

**Output:** `docs/story-heatmap.svg`

### Color Guide

| Color | Meaning | What to Check |
|-------|---------|---------------|
| **Red** | Hot (>50% of max visits) | Early/common state - expected |
| **Yellow** | Warm (10-50%) | Sometimes reached |
| **Green** | Cold (<10%) | Rare but reachable |
| **Gray** | Unreached (0 visits) | Is this intentional? |

### Reading the Numbers

Each state shows its visit count in parentheses:

```
ask_angle (1714)  ← visited 1714 times across 500 runs
waiting (0)       ← never visited (gray)
```

### What Gray States Mean

**Gray is often expected.** In a linear story like Capital Chronicle:

- ~20% of states are freely explorable (random agent can reach)
- ~60% are progression-gated (need to complete sequences)
- ~20% are choice-gated (need specific player decisions)

**Gray is concerning when:**

- The state should be early in progression
- The state has arrows pointing to it but still shows gray
- The state was reachable before your recent changes

---

## Dead Code Detection (`mise run lint:dead-code`)

### What It Does

Static analysis that finds:

1. **Unreachable stitches** - states with no incoming arrows
2. **Unused variables** - set but never read, or read but never set

### Sample Output

```
Dead Code Detection
  ✓ DC-1: All stitches are reachable
  ✗ DC-2: Variable 'research_started' is assigned but never read
  ℹ DC-3: Statistics - 5 knots, 19 stitches, 14 variables
```

### When This Runs

Part of `mise run lint` - runs automatically during pre-commit checks.

---

## Compiled Tag Audit (`mise run lint:tags:compiled`)

### What It Does

Validates tag hygiene using the **compiled story JSON**, not source files. This catches issues that source-based linting misses:

- Conditional tags (only present at runtime)
- Tags in included files
- Tag ordering issues

Uses inkjs `TagsForContentAtPath()` to read tags directly from the compiled story.

### Checks Performed

| Check | What It Catches |
|-------|-----------------|
| Speaker at entry | Chat knots missing initial `#speaker:` tag |
| Orphan time tags | `#time:` without accompanying speaker (message without sender) |
| story_start boundaries | `#story_start` in unexpected locations |
| Delay without context | `#delay:` without speaker/type tags |

### Sample Output

```
=== Compiled Tag Audit (locale: en) ===

Loading compiled story...
Extracting paths from ink source...
  Found 25 paths

Checking tag hygiene...

=== Audit Results ===

Warnings (1):
  notes_chat.orphan_section (notes.ink)
    time: tag without speaker: or type: (orphan time?)
    Tags: time:10:00 AM

Info (1):
  spectre_chat (spectre.ink)
    story_start at knot entry (expected in stitch)

Total issues: 2 (1 warnings, 1 info)
```

### When to Use

- **After major story changes** - verify tag patterns remain consistent
- **Before release** - ensure no orphan tags slipped through
- **When debugging message display** - tags affect how messages render

### Difference from `lint:tags`

| Tool | What It Checks |
|------|----------------|
| `lint:tags` | Source file regex patterns (fast, catches typos) |
| `lint:tags:compiled` | Compiled story tags (catches runtime-only issues) |

Both are useful. `lint:tags` runs faster and catches obvious syntax issues. `lint:tags:compiled` catches semantic issues that only appear after compilation.

---

## Debug Panel (Browser Tool)

### What It Does

Live view of game state for testing specific scenarios without playing through the whole story.

### How to Access

Open the game with `?debug` in the URL:

```
http://localhost:8000/experiences/aricanga/?debug
```

A debug bar appears at the bottom of the screen.

### Features

**Variable Viewer:**
- Shows all ink variables and their current values
- Boolean variables (true/false) are clickable to toggle
- Changes take effect immediately

**Quick Actions:**

| Button | What It Does |
|--------|--------------|
| Skip to Draft | Sets flags to reach draft submission |
| Skip to Publish | Sets flags to reach article publication |
| Reset All | Clears all progress, starts fresh |
| Trigger All Unread | Lights up all chat notification badges |

### Use Cases

- Test what happens after publication without playing through
- Verify a specific branch works correctly
- Debug why a chat isn't showing expected content

---

## Understanding Your Story's Health

### Healthy Patterns

For a **linear progression story**:

```
Random agent coverage: ~20%
  ├── Early states (before choices): high visits
  ├── Choice-dependent states: some visits
  └── Late-game states: 0 visits (expected)
```

For a **branching story**:

```
Random agent coverage: ~40-60%
  ├── Common paths: high visits
  ├── Branch-specific states: lower visits
  └── Rare endings: very low visits
```

### Warning Signs

| Symptom | Possible Cause |
|---------|----------------|
| Early state shows 0 visits | Broken routing logic or typo in divert |
| Variable "assigned but never read" | Forgot to use a flag you set |
| State reachable before, now gray | Recent change broke the path |
| All states in a chat are gray | Chat entry point has wrong condition |

### Debugging Workflow

1. **Run heatmap** - identify gray states
2. **Check graph** - verify arrows point to the gray state
3. **Check dead-code** - look for variable issues
4. **Use debug panel** - manually set flags and test

---

## Appendix: File Locations

| File | Description |
|------|-------------|
| `docs/story-graph.dot` | Raw graph data (Graphviz format) |
| `docs/story-graph.svg` | Rendered structure diagram |
| `docs/story-heatmap.dot` | Raw heatmap data |
| `docs/story-heatmap.svg` | Rendered coverage visualization |
| `docs/story-transcript.md` | Combined transcript (all paths) |
| `docs/transcripts/*.md` | Individual path transcripts |
| `experiences/aricanga/utils/qa/random-agent.js` | Random coverage collection script |
| `experiences/aricanga/utils/qa/guided-agent.js` | Guided path verification with narrative analysis |
| `experiences/aricanga/utils/qa/ink-graph.js` | Graph generation script |
| `experiences/aricanga/utils/qa/ink-heatmap.js` | Heatmap generation script |

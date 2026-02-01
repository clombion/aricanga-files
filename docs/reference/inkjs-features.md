# inkjs Features Reference

This document catalogs inkjs Story API features and explains our usage decisions.

---

## Features We Use

### Core Flow

| Feature | Location | Purpose |
|---------|----------|---------|
| `Continue()` | game-state.js:253 | Advance story, get next text |
| `currentChoices` | game-state.js:174 | Get available player choices |
| `ChooseChoiceIndex()` | game-state.js:389 | Select player choice |
| `ChoosePathString()` | ink-bridge.js | Jump to specific knot |
| `currentTags` | ink-runtime.js:223 | Get tags for current line |

### State Management

| Feature | Location | Purpose |
|---------|----------|---------|
| `state.ToJson()` | game-state.js:426 | Serialize for save/switch |
| `state.LoadJson()` | game-state.js:431 | Restore from save |
| `state.currentPathString` | ink-runtime.js:200 | Get current location |
| `state.VisitCountAtPathString()` | main.js, game-state.js | Visit tracking for analytics/debugging |
| `variablesState[name]` | ink-bridge.js | Read/write ink variables |
| `ObserveVariable()` | ink-bridge.js:280 | Watch for variable changes |

### External Integration

| Feature | Location | Purpose |
|---------|----------|---------|
| `BindExternalFunction()` | ink-bridge.js:122 | JS-to-ink function bridge |
| `TagsForContentAtPath()` | ink-tag-audit.js | QA tag validation |

### Bound External Functions

Functions callable from ink via `~ function()` or `{function()}`:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `advance_day()` | none | Move to next day, reset time to morning |
| `data(key)` | `string` | Get external data value (e.g., statistics, amounts) |
| `delay_next(ms)` | `int` | Delay next message by specified milliseconds |
| `name(id, variant)` | `string`, `string?` | Get localized name variant (default: "short") |
| `play_sound(soundId)` | `string` | Trigger audio playback |
| `request_data(source, query, params)` | `string`, `string`, `string` | Request external data asynchronously |

**Usage in ink:**

```ink
// Delay next message
~ delay_next(1500)
This appears after a delay.

// Get localized name
{name("activist", "first_name")} says hello.

// Get external data
The median revenue is {data("median_revenue")}.

// Advance game day
~ advance_day()
```

### Cross-Chat Tags

These tags enable cross-chat messaging without external functions:

| Tag | Purpose |
|-----|---------|
| `# targetChat:{chatId}` | Route message to specified chat |
| `# notificationPreview:{text}` | Custom notification preview text |
| `# immediate` | Flush HWM immediately (skip defer queue) |

**Pattern:**
```ink
# targetChat:pat
# notificationPreview:Hey, check this out!
# speaker:Pat
# type:received
# time:9:30 AM
The actual message text here.
```

---

## Features We Don't Use (And Why)

### StateSnapshot() / RestoreStateSnapshot()

**What it does:** Lightweight in-memory snapshots for temporary rollback.

```javascript
story.StateSnapshot();        // Save current state
story.RestoreStateSnapshot(); // Restore to snapshot
story.DiscardSnapshot();      // Clear without restoring
```

**Why not used:** Only supports ONE snapshot at a time. Our multi-chat system needs simultaneous saved states (one per chat with pending choices). `ToJson()/LoadJson()` supports this and enables localStorage persistence.

**Better fit for:** Single-thread stories needing quick "undo last choice" feature.

### onMakeChoice / onDidContinue Callbacks

**What they do:** Fire during `ChooseChoiceIndex()` and `Continue()` execution.

```javascript
story.onDidContinue = () => {
  console.log('Just continued');
};

story.onMakeChoice = (choice) => {
  console.log(`Chose: ${choice.text}`);
};
```

**Why not used:** Our XState machine needs full control over state transitions. Native callbacks fire mid-execution, making async coordination (typing delays, data requests) difficult. XState actions provide guards, async invoke, and deterministic transitions.

**Better fit for:** Simple stories without async effects. Good for analytics logging.

### inkjs Flows (SwitchFlow, RemoveFlow)

**What they do:** Parallel narrative threads with independent callstacks.

```javascript
story.SwitchFlow('pat_chat');
story.SwitchFlow('news_chat');
const flows = story.aliveFlowNames;
story.RemoveFlow('pat_chat');
```

**Why not used:** Our chats have heavy cross-dependencies (news triggers pat reaction, publishing unlocks spectre). Flows share variables but add complexity without eliminating coordination. Our `# targetChat` tag (CQO-20) provides cross-chat messaging.

**Better fit for:** Games with many truly independent threads (10+), or where multiple NPCs generate messages simultaneously.

### TurnsSinceForContainer

**What it does:** Returns turns since last visit to a container.

```javascript
const turns = story.state.TurnsSinceForContainer(container);
```

**Why not used:** Requires container references (complex to obtain). We use ink variables for cooldown mechanics instead, which are more visible to ink authors.

**Better fit for:** Cooldown mechanics managed in JS rather than ink.

---

## Conversation Layer Constraints

The conversation layer's phone-game metaphor creates specific constraints:

1. **Multi-chat state isolation:** Each chat must preserve its state when player navigates away. This requires multiple simultaneous saved states.
   - Solution: `ToJson()` over `StateSnapshot()`

2. **Cross-chat triggers:** Player actions in one chat affect others (notifications, unread badges). This requires coordinated event emission.
   - Solution: XState over native callbacks

3. **Async message timing:** Typing indicators, message delays, and data fetches need async state management.
   - Solution: XState `invoke` and `delaying` state

4. **Variable-driven routing:** Chat entry points check global flags. Works well with single-story-instance + shared variables.
   - Solution: No need for Flows

---

## Extension Design Guide

When creating new layers/extensions, consider which inkjs features fit your gameplay model.

### Linear Gameplay Extensions

For single-thread narratives (visual novels, parser IF, tutorial sequences):

| Feature | Recommendation | Rationale |
|---------|---------------|-----------|
| **StateSnapshot()** | Use it | One thread = one snapshot slot works. Enables "undo last choice". |
| **onMakeChoice** | Use it | Simpler than XState when no async coordination needed. |
| **onDidContinue** | Use it | Immediate feedback after each Continue(). |
| **VisitCountAtPathString** | Use it | Great for "hint after 3 visits" mechanics. |
| **TurnsSinceForContainer** | Consider | Cooldown mechanics: "can't ask again for 3 turns". |
| **Flows** | Overkill | Single thread doesn't need parallel callstacks. |

### Multi-Thread Extensions (Like Conversation Layer)

For parallel narratives, multi-chat, or simultaneous NPCs:

| Feature | Recommendation | Rationale |
|---------|---------------|-----------|
| **StateSnapshot()** | Too limited | Only one slot - can't track multiple threads. |
| **onMakeChoice/onDidContinue** | Insufficient | Need XState for async coordination. |
| **VisitCountAtPathString** | Analytics only | Use ink variables for game logic (visible to writers). |
| **Flows** | Consider if | >10 independent threads OR true parallel message generation. |

### Hybrid Extensions

For games mixing linear sequences with branching hubs:

- Use **StateSnapshot** within linear sequences
- Switch to **ToJson/LoadJson** when entering branching hub
- **TagsForContentAtPath** useful for pre-loading next speaker's assets

### Key Decision Points

1. **How many simultaneous save states?**
   - One: StateSnapshot
   - Multiple: ToJson/LoadJson

2. **Async effects (delays, data requests)?**
   - No: Native callbacks fine
   - Yes: XState or similar state machine

3. **Who controls game logic?**
   - Ink authors: Use ink variables
   - JS code: VisitCount/TurnsSince acceptable

---

## Analytics & Debugging Features

### VisitCountAtPathString for Analytics

We use visit counts to enrich analytics context:

```javascript
// In main.js getContext callback
getContext: () => {
  const path = runtime.getCurrentPath();
  return {
    knotPath: path,
    visitCount: path ? story.state.VisitCountAtPathString(path) : 0,
    // ...other context
  };
}
```

This enables distinguishing:
- Player quits at `pat_chat.waiting` with visitCount=1 → "First encounter, bounced"
- Player quits at `pat_chat.waiting` with visitCount=5 → "Came back repeatedly, stuck"

### VisitCountAtPathString for Stall Detection

We detect unexpected story stops for debugging:

```javascript
// In game-state.js checkForStall action
if (visits > 10 || (turn > 100 && isUnexpectedLocation)) {
  console.warn('[ink-debug] Story stopped unexpectedly:', { path, visits, turn });
}
```

| Path | Visits | Turn | Diagnosis |
|------|--------|------|-----------|
| `pat_chat.ending` | 1 | 45 | Expected ending |
| `pat_chat.waiting` | 37 | 200 | Stuck in loop |
| `pat_chat.waiting` | 1 | 150 | Unexpected dead end |

### TagsForContentAtPath for QA

Used in `lint:tags:compiled` to validate tag hygiene:

```javascript
const tags = story.TagsForContentAtPath('pat_chat.waiting');
// Returns: ['speaker:Pat', 'time:08:00'] or null
```

Checks:
- Chat entries have speaker tags
- No orphan time tags (time without speaker)
- story_start only at expected boundaries

---

## API Quick Reference

### Story Instance

```javascript
import { Story } from 'inkjs';
const story = new Story(storyJson);
```

### Advancing Story

```javascript
while (story.canContinue) {
  const text = story.Continue();
  const tags = story.currentTags;
}
```

### Choices

```javascript
const choices = story.currentChoices;
// choices[i].text, choices[i].index, choices[i].sourcePath, choices[i].targetPath

story.ChooseChoiceIndex(0);
```

### Navigation

```javascript
story.ChoosePathString('knot_name');
story.ChoosePathString('knot_name.stitch_name');
```

### Variables

```javascript
// Read
const value = story.variablesState['variable_name'];

// Write
story.variablesState['variable_name'] = newValue;

// Observe
story.ObserveVariable('var_name', (varName, newValue) => {
  console.log(`${varName} changed to ${newValue}`);
});
```

### State

```javascript
// Current location
const path = story.state.currentPathString;  // "knot.stitch"
const turn = story.state.currentTurnIndex;

// Visit counts
const visits = story.state.VisitCountAtPathString('knot.stitch');

// Serialization
const json = story.state.ToJson();
story.state.LoadJson(json);
```

### External Functions

```javascript
story.BindExternalFunction('functionName', (arg1, arg2) => {
  return result;
}, true); // true = lookAheadSafe
```

### Tags

```javascript
// Current line tags (after Continue)
const tags = story.currentTags;  // ['speaker:Pat', 'time:9:00']

// Tags at any path (without navigation)
const tags = story.TagsForContentAtPath('knot.stitch');
```

---

## See Also

- [Developer Guides](../guides/developers/) - Extension patterns for layers
- [QA Tools Reference](qa-tools.md) - QA tools including tag audit
- [inkjs GitHub](https://github.com/y-lohse/inkjs) - Official inkjs repository

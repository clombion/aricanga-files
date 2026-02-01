# Glossary

Definitions of project-specific terminology.

---

## Ink Terms

### Knot

Top-level section in ink, marked with `===`. Entry point for a conversation.

```ink
=== pat_chat ===
```

### Stitch

Subsection within a knot, marked with `=`. Used for branching within a conversation.

```ink
=== pat_chat ===
= ask_angle
= waiting_for_draft
```

### Weave

Ink's indentation-based flow structure. Choices and gathers form a weave.

```ink
* [Option A]
    Response A
* [Option B]
    Response B
- // gather point
```

### Divert

Navigation command in ink using `->`.

```ink
-> pat_chat              // Go to knot
-> pat_chat.ask_angle    // Go to stitch
-> DONE                  // End this thread
```

### Tunnel

Temporary diversion that returns, using `->->`.

```ink
-> time_skip ->          // Call tunnel
// Continue here after tunnel returns
```

### Thread

Parallel execution in ink using `<-`.

```ink
<- background_music      // Run in parallel
```

### Gather

Convergence point in a weave, marked with `-`.

```ink
* [Option A]
    Text A
* [Option B]
    Text B
- // Both paths converge here
```

### Choice

Player selection point, marked with `*` (consumed) or `+` (sticky).

```ink
* [Say hello]        // Disappears after selection
+ [Ask again]        // Can be selected multiple times
```

### Tag

Metadata attached to content using `#`.

```ink
# speaker:Pat
# type:received
```

---

## Framework Terms

### Foundation

Core runtime services that any interactive fiction game needs. Includes EventBus, TimeContext, StorageAdapter, InkRuntime.

**Location:** `packages/framework/src/foundation/`

### System (formerly Layer)

Vocabulary-specific code that defines a game type. The conversation system provides phone-chat vocabulary.

**Location:** `packages/framework/src/systems/{name}/`

### Implementation (formerly Experience)

A composition of systems that creates a complete game. The Aricanga implementation uses the conversation system on the foundation.

**Location:** `experiences/{name}/`

### TagHandler

Function that transforms ink tags into structured data.

```javascript
{
  tag: 'speaker',
  handler: (value, context) => ({ speaker: value }),
}
```

### ExternalFunction

JavaScript function callable from ink.

```javascript
{
  name: 'delay_next',
  fn: (ms) => { story._capturedDelay = ms; },
  lookAheadSafe: true,
}
```

Note: Notifications are emergent via `# targetChat:` tag, not external functions.

### EventBus

Publish/subscribe system for cross-component communication.

```javascript
eventBus.emit('event-name', payload);
eventBus.on('event-name', handler);
```

### StorageAdapter

Abstraction for persistence (localStorage, IndexedDB, etc.).

---

## Game Terms

### Chat

A conversation thread with one entity (character, channel, or notes). Each chat has a unique ID, display name, and ink knot.

### Presence

Contact's online status: `online`, `offline`, or `lastseen:TIME`.

### Badge / Unread Indicator

Visual indicator that a chat has unread messages. Derived automatically from NOTIFICATION_SHOW/CHAT_OPENED events.

### Seed Messages

Messages shown on first visit to a chat, before `# story_start`. Simulates message history that existed before the story begins.

### story_start

Tag that marks the boundary between seed messages (pre-existing history) and active story (real-time messages).

```ink
{chat == 1:
    // Seed messages
}
# story_start
// Active story begins
```

### Cross-Chat Notification

Notifications fire automatically when a message targets a background chat via `# targetChat:`.

```ink
# targetChat:pat
# speaker:Pat
# notificationPreview:How's the story?
How's that Aricanga piece coming?
```

See [Simulation Physics](../concepts/simulation-physics.md#emergent-notification-model).

### Typing Indicator

Animated bubble showing "Contact is typing...". Appears automatically during `delay_next()` delays.

---

## CQO Terms

### CQO

Code Quality Objective. A measurable standard for code quality, with defined validation and enforcement.

### Structural Coherence

The code works correctly: compiles clean, tags valid, config matches ink.

### Narrative Coherence

The story makes sense: paths reachable, choices matter, time consistent.

### Invariant

Property that must always be true. Enforced by architecture.

**Example:** "Messages belong to exactly one chat"

### Blocking (Tier)

CQO that must pass before continuing. Validation failure blocks work.

### Warning (Tier)

CQO that should pass but doesn't block. Issues logged for review.

### Advisory (Tier)

CQO that provides guidance but isn't enforced automatically.

---

## Build Terms

### mise

Polyglot runtime manager used to run project tasks.

```bash
mise run build
mise run test:e2e
```

### inklecate

Ink compiler that converts `.ink` files to `.json`.

```bash
pnpm exec inklecate -c experiences/{impl}/ink/en/main.en.ink
```

### story.json

Compiled ink story in JSON format, loaded by inkjs at runtime.

### config.js

Generated JavaScript configuration from TOML sources.

### theme-vars.css

Generated CSS variables from TOML color definitions.

---

## Testing Terms

### Random Agent

Automated tool that plays through the story making random choices. Used for coverage analysis.

### Guided Agent

Automated tool that follows intended story paths. Used for verification and transcript generation.

### Heatmap

Visualization showing visit counts for each story state. Red = hot (frequent), gray = unreached.

### Story Graph

Diagram showing all states and transitions in the story.

### Transcript

Screenplay-format text of a story playthrough, generated by guided agent.

### Contract Test

Test that verifies configuration matches ink (knots exist, variables exist).

### E2E Test

End-to-end test that verifies user-facing behavior via Playwright.

---

## File Naming

### {name}.{locale}.ink

Ink file naming convention. Example: `pat.en.ink`, `news.fr.ink`.

### variables.ink

Shared variables file (not locale-specific, at ink root).

### base-config.toml

Non-translatable configuration (knot names, colors, behavior).

### {locale}.toml

Translatable strings for a locale. Example: `en.toml`, `fr.toml`.

### {locale}.rules.toml

Linguistic metadata for translation (plurals, gender, formality).

---

## Related

- [Architecture](../concepts/architecture.md) - System overview
- [CQO Reference](cqo.md) - Quality objectives
- [TOML Schema](toml-schema.md) - Configuration reference

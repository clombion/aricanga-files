# Writing Guide

Complete reference for narrative authors writing ink content for Capital Chronicle.

---

## Quick Start: Writing a Message

A basic message in ink:

```ink
# speaker:Pat
# type:received
# time:9:23 AM
Hey, did you see the news this morning?
```

This displays as a message from Pat, left-aligned (received), timestamped 9:23 AM.

---

## Tags Reference

Tags control how messages appear and behave. Every tag starts with `#`.

### Message Tags

| Tag | Purpose | Example | Notes |
|-----|---------|---------|-------|
| `speaker` | Who sent the message | `# speaker:Pat` | Required for received messages |
| `type` | Message style | `# type:received` | `sent`, `received`, `system` |
| `time` | Timestamp | `# time:9:23 AM` | Required after `# story_start` |
| `date` | Date separator | `# date:-1` | `-1` = yesterday, `0` = today |
| `class` | CSS class | `# class:emphasis` | For special styling |

### Media Tags

| Tag | Purpose | Example | Notes |
|-----|---------|---------|-------|
| `image` | Inline image | `# image:photo.jpg` | Path from assets/ |
| `audio` | Voice message | `# audio:memo.m4a` | Path from assets/ |
| `duration` | Audio length | `# duration:0:08` | For waveform sizing |
| `attachment` | File attachment | `# attachment:doc.pdf` | Shows file icon |

### Status Tags

| Tag | Purpose | Example | Notes |
|-----|---------|---------|-------|
| `presence` | Contact status | `# presence:online` | `online`, `offline`, `lastseen:TIME` |
| `status:battery` | Battery level | `# status:battery:75` | Percentage |
| `status:signal` | Signal bars | `# status:signal:3` | 1-4 bars |

### Control Tags

| Tag | Purpose | Example | Notes |
|-----|---------|---------|-------|
| `story_start` | Seed/active boundary | `# story_start` | See below |
| `clear` | Clear message history | `# clear` | Rare usage |
| `view` | UI view switch | `# view:hub` | Return to chat list |
| `targetChat` | Cross-chat routing | `# targetChat:pat` | Route to another chat (CQO-20) |
| `immediate` | Skip defer queue | `# immediate` | Bypass HWM for time-critical msgs |

---

## Message Types

### Received Messages

From NPCs to the player (left-aligned, gray bubble):

```ink
# speaker:Pat
# type:received
# time:9:23 AM
Morning. You see the Aricanga release?
```

### Sent Messages

From the player (right-aligned, blue bubble):

```ink
# type:sent
# time:9:24 AM
Just saw it. Looks like a big deal.
```

### System Messages

Information/status (centered, italic):

```ink
# type:system
# time:9:00 AM
Messages are end-to-end encrypted
```

---

## External Functions

External functions let ink trigger JavaScript behavior.

### name(id, variant)

Get localized names from configuration:

```ink
Hey {name("activist", "first_name")}, quick question.
// → "Hey Maria, quick question."

BREAKING: {name("aricanga", "name")} announces...
// → "BREAKING: Aricanga Corp announces..."
```

**Available variants:**

| Variant | Example Output | Use Case |
|---------|---------------|----------|
| `name` | "Aricanga Corp" | Full formal name |
| `short` | "Aricanga" | Casual reference |
| `alt` | "Aricanga Mining" | Alternative form |
| `first_name` | "Maria" | Personal address |
| `last_name` | "Santos" | Surname only |
| `formal` | "Ms Santos" | Professional address |
| `reference` | "Ministry" | Without article |

### delay_next(ms)

Pause before displaying next message (typing simulation):

```ink
~ delay_next(800)
# speaker:Pat
# type:received
Pat types for 800ms before this appears
```

The typing indicator shows automatically during the delay.

### advance_day()

Skip to the next day:

```ink
~ advance_day()
# date:0
// Messages after this show today's date
```

### request_data(source, query, params)

Fetch external data from configured sources. Values are defined in `data-queries.toml`.

```ink
The EITI database shows {request_data("eiti", "revenue_statistics", "")}.
```

**Available sources:**

| Source | Description | Example Queries |
|--------|-------------|-----------------|
| `eiti` | EITI transparency data | `revenue_statistics`, `project_count` |
| `story` | Story-specific values | `ministry_release`, `company_statement` |

**Parameters:**

```ink
request_data(source, query, params)
// source: Data provider ID (from data-queries.toml)
// query: Query identifier
// params: Optional parameters (often empty string "")
```

**Pre-loaded variables (preferred):**

For performance, most data is pre-loaded into ink variables at startup:

```ink
// In variables.ink
VAR data_median_revenue = ""

// In narrative
The median revenue is {data_median_revenue}.
```

This avoids runtime fetches. Use `request_data()` only when you need dynamic queries.

**Learning highlights:**

Data values should be manually wrapped for pedagogical features:

```ink
// Highlight syntax: ((display text::source:identifier))
EITI shows median revenue is (({data_median_revenue}::eiti:median_revenue)).

// Renders as clickable highlighted text that links to source
```

---

## Choice Patterns

### Cosmetic Choices

Affect dialogue flavor but not story variables:

```ink
* [I understand] -> continue
* [Got it] -> continue
* [Makes sense] -> continue
```

**Detection:** No `~ variable = value` in choice block.

### Gating Choices

Unlock or block access to content:

```ink
* [Agree to write the article]
    ~ player_agreed = true  // Gates access to notes_chat
    -> accepted
* [I need more time]
    -> declined
```

**Detection:** Variable is set AND later checked by conditional.

### Non-Blocking Consequential

Set state without forcing the player to act on it:

```ink
* [Also reach out to Maria Santos]
    ~ can_request_activist_comment = true
    // No notification! Player must remember to contact Maria
    -> continue
```

**Purpose:** Authentic agency - player must remember to follow through.

### Delayed Consequence

Effects visible only in later conversations:

```ink
// Early: Player notes to contact Maria
~ can_request_activist_comment = true

// Later: In Maria's chat
{can_request_activist_comment and activist_comment_requested:
    -> maria_responds_helpfully
- else:
    -> maria_disappointed
}
```

---

## Variables and State

### variables.ink Structure

All game state lives in `{impl}/ink/variables.ink`:

```ink
// Chat tracking
VAR current_chat = ""

// Story flags
VAR seen_announcement = false
VAR player_agreed = false
VAR research_complete = false
VAR article_published = false
```

### Story Flags Naming

| Pattern | Purpose | Example |
|---------|---------|---------|
| `seen_*` | Player viewed something | `seen_announcement` |
| `*_complete` | Phase finished | `research_complete` |
| `*_published` | Content released | `article_published` |
| `can_*` | Option unlocked | `can_request_activist_comment` |
| `*_requested` | Action taken | `activist_comment_requested` |

---

## Cross-Chat Coordination

### The targetChat Tag Pattern (CQO-20)

Use `# targetChat` to send messages to another chat:

```ink
// In news.ink - send cross-chat message to pat:
# targetChat:pat
# speaker:Pat
# type:received
# time:9:15 AM
# notificationPreview:Morning. You see the release?
Morning. You see the Aricanga release?
```

**You don't need to know where the player is.** The `# targetChat` tag declares which chat a message belongs to. At runtime, the framework checks the player's current view:

- If the player is already viewing that chat → message appears inline immediately
- If the player is in a different chat → message queues silently, a notification badge appears, and queued messages replay with typing delays when the player opens the chat

This means the same ink passage works correctly regardless of player navigation. Just declare the destination; the framework handles the rest.

Use variables to coordinate state:

```ink
// In news_chat - set flag for pat
{not seen_announcement:
    ~ seen_announcement = true
    ~ pat_can_contact = true
}
```

### Flag-Based Routing

Chat entry points check global flags:

```ink
=== pat_chat ===
~ current_chat = "pat"

// Route based on game state
{article_published and not seen_spectre_intro:
    -> pat_chat.post_publication
}
{player_agreed and not draft_sent:
    -> pat_chat.waiting_for_draft
}
-> pat_chat.default
```

### Progression Chains

```
news (seen_announcement)
  └→ pat.ask_angle (player_agreed)
       └→ notes.research_phase (research_complete)
            ├→ [optional] activist.can_ask
            └→ pat.waiting_for_draft (draft_sent)
                 └→ pat.publishing (article_published)
                      ├→ spectre.first_contact
                      └→ activist.post_publication
```

---

## Seed Messages vs Active Story

### The story_start Tag

The `# story_start` tag separates:
- **Seed messages**: Shown on first visit, persisted in history
- **Active story**: New messages appearing in real-time

```ink
=== news_chat ===
~ current_chat = "news"

// SEED MESSAGES (before story_start)
// Times here are display-only, don't affect game clock
{news_chat == 1:
    # type:received
    # speaker:Gov News Wire
    # time:Sep 7
    Infrastructure bill passes Senate committee
}

# story_start   // <-- Boundary marker

// ACTIVE STORY (after story_start)
// First message MUST have # time: tag
# speaker:Gov News Wire
# type:received
# time:9:15 AM
BREAKING: Ministry announces mining partnership...
```

### Rules

1. Seed messages only show on first visit (`{knot == 1:}`)
2. First message after `# story_start` MUST have `# time:` tag
3. Time never goes backward after `# story_start`
4. **After modifying seeds**: Run `mise run build:seeds` to regenerate

Seeds are extracted at build time and stored in `seeds.js`. The hub immediately shows seed previews without requiring a chat open.

---

## Learning Highlights

Mark data values for pedagogical features:

```ink
# type:sent
EITI shows median revenue is ((180 million::eiti:median_revenue)).
Ministry claims ((450 million::story:ministry_release)).
```

**Syntax:** `((display text::source:identifier))`

**Rendered as:**
```html
<span class="learning-highlight" data-source="eiti:median_revenue">180 million</span>
```

**Auto-highlighting:** External data from `request_data()` is automatically wrapped.

---

## Rich Media Messages

### Voice Memos

```ink
# type:sent
# audio:memo-001.m4a
# duration:0:08
# time:9:28 AM
Transcript appears here after user clicks "Transcribe"
```

### Image Messages

```ink
# type:sent
# image:press-release-photo.jpg
# time:9:31 AM
Optional caption text
```

### Attachments

```ink
# type:received
# attachment:contract-draft.pdf
# time:10:00 AM
Here's the contract draft
```

---

## Presence and Connection Effects

### Online/Offline Status

```ink
# speaker:TonyGov
# type:received
# presence:online
# delay:1500
Message appears after typing indicator
```

Presence persists until changed:
```ink
# presence:offline
// All subsequent messages show as offline
```

### Internet Connectivity

Internet connectivity is controlled separately from cellular signal via `# status:internet:TYPE`.

**Wifi:** `wifi0` (no connection), `wifi1`–`wifi2` (signal strength)
**Mobile data:** `mobile0` (no connection), `mobile1`–`mobile5` (G/E/3G/4G/5G)
**Airplane mode:** `airplane` (persists until next internet tag)
**None:** `none` (hides icon)

Setting `wifi0` or `mobile0` triggers a "No internet" banner overlay at the top:

```ink
# status:internet:wifi0
// "No internet connection" banner slides in

... dramatic pause ...

# status:internet:wifi2
// Banner dismissed, wifi icon restored
```

**Airplane mode** should be paired with `# status:signal:0`:

```ink
# status:internet:airplane
# status:signal:0
// Airplane icon shown, signal bars empty
```

Signal bars (`# status:signal:N`) are purely visual — they no longer trigger overlays.

---

## Status Bar Updates

### Battery

```ink
# status:battery:75
// Battery icon shows 75%
```

Battery turns red at ≤20%.

### Signal

```ink
# status:signal:3
// Shows 3 of 4 signal bars
```

### Time

Time is controlled by `# time:` tags on messages, not by status tags. The phone clock syncs to the earliest message time when entering a chat.

---

## Testing Your Narrative

### Quick Validation

```bash
# Check ink compiles
mise run lint:ink

# Check tags are valid
mise run lint:tags

# Full validation
mise run check
```

### Debug Panel

Access debug panel by adding `?debug` to URL:
```
http://localhost:8000/experiences/aricanga/?debug
```

Features:
- Variable viewer (click booleans to toggle)
- Quick skip buttons
- Reset button

### Guided Verification

See paths and choices:
```bash
mise run test:guided
```

Output shows:
- Choice consequence analysis
- Dependency graph
- Branch divergence metrics
- Story transcripts

---

## Common Patterns

### Chat Entry Template

```ink
=== newchat_chat ===
~ current_chat = "newchat"

// Seed messages (optional)
{newchat_chat == 1:
    # type:received
    # speaker:Name
    # time:Sep 10
    Seed message here
}

# story_start

// Exit early on revisits (if one-shot)
{newchat_chat > 1: -> DONE}

// Active story
# speaker:Name
# type:received
# time:9:30 AM
First real-time message

-> DONE
```

### Conditional Routing

```ink
=== chat_entry ===
// Check conditions top-to-bottom (first match wins)
{flag_a and flag_b:
    -> branch_ab
}
{flag_a:
    -> branch_a
}
-> default
```

### Cross-Chat Message and Continue

```ink
// Send message to another chat (notification fires automatically)
# targetChat:other_chat
# speaker:Other Person
# notificationPreview:Preview text
Message that appears in other_chat.

// Continue in current chat
~ delay_next(500)
# speaker:Current
# type:received
And now back to this conversation...
```

---

## Related

- [Simulation Physics](../../concepts/simulation-physics.md) - Message lifecycle, notifications, time rules
- [Narrative Design](../../concepts/narrative-design.md) - Choice taxonomy and design patterns
- [TOML Schema](../../reference/toml-schema.md) - Configuration parameters
- [QA Tools](../../reference/qa-tools.md) - Testing commands
- [CQO Reference](../../reference/cqo.md) - Quality objectives

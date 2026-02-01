# Adding a New Chat

> **Audience:** Implementation Developers | Writers

How to add a new conversation to Capital Chronicle.

---

## Quick Checklist

1. Add character to `{impl}/data/base-config.toml` (non-translatable fields)
2. Add translations to `{impl}/data/locales/{locale}.toml`
3. Create `{impl}/ink/{locale}/chats/{newchat}.{locale}.ink` for each locale
4. Add `INCLUDE chats/{newchat}.{locale}.ink` to each `main.{locale}.ink`
5. Run `mise run build` then `pnpm exec playwright test tests/contract/contracts.spec.ts`

---

## Step 1: Add Character to TOML

Add non-translatable fields to `{impl}/data/base-config.toml`:

```toml
[characters.newchat]
knot_name = "newchat_chat"
chat_type = "normal"
# Optional name variants for natural conversation
first_name = "Name"
last_name = "Surname"
formal = "Ms Surname"
```

### Character Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `knot_name` | Yes | Ink knot to navigate to |
| `avatar_color_name` | No | Named color override (e.g., `"purple"`, `"gray"`) — see [Avatar System](../../reference/conversation-system.md#avatar-system) |
| `avatar_letter` | No | Manual initials (defaults to first+last word initials from display_name) |
| `avatar_color` | No | Raw hex color override (legacy, prefer `avatar_color_name`) |
| `avatar_image` | No | SVG/image asset path (replaces initials, use `currentColor` strokes) |
| `chat_type` | Yes | `normal`, `disappearing`, or `channel` |
| `pinned` | No | Show in pinned section (default: false) |
| `default_presence` | No | Initial presence: `online`, `offline` |
| `first_name` | No | For `{name("id", "first_name")}` in ink |

---

## Step 2: Add Translations

Add translatable fields to `{impl}/data/locales/en.toml`:

```toml
[characters.newchat]
display_name = "New Chat"
description = "Description of this chat"
# Narrative metadata (for consistency review)
personality = "Character personality traits"
story_role = "Role in the story"
knowledge = "What they know and don't know"
```

Repeat for each locale file (`fr.toml`, etc.).

---

## Step 3: Create Ink File

Create `{impl}/ink/en/chats/newchat.en.ink`:

```ink
// Description of this chat

=== newchat_chat ===
~ current_chat = "newchat"

// Seed messages (shown before story_start, persisted)
{newchat_chat == 1:
    # type:received
    # speaker:Name
    # time:Sep 7
    Initial seed message here
}

# story_start

// Only show main content once
{newchat_chat > 1: -> DONE}

# speaker:Name
# type:received
# time:9:30 AM
First message after story starts.

-> DONE
```

---

## Step 4: Add INCLUDE

In `{impl}/ink/en/main.en.ink`, add:

```ink
INCLUDE chats/newchat.en.ink
```

Repeat for each locale's main file.

---

## Step 5: Validate

```bash
# Build all locales
mise run build

# Run contract tests to verify sync
pnpm exec playwright test tests/contract/contracts.spec.ts
```

Contract tests will fail if:
- Knot name doesn't exist in ink
- Variable doesn't exist
- Config/ink mismatch

---

## Chat Types

### Normal Chat

Standard two-way conversation:

```toml
[characters.alex]
chat_type = "normal"
```

### Disappearing Messages

Shows timer UI, visual treatment for ephemeral messages:

```toml
[characters.spectre]
chat_type = "disappearing"
disappearing_duration = "24 hours"
```

### Channel

One-way broadcast, player can't send:

```toml
[characters.news]
chat_type = "channel"
```

---

## Avatar Options

### Auto-Generated (Default)

If you don't specify avatar fields:
- Letter = First character of display_name
- Color = Unique HSL from name hash

### Named Color

```toml
avatar_color_name = "purple"  # See conversation-system.md for full list
```

Colors auto-derive from display name. Use `avatar_color_name` only to override.
Available: `blue`, `orange`, `green`, `pink`, `yellow`, `purple`, `vermilion`, `cyan`, `red`, `olive`, `violet`, `teal`, `indigo`, `gray`.

### Image Avatar

```toml
avatar_image = "avatars/notes-icon.svg"  # Path relative to assets/
```

Use SVGs with `currentColor` strokes to inherit the avatar foreground color.

Image requirements:
- Square aspect ratio (cropped to circle)
- 128x128 minimum, <50KB recommended
- PNG or JPG format

---

## Testing Your Chat

After adding:

```bash
# Full validation
mise run check

# Just contract tests
pnpm exec playwright test tests/contract/contracts.spec.ts

# Run the game
mise run serve
```

---

## Related

- [Writing Guide](../writers/writing-guide.md) - Narrative authoring reference
- [TOML Schema](../../reference/toml-schema.md) - All configuration parameters
- [Theming](theming.md) - Customizing visual appearance

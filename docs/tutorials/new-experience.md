# Adding a New Experience

Create a new story project using the framework.

**Prerequisites:** [Hello World Tutorial](./hello-world.md)

---

## What You'll Build

A new experience (story project) with:
- Custom characters and narrative
- Branded theming
- Independent localization

---

## Step 1: Generate from Template

Use the starter command:

```bash
mise start
```

Follow the prompts:
- **Project name**: Your story's identifier (lowercase, no spaces)
- **Display title**: Human-readable title
- **Locales**: Comma-separated list (e.g., `en,es`)

This creates `experiences/{your-project}/` with the full structure.

---

## Step 2: Understanding the Structure

```
experiences/your-project/
├── index.html              # Entry point
├── src/
│   ├── main.js             # Bootstrap and initialization
│   └── components/         # Experience-specific components
├── ink/
│   ├── variables.ink       # Shared variables
│   ├── en/
│   │   ├── main.en.ink     # English entry point
│   │   └── chats/          # Character conversations
│   └── fr/                 # Additional locales
├── data/
│   ├── config.toml         # Chats, entities, settings
│   ├── theme.toml          # Visual theming
│   └── locales/
│       ├── en.toml         # English strings
│       └── fr.toml         # French strings
└── assets/
    ├── avatars/            # Character images
    └── images/             # Story images
```

---

## Step 3: Configure Your Story

### config.toml

Define your chats (characters):

```toml
[meta]
title = "Your Story Title"
default_locale = "en"
supported_locales = ["en", "fr"]

[[chats]]
id = "mentor"
ink_knot = "mentor_chat"
avatar = "mentor.webp"
pinned = true
order = 10

[[chats]]
id = "contact"
ink_knot = "contact_chat"
avatar = "contact.webp"
pinned = false
order = 20

[[entities]]
id = "organization"
name = "The Organization"
short = "the org"
```

### theme.toml

Customize the visual appearance:

```toml
[colors]
primary = "#007AFF"
background = "#000000"
surface = "#1c1c1e"
text = "#ffffff"
text_muted = "#8e8e93"

[colors.bubble]
sent_bg = "#007AFF"
sent_text = "#ffffff"
received_bg = "#3a3a3c"
received_text = "#ffffff"

[typography]
font_family = "system-ui, -apple-system, sans-serif"
font_size_base = "16px"

[spacing]
message_gap = "2px"
bubble_padding = "10px 14px"
```

---

## Step 4: Write Your First Chat

Create `ink/en/chats/mentor.en.ink`:

```ink
// Mentor - Your guide in the story

=== mentor_chat ===
~ current_chat = "mentor"

{mentor_chat == 1:
    # date:-1
    # type:received
    # speaker:Mentor
    # time:Yesterday
    Welcome. I've been expecting you.
}

# story_start

{not story_started:
    -> mentor_chat.intro
}

-> mentor_chat.idle

= intro
{intro > 1: -> intro.choice}

# speaker:Mentor
# type:received
# time:9:00 AM
Ready to begin?

- (choice)
* [Yes, let's go]
    # type:sent
    Yes, I'm ready.

    ~ story_started = true

    ~ delay_next(800)
    # speaker:Mentor
    # type:received
    Good. Your first task awaits.
    -> DONE

* [What am I doing here?]
    # type:sent
    Wait, what exactly am I doing here?

    ~ delay_next(1200)
    # speaker:Mentor
    # type:received
    All will become clear. Trust the process.
    -> intro.choice

= idle
-> DONE
```

---

## Step 5: Add Variables

Create `ink/variables.ink`:

```ink
// Global State Variables

EXTERNAL name(id, variant)

// Current chat
VAR current_chat = ""

// Story progression
VAR story_started = false
```

---

## Step 6: Create the Entry Point

Create `ink/en/main.en.ink`:

```ink
// Your Story - Main Entry Point

INCLUDE ../variables.ink
INCLUDE chats/mentor.en.ink

// External functions
EXTERNAL delay_next(milliseconds)
EXTERNAL name(id, variant)
EXTERNAL advance_day()

// Start at hub
-> hub

=== hub ===
# view:hub
-> DONE
```

Note: Notifications are emergent - they fire automatically when messages target background chats via `# targetChat:`. No external function needed.

---

## Step 7: Add Locale Strings

Edit `data/locales/en.toml`:

```toml
[app]
name = "Your App"
game_title = "Your Story Title"

[ui.hub]
pinned = "Pinned"
chats = "Chats"

[characters.mentor]
display_name = "The Mentor"
description = "Your guide"

[characters.contact]
display_name = "Contact"
description = "A mysterious contact"
```

---

## Step 8: Build and Run

```bash
# Build your experience
IMPL=your-project mise run build

# Start the dev server
IMPL=your-project mise run serve
```

Visit `http://localhost:8000/experiences/your-project/`

---

## Step 9: Add Assets

### Avatars

Place character images in `assets/avatars/`:
- Format: WebP preferred, PNG acceptable
- Size: 200x200 minimum, square aspect ratio
- Naming: Match the `avatar` field in config.toml

### Story Images

For images shown in messages:
- Place in `assets/images/`
- Reference with `# attachment:/assets/images/your-image.webp`

---

## Development Workflow

```bash
# Watch for changes and rebuild
IMPL=your-project mise run watch

# Run linters
IMPL=your-project mise run check

# Run tests
IMPL=your-project mise run test:e2e
```

---

## Checklist

- [ ] Project generated with `mise start`
- [ ] `config.toml` defines all chats
- [ ] `variables.ink` declares all state
- [ ] `main.{locale}.ink` includes all chat files
- [ ] Locale strings in `locales/{locale}.toml`
- [ ] Avatars in `assets/avatars/`
- [ ] Build succeeds
- [ ] Story plays in browser

---

## What's Next?

- [Adding a Character](./adding-a-character.md) - Expand your cast
- [Writing Branching Dialogue](./branching-dialogue.md) - Complex narratives
- [Architecture Overview](../concepts/architecture.md) - System design

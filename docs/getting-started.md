# Getting Started

This guide walks you through creating your first interactive story.

## Quick Start

1. **Create your project**
   ```bash
   mise start
   ```
   Follow the prompts to name your project and choose your settings. This automatically configures `mise.toml` with your project name.

2. **Build your story**
   ```bash
   mise run build
   ```

3. **Preview in browser**
   ```bash
   mise run serve
   ```
   Open http://localhost:8000/experiences/aricanga/

## What `mise start` Creates

When you run `mise start`, it creates:

```
experiences/your-project/           # Your project's code and content
  ├── src/                            # Implementation source
  │   ├── main.js                     # Wires everything together
  │   └── config.js                   # Loads your configuration
  ├── data/                           # Your project's settings
  │   ├── base-config.toml            # Characters, behavior settings
  │   └── locales/en.toml             # Translatable text
  ├── ink/                            # Your story files
  │   ├── en/                         # English locale
  │   │   ├── main.en.ink             # Main entry point
  │   │   └── chats/                  # Chat conversations
  │   └── variables.ink               # Shared state (all locales)
  └── assets/                         # Images, audio, fonts
```

## Writing Your Story

### Story Files

Your narrative lives in `experiences/{impl}/ink/{locale}/`. The main file is `main.{locale}.ink`.

### Characters

Characters are defined in two places:

1. **base-config.toml** - Technical settings:
   ```toml
   [characters.friend]
   knot_name = "friend_chat"      # Ink knot that handles this chat
   chat_type = "normal"           # "normal" or "broadcast"
   ```

2. **locales/en.toml** - Display text:
   ```toml
   [characters.friend]
   display_name = "Best Friend"
   description = "Your childhood friend"
   ```

### Messages

Use ink tags to style messages:

```ink
=== friend_chat ===
# speaker:friend
# type:received
Hey! How are you?

* [I'm good!]
    # speaker:player
    # type:sent
    I'm good! How about you?

    # speaker:friend
    # type:received
    Great to hear!
```

**Tags:**
- `# speaker:character_id` - Who's talking
- `# type:sent` - Message from player (blue bubble)
- `# type:received` - Message to player (gray bubble)
- `# type:system` - System message (centered)

## Environment Variables

These environment variables control the build process:

| Variable | Required | Description |
|----------|----------|-------------|
| `IMPL` | Yes | Implementation name (folder under `experiences/`) |
| `LOCALE` | No | Override locale (default: from config) |
| `ANALYTICS_ENABLED` | No | Enable analytics logging (`true`/`false`) |
| `ANALYTICS_ENDPOINT` | No | Custom analytics server URL |

### Setting IMPL

The `IMPL` variable is typically set in `mise.toml`:

```toml
[env]
IMPL = "my-story"
```

Or override per-command:

```bash
IMPL=my-story mise run build
```

---

## Building and Previewing

### Build

Compiles your ink and config:
```bash
mise run build
```

### Watch Mode

Auto-rebuild on changes:
```bash
mise run watch
```

### Preview

Start local server:
```bash
mise run serve
```

**Tip:** Run watch and serve in separate terminal windows for the best development experience.

## Common Tasks

### Add a New Character

1. Add to `base-config.toml`:
   ```toml
   [characters.boss]
   knot_name = "boss_chat"
   chat_type = "normal"
   ```

2. Add to `locales/en.toml`:
   ```toml
   [characters.boss]
   display_name = "The Boss"
   description = "Your demanding manager"
   ```

3. Create the chat in `main.{locale}.ink`:
   ```ink
   === boss_chat ===
   # speaker:boss
   # type:received
   We need to talk.
   ```

### Reset Story Progress

Click the gear icon in the app and choose "Reset Story".

Or clear browser localStorage for the site.

## Troubleshooting

### Build fails with "Config not found"

The `IMPL` setting in `mise.toml` must match your project folder name. Check:

1. Open `mise.toml` and find the `IMPL = "..."` line
2. Verify the name matches your implementation folder: `experiences/{name}/`

**Common cause:** You renamed a project folder but didn't update `mise.toml`.

To fix, edit the `IMPL` line in `mise.toml`:
```toml
[env]
IMPL = "your-actual-folder-name"
```

### Build fails with "IMPL environment variable required"

This happens when `IMPL` isn't set. If you created your project with `mise start`, it should be configured automatically. You can also set it manually:
```bash
IMPL=my-story mise run build   # One-time override
```

Or edit `mise.toml` to set a default (see above).

### Changes not appearing

1. Make sure you ran `build` after changing files
2. Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)
3. Check for ink compilation errors in the terminal

### Story stuck / won't progress

Check that your ink has proper flow:
- Make sure choices lead somewhere (`-> knot_name`)
- Avoid infinite loops
- End conversations with `-> DONE` or `-> END`

## Next Steps

- Read the [ink documentation](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) to learn advanced narrative techniques
- Look at existing implementations' `ink/en/` folders for examples
- Check `docs/reference/toml-schema.md` for all configuration options

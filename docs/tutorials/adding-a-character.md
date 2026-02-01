# Adding a New Character

Add a new chat contact to your story with their own conversation thread.

**Prerequisites:** Completed [Hello World Tutorial](./hello-world.md)

---

## What You'll Build

By the end of this tutorial, you'll have:
- Created a new character with their own chat file
- Added them to the main ink entry point
- Configured their display name and avatar
- Written their first conversation

---

## Step 1: Create the Character's Chat File

Create a new ink file for your character. We'll add a informant named "Deep Source":

```bash
# Create the file (replace aricanga with your implementation)
touch experiences/aricanga/ink/en/chats/source.en.ink
```

Add the basic structure:

```ink
// Deep Source - Anonymous informant with government connections

=== source_chat ===
~ current_chat = "source"

// Seed messages - shown on first visit
{source_chat == 1:
    # date:-1
    # type:received
    # speaker:Deep Source
    # time:Yesterday
    Are you the reporter from the Chronicle?

    ~ delay_next(0)
    # type:sent
    # time:Yesterday
    Who is this?

    ~ delay_next(0)
    # type:received
    # speaker:Deep Source
    # time:Yesterday
    Someone who knows things. We'll talk soon.
}

# story_start

// Route to appropriate state based on game progress
{not seen_announcement:
    -> source_chat.waiting
}

-> source_chat.idle

= waiting
// Character stays dormant until story progresses
-> DONE

= idle
-> DONE
```

**Key patterns:**
- `~ current_chat = "source"` - Must be first line after knot declaration (CQO-18)
- `{source_chat == 1: ...}` - Seed messages only appear on first visit
- `# story_start` - Separates seed messages from active story

---

## Step 2: Include in Main Entry Point

Open `experiences/aricanga/ink/en/main.en.ink` and add the INCLUDE:

```ink
INCLUDE chats/source.en.ink
```

Place it with the other chat includes.

---

## Step 3: Configure the Character

Open `experiences/aricanga/data/config.toml` and add the chat entry:

```toml
[[chats]]
id = "source"
ink_knot = "source_chat"
avatar = "source.webp"
pinned = false
order = 60  # Position in chat list
```

Add the character strings in `experiences/aricanga/data/locales/en.toml`:

```toml
[characters.source]
display_name = "Deep Source"
description = "Anonymous contact"
personality = "Cryptic, cautious. Never reveals identity."
story_role = "Government insider with sensitive information."
```

---

## Step 4: Add the Avatar

Create or add an avatar image:

```bash
# Place a square image (recommended 200x200 or larger)
cp your-avatar.webp experiences/aricanga/assets/avatars/source.webp
```

If you don't have an image, you can use a placeholder - the system will show the first letter of the display name.

---

## Step 5: Build and Test

```bash
IMPL=aricanga mise run build
```

Refresh your browser. The new chat should appear in your chat list.

---

## Step 6: Add Story Content

Expand the character's dialogue. Here's an example with branching:

```ink
= first_contact
{first_contact > 1: -> first_contact.choice}

# speaker:Deep Source
# type:received
# time:10:15 AM
I read your article on the mining deal.

~ delay_next(1000)
# type:received
The official numbers don't add up.

~ delay_next(1500)
# type:received
Interested in the real story?

- (choice)
* [What do you mean?]
    # type:sent
    What do you mean? What numbers?

    ~ delay_next(800)
    # speaker:Deep Source
    # type:received
    The revenue projections. Compare them to similar deals.
    -> DONE

* [Who are you?]
    # type:sent
    Who are you? How did you get this number?

    ~ delay_next(1200)
    # speaker:Deep Source
    # type:received
    Names don't matter. What matters is what I can show you.
    -> DONE
```

---

## Understanding the Patterns

### Time Tags

Every message needs a `# time:` tag:
- Seed messages use display times: `# time:Yesterday`, `# time:Aug 14`
- Story messages use in-game times: `# time:10:15 AM`

### Message Types

```ink
# type:received    // Left-aligned, from the character
# type:sent        // Right-aligned, from the player
# type:system      // Centered, gray (for system messages)
```

### Triggering Notifications

To make the character's chat light up from another conversation, send a cross-chat message:

```ink
// In another character's file - send message to source chat
# targetChat:source
# speaker:Source Name
# type:received
# notificationPreview:I have something for you...
I have something for you that might help with your story.
```

The notification and unread badge fire automatically when the message targets a background chat (via `NOTIFICATION_SHOW`). The badge clears when the player opens the chat (`CHAT_OPENED`).

---

## Checklist

Before moving on, verify:

- [ ] Chat file created with proper knot structure
- [ ] `current_chat` set on first line of knot
- [ ] File included in `main.en.ink`
- [ ] Character configured in `config.toml`
- [ ] Locale strings added to `en.toml`
- [ ] Build succeeds without errors

---

## What's Next?

- [Writing Branching Dialogue](./branching-dialogue.md) - Complex choices and state
- [Adding Localization](./localization.md) - Translate your character to other languages
- [Writing Guide](../guides/writers/writing-guide.md) - Complete reference

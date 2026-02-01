# Hello World Tutorial

Make your first edit to Capital Chronicle and see it in the browser.

**Time:** ~10 minutes
**Prerequisites:** Node.js 18+, inklecate (ink compiler)

---

## What You'll Build

By the end of this tutorial, you'll have:
- Set up the development environment
- Made a visible change to the story
- Seen your change in the browser

---

## Prerequisites

### 1. Node.js

Check if Node.js is installed:

```bash
node --version
# Should show v18.0.0 or higher
```

If not installed, download from [nodejs.org](https://nodejs.org/).

### 2. inklecate (ink compiler)

Check if inklecate is available:

```bash
inklecate --version
# Should show version number
```

If not installed, see [ink installation guide](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md).

### 3. mise (optional, recommended)

mise is a polyglot runtime manager that simplifies running project tasks.

```bash
# Install mise
curl https://mise.run | sh

# Verify
mise --version
```

If you don't want to use mise, you can run npm commands directly (shown as alternatives below).

---

## Step 1: Clone and Setup

Clone the repository:

```bash
git clone <repository-url>
cd phone-game-poc
```

Install dependencies:

```bash
# With mise (recommended)
mise run setup

# Or with pnpm directly
pnpm install
```

Expected output:
```
added 150 packages...
```

---

## Step 2: Build the Project

Build compiles the ink story and generates configuration. You need to specify which implementation to build with the `IMPL` environment variable:

```bash
# With mise
IMPL=aricanga mise run build

# Or with pnpm
IMPL=aricanga pnpm build
```

Expected output:
```
Building all locales...
✓ en: Compiled story.json
✓ fr: Compiled story.json
✓ Generated config.js
✓ Generated theme-vars.css
Build complete!
```

---

## Step 3: Start the Development Server

```bash
# With mise
IMPL=aricanga mise run serve

# Or with pnpm
pnpm serve
```

Expected output:
```
Serving at http://localhost:8000
```

Open [http://localhost:8000/experiences/aricanga/](http://localhost:8000/experiences/aricanga/) in your browser.

You should see a phone interface with a chat list. The "Gov News Wire" chat should have an unread indicator.

---

## Step 4: Explore the Game

1. Tap on **Gov News Wire** to open it
2. Read the breaking news message about the Aricanga announcement
3. Notice how Pat's chat lights up with an unread badge
4. Tap the back button and open **Pat**
5. Read Pat's message asking about the story

This is the starting point of the narrative.

---

## Step 5: Make Your First Edit

Now let's change something visible. Open the news chat file:

```bash
# Open in your editor (replace {impl} with your implementation name, e.g., aricanga)
code experiences/{impl}/ink/en/chats/news.en.ink
# Or: vim experiences/{impl}/ink/en/chats/news.en.ink
# Or: nano experiences/{impl}/ink/en/chats/news.en.ink
```

Find line 30-31 (the breaking news message):

```ink
# speaker:Gov News Wire
# type:received
# time:9:15 AM
BREAKING: {name("ministry", "alt")} announces landmark mining partnership with {name("aricanga", "name")}.
```

Change the word "BREAKING" to "URGENT":

```ink
# speaker:Gov News Wire
# type:received
# time:9:15 AM
URGENT: {name("ministry", "alt")} announces landmark mining partnership with {name("aricanga", "name")}.
```

Save the file.

---

## Step 6: Rebuild and See Your Change

Rebuild the project:

```bash
# With mise
IMPL=aricanga mise run build

# Or with pnpm
IMPL=aricanga pnpm build
```

Now refresh your browser at [http://localhost:8000/experiences/aricanga/](http://localhost:8000/experiences/aricanga/).

**To see your change:**
1. Open the browser's developer console (F12 or Cmd+Option+I)
2. Go to Application → Local Storage → http://localhost:8000
3. Click "Clear All" to reset game state
4. Refresh the page
5. Open Gov News Wire

You should now see "URGENT:" instead of "BREAKING:" at the start of the first news message.

---

## Understanding What Happened

### Ink File Structure

The file `{impl}/ink/en/chats/news.en.ink` contains:

```ink
=== news_chat ===           // Knot name (entry point)
~ current_chat = "news"     // Set which chat we're in

// Tags control how messages display
# speaker:Gov News Wire     // Who sent this message
# type:received             // Message type (left-aligned, gray)
# time:9:15 AM              // Timestamp shown on message
BREAKING: ...               // The actual message text
```

### Tags Reference

| Tag | Purpose |
|-----|---------|
| `# speaker:Name` | Who sent the message |
| `# type:received` | Message style (received = left, sent = right) |
| `# time:9:15 AM` | Timestamp display |
| `# story_start` | Marks boundary between seed messages and active story |

### Name Function

The `{name("id", "variant")}` function looks up names from configuration:

```ink
{name("aricanga", "name")}   // → "Aricanga Corp"
{name("aricanga", "short")}  // → "Aricanga"
{name("ministry", "alt")}    // → "Ministry of Resources"
```

This allows names to be localized without changing ink files.

---

## What's Next?

You've made your first edit! Here's where to go next:

### Continue Learning

- [Adding a Character](./adding-a-character.md) - Create a new chat contact
- [Writing Branching Dialogue](./branching-dialogue.md) - Choices and state
- [Adding Localization](./localization.md) - Translate to other languages

### For Developers

- [Creating a Component](./creating-a-component.md) - Build web components
- [Adding a New Experience](./new-experience.md) - Start a new story project
- [Integrating Ink Variables](./ink-variables-ui.md) - Connect ink to UI

### Testing & Debugging

- [Debugging Ink State](./debugging-ink.md) - Inspect variables
- [Testing Time Coherence](./testing-time.md) - Verify temporal consistency

### Reference

- [Writing Guide](../guides/writers/writing-guide.md) - Complete syntax reference
- [Architecture](../concepts/architecture.md) - System design

---

## Troubleshooting

### "inklecate not found"

Ensure inklecate is in your PATH:
```bash
which inklecate
```

If it's not found, you may need to add it to your PATH or install it.

### "Build failed with ink errors"

Check the error message. Common issues:
- Typo in knot name
- Missing `-> DONE` at end of path
- Unclosed brackets

### "Changes don't appear"

1. Make sure you rebuilt after saving: `mise run build`
2. Clear browser localStorage (see Step 6)
3. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)

### "Server won't start"

Port 8000 may be in use. Check for other processes:
```bash
lsof -i :8000
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `mise run setup` | Install dependencies (sets up aricanga) |
| `mise start` | Create a new story from template |
| `IMPL=aricanga mise run build` | Compile ink and generate config |
| `IMPL=aricanga mise run serve` | Start development server |
| `IMPL=aricanga mise run check` | Run all linters and tests |
| `IMPL=aricanga mise run test:e2e` | Run end-to-end tests |

> **Note:** The `IMPL` environment variable specifies which implementation to use. Replace `aricanga` with your project name if you've created a new one.

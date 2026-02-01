# Phone Game Framework

A framework for building narrative serious games using [ink](https://www.inklestudios.com/ink/) and [inkjs](https://github.com/y-lohse/inkjs). The UI mimics iOS Messages to create an accessible, mobile-first experience for interactive storytelling.

## What This Is

This framework provides everything needed to build chat-based narrative games:

- **Multi-chat conversations** - Parallel storylines that affect each other
- **Mobile-first UI** - Familiar iOS Messages interface
- **State management** - XState-powered game state with save/load
- **i18n support** - Full localization for stories and UI
- **Built-in analytics** - Capture player choices for learning analytics

Use cases include journalism training, civic literacy education, media literacy, and any scenario where branching conversations create engaging experiences.

**Example implementation**: See `experiences/aricanga/` for a complete story about a junior reporter investigating corporate transparency.

## Quick Start

```bash
# Prerequisites: inklecate, mise, Node.js 18+
# macOS: brew install --cask inkle/brew/inklecate && brew install mise

# First-time setup (installs deps, builds example story)
mise run setup

# Build and serve (IMPL is required - specify your implementation name)
IMPL=my-story mise run build
IMPL=my-story mise run serve

# Open http://localhost:8000/experiences/my-story/
```

> **Note**: `IMPL` must always be specified explicitly. There is no default.

### Create Your Own Story

```bash
# Interactive setup wizard (auto-configures mise.toml)
mise start

# Follow the prompts, then:
mise run build
mise run serve
```

See [docs/getting-started.md](docs/getting-started.md) for a complete guide.

## Why ink + Mobile UI?

**ink** is a narrative scripting language designed for branching stories. It's:
- Easy for writers to learn (no programming required)
- Powerful enough for complex state management
- Battle-tested in commercial games (80 Days, Heaven's Vault)

**Mobile chat UI** makes serious games accessible:
- Familiar interface reduces friction
- Works on phones where people actually are
- Natural fit for multi-threaded narratives

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  INK STORY (experiences/{impl}/ink/)                │
│  Pure narrative. Calls externals for side effects.          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  INK BRIDGE (experiences/{impl}/src/ink-bridge.js)      │
│  Binds external functions, observes variables               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GAME STATE (experiences/{impl}/src/game-state.js)      │
│  XState machine: currentView, taggedChoices, messageHistory │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GAME CONTROLLER (experiences/{impl}/src/game-controller.js)
│  Orchestrates bridge ↔ state, dispatches UI events          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  WEB COMPONENTS (@narratives/framework - packages/framework)│
│  chat-hub, chat-thread, notification-popup                  │
└─────────────────────────────────────────────────────────────┘
```

## Story Structure

Each implementation defines its own story with parallel conversations that affect each other. A typical structure might include:

- **News channel** - Broadcasts that trigger events
- **Editor/Boss** - Assigns tasks and deadlines
- **Notes** - Internal monologue and task tracking
- **Sources** - Characters who provide information
- **Contacts** - Other characters with their own motivations

Actions in one conversation trigger notifications and state changes in others. See `experiences/aricanga/README.md` for a detailed example.

## Configuration

### Overview

Configuration uses a 3-layer system:

| Layer | Files | Purpose |
|-------|-------|---------|
| **TOML** | `experiences/{impl}/data/base-config.toml`, `locales/*.toml` | Source of truth |
| **Environment** | `IMPL`, `LOCALE`, etc. | Build-time configuration |
| **Generated** | `experiences/{impl}/generated/config.js`, `theme-vars.css` | Runtime output |

### What's Configurable

| Setting | File | Why Configurable |
|---------|------|------------------|
| Characters & chats | `base-config.toml` | Add/modify story characters |
| UI strings | `locales/{lang}.toml` | Translations, player-facing text |
| Theme colors | `base-config.toml` → `[ui.colors]` | Visual branding |
| Phone behavior | `base-config.toml` → `[phone]` | Gameplay tuning |
| Analytics endpoint | env `ANALYTICS_ENDPOINT` | Deploy to different backends |

### How to Configure

**Add a character**: Edit `base-config.toml` + locale files (see "Adding a New Chat")

**Change theme colors**: Edit `[ui.colors]` in `base-config.toml`, run `mise run build`

**Override for CI/deploy**:
```bash
LOCALE=fr mise run build                                    # Build for French
ANALYTICS_ENABLED=true mise run build                       # Enable analytics
ANALYTICS_ENDPOINT=https://prod.example.com mise run build  # Custom endpoint
```

**After any config change**: Run `mise run build` to regenerate.

## Development

### Prerequisites

- [inklecate](https://github.com/inkle/ink/releases) - Ink compiler
- [mise](https://mise.jdx.dev/) - Task runner
- Node.js 18+ - For build scripts and tests


### Commands

```bash
mise run build   # Build config + compile ink for all locales
mise run play    # Test story in terminal
mise run watch   # Auto-recompile on changes
mise run serve   # Start server at :8000
mise run lint    # Run all linters
mise run test    # Run Playwright tests
```

### Testing

```bash
# Setup (first time)
pnpm install
mise run test:setup

# Unit tests (game state machine)
pnpm test:unit

# E2E tests (includes accessibility via axe-core)
mise run test:e2e

# Run with UI
mise run test:e2e:ui
```

### QA & Visualization

```bash
# Story coverage analysis
mise run test:coverage    # Random agent exploration
mise run test:guided      # Guided path verification

# Visualizations
mise run ink:graph:svg    # Story structure diagram
mise run ink:heatmap:svg  # Coverage heatmap
mise run ink:deps         # Cross-chat dependencies
```

See [docs/reference/qa-tools.md](docs/reference/qa-tools.md) for interpretation guide.

## Adding a New Chat

1. Add character entry to `experiences/{impl}/data/base-config.toml`

2. Add translations to `experiences/{impl}/data/locales/en.toml` and other locale files

3. Create `experiences/{impl}/ink/{locale}/chats/newchat.ink` for each locale

4. Add `INCLUDE chats/newchat.ink` to each locale's `main.ink`

5. Add `VAR newchat_unread = false` to `experiences/{impl}/ink/variables.ink`

6. Run `mise run build` to regenerate config and compile stories

Contract tests will verify everything is in sync.

## For LLM Agents

This project includes automated validation and contextual skills for LLM agents. See `docs/agents/` for agent-specific guidance.

## License

MIT

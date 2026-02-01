# Aricanga - Capital Chronicle

A journalism training experience where you play as a junior reporter at the *Capital Chronicle*, investigating corporate transparency issues around Aricanga Mining.

## Story Overview

The player navigates pressure from editors, anonymous sources, and breaking news - all through familiar chat interfaces. The story explores themes of:

- Editorial decision-making under deadline pressure
- Source verification and anonymous contacts
- Corporate transparency and beneficial ownership
- Media ethics in investigative journalism

## Characters

| Chat | Character | Purpose |
|------|-----------|---------|
| **news** | Gov News Wire | Official announcements that trigger story events |
| **pat** | Pat (Editor) | Your boss, assigns tasks and creates deadline pressure |
| **notes** | My Notes | Internal monologue, task tracking, and brainstorming |
| **activist** | Maria Santos | Environmental activist, optional source |
| **spectre** | Spectre | Anonymous source with secrets about Aricanga |

## Story Flow

1. **News drops** - Gov News Wire announces something about Aricanga
2. **Pat responds** - Editor assigns you to cover the story
3. **Research phase** - Use Notes to brainstorm, optionally reach out to sources
4. **Source development** - Maria and/or Spectre may offer information
5. **Decision points** - Choose what to publish, what to investigate further

## Running This Implementation

```bash
# Build and serve
IMPL=aricanga mise run build
IMPL=aricanga mise run serve

# Open http://localhost:8000/experiences/aricanga/

# Play in terminal
IMPL=aricanga mise run play

# Run tests
IMPL=aricanga pnpm test:e2e
```

## File Structure

```
src/experiences/aricanga/
├── data/
│   ├── base-config.toml      # Character definitions, game settings
│   └── locales/
│       ├── en.toml           # English translations
│       └── fr.toml           # French translations
├── ink/
│   ├── variables.ink         # Global state variables
│   ├── en/                   # English narrative
│   │   ├── main.en.ink
│   │   └── chats/*.ink
│   └── fr/                   # French narrative
├── generated/                # Auto-generated from TOML
├── css/                      # Implementation-specific styles
├── assets/                   # Images, audio
└── dist/                     # Compiled story.json per locale
```

## Key Variables

The story uses these ink variables for cross-chat state:

- `seen_announcement` - Has player seen the news about Aricanga?
- `player_agreed` - Did player accept the assignment?
- `research_complete` - Has player finished the notes brainstorm?
- `contacted_maria` - Did player reach out to the activist?
- `article_published` - Has the story been published?

## Data Service

The `data-service.js` provides mock EITI (Extractive Industries Transparency Initiative) data for the story's investigation mechanics:

- Beneficial ownership lookups
- Mining license verification
- Tax payment records
- Company registry data

## Localization

The story is fully localized into English and French. Locale files contain:

- UI strings (buttons, labels, system messages)
- Character display names
- Entity names (companies, places, organizations)

Run `IMPL=aricanga mise run tl:status` to check translation coverage.

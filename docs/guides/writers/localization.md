# Localization Guide

This document explains how to add new languages and translate content in Capital Chronicle.

## Architecture Overview

The localization system has three categories of translatable content:

1. **UI Strings** - Labels, buttons, status text (~25 strings)
2. **Config Strings** - Character names, descriptions, system messages (~15 strings)
3. **Narrative Content** - Character dialogue, choices (in ink files)

### File Structure

```
experiences/{impl}/
├── data/
│   ├── base-config.toml       # Non-translatable config + i18n settings
│   └── locales/
│       ├── en.toml            # English UI + config strings
│       └── fr.toml            # French UI + config strings
├── ink/
│   ├── variables.ink          # Shared game state (at root, not translated)
│   ├── en/                    # English narrative content
│   │   ├── main.en.ink        # Story entry point
│   │   └── chats/
│   │       ├── pat.en.ink
│   │       ├── news.en.ink
│   │       └── ...
│   └── fr/                    # French narrative content
│       ├── main.fr.ink
│       └── chats/
│           ├── pat.fr.ink
│           ├── news.fr.ink
│           └── ...
├── dist/
│   ├── en/story.json          # Compiled English story
│   ├── fr/story.json          # Compiled French story
│   └── locales/
│       ├── en.json            # Runtime UI strings
│       └── fr.json
└── src/
    └── services/
        └── i18n.js            # Locale manager (dynamic loading)
```

### Ink File Naming Convention

All ink files in locale folders follow the `{name}.{locale}.ink` pattern:
- `main.en.ink`, `main.fr.ink`
- `chats/pat.en.ink`, `chats/pat.fr.ink`

This makes files easily identifiable in editor tabs and translation platforms.

**Exception:** `variables.ink` lives at the ink root (not in locale folders) because game state variables are code identifiers that must be identical across all locales.

## Adding a New Language

### Step 1: Create Locale File

Copy `experiences/{impl}/data/locales/en.toml` to create a new locale file:

```bash
cp experiences/{impl}/data/locales/en.toml experiences/{impl}/data/locales/es.toml
```

### Step 2: Translate Strings

Edit the new file and translate all strings:

```toml
# experiences/{impl}/data/locales/es.toml

[ui.hub]
pinned = "Fijados"
chats = "Chats"
tap_to_open = "Toca para abrir"
search = "Buscar"

[ui.status]
online = "en línea"
offline = "desconectado"
last_seen = "última vez {time}"

# ... translate all sections
```

### Step 3: Register the Locale

Add the new locale to `experiences/{impl}/data/base-config.toml`:

```toml
[i18n]
default_locale = "en"
available_locales = ["en", "fr", "es"]

[i18n.locale_names]
en = "English"
fr = "Français"
es = "Español"

[i18n.ink_folders]
en = "ink/en"
fr = "ink/fr"
es = "ink/es"   # Add entry for new locale (relative to implementation)
```

### Step 4: Create Ink Folder

Create the ink folder structure for the new locale:

```bash
# From project root, with IMPL set (e.g., IMPL=my-story)
impl_dir="experiences/$IMPL"
mkdir -p "$impl_dir/ink/es/chats"

# Copy ink files from English (they'll contain English text initially)
cp "$impl_dir/ink/en/main.en.ink" "$impl_dir/ink/es/main.es.ink"
for f in "$impl_dir/ink/en/chats"/*.en.ink; do
  base=$(basename "$f" .en.ink)
  cp "$f" "$impl_dir/ink/es/chats/${base}.es.ink"
done
```

**Important:** Update the INCLUDE statements in `main.es.ink`:
```ink
INCLUDE ../variables.ink
INCLUDE chats/pat.es.ink
INCLUDE chats/news.es.ink
// etc.
```

### Step 5: Build

```bash
mise run build
```

The build automatically discovers locales from config - no mise.toml changes needed.

The locale will now appear in Settings > Language.

## Translating Content Categories

### UI Strings (`ui.*`)

These are interface labels that appear throughout the app:

| Section | Purpose |
|---------|---------|
| `ui.hub` | Chat list screen headers and labels |
| `ui.drawer` | Notification shade strings |
| `ui.tiles` | Quick action tile labels |
| `ui.settings` | Settings page strings |
| `ui.status` | Presence indicators |
| `ui.dates` | Date formatting labels |
| `ui.messages` | Message status indicators |
| `ui.a11y` | Accessibility labels (screen readers) |

### Character Config (`characters.*`)

Character names and descriptions can be culturally adapted:

```toml
[characters.pat]
display_name = "Pat (Rédacteur)"  # Culturally adapted
description = "Votre rédacteur au Capital Chronicle"

[characters.activist]
display_name = "María Santos"     # Keep original or adapt
description = "Militante communautaire"
```

### Chat Type Messages (`chat_types.*`)

System messages shown at the top of conversations:

```toml
[chat_types.normal]
system_message = "Certains messages peuvent ne pas être visibles..."

[chat_types.disappearing]
system_message = "Les messages éphémères sont activés..."

[chat_types.channel]
system_message = "Ceci est la chaîne officielle de {name}..."
input_placeholder = "Seul {name} peut envoyer des messages"
```

### Glossary Terms (`glossary.terms.*`)

The in-game glossary displays extractive industries terminology. Terms are defined in two places:

1. **Base data** (`public/data/glossary-terms.toml`): IDs and categories (not translated)
2. **Translations** (`locales/{lang}.toml`): Term names and definitions

Each term ID in `glossary-terms.toml` needs a matching section in the locale file:

```toml
# experiences/{impl}/data/locales/fr.toml

[glossary.terms.eiti]
term = "ITIE"
definition = "L'Initiative pour la Transparence dans les Industries Extractives..."

[glossary.terms.beneficial-ownership]
term = "Bénéficiaire effectif"
definition = "Informations sur les personnes réelles qui possèdent..."

[glossary.terms.royalties]
term = "Redevances"
definition = "Paiements effectués au gouvernement..."
```

**Key points:**
- The `id` in `glossary-terms.toml` must match the key in `glossary.terms.*`
- Use dashes in IDs: `beneficial-ownership`, not `beneficial_ownership`
- Categories (`governance`, `finance`, `legal`, etc.) are not translated
- Glossary updates automatically when user switches language in Settings

## Name Localization System

Character and entity names can be localized while keeping ink code unchanged. This enables locale switching without recompiling ink files.

### How It Works

Names are defined in `base-config.toml` and resolved at runtime via the `name()` external function:

```ink
// In ink files - same code works for all locales
Morning. You see the {name("aricanga", "short")} release?
Hey {name("activist", "first_name")}, quick question.
```

### Entity Configuration (`base-config.toml`)

Entities are fictional companies, organizations, and places:

```toml
[entities.companies.aricanga]
name = "Aricanga Corp"        # Full formal name
short = "Aricanga"            # Casual shorthand
alt = "Aricanga Mining"       # Alternative form
context = "Fictional extractive mining company"

[entities.government.ministry]
name = "Ministry of Natural Resources"
short = "the Ministry"
reference = "Ministry"        # Without article, for "Ministry's..."
skip_localization = true      # Name stays same across locales
```

### Character Name Variants (`base-config.toml`)

Characters have multiple name forms for natural conversation:

```toml
[characters.activist]
# ... existing config ...
first_name = "Maria"
last_name = "Santos"
formal = "Ms Santos"
display_name = "Maria Santos"
```

### Locale-Specific Overrides

Add name overrides in locale TOML files:

```toml
# experiences/{impl}/data/locales/fr.toml

[names.characters.activist]
formal = "Mme Santos"         # Ms → Mme

[names.entities.aricanga]
name = "Société Minière SA"   # Localized company name
short = "Société Minière"
```

### Name Lookup Order

1. Locale-specific override (`strings.names[id][variant]`)
2. Base config name (`strings.baseNames[id][variant]`)
3. Fallback: returns the ID itself

### Suggesting Localized Names

Use the `tl names` command to get LLM-assisted name suggestions:

```bash
# Get suggestions for French setting
node experiences/aricanga/utils/translation/cli.js names --context "French"

# Write to fr.toml with backup
node experiences/aricanga/utils/translation/cli.js names --locale fr --context "French"

# Fantastical settings work too
node experiences/aricanga/utils/translation/cli.js names --context "cyberpunk dystopia"
```

The command uses structured output to provide rationale for each name decision.

## Developer Integration

For developers integrating i18n in components, see the [i18n Developer Guide](../developers/i18n.md) which covers:
- `i18n.t()` and `i18n.getName()` API reference
- Component integration patterns
- Locale switching implementation

## Narrative Content (Ink)

Narrative content uses per-locale ink folders with the `{name}.{locale}.ink` naming convention.

### Translating Ink Files

1. Open the French version of a file (e.g., `{impl}/ink/fr/chats/pat.fr.ink`)
2. Translate the dialogue while preserving:
   - All `# tag:` lines (metadata)
   - Variable names (`{name}`, `{count}`)
   - Knot/stitch names (`=== pat_chat ===`)
   - Logic and conditionals

### Example

```ink
// pat.en.ink
=== pat_chat ===
# chat:pat
Pat: Hey, got your message about the story.
Pat: When can you send me the draft?

// pat.fr.ink
=== pat_chat ===
# chat:pat
Pat: Salut, j'ai reçu ton message sur l'article.
Pat: Quand peux-tu m'envoyer le brouillon ?
```

## Testing Localization

### Diacritics Test

French locale includes diacritics for testing proper encoding:

- é, è, ê (accents aigus, graves, circonflexes)
- à, ç, ù (accents, cédilles)
- î, ô (circonflexes)

### E2E Tests

```bash
# Run settings page tests
pnpm exec playwright test settings-page

# Run all tests
mise run test:e2e
```

## Best Practices

1. **Use i18n.t() for all user-facing strings** - Never hardcode English text
2. **Include context in keys** - `ui.hub.pinned` not just `pinned`
3. **Test with French** - Diacritics catch encoding issues early
4. **Keep translations short** - UI labels should fit the same space
5. **Preserve interpolation variables** - `{time}`, `{name}`, `{count}` etc.

## Translation CLI

The project includes a translation CLI for managing localization workflow.

### Quick Start

```bash
# Extract strings for translation (human-readable prompt format)
mise run tl -l fr -f prompt > translate-fr.txt

# Check translation progress
mise run tl:status

# Import translated file
mise run tl:import -l fr translated.json

# Validate translations
mise run tl:validate translated.json

# Initialize a new locale
mise run tl:init es
```

### Commands

| Command | Description |
|---------|-------------|
| `tl` | Extract strings for translation (default: prompt format) |
| `tl:translate` | LLM-powered translation (see below) |
| `tl:import` | Import translations from file |
| `tl:status` | Show translation progress for all locales |
| `tl:validate` | Check translation file for errors |
| `tl:init` | Initialize new locale (creates TOML + ink files) |
| `tl:names` | LLM-assisted name localization suggestions |

### LLM-Powered Translation

The `translate` command uses AI providers to translate strings automatically:

```bash
# Translate to French using Google Gemini (free tier)
export GOOGLE_GENERATIVE_AI_API_KEY=your-key
node experiences/aricanga/utils/translation/cli.js translate -l fr -p google

# Use Anthropic Claude
export ANTHROPIC_API_KEY=your-key
node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic

# Use OpenAI
export OPENAI_API_KEY=your-key
node experiences/aricanga/utils/translation/cli.js translate -l fr -p openai

# Preview without calling API
node experiences/aricanga/utils/translation/cli.js translate -l fr --dry-run
```

**Available providers:** `anthropic`, `google`, `openai`, `fake` (for testing)

Provider configuration (default models) is stored in `experiences/aricanga/utils/translation/llm-providers.toml`.

### Translation Glossary

The file `experiences/{impl}/data/glossary.toml` defines terms that should be handled consistently:

```toml
# Preserve unchanged (proper nouns, brand names)
[[terms]]
term = "Aricanga"
action = "preserve"
note = "Fictional company name"

# Translate to specific equivalents per locale
[[terms]]
term = "Ministry of Natural Resources"
action = "translate_as"
fr = "Ministère des Ressources Naturelles"
es = "Ministerio de Recursos Naturales"
```

The glossary is automatically loaded by the `translate` command and included in LLM prompts.

For technical details about the translation system (structured outputs, validation schemas, output formats, locale rules, and state tracking), see the [i18n Developer Guide](../developers/i18n.md#translation-cli-internals).

### End-to-End Translation Workflow

Here's a complete workflow for translating to a new language:

```bash
# 1. Initialize the locale (creates TOML + ink file structure)
node experiences/aricanga/utils/translation/cli.js init es --name "Español"

# 2. Preview what will be translated
node experiences/aricanga/utils/translation/cli.js translate -l es --dry-run

# 3. Run LLM translation (use fake provider first to test)
node experiences/aricanga/utils/translation/cli.js translate -l es -p fake -o es-test.json

# 4. Review output for warnings
cat es-test.json | jq '.metadata.warnings'

# 5. Validate the translations
node experiences/aricanga/utils/translation/cli.js validate es-test.json

# 6. If validation passes, run with real provider
export ANTHROPIC_API_KEY=your-key
node experiences/aricanga/utils/translation/cli.js translate -l es -p anthropic -o es-translations.json

# 7. Import translations into locale files
node experiences/aricanga/utils/translation/cli.js import es-translations.json -l es --dry-run  # preview
node experiences/aricanga/utils/translation/cli.js import es-translations.json -l es            # apply

# 8. Build and test
mise run build
mise run dev  # Switch to Spanish in Settings to verify
```

### Validation and Error Handling

**What Gets Validated**

The `validate` command checks:

| Check | Description |
|-------|-------------|
| Placeholder preservation | `{name}`, `{count}` must appear in translation |
| Learning marker preservation | `((text::source))` markers must be intact |
| Length constraints | UI strings must fit within `maxLength` limits |
| Empty translations | Source with content shouldn't have empty translation |

**Validation Warnings in Output**

Translation output includes warnings for problematic items:

```json
{
  "metadata": {
    "warnings": 3
  },
  "strings": [
    {
      "id": "pat_chat.line_25",
      "source": "Hey {name}, check this out.",
      "translation": "Hola, mira esto.",
      "warnings": [
        { "type": "missing_placeholder", "message": "Missing placeholder: {name}" }
      ]
    }
  ]
}
```

**Error Types**

| Error | Cause | Fix |
|-------|-------|-----|
| `missing_placeholder` | `{var}` not in translation | Re-translate or manually add |
| `extra_placeholder` | Translation has `{var}` not in source | Remove spurious placeholder |
| `missing_marker` | `((text::source))` not preserved | Re-translate |
| `empty_translation` | Non-empty source got empty translation | Re-translate |
| `exceeds_maxLength` | UI string too long | Shorten translation |

**Handling Batch Failures**

If a batch fails during translation:
- The error is logged to stderr
- Processing continues with remaining batches
- Failed items won't appear in output
- Re-run with `--scope` to retry specific content types

```bash
# Retry only ink content if config succeeded
node experiences/aricanga/utils/translation/cli.js translate -l es -p anthropic --scope ink
```

**Dry Run for Debugging**

Use `--dry-run` to see exactly what would be sent without calling the API:

```bash
node experiences/aricanga/utils/translation/cli.js translate -l fr --dry-run
```

Output shows:
- Provider and model
- Total batch count
- Sample of first batch items with context

### Output Formats

The extract command supports three formats:

**Prompt Format** (default) - For LLM/manual translation:
```bash
mise run tl -l fr -f prompt
```
Outputs markdown with JSON block that can be copy-pasted to ChatGPT or similar.

**JSON Format** - For API integration:
```bash
mise run tl -l fr -f json -o fr.json
```

**XLIFF Format** - For Crowdin (experimental):
```bash
mise run tl -l fr -f xliff -o fr.xliff
```

### Locale Rules Files

Each locale has a `*.rules.toml` file containing linguistic metadata:

```toml
# experiences/{impl}/data/locales/fr.rules.toml
[meta]
direction = "ltr"
text_expansion = 1.2  # French ~20% longer than English

[plurals]
forms = ["one", "other"]

[gender]
has_grammatical_gender = true

[formality]
has_formal_informal = true
```

These files help translators understand language-specific requirements.

### Validate Command

The validate command checks translation files for errors before import:

```bash
# Validate a translation file
node experiences/aricanga/utils/translation/cli.js validate translations.json

# Check specific validations
node experiences/aricanga/utils/translation/cli.js validate translations.json --variables   # placeholder check only
node experiences/aricanga/utils/translation/cli.js validate translations.json --length      # length constraints only
```

**Example output:**

```
Validating 134 translations...

ERRORS (3):
  pat_chat.line_25: Missing placeholder: {name}
  config.ui.hub.title: Exceeds maxLength 20 (got 28): "Conversaciones Recientes"
  activist_chat.line_12: Missing learning marker: ((Capitol::building))

Validation FAILED: 3 errors found
```

Fix errors and re-validate until passing, then import.

### Troubleshooting

**Problem: "Missing API key" error**

```bash
Error: Missing ANTHROPIC_API_KEY environment variable
```

**Solution:** Export the API key before running:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic
```

---

**Problem: Translations have wrong tone/style**

**Solution:** Check character voices in `experiences/{impl}/data/locales/en.rules.toml`:
```toml
[style_guide.characters]
pat = "Mentor figure. Direct but supportive."  # Adjust as needed
```

---

**Problem: Proper nouns getting translated**

**Solution:** Add to `experiences/{impl}/data/glossary.toml`:
```toml
[[terms]]
term = "Aricanga"
action = "preserve"
note = "Company name - never translate"
```

---

**Problem: Batch failures partway through**

**Solution:** Check stderr for error details, then retry specific scope:
```bash
# Retry just ink content
node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic --scope ink

# Or reduce batch size for rate limiting
node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic --batch 10
```

---

**Problem: Validation warnings but translations look correct**

Warnings for ink flow keywords like `{not}`, `{and}`, `{or}` can be ignored - they're ink logic, not placeholders. The validator excludes common flow keywords but may flag unusual ones.

---

**Problem: Want to test without using API quota**

**Solution:** Use the `fake` provider:
```bash
node experiences/aricanga/utils/translation/cli.js translate -l fr -p fake -o test.json
```

The fake provider adds `[locale]` markers to words (e.g., "Hello" → "Hello[fr]") while preserving placeholders and markers. Useful for testing the full pipeline.

### Iterative Translation Workflow

Translation is rarely one-shot. The CLI supports iterative workflows with state tracking.

**State Tracking**

The system maintains state in `experiences/aricanga/utils/translation/.state/{locale}.json`:

```json
{
  "locale": "fr",
  "lastExtract": "2026-01-17T10:30:00Z",
  "strings": {
    "pat_chat.line_25": {
      "sourceHash": "a1b2c3d4",
      "source": "Hey, got your message.",
      "status": "translated"
    }
  }
}
```

- `sourceHash`: Detects when source text changes
- `status`: `"new"` or `"translated"`

**Incremental Extraction**

Only extract new or changed strings:

```bash
# Full extraction (all strings)
node experiences/aricanga/utils/translation/cli.js extract -l fr -f json

# Incremental (only new/changed)
node experiences/aricanga/utils/translation/cli.js extract -l fr -f json --incremental
# Output: "Incremental: 12 new/changed strings"
```

**Typical Iteration Cycle**

```bash
# 1. Initial full translation
node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic -o fr-v1.json
node experiences/aricanga/utils/translation/cli.js import fr-v1.json -l fr

# 2. Author adds new content to ink files...

# 3. Extract only new strings
node experiences/aricanga/utils/translation/cli.js extract -l fr --incremental -o fr-new.json

# 4. Translate just the new content
node experiences/aricanga/utils/translation/cli.js translate -l fr -p anthropic --incremental -o fr-v2.json

# 5. Import updates
node experiences/aricanga/utils/translation/cli.js import fr-v2.json -l fr
```

**Review and Fix Cycle**

For quality review, export, fix manually, and re-import:

```bash
# 1. Export current translations for review
node experiences/aricanga/utils/translation/cli.js extract -l fr -f json -o review.json

# 2. Edit review.json manually (fix tone, terminology, etc.)

# 3. Validate fixes
node experiences/aricanga/utils/translation/cli.js validate review.json

# 4. Import fixes
node experiences/aricanga/utils/translation/cli.js import review.json -l fr
```

**Handling Source Changes**

When English source text changes, `--incremental` automatically includes it:

```bash
# Shows changed strings even if previously translated
node experiences/aricanga/utils/translation/cli.js extract -l fr --incremental
# "activist_chat.line_25: source changed (hash mismatch)"
```

## Known Limitations

LLM translation has inherent limitations. Understanding these helps set expectations and plan for manual review.

### Non-Linear Narrative Context

**Problem:** Ink narratives are non-linear. The "preceding lines" sent for context may not be what the player actually saw - they could have arrived via a different branch.

```ink
=== meeting ===
+ [Ask about the documents] -> documents_path
+ [Ask about the timeline] -> timeline_path

= documents_path
"The documents show irregular payments."  // Context: player asked about documents

= timeline_path
"The timeline shows irregular payments."  // Context: player asked about timeline
```

Both lines get the same preceding context during extraction, but the actual player experience differs.

**Mitigation:**
- Use `# scene:` tags to provide explicit context
- Keep conversation branches self-contained
- Review translations in-game, not just in files

### Character Voice Consistency

**Problem:** Character voice descriptions are brief. The LLM may not maintain consistent voice across a long conversation or across translation sessions.

**Mitigation:**
- Keep voice descriptions specific: "Short sentences. Never uses contractions." not "Terse."
- Translate conversations in larger batches (increase `--batch` size)
- Review character-specific strings together

### Glossary Exact Matching

**Problem:** The glossary only matches exact terms. Variations aren't caught:

```toml
[[terms]]
term = "Ministry of Natural Resources"
action = "translate_as"
fr = "Ministère des Ressources Naturelles"
```

This won't match "the Ministry" or "Ministry's report" - only the exact phrase.

**Mitigation:**
- Add common variations as separate glossary entries
- Use manual review for critical terminology
- Consider post-processing scripts for systematic replacements

### Gendered Language

**Problem:** Languages like French, Spanish, and German have grammatical gender. The LLM may guess wrong or be inconsistent:

```
English: "The journalist wrote their article."
French: "Le/La journaliste a écrit son article."  // Gender depends on journalist
```

**Mitigation:**
- Use `# speaker:` tags consistently so the LLM knows who's speaking
- For player-character text, use the `{player_gender}` conditional in ink
- Review gendered terms manually in gendered languages

### Placeholder Positioning

**Problem:** Placeholder position may need to change for natural word order, but the LLM might keep English ordering:

```
English: "You have {count} new messages"
German: "Sie haben {count} neue Nachrichten"  // OK
German: "Neue Nachrichten: {count}"           // Also valid, but LLM may not do this
```

**Mitigation:**
- Review translations for natural word order
- The validator only checks placeholder presence, not position

### Context Window Limits

**Problem:** Very long conversations may exceed the LLM's effective context. Strings near the end of large batches may get less attention.

**Mitigation:**
- Use reasonable batch sizes (20-30 strings)
- Conversation-aware batching helps (keeps related strings together)
- Critical strings can be translated individually with more context

### Idioms and Cultural References

**Problem:** English idioms may be translated literally or awkwardly:

```
English: "That's a tough nut to crack."
French (literal): "C'est une noix difficile à casser."  // Wrong
French (correct): "C'est un problème épineux."         // Idiomatic
```

**Mitigation:**
- Flag idioms in source with comments (won't help LLM but helps reviewers)
- Review dialogue-heavy sections manually
- Consider cultural adaptation, not just translation

### When to Use Human Review

Given these limitations, prioritize human review for:

1. **Character-defining dialogue** - First impressions, emotional moments
2. **Critical plot points** - Revelations, endings
3. **Humor and wordplay** - Rarely translates well automatically
4. **UI strings** - High visibility, needs to fit space constraints
5. **Culturally sensitive content** - May need adaptation, not translation

For background dialogue and routine exchanges, LLM translation with validation is usually sufficient.

## Translation Platforms

The translation CLI can export to formats compatible with crowdsourcing platforms:

```bash
# For Crowdin/Transifex (XLIFF 2.0)
mise run tl -l fr -f xliff -o fr.xliff
```

Supported platforms:
- Crowdin (via XLIFF export)
- Transifex (via XLIFF export)
- Weblate (via JSON export)

## RTL Language Support

RTL (right-to-left) languages like Arabic and Hebrew are not currently implemented. For technical documentation on what would be needed to support RTL, see the [i18n Developer Guide](../developers/i18n.md#rtl-language-considerations).

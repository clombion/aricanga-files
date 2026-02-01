# Adding Localization

Translate your story into additional languages.

**Prerequisites:** [Adding a Character](./adding-a-character.md)

---

## What You'll Learn

- Creating locale-specific ink files
- Translating UI strings in TOML
- Using the `name()` function for entity names
- Building and testing multiple locales

---

## File Structure

Each locale has its own directory:

```
experiences/aricanga/
├── ink/
│   ├── variables.ink          # Shared (no translation needed)
│   ├── en/
│   │   ├── main.en.ink        # English entry point
│   │   └── chats/
│   │       ├── pat.en.ink
│   │       └── news.en.ink
│   └── fr/
│       ├── main.fr.ink        # French entry point
│       └── chats/
│           ├── pat.fr.ink
│           └── news.fr.ink
└── data/
    └── locales/
        ├── en.toml            # English UI strings
        └── fr.toml            # French UI strings
```

---

## Step 1: Create the Locale Directory

```bash
mkdir -p experiences/aricanga/ink/fr/chats
```

---

## Step 2: Copy and Translate the Main Entry

Copy the English main file:

```bash
cp experiences/aricanga/ink/en/main.en.ink experiences/aricanga/ink/fr/main.fr.ink
```

Update the INCLUDEs to point to French files:

```ink
// main.fr.ink
INCLUDE ../variables.ink
INCLUDE chats/news.fr.ink
INCLUDE chats/pat.fr.ink
// ... other chats
```

Note: `variables.ink` is shared - it stays at the parent level.

---

## Step 3: Translate a Chat File

Copy and translate each chat file:

```bash
cp experiences/aricanga/ink/en/chats/pat.en.ink experiences/aricanga/ink/fr/chats/pat.fr.ink
```

Translate the dialogue:

```ink
// pat.fr.ink - French translation
// Pat (Rédacteur) - Votre chef au Chronicle

=== pat_chat ===
~ current_chat = "pat"

{pat_chat == 1:
    # date:-1
    # type:received
    # speaker:Pat
    # time:Hier
    Bon travail sur l'article du port

    ~ delay_next(0)
    # type:sent
    # time:Hier
    Merci ! La source a livré au dernier moment

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Hier
    C'est le métier. Continue comme ça
}

# story_start
// ... rest of translated content
```

**Keep unchanged:**
- Knot and stitch names (`pat_chat`, `ask_angle`)
- Variable names (`current_chat`)
- Tag keys (`# speaker:`, `# type:`, `# time:`)
- Logic and routing (`->`, `~`, `{}`)

**Translate:**
- Dialogue text
- Choice button labels `[text]`
- Time display values (`Yesterday` → `Hier`)
- Comments (optional but helpful)

---

## Step 4: Translate UI Strings

Copy the English TOML:

```bash
cp experiences/aricanga/data/locales/en.toml experiences/aricanga/data/locales/fr.toml
```

Translate the values:

```toml
# fr.toml - French locale

[app]
name = "Civichat"
game_title = "Capital Chronicle"

[ui.hub]
pinned = "Épinglés"
chats = "Conversations"
tap_to_open = "Appuyez pour ouvrir"
search = "Rechercher"

[ui.status]
online = "en ligne"
offline = "hors ligne"
last_seen = "vu à {time}"
typing = "{name} écrit"

[ui.dates]
today = "Aujourd'hui"
yesterday = "Hier"

[characters.pat]
display_name = "Pat (Rédacteur)"
description = "Votre rédacteur en chef au Capital Chronicle"
```

---

## Step 5: Using the name() Function

For entity names that appear in multiple places, use the `name()` function:

```ink
// Instead of hardcoding:
BREAKING: Aricanga Corp announces mining deal.

// Use:
BREAKING: {name("aricanga", "name")} announces mining deal.
```

Entity names are defined in `config.toml`:

```toml
[[entities]]
id = "aricanga"
name = "Aricanga Corp"
short = "Aricanga"
alt = "the company"

[[entities]]
id = "ministry"
name = "Ministry of Natural Resources"
short = "the Ministry"
alt = "Ministry of Resources"
reference = "the ministry"
```

This lets you:
- Change names in one place
- Use different forms (full name, short, reference)
- Support locale-specific entity names if needed

---

## Step 6: Build All Locales

```bash
IMPL=aricanga mise run build
```

The build compiles all locale directories found in `ink/`.

Expected output:
```
Building all locales...
✓ en: Compiled story.json
✓ fr: Compiled story.json
```

---

## Step 7: Test the Translation

Start the server and add `?lang=fr` to test French:

```
http://localhost:8000/experiences/aricanga/?lang=fr
```

Or change the language in the settings menu if implemented.

---

## Translation Tips

### Keep Tags Consistent

Tags must stay in English - they're code, not content:

```ink
// Correct
# speaker:Pat
# type:received
# time:Hier

// Wrong - don't translate tag keys
# locuteur:Pat
# type:reçu
```

### Handle Pluralization

For strings with counts, use TOML's plural forms:

```toml
[ui.plural]
notification_one = "notification"
notification_other = "notifications"
```

French:
```toml
[ui.plural]
notification_one = "notification"
notification_other = "notifications"
```

### Interpolation Variables

Keep `{variable}` placeholders - the code fills them in:

```toml
# English
typing = "{name} is typing"

# French
typing = "{name} écrit"
```

### Date/Time Localization

Time tags in ink are display strings. Translate them directly:

```ink
// English
# time:Yesterday
# time:9:15 AM

// French
# time:Hier
# time:9h15
```

---

## Adding a New Locale

1. Create directory: `ink/{locale}/chats/`
2. Copy and translate `main.{locale}.ink`
3. Copy and translate each chat file
4. Copy and translate `locales/{locale}.toml`
5. Run `mise run build`

---

## Checklist

- [ ] Directory structure matches English
- [ ] `main.{locale}.ink` INCLUDEs point to correct locale files
- [ ] `variables.ink` is shared (not duplicated)
- [ ] All dialogue text translated
- [ ] Tags remain in English
- [ ] UI strings in TOML translated
- [ ] Build succeeds for all locales
- [ ] Tested with `?lang={locale}`

---

## What's Next?

- [Writing Guide](../guides/writers/writing-guide.md) - Complete syntax reference
- [Localization Guide](../guides/writers/localization.md) - Advanced patterns

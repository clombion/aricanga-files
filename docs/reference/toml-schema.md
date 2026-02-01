# TOML Schema Reference

Complete inventory of all configuration parameters.

---

## Overview

Configuration is split across multiple TOML files:

| File | Purpose | Translatable? |
|------|---------|---------------|
| `base-config.toml` | Technical config, character IDs | No |
| `locales/{lang}.toml` | UI strings, display names, glossary terms | Yes |
| `locales/{lang}.rules.toml` | Linguistic metadata | No |
| `glossary.toml` | Translation-preserved terms (for translation CLI) | Partial |
| `glossary-terms.toml` | In-game glossary base data (IDs, categories) | No |
| `data-queries.toml` | External data sources | No |

---

## base-config.toml

Non-translatable configuration.

### [game]

Game metadata.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `title` | string | required | Game title |
| `version` | string | required | Semantic version |

```toml
[game]
title = "Capital Chronicle"
version = "0.1.0"
```

### [i18n]

Internationalization settings.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `default_locale` | string | `"en"` | Fallback locale |
| `available_locales` | string[] | required | Enabled locales |

```toml
[i18n]
default_locale = "en"
available_locales = ["en", "fr"]
```

### [i18n.locale_names]

Display names for language selector.

```toml
[i18n.locale_names]
en = "English"
fr = "Français"
```

### [i18n.ink_folders]

Ink folder paths per locale (relative to implementation directory).

```toml
[i18n.ink_folders]
en = "ink/en"
fr = "ink/fr"
```

### [app]

App & player profile configuration.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `profile_image_dir` | string | none | Directory to scan for profile images (relative to assets/) |
| `profile_images` | string[] | `[]` | Explicit profile image pool (paths relative to assets/) |
| `profile_image` | string | none | Single profile image path |
| `player_status` | string | none | Player status/bio shown on profile page |
| `player_email` | string | none | Player contact email shown on profile page |

Profile image config forms are mutually exclusive (checked in order): `profile_image_dir` > `profile_images` > `profile_image`.

```toml
[app]
# Scan directory for profile images (build resolves to sorted array)
profile_image_dir = "profile_images/optimized"

# Player status shown on profile page
player_status = "Senior reporter at the Capital Chronicle"
```

### [ui.timings]

Animation and interaction delays in milliseconds.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `notification_auto_hide` | int | 5000 | Popup visibility duration |
| `notification_stagger` | int | 1500 | Delay between stacked popups |
| `auto_save_interval` | int | 30000 | Progress save frequency |
| `message_group_threshold` | int | 60000 | Time before new message group |
| `focus_delay` | int | 100 | Delay before element focus |

```toml
[ui.timings]
notification_auto_hide = 5000
notification_stagger = 1500
auto_save_interval = 30000
message_group_threshold = 60000
focus_delay = 100
```

### [ui.dimensions]

Layout and sizing values in pixels.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `image_max_width` | int | 240 | Max image bubble width |

```toml
[ui.dimensions]
image_max_width = 240
```

### [ui.constraints.*]

Character limits for translation validation.

```toml
[ui.constraints.hub]
character_name = 20
character_status = 60

[ui.constraints.settings]
option_label = 30
section_title = 25

[ui.constraints.notifications]
title = 40
body = 100
```

### [ui.colors]

Theme color palette in hex format (#RRGGBB).

| Key | Description |
|-----|-------------|
| `bg` | App background |
| `surface` | Cards, inputs, elevated surfaces |
| `header` | Header backgrounds |
| `accent` | Primary action color, links |
| `accent_hover` | Accent hover state |
| `success` | Success states, online indicators |
| `danger` | Error states, destructive actions |
| `text` | Primary text |
| `text_muted` | Secondary text, labels |
| `text_secondary` | Tertiary text, hints |
| `bubble_sent_bg` | Sent message background |
| `bubble_sent_text` | Sent message text |
| `bubble_received_bg` | Received message background |
| `bubble_received_text` | Received message text |
| `highlight` | Learning highlights |
| `highlight_hover` | Highlight hover state |

```toml
[ui.colors]
bg = "#121216"
surface = "#1e1e24"
header = "#1a1a20"
accent = "#5b7cfa"
accent_hover = "#4a6ae8"
success = "#5dd879"
danger = "#f87171"
text = "#e8e8ed"
text_muted = "#71717a"
text_secondary = "#a1a1aa"
bubble_sent_bg = "#3b5998"
bubble_sent_text = "#ffffff"
bubble_received_bg = "#262630"
bubble_received_text = "#e8e8ed"
highlight = "#0ea5e9"
highlight_hover = "#0284c7"
```

### [ui.colors.opacity]

Transparency values (0-100).

| Key | Default | Description |
|-----|---------|-------------|
| `overlay` | 60 | Modal/drawer backdrops |
| `overlay_heavy` | 95 | Full overlays (lightbox) |
| `surface_glass` | 95 | Glassmorphism surfaces |
| `border_subtle` | 8 | Subtle divider lines |
| `border_normal` | 20 | Visible borders |
| `hover_light` | 10 | Light hover states |
| `hover_medium` | 15 | Medium hover states |
| `shadow` | 40 | Drop shadows |

```toml
[ui.colors.opacity]
overlay = 60
overlay_heavy = 95
surface_glass = 95
border_subtle = 8
border_normal = 20
hover_light = 10
hover_medium = 15
shadow = 40
```

### [ui.colors.glass]

Glass effect backgrounds for notification drawer tiles and cards. Values are rgba() strings.

| Key | Default | Description |
|-----|---------|-------------|
| `tile_bg` | `rgba(60, 60, 60, 0.7)` | Tile button background |
| `tile_hover` | `rgba(80, 80, 80, 0.9)` | Tile button hover |
| `card_bg` | `rgba(60, 60, 60, 0.9)` | Notification card background |
| `card_hover` | `rgba(80, 80, 80, 0.9)` | Notification card hover |
| `bar_bg` | `rgba(20, 20, 20, 0.5)` | Bottom bar background |

```toml
[ui.colors.glass]
tile_bg = "rgba(60, 60, 60, 0.7)"
tile_hover = "rgba(80, 80, 80, 0.9)"
card_bg = "rgba(60, 60, 60, 0.9)"
card_hover = "rgba(80, 80, 80, 0.9)"
bar_bg = "rgba(20, 20, 20, 0.5)"
```

### [start_state]

Initial phone state.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `current_time` | string | required | Initial phone time |
| `battery` | int | 100 | Initial battery % |
| `signal` | int | 4 | Initial signal bars |
| `internet` | string | `"wifi2"` | Internet type (wifi0-2, mobile0-5, airplane, none) |

```toml
[start_state]
current_time = "9:00 AM"
battery = 100
signal = 4
internet = "wifi2"
```

### [phone.capabilities]

What the phone can do.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `messaging` | bool | true | Can send messages |
| `voice_memos` | bool | true | Can record voice |
| `camera` | bool | false | Has camera |
| `web_browser` | bool | false | Has browser |
| `forward_messages` | bool | false | Can forward |

```toml
[phone.capabilities]
messaging = true
voice_memos = true
camera = false
web_browser = false
forward_messages = false
```

### [phone.apps]

Available apps in phone UI.

| Key | Type | Description |
|-----|------|-------------|
| `available` | string[] | List of app IDs |

```toml
[phone.apps]
available = ["messages", "notes"]
```

### [phone.behavior]

Simulation rules.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `low_battery_warning` | int | 20 | Warning threshold % |
| `critical_battery` | int | 5 | Critical threshold % |
| `battery_drain_per_hour` | float | 6.94 | Drain rate |
| `no_signal_queues_messages` | bool | true | Queue when no signal |
| `unstable_connection_delays` | bool | true | Add delays |
| `default_drift_minutes` | int | 1 | Time advance per message |

```toml
[phone.behavior]
low_battery_warning = 20
critical_battery = 5
battery_drain_per_hour = 6.94
no_signal_queues_messages = true
unstable_connection_delays = true
default_drift_minutes = 1
```

### [chat_types.*]

Chat type behavioral flags.

```toml
[chat_types.normal]
can_send = true

[chat_types.disappearing]
can_send = true

[chat_types.channel]
can_send = false
```

### [entities.*]

Fictional organizations, companies, places.

| Key | Type | Description |
|-----|------|-------------|
| `name` | string | Full formal name |
| `short` | string | Shortened casual form |
| `alt` | string | Alternative/nickname |
| `reference` | string | Without article |
| `context` | string | Background for LLM |
| `skip_localization` | bool | Keep same across locales |

```toml
[entities.companies.aricanga]
name = "Aricanga Corp"
short = "Aricanga"
alt = "Aricanga Mining"
context = "Fictional extractive mining company."

[entities.government.ministry]
name = "Ministry of Natural Resources"
short = "the Ministry"
reference = "Ministry"
skip_localization = true
context = "Generic national government body."
```

### [characters.*]

Character registry (non-translatable fields).

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `knot_name` | string | Yes | Ink knot entry point |
| `avatar_color_name` | string | No | Named color enum (see [Avatar System](conversation-system.md#avatar-system)) |
| `avatar_letter` | string | No | Manual initials override |
| `avatar_color` | string | No | Raw hex color override (#RRGGBB, legacy) |
| `avatar_image` | string | No | SVG/image avatar path |
| `pinned` | bool | No | Show in pinned section |
| `chat_type` | string | Yes | `normal`, `disappearing`, `channel` |
| `disappearing_duration` | string | No | Timer display (e.g., "24 hours") |
| `default_presence` | string | No | `online`, `offline` |
| `first_name` | string | No | For `name(id, "first_name")` |
| `last_name` | string | No | For `name(id, "last_name")` |
| `formal` | string | No | For `name(id, "formal")` |

```toml
[characters.pat]
knot_name = "pat_chat"
default_presence = "online"
pinned = true
chat_type = "normal"
first_name = "Pat"
# avatar_color_name = "blue"  # optional: override derived color
```

### [analytics]

Event logging configuration.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | bool | false | Master switch |
| `endpoint` | string | "" | Server URL (empty = local only) |

```toml
[analytics]
enabled = false
endpoint = ""

[analytics.retention]
max_age_days = 7
max_entries = 5000
```

---

## locales/{lang}.toml

Translatable strings.

### [app]

App branding.

| Key | Type | Description |
|-----|------|-------------|
| `name` | string | App name in UI |
| `game_title` | string | Full game title |

```toml
[app]
name = "Civichat"
game_title = "Capital Chronicle"
```

### [ui.*]

Interface strings by category.

```toml
[ui.hub]
pinned = "Pinned"
chats = "Chats"
tap_to_open = "Tap to open"
search = "Search"

[ui.drawer]
notifications = "Notifications"
clear_all = "Clear all"
no_notifications = "No new notifications"

[ui.tiles]
restart = "Restart"
glossary = "Glossary"
settings = "Settings"
about = "About"

[ui.settings]
title = "Settings"
language = "Language"
game_language = "Game language"
version = "Version"

[ui.dialog]
reset_title = "SYSTEM RESET"
reset_message = "This will wipe all story progress..."

[ui.status]
online = "online"
offline = "offline"
last_seen = "last seen {time}"
typing = "{name} is typing"

[ui.dates]
today = "Today"
yesterday = "Yesterday"

[ui.messages]
sent = "Sent"
delivered = "Delivered"
read = "Read"

[ui.a11y]
back_to_chat_list = "Back to chat list"
message_history = "Message history"
available_responses = "Available responses"
# ... more accessibility labels

[ui.plural]
notification_one = "notification"
notification_other = "notifications"
```

### [chat_types.*]

System messages for chat types.

| Key | Description | Placeholders |
|-----|-------------|--------------|
| `system_message` | Header message | `{duration}`, `{name}` |
| `input_placeholder` | Input hint | `{name}` |

```toml
[chat_types.normal]
system_message = "Some messages may not be visible..."

[chat_types.disappearing]
system_message = "Disappearing messages are on. Messages will be deleted after {duration}."

[chat_types.channel]
system_message = "This is the official channel of {name}."
input_placeholder = "Only {name} can send messages"
```

### [characters.*]

Character display information.

| Key | Type | Description |
|-----|------|-------------|
| `display_name` | string | Shown in UI |
| `description` | string | Chat list subtitle |
| `personality` | string | For consistency review |
| `story_role` | string | Narrative function |
| `knowledge` | string | What they know |

```toml
[characters.pat]
display_name = "Pat"
description = "Your editor at the Capital Chronicle"
personality = "Mentor figure. Direct but supportive."
story_role = "Assigns stories, provides guidance."
knowledge = "Aware of industry pressures."
```

### [glossary.terms.*]

In-game glossary term translations. Each term ID from `glossary-terms.toml` needs a matching entry.

| Key | Type | Description |
|-----|------|-------------|
| `term` | string | Display name shown in glossary |
| `definition` | string | Full definition text |

```toml
[glossary.terms.eiti]
term = "EITI"
definition = "The Extractive Industries Transparency Initiative..."

[glossary.terms.beneficial-ownership]
term = "Beneficial Ownership"
definition = "Information about the real people who ultimately own..."
```

---

## locales/{lang}.rules.toml

Linguistic metadata for translation.

```toml
[meta]
direction = "ltr"        # or "rtl"
text_expansion = 1.2     # French ~20% longer than English

[plurals]
forms = ["one", "other"]

[gender]
has_grammatical_gender = true

[formality]
has_formal_informal = true

[style_guide.characters]
pat = "Mentor figure. Direct but supportive."
spectre = "Cryptic, paranoid. Short sentences."
```

---

## glossary-terms.toml

Base configuration for the in-game glossary (non-translatable fields only).

**File:** `experiences/{impl}/data/glossary-terms.toml`

Translatable content (term, definition) goes in `locales/{lang}.toml` under `[glossary.terms.*]`.

### [[terms]]

Array of glossary term base data.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Unique identifier (used as i18n key) |
| `category` | string | Category for grouping (e.g., "governance", "finance") |

```toml
[[terms]]
id = "eiti"
category = "organizations"

[[terms]]
id = "beneficial-ownership"
category = "governance"

[[terms]]
id = "royalties"
category = "finance"
```

**Categories:** `organizations`, `governance`, `finance`, `legal`, `environment`, `industry`

---

## glossary.toml

Terms for consistent translation (used by translation CLI).

```toml
# Preserve unchanged
[[terms]]
term = "Aricanga"
action = "preserve"
note = "Fictional company name"

# Translate to specific values
[[terms]]
term = "Ministry of Natural Resources"
action = "translate_as"
fr = "Ministère des Ressources Naturelles"
es = "Ministerio de Recursos Naturales"
```

---

## data-queries.toml

External data queries that inject values into ink variables at startup.

**File:** `experiences/{impl}/data/data-queries.toml`

### Structure

Each section defines a variable to inject:

```toml
[variable_name]
source = "data_provider"     # Data source ID
query = "query_name"         # Query identifier
params = "query_params"      # Optional parameters
field = "field_name"         # Which field from response to use
description = "..."          # Documentation for writers
```

### Example

```toml
[data_median_revenue]
source = "eiti"
query = "revenue_statistics"
params = "mining_projects"
field = "median_annual_revenue"
description = "Median annual revenue from mining projects (EITI database)"

[data_sample_size]
source = "eiti"
query = "revenue_statistics"
params = "mining_projects"
field = "sample_size"
description = "Number of projects in EITI sample"
```

### How It Works

1. **Game startup:** `data-loader.js` fetches `data-queries.toml`
2. **For each query:** Calls `dataService.fetch(source, query, params)`
3. **Response processed:** Extracts the specified `field`
4. **Value formatted:** Numbers converted to human-readable (e.g., "180 million")
5. **Injected into ink:** Set as `story.variablesState[variable_name]`

### Using in Ink

Declare the variable in `variables.ink`:

```ink
VAR data_median_revenue = ""
```

Use in narrative:

```ink
EITI reports median revenue of {data_median_revenue} per year.
```

### Learning Highlights

Values are **not** auto-highlighted. Writers control highlighting:

```ink
// Manual highlight syntax
The median is ((180 million::eiti:median_revenue)).

// Or use the variable with manual wrapping
The median is (({data_median_revenue}::eiti:median_revenue)).
```

### Data Service

The `dataService` (`experiences/{impl}/services/data-service.js`) resolves queries. Add new sources:

```javascript
dataService.register('my_source', async (query, params) => {
  const response = await fetch(`/api/${query}?${params}`);
  return response.json();
});
```

### Validation

- Missing variables in ink: Warning logged, continues
- Failed fetches: Warning logged, variable stays empty
- Invalid TOML: Build fails

---

## Validation

The build validates:
- Color values are valid hex (#RRGGBB)
- Opacity values are 0-100
- Avatar images exist
- Character IDs match ink knots

Invalid configuration fails the build with descriptive errors.

---

## Generated Files

After `mise run build:config`:

| Output | From | Purpose |
|--------|------|---------|
| `experiences/{impl}/generated/config.js` | All TOML | Runtime config |
| `experiences/{impl}/css/generated/theme-vars.css` | `[ui.colors]` | CSS variables |
| `dist/locales/{lang}.json` | locale TOML | Runtime strings |

---

## Related

- [Theming Guide](../guides/developers/theming.md) - Visual customization
- [Adding a New Chat](../guides/developers/new-chat.md) - Character setup
- [Writing Guide](../guides/writers/writing-guide.md) - Using config in ink

# {{title}} - Base Configuration
# This file contains non-translatable settings
# Translatable strings go in locales/{{locale}}.toml

[game]
title = "{{title}}"
version = "0.1.0"

[i18n]
default_locale = "{{locale}}"
available_locales = ["{{locale}}"]

[i18n.locale_names]
{{locale}} = "{{localeName}}"

# Initial game state
[start_state]
time = "09:00"
day = 1
battery = 85
signal = 4

# Phone behavior settings
[phone.behavior]
battery_drain_per_hour = 3
low_battery_warning = 20
signal_check_interval = 30

# Analytics (disabled by default)
[analytics]
enabled = false
endpoint = ""

[analytics.retention]
max_age_days = 7
max_entries = 5000

# Chat types define behavior categories
[chat_types.normal]
can_send = true

[chat_types.broadcast]
can_send = false

# Characters - add your story's characters here
# Each character needs:
#   knot_name: The ink knot that handles this chat
#   chat_type: "normal" or "broadcast"

[characters.sample]
knot_name = "sample_chat"
chat_type = "normal"
default_presence = "online"

# UI timing settings (milliseconds)
[ui.timings]
notification_auto_hide = 5000
notification_stagger = 1500
auto_save_interval = 30000
message_group_threshold = 60000
focus_delay = 100

[ui.dimensions]
image_max_width = 240

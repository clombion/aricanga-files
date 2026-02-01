// Capital Chronicle - A Journalist's Story
// Main entry point

INCLUDE ../variables.ink
INCLUDE chats/news.en.ink
INCLUDE chats/pat.en.ink
INCLUDE chats/notes.en.ink
INCLUDE chats/spectre.en.ink
INCLUDE chats/activist.en.ink
INCLUDE chats/attache.en.ink

// External functions (implemented in JavaScript)
EXTERNAL delay_next(milliseconds)
EXTERNAL play_sound(sound_id)
EXTERNAL advance_day()
EXTERNAL request_data(source, query, params)

// Game starts at the hub
-> hub

=== hub ===
# view:hub
{hub == 1: -> game_init}
-> DONE

=== game_init ===
// First-time initialization - writer controls what happens at game start
~ current_chat = "news"
# story_start
# speaker:Gov News Wire
# type:received
# time:8:35 AM
OFFICIAL — {name("ministry", "name")} confirms 30-year mining partnership with {name("aricanga", "name")}. Full statement to follow.

// Pat checks in a few seconds after the wire
~ seen_announcement = true
~ delay_next(3000)
# targetChat:pat
# speaker:Pat
# type:received
# time:8:39 AM
# notificationPreview:Morning. How was the press conference?
Morning. How was the press conference?
-> hub

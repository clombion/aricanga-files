// Capital Chronicle - A Journalist's Story
// Main entry point

INCLUDE ../variables.ink
INCLUDE chats/news.fr.ink
INCLUDE chats/pat.fr.ink
INCLUDE chats/notes.fr.ink
INCLUDE chats/spectre.fr.ink
INCLUDE chats/activist.fr.ink
INCLUDE chats/attache.fr.ink

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
OFFICIEL — {name("ministry", "name")} confirme un partenariat minier de 30 ans avec {name("aricanga", "name")}. Communiqué complet à suivre.

// Pat vérifie quelques secondes après la dépêche
~ seen_announcement = true
~ delay_next(3000)
# targetChat:pat
# speaker:Pat
# type:received
# time:8:39 AM
# notificationPreview:Bonjour. Comment s'est passée la conférence de presse ?
Bonjour. Comment s'est passée la conférence de presse ?
-> hub

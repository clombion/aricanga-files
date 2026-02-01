// Jean-Marc Diallo - Press attaché, Ministry of Natural Resources

=== attache_chat ===
~ current_chat = "attache"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{attache_chat == 1:
    # type:received
    # speaker:Jean-Marc
    # time:Jan 20
    Good morning. Minister's office confirms budget hearing rescheduled to March 5. Updated schedule attached.

    ~ delay_next(0)
    # type:sent
    # time:Jan 20
    Thanks Jean-Marc. Any chance of a pre-briefing?

    ~ delay_next(0)
    # type:received
    # speaker:Jean-Marc
    # time:Jan 21
    I'll check with the Minister's office.

    ~ delay_next(0)
    # type:received
    # speaker:Jean-Marc
    # time:Feb 10
    Pre-briefing confirmed for March 4, 2pm. Usual room. I'll send the agenda closer to the date.

    ~ delay_next(0)
    # type:sent
    # time:Feb 10
    Perfect. I'll be there.

    ~ delay_next(0)
    # type:received
    # speaker:Jean-Marc
    # time:Mar 3
    Reminder: pre-briefing tomorrow at 2pm. Minister's office has asked attendees to hold questions on the {name("aricanga", "short")} partnership until the formal press conference on the 15th.
}

# story_start

// Gate: requires player to have agreed and seen announcement
{not player_agreed: -> DONE}
{not seen_announcement: -> DONE}

// Post-publish: Jean-Marc reacts to the article
{article_published and attache_chat > 1 and not attache_post_publish_done: -> attache_chat.post_publish}

// Only show main content once
{attache_chat > 1 and press_file_received: -> DONE}
{attache_chat > 1 and not press_file_received: -> attache_chat.press_file}

-> attache_chat.press_file

= press_file
// Connection switch: player arrives home, wifi kicks in
# status:internet:wifi2
# status:signal:3

~ arrived_home = true

// First message already sent via cross-chat from Pat's ask_angle
~ delay_next(600)
# speaker:Jean-Marc
# type:received
# attachment:/assets/docs/aricanga-press-kit.pdf
The file includes the full partnership terms, ((beneficial ownership::glossary:beneficial-ownership)) disclosures, and the Minister's prepared remarks.

~ delay_next(400)
# type:received
Let me know if you need anything else for your piece.

* [Thanks Jean-Marc. This is helpful.]
    # type:sent
    Thanks Jean-Marc. This is helpful. I'll reach out if I have follow-up questions.

    ~ press_file_received = true

    ~ delay_next(600)
    # speaker:Jean-Marc
    # type:received
    Of course. Good luck with the piece.
    -> DONE

* [Any chance the Minister would go on record with an additional quote?]
    # type:sent
    Any chance the Minister would go on record with an additional quote? Something beyond the prepared remarks.

    ~ press_file_received = true

    ~ delay_next(1500)
    # speaker:Jean-Marc
    # type:received
    I'll pass the request along, but I wouldn't count on it today. The Minister's schedule is full.

    ~ delay_next(800)
    # type:received
    If anything comes through, I'll send it over immediately.
    -> DONE

// Jean-Marc's positive reaction after article is published
// First message was sent cross-chat from pat.ink
= post_publish
~ attache_post_publish_done = true

~ delay_next(2000)
# speaker:Jean-Marc
# type:received
The Minister's office is happy with the coverage. Balanced, factual. That's all they want really.

~ delay_next(1800)
# type:received
Between us, there was some nervousness about how this would land. You made their job easier.

* [Glad to hear it. Just reported what was in the file.]
    # type:sent
    Glad to hear it. Just reported what was in the file.

    ~ delay_next(1200)
    # speaker:Jean-Marc
    # type:received
    Perfect.
    -> DONE

* [Thanks Jean-Marc. Any follow-up planned on your end with more details on the numbers?]
    # type:sent
    Thanks Jean-Marc. Any follow-up planned on your end with more details on the numbers?

    ~ delay_next(1500)
    # speaker:Jean-Marc
    # type:received
    Nothing scheduled yet. But I'll let you know if they put out anything new.
    -> DONE

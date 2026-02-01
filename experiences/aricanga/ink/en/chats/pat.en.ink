// Pat (Editor) - Your boss at the Chronicle

=== pat_chat ===
~ current_chat = "pat"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{pat_chat == 1:
    # date:-7
    # type:received
    # speaker:Pat
    # time:Feb 15
    Harbor expansion piece needs another 500 words. Desk wants more on the environmental permits.

    ~ delay_next(0)
    # type:sent
    # time:Feb 15
    On it. Source at the port authority is being cagey but I'll push.

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Feb 15
    Push harder. We buried the lede last time on the terminal funding.

    ~ delay_next(0)
    # date:-5
    # type:sent
    # time:Feb 22
    Harbor piece filed. Source came through — port authority confirmed the budget shortfall off the record.

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Feb 22
    Good turnaround. I'll clean up the quotes and get it to layout.

    ~ delay_next(0)
    # date:-3
    # type:received
    # speaker:Pat
    # time:Mar 1
    Got a tip about port authority budget allocations for the new terminal. Keep your ears open.

    ~ delay_next(0)
    # type:sent
    # time:Mar 1
    Will do. Any sense of timeline?

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Mar 1
    Source says next couple weeks. Don't chase it yet — just be ready.

    ~ delay_next(0)
    # date:-1
    # type:received
    # speaker:Pat
    # time:Mar 12
    Press conference tomorrow morning on the {name("aricanga", "short")} deal. Ministry's been tight-lipped. Go, take notes, see what they actually say.

    ~ delay_next(0)
    # type:sent
    # time:Mar 12
    I'll be there. Any background I should read up on?

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Mar 12
    Just the basics. 30-year concession, Northern Province. The desk needs a quick piece either way.
}

# story_start

// Route to appropriate state
{not seen_announcement:
    -> pat_chat.waiting
}

// Why: Only show angle prompt on first visit to this knot.
// The visit count guard (ask_angle == 0) prevents re-asking after
// player has already seen the choices but navigated away.
{seen_announcement and not player_agreed:
    {pat_chat.ask_angle == 0: -> pat_chat.ask_angle}
}

{player_agreed and not draft_sent:
    -> pat_chat.waiting_for_draft
}

{draft_sent and not article_published:
    -> pat_chat.publishing
}

{article_published:
    -> pat_chat.post_publish
}

-> pat_chat.idle

// Pat: Dormant until player sees announcement in News
= waiting
// No messages until player sees announcement
-> DONE

// Pat: Editor asks player to cover the story - choose approach
= ask_angle

{ask_angle > 1: -> choices}

# speaker:Pat
# type:received
# time:8:40 AM
Saw the wire. Minister went big — "historic investment," 12,000 jobs. Standard playbook.

~ delay_next(1200)
# speaker:Pat
# type:received
# label:pat-deadline
Need something for tonight's edition. What angle are you thinking?

- (choices)
* [Straightforward write-up. Waiting on the press file from the ministry comms office, should have it within the hour.]
    # type:sent
    # quoteRef:pat-deadline
    Straightforward write-up. Waiting on the press file from the ministry comms office, should have it within the hour.

    ~ player_agreed = true
    # targetChat:notes
    # type:sent
    # notificationPreview:New assignment: {name("aricanga", "short")} story
    New assignment from Pat: Cover the {name("aricanga", "short")} mining deal. Straightforward write-up for tonight's edition.

    ~ delay_next(600)
    # speaker:Pat
    # type:received
    Good. File by noon if you can. I'll hold page 3.

    ~ delay_next(400)
    # type:received
    And grab a quote from the ministry if you can. Even "no comment" is something.

    // Jean-Marc sends press file after player agrees
    ~ delay_next(2000)
    # targetChat:attache
    # speaker:Jean-Marc
    # type:received
    # notificationPreview:Press file from this morning's conference
    Good morning. As promised, here's the press file from this morning's conference.
    -> DONE

* [Something feels off about the numbers. But I'm still waiting on the press file — want to see what's actually in there first.]
    # type:sent
    Something feels off about the numbers. But I'm still waiting on the press file — want to see what's actually in there first.

    ~ delay_next(1500)
    # speaker:Pat
    # type:received
    I hear you, but we don't have runway for a deep dive right now.

    ~ delay_next(1000)
    # type:received
    Do the quick version today. If there's more there, we revisit next week.

    ~ delay_next(800)
    # type:received
    Port authority story's waiting in the wings anyway.

    ~ delay_next(1200)
    # type:sent
    Alright. I'll get the press file and make some calls.

    ~ player_agreed = true
    # targetChat:notes
    # type:sent
    # notificationPreview:New assignment: {name("aricanga", "short")} story
    New assignment from Pat: Cover the {name("aricanga", "short")} mining deal. Quick version for tonight — revisit later if needed.

    // Jean-Marc sends press file after player agrees
    ~ delay_next(2000)
    # targetChat:attache
    # speaker:Jean-Marc
    # type:received
    # notificationPreview:Press file from this morning's conference
    Good morning. As promised, here's the press file from this morning's conference.
    -> DONE

= waiting_for_draft
// Don't show draft option until Notes research is complete
{not research_complete: -> DONE}
// Guard: only show message on first visit, then jump to choice
{waiting_for_draft > 1: -> waiting_for_draft.choice}

# speaker:Pat
# type:received
# time:12:00 PM
How's that {name("aricanga", "short")} piece coming? Desk needs it soon.

- (choice)
* [Here's the draft]
    # type:sent
    # time:12:15 PM
    # attachment:/assets/docs/aricanga-draft-v1.docx
    Draft attached. Ministry's staying tight-lipped as usual.

    ~ draft_sent = true
    -> pat_chat.draft_confirmed

= draft_confirmed
// Pat responds after reviewing the draft (time jump to afternoon)
// Weather change: afternoon clouds roll in
~ delay_next(2500)
# status:weather:cloudy
# status:temperature:24°C

# speaker:Pat
# type:received
# time:1:30 PM
Good turnaround. Running it tonight, page 3.

~ delay_next(800)
# type:received
Take a break, then start on the port authority docs. They just came in.

// Prompt player to check notes
# targetChat:notes
# type:sent
# notificationPreview:Draft notes ready for review
Time to reflect on the {name("aricanga", "short")} piece before it goes live.
-> DONE

= publishing
~ article_published = true

# speaker:Pat
# type:received
# time:5:15 PM
Article's live. Already getting traction.

~ delay_next(1000)
# type:received
Good turnaround on a tight deadline.

// Reactions arrive after a delay (simulates others seeing the published article)
~ delay_next(4000)

// Trigger Spectre (always) - this is the first message of spectre_chat.first_contact
# targetChat:spectre
# speaker:TonyGov
# type:received
# time:5:30 PM
# presence:online
# notificationPreview:Read your piece on the {name("aricanga", "short")} deal.
Read your piece on the {name("aricanga", "short")} deal.

// Trigger Activist - always (responded if asked, disappointed if not)
// This is the first message when opening activist chat post-publication
# targetChat:activist
# speaker:{name("activist", "first_name")}
# type:received
# time:5:35 PM
# notificationPreview:I saw your article...
I saw your article about {name("aricanga", "short")}.
{activist_comment_requested:
    ~ activist_responded = true
}

// Trigger Attaché - positive reaction to article
~ delay_next(5000)
# targetChat:attache
# speaker:Jean-Marc
# type:received
# time:5:40 PM
# notificationPreview:Saw your piece just now.
Saw your piece just now. Well written.
-> DONE

= post_publish
# speaker:Pat
# type:received
# time:5:45 PM
Port authority docs are in your inbox. Budget allocations for the new terminal.

~ delay_next(600)
# type:received
Let me know once you've had a look. Could be something there.
-> DONE

= idle
-> DONE

// Maria Santos - Community advocate
// Tracks extractive industry deals, articulate organizer tone

=== activist_chat ===
~ current_chat = "activist"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{activist_chat == 1:
    # type:received
    # speaker:Maria
    # time:Jul 15
    Good to finally connect. Heard you covered the harbor expansion story.

    ~ delay_next(0)
    # type:sent
    # time:Jul 15
    Yeah, tough getting sources on that one. You involved with the coalition?

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Jul 15
    Loosely. We're tracking all the extractive industry deals in the region. The harbor expansion has implications for the communities along the coast.

    ~ delay_next(0)
    # type:sent
    # time:Jul 16
    I'd be interested in that perspective. Most of what I hear comes from the port authority side.

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Jul 16
    That's the problem. The communities affected are rarely consulted in the first place. Let me know if you ever need background on any of these deals.

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Aug 20
    # linkUrl:globalwitness.org/en/
    # linkDomain:globalwitness.org
    # linkTitle:Global Witness
    # linkDesc:We expose how the industries fuelling the climate crisis profit from destruction, and stand with the people fighting back
    # linkImage:assets/global-witness-logo.png
    # linkLayout:card
    Reading the latest exposé from Global Witness. Same patterns we're seeing here — rushed assessments, opaque ownership structures. Worth a look.

    ~ delay_next(0)
    # type:sent
    # time:Aug 20
    Thanks for sharing. I'll read through it.

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Sep 5
    Community meeting yesterday about the Northern Province proposals. Sixty people showed up. People are paying attention.

    ~ delay_next(0)
    # type:sent
    # time:Sep 5
    That's a strong turnout. Any key takeaways?

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Sep 5
    Main concern is land rights. The concession maps overlap with three villages and customary farmland. Nobody's been formally notified.
}

# story_start

// Route to appropriate state based on flags

// Why: Handle post-publication regret path. If player published without asking
// Maria for comment, check if they HAD the option (unlocked via Notes research).
// Different responses based on whether opportunity was available but missed.
{article_published and not activist_comment_requested:
    {can_request_activist_comment:
        -> activist_chat.missed_with_note
    }
    -> activist_chat.missed_without_note
}

{not can_request_activist_comment:
    -> activist_chat.dormant
}

{can_request_activist_comment and not activist_comment_requested:
    -> activist_chat.can_ask
}

{activist_comment_requested and not activist_responded:
    -> activist_chat.waiting
}

{activist_responded:
    -> activist_chat.post_publication
}

-> activist_chat.dormant

= dormant
// No new content - just show seed messages from config
-> DONE

= can_ask
// Player has unlocked ability to request comment (via Notes brainstorm)
# type:system
You can ask {name("activist", "first_name")} about {name("aricanga", "alt")}.

* [Ask about {name("aricanga", "alt")}]
    # type:sent
    # time:10:15 AM
    Hey {name("activist", "first_name")}, quick question. You know anything about {name("aricanga", "alt")}? There's a formal announcement out this morning.

    ~ activist_comment_requested = true

    ~ delay_next(2000)
    # speaker:Maria
    # type:received

    ~ delay_next(2500)
    # type:received
    {name("aricanga", "short")}? Yes, they've been on our radar for a while.

    ~ delay_next(1500)
    # type:received
    Their environmental assessments in the southern provinces were incomplete at best. The coalition has been tracking it since they got the ((mining license::glossary:mining-license)).

    ~ delay_next(2000)
    # type:received
    I can look into the specifics if you need. What's your timeline?

    // Why: Two-level choice structure (nested * *) gives player nuanced control.
    // First level asks Maria, second level determines urgency/tone of request.
    // This affects Maria's response - rushed request gets less help.
    * * [Need it fast - publishing today]
        # type:sent
        Publishing today, unfortunately. Whatever you can find quickly.

        ~ delay_next(1500)
        # speaker:Maria
        # type:received
        That's very short notice.

        ~ delay_next(1200)
        # type:received
        I'll see what I can pull together, but I can't promise much on that timeline.

        ~ delay_next(800)
        # type:received
        The community deserves a proper voice in these stories.

        -> DONE

    * * [Just background for now]
        # type:sent
        Just background for now. Off the record context.

        ~ delay_next(1800)
        # speaker:Maria
        # type:received
        The coalition has been tracking their operations since the ((mining license::glossary:mining-license)) was granted.

        ~ delay_next(1500)
        # type:received
        Undercounted emissions, questionable labor practices. ((Offshore registrations::glossary:offshore-company)) layered through three jurisdictions.

        ~ delay_next(1200)
        # type:received
        But proving it requires access we don't have yet.

        -> DONE

* [(Not now)]
    -> DONE

= missed_with_note
// Player wrote a note to ask Maria but forgot in the rush
// First message was sent cross-chat from pat.ink ("I saw your article about...")
# speaker:Maria
# type:received
~ delay_next(1500)
I'm disappointed you didn't reach out to us for comment.

~ delay_next(1500)
# type:received
The communities affected deserve a voice in these stories.

* [Sorry - I wrote it down but forgot in the rush]
    # type:sent
    I'm sorry. I actually wrote a note to reach out to you but got swept up in the deadline.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    I appreciate you saying that. Next time, please make it a priority.
    -> DONE

* [My bad - that's on me to do better]
    # type:sent
    You're right. That's completely on me. I need to do better.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    I appreciate that. The door is open for a follow-up piece.
    -> DONE

= missed_without_note
// Player never considered reaching out to Maria
// First message was sent cross-chat from pat.ink ("I saw your article about...")
# speaker:Maria
# type:received
~ delay_next(1500)
I'm disappointed you didn't reach out to us for comment.

~ delay_next(1500)
# type:received
The communities affected deserve a voice in these stories.

* [I didn't realize - I'll do better next time]
    # type:sent
    I didn't think to reach out. I'll make sure to include community voices next time.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    Thank you. We're always willing to help journalists tell the full story.
    -> DONE

* [The deadline was tight]
    # type:sent
    The deadline was really tight. I had to go with what I had.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    Tight deadlines often benefit those with resources to respond quickly.

    ~ delay_next(1000)
    # type:received
    Community groups don't have press offices standing by.
    -> DONE

= waiting
// Activist is researching but won't have substantive response until after publication
# speaker:Maria
# type:received
# time:11:30 AM
Still looking into {name("aricanga", "short")}. Their corporate structure is layered.

~ delay_next(1000)
# type:received
Multiple subsidiaries. ((Offshore registrations::glossary:offshore-company)). It takes time to trace.

~ delay_next(800)
# type:received
I'll have more soon.

-> DONE

= post_publication
// Professionally frustrated response - disappointed but still helpful
// First message was sent cross-chat from pat.ink ("I saw your article about...")
# speaker:Maria
# type:received
~ delay_next(2000)
I understand deadline pressures, but I have to be direct with you.

~ delay_next(2500)
# type:received
The community groups affected by this deal weren't given adequate time to respond.

~ delay_next(2000)
# type:received
Your piece is missing crucial context about the environmental assessments that were never properly completed.

~ delay_next(1500)
# type:received
I'm not blaming you personally. I know how newsrooms work.

~ delay_next(2000)
# type:received
But these are real communities. Real people who will be affected.

* [I'm sorry - what did I miss?]
    # type:sent
    I'm sorry. What specifically did I miss?

    ~ delay_next(2500)
    # speaker:Maria
    # type:received
    The "historic investment" framing came straight from the ministry press release.

    ~ delay_next(1500)
    # type:received
    No mention of the incomplete environmental reviews. No mention of the land disputes.

    ~ delay_next(2000)
    # type:received
    I have documentation on the ((extractives transparency::glossary:transparency)) gaps. If you're willing to do a follow-up piece, I can help.

    ~ delay_next(1200)
    # type:received
    But next time, please give us more than a few hours.

    -> DONE

* [I had to go with what I had]
    # type:sent
    I had to go with what I had. The deadline was tight.

    ~ delay_next(2000)
    # speaker:Maria
    # type:received
    I understand. But tight deadlines often serve those with resources to respond quickly.

    ~ delay_next(1800)
    # type:received
    Community groups don't have press offices standing by.

    ~ delay_next(1500)
    # type:received
    The door is open if you want to tell the full story later.

    -> DONE

* [(Read later)]
    -> DONE

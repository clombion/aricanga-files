// Spectre - Government insider, frustrated bureaucrat

=== spectre_chat ===
~ current_chat = "spectre"

// No seed messages - Spectre hasn't contacted player yet
# story_start

{not article_published:
    -> spectre_chat.silent
}

{article_published and not spectre_contacted:
    -> spectre_chat.first_contact
}

{spectre_contacted and agreed_to_meet:
    -> spectre_chat.follow_up_agreed
}

{spectre_contacted and not agreed_to_meet:
    -> spectre_chat.follow_up_declined
}

-> spectre_chat.silent

// Spectre: Dormant state before player publishes article
= silent
// System message now comes from config (chat_type: disappearing)
-> DONE

// Spectre: Initial contact after article published - challenges player's journalism
// First message was sent cross-chat from pat.ink
= first_contact
~ spectre_contacted = true

~ delay_next(2000)
# type:received
I think they rushed the ((environmental assessment::glossary:environmental-assessment)) on this one. Probably trying to lock in terms before the investors got cold feet.

~ delay_next(2500)
# type:received
The revenue projections looked off to me. I've seen the kind of numbers they use for comparable concessions and these don't add up.

* [Yeah I had the same feeling. Couldn't dig deeper on deadline though.]
    # type:sent
    Yeah I had the same feeling. Couldn't dig deeper on deadline though.

    ~ delay_next(2000)
    # speaker:TonyGov
    # type:received
    I might be able to get the original technical assessment. The one that got submitted before the Ministry revised everything.

    ~ delay_next(1500)
    # type:received
    No promises, but I'll see what I can find.

    ~ agreed_to_meet = true
    -> DONE

* [Didn't have time to get into all that. Ran what we had.]
    # type:sent
    Didn't have time to get into all that. Ran what we had.

    ~ delay_next(2500)
    # speaker:TonyGov
    # type:received
    Fair enough. Just saying, the ((EITI::glossary:eiti)) compliance report has been delayed twice now. Might be worth a look at some point.

    ~ delay_next(800)
    # presence:offline
    -> DONE

* [(Ignore)]
    -> DONE

// Spectre: Player agreed - sends document hints
= follow_up_agreed
# speaker:TonyGov
# type:received
# time:6:00 PM
Ok so I asked around. I think I can get a copy of the original technical assessment, the one before it got cleaned up.

~ delay_next(1200)
# type:received
Give me a day or two.

~ delay_next(600)
# presence:offline
-> DONE

// Spectre: Player declined - one more chance offered
= follow_up_declined
# speaker:TonyGov
# type:received
# time:6:00 PM
# presence:online
The compliance framework exists for a reason. When you're ready to understand why it was bypassed, reach out.

~ delay_next(800)
# presence:offline
-> DONE

// My Notes - Personal voice memos, reminders, and research

=== notes_chat ===
~ current_chat = "notes"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{notes_chat == 1:
    # type:sent
    # time:Mar 1
    Port authority tip from Pat — check budget allocations for new terminal. Source says next couple weeks.

    ~ delay_next(0)
    # type:sent
    # time:Mar 4
    Ministry contact: ext 4421

    ~ delay_next(0)
    # type:sent
    # time:Mar 8
    # linkUrl:resourcegovernance.org
    # linkDomain:resourcegovernance.org
    # linkTitle:Natural Resource Governance Institute
    # linkDesc:Data and analysis on oil, gas, and mineral governance worldwide
    # linkLayout:minimal
    Bookmarking this for the extractives beat. Good baseline data.

    ~ delay_next(0)
    # type:sent
    # time:Mar 10
    Finished the harbor expansion follow-up. Pat's happy with it. Port authority contact might be useful again for the terminal story.

    ~ delay_next(0)
    # type:sent
    # time:Mar 12
    Press conference tomorrow morning — {name("aricanga", "short")} deal. Review background notes tonight.
}

# story_start

{not player_agreed:
    -> notes_chat.empty
}

{player_agreed and not research_complete:
    -> notes_chat.research_phase
}

{research_complete and draft_sent:
    -> notes_chat.ready_to_write
}

// No fallthrough to empty - only show "No notes yet" if explicitly routed there
-> DONE

= empty
# type:system
No notes yet.
-> DONE

= research_phase
~ research_started = true

// Voice memo - quick capture of the assignment, references press conference
# type:sent
# audio:/assets/audio/memo-001.m4a
# duration:0:08
# time:9:15 AM
Just got back from the press conference. Pat wants the {name("aricanga", "short")} piece for tonight. Standard coverage — pull from the press file Jean-Marc sent, get a comment from {name("ministry", "short")} if I can.

// Note about checking for useful data
~ delay_next(1000)
# type:sent
Should also check if there's useful data out there to compare against {name("ministry", "short")} claims. The ((resource governance::glossary:resource-governance)) databases might have something.

// Brainstorm - who might know more about this company?
~ delay_next(1200)
# type:sent
Who might know more about {name("aricanga", "alt")}?

* [{name("ministry", "reference")} only - stick to official sources]
    # type:sent
    {name("ministry", "reference")} contact first. Keep it simple.

    -> notes_chat.continue_research

* [Also reach out to {name("activist", "display_name")}]
    # type:sent
    {name("activist", "first_name")} might know something — she tracks all the extractive industry deals.

    ~ can_request_activist_comment = true

    ~ delay_next(600)
    # type:sent
    I'll reach out to her too.

    -> notes_chat.continue_research

= continue_research
// Text reminder - reviewing press file from Jean-Marc
~ delay_next(800)
# type:sent
# time:9:45 AM
TODO: {name("ministry", "reference")} press office number is in the contacts folder. Also review Jean-Marc's press file for the ((corporate registry::glossary:corporate-registry)) details.

// Photo of press release - took time to read and highlight
~ delay_next(1200)
# type:sent
# image:/assets/press-release-aricanga.svg
Press release — key points highlighted

// Voice memo after ministry call - time jump, calls take a while
~ delay_next(2500)
# type:sent
# audio:/assets/audio/memo-002.m4a
# duration:0:12
# time:10:30 AM
Called {name("ministry", "short")}. Got stonewalled by some junior staffer. "No further comment at this time." Classic. Story's as good as it's gonna get.

// EITI database discovery - link preview card with internal monologue
~ delay_next(1200)
# type:sent
# time:10:45 AM
# linkUrl:glossary:soe-database
# linkDomain:eiti.org
# linkTitle:SOE Database
# linkDesc:EITI's database tracking state-owned enterprise payments in extractive industries.
# linkLayout:minimal
Found this — soe-database.eiti.org. ((EITI::glossary:eiti)) tracks all reported payments from state-owned enterprises. Could be useful for cross-referencing ministry's numbers.

// Text note with EITI comparison - values formatted and highlighted
~ delay_next(800)
# type:sent
{name("eiti", "short")} shows median annual revenue from mining projects is (({data_median_revenue}::eiti:median_annual_revenue)). {name("ministry", "reference")}'s claiming (({ministry_claimed_revenue}::story:ministry_release)) for {name("aricanga", "short")}. That's more than double the median. Could be a bigger deposit, or someone's padding numbers. Filing for later.

// Quick text note - time jump, writing the draft took ~30 min
~ delay_next(1000)
# type:sent
# time:11:15 AM
Draft ready to send.

~ research_complete = true
# targetChat:pat
# speaker:Pat
# notificationPreview:How's that {name("aricanga", "short")} piece coming?
How's that {name("aricanga", "short")} piece coming? Desk needs it soon.
-> DONE

= ready_to_write
// Post-draft reflection - journalist notices something off but shelves it
// Why: Timed after Pat's 1:30 PM confirmation - player should feel doubt only after committing

# type:sent
# audio:/assets/audio/memo-003.m4a
# duration:0:18
# time:3:15 PM
Thinking back on that {name("aricanga", "short")} piece... something about those job creation numbers didn't add up. {name("ministry", "reference")} claims 12,000 new jobs, but the project footprint couldn't support half that.

~ delay_next(1500)
# type:sent
Too late now. Article's already filed.

~ delay_next(1000)
# type:sent
Maybe worth revisiting if anything else comes up.

# targetChat:pat
# speaker:Pat
# notificationPreview:Port authority docs are ready
Port authority docs are in your inbox. Budget allocations for the new terminal.
-> DONE

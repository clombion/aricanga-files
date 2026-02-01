# Writing Branching Dialogue

Create meaningful player choices that affect the story and character relationships.

**Prerequisites:** [Adding a Character](./adding-a-character.md)

---

## What You'll Learn

- Creating player choices with `*` syntax
- Tracking decisions with variables
- Conditional text based on past choices
- Multi-step conversations with state guards

---

## Basic Choices

Player choices use the `*` syntax:

```ink
# speaker:Pat
# type:received
# time:9:30 AM
Got time for a quick assignment?

* [Sure, what do you need?]
    # type:sent
    Sure, what do you need?
    -> assignment_details

* [I'm swamped right now]
    # type:sent
    I'm swamped right now. Can it wait?
    -> pat_pushback
```

**Key points:**
- `[Text in brackets]` is the button label
- Text after `]` is what appears in the chat when selected
- `->` diverts to another section

---

## Tracking Decisions

Use variables to remember what the player chose:

```ink
// In variables.ink
VAR accepted_assignment = false
VAR player_hesitated = false

// In the chat file
* [I'll take it]
    # type:sent
    I'll take it.
    ~ accepted_assignment = true
    -> assignment_details

* [Let me think about it]
    # type:sent
    Let me think about it.
    ~ player_hesitated = true
    -> thinking_response
```

---

## Conditional Responses

Characters can react differently based on past choices:

```ink
= follow_up
# speaker:Pat
# type:received
# time:2:00 PM
{accepted_assignment:
    How's that story coming along?
- else:
    Changed your mind about the assignment?
}

{player_hesitated:
    ~ delay_next(600)
    # type:received
    I know you were unsure earlier, but this could be big.
}
```

---

## Guard Patterns

Prevent re-showing content the player has already seen:

```ink
= ask_angle
// Guard: only show intro message on first visit
{ask_angle > 1: -> ask_angle.choices}

# speaker:Pat
# type:received
# time:9:23 AM
Morning. You see the release?

~ delay_next(800)
# type:received
What's your take?

- (choices)
* [Quick write-up]
    # type:sent
    Quick write-up from the release.
    ~ player_agreed = true
    -> DONE

* [Something feels off]
    # type:sent
    Give me a day. Something feels off.
    -> pat_negotiates
```

The `{ask_angle > 1: -> ask_angle.choices}` pattern:
- `ask_angle` is the stitch name
- Ink tracks visit counts automatically
- On revisit, skip the intro and jump straight to choices

---

## Multi-Step Conversations

Build conversations that unfold over time:

```ink
=== spectre_chat ===
~ current_chat = "spectre"

# story_start

// State machine - route to current story position
{not initial_contact_made:
    -> spectre_chat.waiting
}

{initial_contact_made and not trust_established:
    -> spectre_chat.building_trust
}

{trust_established:
    -> spectre_chat.full_access
}

-> spectre_chat.idle

= waiting
-> DONE

= building_trust
{building_trust > 1: -> building_trust.choice}

# speaker:TonyGov
# type:received
# time:11:00 PM
Before I share more, I need to know I can trust you.

~ delay_next(1500)
# type:received
The last journalist I talked to... didn't work out.

- (choice)
* [I protect my sources]
    # type:sent
    I protect my sources. Always have.

    ~ delay_next(2000)
    # speaker:TonyGov
    # type:received
    We'll see.

    ~ trust_established = true
    -> DONE

* [What happened?]
    # type:sent
    What happened to them?

    ~ delay_next(3000)
    # speaker:TonyGov
    # type:received
    Ask the ministry.
    -> DONE
```

---

## Triggering Cross-Chat Events

Make choices in one chat affect another using `# targetChat:` to send a message to a background chat:

```ink
// In notes_chat
* [Call Maria Santos for comment]
    # type:sent
    Reaching out to Maria Santos for community perspective...

    ~ activist_comment_requested = true

    // Send message to activist chat (triggers notification automatically)
    # targetChat:activist
    # speaker:{name("activist", "first_name")}
    # type:received
    # notificationPreview:Hi, I got your message about the Aricanga story
    Hi, I got your message about the Aricanga story. Happy to help with your research.
    -> DONE
```

This:
1. Sets a flag other chats can check
2. Sends a message to activist chat, which automatically fires a notification and sets the unread badge

---

## Delayed Responses

Add realistic typing delays:

```ink
# speaker:Pat
# type:received
# time:9:30 AM
Got a minute?

~ delay_next(800)    // 800ms pause
# type:received
Need to talk about the Morrison piece.

~ delay_next(1200)   // 1.2s pause
# type:received
Some concerns from legal.
```

**Guidelines:**
- Short messages: 400-800ms
- Medium messages: 800-1500ms
- Long or emotional messages: 1500-3000ms

---

## Sticky Choices

Choices that can only be selected once use `*`. Choices that can be repeated use `+`:

```ink
- (menu)
+ [Ask about the deal]
    # type:sent
    Tell me more about the deal.
    // ... response ...
    -> menu

+ [Ask about the ministry]
    # type:sent
    What's the ministry's involvement?
    // ... response ...
    -> menu

* [I have enough for now]  // One-time choice - exits menu
    # type:sent
    Thanks, I have enough for now.
    -> DONE
```

---

## Conditional Choices

Show choices only when conditions are met:

```ink
- (choices)
* [Submit the story]
    -> submit

* {has_ministry_quote} [Include ministry quote]
    # type:sent
    I'll add the ministry's response.
    ~ included_quote = true
    -> submit

* {has_activist_quote} [Include activist perspective]
    # type:sent
    Adding Maria's community perspective.
    ~ included_activist = true
    -> submit
```

Choices with conditions in `{}` only appear when true.

---

## Example: Full Branching Sequence

```ink
= interview_decision
{interview_decision > 1: -> interview_decision.choice}

# speaker:Source
# type:received
# time:6:00 PM
I can get you 30 minutes with someone inside.

~ delay_next(1000)
# type:received
But you'll need to come alone. No recording.

- (choice)
* [I'll be there]
    # type:sent
    I'll be there. Where and when?

    ~ agreed_to_meet = true
    ~ delay_next(2000)

    # speaker:Source
    # type:received
    Parking garage B, level 3. Tomorrow, 9 PM.

    ~ delay_next(800)
    # type:received
    If anyone follows you, I'm gone.
    -> DONE

* [Too risky]
    # type:sent
    That's too risky. Can we do this another way?

    ~ delay_next(3000)

    # speaker:Source
    # type:received
    There is no other way.

    ~ delay_next(1500)
    # type:received
    Let me know if you change your mind.
    -> DONE

* {trust_established} [Can I bring backup?]
    # type:sent
    Can I at least have someone know where I am?

    ~ delay_next(2500)

    # speaker:Source
    # type:received
    ...fine. One person. But they stay outside.

    ~ agreed_to_meet = true
    ~ has_backup = true
    -> DONE
```

---

## Checklist

When writing branching dialogue:

- [ ] Every choice leads somewhere (`->` or `-> DONE`)
- [ ] Visit guards prevent repeated content
- [ ] Variables track meaningful decisions
- [ ] Delays feel natural for message length
- [ ] Cross-chat triggers update unread flags

---

## What's Next?

- [Adding Localization](./localization.md) - Translate branches
- [Writing Guide](../guides/writers/writing-guide.md) - Complete syntax reference
- [Narrative Design](../concepts/narrative-design.md) - Choice design patterns

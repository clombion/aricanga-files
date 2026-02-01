# Narrative Design Guide

This document explains the design patterns and taxonomy used in Capital Chronicle's interactive narrative.

---

## Choice Taxonomy

### Cosmetic Choices

**Definition:** Choices that affect dialogue flavor but don't change story variables or outcomes.

**Purpose:** Give players expressiveness without branching complexity.

**Example:**
```ink
* [I understand] -> continue
* [Got it] -> continue
* [Makes sense] -> continue
```

**Detection:** Choice has no `~ variable = value` assignments.

---

### Gating Choices

**Definition:** Choices that unlock or block access to content by setting variables checked elsewhere.

**Purpose:** Control story progression and content availability.

**Example:**
```ink
* [Agree to write the article]
    ~ player_agreed = true  // Gates access to notes_chat content
```

**Detection:** Variable is set AND later checked by a conditional (`{variable:` or `{not variable:`).

---

### Non-Blocking Consequential

**Definition:** Choices that set state but don't force or remind the player to act on it. The player must remember to follow through.

**Purpose:** Create authentic agency - decisions matter but aren't hand-held. Reflects real-world choices where noting something down doesn't mean you'll do it.

**Example:**
```ink
// In Notes chat
* [Also reach out to Maria Santos]
    ~ can_request_activist_comment = true  // No notification sent!
    // Player must remember to open Maria's chat themselves
```

**Why no notification:** The player made a note to themselves. In real life, writing "call Maria" doesn't make Maria call you. The player chose to note it; they must choose to act on it.

**Detection:** Variable is set but no `# targetChat:` message follows in the same choice block.

---

### Delayed Consequence

**Definition:** Choices whose effects only become visible in later conversations or story beats.

**Purpose:** Create narrative payoff and reinforce that choices matter across the whole story.

**Example:**
```ink
// Early: Player chooses whether to ask Maria
~ activist_comment_requested = true

// Later: Maria's response differs based on that choice
{activist_comment_requested:
    -> maria_responds_helpfully
- else:
    -> maria_disappointed
}
```

**Detection:** Variable set in one chat is checked by conditional in a different chat.

---

## Design Patterns

### Player Agency Without Hand-Holding

Players make meaningful choices but aren't reminded or forced to follow through. This creates:

- **Authentic consequences:** Forgetting to contact someone has realistic outcomes
- **Replay value:** Different playthroughs reveal different content
- **Respect for player:** We trust them to manage their own decisions

**Implementation:** Use non-blocking consequential choices. Set flags without notifications.

---

### Consequences for Inaction

Not acting is itself a choice with consequences. If a player:

- Notes to contact Maria but doesn't → Maria is disappointed post-publication
- Has information but doesn't use it → Story proceeds without that context

**Implementation:** Check for `variable AND NOT action_taken` to route to "missed opportunity" content.

---

### Reactive NPCs

Characters respond to what the player actually did, not just what they intended:

- **Maria (if asked):** Provides context, responds helpfully post-publication
- **Maria (if noted but not asked):** "I'm disappointed you didn't reach out" + player can say "I wrote it down but forgot"
- **Maria (if never noted):** Same disappointment, but no "forgot" dialogue option

**Implementation:** Track both intention (`can_request_activist_comment`) and action (`activist_comment_requested`).

---

## Characters

### Pat

**Role:** Player's boss at the Capital Chronicle.

**Motivation:** Get stories published on deadline. Pragmatic, not investigative.

**Design function:** Provides assignments, gates story progression, represents institutional pressure.

### Maria Santos (Environmental Activist)

**Role:** Source with expertise on extractive industry deals.

**Motivation:** Ensure affected communities have voice in coverage.

**Design function:** Optional depth - rewards players who seek her out. Reactive to player choices.

### TonyGov (Unknown Contact)

**Role:** Mysterious source who appears post-publication.

**Motivation:** Unknown. Claims the player missed the real story.

**Design function:** Hook for future content. Creates tension about player's journalistic choices.

### Player (Journalist)

**Role:** Reporter at the Capital Chronicle.

**Internal conflict:** Speed vs. depth, access vs. independence.

**Design function:** Player's choices reflect their values as a journalist.

---

## Appendix: Detection Rules

For automated analysis (used by guided-agent.js):

| Pattern | Detection Rule |
|---------|----------------|
| Cosmetic | Choice block has no `~ var = value` |
| Gating | Variable set AND checked by `{var:` elsewhere |
| Non-blocking | Variable set AND no `# targetChat:` message in same block |
| Delayed | Variable set in chat X, checked in chat Y (X ≠ Y) |

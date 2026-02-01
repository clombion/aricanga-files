# Story Transcripts

*Linear screenplay format for narrative coherence review.*

Use this document to:
- Review dialogue flow without playing the game
- Check character responses match prior context
- Feed to LLM for automated coherence analysis

## Design Context

*This section explains narrative design patterns detected in this story.*
*For the full taxonomy, see docs/NARRATIVE-DESIGN.md*

### Cosmetic Choices

Choices that affect dialogue flavor but don't change story outcomes.
This story has **11** cosmetic choices.

### Non-Blocking Consequential Choices

**Key design pattern:** Choices that set state but don't force the player to act on it.
The player must remember to follow through themselves.

This reflects real-world agency: noting something down doesn't guarantee action.
Players who write "contact Maria" in their notes must remember to actually open her chat.

**Detected non-blocking choices:**
- `activist_comment_requested` set at activist_chat.can_ask

### Delayed Consequence Choices

Choices whose effects appear in later conversations, not immediately.

**Cross-chat dependencies detected:**
- `activist_comment_requested` set in **activist**, affects **pat**
- `can_request_activist_comment` set in **notes**, affects **activist**
- `research_complete` set in **notes**, affects **pat**
- `player_agreed` set in **pat**, affects **notes**
- `article_published` set in **pat**, affects **spectre**
- `activist_responded` set in **pat**, affects **activist**

### Gating Choices

Choices that unlock or block access to content, with notifications.

**Detected gating choices:**
- `can_request_activist_comment` at notes_chat.research_phase
- `research_complete` at notes_chat.research_phase
- `player_agreed` at pat_chat.ask_angle
- `article_published` at pat_chat.waiting_for_draft
- `activist_responded` at pat_chat.waiting_for_draft

### Characters

- **Pat (Editor)** — Player's boss at the Capital Chronicle. Pragmatic, deadline-focused.
- **Maria Santos** — Environmental activist. Optional source who rewards players who seek her out.
- **Spectre** — Unknown contact who appears post-publication. Claims player missed the real story.
- **Player** — Journalist navigating speed vs. depth, access vs. independence.

---

# Path: golden

*The intended progression: contact Maria, get her comment.*

---

## Gov News Wire

**Gov News Wire** *(9:15 AM)*: BREAKING: Ministry of Resources announces landmark mining partnership with Aricanga Corp.
**Gov News Wire** *(9:15 AM)*: The 30-year agreement grants exclusive extraction rights across the Northern Province. Ministry officials are calling it "a historic investment in our nation's future."
**Gov News Wire** *(9:15 AM)*: Full press release attached.
**Gov News Wire** *(9:15 AM)*: 📷 *[Image: assets/press-release-aricanga.svg]*
> Aricanga Corp Partnership - Official Press Release

## Pat (Editor)

**Pat** *(9:23 AM)*: Morning. You see the Aricanga release?
**Pat** *(9:23 AM)*: 30-year mining deal. Ministry's calling it "historic."
**Pat** *(9:23 AM)*: Need something for tonight's edition. What's your take?

> **CHOICE POINT** `pat_chat.ask_angle`
> → 1. Quick write-up from the release. I can have it by lunch.
>   2. Give me a day. Something feels off about this deal.

**You** *(9:23 AM)*: Quick write-up from the release. I can have it by lunch.
**Pat** *(9:23 AM)*: Perfect. Ping me when it's ready.
**Pat** *(9:23 AM)*: And grab a quote from the ministry if you can. Even "no comment" is something.

## My Notes

**You** *(9:28 AM)*: 🎤 *[Voice memo: 0:08]*
> Pat wants the Aricanga piece for tonight. Standard coverage - pull quotes from the release, get a comment from the ministry if I can.
**You** *(9:28 AM)*: Should also check if there's useful data out there to compare against ministry claims
**You** *(9:28 AM)*: Who might know more about Aricanga Mining?

> **CHOICE POINT** `notes_chat.research_phase`
>   1. Ministry only - stick to official sources
> → 2. Also reach out to Maria Santos

**You** *(9:28 AM)*: Maria might know something - she tracks all the extractive industry deals.
**You** *(9:28 AM)*: I'll reach out to her too.
**You** *(9:45 AM)*: 📷 *[Image: assets/press-release-aricanga.svg]*
> Press release - key points highlighted
**You** *(10:30 AM)*: 🎤 *[Voice memo: 0:12]*
> Called the ministry. Got stonewalled by some junior staffer. "No further comment at this time." Classic. Story's as good as it's gonna get.
**You** *(10:45 AM)*: Found soe-database.eiti.org - could be useful for comparing with ministry's numbers
**You** *(10:45 AM)*: EITI shows median annual revenue from mining projects is ((::eiti:median_annual_revenue)). Ministry's claiming (($450 million::story:ministry_release)) for Aricanga. That's more than double the median. Could be a bigger deposit, or someone's padding numbers. Filing for later.
**You** *(11:15 AM)*: Draft ready to send.

## Maria Santos

*You can ask Maria about Aricanga Mining.*

> **CHOICE POINT** `activist_chat.root`
> → 1. Ask about Aricanga Mining
>   2. (Not now)

**You** *(10:15 AM)*: Hey Maria, quick question. You know anything about Aricanga Mining? There's a breaking announcement.
**Maria** *(10:15 AM)*: Aricanga? Yes, they've been on our radar for a while.
**Maria** *(10:15 AM)*: Their environmental impact assessments in the southern provinces were incomplete at best.
**Maria** *(10:15 AM)*: I can look into the specifics if you need. What's your timeline?

> **CHOICE POINT** `activist_chat.can_ask`
> → 1. Need it fast - publishing today
>   2. Just background for now

**You** *(10:15 AM)*: Publishing today, unfortunately. Whatever you can find quickly.
**Maria** *(10:15 AM)*: That's... very short notice.
**Maria** *(10:15 AM)*: I'll see what I can pull together, but I can't promise much on that timeline.
**Maria** *(10:15 AM)*: The community deserves a proper voice in these stories.

## My Notes


## Pat (Editor)

**Pat** *(11:30 AM)*: How's that Aricanga piece coming?

> **CHOICE POINT** `pat_chat.root`
> → 1. Here's the draft

**You** *(11:30 AM)*: 📎 *[Attachment: aricanga-draft-v1.docx]*
> Draft attached. Pretty straightforward - ministry's staying tight-lipped as usual.
**Pat** *(2:30 PM)*: Good enough. Running it tonight, page 3.
**Pat** *(2:30 PM)*: Take a break, then start on the port authority docs. They just came in.
**Pat** *(5:15 PM)*: Article's live. Already getting traction.
**Pat** *(5:15 PM)*: Nice work on the turnaround.

## Unknown Number

**Spectre** *(5:30 PM)*: Saw your piece on the Aricanga deal.
**Spectre** *(5:30 PM)*: Disappointing.
**Spectre** *(5:30 PM)*: We're supposed to be journalists. Not government stenographers.

> **CHOICE POINT** `spectre_chat.first_contact`
> → 1. What do you mean?
>   2. I reported what was there.
>   3. (Ignore)

**You** *(5:30 PM)*: What do you mean?
**Spectre** *(5:30 PM)*: You quoted the press release almost verbatim. Did you even try to verify their claims?
**Spectre** *(5:30 PM)*: The "historic investment" line. The job creation numbers. Any of it.
**Spectre** *(5:30 PM)*: There's more to this story. A lot more.
**Spectre** *(5:30 PM)*: Meet me tonight. You know where.

## Maria Santos

**Maria** *(5:35 PM)*: I saw your article.
**Maria** *(5:35 PM)*: I understand deadline pressures, but I have to be direct with you.
**Maria** *(5:35 PM)*: The community groups affected by this deal weren't given adequate time to respond.
**Maria** *(5:35 PM)*: Your piece is missing crucial context about the environmental assessments that were never properly completed.
**Maria** *(5:35 PM)*: I'm not blaming you personally. I know how newsrooms work.
**Maria** *(5:35 PM)*: But these are real communities. Real people who will be affected.

> **CHOICE POINT** `activist_chat.post_publication`
> → 1. I'm sorry - what did I miss?
>   2. I had to go with what I had
>   3. (Read later)

**You** *(5:35 PM)*: I'm sorry. What specifically did I miss?
**Maria** *(5:35 PM)*: The "historic investment" framing came straight from the ministry press release.
**Maria** *(5:35 PM)*: No mention of the incomplete environmental reviews. No mention of the land disputes.
**Maria** *(5:35 PM)*: I have documentation. If you're willing to do a follow-up piece, I can help.
**Maria** *(5:35 PM)*: But next time, please give us more than a few hours.

---


# Path: no_maria

*Player skips contacting Maria Santos.*

---

## Gov News Wire

**Gov News Wire** *(9:15 AM)*: BREAKING: Ministry of Resources announces landmark mining partnership with Aricanga Corp.
**Gov News Wire** *(9:15 AM)*: The 30-year agreement grants exclusive extraction rights across the Northern Province. Ministry officials are calling it "a historic investment in our nation's future."
**Gov News Wire** *(9:15 AM)*: Full press release attached.
**Gov News Wire** *(9:15 AM)*: 📷 *[Image: assets/press-release-aricanga.svg]*
> Aricanga Corp Partnership - Official Press Release

## Pat (Editor)

**Pat** *(9:23 AM)*: Morning. You see the Aricanga release?
**Pat** *(9:23 AM)*: 30-year mining deal. Ministry's calling it "historic."
**Pat** *(9:23 AM)*: Need something for tonight's edition. What's your take?

> **CHOICE POINT** `pat_chat.ask_angle`
> → 1. Quick write-up from the release. I can have it by lunch.
>   2. Give me a day. Something feels off about this deal.

**You** *(9:23 AM)*: Quick write-up from the release. I can have it by lunch.
**Pat** *(9:23 AM)*: Perfect. Ping me when it's ready.
**Pat** *(9:23 AM)*: And grab a quote from the ministry if you can. Even "no comment" is something.

## My Notes

**You** *(9:28 AM)*: 🎤 *[Voice memo: 0:08]*
> Pat wants the Aricanga piece for tonight. Standard coverage - pull quotes from the release, get a comment from the ministry if I can.
**You** *(9:28 AM)*: Should also check if there's useful data out there to compare against ministry claims
**You** *(9:28 AM)*: Who might know more about Aricanga Mining?

> **CHOICE POINT** `notes_chat.research_phase`
> → 1. Ministry only - stick to official sources
>   2. Also reach out to Maria Santos

**You** *(9:28 AM)*: Ministry contact first. Keep it simple.
**You** *(9:45 AM)*: 📷 *[Image: assets/press-release-aricanga.svg]*
> Press release - key points highlighted
**You** *(10:30 AM)*: 🎤 *[Voice memo: 0:12]*
> Called the ministry. Got stonewalled by some junior staffer. "No further comment at this time." Classic. Story's as good as it's gonna get.
**You** *(10:45 AM)*: Found soe-database.eiti.org - could be useful for comparing with ministry's numbers
**You** *(10:45 AM)*: EITI shows median annual revenue from mining projects is ((::eiti:median_annual_revenue)). Ministry's claiming (($450 million::story:ministry_release)) for Aricanga. That's more than double the median. Could be a bigger deposit, or someone's padding numbers. Filing for later.
**You** *(11:15 AM)*: Draft ready to send.

## Maria Santos


## My Notes


## Pat (Editor)

**Pat** *(11:30 AM)*: How's that Aricanga piece coming?

> **CHOICE POINT** `pat_chat.root`
> → 1. Here's the draft

**You** *(11:30 AM)*: 📎 *[Attachment: aricanga-draft-v1.docx]*
> Draft attached. Pretty straightforward - ministry's staying tight-lipped as usual.
**Pat** *(2:30 PM)*: Good enough. Running it tonight, page 3.
**Pat** *(2:30 PM)*: Take a break, then start on the port authority docs. They just came in.
**Pat** *(5:15 PM)*: Article's live. Already getting traction.
**Pat** *(5:15 PM)*: Nice work on the turnaround.

## Unknown Number

**Spectre** *(5:30 PM)*: Saw your piece on the Aricanga deal.
**Spectre** *(5:30 PM)*: Disappointing.
**Spectre** *(5:30 PM)*: We're supposed to be journalists. Not government stenographers.

> **CHOICE POINT** `spectre_chat.first_contact`
> → 1. What do you mean?
>   2. I reported what was there.
>   3. (Ignore)

**You** *(5:30 PM)*: What do you mean?
**Spectre** *(5:30 PM)*: You quoted the press release almost verbatim. Did you even try to verify their claims?
**Spectre** *(5:30 PM)*: The "historic investment" line. The job creation numbers. Any of it.
**Spectre** *(5:30 PM)*: There's more to this story. A lot more.
**Spectre** *(5:30 PM)*: Meet me tonight. You know where.

## Maria Santos

**Maria** *(5:35 PM)*: I saw your article. I'm disappointed you didn't reach out to us for comment.
**Maria** *(5:35 PM)*: The communities affected deserve a voice in these stories.

> **CHOICE POINT** `activist_chat.missed_without_note`
> → 1. I didn't realize - I'll do better next time
>   2. The deadline was tight

**You** *(5:35 PM)*: I didn't think to reach out. I'll make sure to include community voices next time.
**Maria** *(5:35 PM)*: Thank you. We're always willing to help journalists tell the full story.

---


# Path: decline_pat_first

*Player initially hesitates on the assignment.*

---

## Gov News Wire

**Gov News Wire** *(9:15 AM)*: BREAKING: Ministry of Resources announces landmark mining partnership with Aricanga Corp.
**Gov News Wire** *(9:15 AM)*: The 30-year agreement grants exclusive extraction rights across the Northern Province. Ministry officials are calling it "a historic investment in our nation's future."
**Gov News Wire** *(9:15 AM)*: Full press release attached.
**Gov News Wire** *(9:15 AM)*: 📷 *[Image: assets/press-release-aricanga.svg]*
> Aricanga Corp Partnership - Official Press Release

## Pat (Editor)

**Pat** *(9:23 AM)*: Morning. You see the Aricanga release?
**Pat** *(9:23 AM)*: 30-year mining deal. Ministry's calling it "historic."
**Pat** *(9:23 AM)*: Need something for tonight's edition. What's your take?

> **CHOICE POINT** `pat_chat.ask_angle`
>   1. Quick write-up from the release. I can have it by lunch.
> → 2. Give me a day. Something feels off about this deal.

**You** *(9:23 AM)*: Give me a day. Something feels off about this deal.
**Pat** *(9:23 AM)*: I hear you, but we don't have runway for a deep dive right now.
**Pat** *(9:23 AM)*: Do the quick version today. If there's more there, we revisit next week.
**Pat** *(9:23 AM)*: Port authority story's waiting in the wings anyway.
**You** *(9:23 AM)*: Alright. I'll make some calls.

## My Notes

**You** *(9:28 AM)*: 🎤 *[Voice memo: 0:08]*
> Pat wants the Aricanga piece for tonight. Standard coverage - pull quotes from the release, get a comment from the ministry if I can.
**You** *(9:28 AM)*: Should also check if there's useful data out there to compare against ministry claims
**You** *(9:28 AM)*: Who might know more about Aricanga Mining?

> **CHOICE POINT** `notes_chat.research_phase`
>   1. Ministry only - stick to official sources
> → 2. Also reach out to Maria Santos

**You** *(9:28 AM)*: Maria might know something - she tracks all the extractive industry deals.
**You** *(9:28 AM)*: I'll reach out to her too.
**You** *(9:45 AM)*: 📷 *[Image: assets/press-release-aricanga.svg]*
> Press release - key points highlighted
**You** *(10:30 AM)*: 🎤 *[Voice memo: 0:12]*
> Called the ministry. Got stonewalled by some junior staffer. "No further comment at this time." Classic. Story's as good as it's gonna get.
**You** *(10:45 AM)*: Found soe-database.eiti.org - could be useful for comparing with ministry's numbers
**You** *(10:45 AM)*: EITI shows median annual revenue from mining projects is ((::eiti:median_annual_revenue)). Ministry's claiming (($450 million::story:ministry_release)) for Aricanga. That's more than double the median. Could be a bigger deposit, or someone's padding numbers. Filing for later.
**You** *(11:15 AM)*: Draft ready to send.

## Maria Santos

*You can ask Maria about Aricanga Mining.*

> **CHOICE POINT** `activist_chat.root`
> → 1. Ask about Aricanga Mining
>   2. (Not now)

**You** *(10:15 AM)*: Hey Maria, quick question. You know anything about Aricanga Mining? There's a breaking announcement.
**Maria** *(10:15 AM)*: Aricanga? Yes, they've been on our radar for a while.
**Maria** *(10:15 AM)*: Their environmental impact assessments in the southern provinces were incomplete at best.
**Maria** *(10:15 AM)*: I can look into the specifics if you need. What's your timeline?

> **CHOICE POINT** `activist_chat.can_ask`
> → 1. Need it fast - publishing today
>   2. Just background for now

**You** *(10:15 AM)*: Publishing today, unfortunately. Whatever you can find quickly.
**Maria** *(10:15 AM)*: That's... very short notice.
**Maria** *(10:15 AM)*: I'll see what I can pull together, but I can't promise much on that timeline.
**Maria** *(10:15 AM)*: The community deserves a proper voice in these stories.

## My Notes


## Pat (Editor)

**Pat** *(11:30 AM)*: How's that Aricanga piece coming?

> **CHOICE POINT** `pat_chat.root`
> → 1. Here's the draft

**You** *(11:30 AM)*: 📎 *[Attachment: aricanga-draft-v1.docx]*
> Draft attached. Pretty straightforward - ministry's staying tight-lipped as usual.
**Pat** *(2:30 PM)*: Good enough. Running it tonight, page 3.
**Pat** *(2:30 PM)*: Take a break, then start on the port authority docs. They just came in.
**Pat** *(5:15 PM)*: Article's live. Already getting traction.
**Pat** *(5:15 PM)*: Nice work on the turnaround.

## Unknown Number

**Spectre** *(5:30 PM)*: Saw your piece on the Aricanga deal.
**Spectre** *(5:30 PM)*: Disappointing.
**Spectre** *(5:30 PM)*: We're supposed to be journalists. Not government stenographers.

> **CHOICE POINT** `spectre_chat.first_contact`
> → 1. What do you mean?
>   2. I reported what was there.
>   3. (Ignore)

**You** *(5:30 PM)*: What do you mean?
**Spectre** *(5:30 PM)*: You quoted the press release almost verbatim. Did you even try to verify their claims?
**Spectre** *(5:30 PM)*: The "historic investment" line. The job creation numbers. Any of it.
**Spectre** *(5:30 PM)*: There's more to this story. A lot more.
**Spectre** *(5:30 PM)*: Meet me tonight. You know where.

## Maria Santos

**Maria** *(5:35 PM)*: I saw your article.
**Maria** *(5:35 PM)*: I understand deadline pressures, but I have to be direct with you.
**Maria** *(5:35 PM)*: The community groups affected by this deal weren't given adequate time to respond.
**Maria** *(5:35 PM)*: Your piece is missing crucial context about the environmental assessments that were never properly completed.
**Maria** *(5:35 PM)*: I'm not blaming you personally. I know how newsrooms work.
**Maria** *(5:35 PM)*: But these are real communities. Real people who will be affected.

> **CHOICE POINT** `activist_chat.post_publication`
> → 1. I'm sorry - what did I miss?
>   2. I had to go with what I had
>   3. (Read later)

**You** *(5:35 PM)*: I'm sorry. What specifically did I miss?
**Maria** *(5:35 PM)*: The "historic investment" framing came straight from the ministry press release.
**Maria** *(5:35 PM)*: No mention of the incomplete environmental reviews. No mention of the land disputes.
**Maria** *(5:35 PM)*: I have documentation. If you're willing to do a follow-up piece, I can help.
**Maria** *(5:35 PM)*: But next time, please give us more than a few hours.

---

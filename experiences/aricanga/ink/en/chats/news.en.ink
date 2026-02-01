// Gov News Wire - Official announcements feed

=== news_chat ===
~ current_chat = "news"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{news_chat == 1:
    # type:received
    # speaker:Gov News Wire
    # time:Feb 20
    Ministry of Finance releases Q4 fiscal report. Revenue from extractive sector up 3.2% year-on-year, driven by copper and cobalt exports. The report highlights a 15% increase in non-tax revenue from mining licenses, while noting that infrastructure spending in resource-producing regions remains below the 8% target set in the National Development Plan. Opposition lawmakers have called for an independent audit of royalty disbursements to provincial governments.

    ~ delay_next(0)
    # type:received
    # speaker:Gov News Wire
    # time:Feb 28
    Northern Province infrastructure fund disbursement on track for March. Ministry of Public Works confirms contractor shortlist.

    ~ delay_next(0)
    # type:received
    # speaker:Gov News Wire
    # time:Mar 5
    Senate committee approves amended mining code in 42-to-17 vote. New provisions require enhanced disclosure for concession holders, including quarterly production reports and beneficial ownership transparency. Environmental groups welcomed the inclusion of mandatory rehabilitation bonds, though industry representatives warned the compliance timeline may discourage new investment. The amended code takes effect in 90 days pending presidential signature.

    ~ delay_next(0)
    # type:received
    # speaker:Gov News Wire
    # time:Mar 10
    Trade delegation from neighboring province concludes three-day visit. Joint communiqué on cross-border resource corridor expected this week.
}

# story_start

// Only show main content once
{news_chat > 1: -> DONE}

# speaker:Gov News Wire
# type:received
# time:8:35 AM
OFFICIAL — {name("ministry", "name")} confirms 30-year mining partnership with {name("aricanga", "name")}. Full statement to follow.

// Signal dip while commuting
~ delay_next(400)
# status:signal:3

~ delay_next(600)
# type:received
The agreement grants exclusive ((extraction rights::glossary:extractive-industries)) across {name("northern_province", "name")}. Minister of Energy: "This partnership represents a historic investment in our nation's future — 12,000 jobs and an estimated $450 million in annual revenue."

~ delay_next(400)
# status:signal:4

~ delay_next(800)
# type:received
((Royalties::glossary:royalties)) set at 5% of gross production value. ((Tax payments::glossary:tax-payments)) structured under the amended mining code framework.

~ delay_next(600)
# type:received
# image:/assets/press-release-aricanga.svg
{name("aricanga", "name")} Partnership — Official Press Release

-> DONE

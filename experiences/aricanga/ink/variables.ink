// Global State Variables

// External functions bound from JavaScript
EXTERNAL name(id, variant)

// Current chat being viewed
VAR current_chat = ""

// Game progression phase
VAR game_phase = 0

// Story flags - News
VAR seen_announcement = false

// Story flags - Pat conversation
VAR player_agreed = false
VAR draft_sent = false
VAR article_published = false

// Story flags - Notes
VAR research_started = false
VAR research_complete = false

// Story flags - Spectre
VAR spectre_contacted = false
VAR agreed_to_meet = false

// Story flags - Press conference / attaché
VAR press_file_received = false
VAR arrived_home = false
VAR attache_post_publish_done = false

// Story flags - Activist (Maria Santos)
VAR can_request_activist_comment = false
VAR activist_comment_requested = false
VAR activist_responded = false

// Story data - internal values set by authors (pre-formatted for display)
VAR ministry_claimed_revenue = "$450 million"  // Claimed for Aricanga

// External data - populated from data-queries.toml on game start
// Raw formatted values; ink authors wrap with ((value::source)) for highlighting
VAR data_median_revenue = ""
VAR data_sample_size = ""

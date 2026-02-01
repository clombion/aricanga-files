// Generated from experiences/{impl}/data/base-config.toml + locales/en.toml
// Do not edit directly - run: mise run build:config

// Game metadata
export const GAME = {
  title: 'Capital Chronicle',
  version: '0.1.0',
};

// Initial state
export const START_STATE = {
  current_time: '8:30 AM',
  battery: 100,
  signal: 4,
  internet: 'mobile4',
  date: '2025-03-15',
  date_format: 'weekday_short',
  weather: 'sunny',
  temperature: '26°C',
};

// Phone hardware and behavior
export const PHONE = {
  capabilities: {
    messaging: true,
    voice_memos: true,
    camera: false,
    web_browser: false,
    forward_messages: false,
  },
  apps: {
    available: [
      'messages',
      'notes',
    ],
  },
  behavior: {
    low_battery_warning: 20,
    critical_battery: 5,
    battery_drain_per_hour: 6.94,
    no_signal_queues_messages: true,
    unstable_connection_delays: true,
    no_internet_shows_banner: true,
    default_drift_minutes: 1,
  },
};

// Analytics configuration
export const ANALYTICS = {
  enabled: false,
  endpoint: '',
  retention: {
    max_age_days: 7,
    max_entries: 5000,
  },
};

// App branding
export const APP = {
  name: 'Civichat',
  gameTitle: 'Capital Chronicle',
  profileImages: [
    'profile_images/optimized/profile-1.jpg',
    'profile_images/optimized/profile-2.jpg',
    'profile_images/optimized/profile-3.jpg',
    'profile_images/optimized/profile-4.jpg',
    'profile_images/optimized/profile-5.jpg',
    'profile_images/optimized/profile-6.jpg',
    'profile_images/optimized/profile-7.jpg',
  ],
  playerStatus: 'Senior reporter at the Capital Chronicle',
  playerEmail: 'aricanga@civicliteraci.es',
};

// Internationalization config
export const I18N = {
  locale: 'en',
  availableLocales: [
    'en',
    'fr',
  ],
  localeNames: {
    en: 'English',
    fr: 'Français',
  },
};

// UI configuration (timings, dimensions, strings)
export const UI = {
  timings: {
    notificationAutoHide: 5000,
    notificationStagger: 1500,
    autoSaveInterval: 30000,
    messageGroupThreshold: 60000,
    focusDelay: 100,
  },
  dimensions: {
    imageMaxWidth: 240,
  },
  strings: {
    resetDialogTitle: 'SYSTEM RESET',
    resetDialogMessage: 'This will wipe all story progress and reset the timeline.\n\nAre you sure?',
    noNotifications: 'No new notifications',
    tapToOpen: 'Tap to open',
  },
};

// All translatable strings (for i18n module)
export const STRINGS = {
  timings: {
    notification_auto_hide: 5000,
    notification_stagger: 1500,
    auto_save_interval: 30000,
    message_group_threshold: 60000,
    focus_delay: 100,
  },
  dimensions: {
    image_max_width: 240,
  },
  constraints: {
    hub: {
      character_name: 20,
      character_status: 60,
    },
    settings: {
      option_label: 30,
      section_title: 25,
    },
    notifications: {
      title: 40,
      body: 100,
    },
  },
  colors: {
    bg: '#121216',
    surface: '#1e1e24',
    header: '#222228',
    accent: '#5b7cfa',
    accent_hover: '#4a6ae8',
    success: '#5dd879',
    danger: '#ff4444',
    text: '#e8e8ed',
    text_muted: '#71717a',
    text_secondary: '#a1a1aa',
    bubble_sent_bg: '#3b5998',
    bubble_sent_text: '#ffffff',
    bubble_received_bg: '#262630',
    bubble_received_text: '#e8e8ed',
    highlight: '#0ea5e9',
    highlight_hover: '#0284c7',
    opacity: {
      overlay: 60,
      overlay_heavy: 95,
      surface_glass: 95,
      border_subtle: 8,
      border_normal: 20,
      hover_light: 10,
      hover_medium: 15,
      shadow: 40,
    },
    glass: {
      tile_bg: 'rgba(60, 60, 60, 0.7)',
      tile_hover: 'rgba(80, 80, 80, 0.9)',
      card_bg: 'rgba(60, 60, 60, 0.9)',
      card_hover: 'rgba(80, 80, 80, 0.9)',
      bar_bg: 'rgba(20, 20, 20, 0.5)',
    },
  },
  hub: {
    pinned: 'Pinned',
    chats: 'Chats',
    tap_to_open: 'Tap to open',
    search: 'Search',
    profile: 'Profile',
    you: 'You',
  },
  drawer: {
    notifications: 'Notifications',
    clear_all: 'Clear all',
    no_notifications: 'No new notifications',
  },
  tiles: {
    restart: 'Restart',
    glossary: 'Glossary',
    settings: 'Settings',
    about: 'About',
    history: 'History',
    notification_settings: 'Notification settings',
    coming_soon: '(coming soon)',
    theme_toggle: 'Toggle theme',
  },
  lock_screen: {
    more_notifications: '+{n} more',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    game_language: 'Game language',
    motion: 'Motion',
    motion_description: 'Page transition animations',
    motion_options: {
      full: 'Full',
      reduced: 'Reduced',
      off: 'Off',
      os_preference: '(OS preference)',
    },
  },
  about: {
    title: 'About',
    about_game: 'About This Game',
    game_description: 'Aricanga is an educational game designed to make extractive industries data more accessible. Through interactive storytelling, players learn to investigate and interpret real-world data from the Extractive Industries Transparency Initiative (EITI).',
    version: 'Version',
    credits: 'Credits',
    designed_by: 'Game designed by',
    cli_name: 'Civic Literacy Initiative',
  },
  glossary: {
    title: 'Glossary',
    search: 'Search terms...',
    no_results: 'No terms found',
  },
  profile: {
    title: 'Profile',
    name: 'Name',
    about: 'About',
    contact: 'Contact',
  },
  conversation_settings: {
    contact: 'Contact',
    search: 'Search',
    disappearing_messages: 'Disappearing messages',
    chat_color_wallpaper: 'Chat color & wallpaper',
    off: 'Off',
  },
  dialog: {
    reset_title: 'SYSTEM RESET',
    reset_message: 'This will wipe all story progress and reset the timeline.\n\nAre you sure?',
  },
  status: {
    online: 'online',
    offline: 'offline',
    last_seen: 'last seen {time}',
    no_service: 'No Service',
    typing: '{name} is typing',
    someone_typing: 'Someone is typing',
  },
  time: {
    now: 'Now',
  },
  dates: {
    today: 'Today',
    yesterday: 'Yesterday',
  },
  messages: {
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    unread: 'unread',
    unread_singular: '1 unread message',
    unread_plural: '{count} unread messages',
    read_more: 'Read more',
    read_less: 'Read less',
  },
  a11y: {
    back: 'Back',
    back_to_chat_list: 'Back to chat list',
    open_contact_settings: 'Open contact settings',
    message_history: 'Message history',
    available_responses: 'Available responses',
    send_message: 'Send message',
    new_message_notification: 'New message notification',
    dismiss_notification: 'Dismiss notification',
    notification_shade: 'Notification Shade',
    open_notification_shade: 'Open notification shade',
    notifications_count: '{count} notifications',
    view_image: 'View image',
    image_preview: 'Image preview',
    close_image: 'Close image',
    play_voice_message: 'Play voice message (transcript available below)',
    battery_level: 'Battery {percent}%',
    clear_notification: 'Clear notification',
  },
  plural: {
    notification_one: 'notification',
    notification_other: 'notifications',
  },
};

// Chat types - define behavioral types with default system messages
export const CHAT_TYPES = {
  normal: {
    canSend: true,
    systemMessage: 'Some messages may not be visible. Message history was partially recovered after transferring to this device.',
  },
  disappearing: {
    canSend: true,
    systemMessage: 'Disappearing messages are on. Messages will be deleted after {duration}.',
  },
  channel: {
    canSend: false,
    systemMessage: 'This is the official channel of {name}. Tap to learn more.',
    inputPlaceholder: 'Only {name} can send messages',
  },
};

// Chat registry - single source of truth for chat configuration
export const CHATS = {
  news: {
    title: 'Gov News Wire',
    knotName: 'news_chat',
    defaultPresence: null,
    avatarLetter: 'GW',
    avatarColor: 'hsl(30, 50%, 80%)',
    avatarImage: null,
    pinned: true,
    description: 'Official government press releases and announcements',
    chatType: 'channel',
    personality: 'Formal, bureaucratic tone. Always factual, never editorial.',
    storyRole: 'Source of official information. Player compares this to ground truth.',
  },
  pat: {
    title: 'Pat',
    knotName: 'pat_chat',
    defaultPresence: 'online',
    avatarLetter: 'P',
    avatarColor: 'hsl(10, 48%, 80%)',
    avatarImage: null,
    pinned: true,
    description: 'Your editor at the Capital Chronicle',
    chatType: 'normal',
    status: 'Editor at the Capital Chronicle',
    personality: 'Professional journalist. Direct, economical with words. Uses newsroom jargon (\'buried the lede\', \'desk needs 500 words\'). Warm but never buddy-buddy.',
    storyRole: 'Assigns stories, provides guidance. Knows newsroom politics but not corruption details.',
    knowledge: 'Aware of industry pressures. Suspects something is off but hasn\'t investigated.',
  },
  notes: {
    title: 'My Notes',
    knotName: 'notes_chat',
    defaultPresence: null,
    avatarLetter: 'MN',
    avatarColorName: 'purple',
    avatarColor: 'hsl(140, 45%, 80%)',
    avatarImage: 'avatars/notes-icon.svg',
    pinned: false,
    description: 'Voice memos, reminders, and research notes',
    chatType: 'normal',
  },
  spectre: {
    title: 'TonyGov',
    knotName: 'spectre_chat',
    defaultPresence: 'offline',
    avatarLetter: 'T',
    avatarColorName: 'gray',
    avatarColor: 'hsl(270, 40%, 80%)',
    avatarImage: null,
    pinned: false,
    description: 'Anonymous contact',
    chatType: 'disappearing',
    disappearingDuration: '24 hours',
    personality: 'Government insider, frustrated bureaucrat. Uses extractives jargon (\'directorate\', \'concession terms\', \'compliance framework\'). Measured, not paranoid.',
    storyRole: 'Whistleblower with inside knowledge of ministry process failures. Challenges player\'s journalism.',
    knowledge: 'Knows about bypassed review processes and buried technical assessments. Has documents.',
  },
  attache: {
    title: 'Jean-Marc Diallo',
    knotName: 'attache_chat',
    defaultPresence: 'online',
    avatarLetter: 'JD',
    avatarColor: 'hsl(140, 45%, 80%)',
    avatarImage: null,
    pinned: false,
    description: 'Press attaché, Ministry of Natural Resources',
    chatType: 'normal',
    status: 'Press attaché · Ministry of Natural Resources',
    personality: 'Polite, efficient, formal but approachable. Government communications professional.',
    storyRole: 'Official liaison between Ministry and press corps. Provides press files and scheduling.',
    knowledge: 'Knows official messaging and ministry calendar. Does not know about internal dissent.',
  },
  activist: {
    title: 'Maria Santos',
    knotName: 'activist_chat',
    defaultPresence: 'online',
    avatarLetter: 'MS',
    avatarColor: 'hsl(175, 40%, 80%)',
    avatarImage: null,
    pinned: false,
    description: 'Community advocate, tracks extractive industry deals',
    chatType: 'normal',
    status: '((Land rights::glossary:land-rights)) advocate · Environmental lawyer',
    personality: 'Articulate community organizer. Measured but persistent. Uses precise legal and advocacy language.',
    storyRole: 'Represents affected community. Provides ground-level perspective.',
    knowledge: 'Knows community impact. Has contacts in affected areas. Doesn\'t know corporate players.',
  },
};

// External functions that ink can call
export const EXTERNAL_FUNCTIONS = ['delay_next', 'play_sound', 'name'];

// Helper to get chat IDs
export const CHAT_IDS = Object.keys(CHATS);

// Message types (ink # type: tag values)
export const MESSAGE_TYPES = {
  SENT: 'sent',
  RECEIVED: 'received',
  SYSTEM: 'system',
  ATTACHMENT: 'attachment',
};

// Game events emitted by controller
export const GAME_EVENTS = {
  READY: 'ready',
  MESSAGE_ADDED: 'message-added',
  CHOICES_AVAILABLE: 'choices-available',
  CHAT_OPENED: 'chat-opened',
  NOTIFICATION: 'notification',
  TYPING_START: 'typing-start',
  TYPING_END: 'typing-end',
};

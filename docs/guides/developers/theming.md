# Theming Guide

> **Audience:** Implementation Developers

This guide covers customizing the visual appearance of Capital Chronicle through the TOML configuration system.

## Overview

All UI colors, the app icon, and character avatars are configured in `experiences/{impl}/data/base-config.toml`. After making changes, run:

```bash
mise run build:config
```

This generates:
- `experiences/{impl}/generated/config.js` - Runtime configuration
- `experiences/{impl}/css/generated/theme-vars.css` - CSS variables

---

## Avatar Configuration

### Default Behavior

If you don't specify avatar fields, the system automatically generates:
- **Letter**: First character of `display_name`
- **Color**: Unique HSL color derived from the name hash (ensures different colors for different names)

```toml
[characters.alex]
display_name = "Alex Chen"
knot_name = "alex_chat"
chat_type = "normal"
# Avatar automatically: letter="A", color=hsl(unique-hue, 65%, 55%)
```

### Custom Color Override

Override the auto-generated color while keeping the letter:

```toml
[characters.pat]
display_name = "Pat"
# Color and initials ("P") auto-derived from display_name
# Override with: avatar_color_name = "green"
```

### Image Avatar

Use an SVG icon instead of initials. The image is masked to a circle. SVGs using `currentColor` strokes inherit the avatar foreground color:

```toml
[characters.notes]
display_name = "My Notes"
avatar_color_name = "purple"
avatar_image = "avatars/notes-icon.svg"  # Path relative to assets/
```

#### Image Requirements

| Requirement | Recommendation |
|-------------|----------------|
| Format | PNG or JPG |
| Aspect Ratio | Square (1:1) - will be cropped to circle |
| Minimum Size | 128x128 pixels |
| Maximum Size | Keep under 50KB for performance |
| Detail Level | Avoid fine details (displayed at 36-72px) |

Store images in `{impl}/assets/avatars/`.

## Player Profile Image

A profile picture appears in the hub header (right side). Clicking it opens the player profile page. On first load, one image is randomly selected from a pool and persisted in localStorage.

### Configuration

Three mutually exclusive forms (checked in order):

```toml
[app]
# Option 1: Directory scan (recommended) — build resolves to sorted array
profile_image_dir = "profile_images/optimized"

# Option 2: Explicit array
# profile_images = ["profile_images/optimized/profile-1.jpg", ...]

# Option 3: Single image
# profile_image = "profile_images/avatar.jpg"
```

Paths are relative to `assets/`. The build task `build:images` optimizes source PNGs from `assets/profile_images/` into `assets/profile_images/optimized/` (256×256 JPEG, quality 80).

### Adding Images

1. Place source PNGs in `experiences/{impl}/assets/profile_images/`
2. Run `mise run build:images` to generate optimized versions
3. Set `profile_image_dir` in `base-config.toml` (the build scans the directory automatically)

## Status / Bio Text

Characters and the player can have a status line displayed on their profile pages.

### Player Status

```toml
[app]
player_status = "Senior reporter at the Capital Chronicle"
```

### Character Status

In the locale file (`locales/{lang}.toml`):

```toml
[characters.pat]
status = "Editor at the Capital Chronicle"
```

Status text is validated against `ui.constraints.hub.character_status` (default: 60 chars).

---

## Color Theming

### Core Palette

```toml
[ui.colors]
bg = "#121216"              # App background
surface = "#1e1e24"         # Cards, inputs, elevated surfaces
header = "#1a1a20"          # Header backgrounds
accent = "#5b7cfa"          # Primary action color, links
accent_hover = "#4a6ae8"    # Accent hover state
success = "#5dd879"         # Success states, online indicators
danger = "#f87171"          # Error states, destructive actions
text = "#e8e8ed"            # Primary text
text_muted = "#71717a"      # Secondary text, labels
text_secondary = "#a1a1aa"  # Tertiary text, hints
```

### Message Bubbles

```toml
[ui.colors]
bubble_sent_bg = "#3b5998"        # Player's sent messages
bubble_sent_text = "#ffffff"      # Text on sent bubbles
bubble_received_bg = "#262630"    # Received messages
bubble_received_text = "#e8e8ed"  # Text on received bubbles
```

### Learning Highlights

Used for external data values and pedagogical content:

```toml
[ui.colors]
highlight = "#0ea5e9"        # Highlighted values
highlight_hover = "#0284c7"  # Highlight hover state
```

### Opacity Controls

Control transparency of overlays and effects (values: 0-100):

```toml
[ui.colors.opacity]
overlay = 60              # Modal/drawer backdrops
overlay_heavy = 95        # Full overlays (image lightbox)
surface_glass = 95        # Glassmorphism surfaces (notifications)
border_subtle = 8         # Subtle divider lines
border_normal = 20        # Visible borders
hover_light = 10          # Light hover states
hover_medium = 15         # Medium hover states
shadow = 40               # Drop shadows
```

### Glass Effects

Glass effect backgrounds for notification drawer tiles and cards (values: rgba strings):

```toml
[ui.colors.glass]
tile_bg = "rgba(60, 60, 60, 0.7)"     # Tile button background
tile_hover = "rgba(80, 80, 80, 0.9)"  # Tile button hover
card_bg = "rgba(60, 60, 60, 0.9)"     # Notification card background
card_hover = "rgba(80, 80, 80, 0.9)"  # Notification card hover
bar_bg = "rgba(20, 20, 20, 0.5)"      # Bottom bar background
```

## Generated CSS Variables

The build generates these CSS custom properties:

### Solid Colors
```css
--ink-color-bg
--ink-color-surface
--ink-color-header
--ink-color-accent
--ink-color-accent-hover
--ink-color-success
--ink-color-danger
--ink-color-text
--ink-color-text-muted
--ink-color-text-secondary
--ink-bubble-sent-bg
--ink-bubble-sent-text
--ink-bubble-received-bg
--ink-bubble-received-text
--ink-highlight
--ink-highlight-hover
```

### Opacity Variants
```css
--ink-overlay           /* rgba(0, 0, 0, opacity.overlay/100) */
--ink-overlay-heavy     /* rgba(0, 0, 0, opacity.overlay_heavy/100) */
--ink-surface-glass     /* rgba(30, 30, 30, opacity.surface_glass/100) */
--ink-border-subtle     /* rgba(255, 255, 255, opacity.border_subtle/100) */
--ink-border-normal     /* rgba(255, 255, 255, opacity.border_normal/100) */
--ink-hover-light       /* rgba(255, 255, 255, opacity.hover_light/100) */
--ink-hover-medium      /* rgba(255, 255, 255, opacity.hover_medium/100) */
--ink-shadow            /* rgba(0, 0, 0, opacity.shadow/100) */
```

### Glass Effects
```css
--ink-tile-bg           /* glass.tile_bg or default */
--ink-tile-hover        /* glass.tile_hover or default */
--ink-card-bg           /* glass.card_bg or default */
--ink-card-hover        /* glass.card_hover or default */
--ink-bar-bg            /* glass.bar_bg or default */
```

## Validation

The build script validates:
- Color values are valid hex format (`#RRGGBB`)
- Opacity values are 0-100
- Avatar images exist at specified paths

Invalid configuration will fail the build with descriptive error messages.

## Quick Reference

```toml
# Minimal character (auto-derived avatar)
[characters.alex]
display_name = "Alex Chen"
knot_name = "alex_chat"
chat_type = "normal"

# Character with custom color
[characters.pat]
display_name = "Pat"
knot_name = "pat_chat"
chat_type = "normal"
avatar_color_name = "green"

# Character with image avatar
[characters.maya]
display_name = "Maya Torres"
knot_name = "maya_chat"
chat_type = "normal"
avatar_image = "avatars/maya.png"
```

## Testing Changes

After modifying theme colors:

1. Run `mise run build:config`
2. Run `mise run serve`
3. Verify visual changes in browser
4. Run `mise run test:e2e` to ensure no regressions

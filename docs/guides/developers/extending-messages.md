# Extending Message Types

> **Audience:** Framework Developers

How to add new message types (e.g., video, location, contact cards).

---

## Current Message Types

| Type | Description | Rendering |
|------|-------------|-----------|
| `sent` | Player messages | Right-aligned, blue bubble |
| `received` | NPC messages | Left-aligned, gray bubble |
| `system` | Informational | Centered, italic |
| `attachment` | File attachments | File icon + filename |

---

## Adding a New Type

**Complexity:** Advanced

### Step 1: Update Type Definition

In `packages/framework/src/systems/conversation/types.js`:

```javascript
/**
 * @typedef {'sent' | 'received' | 'system' | 'video'} MessageType
 */
```

### Step 2: Add Factory Function

In `packages/framework/src/systems/conversation/types.js`:

```javascript
export function createVideoMessage(text, tags) {
  return {
    kind: 'video',
    text,
    type: tags.type || 'received',
    src: tags.video,
    poster: tags.poster || null,
    timestamp: tags.time,
    speaker: tags.speaker,
  };
}
```

### Step 3: Add Detection

In `parseMessage()` (`packages/framework/src/systems/conversation/types.js`):

```javascript
if (tags.video) return createVideoMessage(text, tags);
```

### Step 4: Add Rendering

In `packages/framework/src/systems/conversation/components/chat-thread/message-bubble.js`, add a render function:

```javascript
export function renderVideoBubble(msg) {
  const type = msg.type || 'received';
  let html = `<div class="message-wrapper" data-type="${type}">`;
  html += `<video-bubble src="${escapeAttr(msg.src)}" type="${type}"></video-bubble>`;
  html += '</div>';
  return html;
}
```

Then add the routing in `index.js` (`renderSingleMessage`):

```javascript
if (msg.kind === 'video') {
  html = renderVideoBubble(msg);
}
```

> **Note:** Timestamp and receipt metadata (`renderMeta`) is applied automatically
> by the orchestrator for all non-text/attachment kinds. Your render function
> does NOT need to handle it — it gets added after your HTML.

### Step 5: Create Component (if needed)

Create `packages/framework/src/systems/conversation/components/video-bubble.js`:

```javascript
export class VideoBubble extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const src = this.getAttribute('src');
    const poster = this.getAttribute('poster');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: var(--ink-image-max-width, 240px);
        }
        video {
          width: 100%;
          border-radius: 12px;
        }
      </style>
      <video
        src="${src}"
        ${poster ? `poster="${poster}"` : ''}
        controls
        playsinline
      ></video>
    `;
  }
}

customElements.define('video-bubble', VideoBubble);
```

### Step 6: Add CSS (if needed)

In `experiences/{impl}/public/css/theme.css` or component shadow DOM.

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/framework/src/systems/conversation/types.js` | Type definition, factory function, detection |
| `packages/framework/src/systems/conversation/components/chat-thread/index.js` | Rendering logic |
| `packages/framework/src/systems/conversation/components/{type}-bubble.js` | New component (if complex) |
| `experiences/{impl}/public/css/theme.css` | Styling (if not in shadow DOM) |

---

## Validation

Manual testing required. No automated tests for new message types.

---

## Example: Adding Location Messages

```ink
# type:sent
# location:40.7128,-74.0060
# location_name:New York City
Sharing my location
```

```javascript
// types.js
export function createLocationMessage(text, tags) {
  const [lat, lng] = tags.location.split(',');
  return {
    kind: 'location',
    text,
    type: tags.type || 'sent',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    locationName: tags.location_name,
    timestamp: tags.time,
  };
}

// In parseMessage()
if (tags.location) return createLocationMessage(text, tags);
```

---

## Example: Link Preview (Real Implementation)

The `linkPreview` message type demonstrates the full pattern with tag handlers and component registration.

### Ink Usage

```ink
# type:sent
# time:10:45 AM
# linkUrl:glossary:soe-database
# linkDomain:eiti.org
# linkTitle:SOE Database
# linkDesc:EITI's database tracking state-owned enterprise payments.
# linkLayout:minimal
```

### Files Modified

| File | Changes |
|------|---------|
| `types.js` | `LinkPreviewMessage` typedef, `createLinkPreviewMessage()`, `isLinkPreviewMessage()`, `parseMessage()` routing |
| `tags/index.js` | Tag handlers for `linkUrl`, `linkDomain`, `linkTitle`, `linkDesc`, `linkImage`, `linkLayout`, `linkVideo` |
| `components/link-preview.js` | Web component with 3 layout variants |
| `components/chat-thread/index.js` | Import component, add `renderLinkPreviewBubble()` call |
| `components/chat-thread/message-bubble.js` | `renderLinkPreviewBubble()` function |
| `conversation/index.js` | Side-effect import for component registration |
| `components/index.js` | Export + add to `expectedElements` array |

### Key Registration Steps

```javascript
// tags/index.js - Add tag handlers
{
  tag: 'linkUrl',
  // Bare domains get https:// prepended (ink treats // as comments)
  handler: (value) => ({
    linkUrl: value.includes(':') ? value : `https://${value}`,
  }),
},

// conversation/index.js - Side-effect import (CRITICAL)
import './components/link-preview.js';

// components/index.js - Export + expectedElements
export { LinkPreview } from './link-preview.js';
const expectedElements = [..., 'link-preview'];
```

---

## Related

- [Writing Guide](../writers/writing-guide.md) - Using message tags
- [Creating a New System](new-system.md) - Tag handler patterns

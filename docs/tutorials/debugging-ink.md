# Debugging Ink State

Inspect and manipulate story variables during development.

**Prerequisites:** Development server running

---

## What You'll Learn

- Using the debug panel
- Inspecting variables in DevTools
- Manipulating state for testing
- Common debugging patterns

---

## Enable Debug Mode

Add `?debug=true` to your URL:

```
http://localhost:8000/experiences/aricanga/?debug=true
```

Or set in your browser console:

```javascript
window.DEBUG_MODE = true;
location.reload();
```

---

## The Debug Panel

With debug mode enabled, a "Debug" button appears in the bottom-right corner.

### Features

**Variables View**
- Shows current values of key story variables
- Boolean variables have toggle buttons
- Updates in real-time as you play

**Quick Actions**
- **Skip to Draft**: Sets `seen_announcement`, `player_agreed`, `research_complete` to true
- **Skip to Publish**: Fast-forward to post-publication state
- **Reset All**: Clear all story flags
- **Trigger All Unread**: Light up all chat notification badges

---

## Console Debugging

### Access the Controller

```javascript
// The controller is exposed globally in debug mode
const ctrl = window.controller;

// Read any variable
ctrl.getVariable('current_chat');      // "pat"
ctrl.getVariable('seen_announcement'); // true

// Get all variables
ctrl.getVariables();
// { current_chat: "pat", seen_announcement: true, ... }
```

### Modify Variables

```javascript
// Set a single variable
ctrl.setVariable('draft_sent', true);

// Set multiple variables
['seen_announcement', 'player_agreed', 'research_complete'].forEach(v => {
  ctrl.setVariable(v, true);
});
```

### Navigate to a Knot

```javascript
// Jump directly to a conversation point
ctrl.goToKnot('pat_chat.ask_angle');
```

### Check Visit Counts

```javascript
// See how many times a knot has been visited
const story = ctrl.getStory();
story.state.VisitCountAtPathString('pat_chat.ask_angle');
```

---

## EventBus Debugging

### View All Events

```javascript
// Log all events
window.eventBus.onAny((event, data) => {
  console.log(`[Event] ${event}`, data);
});
```

### Monitor Specific Events

```javascript
// Watch variable changes
window.eventBus.on('ink:variable-changed', (data) => {
  console.log(`Variable ${data.name}: ${data.oldValue} → ${data.value}`);
});

// Watch chat navigation
window.eventBus.on('chat:opened', (data) => {
  console.log(`Opened chat: ${data.chatId}`);
});
```

---

## Common Debugging Scenarios

### "Why isn't this content showing?"

1. Check the guard condition:
```javascript
ctrl.getVariable('seen_announcement');  // Is this true?
```

2. Check visit count:
```javascript
const story = ctrl.getStory();
story.state.VisitCountAtPathString('pat_chat.ask_angle');  // > 0 means visited
```

3. Manually satisfy conditions:
```javascript
ctrl.setVariable('seen_announcement', true);
```

### "Choices not appearing"

Check if choices were already consumed (ink's `*` vs `+`):

```javascript
// Get current choices
ctrl.getChoices();  // [] if no choices available

// Check if you need to continue the story
ctrl.canContinue();  // true if there's more content
ctrl.continue();     // Advance the story
```

### "State didn't persist"

Check localStorage:

```javascript
// View saved state
localStorage.getItem('ink_save_state');

// Clear and restart
localStorage.removeItem('ink_save_state');
location.reload();
```

---

## Automated Testing Patterns

### Reset Before Each Test

```javascript
// In your test setup
beforeEach(() => {
  localStorage.clear();
  // Or use the controller
  ctrl.reset();
});
```

### Skip to Specific State

```javascript
// Create a helper
function skipTo(state) {
  const states = {
    'announcement_seen': () => {
      ctrl.setVariable('seen_announcement', true);
    },
    'draft_ready': () => {
      ctrl.setVariable('seen_announcement', true);
      ctrl.setVariable('player_agreed', true);
      ctrl.setVariable('research_complete', true);
    },
    'post_publish': () => {
      ctrl.setVariable('seen_announcement', true);
      ctrl.setVariable('player_agreed', true);
      ctrl.setVariable('draft_sent', true);
      ctrl.setVariable('article_published', true);
    }
  };
  states[state]?.();
}

// Usage
skipTo('draft_ready');
```

### Verify State After Actions

```javascript
// After making a choice
await selectChoice('I\'ll take it');

// Verify state changed
expect(ctrl.getVariable('player_agreed')).toBe(true);
```

---

## Debug Panel Customization

For experience-specific debugging, modify `debug-panel.js`:

```javascript
getInterestingVariables(vars) {
  // Add your story's important variables
  const interesting = [
    'current_chat',
    'game_phase',
    // Add custom variables
    'your_custom_flag',
    'another_important_var',
  ];
  // ... rest of method
}

getQuickActions() {
  return [
    // Add custom quick actions
    {
      label: 'Skip to Ending',
      action: () => {
        this.setVariable('final_confrontation', true);
        this.setVariable('evidence_collected', true);
      }
    },
    // ... other actions
  ];
}
```

---

## Checklist

When debugging:

- [ ] Debug mode enabled (`?debug=true`)
- [ ] Check variable values match expectations
- [ ] Verify visit counts for content guards
- [ ] Test with fresh state (clear localStorage)
- [ ] Monitor EventBus for expected events
- [ ] Use Quick Actions to skip to problem areas

---

## What's Next?

- [Testing Time Coherence](./testing-time.md) - Verify temporal consistency
- [Architecture](../concepts/architecture.md) - System design

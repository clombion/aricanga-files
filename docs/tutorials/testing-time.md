# Testing Time Coherence

Verify that message timestamps and story progression are logically consistent.

**Prerequisites:** [Debugging Ink State](./debugging-ink.md)

---

## What You'll Learn

- Time coherence requirements
- Testing temporal consistency
- Common time bugs and fixes
- Automated validation patterns

---

## Time Coherence Rules

### Rule 1: Messages Flow Forward

Within a single chat, timestamps should never go backward:

```ink
// Good - time advances
# time:9:15 AM
First message

# time:9:23 AM
Later message

// Bad - time goes backward
# time:10:00 AM
First message

# time:9:30 AM
Earlier message (WRONG!)
```

### Rule 2: Cross-Chat Consistency

Events triggered in one chat should have appropriate times in another:

```ink
// In news_chat at 9:15 AM
~ seen_announcement = true

// In pat_chat, Pat responds
# time:9:23 AM  // Must be after 9:15 AM
Morning. You see the release?
```

### Rule 3: Seed vs Story Times

- **Seed messages** (before `# story_start`): Use display times like `Yesterday`, `Aug 14`
- **Story messages** (after `# story_start`): Use in-game times like `9:15 AM`, `2:30 PM`

```ink
{pat_chat == 1:
    # time:Yesterday    // Seed - display time
    Good work on that piece
}

# story_start

# time:9:23 AM          // Story - in-game time
Morning. New assignment.
```

---

## Manual Testing

### Playthrough Checklist

1. **Open each chat in sequence** the story expects
2. **Note timestamps** as you progress
3. **Verify forward flow** - no backwards jumps
4. **Check cross-chat triggers** - times align logically

### Test Scenario: Pat's Assignment

1. Open Gov News Wire → See announcement at `9:15 AM`
2. Open Pat → Pat asks about it at `9:23 AM` ✓ (after 9:15)
3. Make choice → Pat responds at `9:23 AM` ✓ (same conversation)
4. Later, check Notes → Task appears with appropriate time

---

## Automated Testing

### Time Extraction Script

Create a script to extract all time tags:

```javascript
// utils/qa/extract-times.js
import { readFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('experiences/aricanga/ink/**/*.ink');

files.forEach(file => {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const match = line.match(/# time:(.+)/);
    if (match) {
      console.log(`${file}:${i + 1} - ${match[1]}`);
    }
  });
});
```

### Time Parsing for Comparison

```javascript
function parseTime(timeStr) {
  // Handle display times
  if (timeStr === 'Yesterday') return -1;
  if (timeStr.match(/^\w+ \d+$/)) return -2;  // "Aug 14"

  // Parse "HH:MM AM/PM"
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;

  let [, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);

  if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Usage
parseTime('9:15 AM');   // 555
parseTime('2:30 PM');   // 870
parseTime('Yesterday'); // -1
```

### Coherence Validation

```javascript
function validateChatCoherence(chatFile) {
  const content = readFileSync(chatFile, 'utf8');
  const times = [];
  let inStory = false;

  content.split('\n').forEach((line, i) => {
    if (line.includes('# story_start')) {
      inStory = true;
      return;
    }

    const match = line.match(/# time:(.+)/);
    if (match && inStory) {
      times.push({
        line: i + 1,
        raw: match[1],
        parsed: parseTime(match[1])
      });
    }
  });

  // Check forward flow
  const issues = [];
  for (let i = 1; i < times.length; i++) {
    if (times[i].parsed < times[i-1].parsed) {
      issues.push({
        message: `Time goes backward: ${times[i-1].raw} → ${times[i].raw}`,
        line: times[i].line
      });
    }
  }

  return issues;
}
```

---

## Common Issues and Fixes

### Issue: Repeated Conversation Has Old Time

**Problem:**
```ink
= ask_angle
{ask_angle > 1: -> ask_angle.choice}

# time:9:23 AM  // Shows old time on revisit
Morning. You see the release?
```

**Fix:** Time tag is on the intro, which only shows first visit. Choices don't need times.

### Issue: Cross-Chat Time Mismatch

**Problem:**
```ink
// Pat sends at 9:23 AM, but...
// ...activist message shows "10:00 AM" even though it's the same moment
```

**Fix:** Set time tag on the cross-chat message itself:
```ink
// In pat_chat - cross-chat message includes time
# targetChat:activist
# speaker:{name("activist", "first_name")}
# time:9:23 AM
# notificationPreview:I saw your article...
I saw your article. Great work on the Aricanga piece.
```

### Issue: Day Boundary Confusion

**Problem:** Events span midnight but times don't reflect this.

**Fix:** Use the `# date:` tag for date changes:
```ink
# date:+1
# time:9:00 AM
Next morning...
```

---

## Test Matrix

Create a timeline document for your story:

| Time | News | Pat | Notes | TonyGov | Activist |
|------|------|-----|-------|---------|----------|
| Day 0 | Seeds | Seeds | Seeds | - | - |
| 9:15 AM | Announcement | - | - | - | - |
| 9:23 AM | - | Asks about story | - | - | - |
| 11:30 AM | - | Checks on draft | - | - | - |
| 2:30 PM | - | Approves draft | Task update | - | - |
| 5:15 PM | - | Article live | - | Contacts | Reacts |

Use this to verify your ink matches the intended timeline.

---

## Running the Test Suite

```bash
# Run time coherence checks
IMPL=aricanga mise run test:time

# Or with the full E2E suite
IMPL=aricanga mise run test:e2e
```

---

## Checklist

For time coherence:

- [ ] Story messages use in-game times (`9:15 AM`)
- [ ] Seed messages use display times (`Yesterday`)
- [ ] Times flow forward within each chat
- [ ] Cross-chat triggers have logical timing
- [ ] Day boundaries use `# date:` tags
- [ ] Timeline matrix documents expected sequence
- [ ] Automated tests verify no backward jumps

---

## What's Next?

- [Writing Guide](../guides/writers/writing-guide.md) - Complete syntax reference
- [QA Tools](../reference/qa-tools.md) - Full testing toolkit

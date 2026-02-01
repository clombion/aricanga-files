// Conversation Plugin Tag Handlers
// Handles ink tags specific to conversation/chat UI

/**
 * Tag handlers for conversation-specific ink tags.
 * These will be registered with the foundation's plugin registry.
 *
 * Each handler transforms tag values into structured data.
 */
export const tagHandlers = [
  // Speaker tag: # speaker:PatEditor
  {
    tag: 'speaker',
    handler: (value, context) => ({ speaker: value }),
  },

  // Type tag: # type:sent, # type:received, # type:system
  {
    tag: 'type',
    handler: (value, context) => ({ type: value }),
  },

  // Delay tag: # delay:1500 (milliseconds)
  {
    tag: 'delay',
    handler: (value, context) => {
      const ms = parseInt(value, 10);
      return { delay: Number.isNaN(ms) ? 0 : ms };
    },
  },

  // Status tag (namespaced): # status:battery:75, # status:signal:3
  {
    tag: 'status',
    handler: (value, context) => {
      const result = context.status || {};
      const colonIdx = value.indexOf(':');

      if (colonIdx > -1) {
        const subKey = value.slice(0, colonIdx).trim();
        const subValue = value.slice(colonIdx + 1).trim();

        // Parse numeric values for battery and signal
        if (subKey === 'battery' || subKey === 'signal') {
          result[subKey] = parseInt(subValue, 10);
        } else {
          result[subKey] = subValue;
        }
      }

      return { status: result };
    },
  },

  // Presence tag: # presence:online, # presence:offline, # presence:lastseen:10:32 AM
  {
    tag: 'presence',
    handler: (value, context) => {
      const status = context.status || {};
      status.presence = value;
      return { status };
    },
  },

  // Time tag: # time:10:41 AM (handled by TimeContext but parsed here)
  {
    tag: 'time',
    handler: (value, context) => ({ time: value }),
  },

  // Duration tag: # duration:30 (minutes to advance)
  {
    tag: 'duration',
    handler: (value, context) => ({ duration: value }),
  },

  // Story start marker: # story_start
  {
    tag: 'story_start',
    handler: (value, context) => ({ story_start: true }),
  },

  // Clear flag: # clear (clear previous messages)
  {
    tag: 'clear',
    handler: (value, context) => ({ clear: true }),
  },

  // Image tag: # image:path/to/image.jpg
  {
    tag: 'image',
    handler: (value, context) => ({ image: value }),
  },

  // Audio tag: # audio:path/to/audio.mp3
  {
    tag: 'audio',
    handler: (value, context) => ({ audio: value }),
  },

  // Notification preview override: # notificationPreview:Custom text here
  {
    tag: 'notificationPreview',
    handler: (value, context) => ({ notificationPreview: value }),
  },

  // Receipt tag: # receipt:read or # receipt:read:labelId (deferred update)
  {
    tag: 'receipt',
    handler: (value, context) => {
      // Check for deferred receipt format: receipt:status:label
      const colonIdx = value.indexOf(':');
      if (colonIdx > -1) {
        const status = value.slice(0, colonIdx).trim();
        const label = value.slice(colonIdx + 1).trim();
        return { receiptDeferred: { status, label } };
      }
      // Simple receipt: receipt:status (applied to current message)
      return { receipt: value };
    },
  },

  // Label tag: # label:unique-id - Mark message as quotable
  {
    tag: 'label',
    handler: (value, context) => ({ label: value }),
  },

  // Quote reference tag: # quoteRef:label-id - Reference existing message (resolved in chat-machine)
  {
    tag: 'quoteRef',
    handler: (value, context) => ({ quoteRef: value }),
  },

  // Inline quote text: # quote:text - For backstory/seeded messages
  {
    tag: 'quote',
    handler: (value, context) => {
      const quote = context.quote || {};
      quote.text = value;
      return { quote };
    },
  },

  // Quote sender: # quoteFrom:Speaker - Original sender for inline quotes
  {
    tag: 'quoteFrom',
    handler: (value, context) => {
      const quote = context.quote || {};
      quote.speaker = value;
      return { quote };
    },
  },

  // Quote image: # quoteImage:path/to/image.jpg - Inline image quote
  {
    tag: 'quoteImage',
    handler: (value, context) => {
      const quote = context.quote || {};
      quote.imageSrc = value;
      return { quote };
    },
  },

  // Quote audio: # quoteAudio:Transcript text - Inline audio quote
  {
    tag: 'quoteAudio',
    handler: (value, context) => {
      const quote = context.quote || {};
      quote.audioTranscript = value;
      return { quote };
    },
  },

  // Link preview URL: # linkUrl:glossary:eiti or # linkUrl:example.com/path
  // Bare domains get https:// prepended (ink treats // as comments, so avoid
  // putting full URLs in tags). Internal links like glossary:id pass through.
  {
    tag: 'linkUrl',
    handler: (value) => ({
      linkUrl: value.includes(':') ? value : `https://${value}`,
    }),
  },

  // Link preview domain: # linkDomain:Glossary
  {
    tag: 'linkDomain',
    handler: (value, context) => ({ linkDomain: value }),
  },

  // Link preview title: # linkTitle:EITI
  {
    tag: 'linkTitle',
    handler: (value, context) => ({ linkTitle: value }),
  },

  // Link preview description: # linkDesc:Extractive Industries Transparency Initiative
  {
    tag: 'linkDesc',
    handler: (value, context) => ({ linkDesc: value }),
  },

  // Link preview image: # linkImage:/assets/icons/glossary.svg
  {
    tag: 'linkImage',
    handler: (value, context) => ({ linkImage: value }),
  },

  // Link preview layout: # linkLayout:card (card|inline|minimal)
  {
    tag: 'linkLayout',
    handler: (value, context) => ({ linkLayout: value }),
  },

  // Link preview video flag: # linkVideo:true
  {
    tag: 'linkVideo',
    handler: (value, context) => ({ linkVideo: value }),
  },
];

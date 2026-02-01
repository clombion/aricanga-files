// {{title}} - Main Story File
// This is the entry point for your narrative

// Include shared variables
INCLUDE variables.ink

// Include chat files
INCLUDE chats/sample.{{locale}}.ink

// ============================================================
// Hub - The starting point
// ============================================================

=== hub ===
// This is where the story begins
// Players will see the chat list and can tap to open conversations

// Signal that we're ready
-> DONE


// ============================================================
// Sample chat - Your first conversation
// ============================================================

=== sample_chat ===
// This knot handles the "Sample Character" chat

// First-time seed messages (shown when chat is first opened)
{sample_chat == 1:
    # speaker:sample
    # type:received
    Hey there! Welcome to your new story.

    # speaker:sample
    # type:received
    This is a sample conversation to get you started.

    ~ sample_unread = false
}

// The conversation continues here
-> sample_conversation

= sample_conversation
# speaker:sample
# type:received
What would you like to talk about?

* [Tell me about this app]
    # speaker:player
    # type:sent
    Tell me about this app.

    # speaker:sample
    # type:received
    This is a smartphone chat experience! You can write branching narratives where players text with characters.

    -> sample_conversation

* [How do I write my story?]
    # speaker:player
    # type:sent
    How do I write my story?

    # speaker:sample
    # type:received
    Edit the ink files in the ink/{{locale}}/chats/ folder to create your conversations.

    # speaker:sample
    # type:received
    Each character gets their own chat file. Use tags like # speaker and # type to style messages.

    -> sample_conversation

* [Goodbye for now]
    # speaker:player
    # type:sent
    Goodbye for now!

    # speaker:sample
    # type:received
    See you later! Good luck with your story.

    -> DONE

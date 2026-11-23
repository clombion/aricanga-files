// The sandbox's message part: the baseline every view part follows. It is a function of one `vm`
// prop, read through `props` so a new view-model reaches it, and holds no state of its own.

import type { JSX } from '@solidjs/web';

/** What the message part shows. */
interface MessageVm {
  readonly text: string;
}

/**
 * One message bubble.
 * @param {object} props The part's props.
 * @param {MessageVm} props.vm The message it shows.
 * @returns {JSX.Element} The bubble.
 */
function Message(props: { readonly vm: MessageVm }): JSX.Element {
  return (
    <p class="bubble" part="bubble">
      {props.vm.text}
    </p>
  );
}

export { Message };
export type { MessageVm };

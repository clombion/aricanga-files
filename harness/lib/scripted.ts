/** The scripted double: it answers only the calls its test scripted, and trips on any other. */

import { trip } from './tripwire.ts';

/** A double that answers only the calls its test scripted: `script` maps each call to its answer. */
class Scripted<Answer> {
  public readonly script: ReadonlyMap<string, Answer>;

  public readonly calls: string[] = [];

  /**
   * A double answering the scripted calls.
   *
   * @param {Readonly<Record<string, Answer>>} script - Each scripted call's answer, by call.
   */
  public constructor(script: Readonly<Record<string, Answer>>) {
    this.script = new Map(Object.entries(script));
  }

  /**
   * The scripted answer to `call`; an unscripted call trips.
   *
   * @param {string} call - The call, as the double's methods name it.
   * @returns {Answer} The scripted answer.
   */
  public answer(call: string): Answer {
    this.calls.push(call);
    const scripted = this.script.get(call);
    if (scripted === undefined) {
      return trip(`${this.constructor.name} got an unscripted call ${JSON.stringify(call)}`);
    }
    return scripted;
  }
}

export { Scripted };

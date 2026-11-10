/**
 * REQ-IAM-014, DEC-93: the contract every record type passes. For each case (one user on one record),
 * every action in the record's `allowedActions` is accepted by the API and every other action of the
 * record type is refused with 403. A record type lists its cases and how to send an action; the send
 * must not change the record for the next action (use a fresh record per send, or a dry run).
 */
export interface ContractCase<Action extends string> {
  /** Who on what, for the failure message: "Planner on its own Pending SPK". */
  label: string;
  /** The `allowedActions` of the record as this user reads it. */
  listed: () => Promise<readonly Action[]>;
  /** Sends the action as this user and answers the HTTP status. */
  send: (action: Action) => Promise<number>;
}

const FORBIDDEN = 403;

export async function findContractBreaks<Action extends string>(
  actions: readonly Action[],
  cases: readonly ContractCase<Action>[],
): Promise<string[]> {
  const breaks: string[] = [];
  for (const { label, listed, send } of cases) {
    const offered = new Set(await listed());
    for (const unknown of [...offered].filter((action) => !actions.includes(action))) {
      breaks.push(`${label}: lists "${unknown}", which is not an action of this record type`);
    }
    for (const action of actions) {
      const status = await send(action);
      const accepted = status >= 200 && status < 300;
      if (offered.has(action) && !accepted) {
        breaks.push(`${label}: "${action}" is listed but the API answered ${status}`);
      }
      if (!offered.has(action) && status !== FORBIDDEN) {
        breaks.push(`${label}: "${action}" is not listed but the API answered ${status}`);
      }
    }
  }
  return breaks;
}

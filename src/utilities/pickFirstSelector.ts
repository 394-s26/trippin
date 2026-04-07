import { UserSelection } from '../hooks/useSessionSelections';

/**
 * Among all users who selected `eventId`, return the one who added it
 * earliest (lowest index in their `selectedIds` array). Ties broken by
 * lexicographic uid for deterministic results across clients.
 *
 * Pass `excludeUid` to ignore a specific user (e.g. the current viewer).
 */
export function pickFirstSelector(
  selections: UserSelection[],
  eventId: string,
  excludeUid?: string,
): UserSelection | undefined {
  let best: UserSelection | undefined;
  let bestIdx = Infinity;

  for (const s of selections) {
    if (excludeUid && s.uid === excludeUid) continue;
    const idx = s.selectedIds.indexOf(eventId);
    if (idx === -1) continue;
    if (idx < bestIdx || (idx === bestIdx && best && s.uid < best.uid)) {
      best = s;
      bestIdx = idx;
    }
  }

  return best;
}

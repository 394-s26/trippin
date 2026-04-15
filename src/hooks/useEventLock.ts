import { useEffect, useRef } from 'react';
import { heartbeatEventLock, releaseEventLock } from '../services/firestoreEventsService';

const HEARTBEAT_MS = 20_000;

// Owns the heartbeat lifecycle for an event edit lock.
// While `enabled` is true, sends a heartbeat every 20s to extend the lock TTL.
// If the server says the lock was stolen, invokes `onStolen` so the caller can
// downgrade the UI to read-only. Also best-effort releases on window unload.
export function useEventLock(
  tripId: string,
  eventId: string | null,
  uid: string | undefined,
  enabled: boolean,
  onStolen: () => void,
) {
  const onStolenRef = useRef(onStolen);
  onStolenRef.current = onStolen;

  useEffect(() => {
    if (!enabled || !eventId || !uid) return;

    let cancelled = false;

    const tick = async () => {
      const stillHeld = await heartbeatEventLock(tripId, eventId, uid);
      if (!cancelled && !stillHeld) onStolenRef.current();
    };

    const interval = window.setInterval(tick, HEARTBEAT_MS);

    const handleUnload = () => {
      releaseEventLock(tripId, eventId, uid).catch(() => { /* best effort */ });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [tripId, eventId, uid, enabled]);
}

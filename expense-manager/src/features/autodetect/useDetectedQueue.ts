import { useState, useEffect, useCallback } from 'react';
import {
  DetectedCandidate,
  getDetectedQueue,
  dismissDetected,
  clearDetected,
  subscribeDetected,
} from './detection';

/** Reactive view of the detected-transaction review queue. */
export function useDetectedQueue() {
  const [queue, setQueue] = useState<DetectedCandidate[]>(() => getDetectedQueue());

  const refresh = useCallback(() => setQueue(getDetectedQueue()), []);

  useEffect(() => {
    refresh();
    return subscribeDetected(refresh);
  }, [refresh]);

  const dismiss = useCallback((id: string) => dismissDetected(id), []);
  const clear = useCallback(() => clearDetected(), []);

  return { queue, count: queue.length, dismiss, clear, refresh };
}

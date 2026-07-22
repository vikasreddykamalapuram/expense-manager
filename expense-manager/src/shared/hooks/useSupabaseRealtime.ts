/**
 * React hook for Supabase Realtime state.
 * Provides reactive access to realtime connection status and event counts.
 */

import { useState, useEffect } from 'react';
import {
  getRealtimeState,
  onRealtimeStateChange,
  startRealtimeSync,
  stopRealtimeSync,
} from '../services/supabaseRealtimeService';

export function useSupabaseRealtime() {
  const [state, setState] = useState(getRealtimeState);

  useEffect(() => {
    const unsubscribe = onRealtimeStateChange(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
    startRealtimeSync,
    stopRealtimeSync,
  };
}

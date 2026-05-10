/**
 * Wrapper that connects SyncProvider to AppContext's activeProfileId.
 * This must be rendered inside AppProvider.
 */
import { ReactNode } from 'react';
import { SyncProvider } from './SyncContext';
import { useAppContext } from './AppContext';

export function SyncProviderWrapper({ children }: { children: ReactNode }) {
  const { state } = useAppContext();
  return (
    <SyncProvider profileId={state.activeProfileId}>
      {children}
    </SyncProvider>
  );
}

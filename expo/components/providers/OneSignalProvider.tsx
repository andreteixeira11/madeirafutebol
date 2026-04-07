import React, { useEffect } from 'react';
import { initializeOneSignal } from '@/utils/onesignal';

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initializeOneSignal().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown OneSignal initialization error';
      console.log(`[OneSignal] Initialization failed: ${message}`);
    });
  }, []);

  return <>{children}</>;
}

import React, { useEffect } from 'react';
import {
  initializeOneSignal,
  markOneSignalPermissionPrompted,
  requestOneSignalPermission,
  shouldPromptOneSignalPermission,
} from '@/utils/onesignal';

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initializeOneSignal()
      .then(async () => {
        if (!shouldPromptOneSignalPermission()) {
          console.log('[OneSignal] Permission prompt already handled previously');
          return;
        }

        markOneSignalPermissionPrompted();
        await requestOneSignalPermission();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown OneSignal initialization error';
        console.log(`[OneSignal] Initialization failed: ${message}`);
      });
  }, []);

  return <>{children}</>;
}

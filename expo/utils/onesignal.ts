import { Platform } from 'react-native';

const ONE_SIGNAL_APP_ID = '7a50e38a-ae5f-4107-b1f9-3f0b052824d8';
const ONE_SIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const ONE_SIGNAL_WORKER_PATH = '/OneSignalSDKWorker.js';
const ONE_SIGNAL_UPDATER_WORKER_PATH = '/OneSignalSDKUpdaterWorker.js';

type OneSignalWebInstance = {
  init: (options: {
    appId: string;
    allowLocalhostAsSecureOrigin?: boolean;
    serviceWorkerPath?: string;
    serviceWorkerParam?: { scope: string };
    serviceWorkerUpdaterPath?: string;
    welcomeNotification?: { disable?: boolean };
    notifyButton?: { enable?: boolean };
  }) => Promise<void>;
  Notifications?: {
    permissionNative?: NotificationPermission;
    requestPermission?: () => Promise<void>;
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalWebInstance) => void | Promise<void>>;
    __ONE_SIGNAL_SCRIPT_LOADING__?: Promise<void>;
    __ONE_SIGNAL_INITIALIZED__?: boolean;
  }
}

async function loadOneSignalScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (window.__ONE_SIGNAL_SCRIPT_LOADING__) {
    await window.__ONE_SIGNAL_SCRIPT_LOADING__;
    return;
  }

  window.__ONE_SIGNAL_SCRIPT_LOADING__ = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${ONE_SIGNAL_SDK_URL}"]`);

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load OneSignal SDK')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = ONE_SIGNAL_SDK_URL;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
    document.head.appendChild(script);
  });

  await window.__ONE_SIGNAL_SCRIPT_LOADING__;
}

export async function initializeOneSignal(): Promise<void> {
  if (Platform.OS !== 'web') {
    console.log('[OneSignal] Native push setup is not available in Expo Go. Skipping native initialization.');
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  if (window.__ONE_SIGNAL_INITIALIZED__) {
    console.log('[OneSignal] Already initialized');
    return;
  }

  await loadOneSignalScript();

  window.OneSignalDeferred = window.OneSignalDeferred ?? [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalWebInstance) => {
    if (window.__ONE_SIGNAL_INITIALIZED__) {
      return;
    }

    console.log('[OneSignal] Initializing web push');
    await OneSignal.init({
      appId: ONE_SIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: ONE_SIGNAL_WORKER_PATH,
      serviceWorkerUpdaterPath: ONE_SIGNAL_UPDATER_WORKER_PATH,
      serviceWorkerParam: { scope: '/' },
      notifyButton: { enable: false },
      welcomeNotification: { disable: true },
    });
    window.__ONE_SIGNAL_INITIALIZED__ = true;
    console.log('[OneSignal] Web push initialized');
  });
}

export async function requestOneSignalPermission(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    console.log('[OneSignal] Permission request skipped outside web');
    return;
  }

  await initializeOneSignal();

  window.OneSignalDeferred = window.OneSignalDeferred ?? [];
  window.OneSignalDeferred.push(async (OneSignal: OneSignalWebInstance) => {
    const currentPermission = OneSignal.Notifications?.permissionNative ?? 'default';
    console.log(`[OneSignal] Current notification permission: ${currentPermission}`);

    if (currentPermission === 'default') {
      await OneSignal.Notifications?.requestPermission?.();
      console.log('[OneSignal] Permission prompt requested');
    }
  });
}

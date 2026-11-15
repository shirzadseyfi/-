export type BrowserNotificationPermissionState =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

export interface DesktopNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  critical?: boolean;
  enabled?: boolean;
  onClick?: () => void;
}

export function isDesktopNotificationSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof window.Notification === 'function'
    );
  } catch {
    return false;
  }
}

export function getDesktopNotificationPermission(): BrowserNotificationPermissionState {
  if (!isDesktopNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const perm = window.Notification.permission;
    if (perm === 'granted' || perm === 'denied' || perm === 'default') {
      return perm;
    }
    return 'default';
  } catch {
    return 'unsupported';
  }
}

export async function requestDesktopNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (!isDesktopNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const current = window.Notification.permission;
    if (current === 'granted' || current === 'denied') {
      return current;
    }

    const result = await new Promise<NotificationPermission>((resolve) => {
      try {
        const maybePromise = window.Notification.requestPermission((legacyPerm) => {
          resolve(legacyPerm);
        });
        if (maybePromise && typeof (maybePromise as Promise<NotificationPermission>).then === 'function') {
          (maybePromise as Promise<NotificationPermission>).then(resolve).catch(() => resolve('denied'));
        }
      } catch {
        resolve('denied');
      }
    });

    if (result === 'granted' || result === 'denied' || result === 'default') {
      return result;
    }
    return getDesktopNotificationPermission();
  } catch {
    return 'denied';
  }
}

export function sendDesktopNotification(payload: DesktopNotificationPayload): boolean {
  if (payload.enabled === false) {
    return false;
  }
  if (!isDesktopNotificationSupported()) {
    return false;
  }
  if (getDesktopNotificationPermission() !== 'granted') {
    return false;
  }

  try {
    const notification = new window.Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      dir: 'rtl',
      lang: 'fa-IR',
      requireInteraction: Boolean(payload.critical),
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore focus restrictions in sandboxed environments
      }
      try {
        payload.onClick?.();
      } finally {
        try {
          notification.close();
        } catch {
          // ignore close errors
        }
      }
    };

    const autoCloseMs = payload.critical ? 12000 : 7500;
    if (typeof window.setTimeout === 'function') {
      window.setTimeout(() => {
        try {
          notification.close();
        } catch {
          // ignore close errors
        }
      }, autoCloseMs);
    }

    return true;
  } catch {
    return false;
  }
}

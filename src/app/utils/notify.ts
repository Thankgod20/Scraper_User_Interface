// ./utils/notify.ts
export function notify(title: string, options?: NotificationOptions) {
    if (typeof window === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }
  
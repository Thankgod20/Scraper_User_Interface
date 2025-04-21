// ./hooks/useNotification.ts
import { useEffect } from 'react';

export function useNotificationPermission() {
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);
}

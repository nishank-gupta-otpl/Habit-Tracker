/* eslint-env serviceworker */
/* global clients */

// Imported into the Workbox-generated service worker (see vite.config.js).
// Handles what Workbox doesn't: notification clicks and incoming FCM pushes.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  // Focus an existing window if the app is already open, rather than piling up
  // duplicate tabs every time a reminder is tapped.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', data: event.notification.data });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});

// Fires when a scheduled TimestampTrigger notification is dismissed without a
// tap. Nothing to do, but the handler keeps the SW alive long enough to log.
self.addEventListener('notificationclose', () => {});

// Background push, for when the owner upgrades to the Blaze plan and adds the
// scheduled Cloud Function described in the README. Harmless until then.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'Momentum', body: event.data.text() } };
  }
  const notification = payload.notification || {};
  event.waitUntil(
    self.registration.showNotification(notification.title || 'Momentum', {
      body: notification.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { momentum: true, url: payload.data?.url || '/' },
    }),
  );
});

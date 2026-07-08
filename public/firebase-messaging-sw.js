importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC04c_cA4SrizMvvF67iMq9pkbiQ3wrq8I',
  authDomain: 'ongo-36a8f.firebaseapp.com',
  projectId: 'ongo-36a8f',
  storageBucket: 'ongo-36a8f.firebasestorage.app',
  messagingSenderId: '202088353904',
  appId: '1:202088353904:web:2f3e58f8873c531608a4b5',
  measurementId: 'G-VDNR84WY3B'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'OnGo';
  const body = payload.notification?.body || payload.data?.body || 'Nueva notificación';

  self.registration.showNotification(title, {
    body,
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-192x192.png',
    vibrate: [300, 120, 300],
    requireInteraction: true,
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/maps';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return clients.openWindow(url);
    })
  );
});
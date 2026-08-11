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
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [300, 120, 300],
    tag: payload.data?.notificationId || undefined,
    silent: false,
    requireInteraction: true,
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const candidate = typeof data.route === 'string'
    ? data.route
    : typeof data.url === 'string' ? data.url : '';
  const allowedRoutes = [
    /^\/maps$/,
    /^\/matches$/,
    /^\/chat$/,
    /^\/chat-detail\/[A-Za-z0-9_-]+$/,
    /^\/my-orders$/,
    /^\/partner-pending-orders$/,
    /^\/wallet-history$/,
    /^\/wallet-partner$/,
    /^\/profile(?:-local)?$/,
    /^\/home-local$/,
    /^\/notifications$/
  ];
  const typeRoutes = {
    test_notification: '/notifications',
    new_match: '/matches',
    match: '/matches',
    wallet_recharge_approved: '/wallet-history',
    wallet_recharge_rejected: '/wallet-history',
    reservation_confirmed: '/my-orders',
    reservation_cancelled: '/my-orders',
    order_accepted: '/my-orders',
    order_ready: '/my-orders',
    order_cancelled: '/my-orders'
  };
  let url = typeRoutes[data.type] || '/notifications';

  try {
    if (!candidate) throw new Error('No explicit route');
    const parsed = new URL(candidate, self.location.origin);
    if (parsed.origin === self.location.origin && allowedRoutes.some(pattern => pattern.test(parsed.pathname))) {
      url = parsed.pathname;
    }
  } catch {}

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

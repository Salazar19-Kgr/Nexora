// Service worker del panel: muestra el aviso cuando llega un push y abre el panel al tocarlo.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  e.waitUntil(self.registration.showNotification('NEXORA · Panel', {
    body: 'Tienes pagos por revisar. Toca para abrir.', icon: '/img/icon-192.png', badge: '/img/icon-192.png',
    tag: 'nx-pago', renotify: true, requireInteraction: true, vibrate: [200, 100, 200], data: { url: '/admin' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].url.indexOf('/admin') > -1 && 'focus' in list[i]) return list[i].focus();
    return self.clients.openWindow('/admin');
  }));
});

// Service Worker for SolarCRM Web Push Notifications
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Handle incoming background Push Notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || 'SolarCRM Alert';
        const options = {
            body: data.body || 'You have a new update in SolarCRM.',
            icon: data.icon || '/favicon.png',
            badge: '/favicon.png',
            vibrate: [200, 100, 200],
            tag: data.tag || 'solarcrm-notif',
            renotify: true,
            data: {
                url: data.url || '/home'
            }
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (err) {
        console.error('Error handling push event:', err);
    }
});

// Handle tap / click on native Notification Banner
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/home';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

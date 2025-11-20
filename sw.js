const CACHE_NAME = 'nova-planner-v1';
const urlsToCache = [
  '/Nova-AI-Planer/',
  '/Nova-AI-Planer/assets/index.css',
  '/Nova-AI-Planer/assets/index.js',
  '/Nova-AI-Planer/nova-192.png',
  '/Nova-AI-Planer/nova-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 푸시 알림 수신
self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nova 앱에서 알림이 도착했습니다.',
      icon: '/Nova-AI-Planer/nova-192.svg',
      badge: '/Nova-AI-Planer/nova-192.svg',
      tag: data.tag || 'nova-notification',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [
        { action: 'open', title: '열기' },
        { action: 'close', title: '닫기' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Nova', options)
    );
  } catch (e) {
    console.error('Error handling push notification:', e);
  }
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function(clientList) {
        // 이미 열려있는 윈도우가 있으면 포커스
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].url === '/' && 'focus' in clientList[i]) {
            return clientList[i].focus();
          }
        }
        // 없으면 새 윈도우 열기
        if (clients.openWindow) {
          return clients.openWindow('/Nova-AI-Planer/');
        }
      })
    );
  }
});

// 알림 닫기 이벤트
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event.notification.tag);
});

// 클라이언트에서 보낸 메시지 처리 (테스트 알림용)
self.addEventListener('message', function(event) {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    console.log('Showing notification:', title, options);
    
    self.registration.showNotification(title, {
      icon: '/Nova-AI-Planer/favicon.svg',
      badge: '/Nova-AI-Planer/favicon.svg',
      ...options
    }).catch(err => {
      console.error('Failed to show notification:', err);
    });
  }
});
// Service Worker for Étoile & Crépuscule
const CACHE_NAME = "etoile-crepuscule-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/images/stars.svg",
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Network falling back to cache)
self.addEventListener("fetch", (event) => {
  // We only cache GET requests and skip API calls
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clonedResponse);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push Event
self.addEventListener("push", (event) => {
  let data = { title: "Nouveau message", body: "Tu as reçu un mot doux..." };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Nouveau message", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=192&h=192&q=80",
    badge: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=192&h=192&q=80",
    vibrate: [100, 50, 100],
    data: {
      url: "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })
  );
});

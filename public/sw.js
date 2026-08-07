/* Élite BCN service worker.
 *
 * Scope is deliberately narrow: push notifications, and an offline fallback for
 * navigations. It does NOT cache pages or API responses. Prices, availability
 * and booking state must never be served from a stale cache — a customer shown
 * a cached fare that no longer applies is worse than a customer shown nothing.
 */

const OFFLINE_URL = "/offline.html";
const CACHE = "elitebcn-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Network-only, with the offline page as a fallback for navigations. */
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Élite BCN", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Élite BCN Transfers";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "elitebcn",
      renotify: true,
      data: { url: data.url || "/dashboard/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  // Focus an existing tab if one is already open rather than piling up windows.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

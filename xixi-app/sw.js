/* 茜茜的小岛 · 离线缓存 Service Worker
   - 站点自身文件：先走网络（保证拿到新版本），网络不行就用缓存
   - 外站资源（B 站视频、图片等）：不插手，交给浏览器
   - 新版本发布后：自动接管并提示刷新 */
const CACHE = "xixi-island-v29";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-180.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;          // 外链（B站等）不缓存
  if (url.pathname.endsWith("/sw.js")) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const net = await fetch(req);
      if (net && net.status === 200 && (net.type === "basic" || net.type === "default")) {
        cache.put(req, net.clone()).catch(() => {});
      }
      return net;
    } catch (_) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") {
        const shell = await cache.match("./index.html");
        if (shell) return shell;
      }
      return new Response("离线了，先连一下网络吧～", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});

/* 主线程可发消息强制更新 */
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

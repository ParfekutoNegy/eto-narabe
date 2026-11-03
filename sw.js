/* =====================================
   干支並べ Service Worker
===================================== */

const CACHE_NAME = "eto-narabe-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];


// =====================================
// インストール
// =====================================

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );

});


// =====================================
// 有効化・古いキャッシュ削除
// =====================================

self.addEventListener("activate", event => {

  event.waitUntil(
    (async () => {

      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();

    })()
  );

});


// =====================================
// ファイル読み込み
// ネットワーク優先
// =====================================

self.addEventListener("fetch", event => {

  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 別サイトの通信は対象外
  if (url.origin !== self.location.origin) {
    return;
  }

  // このアプリの範囲だけを対象にする
  const scope = self.registration.scope;

  if (!url.href.startsWith(scope)) {
    return;
  }

  event.respondWith(
    (async () => {

      const cache = await caches.open(CACHE_NAME);

      try {

        // 通信できる場合は最新ファイルを取得
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(request, response.clone());
        }

        return response;

      } catch (error) {

        // オフライン時は保存済みファイルを使用
        const cached = await cache.match(request);

        if (cached) {
          return cached;
        }

        // ページ遷移ならトップページを返す
        if (request.mode === "navigate") {

          const fallback =
            await cache.match("./index.html");

          if (fallback) {
            return fallback;
          }

        }

        return Response.error();

      }

    })()
  );

});
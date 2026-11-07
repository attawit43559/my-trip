/* My Trip — keeps the app itself on the phone so it opens without internet.
 * The page: network first (so updates arrive), the saved copy when offline or slow.
 * The app's own scripts: network first too. Fonts, icons and the PDF/viewer libraries: the saved copy straight away, refreshed in the background.
 * Trip data lives in the page's own storage; the backend (Apps Script), sign-in, Drive and weather are never touched here. */
const CACHE = "mytrip-shell-v1";
const SHELL = ["./", "./index.html", "./plan-export.js", "./lang-en.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./icons/icon-512.png"];
const KEEP = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("mytrip-shell-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function pageFirst(req){
  return caches.open(CACHE).then(c => new Promise(resolve => {
    let done = false;
    const fallback = () => c.match("./index.html").then(r => r || c.match("./")).then(r => { if(!done && r){ done = true; resolve(r); } });
    const timer = setTimeout(fallback, 3500);               // slow roaming: show the saved copy instead of a blank screen
    fetch(req).then(res => {
      clearTimeout(timer);
      if(res && res.ok) c.put("./index.html", res.clone());
      if(!done){ done = true; resolve(res); }
    }).catch(() => { clearTimeout(timer); fallback().then(() => { if(!done){ done = true; resolve(Response.error()); } }); });
  }));
}
function netFirst(req){
  return caches.open(CACHE).then(c => fetch(req).then(res => { if(res && res.ok) c.put(req, res.clone()); return res; })
    .catch(() => c.match(req, {ignoreSearch: true}).then(hit => hit || Response.error())));
}
function savedFirst(req){
  return caches.open(CACHE).then(c => c.match(req, {ignoreSearch: true}).then(hit => {
    const net = fetch(req).then(res => { if(res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}

/* Android: the installed app is in the share menu; what is shared arrives here, is kept for the page, and the page opens */
async function takeShare(req){
  const f = await req.formData();
  const c = await caches.open("mytrip-share");
  for(const k of await c.keys()) await c.delete(k);
  const files = f.getAll("files").filter(x => x && typeof x === "object" && x.size).slice(0, 5);
  const text = [f.get("title"), f.get("text"), f.get("url")].filter(Boolean).join("\n");
  await c.put("./__share/meta", new Response(JSON.stringify({text, n: files.length, at: Date.now()}), {headers: {"content-type": "application/json"}}));
  await Promise.all(files.map((x, i) => c.put("./__share/f" + i, new Response(x, {headers: {"content-type": x.type || "application/octet-stream"}}))));
  return Response.redirect("./?share-in=1", 303);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")){ e.respondWith(takeShare(req).catch(() => Response.redirect("./?share-in=0", 303))); return; }
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if(same && /\/(index\.html)?$/.test(url.pathname)){ e.respondWith(pageFirst(req)); return; }
  if(same && req.mode === "navigate"){ e.respondWith(netFirst(req)); return; }   // other pages (privacy) as they are
  if(same && url.pathname.endsWith(".js") && !url.pathname.endsWith("/sw.js")){ e.respondWith(netFirst(req)); return; }   // a new version of the export script is used as soon as it is out
  if(same && /\.(png|svg|webmanifest|json)$/.test(url.pathname)){ e.respondWith(savedFirst(req)); return; }
  if(KEEP.test(req.url)){ e.respondWith(savedFirst(req)); return; }
});

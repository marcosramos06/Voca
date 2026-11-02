/* Offline support. App files open instantly from the cache and refresh in the background. */
const CACHE="voca-v4";
const SHELL=["/","/index.html","/styles.css","/lang/pt.js","/lang/fr.js","/auth.js","/partner.js","/app.js","/manifest.webmanifest","/motif-pt.svg","/motif-fr.svg","/icons/icon-192.png","/icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=="GET"||url.pathname.startsWith("/api/"))return;
  const font=url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com";
  if(url.origin!==self.location.origin&&!font)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const key=req.mode==="navigate"?"/index.html":req;
    const hit=await cache.match(key,{ignoreSearch:req.mode==="navigate"});
    const update=fetch(req).then(r=>{if(r&&(r.ok||r.type==="opaque"))cache.put(key,r.clone());return r});
    if(hit){e.waitUntil(update.catch(()=>{}));return hit}
    return update;
  })());
});

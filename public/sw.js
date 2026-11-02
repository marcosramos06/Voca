/* Offline support. Each open fetches the latest app and falls back to the saved copy when offline. */
const CACHE="voca-v6";
const SHELL=["/","/index.html","/styles.css","/lang/pt.js","/lang/fr.js","/auth.js","/memory.js","/voice.js","/partner.js","/app.js","/manifest.webmanifest","/motif-pt.svg","/motif-fr.svg","/icons/icon-192.png","/icons/apple-touch-icon.png"];
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
    if(font){const hit=await cache.match(key);if(hit)return hit}
    try{
      const r=await fetch(req);
      if(r&&(r.ok||r.type==="opaque"))cache.put(key,r.clone());
      return r;
    }catch(err){
      const hit=await cache.match(key,{ignoreSearch:true});
      if(hit)return hit;
      throw err;
    }
  })());
});

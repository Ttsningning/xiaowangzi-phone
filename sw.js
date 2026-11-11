// 月光海小手机：离线缓存。先用缓存秒开，同时后台拉新版本，下次打开生效。
const C='little-prince-v2';
const SHELL=['./','./index.html','./world-market.js','./world-market.css','./manifest.json','./icon.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('little-prince-')&&k!==C)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(C);
    const hit=await c.match(r,{ignoreSearch:true});
    // Content-hashed game assets never change in place; reuse their cache offline.
    if(hit&&/\/games\/denglin-assets\/[a-f0-9]+\.(webp|m4a)$/.test(new URL(r.url).pathname))return hit;
    const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res});
    if(hit){e.waitUntil(net.catch(()=>{}));return hit}
    try{return await net}catch(err){if(r.mode==='navigate'){const home=await c.match('./');if(home)return home}return Response.error()}
  })());
});

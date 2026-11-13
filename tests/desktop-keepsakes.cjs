const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom'),{indexedDB}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['world-market.js','keepsakes.js'])html=html.replace(`<script src="${file}"></script>`,()=>'<script>'+fs.readFileSync(path.join(root,file),'utf8')+'</script>');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented/.test(e.message))errors.push(e.message)});
const boot=()=>new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};w.fetch=async()=>{throw Error('No paid API calls in tests')};}});
const ready=()=>new Promise(r=>setTimeout(r,800));let dom;
(async()=>{
 dom=boot();await ready();let w=dom.window;
 // The broken release had marked migration done, while the album shortcut was missing.
 await w.eval(`(async()=>{S.home.keepsakesApps=true;delete S.home.albumDesktopV2;for(const page of S.home.pages)for(let i=page.length-1;i>=0;i--)if(page[i].app==='album')page.splice(i,1);S.home.known.push('album');S.home.pages[0].push({id:'user-placement',type:'app',app:'shop',r:2,c:0});await save('home')})()`);
 dom.window.close();dom=boot();await ready();w=dom.window;
 assert.equal(w.eval('S.home.pages.flat().filter(x=>x.app==="album").length'),1);assert.equal(w.eval('S.home.albumDesktopV2'),true);assert.ok(w.eval('S.home.pages.flat().some(x=>x.id==="user-placement")'));
 console.log('PASS repairs old missing album without resetting desktop');
 w.eval('renderHome();renderWS()');
 assert.ok(w.document.querySelector('#hpages [data-app=album]'));assert.equal(w.document.querySelector('#wsList [data-addapp=album]'),null);
 assert.ok(w.document.querySelector('#dock [data-app=memory] .ico img'));assert.equal(w.document.querySelector('#dock [data-app=memory] .ico .ks-sprite'),null);
 assert.equal(w.document.querySelector('#dock [data-app=memory] .ico img').getAttribute('src'),'themes/prince/deco/i-book.webp');
 assert.equal(w.document.querySelector('#hpages [data-app=album] .ico img').getAttribute('src'),'themes/prince/ui/photo.webp');
 console.log('PASS visible image icons replace dock-hidden sprite and white JPEG sheet');
 await w.eval('save("home")');dom.window.close();dom=boot();await ready();w=dom.window;
 assert.equal(w.eval('S.home.pages.flat().filter(x=>x.app==="album").length'),1);w.eval('homeMigrate();renderHome()');assert.ok(w.document.querySelector('#hpages [data-app=album]'));
 console.log('PASS album survives a full reopen without duplication');
 // Later deliberate user removal is respected after this one-time repair.
 await w.eval(`(async()=>{for(const page of S.home.pages)for(let i=page.length-1;i>=0;i--)if(page[i].app==='album')page.splice(i,1);await save('home')})()`);dom.window.close();dom=boot();await ready();w=dom.window;
 assert.equal(w.eval('S.home.pages.flat().filter(x=>x.app==="album").length'),0);
 console.log('PASS one-time repair respects later deliberate removal');
 assert.deepEqual(errors,[]);console.log('PASS no runtime errors');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>dom?.window.close());

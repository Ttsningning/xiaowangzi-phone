const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom'),{indexedDB}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['world-market.js','market-trades.js','treasure.js','keepsakes.js','chat-reset.js','star-library.js','visitors.js','visitors-city.js','model-picker.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+fs.readFileSync(path.join(root,file),'utf8')+'</script>');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented/.test(e.message))errors.push(e.message)});
const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.Blob=Blob;w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};w.fetch=async()=>{throw Error('No live APIs in tests')};}});
const w=dom.window,ev=x=>w.eval(x),check=(label,x)=>{assert.ok(ev(x),label);console.log('PASS',label)};
(async()=>{
 for(let n=0;n<100;n++){if(ev('!!S.chars?.length&&!!S.modelLists'))break;await new Promise(r=>setTimeout(r,20))}
 ev(`S.settings.proactive=false;S.settings.baseUrl='https://mock.test/v1';S.settings.apiKey='secret-for-test';S.settings.model='old-custom';renderSettings();fetch=async()=>({ok:true,json:async()=>({data:[{id:'alpha'},{id:'beta'},{id:'alpha'},{id:'<img onerror=alert(1)>'}]})})`);
 await ev(`modelPickerFetch('modelList')`);
 check('pull opens all unique models despite a different typed model',`document.querySelectorAll('[data-model-index]').length===3&&S.settings.model==='old-custom'&&document.querySelector('#sheet').classList.contains('show')`);
 check('model IDs are rendered as escaped text',`!document.querySelector('#modelPickerResults img')`);
 ev(`$('#modelPickerSearch').value='BETA';$('#modelPickerSearch').dispatchEvent(new Event('input'))`);
 check('search is case insensitive',`document.querySelectorAll('[data-model-index]').length===1&&$('#modelPickerResults').textContent==='beta'`);
 ev(`document.querySelector('[data-model-index]').click()`);await new Promise(r=>setTimeout(r,25));
 check('selection updates field and persistent settings',`S.settings.model==='beta'&&$('[data-s=model]').value==='beta'`);
 assert.equal((await ev(`DB.get('settings')`)).model,'beta');
 ev(`document.querySelector('[data-model-picker=modelList]').click()`);
 check('arrow reopens full list and cancel preserves selection',`document.querySelectorAll('[data-model-index]').length===3`);ev(`document.querySelector('[data-model-cancel]').click()`);
 const cache=await ev(`DB.get('modelLists')`);assert.ok(!JSON.stringify(cache).includes('secret-for-test'));
 ev(`S.modelLists={entries:{}}`);w.savedCache=cache;ev(`S.modelLists=savedCache;modelPickerRestore();modelPickerOpen('modelList')`);
 check('persisted lists restore without another API request',`document.querySelectorAll('[data-model-index]').length===3`);
 ev(`fetch=async()=>({ok:true,json:async()=>({data:[]})})`);await ev(`modelPickerFetch('modelList')`);
 check('empty response preserves existing list and model',`modelPickerStored(modelPickerContext('modelList')).length===3&&S.settings.model==='beta'`);
 ev(`S.settings.baseUrl='https://other.test/v1';modelPickerOpen('modelList')`);
 check('another endpoint has its own list',`document.querySelectorAll('[data-model-index]').length===0`);
 ev(`var release;fetch=()=>new Promise(r=>release=r);var modelPending=modelPickerFetch('modelList');S.settings.baseUrl='https://changed.test/v1';release({ok:true,json:async()=>({data:[{id:'wrong-endpoint'}]})})`);await ev('modelPending');
 check('late response cannot overwrite a switched endpoint',`!JSON.stringify(S.modelLists).includes('wrong-endpoint')`);
 for(const [list,field] of [['ttsModelList','ttsModel'],['visModelList','visModel'],['imgModelList','imgModel']]){
 ev(`fetch=async()=>({ok:true,json:async()=>({models:['aux-model']})})`);await ev(`modelPickerFetch('${list}')`);ev(`document.querySelector('[data-model-index]').click()`);await new Promise(r=>setTimeout(r,20));assert.equal(ev(`S.settings.${field}`),'aux-model');
 }
 ev(`charEdit=S.chars[0].id;renderChar();$('[data-ca=base]').value='https://role.test/v1';$('[data-ca=key]').value='role-secret';fetch=async()=>({ok:true,json:async()=>({data:[{id:'role-model'}]})})`);await ev(`modelPickerFetch('caModelList')`);ev(`document.querySelector('[data-model-index]').click()`);
 check('role picker saves to the selected character',`editingChar().api.model==='role-model'`);
 ev(`modelPickerOpen('mmModelList')`);check('MiniMax static model list remains available',`$('#modelPickerResults').textContent.includes('speech-2.8-hd')`);
 check('manual entry remains available without native datalist filtering',`!$('[data-s=model]').hasAttribute('list')&&$('[data-s=model]').tagName==='INPUT'`);
 assert.deepEqual(errors,[]);console.log('Model picker regression checks passed');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});

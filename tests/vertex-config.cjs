const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom'),{indexedDB}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['world-market.js','market-trades.js','treasure.js','keepsakes.js','chat-reset.js','star-library.js','visitors.js','visitors-city.js','model-picker.js','vertex-api.js','vertex-config.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+fs.readFileSync(path.join(root,file),'utf8')+'</script>');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented/.test(e.message))errors.push(e.message)});
const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.Blob=Blob;w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};w.fetch=async()=>{throw Error('No live APIs in tests')};}});
const w=dom.window,ev=x=>w.eval(x),check=(label,x)=>{assert.ok(ev(x),label);console.log('PASS',label)};
(async()=>{
 for(let n=0;n<100;n++){if(ev('!!S.chars?.length&&!!S.vertexUsage'))break;await new Promise(r=>setTimeout(r,20))}
 ev(`S.settings.proactive=false;S.settings.apiFormat='vertex';S.settings.baseUrl='https://bridge.test/v1';S.settings.apiKey='bridge-test-key';S.settings.model='gemini-test';renderSettings();var configCalls=[],configSaved=false;fetch=async(url,options={})=>{configCalls.push({url,options});return {ok:true,json:async()=>options.method==='POST'?{ready:true,project:'test-project',account:'phone@test-project.iam.gserviceaccount.com',location:JSON.parse(options.body).location,models:JSON.parse(options.body).models}:{ready:configSaved,project:null,account:null,location:'global',models:['gemini-test']}}}`);
 check('Vertex setup renders only on the Vertex channel',`!$('#vertexConfigPanel').hidden&&$('#vertexRegion').value==='global'`);
 await ev(`vertexLoadConfig()`);check('connection reports missing account without claiming Google verification',`$('#vertexAccountStatus').textContent.includes('尚未保存服务账号')`);
 ev(`var fakeAccount={type:'service_account',project_id:'test-project',client_email:'phone@test-project.iam.gserviceaccount.com',private_key:'PRIVATE KEY TEST ONLY'};$('#vertexJson').value=JSON.stringify(fakeAccount);vertexValidateLocal()`);
 check('format validation never sends credentials or claims saved status',`configCalls.length===1&&$('#vertexAccountStatus').textContent.includes('尚未验证')`);
 check('credentials are excluded from full backups',`!JSON.stringify(buildBackup()).includes('PRIVATE KEY TEST ONLY')`);
 ev(`$('#vertexAdminKey').value='temporary-admin-secret';$('#vertexRegion').value='us-central1'`);await ev(`vertexSaveConfig()`);
 check('save sends account only to selected backend and clears transient secrets',`configCalls.at(-1).url==='https://bridge.test/v1/config'&&configCalls.at(-1).options.headers['X-Vertex-Admin-Token']==='temporary-admin-secret'&&JSON.parse(configCalls.at(-1).options.body).location==='us-central1'&&$('#vertexJson').value===''&&$('#vertexAdminKey').value===''&&$('#vertexAccountStatus').textContent.includes('已保存')`);
 check('backup after save still contains no admin key or JSON private key',`!JSON.stringify(buildBackup()).includes('temporary-admin-secret')&&!JSON.stringify(buildBackup()).includes('PRIVATE KEY TEST ONLY')`);
 ev(`$('#vertexRegion').value='global';$('#vertexAdminKey').value='temporary-admin-secret'`);await ev(`vertexSaveConfig()`);
 check('region/model can update without re-uploading saved JSON',`!('credentials' in JSON.parse(configCalls.at(-1).options.body))&&JSON.parse(configCalls.at(-1).options.body).location==='global'`);
 ev(`$('#vertexJson').value=JSON.stringify(fakeAccount);$('#vertexAdminKey').value='temporary-admin-secret';fetch=async()=>({ok:false,status:422,json:async()=>({error:{message:'Google 身份验证失败，旧配置已保留'}})})`);await ev(`vertexSaveConfig()`);
 check('failed save retains editable JSON and clears admin key',`$('#vertexJson').value.includes('PRIVATE KEY TEST ONLY')&&$('#vertexAdminKey').value===''&&$('#vertexAccountStatus').textContent.includes('旧配置已保留')`);
 ev(`fetch=async()=>({ok:false,status:404,json:async()=>({})})`);await ev('vertexLoadConfig()');check('older backend gives actionable upgrade message',`$('#vertexAccountStatus').textContent.includes('升级 VPS 后台')`);
 ev(`var testTarget;vertexCall=async(m,o,c)=>{testTarget=c;return '连接成功'}`);await ev('vertexTestConfig()');check('test uses native transport and clearly reports success',`testTarget.model==='gemini-test'&&$('#vertexAccountStatus').textContent.includes('模型测试成功')`);
 ev(`S.settings.apiFormat='openai';renderSettings()`);check('OpenAI settings remain available and hide account management',`$('#vertexConfigPanel').hidden&&$('[data-s=baseUrl]').closest('.field').querySelector('label').textContent==='API 地址'`);
 assert.deepEqual(errors,[]);console.log('Vertex setup UI checks passed');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});

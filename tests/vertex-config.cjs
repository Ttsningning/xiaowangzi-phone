const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom'),{indexedDB}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['world-market.js','market-trades.js','treasure.js','keepsakes.js','chat-reset.js','star-library.js','visitors.js','visitors-city.js','model-picker.js','vertex-api.js','vertex-config.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+fs.readFileSync(path.join(root,file),'utf8')+'</script>');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented/.test(e.message))errors.push(e.message)});
const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.Blob=Blob;w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};w.fetch=async()=>{throw Error('No live APIs in tests')};}});
const w=dom.window,ev=x=>w.eval(x),check=(label,x)=>{assert.ok(ev(x),label);console.log('PASS',label)};
(async()=>{
 for(let n=0;n<100;n++){if(ev('!!S.chars?.length&&!!S.vertexUsage'))break;await new Promise(r=>setTimeout(r,20))}
 ev(`S.settings.proactive=false;S.settings.apiFormat='vertex';S.settings.apiKey='';S.settings.model='';renderSettings();var calls=[];fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>({ready:true,project:'test-project',account:'phone@test-project.iam.gserviceaccount.com',location:'global',ticket:'vx1.encrypted.test',models:[]})}}`);
 check('Vertex hides backend address and all API key fields',`$('[data-s=baseUrl]').closest('.field').hidden&&$('[data-s=apiKey]').closest('.field').hidden&&!document.querySelector('#vertexAdminKey')`);
 check('no transport configuration required',`!$('#vertexConfigPanel').hidden&&$('#vertexRegion').value==='global'`);
 ev(`$('#vertexJson').value=JSON.stringify({type:'service_account',project_id:'test-project',client_email:'phone@test-project.iam.gserviceaccount.com',private_key:'PRIVATE KEY TEST ONLY'});vertexValidateLocal()`);
 check('local JSON check does not call an API',`calls.length===0`);await ev('vertexSaveConfig()');
 check('JSON alone connects, without model or backend address',`calls.length===1&&calls[0].url===VERTEX_NATIVE_BASE+'/config'&&!calls[0].options.headers.Authorization&&S.settings.apiKey==='vx1.encrypted.test'&&$('#vertexJson').value===''`);
 check('backup excludes encrypted bearer and plain JSON',`!JSON.stringify(buildBackup()).includes('vx1.encrypted.test')&&!JSON.stringify(buildBackup()).includes('PRIVATE KEY TEST ONLY')`);
 ev(`$('[data-s=model]').value='gemini-test';vertexCall=async()=> '连接成功'`);await ev('vertexTestConfig()');check('native test is available after account import',`$('#vertexAccountStatus').textContent.includes('模型测试成功')`);
 ev(`S.settings.apiFormat='openai';renderSettings()`);check('OpenAI connection fields return on switching channel',`!$('[data-s=baseUrl]').closest('.field').hidden&&$('#vertexConfigPanel').hidden`);
 assert.deepEqual(errors,[]);console.log('Direct JSON Vertex setup checks passed');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});

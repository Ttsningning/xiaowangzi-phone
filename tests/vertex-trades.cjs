const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom'),{indexedDB}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['world-market.js','market-trades.js','treasure.js','keepsakes.js','chat-reset.js','star-library.js','visitors.js','visitors-city.js','model-picker.js','vertex-api.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+fs.readFileSync(path.join(root,file),'utf8')+'</script>');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/Not implemented/.test(e.message))errors.push(e.message)});
const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.Blob=Blob;w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollTo=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};w.fetch=async()=>{throw Error('No live APIs in tests')};}});
const w=dom.window,ev=x=>w.eval(x),check=(label,x)=>{assert.ok(ev(x),label);console.log('PASS',label)};
(async()=>{
 for(let n=0;n<100;n++){if(ev('!!S.chars?.length&&!!S.vertexUsage'))break;await new Promise(r=>setTimeout(r,20))}
 ev(`S.settings.proactive=false;S.user.name='宁宁';S.market.lastTick=Date.now();S.market.listings=[{id:'own',name:'星辉果',desc:'水果',seller:'莫林',world:'森林',type:'sale',price:10,floor:5,stock:3,sold:0,lastPriceAt:Date.now()}];actionSheet=async()=>0;formSheet=async()=>({qty:'3'});`);
 await ev(`wmTrade('own')`);
 check('purchase records buyer identity and zero inventory',`S.market.orders[0].buyer.name==='宁宁'&&S.market.listings[0].stock===0`);
 ev(`var marketCapture;var realCallAPI=callAPI;callAPI=async(m)=>{marketCapture=m;return JSON.stringify({comments:[{name:'莫林',role:'seller',text:'谢谢宁宁买下三份！'}],offer:null})};wmCommentsOpen.add('own');$('#marketBody').innerHTML=wmListingCard(S.market.listings[0]);document.querySelector('[data-wms-input]').value='都买了，祝卖家顺利'`);
 await ev(`wmSocialTalk('own',true)`);
 check('seller gets confirmed order, same buyer and non-anonymous identity',`marketCapture[1].content.includes('buyerNameAtPurchase')&&marketCapture[1].content.includes('宁宁')&&marketCapture[1].content.includes('"userQuantity":3')&&marketCapture[1].content.includes('"anonymous":false')&&!marketCapture[0].content.includes('不得声称user已付款')`);
 ev(`delete S.market.orders[0].buyer;S.market.orders.push({id:'unrelated',listingId:'other',qty:99,name:'星辉果',seller:'莫林'});var facts=wmTradeFacts(S.market.listings[0])`);
 check('legacy orders belong to current user, other listing orders are excluded',`facts.userQuantity===3&&facts.userOrders[0].buyerId==='user'`);
 ev(`S.market.orders=[]`);check('no order means no confirmed purchase',`wmTradeFacts(S.market.listings[0]).userQuantity===0`);
 ev(`callAPI=realCallAPI;S.settings.apiFormat='vertex';S.settings.baseUrl='https://bridge.test/v1';S.settings.apiKey='bridge-test-secret';S.settings.model='gemini-test';var vxSent;fetch=async(url,options)=>{vxSent={url,body:JSON.parse(options.body)};return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({candidates:[{content:{parts:[{text:'hidden',thought:true},{text:'你好宁宁'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,cachedContentTokenCount:80,candidatesTokenCount:10,thoughtsTokenCount:5}})}}`);
 const text=await ev(`callAPI([{role:'system',content:'系统规则'},{role:'user',content:'你好'}])`);assert.equal(text,'你好宁宁');
 check('Vertex global route uses native payload and actual usage',`vxSent.url==='https://bridge.test/v1/generate'&&vxSent.body.request.systemInstruction.parts[0].text==='系统规则'&&S.vertexUsage.global.cached===80&&S.vertexUsage.global.uncached===20&&S.vertexUsage.global.thoughts===5`);
 const saved=await ev(`DB.get('vertexUsage')`);assert.ok(!JSON.stringify(saved).includes('bridge-test-secret'));
 ev(`var c=S.chars[0];c.api={fmt:'vertex',base:'https://role.test/v1',key:'role-secret',model:'gemini-test'};`);await ev(`callAPI([{role:'user',content:'你好'}],{char:c})`);
 check('character has its own Vertex route and usage',`vxSent.url==='https://role.test/v1/generate'&&S.vertexUsage.chars[c.id].cached===80`);
 ev(`var msg=[{role:'user',content:'unused'}];msg.cache={A:'稳定规则',B:'稳定记忆',hist:[{role:'user',content:'早先消息'},{role:'assistant',content:'早先回答'}],tail:['新消息'],D:'现在23点，库存0，订单属于宁宁'};var p1=vertexPayload(msg,.9,100);msg.cache.D='现在24点，库存0，订单属于宁宁';var p2=vertexPayload(msg,.9,100)`);
 check('changing current state preserves stable instruction and earlier history prefix',`JSON.stringify(p1.systemInstruction)===JSON.stringify(p2.systemInstruction)&&JSON.stringify(p1.contents.slice(0,2))===JSON.stringify(p2.contents.slice(0,2))&&p2.contents.at(-1).parts[0].text.includes('现在24点')`);
 // Split SSE across bytes and include a final event without trailing newline.
 w.Response=Response;w.TextDecoder=TextDecoder;
 ev(String.raw`var delta='';fetch=async()=>{const data='data: '+JSON.stringify({candidates:[{content:{parts:[{text:'你好'}]}}]})+'\n\ndata: '+JSON.stringify({candidates:[{content:{parts:[{text:'呀'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:120,cachedContentTokenCount:90}});const bytes=new TextEncoder().encode(data);return new Response(new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,13));controller.enqueue(bytes.slice(13,49));controller.enqueue(bytes.slice(49));controller.close()}}),{headers:{'Content-Type':'text/event-stream'}})}`);
 w.ReadableStream=ReadableStream;
 assert.equal(await ev(`callAPI([{role:'user',content:'hi'}],{stream:true,onDelta:t=>delta=t})`),'你好呀');check('SSE assembles chunks and final usage without leaking thought text',`delta==='你好呀'&&S.vertexUsage.global.cached===90`);
 ev(`fetch=async()=>({ok:false,status:403,json:async()=>({error:{message:'Google 权限或结算未开通'}})})`);await assert.rejects(ev(`callAPI([{role:'user',content:'hi'}])`),/403/);
 ev(`S.settings.apiFormat='openai';fetch=async(url)=>{vxSent={url};return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({choices:[{message:{content:'old-route'}}]})}}`);assert.equal(await ev(`callAPI([{role:'user',content:'hi'}])`),'old-route');check('existing OpenAI route remains intact',`vxSent.url.endsWith('/chat/completions')`);
 assert.deepEqual(errors,[]);console.log('Vertex and trade identity checks passed');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1});

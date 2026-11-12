const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let request,usage,reply;
const settings={baseUrl:'https://example.test/v1',apiKey:'test',model:'test',temperature:.9,maxTokens:100,stream:true};
const ctx={S:{settings},TextDecoder,Error,JSON,fetch:async(url,opt)=>{request={url,body:JSON.parse(opt.body)};return reply},ownAPI:c=>c?.api,anthHead:()=>({}),anthStat:(_,u)=>usage=u};
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('const useAIStream='),html.indexOf('const parseJSON=')),ctx);
function sse(events,step=1){
  const bytes=new TextEncoder().encode(events.map(x=>typeof x==='string'?x:'data: '+JSON.stringify(x)+'\r\n\r\n').join(''));
  let offset=0;return new Response(new ReadableStream({pull(c){if(offset>=bytes.length)return c.close();c.enqueue(bytes.slice(offset,offset+=step))}}),{headers:{'content-type':'text/event-stream'}});
}
(async()=>{
  let progress=[];
  reply=sse([{choices:[{index:0,delta:{content:'你好'}}]},': ping\r\n\r\n',{choices:[{index:0,delta:{content:'，宁宁🦊'}}]},'data: [DONE]\r\n\r\n']);
  assert.equal(await ctx.callAPI([{role:'user',content:'test'}],{onDelta:x=>progress.push(x)}),'你好，宁宁🦊');
  assert.equal(request.body.stream,true);assert.deepEqual(progress,['你好','你好，宁宁🦊']);
  reply=sse([{choices:[{index:0,delta:{content:'unfinished'}}]}]);
  await assert.rejects(ctx.callAPI([],{onDelta(){}}),/连接中断/);
  reply=sse([{type:'error',error:{message:'quota exceeded'}}]);
  await assert.rejects(ctx.callAPI([],{onDelta(){}}),/quota exceeded/);
  settings.stream=false;reply=Response.json({choices:[{message:{content:'普通回复'}}]});
  assert.equal(await ctx.callAPI([],{onDelta(){}}),'普通回复');assert.equal(request.body.stream,false);
  settings.stream=true;
  const character={name:'bb',api:{fmt:'anthropic',base:'https://example.test',key:'test',model:'test',cache:'5m'}};
  const events=[{type:'message_start',message:{usage:{input_tokens:10,cache_read_input_tokens:20}}},{type:'content_block_delta',delta:{type:'thinking_delta',thinking:'private'}},{type:'content_block_delta',delta:{type:'text_delta',text:'你好'}},{type:'message_delta',usage:{output_tokens:2}},{type:'message_stop'}];
  reply=sse(events);assert.equal(await ctx.callAPI([{role:'user',content:'test'}],{char:character,onDelta(){}}),'你好');assert.equal(usage.output_tokens,2);assert.equal(usage.cache_read_input_tokens,20);
  const messages=[];messages.cache={A:'system',B:'memory',D:'dynamic',hist:[{role:'user',content:'hi'}],tail:[]};
  reply=sse(events);assert.equal(await ctx.callAPI(messages,{char:character,onDelta(){}}),'你好');assert.equal(request.body.stream,true);assert.ok(request.body.system[0].cache_control);
  reply=Response.json({choices:[{message:{content:'proxy ignored stream'}}]});assert.equal(await ctx.callAPI([],{onDelta(){}}),'proxy ignored stream');
  reply=Response.json({choices:[{message:{content:'background'}}]});await ctx.callAPI([]);assert.equal(request.body.stream,false,'background JSON jobs stay non-streaming');
  assert.ok(html.includes('data-s="stream"'));assert.ok(html.includes('speech-2.8-hd'));assert.ok(html.includes('speech-2.8-turbo'));assert.ok(html.includes('id="mmCustomVoice"'));
  // Exercise the real MiniMax request using a custom generated voice ID.
  vm.runInContext(html.slice(html.indexOf('function mmUrl('),html.indexOf('/* ---------- 拉取模型')),ctx);
  Object.assign(settings,{mmKey:'test',mmModel:'speech-2.8-hd',mmVoice:'my-generated-voice',mmSpeed:1});
  reply=Response.json({data:{url:'https://example.test/audio.mp3'},base_resp:{status_code:0}});
  await ctx.mmSpeak('hello');assert.equal(request.body.model,'speech-2.8-hd');assert.equal(request.body.voice_setting.voice_id,'my-generated-voice');
  reply=Response.json({data:{url:'https://example.test/audio.mp3'}});await ctx.mmSpeak('hello','character-voice');assert.equal(request.body.voice_setting.voice_id,'character-voice');
  // Inspect V5's actual generation payload without paid generation or image decoding.
  ctx.unzipFirst=async()=>{throw Error('request inspected')};
  vm.runInContext(html.slice(html.indexOf('async function naiImage('),html.indexOf('/* ---------- MiniMax')),ctx);
  Object.assign(settings,{naiKey:'test',naiModel:'nai-diffusion-5-full',naiSize:'832x1216'});
  reply={ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};
  await assert.rejects(ctx.naiImage('1girl',null,true),/request inspected/);
  assert.equal(request.body.model,'nai-diffusion-5-full');assert.equal(request.body.parameters.v4_prompt.caption.base_caption,'1girl');assert.ok(request.body.parameters.v4_negative_prompt);assert.equal(request.body.parameters.noise_schedule,'karras');
  for(const schedule of ['native','karras','exponential','polyexponential']){
    Object.assign(settings,{naiSchedule:schedule,naiSeed:'4294967295'});const meta={};
    await assert.rejects(ctx.naiImage('1girl',null,true,meta),/request inspected/);
    assert.equal(request.body.parameters.seed,4294967295);assert.equal(request.body.parameters.noise_schedule,schedule);assert.equal(meta.seed,4294967295);assert.equal(meta.noise_schedule,schedule);
  }
  settings.naiSeed='0';await assert.rejects(ctx.naiImage('1girl',null,true),/request inspected/);assert.equal(request.body.parameters.seed,0);
  settings.naiSeed='-1';await assert.rejects(ctx.naiImage('1girl',null,true),/request inspected/);assert.ok(Number.isInteger(request.body.parameters.seed)&&request.body.parameters.seed>=0&&request.body.parameters.seed<=4294967295);
  for(const seed of ['-2','1.2','4294967296','abc']){settings.naiSeed=seed;await assert.rejects(ctx.naiImage('1girl',null,true),/种子/)}
  console.log('PASS API settings: chunked UTF-8 SSE, partial display, interrupted/error streams, non-streaming, Anthropic cache/usage, custom MiniMax voice and V5 payload');
})().catch(e=>{console.error(e);process.exitCode=1});

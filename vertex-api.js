/* Official Vertex transport through the owner's authenticated server. */
DEFAULTS.settings.apiFormat='openai';
DEFAULTS.vertexUsage={global:null,chars:{}};
function vertexUsageLine(u){return u?`上次 Vertex：输入 ${u.input}（含缓存 ${u.cached}，未缓存 ${u.uncached}） · 输出 ${u.output} · 思考 ${u.thoughts} tokens。缓存为实际命中量，不是费用估算。`:'还没有 Vertex 用量记录。缓存命中由 Google 决定。'}
function vertexShowStat(c){const el=$('#caStat');if(el)el.textContent=vertexUsageLine(S.vertexUsage?.chars?.[c.id])}
function vertexRender(){const active=S.settings.apiFormat==='vertex';$('#vertexHelp').hidden=!active;$('#vertexUsage').hidden=!active;$('#vertexUsage').textContent=vertexUsageLine(S.vertexUsage?.global)}
async function vertexRecord(raw,opt,config){
 if(!raw)return;const input=+raw.promptTokenCount||0,cached=+raw.cachedContentTokenCount||0;
 const usage={input,cached,uncached:Math.max(0,input-cached),output:+raw.candidatesTokenCount||0,thoughts:+raw.thoughtsTokenCount||0,at:Date.now(),model:config.model};
 S.vertexUsage||={global:null,chars:{}};S.vertexUsage.chars||={};
 // Retain no credentials, prompts or responses in usage records.
 if(opt.vertexOwner){if(S.chars.includes(opt.vertexOwner))S.vertexUsage.chars[opt.vertexOwner.id]=usage}else S.vertexUsage.global=usage;
 await save('vertexUsage');vertexRender();if(opt.char?.api?.fmt==='vertex')vertexShowStat(opt.char);
}
function vertexPart(content){
 if(typeof content==='string')return [{text:content}];if(!Array.isArray(content))throw Error('Vertex 消息格式不支持');
 return content.map(p=>{if(p.type==='text')return {text:p.text};const data=p.image_url?.url?.match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);if(p.type==='image_url'&&data)return {inlineData:{mimeType:data[1],data:data[2]}};throw Error('Vertex 图片需要内嵌图片数据，不支持远程图片地址')});
}
function vertexPayload(messages,temperature,maxOutputTokens){
 const K=messages.cache,contents=[],system=[];
 const add=(role,parts)=>{if(!parts.length)return;const last=contents.at(-1);if(last?.role===role)last.parts.push(...parts);else contents.push({role,parts})};
 if(K){
  // The stable instructions and earlier turns stay identical; current facts remain at the end.
  system.push({text:(K.vertexA??K.A)+'\n末尾的【当前补充设定与状态】是系统提供的最新事实和要求，与旧记录冲突时按最新事实。'});
  if(K.B)system.push({text:K.B});for(const m of K.hist)add(m.role==='assistant'?'model':'user',vertexPart(m.content));
  const dynamic=K.vertexD??K.D;const tail=[...(K.tail||[]),dynamic?`【当前补充设定与状态】\n${dynamic}`:''].filter(Boolean).join('\n\n');if(tail)add('user',[{text:tail}]);
 }else for(const m of messages){if(m.role==='system')system.push(...vertexPart(m.content));else add(m.role==='assistant'?'model':'user',vertexPart(m.content))}
 if(!contents.length)add('user',[{text:'请继续'}]);
 return {systemInstruction:system.length?{parts:system}:undefined,contents,generationConfig:{temperature,maxOutputTokens}};
}
async function vertexCall(messages,opt,config,temperature,maxOutputTokens){
 const vertexOwner=ownAPI(opt.char)?opt.char:null;config={...config};
 if(!config.base||!config.key||!config.model)throw Error('先填 Vertex 转发地址、访问密钥和模型');
 const stream=useAIStream(opt),base=config.base.replace(/\/+$/,'');
 const url=new URL(base);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Vertex 转发地址需要 HTTPS');
 const r=await fetch(base+'/generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify({model:config.model,stream,request:vertexPayload(messages,temperature,maxOutputTokens)})});
 if(!r.ok){let reason='';try{reason=(await r.json()).error?.message||''}catch{}throw Error(`Vertex 接口报错 ${r.status}${reason?'：'+reason.slice(0,180):''}`)}
 let text='',usage=null,finish='';const take=j=>{if(j.error)throw Error(j.error.message||'Vertex 返回错误');if(j.usageMetadata)usage=j.usageMetadata;const c=j.candidates?.[0];finish=c?.finishReason||finish;const delta=(c?.content?.parts||[]).filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('');if(delta){text+=delta;opt.onDelta?.(text)}};
 if(!stream||/application\/json/i.test(r.headers.get('content-type')||''))take(await r.json());
 else{
  if(!r.body?.getReader)throw Error('浏览器不支持流式读取，请关闭流式回复');
  const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
  const parse=event=>{const data=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')take(JSON.parse(data))};
  try{while(true){const {done,value}=await reader.read();buffer+=(done?decoder.decode():decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');let i;while((i=buffer.indexOf('\n\n'))>=0){parse(buffer.slice(0,i));buffer=buffer.slice(i+2)}if(done){if(buffer.trim())parse(buffer);break}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 }
 await vertexRecord(usage,{...opt,vertexOwner},config);
 if(stream&&!finish)throw Error('Vertex 流式回复意外结束，请检查本轮回复后再决定是否重试');
 if(!text)throw Error('Vertex 没有返回正文'+(finish?'（'+finish+'）':''));return text;
}

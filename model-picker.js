/* Explicit model selectors: no dependency on a browser's filtered datalist popup. */
DEFAULTS.modelLists={entries:{}};
const MODEL_PICKERS={modelList:{selector:'[data-s="model"]',label:'主体 AI 模型',field:'model'},caModelList:{selector:'[data-ca="model"]',label:'角色专属模型',field:'model'},ttsModelList:{selector:'[data-s="ttsModel"]',label:'语音模型',field:'ttsModel'},visModelList:{selector:'[data-s="visModel"]',label:'识图模型',field:'visModel'},imgModelList:{selector:'[data-s="imgModel"]',label:'生图模型',field:'imgModel'},mmModelList:{selector:'[data-s="mmModel"]',label:'MiniMax 语音模型',field:'mmModel'}};
const modelFetchLocks=new Set(),modelBuiltins={};
function modelPickerIds(json){
 const rows=Array.isArray(json)?json:Array.isArray(json?.data)?json.data:Array.isArray(json?.models)?json.models:[];
 return [...new Set(rows.map(m=>typeof m==='string'?m:typeof m?.id==='string'?m.id:typeof m?.name==='string'?m.name:'').map(x=>x.trim()).filter(x=>x&&x.length<=512))].slice(0,5000);
}
function modelPickerContext(list){
 const p=MODEL_PICKERS[list],s=S.settings;if(!p||!s)return null;let base='',key='',owner='',fmt='openai';
 if(list==='caModelList'){const c=editingChar();if(!c)return null;owner=c.id;base=c.api?.base||'';key=c.api?.key||'';fmt=c.api?.fmt||'openai'}
 else if(list==='modelList'){base=s.baseUrl||'';key=s.apiKey||'';fmt=s.apiFormat||'openai'}
 else if(list==='mmModelList'){base=s.mmHost||'https://api.minimaxi.com';key=s.mmKey||'';fmt='builtin'}
 else{const prefix={ttsModelList:'tts',visModelList:'vis',imgModelList:'img'}[list];base=s[prefix+'Base']||s.baseUrl||'';key=s[prefix+'Key']||s.apiKey||''}
 base=base.trim().replace(/\/+$/,'');return {list,owner,base,key,fmt,scope:JSON.stringify([list,owner,base,fmt])};
}
function modelPickerSame(a,b){return !!a&&!!b&&a.scope===b.scope&&a.key===b.key}
function modelPickerStored(context){return context?(S.modelLists?.entries?.[context.scope]?.ids||modelBuiltins[context.list]||[]):[]}
function modelPickerRestore(only){
 for(const list of only?[only]:Object.keys(MODEL_PICKERS)){
  const context=modelPickerContext(list),node=document.getElementById(list);if(node)node.innerHTML=modelPickerStored(context).map(v=>`<option value="${esc(v)}"></option>`).join('');
 }
}
async function modelPickerChoose(context,value){
 if(!modelPickerSame(context,modelPickerContext(context.list)))return toast('接口或角色已切换，请重新打开模型列表');
 const p=MODEL_PICKERS[context.list],field=document.querySelector(p.selector);if(!field)return;field.value=value;
 if(context.owner)readCharForm();else{S.settings[p.field]=value;await save('settings')}
 toast('已选 '+value);
}
function modelPickerOpen(list){
 const context=modelPickerContext(list);if(!context)return toast('先选择一个角色');
 const ids=modelPickerStored(context),sheet=$('#sheet');
 sheet.innerHTML=`<div class="model-picker-heading">${esc(MODEL_PICKERS[list].label)}</div><p class="model-picker-hint">可搜索下方模型，也可以取消后直接手填模型名。</p><input id="modelPickerSearch" class="model-picker-search" placeholder="搜索模型名称…" aria-label="搜索模型" autocomplete="off" autocapitalize="none" spellcheck="false"><div id="modelPickerCount" class="model-picker-hint"></div><div id="modelPickerResults" class="model-picker-results"></div><button class="opt" data-model-cancel>取消</button>`;
 const results=$('#modelPickerResults'),count=$('#modelPickerCount');
 const render=q=>{const matches=ids.map((id,index)=>({id,index})).filter(x=>x.id.toLowerCase().includes(q.toLowerCase()));count.textContent=matches.length+' / '+ids.length+' 个模型';results.innerHTML=matches.length?matches.map(x=>`<button class="opt model-picker-option" data-model-index="${x.index}">${esc(x.id)}</button>`).join(''):`<div class="model-picker-empty">${ids.length?'没有匹配的模型，可以换个关键词或手动填写。':'还没有已拉取的模型，请先点「拉取模型」。'}</div>`};
 render('');$('#modelPickerSearch').oninput=e=>render(e.target.value);
 sheet.onclick=e=>{if(e.target.closest('[data-model-cancel]'))return closeSheet();const b=e.target.closest('[data-model-index]');if(!b)return;const id=ids[+b.dataset.modelIndex];if(!id)return;closeSheet();modelPickerChoose(context,id).catch(err=>toast(err.message,5000))};
 $('#mask').classList.add('show');sheet.classList.add('show');
}
async function modelPickerFetch(list){
 if(list==='caModelList')readCharForm();const context=modelPickerContext(list);if(!context)return toast('先选择一个角色');
 if(!context.base||!context.key)return toast('先填接口地址和密钥');if(modelFetchLocks.has(list))return;
 const button=list==='modelList'?$('#fetchModels'):list==='caModelList'?$('#caFetch'):document.querySelector('[data-fm="'+({ttsModelList:'tts',visModelList:'vis',imgModelList:'img'}[list]||'')+'"]');
 modelFetchLocks.add(list);if(button)button.disabled=true;toast('正在拉取模型…',6000);
 try{
  const url=context.fmt==='anthropic'?context.base.replace(/\/v1$/,'')+'/v1/models?limit=100':context.base+'/models';
  const r=await fetch(url,{headers:context.fmt==='anthropic'?anthHead(context.key):{Authorization:'Bearer '+context.key}});if(!r.ok)throw Error('接口报错 '+r.status);
  const ids=modelPickerIds(await r.json());if(!ids.length)throw Error('接口没有返回可用模型，原有选择和列表已保留；也可以手动填写模型名');
  if(!modelPickerSame(context,modelPickerContext(list)))return toast('接口或角色已切换，本次结果未写入');
  S.modelLists||={entries:{}};S.modelLists.entries||={};S.modelLists.entries[context.scope]={ids,at:Date.now()};
  const entries=Object.entries(S.modelLists.entries).sort((a,b)=>(b[1].at||0)-(a[1].at||0));S.modelLists.entries=Object.fromEntries(entries.slice(0,24));
  await save('modelLists');if(modelPickerSame(context,modelPickerContext(list))){modelPickerRestore(list);modelPickerOpen(list)}
 }catch(e){toast(e.message||String(e),5000)}finally{modelFetchLocks.delete(list);if(button)button.disabled=false}
}
function modelPickerInit(){
 for(const [list,p] of Object.entries(MODEL_PICKERS)){
  const field=document.querySelector(p.selector);if(!field)continue;
  if(list==='mmModelList'&&!modelBuiltins[list])modelBuiltins[list]=Array.from(document.querySelectorAll('#'+list+' option')).map(x=>x.value);
  field.removeAttribute('list');field.autocomplete='off';field.setAttribute('autocapitalize','none');field.spellcheck=false;
  if(field.parentElement.classList.contains('model-picker-field'))continue;
  const wrap=document.createElement('div');wrap.className='model-picker-field';field.before(wrap);wrap.appendChild(field);
  const button=document.createElement('button');button.type='button';button.className='model-picker-toggle';button.dataset.modelPicker=list;button.setAttribute('aria-label','选择'+p.label);button.title='打开已拉取的模型';button.textContent='⌄';wrap.appendChild(button);
 }
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-model-picker]');if(button)modelPickerOpen(button.dataset.modelPicker)});
modelPickerInit();

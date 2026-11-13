/* 角色记忆册与统一相册。数据随小手机备份，不改写已有聊天。 */
DEFAULTS.keepsakes={books:{}};
DEFAULTS.album={photos:[],hidden:[]};
// Register shortcuts before load()/homeMigrate() can filter a saved desktop.
if(!APPS.some(a=>a.id==='album'))APPS.push({id:'album',name:'相册'});
PACKS.prince.icons.album='themes/prince/ui/photo.webp';
PACKS.prince.icons.memory='themes/prince/deco/i-book.webp';
SVG.album='<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m4 19 6-6 4 3 3-5 4 5"/></svg>';

const KS_ASSET='themes/prince/keepsakes/';
const KS_RECTS={album:[0,10,385,385],book:[390,8,370,390],cover:[776,20,365,365],fox:[1150,10,385,385],camera:[800,880,145,130],envelope:[1143,404,240,175],divider:[614,735,902,90],bookmark:[326,405,130,315]};
const ksBusy=new Set(),ksCommentDrafts=new Map();let ksMemoryChar=null,ksMemoryFilter='all',ksAlbumChar='all',ksPhotoId=null;
const KS_KINDS={about:'关于我们',event:'共同经历',gift:'礼物与信物',promise:'重要约定'};
function ksSprite(kind,size=80){const [x,y,w,h]=KS_RECTS[kind]||KS_RECTS.book;return `<span class="ks-sprite ks-${kind}" style="width:${size}px;aspect-ratio:${w}/${h}" aria-hidden="true"><img src="${KS_ASSET}materials.jpg" alt="" style="width:${1536/w*100}%;left:${-x/w*100}%;top:${-y/h*100}%"></span>`}
function ksBtn(action,label,id='',extra=''){return `<button class="btn" data-ks="${action}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`}
function ksBook(cid){return S.keepsakes.books[cid]||(S.keepsakes.books[cid]={cards:[]})}
function ksDate(ts){return new Date(ts).toLocaleDateString()}
function ksActivePhoto(p){return p.versions.find(v=>v.id===p.current)||p.versions.at(-1)}
function ksOpenMemory(cid){ksMemoryChar=cid||curT().members[0];openApp('memory')}
function ksOpenAlbum(cid='all',id=null){ksAlbumChar=cid;ksPhotoId=id;openApp('album')}
function ksInit(){
  S.keepsakes||={books:{}};S.keepsakes.books||={};S.album||={photos:[],hidden:[]};S.album.photos||=[];S.album.hidden||=[];
  if(!S.home.albumDesktopV2){if(!S.home.pages.flat().some(x=>x.type==='app'&&x.app==='album'))S.home.pages.at(-1).push({id:uid(),type:'app',app:'album'});S.home.keepsakesApps=true;S.home.albumDesktopV2=true;save('home')}
  if(!$('#app-album')){const el=document.createElement('section');el.className='app ks-app';el.id='app-album';el.innerHTML='<header><button class="hbtn" data-back>‹ 返回</button><div class="title">星光相册</div><button class="hbtn" data-ks="album-home">名册</button></header><div class="body pad" id="albumBody"></div>';$('#phone').append(el)}
  $('#app-memory').classList.add('ks-app');RENDER.album=ksRenderAlbum;renderMemory=ksRenderMemory;RENDER.memory=ksRenderMemory;
  if(!PACKS.prince.walls.includes(KS_ASSET+'rose-planet.jpg'))PACKS.prince.walls.push(...['fox-moon.jpg','rose-planet.jpg','rose-clouds.jpg'].map(x=>KS_ASSET+x));
  for(const p of S.album.photos)for(const c of p.comments||[])if(c.role==='user'&&c.replyStatus==='pending')c.replyStatus='failed';
  ksApplyPeekIcons();ksSyncPhotos();
}
function ksMemoryPrompt(T){
  if(!S.keepsakes?.books)return '';
  const lines=[];
  for(const cid of T.members){const cards=ksBook(cid).cards.filter(x=>x.status==='confirmed'&&(!isGroup(T)||x.sourceTid===T.id)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.at-a.at).slice(0,40);
    for(const c of cards)lines.push(`${charById(cid)?.name||'角色'} · ${KS_KINDS[c.kind]||'回忆'}${c.pinned?' · 用户固定':''} · ${c.title}：${c.text}${c.kind==='promise'?'（'+(c.done?'已完成':'尚未完成')+'）':''}`)}
  return lines.length?'\n【用户确认的角色记忆册】\n以下是用户确认或编辑的记忆，整理历史摘要时不得擅自覆盖固定事实；如与旧摘要冲突，优先沿用这些记录。待确认草稿不属于既定事实。\n'+lines.join('\n').slice(0,12000)+'\n':'';
}
function ksMemorySelect(){return `<label class="ks-select">角色名册<select id="ksMemorySelect">${S.chars.map(c=>`<option value="${esc(c.id)}"${c.id===ksMemoryChar?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`}
function ksRenderMemory(){
  const B=$('#app-memory .body');if(!B)return;ksMemoryChar=charById(ksMemoryChar)?.id||curT().members[0];const cid=ksMemoryChar,c=charById(cid),book=ksBook(cid),T=S.threads.find(t=>!isGroup(t)&&t.members[0]===cid);
  $('#memTitle').textContent=(c?.name||'TA')+'的记忆册';
  const cards=book.cards.filter(x=>ksMemoryFilter==='all'||(ksMemoryFilter==='draft'?x.status==='draft':x.status==='confirmed'&&x.kind===ksMemoryFilter)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.at-a.at);
  B.innerHTML=`<div class="ks-hero">${ksSprite('book',92)}<div><small>把共同经历，一页页收好</small><h2>${esc(c?.name||'TA')}的记忆册</h2><p>${book.cards.filter(x=>x.status==='confirmed').length} 条已确认 · ${book.cards.filter(x=>x.status==='draft').length} 条待确认</p></div></div>${ksMemorySelect()}<div class="btns">${ksBtn('memory-new','写一条重要记忆')}${ksBtn('memory-draft',ksBusy.has('memory:'+cid)?'正在翻阅经历…':'✦ bb 整理回忆草稿',cid,ksBusy.has('memory:'+cid)?'disabled':'')}${ksBtn('album-char','看看 TA 的相簿',cid)}</div><p class="hint">已确认的记忆会带入对话；固定后不会被自动整理覆盖。私聊记忆只用于你与 TA 的私聊，群聊来源的回忆才会用于对应群聊。AI 整理草稿会使用当前接口。</p><div class="ks-tabs">${[['all','全部'],['draft','待确认'],...Object.entries(KS_KINDS)].map(([id,label])=>ksBtn('memory-filter',label,id,`aria-pressed="${ksMemoryFilter===id}"`)).join('')}</div>${cards.map(x=>`<article class="card glass ks-memory"><div class="ks-card-title"><span class="tag">${x.status==='draft'?'待你确认':x.pinned?'已固定':'已确认'} · ${KS_KINDS[x.kind]}</span><small>${esc(x.date||ksDate(x.at))}</small></div><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>${x.sourceTid?`<small>来源：${esc(tName(S.threads.find(t=>t.id===x.sourceTid)||{type:'single',members:[cid]}))}${x.sourceMsgIds?.length?' · 有原对话记录':''}</small>`:'<small>你亲手记下的回忆 · 仅私聊使用</small>'}${x.photoId&&S.album.photos.some(p=>p.id===x.photoId)?ksBtn('photo','查看关联照片',x.photoId):''}<div class="btns">${x.status==='draft'?ksBtn('memory-confirm','确认收入记忆册',x.id):ksBtn('memory-pin',x.pinned?'取消固定':'固定这条',x.id)}${ksBtn('memory-edit','编辑',x.id)}${x.kind==='promise'&&x.status==='confirmed'?ksBtn('memory-done',x.done?'改为未完成':'标记已完成',x.id):''}${ksBtn('memory-delete',x.status==='draft'?'舍弃草稿':'删除',x.id)}</div></article>`).join('')||'<div class="ks-empty">'+ksSprite('book',110)+'<p>这一页还空着，先记一件舍不得忘的事吧。</p></div>'}<details class="card glass"><summary>原有长期记忆 · 私聊摘要</summary><p class="hint">保留原来的自动整理结果，与上方记忆卡片分别保存。</p><textarea id="ksLegacyMemory" class="ks-textarea">${esc(T?.mem.summary||'')}</textarea><div class="btns">${ksBtn('memory-legacy-save','保存摘要',cid)}${ksBtn('memory-legacy-summarize','整理原有摘要',cid)}</div></details>`;
}
async function ksEditMemory(id,photoId){
  const state=S.keepsakes,cid=ksMemoryChar||curT().members[0],book=ksBook(cid),old=book.cards.find(x=>x.id===id),p=photoId&&S.album.photos.find(p=>p.id===photoId);
  const r=await formSheet(old?'编辑回忆':'记下一件重要的事',[{k:'title',t:'text',l:'标题'},{k:'kind',t:'select',l:'放在哪一页',opts:Object.values(KS_KINDS)},{k:'date',t:'text',l:'发生时间（可写故事里的日期）'},{k:'text',t:'textarea',l:'记忆内容'},{k:'photos',t:'multi',l:'关联照片（选一张或不选）',opts:S.album.photos.filter(p=>p.ownerIds.includes(cid)).map(p=>[p.id,p.desc.slice(0,40)||'一张照片'])}],{title:old?.title||p?.desc.slice(0,40)||'',text:old?.text||p?.desc||'',kind:KS_KINDS[old?.kind]||'共同经历',date:old?.date||ksDate(Date.now()),photos:old?.photoId?[old.photoId]:p?[p.id]:[]});
  if(!r||S.keepsakes!==state)return;const title=wmText(r.title,120),text=wmText(r.text,5000);if(!title||!text)throw Error('标题和记忆内容都写一点吧');
  const record={id:old?.id||uid(),at:old?.at||Date.now(),kind:Object.keys(KS_KINDS).find(k=>KS_KINDS[k]===r.kind)||'event',title,text,date:wmText(r.date,80),status:'confirmed',pinned:old?.pinned??true,done:old?.done||false,sourceTid:old?.sourceTid||'',sourceMsgIds:old?.sourceMsgIds||[],photoId:r.photos?.[0]||''};
  if(old)Object.assign(old,record);else book.cards.push(record);await save('keepsakes');ksRenderMemory();
}
async function ksDraftMemories(cid){
  const state=S.keepsakes,book=ksBook(cid),c=charById(cid),lock='memory:'+cid;if(ksBusy.has(lock))return;ksBusy.add(lock);ksRenderMemory();
  try{
    const sources=S.threads.filter(t=>t.members.includes(cid)).flatMap(t=>t.msgs.filter(m=>m.role!=='event').slice(-60).map(m=>({tid:t.id,id:m.id,who:m.role==='user'?S.user.name:charById(m.who||t.members[0])?.name||'TA',mode:m.mode,text:m.content,at:m.ts}))).slice(-160);
    if(!sources.length)throw Error('先与 TA 留下一点共同经历，再来整理');
    const out=await callAPI([{role:'system',content:'你为一个角色整理真实发生过的回忆候选卡片。只依据给出的对话、既有摘要和礼物记录，不得编造关系、事件和约定，不得重复已收录内容。生成1—6条，只输出 JSON {"cards":[{"kind":"about/event/gift/promise","title":"标题","text":"准确完整的事实","date":"故事中的时间或留空","sourceTid":"原对话tid","sourceMsgIds":["原消息id"]}]}。每条必须引用同一会话内实际存在的消息。不要把尚未发生的期待写成已发生。'},{role:'user',content:`角色：${JSON.stringify({name:c.name,description:c.description,personality:c.personality})}\n用户：${S.user.name}\n已收录：${JSON.stringify(book.cards.map(x=>({title:x.title,text:x.text})))}\n对话：${JSON.stringify(sources)}\n已有私聊摘要：${S.threads.find(t=>!isGroup(t)&&t.members[0]===cid)?.mem.summary||''}`}],{char:c,max_tokens:2800,temperature:.3});
    if(S.keepsakes!==state||!charById(cid))return;
    const j=parseJSON(out),items=(Array.isArray(j.cards)?j.cards:[]).slice(0,6).map(x=>{const ids=Array.isArray(x.sourceMsgIds)?x.sourceMsgIds.filter(id=>sources.some(m=>m.tid===x.sourceTid&&m.id===id)).slice(0,10):[];return {id:uid(),kind:KS_KINDS[x.kind]?x.kind:'event',title:wmText(x.title,120),text:wmText(x.text,5000),date:wmText(x.date,80),sourceTid:wmText(x.sourceTid,100),sourceMsgIds:ids,status:'draft',pinned:false,done:false,at:Date.now()}}).filter(x=>x.title&&x.text&&x.sourceMsgIds.length&&!book.cards.some(c=>c.title===x.title&&c.text===x.text));
    if(!items.length)throw Error('没有找到新的、能对上原对话的记忆，原来的记录都保留着');book.cards.push(...items);await save('keepsakes');toast('回忆草稿写好啦，确认后才会带入对话');
  }finally{ksBusy.delete(lock);ksRenderMemory()}
}

function ksPutPhoto(sourceKey,desc,ownerIds,img,extra={},oldImg){
  if(!img||S.album.hidden.includes(sourceKey))return null;let p=S.album.photos.find(p=>p.sourceKey===sourceKey);
  if(!p){p={id:uid(),sourceKey,desc:wmText(desc,4000)||'一张照片',ownerIds:[...new Set(ownerIds)].filter(id=>!!charById(id)),versions:[],comments:[],at:extra.at||Date.now(),...extra};S.album.photos.push(p)}
  if(oldImg&&!p.versions.some(v=>v.img===oldImg))p.versions.push({id:uid(),img:oldImg,at:p.at,meta:{}});
  let v=p.versions.find(v=>v.img===img);if(!v){v={id:uid(),img,at:Date.now(),meta:extra.meta||{}};p.versions.push(v)}p.current=v.id;return p;
}
function ksRecordPhoto(T,m,oldImg){
  if(!S.album)return;const p=ksPutPhoto('msg:'+T.id+':'+m.id,m.content||m.data?.caption,T.members,m.data?.img,{threadId:T.id,msgId:m.id,at:m.ts,mode:m.mode,meta:m.data?.generation||{}},oldImg);if(p){save('album');if($('#app-album')?.classList.contains('open'))ksRenderAlbum()}
}
function ksSyncPhotos(){
  if(!S.album)return;
  for(const T of S.threads)for(const m of T.msgs)if(m.type==='image'&&m.data?.img)ksPutPhoto('msg:'+T.id+':'+m.id,m.content||m.data.caption,T.members,m.data.img,{threadId:T.id,msgId:m.id,at:m.ts,mode:m.mode,meta:m.data.generation||{}});
  for(const p of S.moments||[])for(let i=0;i<(p.imgs||[]).length;i++)ksPutPhoto('moment:'+p.id+':'+i,p.photo||p.text,p.who==='user'?[]:[p.who],p.imgs[i],{momentId:p.id,at:p.ts,mode:'moments',meta:p.generations?.[i]||{}});
  save('album');
}
function ksPhotoCard(p){const v=ksActivePhoto(p);return `<button class="ks-photo" data-ks="photo" data-id="${esc(p.id)}"><img loading="lazy" src="${esc(v.img)}" alt="${esc(p.desc)}"><span>${esc(p.desc.slice(0,60))}</span><small>${ksDate(p.at)} · ${p.versions.length} 个版本</small></button>`}
function ksAlbumTile(c){const photos=S.album.photos.filter(p=>p.ownerIds.includes(c.id)),latest=photos.at(-1);return `<button class="ks-album-tile" data-ks="album-char" data-id="${esc(c.id)}"><div class="ks-cover">${ksSprite('cover',145)}<span class="ks-cover-avatar">${charAv(c)}</span></div><b>${esc(c.name)}</b><small>${photos.length} 张照片</small>${latest?`<img class="ks-cover-thumb" src="${esc(ksActivePhoto(latest).img)}" alt="最新照片">`:''}</button>`}
function ksRenderAlbum(){
  if(!S.album)return;ksSyncPhotos();const B=$('#albumBody');if(!B)return;
  const p=S.album.photos.find(p=>p.id===ksPhotoId);
  if(p){const currentInput=$('#ksComment');if(currentInput&&currentInput.dataset.photo===p.id)ksCommentDrafts.set(p.id,currentInput.value);const v=ksActivePhoto(p),T=S.threads.find(t=>t.id===p.threadId),m=T?.msgs.find(m=>m.id===p.msgId),comments=p.comments||[],replyBusy=[...ksBusy].some(k=>k.startsWith('comment:'+p.id+':'));
    B.innerHTML=`<div class="btns">${ksBtn('album-back','‹ 返回相簿')}${ksBtn('photo-delete','从相册移除',p.id)}</div><div class="ks-photo-detail"><img data-ks="photo-view" data-id="${esc(p.id)}" src="${esc(v.img)}" alt="${esc(p.desc)}"></div><div class="card glass"><h3>${esc(p.desc)}</h3><small>${ksDate(p.at)} · ${esc(p.mode==='offline'?'线下配图':p.mode==='moments'?'朋友圈':'线上照片 / 上传')}</small><p>${p.ownerIds.map(id=>esc(charById(id)?.name||'已删除角色')).join('、')||'我的私人照片'}</p><div class="btns">${ksBtn('photo-label','编辑描述 / 归属',p.id)}${ksBtn('photo-memory','收入记忆册',p.id)}${m?.role==='assistant'||(p.momentId&&S.moments.some(x=>x.id===p.momentId&&x.who!=='user'))?ksBtn('photo-redraw',(m&&photoBusy.has(m))||ksBusy.has('photo:'+p.id)?'正在重画…':'重新生成图片',p.id,(m&&photoBusy.has(m))||ksBusy.has('photo:'+p.id)?'disabled':''):''}</div><div class="ks-versions">${p.versions.map((x,i)=>`<button data-ks="photo-version" data-id="${esc(p.id)}" data-version="${esc(x.id)}" aria-pressed="${x.id===v.id}"><img src="${esc(x.img)}" alt="版本 ${i+1}"><span>版本 ${i+1}</span></button>`).join('')}</div>${v.meta?.seed!==undefined?`<small>Seed ${v.meta.seed} · ${esc(v.meta.noise_schedule||'')} · ${esc(v.meta.model||'')}</small>`:''}</div><div class="card glass"><h3>${ksSprite('envelope',36)} 这张照片下的悄悄话</h3><p class="hint">由你发点评，对应角色回复；角色不会自行开新评论。回复会使用角色的 AI 接口。</p>${comments.map(c=>`<div class="ks-comment"><b>${esc(c.role==='user'?S.user.name:charById(c.who)?.name||c.name||'TA')}</b><p>${esc(c.text)}</p><small>${new Date(c.at).toLocaleString()}</small>${c.role==='user'?`<div class="btns">${ksBtn('comment-delete','删除这条点评及回复',c.id)}${c.replyStatus==='failed'?ksBtn('comment-retry','重试角色回复',c.id):''}</div>`:''}</div>`).join('')}<textarea class="ks-textarea" id="ksComment" data-photo="${esc(p.id)}" placeholder="只有你能发起点评，想对 TA 说什么？">${esc(ksCommentDrafts.get(p.id)||'')}</textarea><div class="btns">${ksBtn('comment-post',replyBusy?'正在回复…':'写下点评',p.id,replyBusy?'disabled':'')}</div></div>`;return;
  }
  ksPhotoId=null;const c=charById(ksAlbumChar),photos=S.album.photos.filter(p=>ksAlbumChar==='all'||(ksAlbumChar==='user'?!p.ownerIds.length:p.ownerIds.includes(ksAlbumChar)));
  B.innerHTML=`<div class="ks-hero">${ksSprite('album',90)}<div><small>把每一次心动，留在星光里</small><h2>${esc(c?.name?c.name+'的相簿':'星光相册')}</h2><p>线上、线下与朋友圈的照片，都收在这里</p></div></div><div class="btns">${ksBtn('album-all','全部照片')}${ksBtn('album-personal','我的照片')}${ksBtn('album-upload','添加照片')}</div>${!c&&ksAlbumChar!=='user'?`<div class="ks-album-grid">${S.chars.map(ksAlbumTile).join('')}</div>`:''}${c?`<div class="btns">${ksBtn('open-memory','翻翻 TA 的记忆册',c.id)}</div>`:''}<h3>${c?'属于我们的照片':ksAlbumChar==='user'?'我的私人照片':'所有照片'} · ${photos.length}</h3>${photos.length?`<div class="ks-photo-grid">${photos.slice().sort((a,b)=>b.at-a.at).map(ksPhotoCard).join('')}</div>`:`<div class="ks-empty">${ksSprite('fox',170)}<p>狐狸替你抱好空相框，等第一张照片住进来。</p></div>`}`;
}
async function ksRedrawPhoto(p){
  const T=S.threads.find(t=>t.id===p.threadId),m=T?.msgs.find(m=>m.id===p.msgId);
  if(m){const task=regeneratePhoto(T,m);ksRenderAlbum();await task;ksRenderAlbum();return}
  const state=S.album,post=S.moments.find(x=>x.id===p.momentId),lock='photo:'+p.id;
  if(!post||post.who==='user'||ksBusy.has(lock))return;if(!imgReady())throw Error('先在设置里填好生图接口');ksBusy.add(lock);ksRenderAlbum();
  try{const meta={},img=await genImage(post.photo||p.desc,charById(post.who),meta);if(S.album!==state||!state.photos.includes(p)||!S.moments.includes(post))return;if(!img)throw Error('生图没有返回图片');const i=Number(p.sourceKey.split(':').at(-1));post.imgs[i]=img;post.generations||=[];post.generations[i]=meta;ksPutPhoto(p.sourceKey,p.desc,p.ownerIds,img,{meta});await Promise.all([save('moments'),save('album')]);}
  catch(e){toast('这次没画好，原图已保留：'+e.message,5000)}finally{ksBusy.delete(lock);if(S.album===state)ksRenderAlbum()}
}
async function ksUploadPhoto(){
  const state=S.album,f=await pickFile('image/*');if(!f)return;const img=await fileToImg(f,1280),r=await formSheet('把照片收进相簿',[{k:'desc',t:'textarea',l:'照片描述'},{k:'owners',t:'multi',l:'属于哪些角色（可多选；不选就是我的私人照片）',opts:S.chars.map(c=>[c.id,c.name])}],{desc:'',owners:charById(ksAlbumChar)?[ksAlbumChar]:[]});if(!r||S.album!==state)return;
  const p=ksPutPhoto('upload:'+uid(),wmText(r.desc,4000)||f.name,(r.owners||[]).filter(charById),img,{mode:'upload'});await save('album');ksPhotoId=p.id;ksRenderAlbum();
}
async function ksPhotoLabel(p){const state=S.album,r=await formSheet('照片描述与归属',[{k:'desc',t:'textarea',l:'描述'},{k:'owners',t:'multi',l:'所属角色',opts:S.chars.map(c=>[c.id,c.name])}],{desc:p.desc,owners:p.ownerIds});if(!r||state!==S.album||!state.photos.includes(p))return;p.desc=wmText(r.desc,4000)||'一张照片';p.ownerIds=(r.owners||[]).filter(charById);await save('album');ksRenderAlbum()}
async function ksCommentReply(p,c){
  const state=S.album,cid=c.replyWho,who=p.ownerIds.includes(cid)&&charById(cid),lock='comment:'+p.id+':'+c.id;if(!who||ksBusy.has(lock)||c.replyStatus==='done')return;
  ksBusy.add(lock);c.replyStatus='pending';ksRenderAlbum();
  try{
    const T=S.threads.find(t=>!isGroup(t)&&t.members[0]===cid),context=T?ksMemoryPrompt(T):'';
    const out=await callAPI([{role:'system',content:`你是${who.name}。${cardBlock(who)}\n用户：${S.user.name}，人设：${S.user.persona||''}\n${context}\n你在相册里回复用户对照片的点评。只回复用户，不另开评论，不替用户说话，约30—120字。依据照片描述，不声称看到了未提供的图片细节。`},{role:'user',content:`照片描述：${p.desc}\n同一条点评的记录：${JSON.stringify(p.comments.filter(x=>x.id===c.id||x.parentId===c.id).map(x=>({role:x.role,text:x.text})))}\n用户点评：${c.text}`}],{char:who,max_tokens:500,temperature:.9});
    if(S.album!==state||!state.photos.includes(p)||!p.comments.includes(c)||!p.ownerIds.includes(cid))return;
    const text=wmText(clean(out),2000);if(!text)throw Error('TA 这次没有返回回复');
    if(!p.comments.some(x=>x.parentId===c.id))p.comments.push({id:uid(),parentId:c.id,role:'assistant',who:cid,name:who.name,text,at:Date.now()});c.replyStatus='done';
  }catch(e){if(S.album===state&&p.comments.includes(c)){c.replyStatus='failed';toast('点评已保留，TA 这次没回复上：'+e.message,5000)}}
  finally{ksBusy.delete(lock);if(S.album===state){await save('album');if($('#app-album')?.classList.contains('open'))ksRenderAlbum()}}
}
async function ksPostComment(p){
  const input=$('#ksComment'),text=wmText(input?.value,2000);if(!text)return toast('先写一句点评吧');const state=S.album,owners=p.ownerIds.map(charById).filter(Boolean);let who=owners[0];
  if(owners.length>1){const i=await actionSheet(owners.map(c=>({label:c.name})),'这句点评想让谁回复？');if(i==null||i<0||!owners[i])return;who=owners[i]}
  if(S.album!==state||!state.photos.includes(p))return;const c={id:uid(),role:'user',text,at:Date.now(),replyWho:who?.id||'',replyStatus:who?'pending':'none'};p.comments.push(c);ksCommentDrafts.delete(p.id);if(input)input.value='';await save('album');ksRenderAlbum();if(who)await ksCommentReply(p,c);
}
function ksPeekGlyph(kind){const paths={chats:'i-chat.png',memo:'deco/i-book.webp',album:'ui/photo.webp',cart:'i-shop.png',wallet:'i-wallet.webp',phone:'i-peek.png',busy:'ui/spark.webp'};return paths[kind]?`<img class="ks-peek-icon" src="themes/prince/${paths[kind]}" alt="">`:'🔍'}
function ksApplyPeekIcons(){for(const b of $$('#peekTabs [data-pt]')){const i=b.querySelector('i');if(i&&b.dataset.pt!=='search')i.innerHTML=b.dataset.pt==='album'?ksSprite('camera',28):ksPeekGlyph(b.dataset.pt)} }

document.addEventListener('change',e=>{if(e.target.id==='ksMemorySelect'){ksMemoryChar=e.target.value;ksMemoryFilter='all';ksRenderMemory()}});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ks]');if(!b||b.disabled)return;const a=b.dataset.ks,id=b.dataset.id||'',p=S.album?.photos.find(p=>p.id===id),book=ksMemoryChar&&S.keepsakes?.books[ksMemoryChar],card=book?.cards.find(x=>x.id===id);
  try{
    if(a==='open-memory')ksOpenMemory(id);if(a==='album-char')ksOpenAlbum(id);if(a==='album-home'||a==='album-all'){ksAlbumChar='all';ksPhotoId=null;ksRenderAlbum()}if(a==='album-personal'){ksAlbumChar='user';ksPhotoId=null;ksRenderAlbum()}if(a==='album-back'){ksPhotoId=null;ksRenderAlbum()}if(a==='album-upload')await ksUploadPhoto();
    if(a==='photo'&&p){ksPhotoId=id;ksRenderAlbum();$('#albumBody').scrollTop=0;if(!$('#app-album').classList.contains('open'))openApp('album')}
    if(a==='photo-view'&&p)showViewer(ksActivePhoto(p).img);
    if(a==='photo-label'&&p)await ksPhotoLabel(p);
    if(a==='photo-delete'&&p){const state=S.album;if(await actionSheet([{label:'从相册移除照片与点评'},{label:'保留'}],'只从相册移除，原聊天和朋友圈图片仍保留。')===0&&state===S.album){state.hidden.push(p.sourceKey);state.photos=state.photos.filter(x=>x!==p);await save('album');ksPhotoId=null;ksRenderAlbum()}}
    if(a==='photo-version'&&p){const v=p.versions.find(v=>v.id===b.dataset.version);if(v){p.current=v.id;const T=S.threads.find(t=>t.id===p.threadId),m=T?.msgs.find(m=>m.id===p.msgId);if(m){m.data.img=v.img;m.data.generation=v.meta;saveMsgs(T)}if(p.momentId){const post=S.moments.find(x=>x.id===p.momentId),i=Number(p.sourceKey.split(':').at(-1));if(post?.imgs?.[i]){post.imgs[i]=v.img;save('moments')}}await save('album');ksRenderAlbum()}}
    if(a==='photo-redraw'&&p)await ksRedrawPhoto(p);
    if(a==='photo-memory'&&p){const owners=p.ownerIds.map(charById).filter(Boolean);if(!owners.length)throw Error('先在「编辑描述 / 归属」选择一个角色');let c=owners[0];if(owners.length>1){const i=await actionSheet(owners.map(c=>({label:c.name})),'收入谁的记忆册？');if(i==null||i<0||!owners[i])return;c=owners[i]}ksMemoryChar=c.id;await ksEditMemory('',p.id);ksOpenMemory(c.id)}
    if(a==='memory-filter'){ksMemoryFilter=id;ksRenderMemory()}if(a==='memory-new'||a==='memory-edit')await ksEditMemory(id);if(a==='memory-draft')await ksDraftMemories(id);
    if(card){if(a==='memory-confirm')card.status='confirmed';if(a==='memory-pin')card.pinned=!card.pinned;if(a==='memory-done')card.done=!card.done;if(a==='memory-delete'){const state=S.keepsakes;if(await actionSheet([{label:card.status==='draft'?'舍弃这条草稿':'删除这条记忆'},{label:'保留'}])!==0||S.keepsakes!==state)return;book.cards=book.cards.filter(x=>x!==card)}await save('keepsakes');ksRenderMemory()}
    if(a==='memory-legacy-save'){const T=S.threads.find(t=>!isGroup(t)&&t.members[0]===id);if(!T)throw Error('先与 TA 开始一段对话');T.mem.summary=$('#ksLegacyMemory').value.trim();await saveMem(T);toast('摘要已保存')}
    if(a==='memory-legacy-summarize'){const T=S.threads.find(t=>!isGroup(t)&&t.members[0]===id);if(T)await maybeSummarize(T,true);else toast('先与 TA 留下一些对话吧')}
    if(a==='comment-post'&&p)await ksPostComment(p);
    if(a==='comment-delete'||a==='comment-retry'){const photo=S.album.photos.find(p=>p.comments.some(c=>c.id===id)),c=photo?.comments.find(c=>c.id===id);if(c?.role!=='user')return;if(a==='comment-retry')await ksCommentReply(photo,c);else{photo.comments=photo.comments.filter(x=>x.id!==id&&x.parentId!==id);await save('album');ksRenderAlbum()}}
  }catch(err){toast(err.message,5000)}
});

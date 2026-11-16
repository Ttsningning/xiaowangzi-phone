/* 弥隙星的生活记录。证件资料实时来自角色卡；叙事不授予许可或改变同行状态。 */
Object.assign(DEFAULTS.visitors,{passports:{},permits:{},arrivals:{},souvenirs:[],news:[],home:null,tab:'overview'});
VISITOR_PLACES.incubator={name:'母星人造子宫综合体',kind:'许可参观',desc:'外来男性不得接近；外来女性须得到母星许可。'};
const MIXI_ASSETS='themes/prince/visitors/';
const MIXI_TABS={overview:'入境与会面',passport:'来客证',city:'城市动态',keepsakes:'旅程纪念',home:'我的住所'};
const mixiBaseEnsure=visitorEnsure,mixiBaseInit=visitorInit,mixiBaseMessages=visitorMessages;
function mixiGender(person){const g=String(person?.gender||person?.sex||person?.extensions?.gender||'').trim().toLowerCase();return ['female','woman','女','女性'].includes(g)?'female':['male','man','男','男性'].includes(g)?'male':g?'other':''}
function mixiGenderLabel(person){return {female:'女性',male:'男性',other:'其他'}[mixiGender(person)]||'未填写'}
function mixiPlace(id){return id==='incubator'?{name:'母星人造子宫综合体',kind:'许可参观',desc:'原住公民的育成与教育建筑。外来男性不得接近或进入；外来女性须获得母星许可。'}:VISITOR_PLACES[id]||VISITOR_PLACES.port}
function mixiArt(name,size=36){return `<img class="mixi-art" src="${MIXI_ASSETS+name}.webp" width="${size}" height="${size}" alt="">`}
visitorEnsure=function(){const V=mixiBaseEnsure();for(const k of ['passports','permits','arrivals'])V[k]||={};for(const k of ['souvenirs','news'])if(!Array.isArray(V[k]))V[k]=[];V.tab=MIXI_TABS[V.tab]?V.tab:'overview';for(const [id,permit] of Object.entries(V.permits)){if(permit?.status==='approved'&&mixiGender(id==='user'?S.user:charById(id))!==permit.gender)permit.status='revoked';}if(V.place==='incubator'&&(mixiGender(S.user)!=='female'||V.permits.user?.status!=='approved')){V.place='port';V.epoch++;}return V};
visitorInit=function(){mixiBaseInit();const V=visitorEnsure();
 const book=S.world.books.find(b=>/^builtin:visitors-v[12]$/.test(b.src));
 if(book?.src==='builtin:visitors-v1'){
  for(const e of book.entries){e.content=String(e.content||'').replace('万界来客是一颗位于这项隔离法则灰色地带的高度发达赛博星球','弥隙星是一颗位于这项隔离法则灰色地带的高度发达赛博星球；「万界来客」仅为APP名称。弥隙星').replace('外来客人主要是男性，但外来女性同样可以来访。','外来男性与外来女性都可来访弥隙星。').replace('万界外来客人不允许接近这座设施，不能通过赴约、找工作、伪装居民或邀请绕过限制。设施不是约会、探访或自由探索地点。','外来男性不得靠近或进入这座设施；外来女性须先获得母星许可才可参观，邀请或角色台词不等于许可。设施不是约会地点。').replaceAll('在万界来客出生','在弥隙星出生');e.keys=[...new Set([...(e.keys||[]),'弥隙星'])]}
  book.src='builtin:visitors-v2';book.name='弥隙星 · 万界法则与居民生活';save('world');
 }
 if(!V.cityV2){if(V.inside&&V.companion&&!V.arrivals[V.companion])V.arrivals[V.companion]={status:'arrived',place:V.place,at:Date.now()};V.cityV2=true;}
 if(!V.news.length)V.news=[{id:uid(),kind:'交通',title:'星港到站指引',text:'环城列车连接星港、商贸街与公共街区。赴约前可先约好同一座站台。',at:Date.now()},{id:uid(),kind:'本地生活',title:'公民毕业季',text:'新一届原住公民即将完成育成建筑中的大学学业，进入城市各行业工作；就业与福利服务同步开放。',at:Date.now()},{id:uid(),kind:'城市提醒',title:'入境与参观许可',text:'育成设施对外来男性禁止接近；外来女性请先在来客证页向母星申请参观许可。',at:Date.now()}];
 visitorSave();
};
function visitorPassport(id='user'){
 const V=visitorEnsure(),p=id==='user'?S.user:charById(id);if(!p)return null;
 const fresh=!V.passports[id];const record=V.passports[id]||=( {number:'MX-'+uid().replace(/[^a-z0-9]/gi,'').slice(-12).toUpperCase(),issuedAt:Date.now()} );
 if(fresh)visitorSave().catch(e=>toast(e.message,5000));
 return {...record,id,name:p.name||'未命名',avatar:p.avatar||'',gender:mixiGender(p),genderLabel:mixiGenderLabel(p),origin:p.visitorOrigin?.kind==='native'?'弥隙星':p.marketOrigin?.world||p.visitorOrigin?.world||p.originWorld||'原生世界未填写',native:p.visitorOrigin?.kind==='native',stay:id==='user'&&V.home?.settled?'长期定居':'短期来访'};
}
function visitorCoPresent(V=visitorEnsure()){const a=V.arrivals[V.companion];return !!(V.inside&&V.companion&&a?.status==='arrived'&&a.place===V.place&&(V.place!=='incubator'||visitorAccess(V.companion).allowed))}
function visitorAccess(id='user'){
 const p=visitorPassport(id),permit=visitorEnsure().permits[id];
 if(p?.gender==='male')return {allowed:false,label:'男性来客不得接近或进入'};
 if(p?.gender!=='female')return {allowed:false,label:'请先明确填写女性身份，母星才可审核参观申请'};
 return permit?.status==='approved'&&permit.gender==='female'?{allowed:true,label:'母星参观许可已签发'}:{allowed:false,label:'女性来客须先获得母星参观许可'};
}
function visitorPresence(V=visitorEnsure()){
 const c=charById(V.companion),a=V.arrivals[V.companion];
 return !V.inside?'用户未入境弥隙星。':`用户在${mixiPlace(V.place).name}。${!c?'用户独自旅行。':visitorCoPresent(V)?`已确认与${c.name}同处并同行。`:`${c.name}仅是预约会面对象；${a?.status==='arrived'?'对方在'+mixiPlace(a.place).name:'尚未确认到站'}。双方未同处，不得身体接触或当面交谈，可通过手机联系。`}`;
}
function mixiEvent(cid,text){const e={id:uid(),role:'event',text,at:Date.now()};visitorJournal(cid).push(e);return e}
visitorEnter=async function(cid=''){
 const c=charById(cid);if(cid&&(!c||!visitorIsChar(c)))throw Error('请选择万界来源联系人');if(visitorsBusy.size)throw Error('等当前内容生成完成');
 const V=visitorEnsure();if(V.companion&&V.companion!==cid)mixiEvent(V.companion,'本次同行或会面安排结束。');
 if(!V.inside)V.place='port';V.inside=true;V.companion=c?.id||'';V.epoch++;
 if(c){const old=V.arrivals[cid];if(!old||old.status==='departed')V.arrivals[cid]={status:'invited',place:'port',at:Date.now()};mixiEvent(cid,'用户已进入弥隙星，已发出会面邀请；对方抵达前不成立面对面同行。')}
 else mixiEvent('','用户独自进入弥隙星，地点：'+mixiPlace(V.place).name+'。');
 await visitorSave();visitorRender();
};
async function visitorConfirmArrival(){
 const V=visitorEnsure(),c=charById(V.companion);if(!V.inside||!c||!V.arrivals[c.id])return;
 const a=V.arrivals[c.id];if(a.status!=='invited')return;
 a.status='arrived';a.place='port';a.at=Date.now();V.epoch++;
 mixiEvent(c.id,c.name+'的到站信息已由星港确认，位置：来客星港。'+(visitorCoPresent(V)?'双方在星港会合，开始同行。':'用户仍在'+mixiPlace(V.place).name+'，尚未会合。'));
 await visitorSave();visitorRender();
}
async function visitorMove(id){
 const V=visitorEnsure();if(!V.inside||(!VISITOR_PLACES[id]&&id!=='incubator'))return;
 if(visitorsBusy.size)throw Error('等当前剧情写完再移动');
 if(id==='incubator'&&!visitorAccess().allowed)throw Error(visitorAccess().label);
 const together=visitorCoPresent(V),c=charById(V.companion);V.place=id;V.epoch++;
 if(together&&c&&(id!=='incubator'||visitorAccess(c.id).allowed))V.arrivals[c.id].place=id;
 mixiEvent(V.companion,'用户主动前往'+mixiPlace(id).name+'。'+(visitorCoPresent(V)?'与'+c.name+'同行。':c?c.name+'未随行，仍需另行会合。':'独自探索。'));
 await visitorSave();visitorRender();
}
async function visitorApplyPermit(id='user'){
 if(visitorsBusy.size)return;const passport=visitorPassport(id),V=visitorEnsure();if(!passport)throw Error('找不到对应的来客证');
 if(passport.gender!=='female')throw Error(visitorAccess(id).label);
 if(await actionSheet([{label:'提交女性来客参观申请'},{label:'暂不申请'}],'为「'+passport.name+'」向母星提交参观申请；许可只适用于这份女性来客证。')!==0)return;
 if(S.visitors!==V)return;
 if(visitorPassport(id)?.gender!=='female')throw Error('证件资料已变化，请重新申请');
 V.permits[id]={status:'approved',gender:'female',number:'PERMIT-'+uid().slice(-10),at:Date.now()};
 mixiEvent(V.companion,'母星已核验「'+passport.name+'」的女性来客证并签发参观许可。许可仅适用于本人，不延伸至男性同行者。');await visitorSave();visitorRender();toast('母星参观许可已签发');
}
function visitorPassportHTML(id){const p=visitorPassport(id);if(!p)return '';return `<article class="mixi-passport"><div class="mixi-pass-head">${mixiArt('entry',45)}<span>弥隙星 · ${p.native?'原住公民证':p.stay==='长期定居'?'定居来客证':'来客证'}</span></div><div class="mixi-pass-person">${p.avatar?`<img class="mixi-avatar" src="${esc(p.avatar)}" alt="${esc(p.name)}的头像">`:`<span class="mixi-avatar">${esc(p.name.slice(0,1))}</span>`}<div><h3>${esc(p.name)}</h3><p>${esc(p.genderLabel)} · ${esc(p.origin)}</p></div></div><dl><dt>证件号</dt><dd>${esc(p.number)}</dd><dt>居留</dt><dd>${esc(p.native?'原住公民':p.stay)}</dd><dt>力量折算</dt><dd>普通人或略强于普通人</dd></dl><small>姓名、性别、头像与来源读取当前角色资料。</small></article>`}
function visitorArrivalHTML(V,c){if(!c)return '';const a=V.arrivals[c.id];return `<div class="mixi-arrival">${mixiArt('together',32)}<b>${esc(c.name)} · ${visitorCoPresent(V)?'已会合':a?.status==='arrived'?'已到站，尚未会合':'等待到站'}</b><p>${visitorCoPresent(V)?'你们现在可以面对面交谈。':a?.status==='arrived'?'对方在'+esc(mixiPlace(a.place).name)+'，你在'+esc(mixiPlace(V.place).name)+'。':'邀请已发出。对方到站前，你们仍通过手机联系。'}</p>${a?.status==='invited'?visitorButton('arrival','查看星港到站信息'):a?.status==='arrived'&&!visitorCoPresent(V)?visitorButton('rendezvous','前往'+mixiPlace(a.place).name+'会合'):''}</div>`}
function visitorNewsHTML(V){return `<section class="visitor-panel"><h3>弥隙星 · 城市动态</h3><p class="hint">交通、居民、毕业季与街区日常。城市消息不替你推进婚育或改变行程。</p>${visitorButton('news','刷新城市见闻',visitorsBusy.size?'disabled':'')}<div class="mixi-news">${V.news.map(n=>`<article><small>${esc(n.kind)} · ${new Date(n.at).toLocaleDateString()}</small><h4>${esc(n.title)}</h4><p>${esc(n.text)}</p></article>`).join('')}</div></section>`}
async function visitorRefreshNews(){
 const V=visitorEnsure(),c=charById(V.companion);if(visitorsBusy.size)return;if(!ownAPI(c)&&!apiReady())throw Error('先填写 AI 接口，再刷新城市见闻');visitorsBusy.add('news');visitorRender();
 try{const out=await callAPI([{role:'system',content:VISITOR_WORLD_RULES+'\n只生成弥隙星的3条虚构城市公共消息，涵盖交通、普通成年居民生活、商贸或公民毕业就业；不得改变用户的行程、关系、资产和参观权限，不编造未成年人恋爱。只输出 JSON {"news":[{"kind":"分类","title":"标题","text":"约80字正文"}]}。'},{role:'user',content:'已有消息：'+JSON.stringify(V.news.slice(0,5))}],{char:c||undefined,max_tokens:1500,temperature:.9});const j=parseJSON(out),items=(j.news||[]).slice(0,3).filter(n=>typeof n.title==='string'&&typeof n.text==='string').map(n=>({id:uid(),kind:wmText(n.kind,30)||'城市',title:wmText(n.title,80),text:wmText(n.text,800),at:Date.now()}));if(!items.length)throw Error('没有生成可用城市消息');if(S.visitors!==V)return;V.news=[...items,...V.news].slice(0,30);await visitorSave()}
 finally{visitorsBusy.delete('news');if(S.visitors===V)visitorRender()}
}
async function visitorRegisterHome(){
 const V=visitorEnsure();if(!V.inside)throw Error('请先入境弥隙星');if(visitorsBusy.size)return;
 const mode=await actionSheet([{label:'登记短住居所'},{label:'办理长期定居'}],'弥隙星住所登记');if(mode<0)return;
 const r=await formSheet('把这里布置成自己的小窝',[{k:'name',t:'text',l:'住所名字'},{k:'decor',t:'textarea',l:'房间布置与想保留的细节'}],{name:V.home?.name||'星港小公寓',decor:V.home?.decor||'窗边的小桌、柔软的沙发与一盏暖灯。'});if(!r||S.visitors!==V||!V.inside)return;
 V.home={id:V.home?.id||uid(),name:wmText(r.name,80)||'我的小窝',decor:wmText(r.decor,2000),settled:mode===1,at:Date.now()};mixiEvent(V.companion,'用户登记了弥隙星'+(mode===1?'长期':'短住')+'居所「'+V.home.name+'」，住所与布置会保留。外来者身份没有变成原住公民。');await visitorSave();visitorRender();
}
async function visitorRemember(){
 const V=visitorEnsure(),cid=visitorCoPresent(V)?V.companion:'',c=charById(cid);if(!V.inside)throw Error('先入境，再留下旅行纪念');if(visitorsBusy.size)return;
 const r=await formSheet('留一份弥隙星纪念',[{k:'title',t:'text',l:'纪念物名字'},{k:'text',t:'textarea',l:'想记住什么'}],{title:mixiPlace(V.place).name+'的纪念票根',text:'在'+mixiPlace(V.place).name+(c?'与'+c.name+'见面。':'度过了一个自己的下午。')});if(!r||S.visitors!==V||!V.inside)return;
 const title=wmText(r.title,100),text=wmText(r.text,2000);if(!title||!text)throw Error('写个名字和一段回忆吧');
 const record={id:uid(),title,text,cid,place:V.place,at:Date.now()};V.souvenirs.unshift(record);S.wallet.bag.push({id:uid(),name:title,desc:text,kind:'token',qty:1,from:'弥隙星旅行纪念',source:'visitors',charId:cid,at:record.at});
 if(c){const T=threadOf(cid),event=pushMsg(T,'online','event','你与'+c.name+'把弥隙星的共同经历收成纪念「'+title+'」：'+text);ksBook(cid).cards.push({id:uid(),kind:'event',title,text:'弥隙星 · '+mixiPlace(V.place).name+'：'+text,status:'confirmed',pinned:true,done:false,sourceTid:T.id,sourceMsgIds:[event.id],at:record.at,date:ksDate(record.at)});await save('keepsakes')}
 mixiEvent(V.companion,'已收好旅行纪念「'+title+'」。');await Promise.all([visitorSave(),save('wallet')]);visitorRender();toast(c?'纪念已收入百宝箱与双方的回忆':'旅行纪念已收入百宝箱');
}
async function visitorUploadPhoto(){
 const V=visitorEnsure();if(!V.inside)throw Error('先进入弥隙星');const cid=visitorCoPresent(V)?V.companion:'',place=V.place,f=await pickFile('image/*');if(!f)return;
 const img=await fileToImg(f,1400),p=ksPutPhoto('visitors:'+uid(),'弥隙星 · '+mixiPlace(place).name+'的旅行照片',cid?[cid]:[],img,{mode:'visitors',at:Date.now()});if(p){await save('album');toast('照片已收入星光相册')}
}
function visitorExtraHTML(V){
 if(V.tab==='passport')return `<section class="visitor-panel"><h3>来客证与参观许可</h3><p class="hint">资料请在「角色」中填写；未填写的性别不会从外貌推测。</p>${visitorPassportHTML('user')}${V.companion?visitorPassportHTML(V.companion):''}<div class="mixi-permit"><b>${esc(visitorAccess().label)}</b>${visitorButton('permit','向母星申请我的参观许可',`data-cid="user"`)}${V.companion?visitorButton('permit','为预约对象申请参观许可',`data-cid="${esc(V.companion)}"`):''}${visitorAccess().allowed?visitorButton('visit','持许可进入参观'):''}</div></section>`;
 if(V.tab==='city')return visitorNewsHTML(V);
 if(V.tab==='keepsakes')return `<section class="visitor-panel"><h3>旅程纪念</h3><div class="btns">${visitorButton('remember','留一份纪念')}${visitorButton('photo','收进一张旅行照片')}</div>${V.souvenirs.length?V.souvenirs.map(m=>`<article class="mixi-memento"><b>${esc(m.title)}</b><small>${esc(mixiPlace(m.place).name)} · ${esc(charById(m.cid)?.name||'独自旅行')}</small><p>${esc(m.text)}</p></article>`).join(''):`<div class="mixi-empty">${mixiArt('empty',210)}<p>下一次抵达，留一点舍不得忘的东西。</p></div>`}</section>`;
 if(V.tab==='home')return `<section class="visitor-panel"><h3>${mixiArt('home',40)} 我在弥隙星的住所</h3><img class="mixi-home-photo" src="${MIXI_ASSETS}residence.webp" alt="弥隙星居住区">${V.home?`<h3>${esc(V.home.name)}</h3><span class="visitor-tag">${V.home.settled?'长期定居':'短期居住'}</span><p class="mixi-preserve">${esc(V.home.decor)}</p><div class="btns">${visitorButton('home-register','修改住所与居留')}${visitorButton('go-home','回到小窝')}</div>`:`<p>临时歇脚，或者把下一次抵达也留在这里。</p>${visitorButton('home-register','登记我的住所')}`}</section>`;
 return '';
}
visitorRender=function(){
 const root=$('#visitorsBody');if(!root)return;const V=visitorEnsure(),c=charById(V.companion),busy=visitorsBusy.size>0,people=S.chars.filter(visitorIsChar),place=mixiPlace(V.place);
 root.innerHTML=`<div class="visitor-hero mixi-hero"><img src="${MIXI_ASSETS}hero.webp" alt="弥隙星星环与城市"><div><small>万界来客 · 星球入口</small><h2>弥隙星</h2><p>各自世界之外，也有一处可以相见的地方。</p><span class="visitor-tag">${V.inside?'已入境 · '+esc(place.name):'尚未入境'}</span></div></div><nav class="mixi-tabs">${Object.entries(MIXI_TABS).map(([k,t])=>visitorButton('tab',t,`data-tab="${k}" aria-pressed="${V.tab===k}"`)).join('')}</nav><details class="visitor-rules"><summary>${mixiArt('rules',28)} 弥隙星法则与居民生活</summary><div>${esc(VISITOR_WORLD_RULES)}</div></details>${V.tab==='overview'?`<section class="visitor-panel"><h3>${mixiArt('entry',36)} ${V.inside?'抵达与会面':'选择你的第一段旅程'}</h3><label>预约同行者<select id="visitorCompanion" ${busy?'disabled':''}><option value="">独自探索</option>${people.map(p=>`<option value="${esc(p.id)}" ${c?.id===p.id?'selected':''}>${esc(p.name)} · ${esc(p.marketOrigin?.world||p.visitorOrigin?.world||'万界来源')}</option>`).join('')}</select></label><div class="btns">${visitorButton('enter',V.inside?'发送所选会面邀请':'确认入境',busy?'disabled':'')}${V.inside?visitorButton('leave','结束旅程 · 返回原生世界',busy?'disabled':''):''}</div>${visitorArrivalHTML(V,c)}${!people.length?`<div class="mixi-empty small">${mixiArt('empty',130)}<p>在万界杂货铺添加好友后，对方会出现在这里。也可以独自入境。</p></div>`:''}</section>${V.inside?`<h3 class="mixi-map-head">${mixiArt('map',32)} 城市地图</h3><section class="visitor-districts">${Object.entries(VISITOR_PLACES).filter(([id])=>id!=='incubator').map(([id,p])=>`<button class="visitor-place ${id===V.place?'selected':''}" data-visitor="place" data-place="${id}" ${busy?'disabled':''}><img class="mixi-place-photo" src="${MIXI_ASSETS+id}.webp" alt="${esc(p.name)}"><small>${esc(p.kind)}</small><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></button>`).join('')}<div class="visitor-restricted"><img class="mixi-place-photo" src="${MIXI_ASSETS}incubator.webp" alt="育成建筑远景"><b>母星人造子宫综合体</b><p>外来男性不得靠近或进入；外来女性经母星许可后可参观。</p>${visitorAccess().allowed?visitorButton('visit','持母星许可参观'):visitorButton('passport-tab','查看来客证与许可')}</div></section>${mixiJourneyHTML(V,c)}`:''}`:visitorExtraHTML(V)}`;
}
function mixiJourneyHTML(V,c){const logs=visitorJournal(V.companion);return `<section class="visitor-panel"><h3>${mixiArt('journal',36)} ${esc(mixiPlace(V.place).name)} · ${visitorCoPresent(V)?esc(c.name)+'同行':'独自旅行'}</h3><p class="hint">${esc(visitorPresence(V))}</p><div class="visitor-log">${logs.map(m=>m.role==='event'?`<p class="visitor-event">${esc(m.text)}</p>`:`<div class="visitor-message ${m.role==='user'?'mine':''}"><b>${esc(m.role==='user'?S.user.name:m.name||'星球见闻')}</b><p>${esc(m.text)}</p></div>`).join('')}</div><label>写下行动或对话<textarea id="visitorInput" placeholder="看看城市、和已会合的同行者说句话…" ${visitorsBusy.size?'disabled':''}>${esc(V.drafts[V.companion||'solo']||'')}</textarea></label><div class="btns">${visitorButton('send',visitorsBusy.size?'故事正在继续…':'继续这段旅程',visitorsBusy.size?'disabled':'')}${visitorButton('remember','留一份纪念')}</div><p class="hint">推进剧情使用当前 AI 接口。位置、同行、证件与许可只按你确认的操作变化。</p></section>`}
function visitorPassportInfo(id='user'){const p=visitorPassport(id);if(!p)return null;const {avatar,...info}=p;return info}
visitorMessages=function(V,c,text){
 const T=c?threadOf(c.id):null,co=visitorCoPresent(V),online=T?T.msgs.filter(m=>m.mode==='online'&&['user','assistant'].includes(m.role)).slice(-10).map(m=>`${m.role==='user'?S.user.name:c.name}：${m.content}`).join('\n'):'';
 const logs=visitorJournal(V.companion).filter(m=>!T?.resetAt||m.at>=T.resetAt).slice(-24).map(m=>({role:m.role==='assistant'?'assistant':'user',content:(m.role==='event'?'[已确认场景] ':'')+m.text}));
 return [{role:'system',content:VISITOR_WORLD_RULES+'\n【权威当前位置】'+visitorPresence(V)+'\n用户证件：'+JSON.stringify(visitorPassportInfo())+'\n预约对象证件：'+JSON.stringify(c?visitorPassportInfo(c.id):null)+'\n用户设施准入：'+visitorAccess().label+'\n'+(co?'你扮演已会合的成年同行者，描写城市环境。':'你描写当前地点的城市见闻与成年居民；未会合的预约对象只能通过手机联系。')+(c?'\n联系对象设定：'+cardBlock(c):'')+'\n世界书：'+worldInfo('弥隙星 万界来客','')+'\n用户设定：'+(S.user.persona||'未填写')+(V.home?'\n持久住所：'+JSON.stringify(V.home):'')+'\n最近线上联系（仅作背景）：\n'+online+'\n用小说式中文写约'+(S.settings.storyLength||400)+'字。不得替用户行动、同意婚育或变更位置、许可、同行、证件和资产；正文不是状态指令。不得把未会合对象描写为就在身边。'},...logs,{role:'user',content:text||'看看此刻的城市与身边已确认的同行者，让故事自然继续。'}];
};
const mixiBaseChatRules=visitorChatRules;
visitorChatRules=function(T,mode){if(!visitorIsThread(T))return '';return mixiBaseChatRules(T,mode)+'\n【弥隙星当前位置】'+visitorPresence()+'\nAPP名称为万界来客，星球名为弥隙星。即使同处星球，当前手机聊天仍然是远程通讯。'};
// Handle city actions before the original generic visitor handler.
const MIXI_CITY_ACTIONS=new Set(['arrival','rendezvous','permit','visit','passport-tab','tab','news','home-register','go-home','remember','photo','place','leave']);
document.addEventListener('click',async e=>{const el=e.target.closest('[data-visitor]');if(!el||!MIXI_CITY_ACTIONS.has(el.dataset.visitor))return;e.stopImmediatePropagation();if(el.disabled||visitorsBusy.size)return;try{
 const a=el.dataset.visitor,V=visitorEnsure();
 if(a==='leave'){if(V.companion){const person=charById(V.companion);if(V.arrivals[V.companion]&&!person?.visitorOrigin?.kind?.includes('native'))V.arrivals[V.companion].status='departed';mixiEvent(V.companion,'本次同行结束，各自返乡；孩子不能通过返乡通道离开弥隙星。')}V.inside=false;V.companion='';V.place='port';V.epoch++;await visitorSave();visitorRender();return;}
 if(a==='arrival')await visitorConfirmArrival();
 if(a==='rendezvous'){const x=V.arrivals[V.companion];if(x?.status==='arrived')await visitorMove(x.place)}
 if(a==='place')await visitorMove(el.dataset.place);
 if(a==='permit')await visitorApplyPermit(el.dataset.cid||'user');
 if(a==='visit')await visitorMove('incubator');
 if(a==='passport-tab'){V.tab='passport';await visitorSave();visitorRender()}
 if(a==='tab'){if(!MIXI_TABS[el.dataset.tab])return;V.tab=el.dataset.tab;await visitorSave();visitorRender()}
 if(a==='news')await visitorRefreshNews();
 if(a==='home-register')await visitorRegisterHome();
 if(a==='go-home'){await visitorMove('residence');V.tab='overview';await visitorSave();visitorRender()}
 if(a==='remember')await visitorRemember();
 if(a==='photo')await visitorUploadPhoto();
 }catch(err){toast(err.message||String(err),5000)}},true);

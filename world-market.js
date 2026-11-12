/* 月光海：钱包与万界集市。小王子新版；不读取月光海数据库。 */
DEFAULTS.wallet={balance:5200,currency:'元',ledger:[],incomes:[],bag:[],accounts:{},pending:[],aware:false};
DEFAULTS.market={rates:{},listings:[],feed:[],orders:[],lastTick:Date.now(),refreshAt:0};
const WM_DAY=86400000;
const wmSocialBusy=new Set(),wmCommentsOpen=new Set();
const wmText=(v,n=1000)=>typeof v==='string'?v.trim().slice(0,n):'';
function wmSocialInit(){
  const m=S.market;
  if(!m.social||typeof m.social!=='object')m.social={};
  const z=m.social;z.people||={};z.threads||={};
  if(!Array.isArray(z.requests))z.requests=[];
  if(!Array.isArray(z.encounters))z.encounters=[];
  z.settings={enabled:true,mode:'delayed',...z.settings};
  for(const o of m.orders){
    if(o.encounterChecked)continue;
    const l=m.listings.find(l=>l.id===o.listingId)||(m.listings.find(l=>l.name===o.name&&l.seller===o.seller));
    if(l)wmSocialPurchase(l,o);else o.encounterChecked=true;
  }
  // Retain identities for older simulated-buyer events too.
  for(const f of m.feed)if(!f.personId){const name=WM_NAMES.find(n=>f.text?.startsWith(n+' '));if(name)f.personId=wmPerson(name,'buyer','万界集市').id;}
}
function wmPerson(name,role,world,listingId,hint=''){
  const z=S.market.social;name=wmText(name,60)||'集市旅人';world=wmText(world,80)||'万界集市';
  let p=Object.values(z.people).find(p=>role==='subject'?p.role==='subject'&&((listingId&&p.listingId===listingId)||(name!=='物品另一端的陌生人'&&p.name===name&&p.world===world)):p.name===name&&p.world===world&&p.role!=='subject');
  if(!p){p={id:'mp'+uid(),name,role,world,listingId,hint:wmText(hint,1200)};z.people[p.id]=p;}
  return p;
}
function wmCommentThread(id){return S.market.social.threads[id]||=( {comments:[],seeded:false,offer:null} );}
function wmRequestsCount(){return S.market?.social?.requests.filter(r=>r.status==='pending').length||0;}
function wmSocialButton(action,label,id,extra=''){return `<button class="btn" data-wms="${action}" data-id="${esc(id||'')}" ${extra}>${esc(label)}</button>`;}
function wmFriendButton(id){
  const p=S.market.social.people[id];if(!p)return '';
  const c=S.chars.find(c=>c.marketPersonId===id);
  if(c)return wmSocialButton('chat','和 '+c.name+' 聊天',id);
  const r=S.market.social.requests.find(r=>r.personId===id);
  return wmSocialButton('friend',r?.status==='pending'?'查看好友申请':r?.status==='rejected'?'重新申请结识':'添加 '+p.name+' 为好友',id);
}
function wmEnqueueFriend(person,reason,source,automatic=false){
  const z=S.market.social,c=S.chars.find(c=>c.marketPersonId===person.id);
  if(c)return null;
  let r=z.requests.find(r=>r.personId===person.id);
  if(r){if((r.status==='rejected'||r.status==='accepted')&&!automatic){r.status='pending';r.at=Date.now();delete r.charId;}return r;}
  r={id:'mr'+uid(),personId:person.id,reason:wmText(reason,1200),source:wmText(source,150),status:'pending',at:Date.now()};
  z.requests.unshift(r);wmFeed('你收到一封来自「'+person.name+'」的好友申请。',{personId:person.id});
  return r;
}
function wmIsEncounter(l){return !!l.encounter?.hint||/留影|肖像|画像|照片|合影|信笺|书信|手札|日记/.test((l.name||'')+' '+(l.desc||''));}
function wmSocialPurchase(l,o){
  if(!S.market.social)wmSocialInit();
  if(o.encounterChecked)return;o.encounterChecked=true;
  if(o.status==='fulfilled'||!wmIsEncounter(l))return;
  const p=wmPerson(l.encounter?.name||'物品另一端的陌生人','subject',l.world,l.id,`${l.encounter?.hint||''}\n关联物品：${l.name}\n${l.desc}`);
  S.market.social.encounters.push({id:'me'+uid(),orderId:o.id,listingId:l.id,personId:p.id,source:l.name,status:'waiting-delivery',due:null});
  save('market');
}
function wmSocialTick(now=Date.now()){
  const z=S.market?.social;if(!z)return;
  let arrived=false;
  for(const e of z.encounters){
    if(e.status==='sent')continue;
    const o=S.market.orders.find(o=>o.id===e.orderId);
    if(!o||o.status!=='delivered')continue;
    if(e.status==='waiting-delivery'){e.status='waiting';e.due=now+(1+Math.random()*5)*3600000;}
    if(z.settings.enabled&&z.settings.mode==='delayed'&&e.due<=now){
      const p=z.people[e.personId];if(!p)continue;
      const before=z.requests.length;wmEnqueueFriend(p,`那件「${e.source}」已经到了你手里。物品另一端的人循着这条缘分，向你发来了一封来信。`,e.source,true);e.status='sent';arrived||=z.requests.length>before;
    }
  }
  if(arrived){toast('集市传来一封陌生来信，去消息或杂货铺看看吧 ✦',5000);if($('#app-msgs').classList.contains('open'))renderMsgs();}
}
function wmSocialOrder(o){
  const e=S.market.social.encounters.find(e=>e.orderId===o.id);if(!e)return '';
  return `<div class="wms-origin"><small>这件物品藏着一段人物缘分${o.status==='preorder'?'，到货后才会展开':''}。</small>${o.status==='delivered'?wmSocialButton('encounter',e.status==='sent'?'查看这段缘分':'让故事继续',e.id):''}</div>`;
}
function wmDealPrice(l){return l.type!=='wanted'&&!l.need&&l.deal?.expires>Date.now()?Math.min(l.price,l.deal.price):l.price;}
function wmSocialListing(l){
  const t=wmCommentThread(l.id),seller=wmPerson(l.seller,'seller',l.world,l.id,l.desc),busy=wmSocialBusy.has('comments:'+l.id);
  const offer=t.offer,valid=offer&&offer.expires>Date.now()&&l.stock>0;
  return `<div class="wms-seller">${wmFriendButton(seller.id)}</div><details class="wms-comments" data-comments="${esc(l.id)}" ${wmCommentsOpen.has(l.id)?'open':''}><summary>留言 (${t.comments.length}) · 聊天 / 讨价还价</summary><div class="wms-thread">${t.comments.map(c=>{
    const p=S.market.social.people[c.personId];return `<div class="wms-comment"><b>${esc(c.user?S.user.name:p?.name||'集市旅人')}<small>${c.user?'你':p?.role==='seller'?'卖家':p?.role==='buyer'?'买家':'围观者'} · ${new Date(c.at).toLocaleTimeString()}</small></b><p>${esc(c.text)}</p>${!c.user&&p?wmFriendButton(p.id):''}</div>`;
  }).join('')||'<p class="hint">还没有留言。打个招呼，或者听听大家怎么说。</p>'}</div>${valid?`<div class="wms-offer"><p>卖家给你的报价：${esc(wmFmt(offer.price))} / 件</p><small>${esc(offer.reason)} · 报价保留 30 分钟，确认购买前不扣款。</small>${wmSocialButton('offer','采用这个报价',l.id)}</div>`:''}<textarea data-wms-input="${esc(l.id)}" maxlength="1000" placeholder="问问来历、还个价，或者和大家聊两句…" aria-label="${esc(l.name)}的留言"></textarea><div class="btns">${wmSocialButton('post',busy?'正在等回复…':'发送留言',l.id,busy?'disabled':'')}${wmSocialButton('listen',busy?'大家正在说话…':t.seeded?'再听听大家聊什么':'听听大家怎么说',l.id,busy?'disabled':'')}</div><small>围观者都是这个世界里的角色；生成互动会使用已配置的聊天接口。你的留言会先保存，失败后可以重试。</small></details>`;
}
function wmRenderRequests(){
  const z=S.market.social;
  return wmCard('物品与陌生来信',`<label class="chk"><input type="checkbox" data-wms-setting="enabled" ${z.settings.enabled?'checked':''}>允许特殊物品带来好友申请</label><div class="field"><label>缘分怎么到来</label><select data-wms-setting="mode"><option value="delayed" ${z.settings.mode==='delayed'?'selected':''}>物品到手后 1～6 小时，收到来信</option><option value="manual" ${z.settings.mode==='manual'?'selected':''}>由我在订单中点「让故事继续」</option></select></div><p class="hint">关闭网页时不在后台运行，下次打开补上已到时间的来信。接受前不会加入联系人；人设可先预览。</p>`)+
  (z.requests.map(r=>{const p=z.people[r.personId];if(!p)return '';const c=S.chars.find(c=>c.marketPersonId===p.id),busy=wmSocialBusy.has('profile:'+p.id)||wmSocialBusy.has('accept:'+r.id),profile=p.profile;
    return wmCard(profile?.name||p.name,`<small>来自 ${esc(p.world)} · ${esc(r.source||'集市相逢')} · ${r.status==='accepted'?'已成为好友':r.status==='rejected'?'已婉拒':'等待你的回应'}</small><p>${esc(r.reason)}</p>${profile?`<details class="wms-profile"><summary>人物设定 · ${esc(profile.name)}</summary><p>${esc(profile.description)}</p><p>性格：${esc(profile.personality)}</p><p>与你的相遇：${esc(profile.scenario)}</p></details>`:''}<div class="btns">${c?wmFriendButton(p.id):r.status==='pending'?wmSocialButton('profile',busy?'正在写人设…':'看看人物设定',p.id,busy?'disabled':'')+wmSocialButton('accept',profile?'接受好友':'接受并生成人设',r.id,busy?'disabled':'')+wmSocialButton('reject','婉拒',r.id,busy?'disabled':''):''}</div>`);
  }).join('')||'<div class="evt">暂时没有陌生来信。购买特殊物品，或结识摊位上的人，故事就会慢慢展开。</div>');
}
async function wmProfile(person){
  if(person.profile)return person.profile;
  const lock='profile:'+person.id;if(wmSocialBusy.has(lock))throw Error('人设还在生成，请稍等');wmSocialBusy.add(lock);
  try{
    const market=S.market,listing=market.listings.find(l=>l.id===person.listingId);
    const history=wmCommentThread(person.listingId||person.id).comments.filter(c=>c.personId===person.id||c.user).slice(-12).map(c=>(c.user?S.user.name:person.name)+'：'+c.text).join('\n');
    const out=await callAPI([{role:'system',content:'为小手机里的虚构成年角色生成可长期聊天的人设。严格沿用已知身份、来源世界、商品线索和留言口吻，不把卖家误当成留影里的人。subject表示物品中的人物本人。若姓名未知，补全一个合适姓名。只输出 JSON {"name":"姓名","description":"身份、经历、外貌和目标，约300字","personality":"立体性格","scenario":"与用户因物品或集市相遇的当前背景","first_mes":"加好友后的第一句话","look":"成年角色外貌","mes_example":"对话示例"}。不替用户行动或默认恋爱关系。'},{role:'user',content:wmContext()+'\n人物身份：'+JSON.stringify(person)+'\n商品：'+JSON.stringify(listing||{})+'\n既有互动：'+history}],{char:charById(curT().members[0]),max_tokens:2200,temperature:.9});
    if(S.market!==market||market.social.people[person.id]!==person)throw Error('存档已经切换，请重新打开这封来信');
    const j=parseJSON(out),name=person.role==='subject'?(wmText(j.name,60)||person.name):person.name,description=wmText(j.description,6000),personality=wmText(j.personality,3000),scenario=wmText(j.scenario,4000),first_mes=wmText(j.first_mes,2000);
    if(!description||!personality||!scenario||!first_mes)throw Error('人物资料不完整，请重试');
    person.profile={name,description,personality,scenario,first_mes,look:wmText(j.look,2000),mes_example:wmText(j.mes_example,3000)};person.name=name;save('market');return person.profile;
  }finally{wmSocialBusy.delete(lock);}
}
async function wmAcceptRequest(id){
  const market=S.market,r=market.social.requests.find(r=>r.id===id);if(!r||r.status!=='pending')return;
  const lock='accept:'+id;if(wmSocialBusy.has(lock))return;wmSocialBusy.add(lock);
  try{
    const p=S.market.social.people[r.personId];if(!p)throw Error('找不到这位旅人');
    let c=S.chars.find(c=>c.marketPersonId===p.id);
    const profile=c?null:await wmProfile(p);
    if(r.status!=='pending'||S.market!==market||!market.social.requests.includes(r))return;
    c||=S.chars.find(c=>c.marketPersonId===p.id);
    if(!c){c={id:'c'+uid(),avatar:'',voice:'',...profile,marketPersonId:p.id,marketOrigin:{world:p.world,source:r.source}};S.chars.push(c);await saveChars();}
    const T=threadOf(c.id);if(!T.msgs.length)pushMsg(T,'online','assistant',c.first_mes,{who:c.id});
    r.status='accepted';r.charId=c.id;save('market');syncUnread();updateBadges();toast('「'+c.name+'」已经加入联系人，可以继续聊天啦 ✦');
  }finally{wmSocialBusy.delete(lock);wmRenderMarket();}
}
async function wmSocialTalk(id,post){
  const l=S.market.listings.find(l=>l.id===id);if(!l)return;
  const lock='comments:'+id;if(wmSocialBusy.has(lock))return;
  const t=wmCommentThread(id);wmCommentsOpen.add(id);
  if(post){const input=$$('[data-wms-input]').find(el=>el.dataset.wmsInput===id),text=wmText(input?.value);if(!text)return toast('先写点什么吧');t.comments.push({id:uid(),user:true,text,at:Date.now()});if(input)input.value='';save('market');}
  wmSocialBusy.add(lock);wmRenderMarket();
  try{
    const known=Object.values(S.market.social.people).filter(p=>p.listingId===id).map(p=>({name:p.name,role:p.role,world:p.world}));
    const history=t.comments.slice(-20).map(c=>({name:c.user?S.user.name:S.market.social.people[c.personId]?.name||'旅人',role:c.user?'user':S.market.social.people[c.personId]?.role,text:c.text}));
    const out=await callAPI([{role:'system',content:'你在经营一个有延续性的虚构万界商品留言区。生成卖家、买家和围观者的短留言；接着已有对话回复用户，保留已出现人物的身份和口吻。卖家可以拒绝、讨价还价，旁人可以提问、打趣、讲物品来历。不得替user发言，不得声称user已付款、已加好友或已拥有商品。所有角色均成年。只输出 JSON {"comments":[{"name":"姓名","role":"seller或buyer或bystander","text":"留言"}],"offer":{"price":100,"reason":"卖家的议价理由"}}。最多3条，至少一条卖家留言（使用商品中的seller姓名）。只有用户本轮明确讨价还价且卖家同意时才返回offer，否则offer为null；报价是用户货币的每件价格，必须在底价与当前价格之间；求购和以物换物不得返回offer。'},{role:'user',content:wmContext()+'\n商品：'+JSON.stringify({name:l.name,seller:l.seller,world:l.world,desc:l.desc,price:l.price,floor:l.floor,stock:l.stock,type:l.type,need:l.need})+'\n已有人物：'+JSON.stringify(known)+'\n留言历史：'+JSON.stringify(history)+'\n本轮用户留言：'+(post?history.at(-1)?.text:'无，只听听摊位上的人聊天，不新增优惠报价')}],{char:charById(curT().members[0]),max_tokens:1500,temperature:.95});
    // An imported backup may have replaced the market while the request was in flight.
    if(!S.market.listings.includes(l)||S.market.social.threads[id]!==t)return;
    const j=parseJSON(out),comments=Array.isArray(j.comments)?j.comments.slice(0,3):[];let added=0,sellerSpoke=false;
    for(const x of comments){const text=wmText(x.text);if(!text)continue;const seller=x.role==='seller',p=wmPerson(seller?l.seller:wmText(x.name,60)||'路过的旅人',seller?'seller':x.role==='buyer'?'buyer':'bystander',l.world,id,l.desc);sellerSpoke||=seller;t.comments.push({id:uid(),personId:p.id,text,at:Date.now()});added++;}
    if(!added)throw Error('暂时没听清大家说什么，再试一次吧');t.seeded=true;t.comments=t.comments.slice(-120);
    const n=Number(j.offer?.price);if(post&&sellerSpoke&&l.type!=='wanted'&&!l.need&&Number.isFinite(n)&&n>0&&n>=l.floor&&n<=l.price&&n<l.price)t.offer={id:uid(),price:wmNum(n),reason:wmText(j.offer.reason,400),expires:Date.now()+30*60000};
    save('market');
  }finally{wmSocialBusy.delete(lock);wmRenderMarket();}
}
document.addEventListener('toggle',e=>{const d=e.target;if(!d.isConnected||!d.matches?.('details[data-comments]'))return;d.open?wmCommentsOpen.add(d.dataset.comments):wmCommentsOpen.delete(d.dataset.comments);},true);
document.addEventListener('change',e=>{const el=e.target,k=el.dataset.wmsSetting;if(!k)return;const z=S.market.social;if(k==='enabled')z.settings.enabled=el.checked;else if(k==='mode')z.settings.mode=el.value==='manual'?'manual':'delayed';save('market');});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-wms]');if(!b)return;const a=b.dataset.wms,id=b.dataset.id;
  try{
    if(a==='requests'){wmTab='requests';openApp('market');$('#marketBody').scrollTop=0;return;}
    if(a==='friend'){const p=S.market.social.people[id];if(!p)return;wmEnqueueFriend(p,'我们在集市上有过一面之缘，要不要交换联系方式，继续聊聊？',S.market.listings.find(l=>l.id===p.listingId)?.name||'集市相逢');save('market');wmTab='requests';wmRenderMarket();$('#marketBody').scrollTop=0;}
    if(a==='chat'){const c=S.chars.find(c=>c.marketPersonId===id);if(c)openThread(threadOf(c.id).id);}
    if(a==='profile'){const p=S.market.social.people[id];if(p){toast('正在生成人物设定…',8000);await wmProfile(p)}wmRenderMarket();}
    if(a==='accept')await wmAcceptRequest(id);
    if(a==='reject'){const r=S.market.social.requests.find(r=>r.id===id);if(r&&r.status==='pending'&&!wmSocialBusy.has('accept:'+id)){r.status='rejected';save('market');wmRenderMarket();}}
    if(a==='encounter'){const z=S.market.social,job=z.encounters.find(x=>x.id===id),o=job&&S.market.orders.find(x=>x.id===job.orderId);if(!job||o?.status!=='delivered')return;const p=z.people[job.personId];wmEnqueueFriend(p,'那件「'+job.source+'」让我们之间有了一条线索。我想亲自和你谈谈。',job.source);job.status='sent';save('market');wmTab='requests';wmRenderMarket();$('#marketBody').scrollTop=0;}
    if(a==='post'||a==='listen')await wmSocialTalk(id,a==='post');
    if(a==='offer'){const l=S.market.listings.find(l=>l.id===id),t=wmCommentThread(id),offer=t.offer;if(!l||!l.stock||!offer||offer.expires<=Date.now()||offer.price<l.floor||offer.price>l.price)return toast('这个报价已经失效，再问问卖家吧');l.deal={price:offer.price,expires:offer.expires};t.offer=null;save('market');wmRenderMarket();toast('已采用议价，确认购买时才会扣款');}
  }catch(err){toast(err.message||'没有联系上，再试一次吧',5000);}
});
let wmMonth=new Date().toISOString().slice(0,7),wmTab='listings',wmBusy=false;
function wmNum(v,max=1e12){const n=Number(v);return Number.isFinite(n)?Math.round(Math.min(max,Math.max(0,n))*100)/100:0}
function wmFmt(v){return `${Number(v||0).toFixed(2)} ${S.wallet?.currency||'元'}`}
function wmEntry(amount,title,meta={}){S.wallet.ledger.unshift({id:uid(),at:Date.now(),amount,title,...meta});}
function wmMoney(amount,title){amount=Math.round(Number(amount)*100)/100;if(!Number.isFinite(amount)||!amount||S.wallet.balance+amount<0)throw Error('余额不足或金额无效');S.wallet.balance=Math.round((S.wallet.balance+amount)*100)/100;wmEntry(amount,title);save('wallet');}
function wmInit(){
  S.wallet={...structuredClone(DEFAULTS.wallet),...S.wallet};S.market={...structuredClone(DEFAULTS.market),...S.market};
  const w=S.wallet;w.balance=wmNum(w.balance);for(const k of ['ledger','incomes','bag','pending'])if(!Array.isArray(w[k]))w[k]=[];w.accounts||={};S.market.rates||={};
  if(!w.migrated){wmEntry(w.balance,'迁移期初余额（旧版历史流水不可追溯）',{opening:true});w.migrated=true;}
  homeMigrate();
  if(!S.home.marketApps){const missing=['wallet','market'].filter(app=>!S.home.pages.flat().some(x=>x.app===app));if(missing.length)S.home.pages.push(missing.map(app=>({id:uid(),type:'app',app})));S.home.marketApps=true;save('home');}
  wmSocialInit();wmStallInit();wmFamilyRender();wmTick();save('wallet');save('market');
}
function wmWorld(){return (S.world.books||[]).filter(b=>b.enabled).flatMap(b=>b.entries.filter(e=>e.enabled).map(e=>e.content)).join('\n').slice(0,10000)}
function wmContext(){return `已采用的平台汇率（沿用，不随卖家情绪改变）：${JSON.stringify(S.market.rates||{})}。用户：${S.user.name}；身份：${S.user.persona||'未设定'}；货币：${S.wallet.currency}。世界书：\n${wmWorld()}`}
function wmPrompt(T){return `\n【背包与信物】合适时可送一件有意义的物品，单独写 [信物:名称:描述]，系统会加入用户背包；不要频繁送。信物只能换物，不可变现。${S.wallet?.aware?`\n用户允许你知道钱包：余额 ${wmFmt(S.wallet.balance)}；最近流水：${S.wallet.ledger.slice(0,5).map(x=>x.title+' '+wmFmt(x.amount)).join('；')}。可以自然关心，不要控制或指责消费。`:''}\n`}
function wmReceiveTokens(T,text,who){return text.replace(/\[信物[:：]([^:：\]\n]{1,80})[:：]([^\]\n]{1,600})\]/g,(_,name,desc)=>{const c=charById(who||T.members[0]);S.wallet.bag.push({id:uid(),name:name.trim(),desc:desc.trim(),kind:'token',qty:1,from:c?.name||'TA',at:Date.now()});save('wallet');return `🎁 ${c?.name||'TA'}送给你「${name.trim()}」：${desc.trim()}（已放入背包）`;});}
function wmCard(title,body){return `<div class="card glass"><h3>${esc(title)}</h3>${body}</div>`}
function wmBtn(action,label,attrs=''){return `<button class="btn" data-wm="${action}" ${attrs}>${label}</button>`}
function wmList(items){return items.map(x=>`<div class="wm-row"><span>${esc(x.title)}<small>${new Date(x.at).toLocaleString()}</small></span><b class="${x.amount>=0?'wm-in':'wm-out'}">${x.amount>0?'+':''}${esc(wmFmt(x.amount))}</b></div>`).join('')||'<div class="evt">还没有记录</div>'}
for(const [id,name] of [['wallet','钱包'],['market','万界杂货铺']]){
  const el=document.createElement('section');el.className='app';el.id='app-'+id;
  el.innerHTML=`<header><button class="hbtn" data-back>‹ 返回</button><div class="title">${name}</div><span class="hbtn">✦</span></header><div class="body pad" id="${id}Body"></div>`;$('#phone').append(el);
  PACKS.prince.icons[id]=`themes/prince/i-${id}.webp`;
  SVG[id]=id==='wallet'?'<svg viewBox="0 0 24 24"><path d="M3 6h18v14H3zM3 6l14-3v3M15 11h6v5h-6z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M3 10h18L18 3H6zM5 10v11h14V10M10 21v-7h4v7"/></svg>';
}
RENDER.wallet=wmRenderWallet;RENDER.market=wmRenderMarket;
function wmRenderWallet(){
  wmTick();const w=S.wallet,L=w.ledger.filter(x=>!x.opening&&new Date(x.at).toISOString().slice(0,7)===wmMonth),inc=L.reduce((a,x)=>a+Math.max(0,x.amount),0),out=L.reduce((a,x)=>a+Math.max(0,-x.amount),0),max=Math.max(inc,out,1);
  $('#walletBody').innerHTML=`<div class="wm-hero"><small>我的零钱 · 小王子新版</small><strong>${esc(wmFmt(w.balance))}</strong><div class="btns">${wmBtn('income','＋ 记收入')}${wmBtn('recommend',wmBusy?'正在想…':'✦ bb 帮你想想')}${wmBtn('currency','设置货币')}</div></div>`+
    wmCard('每月收支',`<input type="month" id="wmMonth" value="${wmMonth}"><div class="wm-chart"><div>收入 ${esc(wmFmt(inc))}<i style="width:${inc/max*100}%;background:#9fbaa6"></i></div><div>支出 ${esc(wmFmt(out))}<i style="width:${out/max*100}%;background:#d99cad"></i></div></div>${wmList(L)}`)+
    wmCard('固定收入',`<p class="hint">每月指定日期到账，短月份在最后一天发放；关闭期间会在下次打开时补记。新增当月尚未过去的收入才会在本月到账。</p>${w.incomes.map(i=>`<div class="wm-row"><span>${esc(i.name)}<small>每月 ${i.day} 日 · ${esc(wmFmt(i.amount))}</small></span>${wmBtn('del-income','移除',`data-id="${i.id}"`)}</div>`).join('')||'<p class="hint">还没有固定收入</p>'}${wmBtn('fixed','＋ 添加固定收入')}`)+
    wmCard('背包',w.bag.filter(x=>x.qty>0).map(x=>`<div class="wm-item"><b>${esc(x.name)} × ${x.qty}</b><span class="tag">${x.kind==='token'?'信物 · 不可变现':'商品'}</span><p>${esc(x.desc)}</p><small>来自 ${esc(x.from||'万界集市')}</small><div class="btns">${wmBtn('use','使用',`data-id="${x.id}"`)}${wmBtn('gift','送给 TA',`data-id="${x.id}"`)}</div></div>`).join('')||'<p class="hint">角色赠送的信物、集市购买的商品会放在这里。</p>')+
    wmCard('与 TA 分享',`<label class="chk"><input type="checkbox" id="wmAware" ${w.aware?'checked':''}>允许 TA 知道我的余额和近期账单</label><p class="hint">所有金额均为小手机世界内的虚拟资产。</p>`)+
    wmCard('旧存档',`<p class="hint">这是小王子独立新版。可从原版「设置」导出备份，再在本版「设置」导入，接着原来的故事玩。原版存档不会被覆盖。</p>`);
  $('#wmMonth').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){wmMonth=e.target.value;wmRenderWallet()}};
  $('#wmAware').onchange=e=>{w.aware=e.target.checked;save('wallet')};
}
function wmNext(day,now=Date.now()){const d=new Date(now),due=new Date(d.getFullYear(),d.getMonth(),Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()),12);if(due.getTime()<now)due.setMonth(due.getMonth()+1,Math.min(day,new Date(d.getFullYear(),d.getMonth()+2,0).getDate()));return due.getTime()}
function wmAddIncome(name,amount,day){day=Math.min(31,Math.max(1,Math.floor(Number(day)||1)));S.wallet.incomes.push({id:uid(),name:String(name).slice(0,80),amount:wmNum(amount),day,next:wmNext(day)});save('wallet')}
async function wmIncome(fixed){const r=await formSheet(fixed?'固定收入':'记一笔收入',[{k:'name',t:'text',l:'收入来源'},{k:'amount',t:'text',l:`金额（${S.wallet.currency}）`,num:1},...(fixed?[{k:'day',t:'text',l:'每月几号（1—31）',num:1}]:[])],{});if(!r)return;const n=wmNum(r.amount);if(!r.name?.trim()||!n)return toast('请填写来源和有效金额');if(fixed)wmAddIncome(r.name,n,r.day);else wmMoney(n,r.name.trim());wmRenderWallet()}
async function wmRecommend(){
  if(wmBusy)return;wmBusy=true;wmRenderWallet();
  try{const c=S.chars.find(c=>c.builtin==='bb')||charById(curT().members[0]);const out=await callAPI([{role:'system',content:'结合用户身份和世界书推荐合理收入。只输出 JSON：{"currency":"货币名","incomes":[{"name":"来源","amount":100,"day":10,"reason":"理由"}]}。最多5项，金额为月收入，日期1—31。'},{role:'user',content:wmContext()}],{char:c,max_tokens:1200});const j=parseJSON(out),arr=(j.incomes||[]).slice(0,5).filter(x=>x.name&&wmNum(x.amount));if(!arr.length)throw Error('没有可用的收入建议');
    const box=document.createElement('div');box.className='card glass';box.innerHTML=`<h3>bb 的收入建议</h3><p>建议货币：${esc(j.currency||S.wallet.currency)}（只作建议，不会自动改变货币）</p>`+arr.map((x,i)=>`<label class="wm-choice"><input type="checkbox" data-rec="${i}"><span>${esc(x.name)} · ${wmNum(x.amount)} / 月<small>${esc(x.reason||'')} · 每月 ${Math.min(31,Math.max(1,+x.day||1))} 日</small></span></label>`).join('')+wmBtn('add-recs','添加勾选的固定收入');$('#walletBody').prepend(box);
    box.querySelector('button').onclick=()=>{box.querySelectorAll('input:checked').forEach(el=>{const x=arr[+el.dataset.rec];wmAddIncome(x.name,x.amount,x.day)});wmRenderWallet();toast('已添加勾选收入')};
  }catch(e){toast('推荐失败：'+e.message,5000)}finally{wmBusy=false;const b=$('[data-wm="recommend"]');if(b)b.textContent='✦ bb 帮你想想'}
}
function wmAccount(cid){return S.wallet.accounts[cid]}
async function wmMakeAccount(cid){if(wmBusy)return;wmBusy=true;try{const c=charById(cid);const out=await callAPI([{role:'system',content:'生成角色的虚构钱包，只输出 JSON：{"balance":1000,"ledger":[{"title":"账单内容","amount":-20}]}。最近账单最多8笔，余额非负；按角色身份及世界书生成，账单不是余额的完整历史。'},{role:'user',content:`${charCtx(c)}\n${wmContext()}`}],{char:c,max_tokens:1400});const j=parseJSON(out);if(!Number.isFinite(Number(j.balance))||+j.balance<0)throw Error('钱包数据无效');S.wallet.accounts[cid]={balance:wmNum(j.balance),ledger:(j.ledger||[]).slice(0,8).map(x=>({id:uid(),at:Date.now(),title:String(x.title||'日常收支'),amount:Math.sign(+x.amount)*wmNum(Math.abs(+x.amount))})),at:Date.now()};save('wallet');wmRenderPeek();}catch(e){toast(e.message,5000)}finally{wmBusy=false}}
function wmRenderPeek(){const cid=peekChar||curT().members[0],c=charById(cid),a=wmAccount(cid);$('#peekBody').innerHTML=wmCard(`${c?.name||'TA'}的钱包`,a?`<strong class="wm-balance">${esc(wmFmt(a.balance))}</strong><p class="hint">AI 根据人设生成的世界内账单，保存后持续沿用。</p>${wmBtn('sneak','偷偷塞钱',`data-id="${cid}"`)}${wmList(a.ledger)}`:`<p>钱包还没翻开呢。</p>${wmBtn('ta-wallet',wmBusy?'正在翻找…':'看看 TA 的钱包',`data-id="${cid}"`)}`)}
const wmOldPeek=renderPeek;renderPeek=function(){if(peekTab==='wallet'){wmRenderPeek();$$('#peekTabs button').forEach(b=>b.classList.toggle('on',b.dataset.pt==='wallet'));return}wmOldPeek()};
RENDER.peek=()=>renderPeek();
const wmPeekTab=document.createElement('button');wmPeekTab.dataset.pt='wallet';wmPeekTab.innerHTML='<i>👛</i>钱包';$('#peekTabs').append(wmPeekTab);
async function wmSneak(cid){const r=await formSheet('偷偷塞点零花钱',[{k:'amount',t:'text',l:`金额 · 我的余额 ${wmFmt(S.wallet.balance)}`,num:1}],{});if(!r)return;const a=wmAccount(cid),n=wmNum(r.amount);if(!a||!n||n>S.wallet.balance)return toast('金额无效或余额不足');wmMoney(-n,'偷偷塞钱给 '+charById(cid)?.name);a.balance=wmNum(a.balance+n);a.ledger.unshift({id:uid(),at:Date.now(),title:'不知是谁放进来的零花钱',amount:n});S.wallet.pending.push({id:uid(),cid,amount:n,due:Date.now()+60000+Math.random()*120000});save('wallet');wmRenderPeek();toast('放好啦，等 TA 自己发现 ✦')}
function wmFeed(text,meta={}){S.market.feed.unshift({id:uid(),at:Date.now(),text,...meta});S.market.feed=S.market.feed.slice(0,150)}
const WM_NAMES=['青梧山药童','月背邮差','龙巢收藏家','夜班魔女','星港旅人'];
function wmTick(now=Date.now()){
  if(!S.wallet||!S.market)return;const w=S.wallet,m=S.market;
  for(const i of w.incomes){if(!i.next)i.next=wmNext(i.day,now);let count=0;while(i.next<=now&&count++<120){wmMoney(wmNum(i.amount),i.name+' · 固定收入');w.ledger[0].at=i.next;const d=new Date(i.next),y=d.getFullYear(),mo=d.getMonth()+1;i.next=new Date(y,mo,Math.min(i.day,new Date(y,mo+1,0).getDate()),12).getTime()}}
  for(const o of m.orders){if(o.status==='preorder'&&o.due<=now){w.bag.push({id:uid(),name:o.name,desc:o.desc,kind:'goods',qty:o.qty,from:o.seller,at:now});o.status='delivered';wmFeed(`你的预售订单「${o.name}」×${o.qty} 已到货。`)}}
  const steps=Math.min(72,Math.floor((now-(m.lastTick||now))/3600000));if(steps>0){
    for(let k=0;k<steps;k++)for(const l of m.listings){if(l.stock<=0)continue;const t=(m.lastTick||now)+(k+1)*3600000;
      if(l.type!=='wanted'&&t-l.lastPriceAt>=6*3600000&&l.price>l.floor){const old=l.price;l.price=Math.max(l.floor,Math.round(l.price*.92*100)/100);l.lastPriceAt=t;if(old!==l.price)wmFeed(`${l.seller}把「${l.name}」从 ${wmFmt(old)} 降到 ${wmFmt(l.price)}，想早点出手。`)}
      if(Math.random()<.07){l.stock--;l.sold++;const person=wmPerson(WM_NAMES[Math.floor(Math.random()*WM_NAMES.length)],'buyer',l.world,l.id);wmFeed(`${person.name} ${l.type==='wanted'?'完成了求购':'买下了'}「${l.name}」×1。${l.stock?'':'这单已售罄。'}`,{personId:person.id,listingId:l.id})}
    }m.lastTick=now;}
  if(!m.lastTick)m.lastTick=now;
  wmSocialTick(now);save('wallet');save('market');
}
function wmRenderMarket(){
  wmTick();const m=S.market,B=$('#marketBody'),scroll=B.scrollTop;
  let body='';
  if(wmTab==='orders')body=m.orders.map(o=>wmCard(o.name,`<p>${esc(o.seller)} · ×${o.qty} · ${esc(o.status==='preorder'?'预售中，预计 '+new Date(o.due).toLocaleString()+' 到货':o.status==='fulfilled'?'已完成交付':'已到背包')}</p><small>${esc(o.payment)}</small>${wmSocialOrder(o)}`)).join('')||'<div class="evt">还没有订单</div>';
  else if(wmTab==='feed')body=m.feed.map(x=>wmCard(new Date(x.at).toLocaleString(),`<p>${esc(x.text)}</p>${x.personId?wmFriendButton(x.personId):''}`)).join('')||'<div class="evt">集市还很安静，逛逛新摊位吧。</div>';
  else if(wmTab==='requests')body=wmRenderRequests();
  else if(wmTab==='stall')body=wmRenderStall();
  else body=m.listings.map(l=>wmCard(l.name,`<div class="wm-tags"><span class="tag">${esc(l.world)}</span><span class="tag">${esc(l.type==='wanted'?'十万火急 · 求购':l.preorder?'预售':l.mood)}</span></div><p>${esc(l.desc)}</p><small>${esc(l.seller)} · ${l.type==='wanted'?'剩余需求':'库存'} ${l.stock} · 已成交 ${l.sold}</small><p>${l.type==='wanted'?`对方愿出 ${esc(wmFmt(l.price))} · 需要「${esc(l.need)}」`:l.need?`以物换物：${esc(l.need)} × ${l.needQty}`:`${esc(wmFmt(l.price))}<small>原价 ${l.originPrice} ${esc(l.currency)} · 1 ${esc(l.currency)} ≈ ${l.rate} ${esc(S.wallet.currency)}<br>平台基准 ${esc(wmFmt(l.base))} · 卖家系数 ${l.markup} 倍</small>`}</p>${wmDealPrice(l)<l.price?`<p class="wm-in">你的议价：${esc(wmFmt(wmDealPrice(l)))} / 件 · 本次订单有效，报价保留至 ${new Date(l.deal.expires).toLocaleTimeString()}</p>`:''}${l.stock?wmBtn('trade',l.type==='wanted'?'交付物品':l.need?'挑选交换物':'购买',`data-id="${l.id}"`):'<span class="tag">已结束</span>'}${wmSocialListing(l)}`)).join('')||'<div class="evt">联系一下商人，看看今天各个世界带来了什么。</div>';
  B.innerHTML=`<div class="wm-hero"><small>星光中转站 · 各界商人正在营业</small><strong>万界杂货铺</strong><p>零钱 ${esc(wmFmt(S.wallet.balance))} · 信物只换物</p>${wmBtn('refresh',wmBusy?'正在联系商人…':'✦ 逛一批新摊位')}</div><div class="btns">${['listings','stall','orders','feed','requests'].map((k,i)=>wmBtn('tab',['逛摊位','我的上架','我的订单','交易动态','陌生来信'+(wmRequestsCount()?` (${wmRequestsCount()})`:'')][i],`data-id="${k}" aria-current="${wmTab===k?'page':'false'}"`)).join('')}</div>${body}`;
  B.scrollTop=scroll;
}
async function wmRefresh(){if(wmBusy)return;wmBusy=true;wmRenderMarket();try{
  const out=await callAPI([{role:'system',content:`你是万界市场内容生成器。生成6个跨世界摊位商品，包含急售、随缘高价、特殊物品交换、批量库存、预售以及1条紧急求购。结合世界书。只输出 JSON {"listings":[{"name":"商品","seller":"商人","world":"来源世界","desc":"说明","type":"sale或wanted","mood":"急售或随缘或溢价","currency":"原产货币","originPrice":50,"rate":2,"markup":1.2,"stock":3,"need":"交换或求购物品名，无则空","needQty":1,"preorder":false,"hours":24,"encounter":{"name":"留影或信件中的人物名，可留空","hint":"人物身份与物品的联系，无人物则留空"}}]}。rate为1单位原产货币能换多少用户货币，遵循世界书中固定汇率；markup是卖家开价系数0.3—5。求购必须有need；描述明确为什么急需、贵卖或预售，勿替用户声称已拥有特殊物品。若商品是人物留影、肖像、信件等，encounter可埋一个人物线索；其他商品encounter留空。`},{role:'user',content:wmContext()}],{char:charById(curT().members[0]),max_tokens:2800,temperature:1});
  const j=parseJSON(out);if(!Array.isArray(j.listings)||!j.listings.length)throw Error('商人没有带来有效商品');
  const now=Date.now(),items=j.listings.slice(0,8).filter(x=>x.name&&x.seller).map(x=>{const rateKey=String(x.currency||S.wallet.currency)+'→'+S.wallet.currency;const rate=S.market.rates[rateKey]??(S.market.rates[rateKey]=Math.max(.001,wmNum(x.rate)));const base=wmNum(wmNum(x.originPrice)*rate),markup=Math.min(5,Math.max(.3,+x.markup||1)),price=Math.max(.01,wmNum(base*markup));return {id:uid(),name:String(x.name).slice(0,100),seller:String(x.seller).slice(0,80),world:String(x.world||'异世界').slice(0,60),desc:String(x.desc||'').slice(0,1200),type:x.type==='wanted'?'wanted':'sale',mood:String(x.mood||'随缘'),currency:String(x.currency||S.wallet.currency).slice(0,20),originPrice:wmNum(x.originPrice),rate,markup,base,price,floor:Math.max(.01,wmNum(base*.45)),stock:Math.min(999,Math.max(1,Math.floor(+x.stock||1))),sold:0,need:String(x.need||'').slice(0,100),needQty:Math.min(99,Math.max(1,Math.floor(+x.needQty||1))),preorder:x.type!=='wanted'&&!!x.preorder,hours:Math.min(720,Math.max(1,+x.hours||24)),at:now,lastPriceAt:now,encounter:x.encounter&&typeof x.encounter==='object'?{name:wmText(x.encounter.name,60),hint:wmText(x.encounter.hint,800)}:null};}).filter(x=>x.type!=='wanted'||x.need);
  if(!items.length)throw Error('商品格式无效');S.market.listings.push(...items);S.market.refreshAt=now;wmFeed(`${items.length} 个新摊位到站，旧挂单继续营业。`);save('market');
  }catch(e){toast('没逛成：'+e.message,5000)}finally{wmBusy=false;wmRenderMarket()}}
async function wmTrade(id){const l=S.market.listings.find(x=>x.id===id);if(!l||!l.stock)return toast('这单已结束');let qty=1,bag=null;
  if(l.need){const candidates=S.wallet.bag.filter(x=>x.qty>=l.needQty&&x.name===l.need&&(l.type!=='wanted'||x.kind!=='token'));if(!candidates.length)return toast(l.type==='wanted'?'背包里没有可交付商品（信物不能换钱）':'需要同名交换物「'+l.need+'」×'+l.needQty);const k=await actionSheet(candidates.map(x=>({label:esc(x.name)+' · '+esc(x.from||'背包')})),'选择要交出的物品（会消耗）');if(k<0)return;bag=candidates[k];}
  else{const r=await formSheet('购买 '+l.name,[{k:'qty',t:'text',l:`数量（库存 ${l.stock}）`,num:1}],{qty:'1'});if(!r)return;qty=Number(r.qty);if(!Number.isInteger(qty)||qty<1||qty>l.stock)return toast('数量不对哦');}
  const unit=wmDealPrice(l),total=wmNum(unit*qty),payment=bag?`${l.need} ×${l.needQty}`:wmFmt(total),ok=await actionSheet([{label:l.type==='wanted'?`确认交付，获得 ${esc(wmFmt(total))}`:`确认${l.preorder?'预订':'购买'} ×${qty} · ${esc(payment)}`}],l.name);if(ok!==0)return;
  // 弹层期间可能发生市场更新，成交前重新校验库存、物品和余额。
  if(l.stock<qty)return toast('库存刚刚变了，请重试');if(wmDealPrice(l)!==unit)return toast('报价刚刚更新，请重新确认购买');if(bag&&bag.qty<l.needQty)return toast('交换物不足');if(!bag&&total>S.wallet.balance)return toast('零钱不够啦');
  if(bag){if(l.type==='wanted'&&bag.kind==='token')return toast('信物不能变现');bag.qty-=l.needQty;}if(l.type==='wanted')wmMoney(total,'万界求购 · '+l.name);else if(!bag)wmMoney(-total,'万界杂货铺 · '+l.name+' ×'+qty);
  l.stock-=qty;l.sold+=qty;const o={id:uid(),name:l.name,desc:l.desc,seller:l.seller,qty,at:Date.now(),payment,status:l.type==='wanted'?'fulfilled':l.preorder?'preorder':'delivered',due:Date.now()+l.hours*3600000};o.listingId=l.id;S.market.orders.unshift(o);delete l.deal;wmSocialPurchase(l,o);
  if(l.type!=='wanted'&&!l.preorder)S.wallet.bag.push({id:uid(),name:l.name,desc:l.desc,kind:'goods',qty,from:l.seller,at:Date.now()});wmFeed(`${S.user.name}${l.type==='wanted'?'完成求购':'买下'}「${l.name}」×${qty}。`);save('wallet');save('market');wmRenderMarket();toast(l.preorder?'预订好了，到货会放入背包':'成交啦 ✦')}
async function wmUse(id,gift){const item=S.wallet.bag.find(x=>x.id===id);if(!item||item.qty<1)return;let cid=curT().members[0];if(gift){const k=await actionSheet(S.chars.map(c=>({label:esc(c.name)})),'送给谁？');if(k<0)return;cid=S.chars[k].id;}const c=charById(cid);const k=await actionSheet([{label:gift?'确认送给 '+esc(c?.name):'确认使用一件'}],item.name);if(k!==0||item.qty<1)return;item.qty--;save('wallet');const T=threadOf(cid);pushMsg(T,'online','event',`${S.user.name}${gift?'把':'使用了'}「${item.name}」${gift?'送给'+c?.name:''}。物品说明：${item.desc}`);wmRenderWallet();generate(T,'online',`请对刚才${gift?'收到礼物':'用户使用物品'}自然回应；这是虚构世界内的物品事件。`);toast(gift?'送出啦':'已使用，TA 会在聊天中回应')}
async function wmDiscover(){if(busy||!S.wallet)return;const p=S.wallet.pending.find(x=>x.due<=Date.now());if(!p)return;const c=charById(p.cid);if(!c){S.wallet.pending=S.wallet.pending.filter(x=>x.id!==p.id);save('wallet');return}if(!ownAPI(c)&&!apiReady())return;const T=threadOf(c.id);pushMsg(T,'online','event',`${c.name}发现钱包多了 ${wmFmt(p.amount)}，还不知道是谁放的。`);S.wallet.pending=S.wallet.pending.filter(x=>x.id!==p.id);save('wallet');await generate(T,'online',`你刚发现钱包多了一笔 ${wmFmt(p.amount)}。按性格猜测、询问或装作不知道，不要自动认定来源。`,{pro:true});}
setInterval(()=>{if(S.wallet){wmTick();wmDiscover()}},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.wallet){wmTick();wmDiscover()}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-wm]');if(!b||b.dataset.wm==='add-recs')return;const a=b.dataset.wm,id=b.dataset.id;
  try{if(a==='income'||a==='fixed')await wmIncome(a==='fixed');if(a==='recommend')await wmRecommend();if(a==='currency'){const r=await formSheet('钱包货币',[{k:'currency',t:'text',l:'货币名称（改名不换算已有金额）'}],{currency:S.wallet.currency});if(r?.currency?.trim()){S.wallet.currency=r.currency.trim().slice(0,20);save('wallet');wmRenderWallet()}}
  if(a==='del-income'){S.wallet.incomes=S.wallet.incomes.filter(x=>x.id!==id);save('wallet');wmRenderWallet()}if(a==='ta-wallet')await wmMakeAccount(id);if(a==='sneak')await wmSneak(id);if(a==='refresh')await wmRefresh();if(a==='tab'){wmTab=id;wmRenderMarket()}if(a==='trade')await wmTrade(id);if(a==='use'||a==='gift')await wmUse(id,a==='gift');
  }catch(err){toast(err.message,5000)}
});

/* 用户的求购与换物摊位：所有交付必须由用户确认。 */
function wmStallInit(){
  const m=S.market;m.stall||={drafts:[],posts:[]};
  for(const k of ['drafts','posts'])if(!Array.isArray(m.stall[k]))m.stall[k]=[];
  if(!Array.isArray(S.user.familyDrafts))S.user.familyDrafts=[];
}
function wmXBtn(a,label,id=''){return `<button class="btn" data-wmx="${a}" data-id="${esc(id)}"${wmSocialBusy.has(a+':'+id)?' disabled':''}>${esc(label)}</button>`}
function wmStallTerms(p){return p.mode==='barter'?`用「${p.giveName}」×1 换物`:`我出 ${wmFmt(p.price)}`}
function wmRenderStall(){
  const s=S.market.stall;
  return wmCard('摆一个属于你的摊位',`<p>你出价收物，或拿背包里的物品交换。先发布需求，再看看谁来应单；你点确认后才扣款、交付并收货。</p><div class="btns">${wmXBtn('stall-new','自己写一条')}${wmXBtn('stall-ideas',wmSocialBusy.has('stall-ideas:')?'bb 正在想…':'✦ bb 替你想一想有什么可以上架')}</div><small>每次三条灵感，包含以钱易物与以物易物。生成灵感、联系应单者会使用当前 AI 接口；发布时不扣钱，也不自动成交。</small>`)
  +(s.drafts.length?wmCard('bb 想到的三样',s.drafts.map(d=>`<div class="wm-item"><b>${esc(d.name)}</b><p>${esc(d.desc)}</p><small>${d.mode==='barter'?'以物易物 · 发布时从背包选择交换物':'以钱易物 · 建议出价 '+esc(wmFmt(d.price))}</small>${wmXBtn('stall-draft','修改并上架',d.id)}</div>`).join('')):'')
  +s.posts.slice().reverse().map(p=>wmCard(p.name,`<span class="tag">${p.status==='open'?'等待应单':p.status==='completed'?'已成交':'已撤下'}</span><p>${esc(p.desc)}</p><p>${esc(wmStallTerms(p))}</p>${p.status==='open'?`<div class="btns">${wmXBtn('stall-offers',wmSocialBusy.has('stall-offers:'+p.id)?'正在联系…':'看看谁来应单',p.id)}${wmXBtn('stall-close','撤下',p.id)}</div>`:''}${p.offers.map(o=>`<div class="wms-offer"><b>${esc(o.seller)} · ${esc(o.world)}</b><p>带来「${esc(o.name)}」×1<br>${esc(o.desc)}</p><p>${esc(o.message)}</p><small>${esc(wmStallTerms(p))} · ${o.status==='accepted'?'已确认交付':o.status==='declined'?'已婉拒':p.status==='open'?'等待你确认':'应单已结束'}</small>${p.status==='open'&&o.status==='pending'?`<div class="btns">${wmXBtn('stall-confirm','确认交换',o.id)}${wmXBtn('stall-decline','婉拒',o.id)}</div>`:''}${o.personId?wmFriendButton(o.personId):''}</div>`).join('')}`)).join('');
}
async function wmStallIdeas(){
  const lock='stall-ideas:';if(wmSocialBusy.has(lock))return;wmSocialBusy.add(lock);const market=S.market;wmRenderMarket();
  try{
    const out=await callAPI([{role:'system',content:'为用户的万界集市求购/换物摊位想三条有趣的收物需求，结合用户身份和世界书，重在生活、冒险与互动，不是赚钱经营。严格只输出 JSON {"ideas":[{"name":"想收的物品","desc":"用途和要求","mode":"cash或barter","price":100}]}。恰好三条，两条cash表示用户出钱收物、一条barter表示用户拿背包物品换对方物品。不能让用户出售物品赚现金，不得声称用户已拥有未提供的物品。cash出价必须为正数，尽量在用户预算内。barter发布时用户自己选背包物品。'},{role:'user',content:wmContext()+'\n钱包余额：'+wmFmt(S.wallet.balance)+'\n背包：'+JSON.stringify(S.wallet.bag.filter(b=>b.qty>0).map(b=>({name:b.name,desc:b.desc,kind:b.kind})))}],{char:charById(curT().members[0]),max_tokens:1800,temperature:1});
    if(S.market!==market)throw Error('存档已切换，请重新生成');
    const j=parseJSON(out),items=(Array.isArray(j.ideas)?j.ideas:[]).slice(0,3).map(x=>({id:uid(),name:wmText(x.name,100),desc:wmText(x.desc,1600),mode:x.mode==='barter'?'barter':'cash',price:wmNum(x.price)}));
    if(items.length!==3||items.some(x=>!x.name||!x.desc||(x.mode==='cash'&&!x.price))||!items.some(x=>x.mode==='barter')||!items.some(x=>x.mode==='cash'))throw Error('灵感不完整，请再让 bb 想一次');
    market.stall.drafts=items;await save('market');
  }finally{wmSocialBusy.delete(lock);wmRenderMarket()}
}
async function wmStallPost(draftId){
  const market=S.market,d=market.stall.drafts.find(d=>d.id===draftId)||{};
  const r=await formSheet('上架求购 / 换物需求',[{k:'name',t:'text',l:'想要对方带来的物品'},{k:'desc',t:'textarea',l:'用途与要求（每条需求收一件，确认后结束）'},{k:'mode',t:'select',l:'我拿什么交换',opts:['我出钱','我出物品']},{k:'price',t:'text',l:`我的出价（${S.wallet.currency}，换物时忽略）`,num:1}],{name:d.name||'',desc:d.desc||'',mode:d.mode==='barter'?'我出物品':'我出钱',price:d.price||''});
  if(!r||S.market!==market)return;
  const name=wmText(r.name,100),desc=wmText(r.desc,1600),mode=r.mode==='我出物品'?'barter':'cash',price=wmNum(r.price);
  if(!name||!desc)throw Error('先写一下想收什么和具体要求');
  let bag=null;
  if(mode==='cash'){if(!price||price>S.wallet.balance)throw Error('出价须大于零，且不超过当前余额');}
  else{
    const bags=S.wallet.bag.filter(b=>b.qty>=1);if(!bags.length)throw Error('背包里还没有可交换的物品，可以先选以钱易物');
    const i=await actionSheet(bags.map(b=>({label:b.name+' ×'+b.qty+(b.kind==='token'?' · 信物':'' )})),'拿哪一件换？成交时交付一件');if(i==null||i<0||!bags[i]||S.market!==market)return;bag=bags[i];
  }
  if(await actionSheet([{label:'确认上架'},{label:'再想想'}],`${name}\n${mode==='cash'?'我出 '+wmFmt(price):'用「'+bag.name+'」×1 换物'}\n现在不扣款、不交物，收到应单后由你确认。`)!==0||S.market!==market)return;
  market.stall.posts.push({id:uid(),name,desc,mode,price:mode==='cash'?price:0,giveId:bag?.id||'',giveName:bag?.name||'',status:'open',offers:[],at:Date.now()});
  await save('market');wmFeed(S.user.name+'上架了收物需求「'+name+'」，等待各界旅人应单。');wmRenderMarket();toast('上架啦，等别人带物品来应单 ✦');
}
async function wmStallOffers(id){
  const market=S.market,p=market.stall.posts.find(p=>p.id===id),lock='stall-offers:'+id;if(!p||p.status!=='open'||wmSocialBusy.has(lock))return;
  if(p.offers.filter(o=>o.status==='pending').length>=6)return toast('先看看已有的应单，确认或婉拒后再联系新人');
  wmSocialBusy.add(lock);wmRenderMarket();
  try{
    const out=await callAPI([{role:'system',content:'你是万界集市应单者生成器。用户发布了收物需求，由用户付钱或交出指定物品，你生成1—3位带着物品来的虚构成年应单者。只输出 JSON {"offers":[{"seller":"姓名","world":"来源世界","name":"交付物品名","desc":"具体品质、来历和限制","message":"对用户说的话"}]}。每人交付一件，必须符合需求，接受用户既定出价或换物条件。不代用户确认、不扣款、不声称已成交。与已有应单者区分。'},{role:'user',content:wmContext()+'\n用户需求：'+JSON.stringify({name:p.name,desc:p.desc,terms:wmStallTerms(p)})+'\n已有应单：'+JSON.stringify(p.offers.map(o=>({seller:o.seller,name:o.name})))}],{char:charById(curT().members[0]),max_tokens:2200,temperature:1});
    if(S.market!==market||p.status!=='open')return;
    const j=parseJSON(out),offers=(Array.isArray(j.offers)?j.offers:[]).slice(0,3).map(x=>({id:uid(),seller:wmText(x.seller,80),world:wmText(x.world,80)||'异世界',name:wmText(x.name,100),desc:wmText(x.desc,2000),message:wmText(x.message,1000),status:'pending'})).filter(x=>x.seller&&x.name&&x.desc);
    if(!offers.length)throw Error('暂时没有有效的应单，稍后再来看看');
    for(const o of offers)o.personId=wmPerson(o.seller,'seller',o.world,p.id,o.desc).id;
    p.offers.push(...offers);await save('market');toast('有人带着物品来应单啦，看看合不合心意 ✦');
  }finally{wmSocialBusy.delete(lock);wmRenderMarket()}
}
async function wmStallConfirm(offerId){
  const market=S.market,p=market.stall.posts.find(p=>p.offers.some(o=>o.id===offerId)),o=p?.offers.find(o=>o.id===offerId),lock='stall-confirm:'+offerId;
  if(!p||p.status!=='open'||o.status!=='pending'||wmSocialBusy.has(lock))return;
  wmSocialBusy.add(lock);
  try{
    if(await actionSheet([{label:'确认成交'},{label:'再看看'}],`收下 ${o.seller} 的「${o.name}」×1\n${wmStallTerms(p)}\n${o.desc}`)!==0)return;
    if(S.market!==market||p.status!=='open'||o.status!=='pending')return;
    const bag=S.wallet.bag.find(b=>b.id===p.giveId);
    if(p.mode==='cash'){if(!Number.isFinite(p.price)||p.price<=0||p.price>S.wallet.balance)throw Error('当前余额不足，未扣款也未成交');wmMoney(-p.price,'集市收物 · '+o.name);}
    else{if(!bag||bag.qty<1)throw Error('交换物已不在背包里，这笔交易尚未成交');bag.qty--;}
    S.wallet.bag.push({id:uid(),name:o.name,desc:o.desc,kind:'goods',qty:1,from:o.seller,at:Date.now()});
    o.status='accepted';p.status='completed';p.completedAt=Date.now();for(const other of p.offers)if(other.status==='pending')other.status='closed';
    const order={id:uid(),name:o.name,desc:o.desc,seller:o.seller,qty:1,at:Date.now(),payment:wmStallTerms(p),status:'delivered',stallId:p.id,encounterChecked:true};market.orders.unshift(order);
    wmFeed(S.user.name+'确认了 '+o.seller+' 的应单，收下「'+o.name+'」。',{personId:o.personId});await Promise.all([save('wallet'),save('market')]);toast('成交啦，物品已放进背包 ✦');
  }finally{wmSocialBusy.delete(lock);wmRenderMarket()}
}

/* 家人人设先保存为草稿；用户逐个选择加入联系人。 */
function wmFamilyRender(){
  const el=$('#familyDrafts');if(!el)return;
  const drafts=S.user.familyDrafts||[];
  el.innerHTML=drafts.map(p=>{const c=S.chars.find(c=>c.familyMemberId===p.id);return `<div class="wms-profile"><b>${esc(p.relation)} · ${esc(p.name)}</b><p>${esc(p.description)}</p><details><summary>看看完整人设</summary><p>性格：${esc(p.personality)}\n相处背景：${esc(p.scenario)}\n开场白：${esc(p.first_mes)}\n外貌：${esc(p.look)}</p></details>${c?wmXBtn('family-chat','和 TA 聊聊',c.id):wmXBtn('family-add','将这位家人加入联系人',p.id)}</div>`}).join('');
  const b=$('[data-wmx="family-generate"]');if(b){b.disabled=wmSocialBusy.has('family-generate:');b.textContent=b.disabled?'bb 正在想家人的故事…':'✦ bb 根据我的身份生成几位家人'}
}
async function wmFamilyGenerate(){
  const lock='family-generate:';if(wmSocialBusy.has(lock))return;readCharForm();
  if(!S.user.persona?.trim())return toast('先在「我的人设」写下身份或家庭背景，bb 才能顺着你的故事来想');
  const user=S.user,persona=user.persona;wmSocialBusy.add(lock);wmFamilyRender();
  try{
    const existing=S.chars.filter(c=>c.familyMemberId).map(c=>({name:c.name,relation:c.familyRelation,description:c.description}));
    const out=await callAPI([{role:'system',content:'根据用户身份、世界书和已知家人，生成三位适合长期互动的虚构成年家人。严格尊重用户既有家庭事实、物种、世界与时代；家人之间年龄辈分和经历一致。人设未说明的部分作为可选补充，不改写既有事实；孤儿或无血亲背景可生成收养、义亲等关系。不要强行加入配偶或子女，不与已加入的家人重复。只输出 JSON {"family":[{"name":"姓名","relation":"与用户的亲属关系","description":"成年身份、年龄、经历、关系细节","personality":"性格","scenario":"与用户的家庭背景与当下相处","first_mes":"以此亲属口吻发来的第一句话","look":"成年外貌","mes_example":"对话示例"}]}。不代用户行动，不默认恋爱。'},{role:'user',content:wmContext()+'\n已经加入的家人：'+JSON.stringify(existing)}],{char:charById(curT().members[0]),max_tokens:3500,temperature:.95});
    if(S.user!==user||user.persona!==persona)throw Error('身份或存档已改变，请按新身份重新生成');
    const j=parseJSON(out),items=(Array.isArray(j.family)?j.family:[]).slice(0,3).map(x=>({id:'fam'+uid(),name:wmText(x.name,60),relation:wmText(x.relation,80),description:wmText(x.description,5000),personality:wmText(x.personality,2500),scenario:wmText(x.scenario,4000),first_mes:wmText(x.first_mes,2000),look:wmText(x.look,2000),mes_example:wmText(x.mes_example,2500)}));
    if(items.length!==3||items.some(x=>!x.name||!x.relation||!x.description||!x.personality||!x.scenario||!x.first_mes))throw Error('家人资料不完整，请再生成一次');
    if(new Set(items.map(x=>x.name)).size!==3||items.some(x=>existing.some(c=>c.name===x.name)))throw Error('家人姓名重复，请再生成一次');
    user.familyDrafts=items;await save('user');toast('三位家人的人设写好啦，挑喜欢的加入联系人');
  }finally{wmSocialBusy.delete(lock);wmFamilyRender()}
}
async function wmFamilyAdd(id){
  const p=S.user.familyDrafts?.find(p=>p.id===id),lock='family-add:'+id;if(!p||wmSocialBusy.has(lock))return;
  wmSocialBusy.add(lock);
  try{
    let c=S.chars.find(c=>c.familyMemberId===id);if(!c){const {relation,...profile}=p;c={...profile,id:'c'+uid(),avatar:'',voice:'',familyMemberId:id,familyRelation:relation,description:`与 ${S.user.name} 的关系：${relation}\n${p.description}`};S.chars.push(c);await saveChars();}
    const T=threadOf(c.id);if(!T.msgs.length)pushMsg(T,'online','assistant',c.first_mes,{who:c.id});syncUnread();updateBadges();toast('「'+c.name+'」已加入联系人，人设可以继续编辑');
  }finally{wmSocialBusy.delete(lock);wmFamilyRender()}
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-wmx]');if(!b||b.disabled)return;const a=b.dataset.wmx,id=b.dataset.id||'';
  try{
    if(a==='stall-ideas')await wmStallIdeas();if(a==='stall-new'||a==='stall-draft')await wmStallPost(id);if(a==='stall-offers')await wmStallOffers(id);if(a==='stall-confirm')await wmStallConfirm(id);
    if(a==='stall-close'){const p=S.market.stall.posts.find(p=>p.id===id);if(p?.status==='open'&&await actionSheet([{label:'确认撤下'},{label:'继续挂着'}],'撤下这条需求？')===0){p.status='cancelled';await save('market');wmRenderMarket()}}
    if(a==='stall-decline'){for(const p of S.market.stall.posts){const o=p.offers.find(o=>o.id===id);if(p.status==='open'&&o?.status==='pending')o.status='declined'}await save('market');wmRenderMarket()}
    if(a==='family-generate')await wmFamilyGenerate();if(a==='family-add')await wmFamilyAdd(id);if(a==='family-chat'&&charById(id))openThread(threadOf(id).id);
  }catch(err){toast('这次没完成：'+err.message,5000)}
});

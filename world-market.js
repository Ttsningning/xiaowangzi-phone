/* 月光海：钱包与万界集市。小王子新版；不读取月光海数据库。 */
DEFAULTS.wallet={balance:5200,currency:'元',ledger:[],incomes:[],bag:[],accounts:{},pending:[],aware:false};
DEFAULTS.market={rates:{},listings:[],feed:[],orders:[],lastTick:Date.now(),refreshAt:0};
const WM_DAY=86400000;
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
  wmTick();save('wallet');save('market');
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
function wmFeed(text){S.market.feed.unshift({id:uid(),at:Date.now(),text});S.market.feed=S.market.feed.slice(0,150)}
const WM_NAMES=['青梧山药童','月背邮差','龙巢收藏家','夜班魔女','星港旅人'];
function wmTick(now=Date.now()){
  if(!S.wallet||!S.market)return;const w=S.wallet,m=S.market;
  for(const i of w.incomes){if(!i.next)i.next=wmNext(i.day,now);let count=0;while(i.next<=now&&count++<120){wmMoney(wmNum(i.amount),i.name+' · 固定收入');w.ledger[0].at=i.next;const d=new Date(i.next),y=d.getFullYear(),mo=d.getMonth()+1;i.next=new Date(y,mo,Math.min(i.day,new Date(y,mo+1,0).getDate()),12).getTime()}}
  for(const o of m.orders){if(o.status==='preorder'&&o.due<=now){w.bag.push({id:uid(),name:o.name,desc:o.desc,kind:'goods',qty:o.qty,from:o.seller,at:now});o.status='delivered';wmFeed(`你的预售订单「${o.name}」×${o.qty} 已到货。`)}}
  const steps=Math.min(72,Math.floor((now-(m.lastTick||now))/3600000));if(steps>0){
    for(let k=0;k<steps;k++)for(const l of m.listings){if(l.stock<=0)continue;const t=(m.lastTick||now)+(k+1)*3600000;
      if(l.type!=='wanted'&&t-l.lastPriceAt>=6*3600000&&l.price>l.floor){const old=l.price;l.price=Math.max(l.floor,Math.round(l.price*.92*100)/100);l.lastPriceAt=t;if(old!==l.price)wmFeed(`${l.seller}把「${l.name}」从 ${wmFmt(old)} 降到 ${wmFmt(l.price)}，想早点出手。`)}
      if(Math.random()<.07){l.stock--;l.sold++;wmFeed(`${WM_NAMES[Math.floor(Math.random()*WM_NAMES.length)]} ${l.type==='wanted'?'完成了求购':'买下了'}「${l.name}」×1。${l.stock?'':'这单已售罄。'}`)}
    }m.lastTick=now;}
  if(!m.lastTick)m.lastTick=now;
  save('wallet');save('market');
}
function wmRenderMarket(){wmTick();const m=S.market;
  $('#marketBody').innerHTML=`<div class="wm-hero"><small>星光中转站 · 各界商人正在营业</small><strong>万界杂货铺</strong><p>零钱 ${esc(wmFmt(S.wallet.balance))} · 信物只换物</p>${wmBtn('refresh',wmBusy?'正在联系商人…':'✦ 逛一批新摊位')}</div><div class="btns">${['listings','orders','feed'].map((k,i)=>wmBtn('tab',['逛摊位','我的订单','交易动态'][i],`data-id="${k}" ${wmTab===k?'class="on"':''}`)).join('')}</div>`+
    (wmTab==='orders'?m.orders.map(o=>wmCard(o.name,`<p>${esc(o.seller)} · ×${o.qty} · ${esc(o.status==='preorder'?'预售中，预计 '+new Date(o.due).toLocaleString()+' 到货':o.status==='fulfilled'?'已完成交付':'已到背包')}</p><small>${esc(o.payment)}</small>`)).join('')||'<div class="evt">还没有订单</div>':wmTab==='feed'?m.feed.map(x=>wmCard(new Date(x.at).toLocaleString(),esc(x.text))).join('')||'<div class="evt">集市还很安静，逛逛新摊位吧。</div>':m.listings.map(l=>wmCard(l.name,`<div class="wm-tags"><span class="tag">${esc(l.world)}</span><span class="tag">${esc(l.type==='wanted'?'十万火急 · 求购':l.preorder?'预售':l.mood)}</span></div><p>${esc(l.desc)}</p><small>${esc(l.seller)} · ${l.type==='wanted'?'剩余需求':'库存'} ${l.stock} · 已成交 ${l.sold}</small><p>${l.type==='wanted'?`对方愿出 ${esc(wmFmt(l.price))} · 需要「${esc(l.need)}」`:l.need?`以物换物：${esc(l.need)} × ${l.needQty}`:`${esc(wmFmt(l.price))}<small>原价 ${l.originPrice} ${esc(l.currency)} · 1 ${esc(l.currency)} ≈ ${l.rate} ${esc(S.wallet.currency)}<br>平台基准 ${esc(wmFmt(l.base))} · 卖家系数 ${l.markup} 倍</small>`}</p>${l.stock?wmBtn('trade',l.type==='wanted'?'交付物品':l.need?'挑选交换物':'购买',`data-id="${l.id}"`):'<span class="tag">已结束</span>'}`)).join('')||'<div class="evt">联系一下商人，看看今天各个世界带来了什么。</div>');
}
async function wmRefresh(){if(wmBusy)return;wmBusy=true;wmRenderMarket();try{
  const out=await callAPI([{role:'system',content:`你是万界市场内容生成器。生成6个跨世界摊位商品，包含急售、随缘高价、特殊物品交换、批量库存、预售以及1条紧急求购。结合世界书。只输出 JSON {"listings":[{"name":"商品","seller":"商人","world":"来源世界","desc":"说明","type":"sale或wanted","mood":"急售或随缘或溢价","currency":"原产货币","originPrice":50,"rate":2,"markup":1.2,"stock":3,"need":"交换或求购物品名，无则空","needQty":1,"preorder":false,"hours":24}]}。rate为1单位原产货币能换多少用户货币，遵循世界书中固定汇率；markup是卖家开价系数0.3—5。求购必须有need；描述明确为什么急需、贵卖或预售，勿替用户声称已拥有特殊物品。`},{role:'user',content:wmContext()}],{char:charById(curT().members[0]),max_tokens:2800,temperature:1});
  const j=parseJSON(out);if(!Array.isArray(j.listings)||!j.listings.length)throw Error('商人没有带来有效商品');
  const now=Date.now(),items=j.listings.slice(0,8).filter(x=>x.name&&x.seller).map(x=>{const rateKey=String(x.currency||S.wallet.currency)+'→'+S.wallet.currency;const rate=S.market.rates[rateKey]??(S.market.rates[rateKey]=Math.max(.001,wmNum(x.rate)));const base=wmNum(wmNum(x.originPrice)*rate),markup=Math.min(5,Math.max(.3,+x.markup||1)),price=Math.max(.01,wmNum(base*markup));return {id:uid(),name:String(x.name).slice(0,100),seller:String(x.seller).slice(0,80),world:String(x.world||'异世界').slice(0,60),desc:String(x.desc||'').slice(0,1200),type:x.type==='wanted'?'wanted':'sale',mood:String(x.mood||'随缘'),currency:String(x.currency||S.wallet.currency).slice(0,20),originPrice:wmNum(x.originPrice),rate,markup,base,price,floor:Math.max(.01,wmNum(base*.45)),stock:Math.min(999,Math.max(1,Math.floor(+x.stock||1))),sold:0,need:String(x.need||'').slice(0,100),needQty:Math.min(99,Math.max(1,Math.floor(+x.needQty||1))),preorder:x.type!=='wanted'&&!!x.preorder,hours:Math.min(720,Math.max(1,+x.hours||24)),at:now,lastPriceAt:now};}).filter(x=>x.type!=='wanted'||x.need);
  if(!items.length)throw Error('商品格式无效');S.market.listings.push(...items);S.market.refreshAt=now;wmFeed(`${items.length} 个新摊位到站，旧挂单继续营业。`);save('market');
  }catch(e){toast('没逛成：'+e.message,5000)}finally{wmBusy=false;wmRenderMarket()}}
async function wmTrade(id){const l=S.market.listings.find(x=>x.id===id);if(!l||!l.stock)return toast('这单已结束');let qty=1,bag=null;
  if(l.need){const candidates=S.wallet.bag.filter(x=>x.qty>=l.needQty&&x.name===l.need&&(l.type!=='wanted'||x.kind!=='token'));if(!candidates.length)return toast(l.type==='wanted'?'背包里没有可交付商品（信物不能换钱）':'需要同名交换物「'+l.need+'」×'+l.needQty);const k=await actionSheet(candidates.map(x=>({label:esc(x.name)+' · '+esc(x.from||'背包')})),'选择要交出的物品（会消耗）');if(k<0)return;bag=candidates[k];}
  else{const r=await formSheet('购买 '+l.name,[{k:'qty',t:'text',l:`数量（库存 ${l.stock}）`,num:1}],{qty:'1'});if(!r)return;qty=Number(r.qty);if(!Number.isInteger(qty)||qty<1||qty>l.stock)return toast('数量不对哦');}
  const total=wmNum(l.price*qty),payment=bag?`${l.need} ×${l.needQty}`:wmFmt(total),ok=await actionSheet([{label:l.type==='wanted'?`确认交付，获得 ${esc(wmFmt(total))}`:`确认${l.preorder?'预订':'购买'} ×${qty} · ${esc(payment)}`}],l.name);if(ok!==0)return;
  // 弹层期间可能发生市场更新，成交前重新校验库存、物品和余额。
  if(l.stock<qty)return toast('库存刚刚变了，请重试');if(bag&&bag.qty<l.needQty)return toast('交换物不足');if(!bag&&total>S.wallet.balance)return toast('零钱不够啦');
  if(bag){if(l.type==='wanted'&&bag.kind==='token')return toast('信物不能变现');bag.qty-=l.needQty;}if(l.type==='wanted')wmMoney(total,'万界求购 · '+l.name);else if(!bag)wmMoney(-total,'万界杂货铺 · '+l.name+' ×'+qty);
  l.stock-=qty;l.sold+=qty;const o={id:uid(),name:l.name,desc:l.desc,seller:l.seller,qty,at:Date.now(),payment,status:l.type==='wanted'?'fulfilled':l.preorder?'preorder':'delivered',due:Date.now()+l.hours*3600000};S.market.orders.unshift(o);
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

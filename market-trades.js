/* Seller-backed checkout quotes. Pure cash OR pure barter; never mixed payment. */
const wmTradeLocks=new Set();
const wmDrafts=new Map();
function wmOwned(name,allowTokens=true){return S.wallet.bag.filter(b=>b.name===name&&b.qty>0&&(allowTokens||b.kind!=='token')).reduce((n,b)=>n+Math.floor(+b.qty||0),0)}
function wmNeeds(items,allowTokens=true){return items.map(i=>`${i.name} ×${i.qty}（背包 ${wmOwned(i.name,allowTokens)}／需要 ${i.qty}）`).join('；')}
function wmQuoteEntries(l){return wmCommentThread(l.id).comments.flatMap(c=>(c.quotes||[]).map(q=>({q,c})))}
function wmQuoteFind(l,id){return wmQuoteEntries(l).find(x=>x.q.id===id)}
function wmQuoteState(l,q){return q.status&&q.status!=='active'?q.status:l.stock<=0?'sold':q.expires<=Date.now()?'expired':'active'}
function wmCashInText(text,price){const values=(String(text).replace(/[,，]/g,'').match(/\d+(?:\.\d+)?/g)||[]).map(Number);return values.some(n=>Math.abs(n-price)<.005)}
function wmQuoteAdd(l,c,raw){
 if(l.type==='wanted'||!c||c.user||(S.market.social.people[c.personId]?.role!=='seller'||S.market.social.people[c.personId]?.name!==l.seller)||!raw||raw.accepted!==true)return null;
 const mode=raw.mode;if(!['cash','barter'].includes(mode))return null;
 let terms;
 if(mode==='cash'){
  const price=Number(raw.price);if(raw.items?.length||!Number.isFinite(price)||price<=0||price>1e9||price<Number(l.floor||.01)||!wmCashInText(c.text,price))return null;
  terms={price:wmNum(price)};
 }else{
  if(Number(raw.price||0)!==0||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>4)return null;
  const items=[];for(const r of raw.items){const name=wmText(r.name,100),qty=Number(r.qty);if(!name||!Number.isInteger(qty)||qty<1||qty>999||!c.text.includes(name))return null;const old=items.find(i=>i.name===name);if(old)old.qty+=qty;else items.push({name,qty});}if(items.some(i=>i.qty>999))return null;terms={items};
 }
 const signature=JSON.stringify([mode,terms]);
 const existing=wmQuoteEntries(l).find(({q,c:comment})=>comment===c&&q.signature===signature);if(existing)return wmQuoteState(l,existing.q)==='active'?existing.q:null;
 const comments=wmCommentThread(l.id).comments;if(wmQuoteEntries(l).some(({q,c:later})=>later!==c&&q.mode===mode&&comments.indexOf(later)>comments.indexOf(c)))return null;
 // A new seller reply replaces older offers of the same payment type, while
 // alternatives stated in this same reply remain available together.
 for(const {q,c:comment} of wmQuoteEntries(l))if(comment!==c&&q.mode===mode&&wmQuoteState(l,q)==='active')q.status='superseded';
 const q={id:'mq'+uid(),mode,...terms,signature,reason:wmText(raw.reason,300),at:Date.now(),expires:Date.now()+30*60000,status:'active'};(c.quotes||=[]).push(q);return q;
}
function wmQuoteCards(l,c){return (c.quotes||[]).map(q=>{const state=wmQuoteState(l,q),labels={sold:'商品已售罄',expired:'报价已到期',consumed:'这份报价已成交',superseded:'已被新报价替代'},ready=q.mode==='cash'||q.items.every(i=>wmOwned(i.name)>=i.qty);
 return `<div class="wm-quote"><small>卖家的${q.mode==='cash'?'现金':'交换'}报价 · ${esc(l.name)}</small><strong>${q.mode==='cash'?esc(wmFmt(q.price))+' / 件':esc(q.items.map(i=>i.name+' ×'+i.qty).join(' ＋ '))}</strong>${q.mode==='barter'?`<p class="hint">${esc(wmNeeds(q.items))}</p>`:''}<small>${esc(q.reason||'确认成交前不会扣款或交出物品')} · ${new Date(q.expires).toLocaleTimeString()} 前有效</small><button class="btn pri" data-wmt="buy-quote" data-id="${esc(l.id)}" data-quote="${esc(q.id)}" ${state!=='active'||!ready?'disabled':''}>${state!=='active'?labels[state]||'报价不可用':!ready?'交换物不足':q.mode==='cash'?'用钱购买':'按此方案交换'}</button></div>`;
 }).join('')}
function wmTradeTools(l){return `<div class="wm-inquiry">${l.stock>0&&l.type!=='wanted'?`<button class="btn" data-wmt="draft" data-id="${esc(l.id)}" data-kind="cash">问现金价</button><button class="btn" data-wmt="draft" data-id="${esc(l.id)}" data-kind="barter">问交换条件</button>`:''}<button class="btn" data-wmt="sync" data-id="${esc(l.id)}" ${wmSocialBusy.has('quote-sync:'+l.id)?'disabled':''}>${wmSocialBusy.has('quote-sync:'+l.id)?'正在核对报价…':'同步卖家报价'}</button></div>`}
function wmBagHint(l){return l.need?`<p class="wm-bag-hint">${esc(wmNeeds([{name:l.need,qty:l.needQty||1}],l.type!=='wanted'))}</p>`:''}
function wmFavoriteButton(l){return `<button class="btn wm-favorite" data-wmt="favorite" data-id="${esc(l.id)}" aria-pressed="${!!l.favorite}">${l.favorite?'♥ 已关注摊位':'♡ 收藏 / 关注摊位'}</button>`}
function wmQuoteAcceptResponse(l,comments,j,post){
 if(!post)return;
 for(const {raw,c} of comments)if(raw.role==='seller'&&Array.isArray(raw.tradeOffers))for(const q of raw.tradeOffers.slice(0,5))wmQuoteAdd(l,c,q);
 // Keep existing discount adoption compatible with older API responses.
 const c=comments.filter(x=>x.raw.role==='seller').at(-1)?.c,n=Number(j.offer?.price);
 if(c&&l.type!=='wanted'&&!l.need&&Number.isFinite(n)&&n>0&&n>=l.floor&&n<=l.price&&n<l.price){wmCommentThread(l.id).offer={id:uid(),price:wmNum(n),reason:wmText(j.offer.reason,400),expires:Date.now()+30*60000};wmQuoteAdd(l,c,{accepted:true,mode:'cash',price:n,reason:j.offer.reason});}
}
const WM_QUOTE_SCHEMA='卖家本条留言明确同意成交时，在这条seller留言内返回 tradeOffers 数组；否则空数组。每项为 {"accepted":true,"mode":"cash","price":960,"reason":"报价说明"} 或 {"accepted":true,"mode":"barter","items":[{"name":"物品完整名称","qty":2}],"reason":"说明"}。每项是一种独立可选方案，不得混合现金和物品，不支持补差价。现金报价必须在卖家本条正文明确写出数字价格，采用用户货币的每件价格；即使原商品只换物，卖家同意现金也能报。换物正文必须明确写出物品全名与数量，可给多种替代方案。未同意、假设、拒绝、提问和围观者不返回tradeOffers。求购不返回tradeOffers。只听闲聊时不新增报价。';
async function wmSyncQuotes(id){
 const market=S.market,l=market.listings.find(l=>l.id===id);if(!l||l.type==='wanted')return toast('这个摊位暂不支持同步卖家报价');
 const lock='quote-sync:'+id;if(wmSocialBusy.has(lock))return;const t=wmCommentThread(id),snapshot=t.comments.map(c=>({id:c.id,role:c.user?'user':market.social.people[c.personId]?.role,text:c.text}));
 const sellers=snapshot.filter(c=>c.role==='seller');if(!sellers.length)return toast('先和卖家聊聊价格或交换条件吧');
 wmSocialBusy.add(lock);wmCommentsOpen.add(id);wmRenderMarket();
 try{
  const out=await callAPI([{role:'system',content:'你只整理已有留言，不替卖家新增条件或发新留言。严格只输出 JSON {"quotes":[{"commentId":"卖家留言ID","evidence":"原留言中连续逐字的明确成交条件","mode":"cash或barter","accepted":true,"price":960,"items":[]}]}。只提取卖家最近明确同意且未被后续卖家留言撤回或改价的条件。现金需有明确数字金额和单位，不把买家或围观者的话当卖家承诺；不明确则quotes为空。'+WM_QUOTE_SCHEMA},{role:'user',content:'商品：'+JSON.stringify({name:l.name,price:l.price,need:l.need,needQty:l.needQty})+'\n已有留言：'+JSON.stringify(snapshot)}],{char:charById(curT().members[0]),max_tokens:1500,temperature:.2});
  if(S.market!==market||!market.listings.includes(l)||JSON.stringify(snapshot)!==JSON.stringify(t.comments.map(c=>({id:c.id,role:c.user?'user':market.social.people[c.personId]?.role,text:c.text}))))throw Error('留言或存档已更新，请重新同步');
  const j=parseJSON(out),candidates=[];
  for(const q of (Array.isArray(j.quotes)?j.quotes:[]).slice(0,6)){const c=t.comments.find(c=>c.id===q.commentId),evidence=wmText(q.evidence,1000);if(!c||!evidence||!c.text.includes(evidence)||c.user||market.social.people[c.personId]?.role!=='seller')continue;
   // Numerical prices and named items must occur in the quoted source itself.
   if(q.mode==='cash'&&!wmCashInText(evidence,Number(q.price)))continue;if(q.mode==='barter'&&(!q.items?.length||q.items.some(i=>!evidence.includes(i.name))))continue;
   candidates.push({c,q});
  }
  if(!candidates.length)return toast('还没有找到卖家明确同意的可执行报价，可以再问一句确认价格。',4500);
  const preview=candidates.map(({q})=>q.mode==='cash'?wmFmt(q.price)+' / 件':(q.items||[]).map(i=>i.name+' ×'+i.qty).join(' ＋ ')).join('\n或 ');
  if(await actionSheet([{label:'确认同步到卖家留言'},{label:'先不添加'}],preview)!==0)return;
  if(S.market!==market||JSON.stringify(snapshot)!==JSON.stringify(t.comments.map(c=>({id:c.id,role:c.user?'user':market.social.people[c.personId]?.role,text:c.text}))))throw Error('留言已更新，请重新同步');
  let count=0;for(const {c,q} of candidates)if(wmQuoteAdd(l,c,q))count++;await save('market');toast(count?'报价已经放到对应的卖家留言下面啦':'报价不完整，请再向卖家确认一下');
 }finally{wmSocialBusy.delete(lock);wmRenderMarket();}
}
async function wmTrade(id,quoteId=null){
 const market=S.market,wallet=S.wallet,l=market.listings.find(x=>x.id===id);if(!l||l.stock<=0)return toast('这单已结束');if(wmTradeLocks.has(id))return;wmTradeLocks.add(id);
 try{
  const found=quoteId?wmQuoteFind(l,quoteId):null,q=found?.q;if(quoteId&&(!q||wmQuoteState(l,q)!=='active'))return toast('这个报价已失效，请看卖家的最新报价');
  const defaultTerms=JSON.stringify([l.need,l.needQty,l.type,l.preorder]),signature=q?JSON.stringify(q):null,mode=q?.mode||(l.need?'barter':'cash'),items=mode==='barter'?(q?.items||[{name:l.need,qty:l.needQty||1}]):[],unit=q?.price??wmDealPrice(l);let qty=1;
  if(mode==='barter'){if(items.some(i=>wmOwned(i.name,l.type!=='wanted')<i.qty))return toast('交换物不足：'+wmNeeds(items,l.type!=='wanted'),5000)}
  else{const r=await formSheet('购买 '+l.name,[{k:'qty',t:'text',l:`数量（库存 ${l.stock}）`,num:1}],{qty:'1'});if(!r)return;qty=Number(r.qty);if(!Number.isInteger(qty)||qty<1||qty>l.stock)return toast('数量不对哦')}
  const total=wmNum(unit*qty),payment=mode==='barter'?items.map(i=>i.name+' ×'+i.qty).join(' ＋ '):wmFmt(total);
  if(mode==='cash'&&(!Number.isFinite(+unit)||unit<=0||total<=0))return toast('报价无效，请重新询价');
  if(await actionSheet([{label:l.type==='wanted'?`确认交付，获得 ${wmFmt(total)}`:`确认${l.preorder?'预订':'购买'} ×${qty} · ${payment}`}],l.name)!==0)return;
  if(S.market!==market||S.wallet!==wallet||!market.listings.includes(l))return toast('存档已切换，请重新购买');
  if(l.stock<qty)return toast('库存刚刚变了，请重试');
  if(q?(wmQuoteFind(l,quoteId)?.q!==q||wmQuoteState(l,q)!=='active'||JSON.stringify(q)!==signature):(wmDealPrice(l)!==unit||JSON.stringify([l.need,l.needQty,l.type,l.preorder])!==defaultTerms))return toast('报价刚刚更新，请重新确认购买');
  if(mode==='barter'&&items.some(i=>wmOwned(i.name,l.type!=='wanted')<i.qty))return toast('交换物不足，未成交');
  if(mode==='cash'&&total>wallet.balance)return toast('零钱不够啦');
  // Revalidated once after all dialogs; commit synchronously so double taps and
  // wallet/backpack actions cannot spend the same stock or items twice.
  if(mode==='barter')for(const i of items){let left=i.qty;for(const b of wallet.bag){if(b.name!==i.name||b.qty<=0||(l.type==='wanted'&&b.kind==='token'))continue;const n=Math.min(left,b.qty);b.qty-=n;left-=n;if(!left)break;}}
  if(l.type==='wanted')wmMoney(total,'万界求购 · '+l.name);else if(mode==='cash')wmMoney(-total,'万界杂货铺 · '+l.name+' ×'+qty);
  l.stock-=qty;l.sold=(+l.sold||0)+qty;const o={id:uid(),name:l.name,desc:l.desc,seller:l.seller,qty,at:Date.now(),payment,paymentMode:mode,unitPrice:mode==='cash'?unit:null,quoteId:q?.id||null,status:l.type==='wanted'?'fulfilled':l.preorder?'preorder':'delivered',due:Date.now()+(l.hours||24)*3600000,listingId:l.id,buyer:{id:'user',name:S.user.name}};market.orders.unshift(o);delete l.deal;if(q){q.status='consumed';q.orderId=o.id}wmSocialPurchase(l,o);
  if(l.type!=='wanted'&&!l.preorder)wallet.bag.push({id:uid(),name:l.name,desc:l.desc,kind:'goods',qty,from:l.seller,at:Date.now(),source:'market',orderId:o.id});
  wmFeed(`${S.user.name}${l.type==='wanted'?'完成求购':'买下'}「${l.name}」×${qty}。`);await Promise.all([save('wallet'),save('market')]);wmRenderMarket();toast(l.preorder?'预订好了，到货会放入百宝箱':'成交啦，物品已放入百宝箱 ✦');
 }finally{wmTradeLocks.delete(id)}
}
document.addEventListener('input',e=>{if(e.target.matches?.('[data-wms-input]'))wmDrafts.set(e.target.dataset.wmsInput,e.target.value)});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-wmt]');if(!b)return;const id=b.dataset.id,l=S.market.listings.find(x=>x.id===id);if(!l)return;
 try{
  if(b.dataset.wmt==='favorite'){l.favorite=!l.favorite;await save('market');wmRenderMarket()}
  if(b.dataset.wmt==='buy-quote')await wmTrade(id,b.dataset.quote);
  if(b.dataset.wmt==='sync')await wmSyncQuotes(id);
  if(b.dataset.wmt==='draft'){wmCommentsOpen.add(id);wmRenderMarket();const input=$$('[data-wms-input]').find(el=>el.dataset.wmsInput===id);if(input){const text=b.dataset.kind==='cash'?'没有合适的交换物，可以用钱购买吗？请告诉我现金价格。':'除了目前的条件，还可以用哪些物品交换？请分别告诉我物品名称和数量。';input.value=(input.value?input.value+'\n':'')+text;wmDrafts.set(id,input.value);input.focus();input.scrollIntoView({block:'center',behavior:'smooth'})}}
 }catch(err){toast(err.message||'这次没有成交，请再试一次',4500)}
});

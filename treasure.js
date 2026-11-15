/* One inventory shared by wallet, treasure chest, gifts and all checkout paths. */
if(!APPS.some(a=>a.id==='treasure'))APPS.push({id:'treasure',name:'百宝箱'});
PACKS.prince.icons.treasure='themes/prince/market/bag.webp';
SVG.treasure='<svg viewBox="0 0 24 24"><path d="M3 9h18v12H3zM3 9c0-8 18-8 18 0M3 14h18M10 12h4v5h-4z"/></svg>';
const treasureView={source:'all',search:'',limit:24};
const TREASURE_SOURCES={all:'全部珍藏',gift:'TA 送的',self:'自己买的',market:'万界集市',legacy:'原有物品'};
function treasureSource(b){return b.source&&TREASURE_SOURCES[b.source]?b.source:b.kind==='token'?'gift':'legacy'}
function treasureSyncOrders(){
 if(!S.wallet?.bag)return;const w=S.wallet;w.inventoryReceipts||=[];let dirty=false;
 // Existing bags stay authoritative, including zero-quantity consumed stacks.
 for(const b of w.bag)if(!b.source){b.source=b.kind==='token'?'gift':S.market.orders.some(o=>o.status==='delivered'&&o.name===b.name&&o.seller===b.from)?'market':'legacy';dirty=true;}
 for(const o of S.orders||[]){
  if(o.status!=='delivered'||!['self','in'].includes(o.dir))continue;
  const key='shop:'+o.id;if(w.inventoryReceipts.includes(key))continue;
  const existing=w.bag.find(b=>b.receiptKey===key);
  if(!existing&&!o.inventoryImported)w.bag.push({id:uid(),name:o.name,desc:o.desc||'',kind:'goods',qty:Math.max(1,Math.floor(+o.qty||1)),from:o.dir==='in'?(charById(o.cid)?.name||'TA'):o.shop||'自己购买',at:o.eta||o.at||Date.now(),source:o.dir==='in'?'gift':'self',charId:o.dir==='in'?o.cid:null,orderId:o.id,receiptKey:key,shopKind:o.kind});
  w.inventoryReceipts.push(key);o.inventoryImported=true;dirty=true;
 }
 if(dirty){save('wallet');save('orders')}
}
function treasureInit(){
 treasureSyncOrders();
 if(!S.home.treasureDesktopV1){if(!S.home.pages.flat().some(i=>i.type==='app'&&i.app==='treasure'))S.home.pages.at(-1).push({id:uid(),type:'app',app:'treasure'});S.home.treasureDesktopV1=true;save('home')}
 if(!$('#app-treasure')){const app=document.createElement('section');app.id='app-treasure';app.className='app';app.innerHTML='<header><button class="hbtn" data-back>‹ 返回</button><div class="title">百宝箱</div><span class="hbtn">✧</span></header><div class="body pad" id="treasureBody"></div>';$('#phone').append(app)}
 RENDER.treasure=treasureRender;
}
function treasureRender(){
 treasureSyncOrders();const B=$('#treasureBody');if(!B)return;
 const owned=S.wallet.bag.filter(b=>b.qty>0),query=treasureView.search.trim().toLocaleLowerCase(),items=owned.filter(b=>(treasureView.source==='all'||treasureSource(b)===treasureView.source)&&(!query||[b.name,b.desc,b.from].join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>(+b.at||0)-(+a.at||0));
 const pending=(S.orders||[]).filter(o=>o.status!=='delivered'&&['self','in'].includes(o.dir)).map(o=>({name:o.name,qty:o.qty||1,due:o.eta,source:o.dir==='in'?'gift':'self'})).concat(S.market.orders.filter(o=>o.status==='preorder').map(o=>({name:o.name,qty:o.qty,due:o.due,source:'market'})));
 B.innerHTML=`<div class="treasure-hero"><img src="themes/prince/market/bag.webp" alt=""><small>把每一份心意好好收着</small><h2>我的百宝箱</h2><p>${owned.length} 份珍藏 · 共 ${owned.reduce((n,b)=>n+(+b.qty||0),0)} 件</p></div><div class="treasure-tabs" role="group" aria-label="物品来源">${Object.entries(TREASURE_SOURCES).map(([k,t])=>`<button class="btn" data-treasure="source" data-id="${k}" aria-pressed="${treasureView.source===k}">${t}</button>`).join('')}</div><form id="treasureSearchForm"><input id="treasureSearch" type="search" value="${esc(treasureView.search)}" maxlength="100" placeholder="找物品、来历或赠送的人" aria-label="搜索百宝箱"><button class="btn" type="submit">查找</button></form><p class="hint">与钱包共用同一份背包。送达后入箱，使用或交换后数量同步减少。</p>${items.slice(0,treasureView.limit).map(b=>`<article class="card glass treasure-item"><span class="tag">${TREASURE_SOURCES[treasureSource(b)]}${b.kind==='token'?' · 信物':''}</span><h3>${esc(b.name)} <small>× ${b.qty}</small></h3><p>${esc(b.desc||'这件物品已经被你收好了。')}</p><small>来自 ${esc(b.from||'原有背包')}${b.at?' · '+new Date(b.at).toLocaleDateString('zh-CN'):''}</small>${b.kind==='token'?'<p class="hint">信物可交换，不可变现。</p>':''}<div class="btns">${wmBtn('use','使用',`data-id="${esc(b.id)}"`)}${wmBtn('gift','送给 TA',`data-id="${esc(b.id)}"`)}</div></article>`).join('')||`<div class="wm-empty"><img src="themes/prince/market/bag.webp" alt=""><p>${owned.length?'还没找到符合条件的物品，换个分类或关键词试试。':'百宝箱等着收下第一份心意。角色的礼物和买给自己的东西都会来到这里。'}</p></div>`}${items.length>treasureView.limit?'<button class="btn" data-treasure="more">再看一些珍藏</button>':''}${pending.length?`<details class="treasure-pending"><summary>正在路上 · ${pending.length} 笔</summary>${pending.filter(o=>treasureView.source==='all'||o.source===treasureView.source).map(o=>`<div class="wm-row"><span>${esc(o.name)} ×${o.qty}<small>${TREASURE_SOURCES[o.source]} · 预计 ${new Date(o.due).toLocaleString()} 到货</small></span><span class="tag">待收货</span></div>`).join('')}</details>`:''}`;
 $('#treasureSearchForm').onsubmit=e=>{e.preventDefault();treasureView.search=$('#treasureSearch').value;treasureView.limit=24;treasureRender()};
}
async function wmUse(id,gift){
 const wallet=S.wallet,item=wallet.bag.find(x=>x.id===id);if(!item||item.qty<1)return;let cid=curT().members[0];
 if(gift){const k=await actionSheet(S.chars.map(c=>({label:esc(c.name)})),'送给谁？');if(k<0||!S.chars[k])return;cid=S.chars[k].id}
 const c=charById(cid);if(!c)return toast('先选择一位角色');if(await actionSheet([{label:gift?'确认送给 '+c.name:'确认使用一件'}],item.name)!==0)return;
 if(S.wallet!==wallet||!wallet.bag.includes(item)||item.qty<1)return toast('物品数量刚刚变了，请重新查看百宝箱');
 item.qty--;await save('wallet');const T=threadOf(cid);pushMsg(T,'online','event',`${S.user.name}${gift?'把':'使用了'}「${item.name}」${gift?'送给'+c.name:''}。物品说明：${item.desc}`);
 wmRenderWallet();treasureRender();generate(T,'online',`请对刚才${gift?'收到礼物':'用户使用物品'}自然回应；这是虚构世界内的物品事件。`);toast(gift?'送出啦':'已使用，TA 会在聊天中回应');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-treasure]');if(!b)return;if(b.dataset.treasure==='open'){openApp('treasure');return}if(b.dataset.treasure==='source'){treasureView.source=b.dataset.id;treasureView.limit=24}else if(b.dataset.treasure==='more')treasureView.limit+=24;treasureRender()});

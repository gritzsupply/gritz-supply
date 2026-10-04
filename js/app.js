import { CONFIG } from './config.js';
import { api, assertConfigured } from './api.js';

const state = {
  sessionToken: localStorage.getItem(CONFIG.SESSION_KEY) || '',
  user: null,
  route: 'dashboard',
  products: [],
  master: { categories: [], brands: [], suppliers: [] },
  inventory: [],
  sales: [],
  cart: [],
  paymentMethod: '',
  posSearch: '',
  categoryFilter: '',
  brandFilter: '',
  chart: null,
  dashboard: null
};

const root = document.getElementById('root');
const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');
const offlineBanner = document.getElementById('offlineBanner');

const ROUTES = {
  dashboard: { title: 'Dasbor', subtitle: 'Ringkasan operasional GRITZ SUPPLY.', icon: 'layout-dashboard' },
  pos: { title: 'Kasir', subtitle: 'Catat transaksi Tunai dan QRIS.', icon: 'shopping-cart' },
  sales: { title: 'Penjualan', subtitle: 'Riwayat transaksi toko.', icon: 'receipt-text' },
  products: { title: 'Produk', subtitle: 'Kelola produk, merek, kategori, dan varian.', icon: 'package' },
  inventory: { title: 'Stok Barang', subtitle: 'Pantau jumlah stok barang yang ada di toko.', icon: 'boxes' },
  stock: { title: 'Riwayat Stok', subtitle: 'Lihat setiap perubahan stok.', icon: 'history' },
  purchases: { title: 'Restok', subtitle: 'Catat pembelian dan penerimaan stok.', icon: 'package-plus', owner: true },
  suppliers: { title: 'Pemasok', subtitle: 'Kelola data pemasok.', icon: 'truck', owner: true },
  expenses: { title: 'Pengeluaran', subtitle: 'Catat biaya operasional toko.', icon: 'wallet-cards', owner: true },
  analytics: { title: 'Analitik', subtitle: 'Lihat performa bisnis berdasarkan data transaksi.', icon: 'chart-no-axes-combined', owner: true },
  reports: { title: 'Laporan', subtitle: 'Tampilkan dan unduh data CSV.', icon: 'file-chart-column', owner: true },
  users: { title: 'Pengguna', subtitle: 'Kelola Gmail yang diizinkan masuk.', icon: 'users', owner: true },
  activity: { title: 'Riwayat Aktivitas', subtitle: 'Audit aktivitas penting dalam sistem.', icon: 'list-checks', owner: true },
  settings: { title: 'Pengaturan', subtitle: 'Pengaturan profil toko dan sistem.', icon: 'settings', owner: true }
};

const NAV = [
  ['IKHTISAR', ['dashboard']],
  ['TOKO', ['pos', 'sales']],
  ['STOK', ['products', 'inventory', 'stock', 'purchases', 'suppliers']],
  ['BISNIS', ['expenses', 'analytics', 'reports']],
  ['SISTEM', ['users', 'activity', 'settings']]
];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function money(n) { return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(Number(n)||0).replace(/\s/g,''); }
function num(n) { return new Intl.NumberFormat('id-ID').format(Number(n)||0); }
function dt(v) { if (!v) return '-'; const d = new Date(v); return isNaN(d) ? esc(v) : new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(d); }
function shortDate(v) { if (!v) return '-'; const d = new Date(v); return isNaN(d) ? esc(v) : new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(d); }
function roleOwner() { return state.user?.role === 'OWNER'; }
function initials(name) { return String(name||'GR').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(); }
function requestId() { return 'REQ_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()+'_'+Math.random()).replaceAll('-',''); }
function icon(name, cls='') { return `<i data-lucide="${name}" class="${cls}"></i>`; }
function renderIcons(){ setTimeout(()=>window.lucide?.createIcons?.(),0); }
function toast(message, type=''){ const el=document.createElement('div'); el.className='toast '+type; el.textContent=message; toastRoot.appendChild(el); setTimeout(()=>el.remove(),3500); }
function setTheme(theme){ document.documentElement.dataset.theme=theme; localStorage.setItem(CONFIG.THEME_KEY,theme); renderIcons(); }
function currentTheme(){ const saved=localStorage.getItem(CONFIG.THEME_KEY); if(saved) return saved; return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; }
function toggleTheme(){ setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'); }
function loadingRows(cols=6, rows=5){ return `<div class="table-wrap"><table><thead><tr>${Array.from({length:cols},()=>'<th><div class="skeleton" style="height:12px;width:70px"></div></th>').join('')}</tr></thead><tbody>${Array.from({length:rows},()=>`<tr>${Array.from({length:cols},()=>'<td><div class="skeleton" style="height:16px"></div></td>').join('')}</tr>`).join('')}</tbody></table></div>`; }
function emptyState(title, text, action=''){ return `<div class="empty">${icon('inbox')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`; }
function badge(text, type=''){ return `<span class="badge ${type}">${esc(text)}</span>`; }

window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
function updateOnline(){ offlineBanner.classList.toggle('hidden', navigator.onLine); }

async function boot(){
  setTheme(currentTheme());
  updateOnline();

  // DEV MODE SEMENTARA:
  // Google Login dilewati sepenuhnya di frontend.
  state.sessionToken = 'DEV_MODE';
  state.user = {
    userId: 'DEV_OWNER',
    email: 'gritzsupply@gmail.com',
    name: 'GRITZ SUPPLY',
    role: 'OWNER',
    status: 'ACTIVE'
  };

  renderLoadingShell();
  await enterApp();
}

function renderLogin(error=''){
  root.innerHTML = `<div class="login-shell"><section class="login-card"><img src="assets/gritz-logo.png" alt="GRITZ SUPPLY"><h1>GRITZ SUPPLY</h1><p>Sistem Manajemen Toko<br>Masuk menggunakan akun Google yang sudah memiliki akses.</p><div id="googleButton"></div>${error?`<div class="setup-error">${esc(error)}</div>`:''}</section></div>`;
  try { assertConfigured(); } catch(err) { document.getElementById('googleButton').innerHTML='<button class="btn" disabled>Konfigurasi belum selesai</button>'; return; }
  const wait = setInterval(()=>{
    if (!window.google?.accounts?.id) return;
    clearInterval(wait);
    google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: true });
    google.accounts.id.renderButton(document.getElementById('googleButton'), { theme: document.documentElement.dataset.theme==='dark'?'filled_black':'outline', size:'large', shape:'pill', text:'signin_with', width:320, locale:'id' });
  },100);
}
window.handleGoogleCredential = async function(resp){
  try{
    const data = await api('auth.login', { credential: resp.credential });
    state.sessionToken=data.sessionToken; state.user=data.user; localStorage.setItem(CONFIG.SESSION_KEY,state.sessionToken); await enterApp();
  }catch(err){ renderLogin(err.message); }
};

function renderLoadingShell(){ root.innerHTML='<div class="login-shell"><div class="login-card"><div class="skeleton" style="width:86px;height:86px;margin:0 auto 18px"></div><div class="skeleton" style="height:30px"></div></div></div>'; }

async function enterApp(){
  const requested = (location.hash.replace('#/','') || 'dashboard');
  state.route = ROUTES[requested] && (!ROUTES[requested].owner || roleOwner()) ? requested : 'dashboard';
  renderShell();
  window.addEventListener('hashchange', onHashChange);
  await renderRoute();
}

function onHashChange(){
  const r=location.hash.replace('#/','')||'dashboard';
  if(!ROUTES[r] || (ROUTES[r].owner && !roleOwner())) return navigate('dashboard');
  state.route=r; renderShell(); renderRoute();
}
function navigate(route){ location.hash='#/'+route; if(state.route===route){ state.route=route; renderShell(); renderRoute(); } }
window.gritzNavigate=navigate;

function renderShell(){
  const route=ROUTES[state.route];
  root.innerHTML=`<div class="app-shell">
    <aside class="sidebar"><div class="brand"><img src="assets/gritz-logo.png" alt="GRITZ"><strong>GRITZ SUPPLY</strong></div><div class="sidebar-scroll">${NAV.map(([section,routes])=>{
      const visible=routes.filter(r=>!ROUTES[r].owner||roleOwner()); if(!visible.length)return'';
      return `<div class="nav-section">${section}</div>${visible.map(r=>`<button class="nav-item ${state.route===r?'active':''}" data-route="${r}">${icon(ROUTES[r].icon)}<span>${ROUTES[r].title}</span></button>`).join('')}`;
    }).join('')}</div><div class="sidebar-footer"><div class="user-mini"><div class="avatar">${esc(initials(state.user.name))}</div><div class="meta"><strong>${esc(state.user.name)}</strong><span>${state.user.role==='OWNER'?'Pemilik':'Staf'}</span></div></div><button class="nav-item" id="sideTheme">${icon('sun-moon')}<span>Tema</span></button><button class="nav-item" id="logoutBtn">${icon('log-out')}<span>Keluar</span></button></div></aside>
    <header class="topbar"><div class="top-title"><h1>${esc(route.title)}</h1><p>${esc(route.subtitle)}</p></div><div class="top-actions"><div class="global-search">${icon('search')}<input id="globalSearch" placeholder="Cari produk, SKU, merek, kode warna..."></div><button class="icon-btn" id="topTheme" aria-label="Ganti tema">${icon('sun-moon')}</button><div class="avatar">${esc(initials(state.user.name))}</div></div></header>
    <main class="main"><div class="content" id="pageContent"></div></main>
    <nav class="mobile-nav">${[['dashboard','house','Dasbor'],['pos','shopping-cart','Kasir'],['sales','receipt-text','Penjualan'],['inventory','boxes','Stok'],['more','menu','Lainnya']].map(([r,i,l])=>`<button data-mobile-route="${r}" class="${state.route===r?'active':''}">${icon(i)}<span>${l}</span></button>`).join('')}</nav>
  </div>`;
  document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>navigate(b.dataset.route));
  document.querySelectorAll('[data-mobile-route]').forEach(b=>b.onclick=()=>b.dataset.mobileRoute==='more'?openMobileMenu():navigate(b.dataset.mobileRoute));
  document.getElementById('sideTheme').onclick=toggleTheme; document.getElementById('topTheme').onclick=toggleTheme; document.getElementById('logoutBtn').onclick=logout;
  document.getElementById('globalSearch').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.value.trim()){ state.posSearch=e.target.value.trim(); navigate('pos'); }});
  renderIcons();
}

async function logout(){
  toast('Mode Pengembangan aktif. Login Google sedang dilewati sementara.', 'info');
}

function openMobileMenu(){
  const routes=Object.keys(ROUTES).filter(r=>r!=='dashboard'&&r!=='pos'&&r!=='sales'&&r!=='inventory'&&(!ROUTES[r].owner||roleOwner()));
  openModal('Menu', `<div class="grid" style="grid-template-columns:1fr 1fr">${routes.map(r=>`<button class="btn" data-more-route="${r}">${icon(ROUTES[r].icon)} ${ROUTES[r].title}</button>`).join('')}</div>`, '');
  document.querySelectorAll('[data-more-route]').forEach(b=>b.onclick=()=>{ closeModal(); navigate(b.dataset.moreRoute); }); renderIcons();
}

async function renderRoute(){
  const content=document.getElementById('pageContent'); if(!content)return;
  content.innerHTML='<div class="skeleton" style="height:120px"></div>';
  try{
    const fn={dashboard:pageDashboard,pos:pagePOS,sales:pageSales,products:pageProducts,inventory:pageInventory,stock:pageStock,purchases:pagePurchases,suppliers:pageSuppliers,expenses:pageExpenses,analytics:pageAnalytics,reports:pageReports,users:pageUsers,activity:pageActivity,settings:pageSettings}[state.route];
    await fn(); renderIcons();
  }catch(err){ content.innerHTML=emptyState('Terjadi masalah',err.message,'<button class="btn" id="retryPage">Coba Lagi</button>'); document.getElementById('retryPage').onclick=renderRoute; renderIcons(); }
}

async function ensureMaster(){ state.master=await api('master.list',{},state.sessionToken); }
async function ensureProducts(includeInactive=false){ state.products=await api('product.list',{includeInactive:includeInactive&&roleOwner()},state.sessionToken); }

async function pageDashboard(){
  state.dashboard=await api('dashboard.get',{},state.sessionToken); const d=state.dashboard;
  const content=document.getElementById('pageContent');
  const metrics = [
    ['Penjualan Hari Ini',money(d.revenue),'payments'],
    ...(roleOwner()?[['Laba Hari Ini',money(d.grossProfit),'trending-up']]:[]),
    ['Transaksi',num(d.transactions),'receipt-text'],['Barang Terjual',num(d.itemsSold),'package-check'],['Tunai',money(d.cash),'banknote'],['QRIS',money(d.qris),'qr-code'],['Stok Menipis',num(d.lowStockCount),'triangle-alert'],...(roleOwner()?[['Nilai Stok',money(d.stockValue),'boxes']]:[])
  ];
  content.innerHTML=`<div class="page-head"><div><h2>Dasbor</h2><p>Ringkasan data yang sudah tercatat di sistem.</p></div></div><section class="grid metrics">${metrics.map(m=>`<article class="metric"><div class="label">${esc(m[0])}</div><div class="value">${esc(m[1])}</div><div class="sub">${icon(m[2])}</div></article>`).join('')}</section>
  <section class="dashboard-mid"><article class="panel"><div class="panel-title"><div><h3>Tren Penjualan</h3><span>Data ringkasan harian</span></div></div><div class="chart-wrap"><canvas id="salesChart"></canvas></div></article><article class="panel"><div class="panel-title"><div><h3>Stok Menipis</h3><span>${d.lowStock.length} ditampilkan</span></div><button class="btn small" id="goStock">Lihat Stok</button></div>${d.lowStock.length?`<div class="list-clean">${d.lowStock.map(i=>`<div class="list-row"><div><strong>${esc(i.productName)}</strong><span>${esc(i.variantName||i.colorName||i.sku)}</span></div>${badge(i.stock+' tersisa','warning')}</div>`).join('')}</div>`:emptyState('Belum ada stok menipis','Status akan muncul berdasarkan batas minimum yang diinput manual.')}</article></section>
  <section class="panel" style="margin-top:16px"><div class="panel-title"><div><h3>Penjualan Terbaru</h3><span>Transaksi terakhir</span></div><button class="btn small" id="goSales">Lihat Semua</button></div>${salesTable(d.recentSales)}</section>`;
  document.getElementById('goStock').onclick=()=>navigate('inventory'); document.getElementById('goSales').onclick=()=>navigate('sales');
  renderSalesChart(d.trend||[]);
}

function renderSalesChart(trend){
  const canvas=document.getElementById('salesChart'); if(!canvas)return; if(!window.Chart){setTimeout(()=>renderSalesChart(trend),180);return;}
  if(state.chart) state.chart.destroy();
  const color=getComputedStyle(document.documentElement).getPropertyValue('--text').trim(); const muted=getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
  state.chart=new Chart(canvas,{type:'bar',data:{labels:trend.map(x=>x.date.slice(5)),datasets:[{label:'Penjualan',data:trend.map(x=>x.revenue),backgroundColor:color,borderRadius:8,maxBarThickness:34}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money(c.raw)}}},scales:{x:{grid:{display:false},ticks:{color:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()}},y:{grid:{color:muted},ticks:{color:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),callback:v=>new Intl.NumberFormat('id-ID',{notation:'compact'}).format(v)}}}}});
}

async function pagePOS(){
  await Promise.all([ensureMaster(),ensureProducts()]); renderPOS();
}
function productVariantsFlat(){ const out=[]; state.products.forEach(p=>p.variants.forEach(v=>out.push({...v,productId:p.id,productName:p.name,brand:p.brand,brandId:p.brandId,category:p.category,categoryId:p.categoryId}))); return out; }
function renderPOS(){
  const all=productVariantsFlat(); const q=state.posSearch.toLowerCase();
  const filtered=all.filter(v=>{
    const hay=[v.productName,v.brand,v.category,v.variantName,v.sku,v.barcode,v.colorName,v.colorCode].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!state.categoryFilter||v.categoryId===state.categoryFilter)&&(!state.brandFilter||v.brandId===state.brandFilter);
  });
  const content=document.getElementById('pageContent');
  content.innerHTML=`<div class="pos-layout"><section class="pos-main"><div class="page-head"><div><h2>Kasir</h2><p>Produk hanya berasal dari data yang sudah diinput manual.</p></div></div><input class="input pos-search" id="posSearch" placeholder="Cari produk, SKU, merek, atau kode warna..." value="${esc(state.posSearch)}"><div class="filter-row"><button class="pill ${!state.categoryFilter?'active':''}" data-cat="">Semua</button>${state.master.categories.map(c=>`<button class="pill ${state.categoryFilter===c.id?'active':''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}<select class="select" id="brandFilter" style="width:180px;height:34px"><option value="">Semua Merek</option>${state.master.brands.map(b=>`<option value="${b.id}" ${state.brandFilter===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>${filtered.length?`<div class="product-grid">${filtered.map(productCard).join('')}</div>`:emptyState('Produk tidak ditemukan',state.products.length?'Coba kata pencarian atau filter lain.':'Belum ada produk. Tambahkan kategori, merek, produk, dan varian secara manual dari halaman Produk.')}</section>${cartMarkup()}</div>${state.cart.length?`<button class="mobile-cart-bar" id="mobileCart"><div><small>${cartCount()} barang</small><strong>${money(cartTotal())}</strong></div><span>Lihat Keranjang</span></button>`:''}`;
  const search=document.getElementById('posSearch'); search.oninput=e=>{state.posSearch=e.target.value; renderPOS(); setTimeout(()=>{const el=document.getElementById('posSearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0);};
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{state.categoryFilter=b.dataset.cat;renderPOS();}); document.getElementById('brandFilter').onchange=e=>{state.brandFilter=e.target.value;renderPOS();};
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add)); bindCart(); document.getElementById('mobileCart')?.addEventListener('click',()=>openMobileCart()); renderIcons();
}
function productCard(v){ const low=v.stock>0&&v.stock<=v.minStock; const cls=v.stock===0?'danger':low?'warning':''; return `<article class="product-card"><div class="brand-name">${esc(v.brand||'')}</div><h4>${esc(v.productName)}</h4><div class="variant">${esc([v.variantName,v.colorCode,v.colorName].filter(Boolean).join(' · ')||v.sku)}</div><div class="price">${money(v.sellPrice)}</div><div class="stock-text ${cls}">${v.stock===0?'Stok Habis':low?'Stok Menipis · '+num(v.stock):num(v.stock)+' tersedia'}</div><button class="btn small ${v.stock>0?'primary':''}" data-add="${v.id}" ${v.stock<=0?'disabled':''}>${v.stock>0?'Tambah':'Habis'}</button></article>`; }
function cartCount(){return state.cart.reduce((a,i)=>a+i.quantity,0)} function cartTotal(){return state.cart.reduce((a,i)=>a+i.sellPrice*i.quantity,0)}
function addCart(id){ const v=productVariantsFlat().find(x=>x.id===id); if(!v||v.stock<=0)return; const item=state.cart.find(x=>x.variantId===id); if(item){ if(item.quantity>=v.stock)return toast('Jumlah sudah mencapai stok yang tersedia.','error'); item.quantity++; } else state.cart.push({variantId:id,productName:v.productName,variantName:v.variantName||v.colorName||v.sku,sku:v.sku,sellPrice:v.sellPrice,quantity:1,stock:v.stock}); renderPOS(); }
function changeQty(id,delta){const i=state.cart.find(x=>x.variantId===id);if(!i)return;i.quantity=Math.max(0,Math.min(i.stock,i.quantity+delta));if(i.quantity===0)state.cart=state.cart.filter(x=>x.variantId!==id);renderPOS();}
function cartMarkup(){ return `<aside class="cart"><div class="cart-head"><strong>Keranjang</strong><span>${cartCount()} barang</span></div><div class="cart-items">${state.cart.length?state.cart.map(i=>`<div class="cart-item"><div class="cart-item-top"><div><h5>${esc(i.productName)}</h5><small>${esc(i.variantName)}</small></div><strong>${money(i.sellPrice*i.quantity)}</strong></div><div class="qty"><button data-dec="${i.variantId}">−</button><strong>${i.quantity}</strong><button data-inc="${i.variantId}">+</button><span style="margin-left:auto;color:var(--muted);font-size:10px">${money(i.sellPrice)} / pcs</span></div></div>`).join(''):emptyState('Keranjang kosong','Tambahkan produk dari daftar di sebelah kiri.')}</div><div class="cart-summary"><div class="total-row"><span>TOTAL</span><strong>${money(cartTotal())}</strong></div><div><div style="font-size:10px;color:var(--muted);margin-bottom:7px">METODE PEMBAYARAN</div><div class="payment-grid"><button class="pay-option ${state.paymentMethod==='CASH'?'active':''}" data-pay="CASH">TUNAI</button><button class="pay-option ${state.paymentMethod==='QRIS'?'active':''}" data-pay="QRIS">QRIS</button></div></div><button class="btn primary large" id="payBtn" ${!state.cart.length||!state.paymentMethod||!navigator.onLine?'disabled':''}>BAYAR · ${money(cartTotal())}</button></div></aside>`; }
function bindCart(){document.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));document.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));document.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{state.paymentMethod=b.dataset.pay;renderPOS();});document.getElementById('payBtn')?.addEventListener('click',openPayment);}
function openMobileCart(){openModal('Keranjang',`${state.cart.map(i=>`<div class="cart-item"><div class="cart-item-top"><div><h5>${esc(i.productName)}</h5><small>${esc(i.variantName)}</small></div><strong>${money(i.sellPrice*i.quantity)}</strong></div></div>`).join('')}<div style="margin:18px 0" class="total-row"><span>TOTAL</span><strong>${money(cartTotal())}</strong></div><div class="payment-grid"><button class="pay-option ${state.paymentMethod==='CASH'?'active':''}" data-mpay="CASH">TUNAI</button><button class="pay-option ${state.paymentMethod==='QRIS'?'active':''}" data-mpay="QRIS">QRIS</button></div>`,`<button class="btn" onclick="window.closeGritzModal()">Kembali</button><button class="btn primary" id="mobilePay" ${!state.paymentMethod?'disabled':''}>Bayar</button>`);document.querySelectorAll('[data-mpay]').forEach(b=>b.onclick=()=>{state.paymentMethod=b.dataset.mpay;closeModal();openMobileCart();});document.getElementById('mobilePay')?.addEventListener('click',()=>{closeModal();openPayment();});}
function openPayment(){ if(state.paymentMethod==='QRIS')openConfirmQRIS();else openCash(); }
function openConfirmQRIS(){openModal('Pembayaran QRIS',`<div style="text-align:center;padding:12px 0"><div style="font:700 34px 'Space Grotesk';margin-bottom:18px">${money(cartTotal())}</div><p style="color:var(--muted);font-size:13px">Pastikan pembayaran QRIS sudah diterima sebelum melanjutkan.</p></div>`,`<button class="btn" onclick="window.closeGritzModal()">Kembali</button><button class="btn primary" id="confirmQris">Pembayaran Sudah Diterima</button>`);document.getElementById('confirmQris').onclick=()=>checkout();}
function openCash(){openModal('Pembayaran Tunai',`<div class="field"><label>Total</label><div style="font:700 34px 'Space Grotesk'">${money(cartTotal())}</div></div><div class="field" style="margin-top:16px"><label>Uang Diterima (opsional untuk menghitung kembalian)</label><input class="input" type="number" min="0" id="cashReceived" placeholder="0"></div><div style="margin-top:16px"><span style="color:var(--muted);font-size:11px">Kembalian</span><div id="changeValue" style="font:600 24px 'Space Grotesk';margin-top:4px">${money(0)}</div></div>`,`<button class="btn" onclick="window.closeGritzModal()">Kembali</button><button class="btn primary" id="confirmCash">Bayar</button>`);const inp=document.getElementById('cashReceived');inp.oninput=()=>document.getElementById('changeValue').textContent=money(Math.max(0,Number(inp.value||0)-cartTotal()));document.getElementById('confirmCash').onclick=checkout;}
async function checkout(){ if(!state.cart.length||!state.paymentMethod)return; const btn=document.querySelector('#confirmQris,#confirmCash'); if(btn){btn.disabled=true;btn.textContent='Memproses...';} try{const sale=await api('sale.create',{requestId:requestId(),paymentMethod:state.paymentMethod,items:state.cart.map(i=>({variantId:i.variantId,quantity:i.quantity}))},state.sessionToken);closeModal();toast('Pembayaran berhasil dicatat.','success');state.cart=[];state.paymentMethod='';await ensureProducts();renderPOS();setTimeout(()=>openModal('Pembayaran Berhasil',`<div style="text-align:center;padding:12px"><div style="font-size:36px;color:var(--success)">✓</div><h3>${money(sale.total)}</h3><p style="color:var(--muted)">${sale.paymentMethod==='CASH'?'Tunai':'QRIS'} · ${esc(sale.id)}</p></div>`,`<button class="btn primary" onclick="window.closeGritzModal()">Selesai</button>`),250);}catch(err){toast(err.message,'error');if(btn){btn.disabled=false;btn.textContent='Coba Lagi';}}}

function salesTable(rows){ if(!rows?.length)return emptyState('Belum ada penjualan','Transaksi yang sudah selesai akan muncul di sini.');return `<div class="table-wrap"><table><thead><tr><th>Transaksi</th><th>Waktu</th><th>Staf</th><th>Barang</th><th>Metode</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>${rows.map(s=>`<tr data-sale="${s.id}" style="cursor:pointer"><td><strong>${esc(s.id)}</strong></td><td>${dt(s.date)}</td><td>${esc(s.staff)}</td><td>${num(s.itemCount)}</td><td>${s.paymentMethod==='CASH'?'Tunai':'QRIS'}</td><td class="num"><strong>${money(s.total)}</strong></td><td>${badge(s.status==='PAID'?'Lunas':'Dibatalkan',s.status==='PAID'?'success':'danger')}</td></tr>`).join('')}</tbody></table></div>`;}
async function pageSales(){state.sales=await api('sale.list',{limit:300},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Penjualan</h2><p>Seluruh transaksi yang sudah dicatat.</p></div></div>${salesTable(state.sales)}`;document.querySelectorAll('[data-sale]').forEach(r=>r.onclick=()=>openSale(r.dataset.sale));}
async function openSale(id){try{const s=await api('sale.detail',{id},state.sessionToken);const body=`<div class="list-row"><span>Transaksi</span><strong>${esc(s.id)}</strong></div><div class="list-row"><span>Waktu</span><strong>${dt(s.date)}</strong></div><div class="list-row"><span>Staf</span><strong>${esc(s.staff)}</strong></div><div class="list-row"><span>Metode</span><strong>${s.paymentMethod==='CASH'?'Tunai':'QRIS'}</strong></div><div style="margin-top:18px">${s.items.map(i=>`<div class="list-row"><div><strong>${esc(i.productName)}</strong><span>${esc(i.variantName||i.sku)} · ${i.quantity} × ${money(i.sellPrice)}</span></div><strong>${money(i.subtotal)}</strong></div>`).join('')}</div><div class="list-row" style="margin-top:16px"><strong>Total</strong><strong style="font:700 24px 'Space Grotesk'">${money(s.total)}</strong></div>${roleOwner()?`<div class="list-row"><span>HPP</span><strong>${money(s.totalCost)}</strong></div><div class="list-row"><span>Laba Kotor</span><strong>${money(s.grossProfit)}</strong></div>`:''}`;openModal('Detail Penjualan',body,`${roleOwner()&&s.status==='PAID'?'<button class="btn danger" id="voidSale">Batalkan Transaksi</button>':''}<button class="btn" onclick="window.closeGritzModal()">Tutup</button>`);document.getElementById('voidSale')?.addEventListener('click',async()=>{if(!confirm('Batalkan transaksi ini dan kembalikan stok?'))return;try{await api('sale.void',{id:s.id},state.sessionToken);closeModal();toast('Transaksi dibatalkan dan stok dikembalikan.','success');pageSales();}catch(err){toast(err.message,'error');}});}catch(err){toast(err.message,'error');}}

async function pageProducts(){await Promise.all([ensureMaster(),ensureProducts(true)]);renderProductsPage();}
function renderProductsPage(){
  const c=document.getElementById('pageContent');
  const rows=[]; state.products.forEach(p=>p.variants.forEach(v=>rows.push({...v,product:p})));
  c.innerHTML=`<div class="page-head"><div><h2>Produk</h2><p>Semua kategori, merek, produk, dan varian wajib dibuat manual sesuai barang yang benar-benar ada di toko.</p></div>${roleOwner()?`<div class="actions"><button class="btn" id="manageCategories">Kategori</button><button class="btn" id="manageBrands">Merek</button><button class="btn primary" id="addProduct">${icon('plus')} Tambah Produk</button></div>`:''}</div>
  ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Produk</th><th>Merek</th><th>Kategori</th><th>Varian</th><th>SKU</th><th class="num">Harga Jual</th>${roleOwner()?'<th class="num">Harga Modal</th>':''}<th>Stok</th><th>Status</th>${roleOwner()?'<th></th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.product.name)}</strong></td><td>${esc(r.product.brand)}</td><td>${esc(r.product.category)}</td><td>${esc(r.variantName||r.colorName||'-')}</td><td>${esc(r.sku)}</td><td class="num">${money(r.sellPrice)}</td>${roleOwner()?`<td class="num">${money(r.costPrice)}</td>`:''}<td>${num(r.stock)}</td><td>${badge(r.product.status==='ACTIVE'?'Aktif':'Nonaktif',r.product.status==='ACTIVE'?'success':'')}</td>${roleOwner()?`<td><button class="btn small" data-edit-product="${r.product.id}">Ubah</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada produk','Buat kategori dan merek terlebih dahulu, lalu tambahkan produk dan variannya secara manual.',roleOwner()?'<button class="btn primary" id="emptyAddProduct">Tambah Produk</button>':'')}`;
  if(roleOwner()){
    document.getElementById('manageCategories').onclick=()=>masterModal('category');
    document.getElementById('manageBrands').onclick=()=>masterModal('brand');
    document.getElementById('addProduct')?.addEventListener('click',openProductModal);
    document.getElementById('emptyAddProduct')?.addEventListener('click',openProductModal);
    document.querySelectorAll('[data-edit-product]').forEach(b=>b.onclick=()=>openProductEditModal(b.dataset.editProduct));
  }
  renderIcons();
}

function masterModal(type){
  const isCat=type==='category'; const list=isCat?state.master.categories:state.master.brands;
  openModal(isCat?'Kategori':'Merek',`${list.length?`<div class="list-clean">${list.map(x=>`<div class="list-row"><strong>${esc(x.name)}</strong><div class="actions"><button class="btn small" data-master-rename="${x.id}">Ubah Nama</button></div></div>`).join('')}</div>`:emptyState(isCat?'Belum ada kategori':'Belum ada merek','Data ini harus diinput manual sesuai barang yang ada di toko.')}<div class="field" style="margin-top:18px"><label>${isCat?'Nama Kategori':'Nama Merek'}</label><input class="input" id="masterName" autocomplete="off"></div>`,`<button class="btn" onclick="window.closeGritzModal()">Tutup</button><button class="btn primary" id="saveMaster">Tambah</button>`);
  document.getElementById('saveMaster').onclick=async()=>{const name=document.getElementById('masterName').value.trim();if(!name)return;try{await api(isCat?'category.create':'brand.create',{name},state.sessionToken);await ensureMaster();closeModal();toast((isCat?'Kategori':'Merek')+' ditambahkan.','success');renderProductsPage();}catch(err){toast(err.message,'error');}};
  document.querySelectorAll('[data-master-rename]').forEach(b=>b.onclick=async()=>{const current=list.find(x=>x.id===b.dataset.masterRename);const name=prompt(`Ubah nama ${isCat?'kategori':'merek'}:`,current?.name||'');if(name==null||!name.trim())return;try{await api(isCat?'category.update':'brand.update',{id:b.dataset.masterRename,name:name.trim()},state.sessionToken);await ensureMaster();closeModal();masterModal(type);toast('Nama berhasil diperbarui.','success');}catch(err){toast(err.message,'error');}});
}

function newVariantBox(list, data=null, existing=false){
  const box=document.createElement('div'); box.className='variant-box';
  box.dataset.variantId=data?.id||'';
  box.innerHTML=`${existing?'':`<button class="icon-btn remove-variant" type="button" aria-label="Hapus varian">${icon('x')}</button>`}<div class="form-grid">
    <div class="field"><label>Nama Varian</label><input class="input" data-v="variantName" value="${esc(data?.variantName||'')}" placeholder="Input manual"></div>
    <div class="field"><label>SKU</label><input class="input" data-v="sku" value="${esc(data?.sku||'')}" placeholder="Wajib unik"></div>
    <div class="field"><label>Barcode (opsional)</label><input class="input" data-v="barcode" value="${esc(data?.barcode||'')}"></div>
    <div class="field"><label>Nama Warna (opsional)</label><input class="input" data-v="colorName" value="${esc(data?.colorName||'')}"></div>
    <div class="field"><label>Kode Warna (opsional)</label><input class="input" data-v="colorCode" value="${esc(data?.colorCode||'')}"></div>
    <div class="field"><label>Harga Modal</label><input class="input" type="number" min="0" data-v="costPrice" value="${esc(data?.costPrice??'')}"></div>
    <div class="field"><label>Harga Jual</label><input class="input" type="number" min="0" data-v="sellPrice" value="${esc(data?.sellPrice??'')}"></div>
    ${existing?`<div class="field"><label>Stok Saat Ini</label><input class="input" value="${esc(data?.stock??0)}" disabled><small style="color:var(--muted)">Ubah stok dari halaman Stok Barang.</small></div>`:`<div class="field"><label>Stok Awal</label><input class="input" type="number" min="0" value="0" data-v="stock"></div>`}
    <div class="field"><label>Stok Minimum</label><input class="input" type="number" min="0" value="${esc(data?.minStock??0)}" data-v="minStock"></div>
  </div>`;
  if(!existing) box.querySelector('.remove-variant').onclick=()=>box.remove();
  list.appendChild(box); renderIcons();
}

function readVariantBoxes(){
  return [...document.querySelectorAll('.variant-box')].map(box=>({
    id:box.dataset.variantId||'',
    ...Object.fromEntries([...box.querySelectorAll('[data-v]')].map(el=>[el.dataset.v,el.value]))
  }));
}

function openProductModal(){
  if(!state.master.categories.length||!state.master.brands.length){toast('Buat kategori dan merek terlebih dahulu.','error');return;}
  openModal('Tambah Produk',`<div class="form-grid"><div class="field"><label>Nama Produk</label><input class="input" id="pName"></div><div class="field"><label>Merek</label><select class="select" id="pBrand"><option value="">Pilih merek</option>${state.master.brands.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Kategori</label><select class="select" id="pCategory"><option value="">Pilih kategori</option>${state.master.categories.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="field full"><label>Deskripsi (opsional)</label><textarea class="textarea" id="pDescription"></textarea></div></div><div class="panel-title" style="margin-top:20px"><h3>Varian</h3><button class="btn small" id="addVariant">${icon('plus')} Tambah Varian</button></div><div id="variantList"></div>`,`<button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="saveProduct">Simpan Produk</button>`,'wide');
  const list=document.getElementById('variantList'); newVariantBox(list);
  document.getElementById('addVariant').onclick=()=>newVariantBox(list);
  document.getElementById('saveProduct').onclick=async()=>{try{await api('product.create',{name:v('pName'),brandId:v('pBrand'),categoryId:v('pCategory'),description:v('pDescription'),variants:readVariantBoxes()},state.sessionToken);closeModal();toast('Produk berhasil ditambahkan.','success');await pageProducts();}catch(err){toast(err.message,'error');}};
  renderIcons();
}

function openProductEditModal(productId){
  const p=state.products.find(x=>x.id===productId); if(!p)return;
  openModal('Ubah Produk',`<div class="form-grid"><div class="field"><label>Nama Produk</label><input class="input" id="pName" value="${esc(p.name)}"></div><div class="field"><label>Merek</label><select class="select" id="pBrand">${state.master.brands.map(x=>`<option value="${x.id}" ${x.id===p.brandId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Kategori</label><select class="select" id="pCategory">${state.master.categories.map(x=>`<option value="${x.id}" ${x.id===p.categoryId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="field full"><label>Deskripsi</label><textarea class="textarea" id="pDescription">${esc(p.description||'')}</textarea></div></div><div class="panel-title" style="margin-top:20px"><h3>Varian</h3><button class="btn small" id="addVariant">${icon('plus')} Tambah Varian</button></div><div id="variantList"></div>`,`<button class="btn" id="toggleProductStatus">${p.status==='ACTIVE'?'Nonaktifkan Produk':'Aktifkan Produk'}</button><button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="saveProduct">Simpan Perubahan</button>`,'wide');
  const list=document.getElementById('variantList'); p.variants.forEach(vv=>newVariantBox(list,vv,true));
  document.getElementById('addVariant').onclick=()=>newVariantBox(list);
  document.getElementById('saveProduct').onclick=async()=>{try{await api('product.update',{id:p.id,name:v('pName'),brandId:v('pBrand'),categoryId:v('pCategory'),description:v('pDescription'),variants:readVariantBoxes()},state.sessionToken);closeModal();toast('Produk diperbarui.','success');await pageProducts();}catch(err){toast(err.message,'error');}};
  document.getElementById('toggleProductStatus').onclick=async()=>{if(!confirm(`${p.status==='ACTIVE'?'Nonaktifkan':'Aktifkan'} produk ini?`))return;try{await api('product.status',{id:p.id,status:p.status==='ACTIVE'?'INACTIVE':'ACTIVE'},state.sessionToken);closeModal();toast('Status produk diperbarui.','success');await pageProducts();}catch(err){toast(err.message,'error');}};
  renderIcons();
}

async function pageInventory(){state.inventory=await api('inventory.list',{},state.sessionToken);const c=document.getElementById('pageContent');const safe=state.inventory.filter(i=>i.stock>i.minStock).length,low=state.inventory.filter(i=>i.stock>0&&i.stock<=i.minStock).length,out=state.inventory.filter(i=>i.stock===0).length;c.innerHTML=`<div class="page-head"><div><h2>Stok Barang</h2><p>Stok berdasarkan data produk dan perubahan yang sudah dicatat.</p></div></div><div class="grid metrics" style="margin-bottom:16px"><div class="metric"><div class="label">Total Varian</div><div class="value">${num(state.inventory.length)}</div></div><div class="metric"><div class="label">Stok Aman</div><div class="value">${num(safe)}</div></div><div class="metric"><div class="label">Stok Menipis</div><div class="value">${num(low)}</div></div><div class="metric"><div class="label">Stok Habis</div><div class="value">${num(out)}</div></div></div>${state.inventory.length?`<div class="table-wrap"><table><thead><tr><th>Produk</th><th>Merek</th><th>Varian</th><th>SKU</th><th>Stok</th><th>Minimum</th><th>Status</th>${roleOwner()?'<th></th>':''}</tr></thead><tbody>${state.inventory.map(i=>`<tr><td><strong>${esc(i.productName)}</strong></td><td>${esc(i.brand)}</td><td>${esc(i.variantName||i.colorName||'-')}</td><td>${esc(i.sku)}</td><td><strong>${num(i.stock)}</strong></td><td>${num(i.minStock)}</td><td>${i.stock===0?badge('Stok Habis','danger'):i.stock<=i.minStock?badge('Stok Menipis','warning'):badge('Tersedia','success')}</td>${roleOwner()?`<td><button class="btn small" data-adjust="${i.id}">Sesuaikan</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada stok','Stok muncul setelah produk dan varian ditambahkan secara manual.')}`;document.querySelectorAll('[data-adjust]').forEach(b=>b.onclick=()=>openAdjust(b.dataset.adjust));}
function openAdjust(id){const i=state.inventory.find(x=>x.id===id);openModal('Sesuaikan Stok',`<div class="list-row"><span>Produk</span><strong>${esc(i.productName)} · ${esc(i.variantName||i.sku)}</strong></div><div class="list-row"><span>Stok Sistem</span><strong>${num(i.stock)}</strong></div><div class="field" style="margin-top:16px"><label>Stok Sebenarnya</label><input class="input" id="actualStock" type="number" min="0" value="${i.stock}"></div><div class="field" style="margin-top:12px"><label>Alasan</label><input class="input" id="adjustReason" placeholder="Input manual, contoh: barang rusak"></div><div class="field" style="margin-top:12px"><label>Catatan (opsional)</label><textarea class="textarea" id="adjustNote"></textarea></div>`,`<button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="saveAdjust">Simpan</button>`);document.getElementById('saveAdjust').onclick=async()=>{try{await api('inventory.adjust',{variantId:id,actualStock:document.getElementById('actualStock').value,reason:document.getElementById('adjustReason').value,note:document.getElementById('adjustNote').value},state.sessionToken);closeModal();toast('Stok berhasil disesuaikan.','success');pageInventory();}catch(err){toast(err.message,'error');}};}

async function pageStock(){const rows=await api('stock.history',{limit:500},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Riwayat Stok</h2><p>Semua perubahan stok yang tercatat oleh sistem.</p></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th>Perubahan</th><th>Sebelum</th><th>Sesudah</th><th>Referensi</th><th>Pengguna</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${dt(r.date)}</td><td><strong>${esc(r.product)}</strong><br><small>${esc(r.variant||r.sku)}</small></td><td>${esc(stockType(r.type))}</td><td class="${r.quantity<0?'':'success'}"><strong>${r.quantity>0?'+':''}${num(r.quantity)}</strong></td><td>${num(r.before)}</td><td>${num(r.after)}</td><td>${esc(r.referenceId||'-')}</td><td>${esc(r.user)}</td></tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada riwayat stok','Perubahan stok akan muncul setelah stok awal, penjualan, restok, atau penyesuaian.')}`;}
function stockType(t){return ({INITIAL:'Stok Awal',SALE:'Penjualan',RESTOCK:'Restok',ADJUSTMENT:'Penyesuaian',VOID_RETURN:'Pembatalan Penjualan'})[t]||t;}

async function pagePurchases(){await Promise.all([ensureMaster(),ensureProducts()]);const rows=await api('purchase.list',{},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Restok</h2><p>Restok hanya dibuat dari pemasok dan produk yang sudah diinput manual.</p></div><button class="btn primary" id="newPurchase">${icon('plus')} Buat Restok</button></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Tanggal</th><th>Pemasok</th><th class="num">Total Modal</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.id)}</strong></td><td>${shortDate(p.date)}</td><td>${esc(p.supplier)}</td><td class="num">${money(p.totalCost)}</td><td>${badge(p.status==='DONE'?'Selesai':p.status==='DRAFT'?'Draf':'Dibatalkan',p.status==='DONE'?'success':p.status==='DRAFT'?'info':'danger')}</td><td>${p.status==='DRAFT'?`<button class="btn small primary" data-complete="${p.id}">Selesaikan</button> <button class="btn small" data-cancel="${p.id}">Batalkan</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada restok','Buat restok saat barang baru dibeli atau diterima dari pemasok.')}`;document.getElementById('newPurchase').onclick=openPurchaseModal;document.querySelectorAll('[data-complete]').forEach(b=>b.onclick=async()=>{if(!confirm('Tandai restok selesai dan tambahkan stok?'))return;try{await api('purchase.complete',{id:b.dataset.complete},state.sessionToken);toast('Restok selesai. Stok telah ditambahkan.','success');pagePurchases();}catch(err){toast(err.message,'error');}});document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('Batalkan restok ini?'))return;try{await api('purchase.cancel',{id:b.dataset.cancel},state.sessionToken);toast('Restok dibatalkan.','success');pagePurchases();}catch(err){toast(err.message,'error');}});renderIcons();}
function openPurchaseModal(){if(!state.master.suppliers.length)return toast('Tambahkan pemasok terlebih dahulu.','error');const variants=productVariantsFlat();if(!variants.length)return toast('Belum ada produk/varian untuk direstok.','error');openModal('Buat Restok',`<div class="form-grid"><div class="field"><label>Pemasok</label><select class="select" id="purSupplier"><option value="">Pilih pemasok</option>${state.master.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Tanggal</label><input class="input" type="date" id="purDate" value="${new Date().toISOString().slice(0,10)}"></div><div class="field full"><label>Catatan (opsional)</label><textarea class="textarea" id="purNote"></textarea></div></div><div class="panel-title" style="margin-top:18px"><h3>Barang</h3><button class="btn small" id="addPurItem">Tambah Baris</button></div><div id="purItems"></div>`,`<button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="savePurchase">Simpan Draf</button>`,'wide');const list=document.getElementById('purItems');const add=()=>{const box=document.createElement('div');box.className='variant-box';box.innerHTML=`<button class="icon-btn remove-variant">${icon('x')}</button><div class="form-grid"><div class="field full"><label>Produk / Varian</label><select class="select" data-p="variantId"><option value="">Pilih barang</option>${variants.map(v=>`<option value="${v.id}">${esc(v.productName)} — ${esc(v.variantName||v.sku)} (${esc(v.sku)})</option>`).join('')}</select></div><div class="field"><label>Jumlah</label><input class="input" type="number" min="1" data-p="quantity"></div><div class="field"><label>Harga Modal / pcs</label><input class="input" type="number" min="0" data-p="costPrice"></div></div>`;box.querySelector('.remove-variant').onclick=()=>box.remove();list.appendChild(box);renderIcons();};add();document.getElementById('addPurItem').onclick=add;document.getElementById('savePurchase').onclick=async()=>{const items=[...document.querySelectorAll('#purItems .variant-box')].map(box=>Object.fromEntries([...box.querySelectorAll('[data-p]')].map(el=>[el.dataset.p,el.value])));try{await api('purchase.create',{supplierId:document.getElementById('purSupplier').value,date:document.getElementById('purDate').value,note:document.getElementById('purNote').value,items},state.sessionToken);closeModal();toast('Draf restok disimpan.','success');pagePurchases();}catch(err){toast(err.message,'error');}};}

async function pageSuppliers(){const rows=await api('supplier.list',{},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Pemasok</h2><p>Semua data pemasok wajib diinput manual.</p></div><button class="btn primary" id="addSupplier">${icon('plus')} Tambah Pemasok</button></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Perusahaan</th><th>Kontak</th><th>WhatsApp</th><th>Email</th><th>Status</th></tr></thead><tbody>${rows.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.company||'-')}</td><td>${esc(s.contactPerson||'-')}</td><td>${esc(s.whatsapp||'-')}</td><td>${esc(s.email||'-')}</td><td>${badge(s.status==='ACTIVE'?'Aktif':'Nonaktif',s.status==='ACTIVE'?'success':'')}</td></tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada pemasok','Tambahkan pemasok sesuai pemasok yang benar-benar digunakan GRITZ SUPPLY.')}`;document.getElementById('addSupplier').onclick=openSupplierModal;renderIcons();}
function openSupplierModal(){openModal('Tambah Pemasok',`<div class="form-grid">${[['sName','Nama Pemasok'],['sCompany','Perusahaan'],['sContact','Nama Kontak'],['sWa','WhatsApp'],['sEmail','Email'],['sIg','Instagram']].map(([id,l])=>`<div class="field"><label>${l}</label><input class="input" id="${id}"></div>`).join('')}<div class="field full"><label>Alamat</label><textarea class="textarea" id="sAddress"></textarea></div><div class="field full"><label>Catatan</label><textarea class="textarea" id="sNote"></textarea></div></div>`,`<button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="saveSupplier">Simpan</button>`);document.getElementById('saveSupplier').onclick=async()=>{try{await api('supplier.create',{name:v('sName'),company:v('sCompany'),contactPerson:v('sContact'),whatsapp:v('sWa'),email:v('sEmail'),instagram:v('sIg'),address:v('sAddress'),note:v('sNote')},state.sessionToken);closeModal();toast('Pemasok ditambahkan.','success');pageSuppliers();}catch(err){toast(err.message,'error');}};}
function v(id){return document.getElementById(id)?.value||'';}

async function pageExpenses(){const rows=await api('expense.list',{limit:500},state.sessionToken);const total=rows.reduce((a,e)=>a+e.amount,0);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Pengeluaran</h2><p>Kategori dan data pengeluaran diinput manual sesuai kondisi toko.</p></div><button class="btn primary" id="addExpense">${icon('plus')} Catat Pengeluaran</button></div><div class="grid metrics" style="margin-bottom:16px"><div class="metric"><div class="label">Total Data</div><div class="value">${num(rows.length)}</div></div><div class="metric"><div class="label">Total Pengeluaran Tercatat</div><div class="value">${money(total)}</div></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Catatan</th><th class="num">Jumlah</th><th>Dicatat Oleh</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${shortDate(e.date)}</td><td>${esc(e.category)}</td><td>${esc(e.note||'-')}</td><td class="num"><strong>${money(e.amount)}</strong></td><td>${esc(e.user)}</td></tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada pengeluaran','Catat pengeluaran aktual toko secara manual.')}`;document.getElementById('addExpense').onclick=openExpenseModal;renderIcons();}
function openExpenseModal(){openModal('Catat Pengeluaran',`<div class="form-grid"><div class="field"><label>Tanggal</label><input class="input" type="date" id="eDate" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Kategori</label><input class="input" id="eCategory" placeholder="Input manual"></div><div class="field"><label>Jumlah</label><input class="input" type="number" min="0" id="eAmount"></div><div class="field full"><label>Catatan</label><textarea class="textarea" id="eNote"></textarea></div></div>`,`<button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="saveExpense">Simpan</button>`);document.getElementById('saveExpense').onclick=async()=>{try{await api('expense.create',{date:v('eDate'),category:v('eCategory'),amount:v('eAmount'),note:v('eNote')},state.sessionToken);closeModal();toast('Pengeluaran dicatat.','success');pageExpenses();}catch(err){toast(err.message,'error');}};}

async function pageAnalytics(){const a=await api('analytics.get',{},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Analitik</h2><p>Analitik hanya dihitung dari data nyata yang sudah tercatat.</p></div></div><div class="grid metrics"><div class="metric"><div class="label">Pendapatan</div><div class="value">${money(a.totals.revenue)}</div></div><div class="metric"><div class="label">Laba Kotor</div><div class="value">${money(a.totals.profit)}</div></div><div class="metric"><div class="label">Transaksi</div><div class="value">${num(a.totals.transactions)}</div></div><div class="metric"><div class="label">Barang Terjual</div><div class="value">${num(a.totals.itemsSold)}</div></div></div><div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:16px"><article class="panel"><div class="panel-title"><h3>Produk Terlaris</h3></div>${rankList(a.topProducts.map(x=>({name:x.name,value:x.qty})))}</article><article class="panel"><div class="panel-title"><h3>Merek Terlaris</h3></div>${rankList(a.topBrands)}</article><article class="panel"><div class="panel-title"><h3>Warna Terlaris</h3></div>${rankList(a.topColors)}</article><article class="panel"><div class="panel-title"><h3>Kategori Terlaris</h3></div>${rankList(a.topCategories)}</article></div>`;}
function rankList(rows){return rows?.length?`<div class="list-clean">${rows.map((r,i)=>`<div class="list-row"><div><strong>${i+1}. ${esc(r.name)}</strong></div><strong>${num(r.value)}</strong></div>`).join('')}</div>`:emptyState('Belum ada data','Analitik akan muncul setelah ada transaksi.');}

async function pageReports(){const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Laporan</h2><p>V1 menyediakan unduhan CSV.</p></div></div><article class="panel"><div class="form-grid"><div class="field"><label>Jenis Laporan</label><select class="select" id="reportType"><option value="sales">Penjualan</option><option value="inventory">Stok</option><option value="stock">Riwayat Stok</option><option value="purchases">Restok</option><option value="expenses">Pengeluaran</option><option value="profit">Laba</option></select></div></div><div class="actions" style="margin-top:16px"><button class="btn primary" id="runReport">Tampilkan</button><button class="btn" id="downloadReport" disabled>Unduh CSV</button></div></article><div id="reportResult" style="margin-top:16px"></div>`;let report=[];document.getElementById('runReport').onclick=async()=>{const result=document.getElementById('reportResult');result.innerHTML=loadingRows(5,4);try{report=await api('report.get',{type:v('reportType')},state.sessionToken);result.innerHTML=genericTable(report);document.getElementById('downloadReport').disabled=!report.length;}catch(err){result.innerHTML=emptyState('Gagal memuat laporan',err.message);}};document.getElementById('downloadReport').onclick=()=>downloadCSV(report,'gritz-'+v('reportType')+'.csv');}
function reportKeyLabel(k){return ({id:'ID',date:'Tanggal',staff:'Staf',itemCount:'Jumlah Barang',paymentMethod:'Metode Pembayaran',total:'Total',status:'Status',totalCost:'HPP',grossProfit:'Laba Kotor',productName:'Produk',brand:'Merek',category:'Kategori',variantName:'Varian',sku:'SKU',stock:'Stok',minStock:'Stok Minimum',sellPrice:'Harga Jual',costPrice:'Harga Modal',type:'Jenis',quantity:'Perubahan',before:'Sebelum',after:'Sesudah',referenceId:'Referensi',user:'Pengguna',supplier:'Pemasok',totalCost:'Total Modal',note:'Catatan',amount:'Jumlah',revenue:'Pendapatan',cogs:'HPP',expense:'Pengeluaran',netEstimate:'Estimasi Laba Bersih'})[k]||k;}
function reportValue(v){if(v==='CASH')return'Tunai';if(v==='QRIS')return'QRIS';if(v==='PAID')return'Lunas';if(v==='VOID')return'Dibatalkan';if(v==='DRAFT')return'Draf';if(v==='DONE')return'Selesai';if(v==='CANCELLED')return'Dibatalkan';return v;}
function genericTable(rows){if(!rows?.length)return emptyState('Belum ada data','Tidak ada data untuk laporan ini.');const keys=Object.keys(rows[0]).filter(k=>typeof rows[0][k]!=='object');return `<div class="table-wrap"><table><thead><tr>${keys.map(k=>`<th>${esc(reportKeyLabel(k))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${esc(reportValue(r[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function downloadCSV(rows,filename){if(!rows?.length)return;const keys=Object.keys(rows[0]).filter(k=>typeof rows[0][k]!=='object');const csv=[[...keys.map(reportKeyLabel)].join(','),...rows.map(r=>keys.map(k=>'"'+String(reportValue(r[k])??'').replaceAll('"','""')+'"').join(','))].join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);}

async function pageUsers(){const rows=await api('user.list',{},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Pengguna</h2><p>Hanya Gmail yang ditambahkan manual di sini yang boleh masuk.</p></div><button class="btn primary" id="addUser">${icon('plus')} Tambah Akses</button></div><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Terakhir Masuk</th><th></th></tr></thead><tbody>${rows.map(u=>`<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td>${u.role==='OWNER'?'Pemilik':'Staf'}</td><td>${badge(u.status==='ACTIVE'?'Aktif':'Nonaktif',u.status==='ACTIVE'?'success':'danger')}</td><td>${dt(u.lastLoginAt)}</td><td>${u.email!==state.user.email?`<button class="btn small" data-user-toggle="${u.userId}" data-status="${u.status==='ACTIVE'?'DISABLED':'ACTIVE'}">${u.status==='ACTIVE'?'Nonaktifkan':'Aktifkan'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;document.getElementById('addUser').onclick=openUserModal;document.querySelectorAll('[data-user-toggle]').forEach(b=>b.onclick=async()=>{try{await api('user.update',{id:b.dataset.userToggle,status:b.dataset.status},state.sessionToken);toast('Akses pengguna diperbarui.','success');pageUsers();}catch(err){toast(err.message,'error');}});renderIcons();}
function openUserModal(){openModal('Tambah Akses',`<div class="form-grid"><div class="field full"><label>Email Google</label><input class="input" id="uEmail" type="email"></div><div class="field"><label>Nama</label><input class="input" id="uName"></div><div class="field"><label>Peran</label><select class="select" id="uRole"><option value="STAFF">Staf</option><option value="OWNER">Pemilik</option></select></div></div>`,`<button class="btn" onclick="window.closeGritzModal()">Batal</button><button class="btn primary" id="saveUser">Tambah Akses</button>`);document.getElementById('saveUser').onclick=async()=>{try{await api('user.create',{email:v('uEmail'),name:v('uName'),role:v('uRole')},state.sessionToken);closeModal();toast('Akses pengguna ditambahkan.','success');pageUsers();}catch(err){toast(err.message,'error');}};}


function activityLabel(code){return ({LOGIN:'Masuk',LOGOUT:'Keluar',CREATE_CATEGORY:'Menambah Kategori',UPDATE_CATEGORY:'Memperbarui Kategori',CREATE_BRAND:'Menambah Merek',UPDATE_BRAND:'Memperbarui Merek',CREATE_SUPPLIER:'Menambah Pemasok',UPDATE_SUPPLIER:'Memperbarui Pemasok',CREATE_PRODUCT:'Menambah Produk',UPDATE_PRODUCT:'Memperbarui Produk',UPDATE_PRODUCT_STATUS:'Mengubah Status Produk',STOCK_ADJUSTMENT:'Menyesuaikan Stok',SALE_CREATE:'Mencatat Penjualan',SALE_VOID:'Membatalkan Penjualan',PURCHASE_CREATE:'Membuat Restok',PURCHASE_COMPLETE:'Menyelesaikan Restok',PURCHASE_CANCEL:'Membatalkan Restok',EXPENSE_CREATE:'Mencatat Pengeluaran',USER_CREATE:'Menambah Pengguna',USER_UPDATE:'Memperbarui Pengguna',SETTINGS_UPDATE:'Memperbarui Pengaturan'})[code]||code;}
function targetLabel(code){return ({USER:'Pengguna',CATEGORY:'Kategori',BRAND:'Merek',SUPPLIER:'Pemasok',PRODUCT:'Produk',VARIANT:'Varian',SALE:'Penjualan',PURCHASE:'Restok',EXPENSE:'Pengeluaran',SETTINGS:'Pengaturan'})[code]||code;}
async function pageActivity(){const rows=await api('activity.list',{limit:500},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Riwayat Aktivitas</h2><p>Aktivitas penting yang dibuat oleh sistem.</p></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Target</th><th>Keterangan</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${dt(r.date)}</td><td>${esc(r.user)}</td><td>${esc(activityLabel(r.action))}</td><td>${esc(targetLabel(r.targetType))} ${esc(r.targetId)}</td><td>${esc(r.description)}</td></tr>`).join('')}</tbody></table></div>`:emptyState('Belum ada aktivitas','Aktivitas sistem akan muncul di sini.')}`;}

async function pageSettings(){const s=await api('settings.get',{},state.sessionToken);const c=document.getElementById('pageContent');c.innerHTML=`<div class="page-head"><div><h2>Pengaturan</h2><p>Data toko wajib diinput manual. Sistem tidak mengarang data profil.</p></div></div><article class="panel"><div class="panel-title"><h3>Profil Toko</h3></div><div class="form-grid"><div class="field"><label>Nama Toko</label><input class="input" id="setName" value="${esc(s.STORE_NAME||'')}"></div><div class="field"><label>Email</label><input class="input" id="setEmail" value="${esc(s.STORE_EMAIL||'')}"></div><div class="field"><label>WhatsApp</label><input class="input" id="setPhone" value="${esc(s.STORE_PHONE||'')}"></div><div class="field"><label>Instagram</label><input class="input" id="setIg" value="${esc(s.STORE_INSTAGRAM||'')}"></div><div class="field full"><label>Alamat</label><textarea class="textarea" id="setAddress">${esc(s.STORE_ADDRESS||'')}</textarea></div></div></article><article class="panel" style="margin-top:16px"><div class="panel-title"><h3>Tampilan</h3></div><div class="actions"><button class="btn ${currentTheme()==='light'?'primary':''}" id="themeLight">Terang</button><button class="btn ${currentTheme()==='dark'?'primary':''}" id="themeDark">Gelap</button></div></article><article class="panel" style="margin-top:16px"><div class="panel-title"><h3>Stok</h3></div><div class="field" style="max-width:320px"><label>Batas Stok Minimum Default</label><input class="input" type="number" id="setMin" value="${esc(s.DEFAULT_MIN_STOCK||'')}"><small style="color:var(--muted)">Hanya nilai default UI. Setiap varian tetap dapat diinput manual.</small></div></article><div class="actions" style="margin-top:16px"><button class="btn primary" id="saveSettings">Simpan Perubahan</button></div>`;document.getElementById('themeLight').onclick=()=>{setTheme('light');pageSettings();};document.getElementById('themeDark').onclick=()=>{setTheme('dark');pageSettings();};document.getElementById('saveSettings').onclick=async()=>{try{await api('settings.update',{STORE_NAME:v('setName'),STORE_EMAIL:v('setEmail'),STORE_PHONE:v('setPhone'),STORE_INSTAGRAM:v('setIg'),STORE_ADDRESS:v('setAddress'),DEFAULT_MIN_STOCK:v('setMin')},state.sessionToken);toast('Pengaturan disimpan.','success');}catch(err){toast(err.message,'error');}};}

function openModal(title,body,footer='',wide=''){modalRoot.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal ${wide==='wide'?'wide':''}"><header class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" id="closeModalBtn">${icon('x')}</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-foot">${footer}</footer>`:''}</section></div>`;document.getElementById('closeModalBtn').onclick=closeModal;document.getElementById('modalBackdrop').onclick=e=>{if(e.target===e.currentTarget)closeModal();};renderIcons();}
function closeModal(){modalRoot.innerHTML='';} window.closeGritzModal=closeModal;

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.getElementById('globalSearch')?.focus();}if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();document.getElementById(state.route==='pos'?'posSearch':'globalSearch')?.focus();}});

window.addEventListener('load',renderIcons);
boot();

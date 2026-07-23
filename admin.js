import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.OSKI_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const money = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cfg.CURRENCY || 'MXN' }).format(Number(n || 0));
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0,60);
const escapeHTML = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const $ = (s,p=document) => p.querySelector(s);
const $$ = (s,p=document) => [...p.querySelectorAll(s)];

let user = null;
let isSuper = false;
let stores = [];
let currentStore = null;
let currentSettings = null;
let products = [];
let customers = [];
let orders = [];
let activeView = 'dashboard';

function setStatus(sel, text) { const el = $(sel); if (el) el.textContent = text || ''; }
function storeUrl(slug=currentStore?.slug) { return `${location.origin}/t/${slug}`; }
function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').showModal(); document.body.classList.add('modal-open'); }
function closeModal() { $('#modal').close(); document.body.classList.remove('modal-open'); }
function currentStoreId() { return currentStore?.id; }

async function checkSession() {
  const { data } = await supabase.auth.getUser();
  user = data.user;
  if (!user) { $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); return; }
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#currentUserBox').innerHTML = `<b>${escapeHTML(user.email)}</b><br><span>Conectado</span>`;
  await bootstrap();
}
async function bootstrap() {
  const { data: superData } = await supabase.rpc('is_platform_admin');
  isSuper = !!superData;
  $('#superNavBtn').classList.toggle('hidden', !isSuper);
  await loadStores();
  await loadCurrentStoreData();
  showView(isSuper && new URLSearchParams(location.search).get('super') ? 'super' : 'dashboard');
}
async function loadStores() {
  let data = [];
  let error = null;
  if (isSuper) {
    const res = await supabase.from('stores').select('*').order('created_at', { ascending:false });
    data = res.data; error = res.error;
  } else {
    const res = await supabase.from('store_members').select('stores(*)').eq('status','active');
    error = res.error;
    data = (res.data || []).map(row => row.stores).filter(Boolean);
  }
  if (error) { alert(error.message); return; }
  stores = data || [];
  if (!stores.length && isSuper) activeView = 'super';
  currentStore = stores.find(s => s.id === localStorage.getItem('oski_current_store')) || stores[0] || null;
  renderStoreSwitcher();
}
function renderStoreSwitcher() {
  const sw = $('#storeSwitcher');
  sw.innerHTML = stores.map(s => `<option value="${s.id}" ${currentStore?.id===s.id?'selected':''}>${escapeHTML(s.name)}</option>`).join('');
  sw.classList.toggle('hidden', !stores.length);
  if (currentStore) {
    localStorage.setItem('oski_current_store', currentStore.id);
    $('#sideTitle').textContent = currentStore.name;
    $('#sideSubtitle').textContent = `${currentStore.slug} · ${isSuper ? 'Super admin' : 'Tienda'}`;
    $('#openCatalogLink').href = storeUrl(currentStore.slug);
  } else {
    $('#sideTitle').textContent = 'OSKI Store';
    $('#sideSubtitle').textContent = 'Sin tienda';
    $('#openCatalogLink').href = '#';
  }
}
async function loadCurrentStoreData() {
  if (!currentStore) return;
  const [settingsRes, productsRes, customersRes, ordersRes] = await Promise.all([
    supabase.from('store_settings').select('*').eq('store_id', currentStore.id).maybeSingle(),
    supabase.from('products').select('*, product_images(*), product_variants(*)').eq('store_id', currentStore.id).order('created_at', { ascending:false }),
    supabase.from('customers').select('*').eq('store_id', currentStore.id).order('created_at', { ascending:false }),
    supabase.from('orders').select('*, order_items(*), payments(*)').eq('store_id', currentStore.id).order('created_at', { ascending:false })
  ]);
  currentSettings = settingsRes.data || { store_id: currentStore.id, brand_name: currentStore.name, theme:'minimal', primary_color:'#0b0b0d', bg_color:'#f8f7f3', text_color:'#111827' };
  products = productsRes.data || [];
  customers = customersRes.data || [];
  orders = ordersRes.data || [];
}
function titleFor(view) {
  const map = {
    dashboard: ['ADMIN', 'Resumen', 'Vista general de ventas, stock y actividad.'],
    products: ['INVENTARIO', 'Productos', 'Lista limpia y registro en ventana.'],
    customers: ['CLIENTES', 'Clientes', 'Directorio y cuentas por cobrar.'],
    orders: ['PEDIDOS', 'Pedidos', 'Control de pedidos y pagos.'],
    settings: ['WHITE LABEL', 'Configuración de tienda', 'Logo, redes, diseño, colores y novedades.'],
    super: ['MASTER', 'Super Admin', 'Crea tiendas, asigna usuarios y administra membresías.']
  };
  return map[view] || map.dashboard;
}
function showView(view) {
  activeView = view;
  $$('.view-section').forEach(s => s.classList.add('hidden'));
  $(`#${view}View`)?.classList.remove('hidden');
  $$('.side-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const [ey, title, desc] = titleFor(view);
  $('#viewEyebrow').textContent = ey;
  $('#viewTitle').textContent = title;
  $('#viewDescription').textContent = desc;
  renderActiveView();
}
function renderActiveView() {
  if (activeView === 'dashboard') renderDashboard();
  if (activeView === 'products') renderProducts();
  if (activeView === 'customers') renderCustomers();
  if (activeView === 'orders') renderOrders();
  if (activeView === 'settings') renderSettings();
  if (activeView === 'super') renderSuper();
}
function productStock(p) { return (p.product_variants || []).reduce((s,v)=>s+Number(v.stock||0),0); }
function dashboardCards() {
  const sold = orders.filter(o=>o.status !== 'Cancelado').reduce((s,o)=>s+Number(o.total||0),0);
  const pending = orders.reduce((s,o)=>s+Number(o.balance||0),0);
  const stock = products.reduce((s,p)=>s+productStock(p),0);
  return [
    ['Productos', products.length, 'Registrados'],
    ['Stock', stock, 'Piezas disponibles'],
    ['Clientes', customers.length, 'Contactos'],
    ['Pedidos', orders.length, 'Historial'],
    ['Ventas', money(sold), 'No canceladas'],
    ['Saldo pendiente', money(pending), 'Por cobrar']
  ];
}
function renderDashboard() {
  $('#dashboardView').innerHTML = !currentStore ? emptyNoStore() : `<div class="stats-grid">${dashboardCards().map(([a,b,c])=>`<article class="stat-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></article>`).join('')}</div><div class="panel-grid"><section class="panel-card"><div class="panel-head"><h3>Pedidos recientes</h3><button class="btn ghost small" data-view-jump="orders">Ver</button></div>${orders.slice(0,5).map(o=>`<div class="list-row"><div><b>${escapeHTML(o.folio || 'Pedido')}</b><span>${escapeHTML(o.customer_name || 'Cliente')} · ${escapeHTML(o.status || '')}</span></div><strong>${money(o.total)}</strong></div>`).join('') || '<p class="muted">Sin pedidos.</p>'}</section><section class="panel-card"><div class="panel-head"><h3>Productos recientes</h3><button class="btn ghost small" data-view-jump="products">Ver</button></div>${products.slice(0,5).map(p=>`<div class="list-row"><div><b>${escapeHTML(p.name)}</b><span>${escapeHTML(p.category||'')} · Stock ${productStock(p)}</span></div><strong>${money(p.price)}</strong></div>`).join('') || '<p class="muted">Sin productos.</p>'}</section></div>`;
}
function emptyNoStore() { return `<div class="empty"><b>No hay tienda seleccionada.</b><br>${isSuper ? 'Crea una tienda desde Super Admin.' : 'Pide a Oscar que te asigne una tienda.'}</div>`; }
function renderProducts() {
  if (!currentStore) { $('#productsView').innerHTML = emptyNoStore(); return; }
  $('#productsView').innerHTML = `<div class="section-actions"><input id="productSearch" type="search" placeholder="Buscar producto..."><button class="btn primary" data-new-product>Nuevo producto</button></div><div class="cards-list">${products.map(productRow).join('') || '<div class="empty">Sin productos.</div>'}</div>`;
  $('#productSearch').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    $('.cards-list', $('#productsView')).innerHTML = products.filter(p=>[p.name,p.sku,p.category,p.status].join(' ').toLowerCase().includes(q)).map(productRow).join('') || '<div class="empty">Sin resultados.</div>';
  });
}
function firstImage(p) { return (p.product_images || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0]?.url || ''; }
function productRow(p) {
  const img = firstImage(p);
  return `<article class="admin-card-row"><div class="thumb">${img?`<img src="${img}" alt="${escapeHTML(p.name)}">`:'—'}</div><div class="grow"><b>${escapeHTML(p.name)}</b><span>${escapeHTML(p.sku||'')} · ${escapeHTML(p.category||'Sin categoría')} · Stock ${productStock(p)}</span></div><strong>${money(p.price)}</strong><span class="badge">${escapeHTML(p.status||'Disponible')}</span><button class="btn ghost small" data-edit-product="${p.id}">Editar</button></article>`;
}
function productForm(p={}) {
  const imgs = (p.product_images || []).map(i=>i.url).join('\n');
  const vars = (p.product_variants || []).map(v=>[v.size,v.color,v.stock].filter(x=>x!==undefined).join(' / ')).join('\n');
  return `<form id="productForm" class="modal-form two-col">
    <input type="hidden" id="productId" value="${p.id||''}">
    <label>Nombre<input id="pName" required value="${escapeHTML(p.name||'')}"></label>
    <label>SKU<input id="pSku" value="${escapeHTML(p.sku||'')}"></label>
    <label>Categoría<input id="pCategory" value="${escapeHTML(p.category||'')}"></label>
    <label>Proveedor<input id="pSupplier" value="${escapeHTML(p.supplier||'')}"></label>
    <label>Costo<input id="pCost" type="number" step="0.01" value="${p.cost||0}"></label>
    <label>Precio<input id="pPrice" type="number" step="0.01" value="${p.price||0}"></label>
    <label>Estado<select id="pStatus"><option ${p.status==='Disponible'?'selected':''}>Disponible</option><option ${p.status==='Oculto'?'selected':''}>Oculto</option><option ${p.status==='Vendido'?'selected':''}>Vendido</option></select></label>
    <label class="wide">Descripción<textarea id="pDescription">${escapeHTML(p.description||'')}</textarea></label>
    <label class="wide">URLs de imágenes, una por línea<textarea id="pImages" placeholder="https://...">${escapeHTML(imgs)}</textarea></label>
    <label class="wide">Variantes, una por línea: talla / color / stock<textarea id="pVariants" placeholder="M / Negro / 1">${escapeHTML(vars)}</textarea></label>
    <div class="modal-actions wide"><button class="btn ghost" type="button" data-close-modal>Cancelar</button><button class="btn primary" type="submit">Guardar producto</button></div>
  </form>`;
}
async function saveProductFromForm() {
  const id = $('#productId').value || null;
  const row = { store_id: currentStore.id, name: $('#pName').value.trim(), sku: $('#pSku').value.trim(), category: $('#pCategory').value.trim(), supplier: $('#pSupplier').value.trim(), cost: Number($('#pCost').value||0), price: Number($('#pPrice').value||0), status: $('#pStatus').value, description: $('#pDescription').value.trim() };
  const { data, error } = id ? await supabase.from('products').update(row).eq('id', id).select().single() : await supabase.from('products').insert(row).select().single();
  if (error) throw error;
  const productId = data.id;
  await supabase.from('product_images').delete().eq('product_id', productId);
  const imageRows = $('#pImages').value.split('\n').map(x=>x.trim()).filter(Boolean).map((url,i)=>({ store_id: currentStore.id, product_id: productId, url, sort_order:i }));
  if (imageRows.length) await supabase.from('product_images').insert(imageRows);
  await supabase.from('product_variants').delete().eq('product_id', productId);
  const variantRows = $('#pVariants').value.split('\n').map((line,i)=>{
    const [size='', color='', stock='0'] = line.split('/').map(x=>x.trim());
    if (!size && !color) return null;
    return { store_id: currentStore.id, product_id: productId, size, color, stock:Number(stock||0), sort_order:i };
  }).filter(Boolean);
  if (variantRows.length) await supabase.from('product_variants').insert(variantRows);
}
function renderCustomers() {
  if (!currentStore) { $('#customersView').innerHTML = emptyNoStore(); return; }
  $('#customersView').innerHTML = `<div class="section-actions"><input id="customerSearch" type="search" placeholder="Buscar cliente..."><button class="btn primary" data-new-customer>Nuevo cliente</button></div><div class="cards-list">${customers.map(customerRow).join('') || '<div class="empty">Sin clientes.</div>'}</div>`;
  $('#customerSearch').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    $('.cards-list', $('#customersView')).innerHTML = customers.filter(c=>[c.name,c.phone,c.instagram,c.notes].join(' ').toLowerCase().includes(q)).map(customerRow).join('') || '<div class="empty">Sin resultados.</div>';
  });
}
function customerRow(c) {
  const initial = (c.name||'?').slice(0,1).toUpperCase();
  return `<article class="admin-card-row"><div class="avatar">${escapeHTML(initial)}</div><div class="grow"><b>${escapeHTML(c.name)}</b><span>${escapeHTML(c.phone||'Sin teléfono')} · ${escapeHTML(c.instagram||'Sin red')}</span></div><a class="btn ghost small" href="https://wa.me/${escapeHTML(c.phone||'')}" target="_blank">WhatsApp</a><button class="btn ghost small" data-edit-customer="${c.id}">Editar</button></article>`;
}
function customerForm(c={}) {
  return `<form id="customerForm" class="modal-form two-col">
    <input type="hidden" id="customerId" value="${c.id||''}">
    <label>Nombre<input id="cName" required value="${escapeHTML(c.name||'')}"></label>
    <label>WhatsApp<input id="cPhone" value="${escapeHTML(c.phone||'')}"></label>
    <label>Instagram / red<input id="cInstagram" value="${escapeHTML(c.instagram||'')}"></label>
    <label>Email<input id="cEmail" type="email" value="${escapeHTML(c.email||'')}"></label>
    <label class="wide">Dirección / entrega<textarea id="cAddress">${escapeHTML(c.address||'')}</textarea></label>
    <label class="wide">Notas<textarea id="cNotes">${escapeHTML(c.notes||'')}</textarea></label>
    <div class="modal-actions wide"><button class="btn ghost" type="button" data-close-modal>Cancelar</button><button class="btn primary" type="submit">Guardar cliente</button></div>
  </form>`;
}
async function saveCustomerFromForm() {
  const id = $('#customerId').value || null;
  const row = { store_id: currentStore.id, name: $('#cName').value.trim(), phone: $('#cPhone').value.trim(), instagram: $('#cInstagram').value.trim(), email: $('#cEmail').value.trim(), address: $('#cAddress').value.trim(), notes: $('#cNotes').value.trim() };
  const { error } = id ? await supabase.from('customers').update(row).eq('id', id) : await supabase.from('customers').insert(row);
  if (error) throw error;
}
function renderOrders() {
  if (!currentStore) { $('#ordersView').innerHTML = emptyNoStore(); return; }
  $('#ordersView').innerHTML = `<div class="section-actions"><button class="btn primary" data-new-order>Nuevo pedido</button></div><div class="cards-list">${orders.map(orderRow).join('') || '<div class="empty">Sin pedidos.</div>'}</div>`;
}
function orderRow(o) {
  return `<article class="admin-card-row"><div class="grow"><b>${escapeHTML(o.folio || 'Pedido')}</b><span>${escapeHTML(o.customer_name||'Cliente')} · ${escapeHTML(o.status||'Pendiente')}</span></div><strong>${money(o.total)}</strong><span class="badge danger">Saldo ${money(o.balance)}</span><button class="btn ghost small" data-edit-order="${o.id}">Editar</button></article>`;
}
function orderForm(o={}) {
  return `<form id="orderForm" class="modal-form two-col">
    <input type="hidden" id="orderId" value="${o.id||''}">
    <label>Cliente<input id="oCustomerName" list="customersList" required value="${escapeHTML(o.customer_name||'')}"><datalist id="customersList">${customers.map(c=>`<option value="${escapeHTML(c.name)}">${escapeHTML(c.phone||'')}</option>`).join('')}</datalist></label>
    <label>Teléfono<input id="oPhone" value="${escapeHTML(o.customer_phone||'')}"></label>
    <label>Total<input id="oTotal" type="number" step="0.01" value="${o.total||0}"></label>
    <label>Abonado<input id="oPaid" type="number" step="0.01" value="${o.paid||0}"></label>
    <label>Estado<select id="oStatus"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='Apartado'?'selected':''}>Apartado</option><option ${o.status==='Entregado'?'selected':''}>Entregado</option><option ${o.status==='Cancelado'?'selected':''}>Cancelado</option></select></label>
    <label class="wide">Notas<textarea id="oNotes">${escapeHTML(o.notes||'')}</textarea></label>
    <div class="modal-actions wide"><button class="btn ghost" type="button" data-close-modal>Cancelar</button><button class="btn primary" type="submit">Guardar pedido</button></div>
  </form>`;
}
async function saveOrderFromForm() {
  const id = $('#orderId').value || null;
  const total = Number($('#oTotal').value || 0);
  const paid = Number($('#oPaid').value || 0);
  const row = { store_id: currentStore.id, customer_name: $('#oCustomerName').value.trim(), customer_phone: $('#oPhone').value.trim(), total, paid, balance: Math.max(0,total-paid), status: $('#oStatus').value, notes: $('#oNotes').value.trim() };
  const { error } = id ? await supabase.from('orders').update(row).eq('id', id) : await supabase.from('orders').insert(row);
  if (error) throw error;
}
function renderSettings() {
  if (!currentStore) { $('#settingsView').innerHTML = emptyNoStore(); return; }
  $('#settingsView').innerHTML = `<form id="settingsForm" class="settings-grid">
    <section class="panel-card"><h3>Marca y redes</h3><label>Nombre de tienda<input id="sBrand" value="${escapeHTML(currentSettings.brand_name||currentStore.name)}"></label><label>Logo URL<input id="sLogo" value="${escapeHTML(currentSettings.logo_url||'')}" placeholder="https://..."></label><label>WhatsApp<input id="sWhatsapp" value="${escapeHTML(currentSettings.whatsapp||'')}"></label><label>Instagram<input id="sInstagram" value="${escapeHTML(currentSettings.instagram_url||'')}"></label><label>TikTok<input id="sTiktok" value="${escapeHTML(currentSettings.tiktok_url||'')}"></label><label>Facebook<input id="sFacebook" value="${escapeHTML(currentSettings.facebook_url||'')}"></label></section>
    <section class="panel-card"><h3>Diseño</h3><label>Tema<select id="sTheme"><option value="minimal">Minimal Streetwear</option><option value="boutique">Boutique Clean</option><option value="drop">Drop Catalog</option><option value="market">Market Grid</option><option value="editorial">Editorial Simple</option></select></label><label>Color principal<input id="sPrimary" type="color" value="${escapeHTML(currentSettings.primary_color||'#0b0b0d')}"></label><label>Fondo<input id="sBg" type="color" value="${escapeHTML(currentSettings.bg_color||'#f8f7f3')}"></label><label>Texto<input id="sText" type="color" value="${escapeHTML(currentSettings.text_color||'#111827')}"></label><label class="check"><input id="sNews" type="checkbox" ${currentSettings.show_new_arrivals?'checked':''}> Mostrar novedades</label><label>Título novedades<input id="sNewsTitle" value="${escapeHTML(currentSettings.new_arrivals_title||'Novedades')}"></label><div class="modal-actions"><button class="btn ghost" id="resetThemeColors" type="button">Restablecer colores</button><button class="btn primary" type="submit">Guardar tienda</button></div></section>
  </form>`;
  $('#sTheme').value = currentSettings.theme || 'minimal';
}
const themeColors = { minimal:['#0b0b0d','#f8f7f3','#111827'], boutique:['#6f4e37','#fffaf3','#2b211a'], drop:['#111827','#ffffff','#111827'], market:['#0f766e','#f3faf8','#10201d'], editorial:['#7c2d12','#f7f1ea','#1f1712'] };
async function saveSettings() {
  const row = { store_id: currentStore.id, brand_name: $('#sBrand').value.trim(), logo_url: $('#sLogo').value.trim(), whatsapp: $('#sWhatsapp').value.trim(), instagram_url: $('#sInstagram').value.trim(), tiktok_url: $('#sTiktok').value.trim(), facebook_url: $('#sFacebook').value.trim(), theme: $('#sTheme').value, primary_color: $('#sPrimary').value, bg_color: $('#sBg').value, text_color: $('#sText').value, show_new_arrivals: $('#sNews').checked, new_arrivals_title: $('#sNewsTitle').value.trim() || 'Novedades' };
  const { error } = await supabase.from('store_settings').upsert(row, { onConflict:'store_id' });
  if (error) throw error;
}
function renderSuper() {
  if (!isSuper) { $('#superView').innerHTML = '<div class="empty">Solo super usuario.</div>'; return; }
  $('#superView').innerHTML = `<div class="panel-grid"><section class="panel-card"><h3>Crear tienda</h3><form id="createStoreForm" class="stack-form"><label>Nombre<input id="newStoreName" required placeholder="Tienda de Ana"></label><label>Slug<input id="newStoreSlug" placeholder="tienda-ana"></label><label>Email dueño<input id="newOwnerEmail" type="email" required placeholder="cliente@email.com"></label><label>Plan<select id="newPlan"><option>Básico</option><option>Pro</option><option>Full</option></select></label><button class="btn primary" type="submit">Crear tienda</button></form></section><section class="panel-card"><div class="panel-head"><h3>Tiendas</h3><span class="badge">${stores.length}</span></div><div class="cards-list">${stores.map(s=>`<article class="admin-card-row"><div class="grow"><b>${escapeHTML(s.name)}</b><span>${escapeHTML(s.slug)} · ${escapeHTML(s.owner_email||'sin dueño')} · ${escapeHTML(s.status)}</span></div><a class="btn ghost small" href="${storeUrl(s.slug)}" target="_blank">Catálogo</a><button class="btn ghost small" data-select-store="${s.id}">Admin</button></article>`).join('') || '<p class="muted">Sin tiendas.</p>'}</div></section></div>`;
}
async function createStoreFromForm() {
  const name = $('#newStoreName').value.trim();
  const slug = slugify($('#newStoreSlug').value.trim() || name);
  const owner = $('#newOwnerEmail').value.trim().toLowerCase();
  const { data: store, error } = await supabase.from('stores').insert({ name, slug, owner_email: owner, plan: $('#newPlan').value, status:'active' }).select().single();
  if (error) throw error;
  await supabase.from('store_settings').insert({ store_id: store.id, brand_name: name, theme:'minimal', primary_color:'#0b0b0d', bg_color:'#f8f7f3', text_color:'#111827' });
  await supabase.from('store_members').insert({ store_id: store.id, email: owner, role:'owner', status:'active' });
}
async function reloadAll() { await loadStores(); await loadCurrentStoreData(); renderActiveView(); }

$('#loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  setStatus('#loginStatus','Entrando...');
  const { error } = await supabase.auth.signInWithPassword({ email: $('#loginEmail').value.trim().toLowerCase(), password: $('#loginPassword').value });
  if (error) { setStatus('#loginStatus', error.message); return; }
  setStatus('#loginStatus','');
  await checkSession();
});
$('#logoutBtn').addEventListener('click', async ()=>{ await supabase.auth.signOut(); location.reload(); });
$('#refreshBtn').addEventListener('click', reloadAll);
$('#storeSwitcher').addEventListener('change', async (e)=>{ currentStore = stores.find(s=>s.id===e.target.value); renderStoreSwitcher(); await loadCurrentStoreData(); renderActiveView(); });
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e)=>{ if (e.target === $('#modal')) closeModal(); });

document.addEventListener('click', async (e)=>{
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) showView(viewBtn.dataset.view);
  const jump = e.target.closest('[data-view-jump]')?.dataset.viewJump;
  if (jump) showView(jump);
  if (e.target.closest('[data-close-modal]')) closeModal();
  if (e.target.closest('[data-new-product]')) openModal('Nuevo producto', productForm());
  const ep = e.target.closest('[data-edit-product]')?.dataset.editProduct;
  if (ep) openModal('Editar producto', productForm(products.find(p=>p.id===ep)));
  if (e.target.closest('[data-new-customer]')) openModal('Nuevo cliente', customerForm());
  const ec = e.target.closest('[data-edit-customer]')?.dataset.editCustomer;
  if (ec) openModal('Editar cliente', customerForm(customers.find(c=>c.id===ec)));
  if (e.target.closest('[data-new-order]')) openModal('Nuevo pedido', orderForm());
  const eo = e.target.closest('[data-edit-order]')?.dataset.editOrder;
  if (eo) openModal('Editar pedido', orderForm(orders.find(o=>o.id===eo)));
  const ss = e.target.closest('[data-select-store]')?.dataset.selectStore;
  if (ss) { currentStore = stores.find(s=>s.id===ss); renderStoreSwitcher(); await loadCurrentStoreData(); showView('dashboard'); }
  if (e.target.closest('#resetThemeColors')) { const [p,b,t] = themeColors[$('#sTheme').value] || themeColors.minimal; $('#sPrimary').value=p; $('#sBg').value=b; $('#sText').value=t; }
});

document.addEventListener('submit', async (e)=>{
  if (e.target.id === 'productForm') { e.preventDefault(); await saveProductFromForm(); closeModal(); await reloadAll(); }
  if (e.target.id === 'customerForm') { e.preventDefault(); await saveCustomerFromForm(); closeModal(); await reloadAll(); }
  if (e.target.id === 'orderForm') { e.preventDefault(); await saveOrderFromForm(); closeModal(); await reloadAll(); }
  if (e.target.id === 'settingsForm') { e.preventDefault(); await saveSettings(); await reloadAll(); alert('Tienda guardada.'); }
  if (e.target.id === 'createStoreForm') { e.preventDefault(); await createStoreFromForm(); await reloadAll(); showView('super'); }
});

supabase.auth.onAuthStateChange(() => checkSession());
checkSession();

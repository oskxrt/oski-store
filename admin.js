import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.OSKI_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const money = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cfg.CURRENCY || 'MXN' }).format(Number(n || 0));
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0,60);
const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
let catalogOrders = [];
let activeView = 'dashboard';

function setStatus(sel, text) { const el = $(sel); if (el) el.textContent = text || ''; }
function storeUrl(slug=currentStore?.slug) { return `${location.origin}/t/${slug}`; }
function currentStoreId() { return currentStore?.id; }
function todayISO() { return new Date().toISOString().slice(0,10); }
function nowLocalText(dateValue=new Date()) { return new Date(dateValue).toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' }); }
function dateOnly(value) { return value ? String(value).slice(0,10) : ''; }
function newFolio() { return `OSKI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; }
function openModal(title, html, wide=false) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.toggle('modal-wide', !!wide);
  $('#modal').showModal();
  document.body.classList.add('modal-open');
}
function closeModal() {
  if ($('#modal').open) $('#modal').close();
  document.body.classList.remove('modal-open');
}
function firstImage(p) { return (p.product_images || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0]?.url || ''; }
function productStock(p) { return (p.product_variants || []).reduce((s,v)=>s+Number(v.stock||0),0); }
function productById(id) { return products.find(p=>p.id===id); }
function variantLabel(v) { return [v?.size, v?.color].filter(Boolean).join(' / ') || 'Variante'; }
function orderItems(o) { return o.order_items || []; }
function orderPayments(o) { return o.payments || []; }
function orderSubtotal(o) { return orderItems(o).reduce((s,i)=>s+Number(i.line_total||0),0) || Number(o.total||0) + Number(o.discount||0); }
function orderPaid(o) { return orderPayments(o).reduce((s,p)=>s+Number(p.amount||0),0) || Number(o.paid||0); }
function orderBalance(o) { return Math.max(0, Number(o.total||0) - orderPaid(o)); }
function customerStats(customer) {
  const related = orders.filter(o => (o.customer_id && o.customer_id === customer.id) || normalize(o.customer_phone) === normalize(customer.phone) || normalize(o.customer_name) === normalize(customer.name));
  const sold = related.filter(o=>o.status !== 'Cancelado').reduce((s,o)=>s+Number(o.total||0),0);
  const balance = related.reduce((s,o)=>s+orderBalance(o),0);
  return { orders: related.length, sold, balance, last: related[0]?.created_at || '' };
}

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
  showView(isSuper && new URLSearchParams(location.search).get('super') ? 'super' : activeView || 'dashboard');
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
  const [settingsRes, productsRes, customersRes, ordersRes, catalogOrdersRes] = await Promise.all([
    supabase.from('store_settings').select('*').eq('store_id', currentStore.id).maybeSingle(),
    supabase.from('products').select('*, product_images(*), product_variants(*)').eq('store_id', currentStore.id).order('created_at', { ascending:false }),
    supabase.from('customers').select('*').eq('store_id', currentStore.id).order('created_at', { ascending:false }),
    supabase.from('orders').select('*, order_items(*), payments(*)').eq('store_id', currentStore.id).order('created_at', { ascending:false }),
    supabase.from('catalog_orders').select('*, catalog_order_items(*)').eq('store_id', currentStore.id).order('created_at', { ascending:false })
  ]);
  if (settingsRes.error) console.warn(settingsRes.error);
  if (productsRes.error) console.warn(productsRes.error);
  if (customersRes.error) console.warn(customersRes.error);
  if (ordersRes.error) console.warn(ordersRes.error);
  if (catalogOrdersRes.error) console.warn(catalogOrdersRes.error);
  currentSettings = settingsRes.data || { store_id: currentStore.id, brand_name: currentStore.name, theme:'minimal', primary_color:'#0b0b0d', bg_color:'#f8f7f3', text_color:'#111827' };
  products = productsRes.data || [];
  customers = customersRes.data || [];
  orders = (ordersRes.data || []).map(o => ({...o, order_items: o.order_items || [], payments: o.payments || []}));
  catalogOrders = catalogOrdersRes.data || [];
}
function titleFor(view) {
  const map = {
    dashboard: ['ADMIN', 'Resumen', 'Vista general de ventas, stock y actividad.'],
    products: ['INVENTARIO', 'Productos', 'Lista limpia y registro en ventana.'],
    customers: ['CLIENTES', 'Clientes', 'Directorio, WhatsApp y cuentas por cobrar.'],
    orders: ['PEDIDOS', 'Pedidos', 'Productos vendidos, abonos, recibos y WhatsApp.'],
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
function emptyNoStore() { return `<div class="empty"><b>No hay tienda seleccionada.</b><br>${isSuper ? 'Crea una tienda desde Super Admin.' : 'Pide a Oscar que te asigne una tienda.'}</div>`; }
function dashboardCards() {
  const sold = orders.filter(o=>o.status !== 'Cancelado').reduce((s,o)=>s+Number(o.total||0),0);
  const paid = orders.reduce((s,o)=>s+orderPaid(o),0);
  const pending = orders.reduce((s,o)=>s+orderBalance(o),0);
  const stock = products.reduce((s,p)=>s+productStock(p),0);
  return [
    ['Productos', products.length, 'Registrados'],
    ['Stock', stock, 'Piezas disponibles'],
    ['Clientes', customers.length, 'Contactos'],
    ['Pedidos', orders.length, 'Historial'],
    ['Ventas', money(sold), 'No canceladas'],
    ['Abonos', money(paid), 'Cobrado'],
    ['Saldo pendiente', money(pending), 'Por cobrar'],
    ['Web', catalogOrders.filter(o=>o.status==='Nuevo').length, 'Pedidos nuevos']
  ];
}
function renderDashboard() {
  $('#dashboardView').innerHTML = !currentStore ? emptyNoStore() : `<div class="stats-grid stats-grid-wide">${dashboardCards().map(([a,b,c])=>`<article class="stat-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></article>`).join('')}</div><div class="panel-grid"><section class="panel-card"><div class="panel-head"><h3>Pedidos recientes</h3><button class="btn ghost small" data-view-jump="orders">Ver</button></div>${orders.slice(0,5).map(o=>`<div class="list-row"><div><b>${escapeHTML(o.folio || 'Pedido')}</b><span>${escapeHTML(o.customer_name || 'Cliente')} · ${escapeHTML(o.status || '')} · saldo ${money(orderBalance(o))}</span></div><strong>${money(o.total)}</strong></div>`).join('') || '<p class="muted">Sin pedidos.</p>'}</section><section class="panel-card"><div class="panel-head"><h3>Productos recientes</h3><button class="btn ghost small" data-view-jump="products">Ver</button></div>${products.slice(0,5).map(p=>`<div class="list-row"><div><b>${escapeHTML(p.name)}</b><span>${escapeHTML(p.category||'')} · Stock ${productStock(p)}</span></div><strong>${money(p.price)}</strong></div>`).join('') || '<p class="muted">Sin productos.</p>'}</section></div>`;
}

function renderProducts() {
  if (!currentStore) { $('#productsView').innerHTML = emptyNoStore(); return; }
  $('#productsView').innerHTML = `<div class="section-actions"><input id="productSearch" type="search" placeholder="Buscar producto, SKU, categoría..."><button class="btn primary" data-new-product>Nuevo producto</button></div><div class="cards-list products-list">${products.map(productRow).join('') || '<div class="empty">Sin productos.</div>'}</div>`;
  $('#productSearch').addEventListener('input', (e)=>{
    const q = normalize(e.target.value);
    $('.cards-list', $('#productsView')).innerHTML = products.filter(p=>normalize([p.name,p.sku,p.category,p.status,p.supplier].join(' ')).includes(q)).map(productRow).join('') || '<div class="empty">Sin resultados.</div>';
  });
}
function productRow(p) {
  const img = firstImage(p);
  return `<article class="admin-card-row product-admin-row"><div class="thumb product-thumb">${img?`<img src="${img}" alt="${escapeHTML(p.name)}">`:'—'}</div><div class="grow"><b>${escapeHTML(p.name)}</b><span>${escapeHTML(p.sku||'')} · ${escapeHTML(p.category||'Sin categoría')} · Stock ${productStock(p)}</span><small>${escapeHTML(p.description || '')}</small></div><strong>${money(p.price)}</strong><span class="badge ${p.status==='Disponible'?'':'danger'}">${escapeHTML(p.status||'Disponible')}</span><button class="btn ghost small" data-edit-product="${p.id}">Editar</button></article>`;
}
function productForm(p={}) {
  const imgs = (p.product_images || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(i=>i.url).join('\n');
  const vars = (p.product_variants || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(v=>[v.size,v.color,v.stock].filter(x=>x!==undefined).join(' / ')).join('\n');
  return `<form id="productForm" class="modal-form two-col">
    <input type="hidden" id="productId" value="${p.id||''}">
    <label>Nombre<input id="pName" required value="${escapeHTML(p.name||'')}"></label>
    <label>SKU<input id="pSku" value="${escapeHTML(p.sku||'')}"></label>
    <label>Categoría<input id="pCategory" value="${escapeHTML(p.category||'')}"></label>
    <label>Proveedor<input id="pSupplier" value="${escapeHTML(p.supplier||'')}"></label>
    <label>Costo<input id="pCost" type="number" step="0.01" value="${p.cost||0}"></label>
    <label>Precio<input id="pPrice" type="number" step="0.01" value="${p.price||0}"></label>
    <label>Estado<select id="pStatus"><option ${p.status==='Disponible'?'selected':''}>Disponible</option><option ${p.status==='Oculto'?'selected':''}>Oculto</option><option ${p.status==='Vendido'?'selected':''}>Vendido</option></select></label>
    <label class="wide">Descripción<textarea id="pDescription" placeholder="Detalles visibles para el cliente">${escapeHTML(p.description||'')}</textarea></label>
    <label class="wide">URLs de imágenes, una por línea<textarea id="pImages" placeholder="https://...">${escapeHTML(imgs)}</textarea></label>
    <label class="wide">Variantes, una por línea: talla / color / stock<textarea id="pVariants" placeholder="M / Negro / 1\nL / Negro / 1">${escapeHTML(vars)}</textarea></label>
    <div class="modal-actions wide"><button class="btn ghost" type="button" data-close-modal>Cancelar</button><button class="btn primary" type="submit">Guardar producto</button></div>
  </form>`;
}
async function saveProductFromForm() {
  const id = $('#productId').value || null;
  const row = { store_id: currentStore.id, name: $('#pName').value.trim(), sku: $('#pSku').value.trim() || null, category: $('#pCategory').value.trim(), supplier: $('#pSupplier').value.trim(), cost: Number($('#pCost').value||0), price: Number($('#pPrice').value||0), status: $('#pStatus').value, description: $('#pDescription').value.trim() };
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
  $('#customersView').innerHTML = `<div class="section-actions"><input id="customerSearch" type="search" placeholder="Buscar cliente, teléfono, red..."><button class="btn primary" data-new-customer>Nuevo cliente</button></div><div class="cards-list customers-list">${customers.map(customerRow).join('') || '<div class="empty">Sin clientes.</div>'}</div>`;
  $('#customerSearch').addEventListener('input', (e)=>{
    const q = normalize(e.target.value);
    $('.cards-list', $('#customersView')).innerHTML = customers.filter(c=>normalize([c.name,c.phone,c.instagram,c.email,c.notes].join(' ')).includes(q)).map(customerRow).join('') || '<div class="empty">Sin resultados.</div>';
  });
}
function customerRow(c) {
  const initial = (c.name||'?').slice(0,1).toUpperCase();
  const stats = customerStats(c);
  const phoneLink = cleanPhone(c.phone);
  return `<article class="admin-card-row customer-admin-row"><div class="avatar">${escapeHTML(initial)}</div><div class="grow"><b>${escapeHTML(c.name)}</b><span>${escapeHTML(c.phone||'Sin teléfono')} · ${escapeHTML(c.instagram||'Sin red')}</span><small>${stats.orders} pedido(s) · ${money(stats.sold)} vendido · saldo ${money(stats.balance)}</small></div>${phoneLink?`<a class="btn ghost small" href="https://wa.me/${phoneLink}" target="_blank">WhatsApp</a>`:''}<button class="btn ghost small" data-new-order-customer="${c.id}">Pedido</button><button class="btn ghost small" data-edit-customer="${c.id}">Editar</button></article>`;
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
  const internal = orders.map(orderRow).join('') || '<div class="empty">Sin pedidos internos.</div>';
  const web = catalogOrders.map(catalogOrderRow).join('') || '<div class="empty">Sin pedidos web.</div>';
  $('#ordersView').innerHTML = `<div class="section-actions"><input id="orderSearch" type="search" placeholder="Buscar pedido, cliente, folio..."><button class="btn primary" data-new-order>Nuevo pedido</button></div><div class="panel-grid orders-panels"><section class="panel-card"><div class="panel-head"><h3>Pedidos internos</h3><span class="badge">${orders.length}</span></div><div id="ordersList" class="cards-list">${internal}</div></section><section class="panel-card"><div class="panel-head"><h3>Pedidos web</h3><span class="badge">${catalogOrders.length}</span></div><div class="cards-list">${web}</div></section></div>`;
  $('#orderSearch').addEventListener('input', (e)=>{
    const q = normalize(e.target.value);
    $('#ordersList').innerHTML = orders.filter(o=>normalize([o.folio,o.customer_name,o.customer_phone,o.status].join(' ')).includes(q)).map(orderRow).join('') || '<div class="empty">Sin resultados.</div>';
  });
}
function orderRow(o) {
  const bal = orderBalance(o);
  const statusClass = bal > 0 && o.status !== 'Cancelado' ? 'danger' : '';
  return `<article class="admin-card-row order-admin-row"><div class="grow"><b>${escapeHTML(o.folio || 'Pedido')}</b><span>${escapeHTML(o.customer_name||'Cliente')} · ${escapeHTML(o.status||'Pendiente')} · ${nowLocalText(o.created_at)}</span><small>${orderItems(o).length} producto(s) · abonado ${money(orderPaid(o))} · saldo ${money(bal)}</small></div><strong>${money(o.total)}</strong><span class="badge ${statusClass}">${bal>0? 'Pendiente':'Pagado'}</span><button class="btn ghost small" data-receipt-order="${o.id}">Recibo</button><button class="btn ghost small" data-whatsapp-order="${o.id}">WhatsApp</button><button class="btn ghost small" data-edit-order="${o.id}">Editar</button><button class="btn danger small" data-delete-order="${o.id}">Eliminar</button></article>`;
}
function catalogOrderRow(o) {
  return `<article class="admin-card-row"><div class="grow"><b>Pedido web</b><span>${escapeHTML(o.customer_name||'Cliente web')} · ${nowLocalText(o.created_at)} · ${escapeHTML(o.status||'Nuevo')}</span><small>${(o.catalog_order_items||[]).length} producto(s)</small></div><strong>${money(o.total_reference)}</strong><button class="btn ghost small" data-convert-catalog="${o.id}">Convertir</button></article>`;
}
function cleanPhone(phone) { return String(phone||'').replace(/[^0-9]/g,''); }
function customerOptions() { return customers.map(c=>`<option value="${escapeHTML(c.name)}" data-id="${c.id}">${escapeHTML(c.phone||'')}</option>`).join(''); }
function productOptions(selected='') { return `<option value="">Manual</option>` + products.map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${escapeHTML(p.name)} · ${money(p.price)}</option>`).join(''); }
function productVariantOptions(productId, selected='') {
  const p = productById(productId);
  const vars = p?.product_variants || [];
  return vars.length ? vars.map(v=>`<option value="${escapeHTML(variantLabel(v))}" ${selected===variantLabel(v)?'selected':''}>${escapeHTML(variantLabel(v))} · ${v.stock || 0} disp.</option>`).join('') : `<option value="${escapeHTML(selected||'')}" selected>${escapeHTML(selected||'Sin variante')}</option>`;
}
function itemRowTemplate(item={}) {
  const uid = crypto.randomUUID?.() || String(Date.now()+Math.random());
  return `<div class="order-edit-row" data-order-item-row>
    <label>Producto<select class="oiProduct"><option value="">Manual</option>${products.map(p=>`<option value="${p.id}" ${item.product_id===p.id?'selected':''}>${escapeHTML(p.name)}</option>`).join('')}</select></label>
    <label>Nombre<input class="oiName" value="${escapeHTML(item.product_name || productById(item.product_id)?.name || '')}"></label>
    <label>Variante<select class="oiVariant" data-selected="${escapeHTML(item.variant||'')}">${productVariantOptions(item.product_id, item.variant||'')}</select></label>
    <label>Cant.<input class="oiQty" type="number" min="1" step="1" value="${item.qty||1}"></label>
    <label>Precio<input class="oiPrice" type="number" step="0.01" value="${item.unit_price||0}"></label>
    <button class="remove-row" type="button" data-remove-item title="Quitar">×</button>
  </div>`;
}
function paymentRowTemplate(p={}) {
  return `<div class="payment-edit-row" data-payment-row>
    <label>Monto<input class="payAmount" type="number" step="0.01" value="${p.amount||0}"></label>
    <label>Método<input class="payMethod" value="${escapeHTML(p.method||'Efectivo')}"></label>
    <label>Fecha<input class="payDate" type="date" value="${dateOnly(p.paid_at) || todayISO()}"></label>
    <label>Nota<input class="payNote" value="${escapeHTML(p.note||'')}"></label>
    <button class="remove-row" type="button" data-remove-payment title="Quitar">×</button>
  </div>`;
}
function orderForm(o={}) {
  const items = (o.order_items?.length ? o.order_items : [{}]).map(itemRowTemplate).join('');
  const pays = (o.payments || []).map(paymentRowTemplate).join('');
  const selectedCustomer = customers.find(c => c.id === o.customer_id) || customers.find(c => normalize(c.name) === normalize(o.customer_name));
  return `<form id="orderForm" class="modal-form order-form">
    <input type="hidden" id="orderId" value="${o.id||''}">
    <input type="hidden" id="oCustomerId" value="${selectedCustomer?.id || o.customer_id || ''}">
    <div class="two-col wide"><label>Cliente<input id="oCustomerName" list="customersList" required value="${escapeHTML(o.customer_name || selectedCustomer?.name || '')}" placeholder="Escribe para buscar cliente"></label><datalist id="customersList">${customerOptions()}</datalist><label>Teléfono<input id="oPhone" value="${escapeHTML(o.customer_phone || selectedCustomer?.phone || '')}"></label></div>
    <div class="two-col wide"><label>Entrega / dirección<input id="oDelivery" value="${escapeHTML(o.delivery_address || selectedCustomer?.address || '')}"></label><label>Fecha límite<input id="oDueDate" type="date" value="${dateOnly(o.due_date)}"></label></div>
    <div class="two-col wide"><label>Estado<select id="oStatus"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='Apartado'?'selected':''}>Apartado</option><option ${o.status==='Entregado'?'selected':''}>Entregado</option><option ${o.status==='Cancelado'?'selected':''}>Cancelado</option></select></label><label>Descuento<input id="oDiscount" type="number" step="0.01" value="${o.discount||0}"></label></div>
    <section class="subpanel wide"><div class="panel-head"><h4>Productos del pedido</h4><button class="btn ghost small" type="button" data-add-item>Agregar producto</button></div><div id="orderItemsEdit" class="order-lines-edit">${items}</div></section>
    <section class="subpanel wide"><div class="panel-head"><h4>Abonos / pagos</h4><button class="btn ghost small" type="button" data-add-payment>Agregar abono</button></div><div id="paymentsEdit" class="payment-lines-edit">${pays || '<p class="muted">Sin abonos todavía.</p>'}</div></section>
    <label class="wide">Notas<textarea id="oNotes">${escapeHTML(o.notes||'')}</textarea></label>
    <div id="orderLiveTotals" class="order-summary-preview wide"></div>
    <div class="modal-actions wide"><button class="btn ghost" type="button" data-close-modal>Cancelar</button><button class="btn primary" type="submit">Guardar pedido</button></div>
  </form>`;
}
function collectItemsFromForm() {
  return $$('[data-order-item-row]').map((row,i)=>{
    const productId = $('.oiProduct', row).value || null;
    const product = productById(productId);
    const name = $('.oiName', row).value.trim() || product?.name || 'Producto';
    const variant = $('.oiVariant', row).value || '';
    const qty = Math.max(1, Number($('.oiQty', row).value || 1));
    const unit = Number($('.oiPrice', row).value || 0);
    return { store_id: currentStore.id, product_id: productId, product_name: name, variant, qty, unit_price: unit, line_total: qty * unit };
  }).filter(x=>x.product_name && x.qty>0);
}
function collectPaymentsFromForm() {
  return $$('[data-payment-row]').map(row=>({ store_id: currentStore.id, amount: Number($('.payAmount', row).value || 0), method: $('.payMethod', row).value.trim(), note: $('.payNote', row).value.trim(), paid_at: $('.payDate', row).value ? new Date($('.payDate', row).value + 'T12:00:00').toISOString() : new Date().toISOString() })).filter(x=>x.amount>0);
}
function updateOrderLiveTotals() {
  const items = collectItemsFromForm();
  const subtotal = items.reduce((s,i)=>s+i.line_total,0);
  const discount = Number($('#oDiscount')?.value || 0);
  const total = Math.max(0, subtotal - discount);
  const paid = collectPaymentsFromForm().reduce((s,p)=>s+p.amount,0);
  const balance = Math.max(0,total-paid);
  const box = $('#orderLiveTotals');
  if (box) box.innerHTML = `<span>Subtotal: <strong>${money(subtotal)}</strong></span><span>Descuento: <strong>${money(discount)}</strong></span><span>Total: <strong>${money(total)}</strong></span><span>Abonado: <strong>${money(paid)}</strong></span><span>Saldo: <strong>${money(balance)}</strong></span>`;
}
function fillCustomerFromName() {
  const name = $('#oCustomerName')?.value || '';
  const c = customers.find(x => normalize(x.name) === normalize(name));
  if (!c) { $('#oCustomerId').value = ''; return; }
  $('#oCustomerId').value = c.id;
  $('#oPhone').value = c.phone || '';
  $('#oDelivery').value = c.address || '';
}
function refreshVariantSelect(row) {
  const productId = $('.oiProduct', row).value;
  const product = productById(productId);
  if (product) {
    $('.oiName', row).value = product.name || '';
    $('.oiPrice', row).value = product.price || 0;
    $('.oiVariant', row).innerHTML = productVariantOptions(productId, $('.oiVariant', row).dataset.selected || '');
  }
  updateOrderLiveTotals();
}
async function saveOrderFromForm() {
  const id = $('#orderId').value || null;
  const items = collectItemsFromForm();
  const payments = collectPaymentsFromForm();
  const subtotal = items.reduce((s,i)=>s+i.line_total,0);
  const discount = Number($('#oDiscount').value || 0);
  const total = Math.max(0, subtotal - discount);
  const paid = payments.reduce((s,p)=>s+p.amount,0);
  const balance = Math.max(0,total-paid);
  const customerName = $('#oCustomerName').value.trim();
  let customerId = $('#oCustomerId').value || null;
  let phone = $('#oPhone').value.trim();
  if (!customerId && customerName) {
    const existing = customers.find(c => normalize(c.name) === normalize(customerName) || (phone && normalize(c.phone) === normalize(phone)));
    if (existing) customerId = existing.id;
    else {
      const { data: newCustomer } = await supabase.from('customers').insert({ store_id: currentStore.id, name: customerName, phone, address: $('#oDelivery').value.trim() }).select().single();
      customerId = newCustomer?.id || null;
    }
  }
  const row = { store_id: currentStore.id, customer_id: customerId, folio: id ? undefined : newFolio(), customer_name: customerName, customer_phone: phone, total, paid, balance, discount, delivery_address: $('#oDelivery').value.trim(), due_date: $('#oDueDate').value || null, status: $('#oStatus').value, notes: $('#oNotes').value.trim() };
  Object.keys(row).forEach(k=>row[k]===undefined && delete row[k]);
  const { data: order, error } = id ? await supabase.from('orders').update(row).eq('id', id).select().single() : await supabase.from('orders').insert(row).select().single();
  if (error) throw error;
  const orderId = order.id;
  await Promise.all([supabase.from('order_items').delete().eq('order_id', orderId), supabase.from('payments').delete().eq('order_id', orderId)]);
  if (items.length) await supabase.from('order_items').insert(items.map(i=>({...i, order_id: orderId})));
  if (payments.length) await supabase.from('payments').insert(payments.map(p=>({...p, order_id: orderId})));
}
async function deleteOrder(id) {
  if (!confirm('¿Eliminar este pedido? También se borrarán productos y abonos del pedido.')) return;
  await Promise.all([supabase.from('order_items').delete().eq('order_id', id), supabase.from('payments').delete().eq('order_id', id)]);
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) alert(error.message);
  await reloadAll();
}
async function convertCatalogOrder(id) {
  const co = catalogOrders.find(x=>x.id===id);
  if (!co) return;
  const items = (co.catalog_order_items || []).map(i=>({ store_id: currentStore.id, product_id: i.product_id, product_name: i.product_name, variant: i.variant, qty: i.qty, unit_price: i.unit_price, line_total: i.line_total }));
  const total = items.reduce((s,i)=>s+Number(i.line_total||0),0) || Number(co.total_reference||0);
  const { data: order, error } = await supabase.from('orders').insert({ store_id: currentStore.id, folio: newFolio(), customer_name: co.customer_name || 'Cliente web', customer_phone: co.customer_phone || '', total, paid: 0, balance: total, status: 'Pendiente', notes: co.message || '' }).select().single();
  if (error) { alert(error.message); return; }
  if (items.length) await supabase.from('order_items').insert(items.map(i=>({...i, order_id: order.id})));
  await supabase.from('catalog_orders').update({ status:'Convertido' }).eq('id', id);
  await reloadAll();
  showView('orders');
}
function receiptHTML(o) {
  const settings = currentSettings || {};
  const logo = settings.logo_url ? `<img src="${settings.logo_url}" alt="Logo" class="receipt-logo">` : `<div class="receipt-logo-fallback">${escapeHTML((settings.brand_name||currentStore.name||'O').slice(0,1))}</div>`;
  const subtotal = orderSubtotal(o);
  const paid = orderPaid(o);
  const discount = Number(o.discount || 0);
  const balance = Math.max(0, Number(o.total||0) - paid);
  return `<article class="receipt" id="receiptPrintable">
    <header class="receipt-head"><div class="receipt-brand">${logo}<div><h2>${escapeHTML(settings.brand_name || currentStore.name)}</h2><p>Recibo / pedido</p></div></div><div class="receipt-folio"><span>FOLIO</span><strong>${escapeHTML(o.folio||'Pedido')}</strong><em>${nowLocalText(o.created_at)}</em><b>${escapeHTML(o.status||'Pendiente')}</b></div></header>
    <hr>
    <section class="receipt-meta"><div><span>CLIENTE</span><h4>${escapeHTML(o.customer_name||'—')}</h4><p>Teléfono: ${escapeHTML(o.customer_phone||'—')}</p></div><div><span>ENTREGA</span><h4>${escapeHTML(o.delivery_address||'—')}</h4><p>Fecha/límite: ${escapeHTML(dateOnly(o.due_date)||'—')}</p></div></section>
    <table><thead><tr><th>Producto</th><th>Variante</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${orderItems(o).map(i=>`<tr><td>${escapeHTML(i.product_name)}</td><td>${escapeHTML(i.variant||'—')}</td><td>${i.qty}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`).join('') || '<tr><td colspan="5">Sin productos registrados</td></tr>'}</tbody></table>
    <section class="receipt-payments"><h3>Abonos / pagos</h3><table><thead><tr><th>Fecha</th><th>Método</th><th>Nota</th><th>Monto</th></tr></thead><tbody>${orderPayments(o).map(p=>`<tr><td>${dateOnly(p.paid_at)}</td><td>${escapeHTML(p.method||'—')}</td><td>${escapeHTML(p.note||'')}</td><td>${money(p.amount)}</td></tr>`).join('') || '<tr><td colspan="4">Sin abonos</td></tr>'}</tbody></table></section>
    <section class="receipt-summary"><div><span>MENSAJE</span><p>Gracias por tu compra. Guarda este recibo para cualquier aclaración.</p></div><div class="receipt-totals"><p><span>Subtotal</span><strong>${money(subtotal)}</strong></p><p><span>Descuento</span><strong>${money(discount)}</strong></p><p><span>Total</span><strong>${money(o.total)}</strong></p><p><span>Abonos</span><strong>- ${money(paid)}</strong></p><h2>Saldo pendiente</h2><h1>${money(balance)}</h1></div></section>
  </article>`;
}
function receiptText(o) {
  const paid = orderPaid(o);
  const balance = orderBalance(o);
  return [`${currentSettings?.brand_name || currentStore.name} - Recibo ${o.folio||''}`, `Cliente: ${o.customer_name||'—'}`, `Estado: ${o.status||'Pendiente'}`, '', 'Productos:', ...orderItems(o).map(i=>`- ${i.product_name} · ${i.variant||'Sin variante'} · x${i.qty} · ${money(i.line_total)}`), '', `Total: ${money(o.total)}`, `Abonado: ${money(paid)}`, `Saldo: ${money(balance)}`].join('\n');
}
function openReceipt(id) {
  const o = orders.find(x=>x.id===id);
  if (!o) return;
  openModal('Recibo / pedido', `${receiptHTML(o)}<div class="modal-actions receipt-actions"><button class="btn ghost" type="button" data-print-receipt>Imprimir / PDF</button><button class="btn primary" type="button" data-whatsapp-order="${o.id}">Enviar por WhatsApp</button></div>`, true);
}
function printReceipt() {
  const receipt = document.querySelector('#receiptPrintable');
  if (!receipt) return;
  const title = receipt.querySelector('.receipt-folio strong')?.textContent?.trim() || 'recibo';
  const printWindow = window.open('', '_blank', 'width=920,height=1200');
  if (!printWindow) {
    alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para imprimir el recibo.');
    return;
  }
  const printStyles = `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Inter, Arial, sans-serif; }
    body { padding: 0; }
    .print-shell { width: 100%; max-width: 190mm; margin: 0 auto; }
    .receipt { width: 100%; padding: 0; border: 0; border-radius: 0; box-shadow: none; color: #111827; background: #fff; }
    .receipt-head { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; page-break-inside: avoid; }
    .receipt-brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .receipt-brand h2 { margin: 0; font-size: 24px; line-height: 1.05; letter-spacing: -0.03em; word-break: break-word; }
    .receipt-brand p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .receipt-logo { width: 74px; height: 74px; object-fit: contain; flex: 0 0 auto; }
    .receipt-logo-fallback { width: 64px; height: 64px; border-radius: 14px; background: #111827; color: #fff; display: grid; place-items: center; font-weight: 950; font-size: 24px; flex: 0 0 auto; }
    .receipt-folio { text-align: right; display: grid; gap: 4px; min-width: 150px; }
    .receipt-folio span, .receipt-meta span, .receipt-summary span { color: #16a34a; font-size: 10px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
    .receipt-folio strong { font-size: 20px; line-height: 1.05; word-break: break-word; }
    .receipt-folio em { font-style: normal; color: #64748b; font-size: 11px; }
    .receipt-folio b { color: #16a34a; font-size: 12px; }
    .receipt hr { border: 0; border-top: 1.5px solid #111827; margin: 16px 0; }
    .receipt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 10px; page-break-inside: avoid; }
    .receipt-meta h4 { margin: 5px 0 5px; font-size: 15px; line-height: 1.2; word-break: break-word; }
    .receipt-meta p { margin: 3px 0; color: #475569; font-size: 11px; line-height: 1.35; word-break: break-word; }
    .receipt table { width: 100%; border-collapse: collapse; margin: 12px 0; table-layout: fixed; page-break-inside: auto; }
    .receipt thead { display: table-header-group; }
    .receipt tr { page-break-inside: avoid; page-break-after: auto; }
    .receipt th { color: #64748b; text-transform: uppercase; font-size: 9px; letter-spacing: .06em; line-height: 1.1; }
    .receipt th, .receipt td { text-align: left; padding: 7px 5px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 10.5px; line-height: 1.25; overflow-wrap: anywhere; }
    .receipt table th:nth-child(1), .receipt table td:nth-child(1) { width: 36%; }
    .receipt table th:nth-child(2), .receipt table td:nth-child(2) { width: 20%; }
    .receipt table th:nth-child(3), .receipt table td:nth-child(3) { width: 10%; text-align: center; }
    .receipt table th:nth-child(4), .receipt table td:nth-child(4), .receipt table th:nth-child(5), .receipt table td:nth-child(5) { width: 17%; text-align: right; }
    .receipt-payments { margin-top: 8px; }
    .receipt-payments h3 { margin: 12px 0 4px; font-size: 13px; }
    .receipt-payments table th:nth-child(1), .receipt-payments table td:nth-child(1) { width: 18%; text-align: left; }
    .receipt-payments table th:nth-child(2), .receipt-payments table td:nth-child(2) { width: 20%; text-align: left; }
    .receipt-payments table th:nth-child(3), .receipt-payments table td:nth-child(3) { width: 42%; text-align: left; }
    .receipt-payments table th:nth-child(4), .receipt-payments table td:nth-child(4) { width: 20%; text-align: right; }
    .receipt-summary { display: grid; grid-template-columns: 1fr 72mm; gap: 16px; border-top: 1.5px solid #9ca3af; padding-top: 12px; margin-top: 12px; page-break-inside: avoid; }
    .receipt-summary p { margin: 6px 0 0; line-height: 1.35; font-size: 11px; color: #475569; }
    .receipt-totals { text-align: right; }
    .receipt-totals p { display: flex; justify-content: space-between; gap: 14px; margin: 5px 0; font-size: 11px; color: #475569; }
    .receipt-totals p strong { color: #111827; white-space: nowrap; }
    .receipt-totals h2 { margin: 12px 0 2px; color: #16a34a; font-size: 12px; line-height: 1.1; }
    .receipt-totals h1 { margin: 0; color: #16a34a; font-size: 24px; line-height: 1.05; letter-spacing: -0.04em; }
    @media print { .no-print { display: none !important; } }
    @media screen { body { padding: 24px; background: #eef2f7; } .print-shell { background:#fff; padding: 20px; box-shadow: 0 24px 70px rgba(15,23,42,.12); } }
    @media (max-width: 680px) { .receipt-head, .receipt-meta, .receipt-summary { grid-template-columns: 1fr; } .receipt-folio, .receipt-totals { text-align: left; } }
  `;
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>${printStyles}</style></head><body><div class="print-shell">${receipt.outerHTML}</div><script>window.addEventListener('load',()=>{setTimeout(()=>{window.focus();window.print();},450)});<\/script></body></html>`);
  printWindow.document.close();
}
function whatsappOrder(id) {
  const o = orders.find(x=>x.id===id);
  if (!o) return;
  const phone = cleanPhone(o.customer_phone);
  const url = `https://wa.me/${phone || (currentSettings?.whatsapp || '')}?text=${encodeURIComponent(receiptText(o))}`;
  window.open(url, '_blank');
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

document.addEventListener('input', (e)=>{
  if (e.target.closest('#orderForm')) updateOrderLiveTotals();
  if (e.target.id === 'oCustomerName') fillCustomerFromName();
});
document.addEventListener('change', (e)=>{
  const row = e.target.closest('[data-order-item-row]');
  if (row && e.target.classList.contains('oiProduct')) refreshVariantSelect(row);
  if (e.target.closest('#orderForm')) updateOrderLiveTotals();
});
document.addEventListener('click', async (e)=>{
  const viewBtn = e.target.closest('[data-view]');
  if (viewBtn) showView(viewBtn.dataset.view);
  const jump = e.target.closest('[data-view-jump]')?.dataset.viewJump;
  if (jump) showView(jump);
  if (e.target.closest('[data-close-modal]')) closeModal();
  if (e.target.closest('[data-new-product]')) openModal('Nuevo producto', productForm(), true);
  const ep = e.target.closest('[data-edit-product]')?.dataset.editProduct;
  if (ep) openModal('Editar producto', productForm(products.find(p=>p.id===ep)), true);
  if (e.target.closest('[data-new-customer]')) openModal('Nuevo cliente', customerForm());
  const ec = e.target.closest('[data-edit-customer]')?.dataset.editCustomer;
  if (ec) openModal('Editar cliente', customerForm(customers.find(c=>c.id===ec)));
  const noc = e.target.closest('[data-new-order-customer]')?.dataset.newOrderCustomer;
  if (noc) { const c = customers.find(x=>x.id===noc); openModal('Nuevo pedido', orderForm({ customer_id:c.id, customer_name:c.name, customer_phone:c.phone, delivery_address:c.address }), true); updateOrderLiveTotals(); }
  if (e.target.closest('[data-new-order]')) { openModal('Nuevo pedido', orderForm(), true); updateOrderLiveTotals(); }
  const eo = e.target.closest('[data-edit-order]')?.dataset.editOrder;
  if (eo) { openModal('Editar pedido', orderForm(orders.find(o=>o.id===eo)), true); updateOrderLiveTotals(); }
  const del = e.target.closest('[data-delete-order]')?.dataset.deleteOrder;
  if (del) await deleteOrder(del);
  const rec = e.target.closest('[data-receipt-order]')?.dataset.receiptOrder;
  if (rec) openReceipt(rec);
  const wa = e.target.closest('[data-whatsapp-order]')?.dataset.whatsappOrder;
  if (wa) whatsappOrder(wa);
  const cc = e.target.closest('[data-convert-catalog]')?.dataset.convertCatalog;
  if (cc) await convertCatalogOrder(cc);
  if (e.target.closest('[data-print-receipt]')) printReceipt();
  if (e.target.closest('[data-add-item]')) { $('#orderItemsEdit').insertAdjacentHTML('beforeend', itemRowTemplate({})); updateOrderLiveTotals(); }
  if (e.target.closest('[data-remove-item]')) { e.target.closest('[data-order-item-row]')?.remove(); updateOrderLiveTotals(); }
  if (e.target.closest('[data-add-payment]')) { const box = $('#paymentsEdit'); if (box) { if (box.querySelector('.muted')) box.innerHTML = ''; box.insertAdjacentHTML('beforeend', paymentRowTemplate({amount:0, method:'Efectivo'})); updateOrderLiveTotals(); } }
  if (e.target.closest('[data-remove-payment]')) { e.target.closest('[data-payment-row]')?.remove(); updateOrderLiveTotals(); }
  const ss = e.target.closest('[data-select-store]')?.dataset.selectStore;
  if (ss) { currentStore = stores.find(s=>s.id===ss); renderStoreSwitcher(); await loadCurrentStoreData(); showView('dashboard'); }
  if (e.target.closest('#resetThemeColors')) { const [p,b,t] = themeColors[$('#sTheme').value] || themeColors.minimal; $('#sPrimary').value=p; $('#sBg').value=b; $('#sText').value=t; }
});

document.addEventListener('submit', async (e)=>{
  try {
    if (e.target.id === 'productForm') { e.preventDefault(); await saveProductFromForm(); closeModal(); await reloadAll(); }
    if (e.target.id === 'customerForm') { e.preventDefault(); await saveCustomerFromForm(); closeModal(); await reloadAll(); }
    if (e.target.id === 'orderForm') { e.preventDefault(); await saveOrderFromForm(); closeModal(); await reloadAll(); }
    if (e.target.id === 'settingsForm') { e.preventDefault(); await saveSettings(); await reloadAll(); alert('Tienda guardada.'); }
    if (e.target.id === 'createStoreForm') { e.preventDefault(); await createStoreFromForm(); await reloadAll(); showView('super'); }
  } catch (err) {
    alert(err.message || err);
  }
});

supabase.auth.onAuthStateChange(() => checkSession());
checkSession();

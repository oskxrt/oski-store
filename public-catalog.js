import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.OSKI_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const money = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cfg.CURRENCY || 'MXN' }).format(Number(n || 0));
const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escapeHTML = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const $ = (s,p=document) => p.querySelector(s);
const $$ = (s,p=document) => [...p.querySelectorAll(s)];

let store = null;
let settings = null;
let products = [];
let activeCategory = '';

function slugFromUrl() {
  const u = new URL(location.href);
  const fromQuery = u.searchParams.get('slug') || u.searchParams.get('store');
  if (fromQuery) return fromQuery;
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 't' && parts[1]) return parts[1];
  return 'tienda-prueba';
}
function cssVars() {
  const root = document.documentElement;
  root.style.setProperty('--store-primary', settings.primary_color || '#0b0b0d');
  root.style.setProperty('--store-bg', settings.bg_color || '#f8f7f3');
  root.style.setProperty('--store-text', settings.text_color || '#111827');
  document.body.dataset.theme = settings.theme || 'minimal';
}
function logoHTML() {
  const name = settings.brand_name || store.name;
  return settings.logo_url ? `<img src="${settings.logo_url}" alt="${escapeHTML(name)}">` : `<span>${escapeHTML(name)}</span>`;
}
function renderLoaderBrand() {
  const loader = $('#storeLoader');
  if (!loader || !store) return;
  const name = settings.brand_name || store.name || 'Store';
  const mark = settings.logo_url ? `<img src="${settings.logo_url}" alt="${escapeHTML(name)}">` : `<span>${escapeHTML(name)}</span>`;
  loader.innerHTML = `<div class="loader-brand">${mark}</div><div class="loader-mark"></div><p>Cargando ${escapeHTML(name)}...</p>`;
}
function socialIcon(label) {
  const key = normalize(label);
  if (key.includes('instagram')) return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>`;
  if (key.includes('tiktok')) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.2a4.2 4.2 0 1 1-4.2-4.2"></path><path d="M14 6.2c1.2 2.2 3 3.4 5 3.6"></path></svg>`;
  if (key.includes('facebook')) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.6.4-1 1-1z"></path></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"></path><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"></path></svg>`;
}
function variantList(p) { return [...(p.product_variants || [])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)); }
function imageList(p) { return [...(p.product_images || [])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(i=>i.url).filter(Boolean); }
function categories() { return [...new Set(products.map(p => p.category).filter(Boolean))].sort(); }
function colors(p) { return [...new Set(variantList(p).map(v => v.color).filter(Boolean))]; }
function sizes(p) { return [...new Set(variantList(p).map(v => v.size).filter(Boolean))]; }

function renderShell() {
  document.title = `${settings.brand_name || store.name} — Catálogo`;
  cssVars();
  $('#storeLogo').innerHTML = logoHTML();
  $('#mobileLogo').innerHTML = logoHTML();
  $('#storeCopyright').textContent = `© ${settings.brand_name || store.name}`;
  $('#waLink').href = `https://wa.me/${settings.whatsapp || ''}`;
  const socials = [
    ['Instagram', settings.instagram_url],
    ['TikTok', settings.tiktok_url],
    ['Facebook', settings.facebook_url]
  ].filter(x => x[1]);
  $('#socialLinks').innerHTML = socials.map(([label,url]) => `<a class="social-icon-link" href="${escapeHTML(url)}" target="_blank" rel="noopener" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}">${socialIcon(label)}<span>${escapeHTML(label)}</span></a>`).join('');
  renderCategories();
}
function renderCategories() {
  const cats = categories();
  $('#categoryNav').innerHTML = `<button class="active" data-cat="">SHOP ALL</button>` + cats.map(c => `<button data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('');
}
function renderNewArrivals() {
  const section = $('#newArrivals');
  if (!settings.show_new_arrivals) { section.classList.add('hidden'); return; }
  const items = products.slice(0, 4);
  if (!items.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  section.innerHTML = `<div class="section-head"><span class="eyebrow">${escapeHTML(settings.new_arrivals_title || 'Novedades')}</span></div><div class="store-grid compact">${items.map(card).join('')}</div>`;
}
function filteredProducts() {
  const q = normalize($('#searchInput')?.value || '');
  return products.filter(p => {
    const text = normalize([p.name,p.sku,p.category,p.description, ...variantList(p).map(v=>`${v.size} ${v.color}`)].join(' '));
    return (!activeCategory || p.category === activeCategory) && (!q || text.includes(q));
  });
}
function card(product) {
  const img = imageList(product)[0];
  return `<article class="product-card" data-product="${product.id}">
    <button class="product-card-media" data-open-product="${product.id}" type="button">${img ? `<img src="${img}" alt="${escapeHTML(product.name)}" draggable="false">` : '<span>Sin foto</span>'}</button>
    <button class="product-card-info" data-open-product="${product.id}" type="button">
      <strong>${escapeHTML(product.name)}</strong>
      <span>${money(product.price)}</span>
    </button>
  </article>`;
}
function renderCatalog() {
  const list = filteredProducts();
  $('#activeCategory').textContent = (activeCategory || 'SHOP ALL').toUpperCase();
  $$('#categoryNav button').forEach(b => b.classList.toggle('active', (b.dataset.cat || '') === activeCategory));
  $('#catalogGrid').innerHTML = list.length ? list.map(card).join('') : '<div class="empty">No hay productos disponibles.</div>';
  renderNewArrivals();
}
function carousel(product) {
  const imgs = imageList(product);
  if (!imgs.length) return '<div class="quick-photo empty">Sin foto</div>';
  const slides = imgs.map((url,i)=>`<div class="q-slide ${i===0?'active':''}"><img src="${url}" alt="${escapeHTML(product.name)}" draggable="false"></div>`).join('');
  const controls = imgs.length > 1 ? `<button class="q-arrow left" data-qprev type="button" aria-label="Anterior"></button><button class="q-arrow right" data-qnext type="button" aria-label="Siguiente"></button><div class="q-dots">${imgs.map((_,i)=>`<button class="q-dot ${i===0?'active':''}" data-qdot="${i}" type="button"></button>`).join('')}</div>` : '';
  return `<div class="quick-photo" data-qindex="0" data-qcount="${imgs.length}">${slides}${controls}</div>`;
}
function setQuickSlide(i) {
  const box = $('.quick-photo');
  if (!box) return;
  const count = Number(box.dataset.qcount || 0);
  if (!count) return;
  i = (i + count) % count;
  box.dataset.qindex = String(i);
  $$('.q-slide', box).forEach((s,idx)=>s.classList.toggle('active', idx===i));
  $$('.q-dot', box).forEach((d,idx)=>d.classList.toggle('active', idx===i));
}
function openQuick(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const vars = variantList(p).filter(v => Number(v.stock || 0) > 0);
  $('#quickViewContent').innerHTML = `<div class="quick-grid" data-quick-root="${p.id}">
    ${carousel(p)}
    <div class="quick-info">
      <span class="eyebrow">${escapeHTML(p.category || 'PRODUCTO')}</span>
      <h2>${escapeHTML(p.name)}</h2>
      <strong class="quick-price">${money(p.price)}</strong>
      ${p.description ? `<p>${escapeHTML(p.description)}</p>` : ''}
      ${colors(p).length ? `<p><b>Colores:</b> ${escapeHTML(colors(p).join(', '))}</p>` : ''}
      ${sizes(p).length ? `<p><b>Tallas:</b> ${escapeHTML(sizes(p).join(', '))}</p>` : ''}
      <div class="quick-order-box">
        <label>Variante<select id="quickVariant">${vars.map(v=>`<option value="${v.id}">${escapeHTML([v.size,v.color].filter(Boolean).join(' / '))} · ${v.stock} disp.</option>`).join('')}</select></label>
        <label>Cant.<input id="quickQty" type="number" min="1" value="1"></label>
      </div>
      <button class="btn primary wide" id="quickWhatsapp" type="button">Pedir por WhatsApp</button>
    </div>
  </div>`;
  document.body.classList.add('modal-open');
  $('#quickViewModal').showModal();
}
function closeQuick() { $('#quickViewModal').close(); document.body.classList.remove('modal-open'); }
function quickMessage() {
  const root = $('[data-quick-root]');
  const p = products.find(x => x.id === root?.dataset.quickRoot);
  const qty = Math.max(1, Number($('#quickQty')?.value || 1));
  const v = variantList(p).find(x => x.id === $('#quickVariant')?.value);
  const variant = v ? [v.size, v.color].filter(Boolean).join(' / ') : 'Sin variante';
  return ['Hola, quiero hacer un pedido.', `Tienda: ${settings.brand_name || store.name}`, `Producto: ${p.name}`, `Variante: ${variant}`, `Cantidad: ${qty}`, `Total referencia: ${money(Number(p.price || 0) * qty)}`].join('\n');
}
async function loadStore() {
  try {
    const slug = slugFromUrl();
    const { data: storeData, error: storeError } = await supabase.from('stores').select('*').eq('slug', slug).eq('status', 'active').maybeSingle();
    if (storeError || !storeData) throw new Error('Tienda no encontrada o suspendida.');
    store = storeData;
    const { data: settingsData } = await supabase.from('store_settings').select('*').eq('store_id', store.id).maybeSingle();
    settings = settingsData || { brand_name: store.name };
    cssVars();
    renderLoaderBrand();
    const { data, error } = await supabase.from('products').select('*, product_images(*), product_variants(*)').eq('store_id', store.id).eq('status', 'Disponible').order('created_at', { ascending:false });
    if (error) throw error;
    products = data || [];
    renderShell();
    renderCatalog();
    $('#storeLoader').classList.add('hidden');
    $('#storeApp').classList.remove('hidden');
  } catch (err) {
    $('#storeLoader').innerHTML = `<div class="empty"><b>No se pudo cargar.</b><br>${escapeHTML(err.message)}</div>`;
  }
}

document.addEventListener('click', async (event) => {
  const cat = event.target.closest('[data-cat]');
  if (cat) { activeCategory = cat.dataset.cat || ''; renderCatalog(); $('#storeSidebar').classList.remove('open'); }
  const product = event.target.closest('[data-open-product]')?.dataset.openProduct;
  if (product) openQuick(product);
  if (event.target.closest('#quickClose')) closeQuick();
  if (event.target === $('#quickViewModal')) closeQuick();
  if (event.target.closest('[data-qprev]')) setQuickSlide(Number($('.quick-photo').dataset.qindex || 0) - 1);
  if (event.target.closest('[data-qnext]')) setQuickSlide(Number($('.quick-photo').dataset.qindex || 0) + 1);
  const dot = event.target.closest('[data-qdot]')?.dataset.qdot;
  if (dot !== undefined) setQuickSlide(Number(dot));
  if (event.target.closest('#quickWhatsapp')) window.open(`https://wa.me/${settings.whatsapp || ''}?text=${encodeURIComponent(quickMessage())}`, '_blank');
  if (event.target.closest('#menuBtn')) $('#storeSidebar').classList.toggle('open');
  if (event.target.closest('#searchBtn')) $('#searchInput').focus();
});
$('#searchInput').addEventListener('input', renderCatalog);
$('#quickViewModal').addEventListener('close', () => document.body.classList.remove('modal-open'));
loadStore();

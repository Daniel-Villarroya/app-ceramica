const buttons = document.querySelectorAll('.options_button');
const close_product_creator = document.getElementById('close_creator');
const close_view = document.getElementById('close_view');
const close_close_view = document.getElementById('close_close_view');
const selection_circle = document.getElementById('options_circle');
const swipe_container = document.getElementById('swipe_container');

const product_creator = document.getElementById('product_creator');
let isClicked = false;

//---------------NAVEGACIÓN (sin cambios de comportamiento)----------------//
if(buttons.length > 0) {
  selection_circle.style.width = `${buttons[0].getBoundingClientRect().width}px`;
  selection_circle.style.transform = `translateX(${buttons[0].getBoundingClientRect().left - selection_circle.parentElement.getBoundingClientRect().left}px)`;
}

selection_circle.style.transform = `translateX(${buttons[0].getBoundingClientRect().left - selection_circle.parentElement.getBoundingClientRect().left - 5}px)`;

// Coloca el círculo sobre el botón de la pestaña actual (home o stats)
function moveCircleToCurrentPage() {
  const posicionScroll = swipe_container.scrollLeft;
  const windowWidth = window.innerWidth;
  const target = posicionScroll >= windowWidth / 2 ? 'stats_button' : 'home_button';

  const rectBoton = document.getElementById(target).getBoundingClientRect();
  const rectPadre = selection_circle.parentElement.getBoundingClientRect();
  selection_circle.style.transform = `translateX(${rectBoton.left - rectPadre.left - 5}px)`;
}

buttons.forEach(button => {
  button.addEventListener('click', () => {
    isClicked = true;

    const rectBoton = button.getBoundingClientRect();
    const rect = selection_circle.parentElement.getBoundingClientRect();

    const xRelative = rectBoton.left - rect.left - 5;
    
    selection_circle.style.transform = `translateX(${xRelative}px)`;
    selection_circle.style.width = `${rectBoton.width}px`;
  
    if (button.id === 'home_button') {
      swipe_container.scrollTo({ left: 0, behavior: 'auto' });
    } else if (button.id === 'stats_button') {
      swipe_container.scrollTo({ left: window.innerWidth, behavior: 'auto' });
    } else if (button.id === 'add_product') {
      openCreator(null); // producto nuevo
    }

    setTimeout(() => {
      isClicked = false;
    }, 400); 
  });
});

moveCircleToCurrentPage();

swipe_container.addEventListener('scroll', () => {
  if (isClicked) return;
  moveCircleToCurrentPage();
});

//---------------ALMACENAMIENTO----------------//
const STORAGE_KEY = 'mohan_products';
const MAX_IMAGES = 6;
const MAX_TAGS = 8;

let products = loadProducts();

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.log('Error leyendo productos', err);
    return [];
  }
}

// Devuelve true si se guardó bien
function saveProducts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch (err) {
    console.log('Error guardando productos', err);
    return false;
  }
}

//---------------RENDER DE LA LISTA----------------//
const product_grid = document.getElementById('product_grid');

// Etiqueta (<li>). Si recibe onRemove, se puede pulsar para quitarla.
function createTagChip(text, onRemove) {
  const chip = document.createElement('li');
  chip.className = 'tag_chip';

  if (onRemove) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tag_remove';
    remove.textContent = text + ' ×';
    remove.setAttribute('aria-label', 'Quitar etiqueta ' + text);
    remove.addEventListener('click', onRemove);
    chip.appendChild(remove);
  } else {
    chip.textContent = text;
  }
  return chip;
}

function renderProducts() {
  product_grid.innerHTML = '';

  if (products.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty_text';
    empty.textContent = 'Aún no hay productos. Pulsa + para añadir el primero.';
    product_grid.appendChild(empty);
    return;
  }

  products.forEach(prod => {
    const card = document.createElement('article');
    card.className = 'product';
    card.id = 'product' + prod.id;

    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'product_input_overlay';
    overlay.setAttribute('aria-label', 'Ver ' + prod.name);
    overlay.addEventListener('click', () => openDetail(prod.id));

    const img = document.createElement('img');
    img.className = 'product_img';
    img.src = prod.images[0];
    img.alt = prod.name;

    const info = document.createElement('header');
    info.className = 'product_info';

    const name = document.createElement('h3');
    name.className = 'product_name';
    name.textContent = prod.name;

    const tags = document.createElement('ul');
    tags.className = 'tag_list';
    prod.tags.slice(0, 3).forEach(t => tags.appendChild(createTagChip(t)));
    if (prod.tags.length > 3) tags.appendChild(createTagChip('+' + (prod.tags.length - 3)));

    info.appendChild(name);
    info.appendChild(tags);
    card.appendChild(overlay);
    card.appendChild(img);
    card.appendChild(info);
    product_grid.appendChild(card);
  });
}

//---------------CREAR / EDITAR----------------//
const creator_form = document.getElementById('creator_form');
const creator_title = document.getElementById('creator_title');
const image_input = document.getElementById('image_input');
const image_previews = document.getElementById('image_previews');
const add_image_tile = document.getElementById('add_image_tile');
const title_input = document.getElementById('title_input');
const tag_input = document.getElementById('tag_input');
const add_tag_button = document.getElementById('add_tag_button');
const tag_list = document.getElementById('tag_list');
const creator_error = document.getElementById('creator_error');

let editingId = null;   // null = producto nuevo
let draftImages = [];
let draftTags = [];

function openCreator(prod) {
  editingId = prod ? prod.id : null;
  draftImages = prod ? [...prod.images] : [];
  draftTags = prod ? [...prod.tags] : [];

  creator_title.textContent = prod ? 'Editar producto' : 'Nuevo producto';
  title_input.value = prod ? prod.name : '';
  tag_input.value = '';
  creator_error.textContent = '';

  renderDraftImages();
  renderDraftTags();
  product_creator.scrollTop = 0;
  product_creator.style.transform = 'translateY(0)';
}

function closeCreator() {
  product_creator.style.transform = 'translateY(150vh)';
  moveCircleToCurrentPage();
}

close_product_creator.addEventListener('click', closeCreator);

// Imágenes: se reducen para que quepan en el almacenamiento del móvil
function fileToDataURL(file, maxSize = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

image_input.addEventListener('change', async () => {
  const files = Array.from(image_input.files);
  creator_error.textContent = '';

  for (const file of files) {
    if (draftImages.length >= MAX_IMAGES) {
      creator_error.textContent = `Máximo ${MAX_IMAGES} imágenes por producto.`;
      break;
    }
    try {
      draftImages.push(await fileToDataURL(file));
    } catch (err) {
      creator_error.textContent = 'No se pudo leer una de las imágenes.';
    }
  }

  image_input.value = ''; // permite volver a elegir el mismo archivo
  renderDraftImages();
});

function renderDraftImages() {
  image_previews.querySelectorAll('.preview_item').forEach(el => el.remove());

  draftImages.forEach((src, i) => {
    const item = document.createElement('li');
    item.className = 'preview_item';

    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Imagen ' + (i + 1);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove_badge';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Quitar imagen ' + (i + 1));
    remove.addEventListener('click', () => {
      draftImages.splice(i, 1);
      renderDraftImages();
    });

    item.appendChild(img);
    item.appendChild(remove);
    image_previews.insertBefore(item, add_image_tile);
  });

  add_image_tile.style.display = draftImages.length >= MAX_IMAGES ? 'none' : 'flex';
}

// Etiquetas
function addTag() {
  const value = tag_input.value.trim().toLowerCase();
  if (!value) return;

  if (draftTags.includes(value)) {
    creator_error.textContent = 'Esa etiqueta ya está añadida.';
  } else if (draftTags.length >= MAX_TAGS) {
    creator_error.textContent = `Máximo ${MAX_TAGS} etiquetas.`;
  } else {
    draftTags.push(value);
    creator_error.textContent = '';
    renderDraftTags();
  }
  tag_input.value = '';
}

function renderDraftTags() {
  tag_list.innerHTML = '';
  draftTags.forEach((tag, i) => {
    tag_list.appendChild(createTagChip(tag, () => {
      draftTags.splice(i, 1);
      renderDraftTags();
    }));
  });
}

add_tag_button.addEventListener('click', addTag);
tag_input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault(); // evita que Enter envíe el formulario entero
    addTag();
  }
});

creator_form.addEventListener('submit', (e) => {
  e.preventDefault();
  addTag(); // por si dejó una etiqueta escrita sin pulsar "Añadir"

  const name = title_input.value.trim();
  if (!name) {
    creator_error.textContent = 'Escribe un título para el producto.';
    return;
  }
  if (draftImages.length === 0) {
    creator_error.textContent = 'Añade al menos una imagen.';
    return;
  }

  const backup = JSON.stringify(products);

  if (editingId === null) {
    products.unshift({
      id: Date.now().toString(),
      name,
      images: [...draftImages],
      tags: [...draftTags]
    });
  } else {
    const prod = products.find(p => p.id === editingId);
    prod.name = name;
    prod.images = [...draftImages];
    prod.tags = [...draftTags];
  }

  if (!saveProducts()) {
    products = JSON.parse(backup); // deshace el cambio si no cabe
    creator_error.textContent = 'No hay espacio para guardar. Prueba con menos imágenes.';
    return;
  }

  renderProducts();
  closeCreator();
});

//---------------VISTA DE DETALLE----------------//
const detail_gallery = document.getElementById('detail_gallery');
const detail_title = document.getElementById('detail_title');
const detail_tags = document.getElementById('detail_tags');
const edit_product = document.getElementById('edit_product');
const delete_product = document.getElementById('delete_product');

let currentDetailId = null;

function openDetail(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;
  currentDetailId = id;

  detail_gallery.innerHTML = '';
  prod.images.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = prod.name + ' ' + (i + 1);
    detail_gallery.appendChild(img);
  });
  detail_gallery.scrollLeft = 0;

  detail_title.textContent = prod.name;

  detail_tags.innerHTML = '';
  prod.tags.forEach(t => detail_tags.appendChild(createTagChip(t)));

  close_view.scrollTop = 0;
  close_view.style.transform = 'translateY(0)';
}

function closeDetail() {
  close_view.style.transform = 'translateY(150vh)';
}

close_close_view.addEventListener('click', closeDetail);

edit_product.addEventListener('click', () => {
  const prod = products.find(p => p.id === currentDetailId);
  if (!prod) return;
  closeDetail();
  openCreator(prod);
});

delete_product.addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres borrar este producto?')) return;

  products = products.filter(p => p.id !== currentDetailId);
  saveProducts();
  renderProducts();
  closeDetail();
});

renderProducts();

//---------------ESTADÍSTICAS (DATOS INVENTADOS)----------------//
// Cuando integres Firebase, solo hay que sustituir este bloque FAKE_DATA
// por los datos reales; las funciones de dibujo de abajo no cambian.

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const now = new Date();
const currentMonth = now.getMonth();
const today = now.getDate();
const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

// Generador pseudoaleatorio con semilla: los datos inventados son siempre los mismos
function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seededRandom(2024);

const FAKE_DATA = {
  // Una posición por día transcurrido de este mes
  salesPerDay: Array.from({ length: today }, () => Math.round(rand() * 5)),
  viewsPerDay: Array.from({ length: today }, () => Math.round(60 + rand() * 140)),
  // Una posición por mes (enero → diciembre)
  salesPerMonth: [14, 11, 16, 20, 17, 23, 13, 9, 19, 22, 25, 31],
  moneyPerMonth: [820, 640, 910, 1150, 980, 1320, 760, 540, 1080, 1275, 1430, 1890]
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
  if (text !== undefined) el.textContent = text;
  return el;
}

const CHART = { w: 340, h: 190, l: 34, r: 10, t: 16, b: 26 };
const PLOT_W = CHART.w - CHART.l - CHART.r;
const PLOT_H = CHART.h - CHART.t - CHART.b;

// Calcula un máximo "redondo" para el eje Y
function niceScale(max) {
  const safeMax = Math.max(max, 4);
  const rough = safeMax / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { step, top: step * Math.ceil(safeMax / step) };
}

function createChartSvg(label, top, step) {
  const svg = svgEl('svg', { viewBox: `0 0 ${CHART.w} ${CHART.h}`, role: 'img', 'aria-label': label });

  for (let i = 0; i <= top / step; i++) {
    const value = i * step;
    const y = CHART.t + PLOT_H - (value / top) * PLOT_H;
    svg.appendChild(svgEl('line', { x1: CHART.l, x2: CHART.w - CHART.r, y1: y, y2: y, class: 'chart_grid' }));
    svg.appendChild(svgEl('text', { x: CHART.l - 6, y: y + 3, 'text-anchor': 'end', class: 'chart_text' }, value >= 1000 ? (value / 1000) + 'k' : value));
  }
  return svg;
}

// Gráfica de puntos: un punto por día (los días futuros quedan vacíos)
function renderPointChart(container, values, totalDays, unit, label) {
  const { step, top } = niceScale(Math.max(...values));
  const svg = createChartSvg(label, top, step);

  const xAt = d => CHART.l + ((d - 1) / (totalDays - 1)) * PLOT_W;
  const yAt = v => CHART.t + PLOT_H - (v / top) * PLOT_H;

  for (let d = 1; d <= totalDays; d++) {
    if (d === 1 || d % 5 === 0) {
      svg.appendChild(svgEl('text', { x: xAt(d), y: CHART.h - 8, 'text-anchor': 'middle', class: 'chart_text' }, d));
    }
  }

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i + 1)} ${yAt(v)}`).join(' ');
  svg.appendChild(svgEl('path', { d: path, class: 'chart_line' }));

  values.forEach((v, i) => {
    const point = svgEl('circle', { cx: xAt(i + 1), cy: yAt(v), r: 3.5, class: 'chart_point' });
    point.appendChild(svgEl('title', {}, `Día ${i + 1}: ${v} ${unit}`));
    svg.appendChild(point);
  });

  container.appendChild(svg);
}

// Gráfica de barras: una barra por mes, el mes actual resaltado
function renderBarChart(container, values, labels, highlightIndex, label) {
  const { step, top } = niceScale(Math.max(...values));
  const svg = createChartSvg(label, top, step);

  const slot = PLOT_W / values.length;
  const barW = slot * 0.62;

  values.forEach((v, i) => {
    const height = (v / top) * PLOT_H;
    const x = CHART.l + slot * i + (slot - barW) / 2;
    const y = CHART.t + PLOT_H - height;

    const bar = svgEl('rect', { x, y, width: barW, height, rx: 3, class: 'chart_bar' + (i === highlightIndex ? ' current' : '') });
    bar.appendChild(svgEl('title', {}, `${labels[i]}: ${v} ventas`));
    svg.appendChild(bar);

    svg.appendChild(svgEl('text', { x: x + barW / 2, y: y - 4, 'text-anchor': 'middle', class: 'chart_text chart_value' }, v));
    svg.appendChild(svgEl('text', { x: x + barW / 2, y: CHART.h - 8, 'text-anchor': 'middle', class: 'chart_text' }, labels[i]));
  });

  container.appendChild(svg);
}

// Dinero ganado: este mes primero y, deslizando a la derecha, los meses anteriores
function renderMoney(container, moneyPerMonth) {
  const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  for (let m = currentMonth; m >= 0; m--) {
    const item = document.createElement('li');
    item.className = 'money_item' + (m === currentMonth ? ' current' : '');

    const month = document.createElement('p');
    month.className = 'money_month';
    month.textContent = m === currentMonth
      ? 'Este mes'
      : MONTH_NAMES[m].charAt(0).toUpperCase() + MONTH_NAMES[m].slice(1);

    const amount = document.createElement('strong');
    amount.className = 'money_amount';
    amount.textContent = euros.format(moneyPerMonth[m]);

    item.appendChild(month);
    item.appendChild(amount);
    container.appendChild(item);
  }
}

function sum(list) {
  return list.reduce((a, b) => a + b, 0);
}

function renderStats() {
  const number = new Intl.NumberFormat('es-ES');

  renderMoney(document.getElementById('money_scroller'), FAKE_DATA.moneyPerMonth);

  document.getElementById('sales_total').textContent = number.format(sum(FAKE_DATA.salesPerDay)) + ' ventas';
  renderPointChart(document.getElementById('sales_chart'), FAKE_DATA.salesPerDay, daysInMonth, 'ventas', 'Ventas por día este mes');

  document.getElementById('views_total').textContent = number.format(sum(FAKE_DATA.viewsPerDay)) + ' visitas';
  renderPointChart(document.getElementById('views_chart'), FAKE_DATA.viewsPerDay, daysInMonth, 'visitas', 'Visitas a la web por día este mes');

  document.getElementById('year_total').textContent = number.format(sum(FAKE_DATA.salesPerMonth)) + ' en el año';
  renderBarChart(document.getElementById('months_chart'), FAKE_DATA.salesPerMonth, MONTH_SHORT, currentMonth, 'Ventas de cada mes del año');
}

renderStats();

//------------------PWA------------------//
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('PWA successfully registered', reg))
        .catch(err => console.log('Error registering PWA', err));
    });
}

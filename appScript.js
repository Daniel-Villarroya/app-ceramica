//---------------TECLADO Y PANTALLA (iOS)----------------//
// En iOS, al abrir el teclado la página se desplaza y al cerrarlo a veces no vuelve a su sitio.
// - Las ventanas flotantes se ajustan a la zona visible (--app-height / --app-top).
// - Al cerrar el teclado se devuelve la página a su posición.
const docRoot = document.documentElement;

function syncViewport() {
  const vv = window.visualViewport;
  docRoot.style.setProperty('--app-height', (vv ? vv.height : window.innerHeight) + 'px');
  docRoot.style.setProperty('--app-top', (vv ? vv.offsetTop : 0) + 'px');
}

function isTypingElement(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

function resetPageScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

syncViewport();
window.addEventListener('resize', syncViewport);

if (window.visualViewport) {
  window.visualViewport.addEventListener('scroll', syncViewport);
  window.visualViewport.addEventListener('resize', () => {
    syncViewport();
    // Teclado cerrado (la zona visible vuelve a ser toda la pantalla)
    if (window.visualViewport.height >= window.innerHeight - 1) resetPageScroll();
  });
}

document.addEventListener('focusout', (e) => {
  if (!isTypingElement(e.target)) return;
  [100, 400].forEach(delay => setTimeout(() => {
    if (!isTypingElement(document.activeElement)) {
      resetPageScroll();
      syncViewport();
    }
  }, delay));
});

const buttons = document.querySelectorAll('.options_button');
const close_product_creator = document.getElementById('close_creator');
const close_view = document.getElementById('close_view');
const close_close_view = document.getElementById('close_close_view');
const selection_circle = document.getElementById('options_circle');
const swipe_container = document.getElementById('swipe_container');

const product_creator = document.getElementById('product_creator');
let isClicked = false;

//---------------NAVEGACIÓN----------------//
// Orden de las páginas del carrusel (el + del centro no es una página, abre el creador)
const PAGE_BUTTONS = ['home_button', 'chats_button', 'stats_button', 'user_button'];
const USER_PAGE = 3;

if (buttons.length > 0) {
  selection_circle.style.width = `${buttons[0].getBoundingClientRect().width}px`;
  selection_circle.style.transform = `translateX(${buttons[0].getBoundingClientRect().left - selection_circle.parentElement.getBoundingClientRect().left - 5}px)`;
}

function positionCircleOn(button) {
  const rectBoton = button.getBoundingClientRect();
  const rectPadre = selection_circle.parentElement.getBoundingClientRect();
  selection_circle.style.transform = `translateX(${rectBoton.left - rectPadre.left - 5}px)`;
  selection_circle.style.width = `${rectBoton.width}px`;
}

function currentPageIndex() {
  const index = Math.round(swipe_container.scrollLeft / window.innerWidth);
  return Math.min(Math.max(index, 0), PAGE_BUTTONS.length - 1);
}

function moveCircleToCurrentPage() {
  positionCircleOn(document.getElementById(PAGE_BUTTONS[currentPageIndex()]));
}

function goToPage(index) {
  isClicked = true;
  positionCircleOn(document.getElementById(PAGE_BUTTONS[index]));
  swipe_container.scrollTo({ left: index * window.innerWidth, behavior: 'auto' });

  setTimeout(() => {
    isClicked = false;
  }, 600);
}

buttons.forEach(button => {
  button.addEventListener('click', () => {
    if (button.id === 'add_product') {
      // Sin sesión de administrador no se puede crear: te lleva a la pestaña de usuario
      if (!currentAdminUser) {
        goToPage(USER_PAGE);
        return;
      }
      isClicked = true;
      positionCircleOn(button);
      openCreator(null);
      setTimeout(() => {
        isClicked = false;
      }, 400);
      return;
    }

    goToPage(PAGE_BUTTONS.indexOf(button.id));
  });
});

moveCircleToCurrentPage();

swipe_container.addEventListener('scroll', () => {
  if (isClicked) return;
  moveCircleToCurrentPage();
});

//---------------USUARIO: INICIO DE SESIÓN (SUPABASE)----------------//
let currentAdminUser = null;   // usuario administrador con sesión iniciada (o null)
let currentProfile = null;     // su fila de la tabla users: { user_name, email, admin }

const supabaseReady = typeof db !== 'undefined';

const login_form = document.getElementById('login_form');
const login_email = document.getElementById('login_email');
const login_password = document.getElementById('login_password');
const login_error = document.getElementById('login_error');
const login_submit = document.getElementById('login_submit');
const account_card = document.getElementById('account_card');
const account_initial = document.getElementById('account_initial');
const account_name = document.getElementById('account_name');
const account_email = document.getElementById('account_email');
const logout_button = document.getElementById('logout_button');

const login_notice = document.getElementById('login_notice');
const register_form = document.getElementById('register_form');
const reg_name = document.getElementById('reg_name');
const reg_email = document.getElementById('reg_email');
const reg_password = document.getElementById('reg_password');
const reg_password2 = document.getElementById('reg_password2');
const reg_error = document.getElementById('reg_error');
const register_submit = document.getElementById('register_submit');
const show_register = document.getElementById('show_register');
const show_login = document.getElementById('show_login');

let authMode = 'login';           // 'login' | 'register'
let suppressAuthEvents = false;   // true mientras se crea una cuenta

// Muestra el formulario que toque: login, registro o la cuenta ya iniciada
function renderAuthForms() {
  const loggedOut = !currentAdminUser;
  login_form.hidden = !(loggedOut && authMode === 'login');
  register_form.hidden = !(loggedOut && authMode === 'register');
  account_card.hidden = loggedOut;
}

function setAuthMode(mode) {
  authMode = mode;
  login_error.textContent = '';
  reg_error.textContent = '';
  renderAuthForms();
}

show_register.addEventListener('click', () => {
  login_notice.textContent = '';
  setAuthMode('register');
});
show_login.addEventListener('click', () => setAuthMode('login'));

function friendlySignUpError(error) {
  const msg = ((error && error.message) || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Ya existe una cuenta con ese correo.';
  if (msg.includes('invalid') && msg.includes('email')) return 'El correo no es válido.';
  if (msg.includes('password')) return 'La contraseña es demasiado corta o débil.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Espera un poco y vuelve a probar.';
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled')) return 'El registro está desactivado en Supabase.';
  if (msg.includes('fetch') || msg.includes('network')) return 'No hay conexión con el servidor.';
  return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
}

function friendlyAuthError(error) {
  const msg = ((error && error.message) || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.';
  if (msg.includes('fetch') || msg.includes('network')) return 'No hay conexión con el servidor.';
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

function showProductsMessage(text) {
  product_grid.innerHTML = '';
  const message = document.createElement('p');
  message.className = 'empty_text';
  message.textContent = text;
  product_grid.appendChild(message);
}

function setLoggedOut() {
  currentAdminUser = null;
  currentProfile = null;

  renderAuthForms();

  resetChats();
  products = [];
  showProductsMessage('Inicia sesión en la pestaña de usuario para ver tus productos.');
}

function setLoggedIn(user, profile) {
  currentAdminUser = user;
  currentProfile = profile;

  const name = profile.user_name || profile.email || user.email || 'Administrador';
  account_initial.textContent = name.charAt(0).toUpperCase();
  account_name.textContent = name;
  account_email.textContent = profile.email || user.email || '';

  login_error.textContent = '';
  renderAuthForms();

  loadProducts();
  startChats();
}

// Lee la sesión guardada y decide si mostrar el login o la cuenta.
// El contador evita que una respuesta lenta pise a otra más reciente.
let sessionCheck = 0;

async function applySession() {
  const mine = ++sessionCheck;

  const { data: { session } } = await db.auth.getSession();
  if (mine !== sessionCheck) return;

  if (!session) {
    setLoggedOut();
    return;
  }

  // Misma sesión que ya está abierta: no recargamos nada
  if (currentAdminUser && currentAdminUser.id === session.user.id) return;

  const { data: profile, error } = await db
    .from('users')
    .select('user_name, email, admin')
    .eq('id', session.user.id)
    .single();
  if (mine !== sessionCheck) return;

  // Error distinto de "no existe la fila": probablemente sin conexión, no cerramos la sesión
  if (error && error.code !== 'PGRST116') {
    login_error.textContent = 'No se pudo comprobar tu cuenta. Revisa tu conexión.';
    setLoggedOut();
    return;
  }

  if (!profile || !profile.admin) {
    login_error.textContent = 'Esta cuenta no tiene permisos de administrador.';
    await db.auth.signOut();
    setLoggedOut();
    return;
  }

  setLoggedIn(session.user, profile);
}

login_form.addEventListener('submit', async (e) => {
  e.preventDefault();
  login_error.textContent = '';
  login_notice.textContent = '';

  if (!supabaseReady) {
    login_error.textContent = 'No se pudo conectar con Supabase. Revisa los scripts de index.html.';
    return;
  }

  const email = login_email.value.trim();
  const password = login_password.value;
  if (!email || !password) {
    login_error.textContent = 'Escribe tu correo y tu contraseña.';
    return;
  }

  login_submit.disabled = true;
  login_submit.textContent = 'Entrando...';

  const { error } = await db.auth.signInWithPassword({ email, password });

  login_submit.disabled = false;
  login_submit.textContent = 'Entrar';

  if (error) {
    login_error.textContent = friendlyAuthError(error);
    return;
  }
  login_password.value = '';
  // El resto lo hace onAuthStateChange -> applySession()
});

logout_button.addEventListener('click', async () => {
  logout_button.disabled = true;
  await db.auth.signOut();
  logout_button.disabled = false;
  setLoggedOut();
});

register_form.addEventListener('submit', async (e) => {
  e.preventDefault();
  reg_error.textContent = '';

  if (!supabaseReady) {
    reg_error.textContent = 'No se pudo conectar con Supabase. Revisa los scripts de index.html.';
    return;
  }

  const name = reg_name.value.trim();
  const email = reg_email.value.trim();
  const password = reg_password.value;

  if (!name || !email || !password) {
    reg_error.textContent = 'Rellena todos los campos.';
    return;
  }
  if (password.length < 6) {
    reg_error.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  if (password !== reg_password2.value) {
    reg_error.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  register_submit.disabled = true;
  register_submit.textContent = 'Creando cuenta...';
  suppressAuthEvents = true;   // no queremos que el login automático dispare applySession

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { user_name: name } }
    });

    if (error) {
      reg_error.textContent = friendlySignUpError(error);
      return;
    }

    // Correo ya registrado: Supabase no da error, devuelve un usuario sin identidades
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      reg_error.textContent = 'Ya existe una cuenta con ese correo.';
      return;
    }

    let message;
    if (data.session) {
      // Sin confirmación por correo: ya hay sesión. Intentamos guardar el perfil en la tabla users
      // (si un trigger de Supabase ya lo crea, esto no cambia nada) y cerramos: aún no es admin.
      await db.from('users').upsert({ id: data.user.id, user_name: name, email }, { onConflict: 'id' });
      await db.auth.signOut();
      message = 'Cuenta creada. Un administrador debe darte permisos antes de que puedas entrar.';
    } else {
      message = 'Cuenta creada. Confirma tu correo y después un administrador debe darte permisos para entrar.';
    }

    register_form.reset();
    login_email.value = email;
    setAuthMode('login');
    login_notice.textContent = message;
  } finally {
    suppressAuthEvents = false;
    register_submit.disabled = false;
    register_submit.textContent = 'Crear cuenta';
  }
});

function initAuth() {
  if (!supabaseReady) {
    login_error.textContent = 'No se pudo conectar con Supabase. Revisa los scripts de index.html.';
    setLoggedOut();
    return;
  }

  db.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || suppressAuthEvents) return;
    // No se llama a Supabase dentro del propio callback (puede bloquearse): se aplaza
    setTimeout(applySession, 0);
  });

  applySession();
}

//---------------ALMACENAMIENTO EN SUPABASE----------------//
const MAX_IMAGES = 6;
const MAX_TAGS = 8;

let products = [];
const product_grid = document.getElementById('product_grid');

async function loadProducts() {
  product_grid.innerHTML = '<p class="empty_text">Cargando productos...</p>';

  const { data, error } = await db
    .from('products')
    .select(`
      id,
      title,
      description,
      created_at,
      previews ( id, url, type ),
      product_tags ( tags ( id, name ) )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error leyendo productos:', error);
    product_grid.innerHTML = '<p class="empty_text">Error al cargar productos.</p>';
    return;
  }

  products = data.map(item => ({
    id: item.id,
    name: item.title,
    desc: item.description || '',
    images: (item.previews || [])
      .filter(p => p.type === 'image')
      .map(p => p.url),
    tags: (item.product_tags || [])
      .map(pt => pt.tags?.name)
      .filter(Boolean)
  }));

  renderProducts();
}

//---------------RENDER DE LA LISTA----------------//
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
    img.src = prod.images[0] || '';
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
const desc_input = document.getElementById('desc_input');
const desc_counter = document.getElementById('desc_counter');
const tag_input = document.getElementById('tag_input');
const add_tag_button = document.getElementById('add_tag_button');
const tag_list = document.getElementById('tag_list');
const creator_error = document.getElementById('creator_error');

let editingId = null;
let draftImages = [];
let draftTags = [];

function openCreator(prod) {
  editingId = prod ? prod.id : null;
  draftImages = prod
    ? prod.images.map(url => ({ previewUrl: url, existingUrl: url }))
    : [];
  draftTags = prod ? [...prod.tags] : [];

  creator_title.textContent = prod ? 'Editar producto' : 'Nuevo producto';
  title_input.value = prod ? prod.name : '';
  desc_input.value = prod ? (prod.desc || '') : '';
  updateDescCounter();
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

function updateDescCounter() {
  desc_counter.textContent = `${desc_input.value.length} / ${desc_input.maxLength}`;
}

desc_input.addEventListener('input', updateDescCounter);

function compressImageFile(file, maxSize = 1000, quality = 0.8) {
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

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Error comprimiendo imagen'));
          resolve({
            blob,
            previewUrl: URL.createObjectURL(blob)
          });
        }, 'image/jpeg', quality);
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
      const compressed = await compressImageFile(file);
      draftImages.push({
        previewUrl: compressed.previewUrl,
        file: compressed.blob
      });
    } catch (err) {
      creator_error.textContent = 'No se pudo leer una de las imágenes.';
    }
  }

  image_input.value = '';
  renderDraftImages();
});

function renderDraftImages() {
  image_previews.querySelectorAll('.preview_item').forEach(el => el.remove());

  draftImages.forEach((itemObj, i) => {
    const item = document.createElement('li');
    item.className = 'preview_item';

    const img = document.createElement('img');
    img.src = itemObj.previewUrl;
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
    e.preventDefault();
    addTag();
  }
});

async function uploadImageToStorage(blob, index) {
  const fileName = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await db.storage
    .from('productos')
    .upload(fileName, blob, { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = db.storage.from('productos').getPublicUrl(fileName);
  return data.publicUrl;
}

async function syncProductTags(productId, tagsArray) {
  await db.from('product_tags').delete().eq('product_id', productId);

  for (const tagName of tagsArray) {
    let { data: tag } = await db.from('tags').select('id').eq('name', tagName).maybeSingle();
    if (!tag) {
      const { data: newTag } = await db.from('tags').insert({ name: tagName }).select('id').single();
      tag = newTag;
    }
    if (tag) {
      await db.from('product_tags').insert({ product_id: productId, tag_id: tag.id });
    }
  }
}

creator_form.addEventListener('submit', async (e) => {
  e.preventDefault();
  addTag();

  const name = title_input.value.trim();
  const desc = desc_input.value.trim();
  if (!name) {
    creator_error.textContent = 'Escribe un título para el producto.';
    return;
  }
  if (draftImages.length === 0) {
    creator_error.textContent = 'Añade al menos una imagen.';
    return;
  }

  const submitBtn = creator_form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publicando...';
  creator_error.textContent = '';

  try {
    let productId = editingId;

    if (editingId === null) {
      const { data: newProd, error } = await db
        .from('products')
        .insert({
          title: name,
          description: desc,
          seller_id: currentAdminUser.id
        })
        .select('id')
        .single();

      if (error) throw error;
      productId = newProd.id;
    } else {
      const { error } = await db
        .from('products')
        .update({ title: name, description: desc })
        .eq('id', editingId);

      if (error) throw error;
    }

    const finalUrls = [];
    for (let i = 0; i < draftImages.length; i++) {
      const item = draftImages[i];
      if (item.existingUrl) {
        finalUrls.push(item.existingUrl);
      } else if (item.file) {
        const publicUrl = await uploadImageToStorage(item.file, i);
        finalUrls.push(publicUrl);
      }
    }

    await db.from('previews').delete().eq('product_id', productId).eq('type', 'image');
    const previewsToInsert = finalUrls.map(url => ({
      product_id: productId,
      url: url,
      type: 'image'
    }));
    const { error: prevError } = await db.from('previews').insert(previewsToInsert);
    if (prevError) throw prevError;

    await syncProductTags(productId, draftTags);

    await loadProducts();
    closeCreator();
  } catch (err) {
    console.error('Error guardando en Supabase:', err);
    creator_error.textContent = 'Error al publicar: ' + (err.message || 'Inténtalo de nuevo');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});

//---------------VISTA DE DETALLE----------------//
const detail_gallery = document.getElementById('detail_gallery');
const detail_title = document.getElementById('detail_title');
const detail_desc = document.getElementById('detail_desc');
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
  detail_desc.textContent = prod.desc || '';
  detail_desc.hidden = !prod.desc;

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

delete_product.addEventListener('click', async () => {
  if (!confirm('¿Seguro que quieres borrar este producto?')) return;

  delete_product.disabled = true;
  delete_product.textContent = 'Borrando...';

  const { error } = await db.from('products').delete().eq('id', currentDetailId);

  delete_product.disabled = false;
  delete_product.textContent = 'Borrar';

  if (error) {
    alert('Error al borrar el producto: ' + error.message);
    return;
  }

  await loadProducts();
  closeDetail();
});

//---------------CHATS CON USUARIOS (SUPABASE)----------------//
const chats_prompt = document.getElementById('chats_prompt');
const chats_status = document.getElementById('chats_status');
const chat_list = document.getElementById('chat_list');
const go_login = document.getElementById('go_login');

const chat_window = document.getElementById('chat_window');
const close_chat = document.getElementById('close_chat');
const chat_avatar = document.getElementById('chat_avatar');
const chat_title = document.getElementById('chat_title');
const chat_subtitle = document.getElementById('chat_subtitle');
const chat_messages = document.getElementById('chat_messages');
const chat_error = document.getElementById('chat_error');
const chat_form = document.getElementById('chat_form');
const chat_text = document.getElementById('chat_text');
const chat_send = document.getElementById('chat_send');

let chatsData = [];            // [{ id, created_at, other, last }]
let activeChat = null;
let inboxChannel = null;       // canal realtime con todos los mensajes nuevos
let renderedKeys = new Set();  // mensajes ya dibujados (evita duplicados)
let lastRenderedDay = '';
let ignoredChatIds = new Set();
let chatsLoadId = 0;
let sendingMessage = false;

go_login.addEventListener('click', () => goToPage(USER_PAGE));

// ---- Utilidades ----
function chatName(chat) {
  return chat.other.user_name || chat.other.email || 'Usuario';
}

function chatClock(iso) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function chatListTime(iso) {
  const ts = new Date(iso).getTime();
  if (ts >= startOfToday()) return chatClock(iso);
  if (ts >= startOfToday() - 86400000) return 'ayer';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

function chatDayLabel(iso) {
  const ts = new Date(iso).getTime();
  if (ts >= startOfToday()) return 'Hoy';
  if (ts >= startOfToday() - 86400000) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function chatActivity(chat) {
  return Date.parse(chat.last ? chat.last.send_date : chat.created_at) || 0;
}

function sortChats() {
  chatsData.sort((a, b) => chatActivity(b) - chatActivity(a));
}

function messageKey(msg) {
  return msg.id !== undefined && msg.id !== null ? 'id:' + msg.id : [msg.sender_id, msg.send_date, msg.text].join('|');
}

// ---- Lista de chats ----
async function loadChats() {
  const myLoad = ++chatsLoadId;
  chats_status.textContent = 'Cargando chats...';

  const raw = await obtenerBandejaChatsAdmin();   // de admin_supabase.js
  const ids = raw.map(c => c.id);

  // Último mensaje de cada chat (una sola consulta)
  const lastByChat = {};
  if (ids.length > 0) {
    const { data } = await db
      .from('messages')
      .select('chat_id, text, send_date, sender_id')
      .in('chat_id', ids)
      .order('send_date', { ascending: false })
      .limit(500);
    (data || []).forEach(m => {
      if (!lastByChat[m.chat_id]) lastByChat[m.chat_id] = m;
    });
  }

  if (myLoad !== chatsLoadId || !currentAdminUser) return;

  chatsData = raw.map(c => {
    const other = c.user1 && c.user1.id === currentAdminUser.id ? c.user2 : c.user1;
    return { id: c.id, created_at: c.created_at, other: other || {}, last: lastByChat[c.id] || null };
  });

  sortChats();
  renderChatList();
}

function renderChatList() {
  chat_list.innerHTML = '';

  if (chatsData.length === 0) {
    chats_status.textContent = 'Todavía no tienes chats con usuarios.';
    return;
  }
  chats_status.textContent = '';

  chatsData.forEach(chat => {
    const item = document.createElement('li');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat_item';
    button.setAttribute('aria-label', 'Abrir chat con ' + chatName(chat));
    button.addEventListener('click', () => openChat(chat));

    const avatar = document.createElement('span');
    avatar.className = 'chat_avatar';
    avatar.textContent = chatName(chat).charAt(0).toUpperCase();

    const text = document.createElement('span');
    text.className = 'chat_item_text';

    const name = document.createElement('strong');
    name.className = 'chat_item_name';
    name.textContent = chatName(chat);

    const preview = document.createElement('span');
    preview.className = 'chat_preview';
    preview.textContent = chat.last
      ? (chat.last.sender_id === currentAdminUser.id ? 'Tú: ' : '') + chat.last.text
      : 'Sin mensajes todavía';

    text.appendChild(name);
    text.appendChild(preview);

    const time = document.createElement('time');
    time.className = 'chat_time';
    if (chat.last) {
      time.dateTime = chat.last.send_date;
      time.textContent = chatListTime(chat.last.send_date);
    }

    button.appendChild(avatar);
    button.appendChild(text);
    button.appendChild(time);
    item.appendChild(button);
    chat_list.appendChild(item);
  });
}

// ---- Conversación ----
function createMessageItem(msg, isNew) {
  const item = document.createElement('li');
  item.className = 'message ' + (msg.sender_id === currentAdminUser.id ? 'mine' : 'theirs') + (isNew ? ' new' : '');

  const bubble = document.createElement('p');
  bubble.className = 'bubble';
  bubble.textContent = msg.text;

  const time = document.createElement('time');
  time.className = 'message_time';
  time.dateTime = msg.send_date;
  time.textContent = chatClock(msg.send_date);

  item.appendChild(bubble);
  item.appendChild(time);
  return item;
}

function appendMessage(msg, isNew) {
  const key = messageKey(msg);
  if (renderedKeys.has(key)) return;
  renderedKeys.add(key);

  const hint = chat_messages.querySelector('.chat_hint');
  if (hint) hint.remove();

  const dayKey = new Date(msg.send_date).toDateString();
  if (dayKey !== lastRenderedDay) {
    lastRenderedDay = dayKey;
    const separator = document.createElement('li');
    separator.className = 'day_separator';
    separator.textContent = chatDayLabel(msg.send_date);
    chat_messages.appendChild(separator);
  }

  chat_messages.appendChild(createMessageItem(msg, isNew));
}

function showChatHint(text) {
  chat_messages.innerHTML = '';
  const hint = document.createElement('li');
  hint.className = 'chat_hint';
  hint.textContent = text;
  chat_messages.appendChild(hint);
}

function scrollChatToBottom(smooth) {
  chat_messages.scrollTo({ top: chat_messages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

async function openChat(chat) {
  activeChat = chat;

  chat_title.textContent = chatName(chat);
  chat_subtitle.textContent = chat.other.user_name && chat.other.email ? chat.other.email : '';
  chat_avatar.textContent = chatName(chat).charAt(0).toUpperCase();
  chat_error.textContent = '';
  chat_text.value = '';
  resizeChatText();
  chat_send.disabled = true;

  renderedKeys = new Set();
  lastRenderedDay = '';
  showChatHint('Cargando mensajes...');
  chat_window.style.transform = 'translateY(0)';

  const history = await obtenerHistorialChat(chat.id);   // de admin_supabase.js
  if (activeChat !== chat) return;   // se cerró mientras cargaba

  chat_messages.innerHTML = '';
  if (history.length === 0) {
    showChatHint('Todavía no hay mensajes en este chat.');
  } else {
    history.forEach(msg => appendMessage(msg, false));
  }
  scrollChatToBottom(false);
}

function closeChatWindow() {
  chat_window.style.transform = 'translateY(150vh)';
  activeChat = null;
}

close_chat.addEventListener('click', closeChatWindow);

// Mensaje nuevo (de la otra persona por realtime, o enviado por mí)
function handleNewMessage(msg) {
  const chat = chatsData.find(c => c.id === msg.chat_id);

  if (!chat) {
    // Chat que no conocemos (p. ej. uno nuevo): lo recargamos una vez
    if (!ignoredChatIds.has(msg.chat_id)) {
      ignoredChatIds.add(msg.chat_id);
      loadChats();
    }
    return;
  }

  if (!chat.last || Date.parse(msg.send_date) >= Date.parse(chat.last.send_date)) {
    chat.last = { chat_id: msg.chat_id, text: msg.text, send_date: msg.send_date, sender_id: msg.sender_id };
  }
  sortChats();
  renderChatList();

  if (activeChat && activeChat.id === msg.chat_id) {
    appendMessage(msg, true);
    scrollChatToBottom(true);
  }
}

// ---- Enviar ----
async function sendChatMessage() {
  const text = chat_text.value.trim();
  if (!text || !activeChat || !currentAdminUser || sendingMessage) return;

  sendingMessage = true;
  chat_send.disabled = true;
  chat_error.textContent = '';

  const { data, error } = await db
    .from('messages')
    .insert({ chat_id: activeChat.id, sender_id: currentAdminUser.id, text })
    .select()
    .single();

  sendingMessage = false;

  if (error || !data) {
    chat_error.textContent = 'No se pudo enviar el mensaje. Inténtalo de nuevo.';
    chat_send.disabled = chat_text.value.trim() === '';
    return;
  }

  chat_text.value = '';
  resizeChatText();
  chat_send.disabled = true;
  handleNewMessage(data);   // si el realtime lo trae después, se ignora (ya está dibujado)
}

function resizeChatText() {
  chat_text.style.height = 'auto';
  chat_text.style.height = Math.min(chat_text.scrollHeight, 120) + 'px';
}

chat_text.addEventListener('input', () => {
  resizeChatText();
  chat_send.disabled = chat_text.value.trim() === '';
});

// En ordenador Enter envía (Shift+Enter = salto de línea); en el móvil Enter hace salto de línea
chat_text.addEventListener('keydown', (e) => {
  const hasKeyboard = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (hasKeyboard && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendChatMessage();
  }
});

chat_form.addEventListener('submit', (e) => {
  e.preventDefault();
  sendChatMessage();
});

// ---- Tiempo real ----
function startInbox() {
  stopInbox();
  inboxChannel = db
    .channel('admin-inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => handleNewMessage(payload.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' },
      () => loadChats())
    .subscribe();
}

function stopInbox() {
  if (inboxChannel) {
    db.removeChannel(inboxChannel);
    inboxChannel = null;
  }
}

function startChats() {
  chats_prompt.hidden = true;
  loadChats();
  startInbox();
}

function resetChats() {
  chatsLoadId++;
  chatsData = [];
  ignoredChatIds = new Set();
  chat_list.innerHTML = '';
  chats_status.textContent = '';
  chats_prompt.hidden = false;
  closeChatWindow();
  stopInbox();
}


//---------------ESTADÍSTICAS (DATOS INVENTADOS)----------------//
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const now = new Date();
const currentMonth = now.getMonth();
const today = now.getDate();
const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

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
  salesPerDay: Array.from({ length: today }, () => Math.round(rand() * 5)),
  viewsPerDay: Array.from({ length: today }, () => Math.round(60 + rand() * 140)),
  salesPerMonth: [3, 5, 8, 6, 10, 7, 5, 6, 9, 4, 5, 7],
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

//------------------ARRANQUE------------------//
initAuth();

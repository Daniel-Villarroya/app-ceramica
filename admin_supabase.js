// ==========================================
// 1. SEGURIDAD Y ACCESO DE ADMINISTRADOR
// ==========================================
async function iniciarSesionAdmin(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Error de acceso: ' + error.message);
    return false;
  }

  const esAdmin = await verificarAccesoAdmin(false);
  return esAdmin;
}

async function verificarAccesoAdmin(redirigirSiFalla = true) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    if (redirigirSiFalla) window.location.href = 'login-admin.html';
    return false;
  }

  const { data: perfil } = await db
    .from('users')
    .select('admin')
    .eq('id', user.id)
    .single();

  if (!perfil || !perfil.admin) {
    await db.auth.signOut();
    alert('Acceso denegado: esta cuenta no tiene permisos de administrador.');
    if (redirigirSiFalla) window.location.href = 'login-admin.html';
    return false;
  }
  return true;
}

async function cerrarSesionAdmin() {
  await db.auth.signOut();
  window.location.href = 'login-admin.html';
}

// Dar permiso de administrador a otro usuario por su email
async function hacerAdminPorEmail(emailUsuario) {
  const { error } = await db
    .from('users')
    .update({ admin: true })
    .eq('email', emailUsuario);

  if (error) {
    alert('Error asignando admin: ' + error.message);
    return false;
  }
  return true;
}

// ==========================================
// 2. GESTIÓN DE PRODUCTOS (Crear, Editar, Borrar)
// ==========================================
async function subirArchivoStorage(archivo) {
  const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const nombreUnico = `${Date.now()}-${nombreLimpio}`;

  const { error } = await db.storage.from('productos').upload(nombreUnico, archivo);
  if (error) throw error;

  const { data } = db.storage.from('productos').getPublicUrl(nombreUnico);
  return data.publicUrl;
}

async function publicarProducto(titulo, descripcion, archivoFoto = null, archivo3D = null, etiquetas = []) {
  const { data: { user } } = await db.auth.getUser();

  // 1. Insertar producto
  const { data: producto, error } = await db
    .from('products')
    .insert({ title: titulo, description: descripcion, seller_id: user.id })
    .select()
    .single();

  if (error) {
    alert('Error al crear producto: ' + error.message);
    return null;
  }

  // 2. Subir foto si existe
  if (archivoFoto) {
    const urlFoto = await subirArchivoStorage(archivoFoto);
    await db.from('previews').insert({ product_id: producto.id, url: urlFoto, type: 'image' });
  }

  // 3. Subir modelo 3D si existe
  if (archivo3D) {
    const url3D = await subirArchivoStorage(archivo3D);
    await db.from('previews').insert({ product_id: producto.id, url: url3D, type: 'model' });
  }

  // 4. Guardar etiquetas (tags) si se pasaron como array ['mueble', 'madera']
  for (const nombreTag of etiquetas) {
    const tagLimpio = nombreTag.trim().toLowerCase();
    if (!tagLimpio) continue;

    // Buscar o crear tag
    let { data: tag } = await db.from('tags').select('id').eq('name', tagLimpio).maybeSingle();
    if (!tag) {
      const { data: nuevoTag } = await db.from('tags').insert({ name: tagLimpio }).select('id').single();
      tag = nuevoTag;
    }
    if (tag) {
      await db.from('product_tags').insert({ product_id: producto.id, tag_id: tag.id });
    }
  }

  return producto;
}

async function editarProducto(productId, nuevoTitulo, nuevaDescripcion) {
  const { error } = await db
    .from('products')
    .update({ title: nuevoTitulo, description: nuevaDescripcion })
    .eq('id', productId);

  if (error) {
    alert('Error al editar: ' + error.message);
    return false;
  }
  return true;
}

async function eliminarProducto(productId) {
  const { error } = await db.from('products').delete().eq('id', productId);
  if (error) {
    alert('Error al eliminar: ' + error.message);
    return false;
  }
  return true;
}

// ==========================================
// 3. BANDEJA DE CHATS DEL ADMINISTRADOR
// ==========================================
async function obtenerBandejaChatsAdmin() {
  const { data: { user } } = await db.auth.getUser();
  const { data: chats, error } = await db
    .from('chats')
    .select(`
      id,
      created_at,
      user1:users!chats_user1_id_fkey ( id, user_name, email ),
      user2:users!chats_user2_id_fkey ( id, user_name, email )
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando chats:', error);
    return [];
  }
  return chats;
}

async function obtenerHistorialChat(chatId) {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('send_date', { ascending: true });

  if (error) return [];
  return data;
}

async function enviarMensajeAdmin(chatId, texto) {
  const { data: { user } } = await db.auth.getUser();
  if (!user || !texto.trim()) return;

  await db.from('messages').insert({
    chat_id: chatId,
    sender_id: user.id,
    text: texto.trim()
  });
}

function escucharChatAdmin(chatId, callbackNuevoMensaje) {
  return db
    .channel('admin-chat-' + chatId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      },
      (payload) => {
        callbackNuevoMensaje(payload.new);
      }
    )
    .subscribe();
}

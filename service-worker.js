self.addEventListener('install', (e) => {
  // Activa el modo de instalación
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Permite que la app cargue sus archivos locales
});

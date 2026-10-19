// Puente seguro entre las páginas (editor, gestor, juego) y el proceso principal.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const escuchar = (canal) => (fn) => {
  const h = (e, datos) => fn(datos);
  ipcRenderer.on(canal, h);
  return () => ipcRenderer.removeListener(canal, h);
};

contextBridge.exposeInMainWorld('falcon', {
  plataforma: process.platform,
  ventana: {
    minimizar: () => ipcRenderer.send('ventana:minimizar'),
    maximizar: () => ipcRenderer.send('ventana:maximizar'),
    cerrar: () => ipcRenderer.send('ventana:cerrar'),
    maximizada: () => ipcRenderer.invoke('ventana:maximizada'),
    titulo: (t) => ipcRenderer.send('ventana:titulo', t),
    alCambiar: escuchar('ventana:estado'),
    enfocarEditor: () => ipcRenderer.send('ventana:enfocar-editor'),
    pantallaCompleta: () => ipcRenderer.send('ventana:pantalla-completa'),
    tamanoContenido: (ancho, alto) => ipcRenderer.send('ventana:tamano-contenido', { ancho, alto }),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    datos: () => ipcRenderer.invoke('app:datos'),
    guardarDatos: (d) => ipcRenderer.invoke('app:guardar-datos', d),
    abrirProyecto: (ruta) => ipcRenderer.send('app:abrir-proyecto', ruta),
    gestor: () => ipcRenderer.send('app:gestor'),
    archivoProyecto: (ruta) => ipcRenderer.invoke('app:archivo-proyecto', ruta),
  },
  actualizaciones: {
    estado: () => ipcRenderer.invoke('actualizaciones:estado'),
    comprobar: (manual = true) => ipcRenderer.invoke('actualizaciones:comprobar', manual),
    descargar: () => ipcRenderer.invoke('actualizaciones:descargar'),
    instalar: (alSalir = false) => ipcRenderer.invoke('actualizaciones:instalar', alSalir),
    configurar: (op) => ipcRenderer.invoke('actualizaciones:configurar', op),
    alCambiar: escuchar('actualizaciones:estado'),
  },
  fs: {
    leer: async (ruta, codificacion) => {
      const r = await ipcRenderer.invoke('fs:leer', ruta, codificacion);
      if (!r.ok) throw Object.assign(new Error(r.error), { code: r.codigo });
      return r.datos;
    },
    escribir: (ruta, datos) => ipcRenderer.invoke('fs:escribir', ruta, datos),
    existe: (ruta) => ipcRenderer.invoke('fs:existe', ruta),
    crearCarpeta: (ruta) => ipcRenderer.invoke('fs:crear-carpeta', ruta),
    borrar: (ruta) => ipcRenderer.invoke('fs:borrar', ruta),
    renombrar: (de, a) => ipcRenderer.invoke('fs:renombrar', de, a),
    copiar: (de, a) => ipcRenderer.invoke('fs:copiar', de, a),
    info: (ruta) => ipcRenderer.invoke('fs:info', ruta),
    listar: (ruta, recursivo) => ipcRenderer.invoke('fs:listar', ruta, recursivo),
    tamano: (ruta) => ipcRenderer.invoke('fs:tamano', ruta),
    rutaDeArchivo: (archivo) => webUtils.getPathForFile(archivo),
  },
  dialogo: {
    carpeta: (op) => ipcRenderer.invoke('dialogo:carpeta', op),
    archivos: (op) => ipcRenderer.invoke('dialogo:archivos', op),
    guardar: (op) => ipcRenderer.invoke('dialogo:guardar', op),
    mensaje: (op) => ipcRenderer.invoke('dialogo:mensaje', op),
  },
  sistema: {
    mostrarEnCarpeta: (ruta) => ipcRenderer.send('sistema:mostrar-en-carpeta', ruta),
    abrirUrl: (url) => ipcRenderer.send('sistema:abrir-url', url),
  },
  juego: {
    probar: (op) => ipcRenderer.invoke('juego:probar', op),
    enviar: (msg) => ipcRenderer.send('juego:a', msg),       // editor → juego
    alRecibir: escuchar('juego:a'),                           // en el juego
    informar: (msg) => ipcRenderer.send('juego:de', msg),     // juego → editor
    alInformar: escuchar('juego:de'),                         // en el editor
    captura: (rutaProyecto) => ipcRenderer.invoke('juego:captura', rutaProyecto),
  },
  exportar: (op) => ipcRenderer.invoke('exportar', op),
  alProgresoExportar: escuchar('exportar:progreso'),
});


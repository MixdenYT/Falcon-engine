// Puente reducido para la ventana de prueba del juego y para los juegos exportados (ver docs/SECURITY.md, A1).
// Solo lo que usan src/juego y el motor: leer el proyecto, la ventana y hablar con el editor. Nada de
// escritura, borrado, diálogos ni shell.
const { contextBridge, ipcRenderer } = require('electron');

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
    datos: () => ipcRenderer.invoke('app:datos'),
    archivoProyecto: (ruta) => ipcRenderer.invoke('app:archivo-proyecto', ruta),
  },
  fs: {
    leer: async (ruta, codificacion) => {
      const r = await ipcRenderer.invoke('fs:leer', ruta, codificacion);
      if (!r.ok) throw Object.assign(new Error(r.error), { code: r.codigo });
      return r.datos;
    },
    existe: (ruta) => ipcRenderer.invoke('fs:existe', ruta),
    listar: (ruta, recursivo) => ipcRenderer.invoke('fs:listar', ruta, recursivo),
  },
  juego: {
    alRecibir: escuchar('juego:a'),                       // editor → juego
    informar: (msg) => ipcRenderer.send('juego:de', msg), // juego → editor
    captura: () => ipcRenderer.invoke('juego:captura'),
  },
});

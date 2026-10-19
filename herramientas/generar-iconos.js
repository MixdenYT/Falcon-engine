// Genera recursos/icono.png e icono.ico a partir del logotipo SVG.
// Uso: npx electron herramientas/generar-iconos.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const fuente = fs.readFileSync(path.join(raiz, 'src/ui/iconos.js'), 'utf8');
const perfil = /const PERFIL = '([^']+)'/.exec(fuente)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#3DDC84"/><path d="${perfil}" fill="#06130B"/><circle cx="40.5" cy="21" r="2.6" fill="#3DDC84"/></svg>`;

function crearIco(pngs) {
  // ICO con imágenes PNG embebidas (válido desde Windows Vista).
  const cab = Buffer.alloc(6 + 16 * pngs.length);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
  let desp = cab.length;
  pngs.forEach(({ tam, datos }, i) => {
    const o = 6 + i * 16;
    cab.writeUInt8(tam >= 256 ? 0 : tam, o); cab.writeUInt8(tam >= 256 ? 0 : tam, o + 1);
    cab.writeUInt8(0, o + 2); cab.writeUInt8(0, o + 3);
    cab.writeUInt16LE(1, o + 4); cab.writeUInt16LE(32, o + 6);
    cab.writeUInt32LE(datos.length, o + 8); cab.writeUInt32LE(desp, o + 12);
    desp += datos.length;
  });
  return Buffer.concat([cab, ...pngs.map(p => p.datos)]);
}

app.whenReady().then(async () => {
  const v = new BrowserWindow({ show: false, width: 600, height: 600 });
  await v.loadURL('data:text/html,<html><body></body></html>');
  const tamanos = [16, 24, 32, 48, 64, 128, 256, 512];
  const urls = await v.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(${JSON.stringify(svg)});
    await img.decode();
    const r = {};
    for (const t of ${JSON.stringify(tamanos)}) {
      const c = document.createElement('canvas'); c.width = c.height = t;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, t, t);
      r[t] = c.toDataURL('image/png');
    }
    return r;
  })()`);
  const png = (t) => Buffer.from(urls[t].split(',')[1], 'base64');
  fs.mkdirSync(path.join(raiz, 'recursos'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'recursos/icono.png'), png(512));
  fs.writeFileSync(path.join(raiz, 'recursos/icono.ico'), crearIco([16, 24, 32, 48, 64, 128, 256].map(t => ({ tam: t, datos: png(t) }))));
  fs.writeFileSync(path.join(raiz, 'recursos/icono.svg'), svg);
  console.log('Iconos generados en recursos/');
  app.quit();
});

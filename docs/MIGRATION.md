# Migración de JS a Ara

Estado del 21-11-2026, rama `motor-ara` (`6117105`). Plan completo y estados en [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md).

## Qué está ya en Ara

| Qué | Commits | Estado | Prueba |
|---|---|---|---|
| Scripts de juego (`.ara` → wasm) | Antes de esta rama (fase 8 de Ara, ya en `main`) | Hecho | `pruebas/ara.test.js` |
| Blueprints compilados a Ara | Antes de esta rama | Hecho; el compilador de grafos sigue en JS | `pruebas/blueprints.test.js` |
| Plantillas, Academia, CQB y curso escritos en Ara | Antes de esta rama | Hecho | `pruebas/ejemplos.test.js`, `pruebas/cqb.test.js` |
| Física 2D: `fisica2d`, `mover`, solidez y mosaicos | `bf37180` (B2), `2e4289b` (revisión cruzada) | En revisión | `pruebas/fisica2d-ara.test.js` |
| Matrices de mundo, cajas y pares de `contactos2d` | `c1b2b95` (B3) | En revisión | Ídem, 10 pruebas, iguales bit a bit a JS |
| Seno y coseno de la rotación en Ara (fdlibm) | `abc24d9` | Hecho | Ídem |

- JS sigue como respaldo en `mundo.js` (`fisica2d`, `contactos2d`). Se usa si `nucleo.wasm` no carga.
- Medidas: [`BENCHMARKS.md`](BENCHMARKS.md).

## Qué queda en JS

Por orden de la fase 2 y después:
1. Temporizadores, partículas y animación de sprites (`mundo.js`: `actualizarTemporizadores`, `actualizarParticulas`, `avanzarAnimacion`).
2. Física 3D, `Controles3D` y la lógica de CQB (`mundo3d.js`, `control3d.js`, `tactico3d.js`).
3. El compilador de Blueprints (`blueprints.js`).
4. Escena y eventos (`mundo.js`, `tipos.js`). Hoy el árbol es de JS.
5. Capa de plataforma (render, audio, entrada, editor DOM, `principal/`). Se queda en JS hasta que Ara nativo pueda sustituirla (fases 3 a 5). Primer corte: `examples/native-2d`, un `.exe` con ventana, OpenGL 1.1 y teclado que usa la física 2D del núcleo. Ver [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Criterio para mover un bloque

Viene de `REWRITE_ROADMAP.md`, «Cómo se trabaja» y «Reglas de la frontera».

- **Va a Ara** la lógica de simulación (lo que decide el estado). Se queda en la plataforma lo que solo dibuja, suena o lee el sistema.
- **Igual bit a bit.** El resultado tiene que coincidir con la ruta JS en una prueba headless, paso a paso, mientras exista el respaldo.
- **Medir antes y después**, cruces Ara↔JS incluidos. Si Ara sale más lento, se anota y se justifica.
- **Si falta algo en Ara** y es general (como la trigonometría), se añade en Ara. Si solo sirve a Falcon, se queda en Falcon.
- **Revisión cruzada** antes de darlo por completado ([`CONTRIBUTING.md`](CONTRIBUTING.md)).

## Proyectos de usuario

**De Águila a Ara.** Ya existe, desde antes de esta rama.
- Al abrir un proyecto con `.agl` (`necesitaConversion`, `convertir.js:522`), el editor ofrece convertirlo.
- `convertirProyecto` (`convertir.js:541`):
  1. guarda una copia en `.falcon/copia-aguila-<fecha>/`;
  2. comprueba que todo el Ara compila;
  3. cambia las escenas;
  4. manda los `.agl` convertidos a la papelera;
  5. escribe `CONVERSION_ARA.md`.
- Lo que no se puede convertir sigue en Águila: el intérprete (`src/aguila/`) sigue en el motor.
- Detalle del conversor: `ara-etapa5/ara/docs/JUEGOS.md` §5. Prueba: `pruebas/convertir.test.js`.

**Física 2D en Ara.** No hace falta migrar nada:
- los proyectos no cambian de formato;
- el núcleo se usa solo;
- un juego exportado lleva `nucleo.wasm` porque copia `src/motor`.

**Formatos.** Ver [`COMPATIBILITY.md`](COMPATIBILITY.md).

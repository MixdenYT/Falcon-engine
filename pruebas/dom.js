// Lo mínimo del DOM que necesita el motor en Node (lo importan las pruebas).
// Node no tiene DOMMatrix/DOMPoint (las posiciones 2D los usan): una versión mínima para transformaciones afines 2D.
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMPoint = class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } };
  globalThis.DOMMatrix = class M {
    constructor(v = [1, 0, 0, 1, 0, 0]) { [this.a, this.b, this.c, this.d, this.e, this.f] = v; }
    multiply(o) {
      return new M([this.a * o.a + this.c * o.b, this.b * o.a + this.d * o.b, this.a * o.c + this.c * o.d, this.b * o.c + this.d * o.d,
        this.a * o.e + this.c * o.f + this.e, this.b * o.e + this.d * o.f + this.f]);
    }
    fijar(o) { [this.a, this.b, this.c, this.d, this.e, this.f] = [o.a, o.b, o.c, o.d, o.e, o.f]; return this; }
    translateSelf(x, y) { return this.fijar(this.multiply(new M([1, 0, 0, 1, x, y]))); }
    rotateSelf(g) { const r = g * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.fijar(this.multiply(new M([c, s, -s, c, 0, 0]))); }
    scaleSelf(x, y = x) { return this.fijar(this.multiply(new M([x, 0, 0, y, 0, 0]))); }
    inverse() {
      const det = this.a * this.d - this.b * this.c;
      return new M([this.d / det, -this.b / det, -this.c / det, this.a / det, (this.c * this.f - this.d * this.e) / det, (this.b * this.e - this.a * this.f) / det]);
    }
    transformPoint(p) { return new DOMPoint(this.a * p.x + this.c * p.y + this.e, this.b * p.x + this.d * p.y + this.f); }
  };
}

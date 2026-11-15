// Contrast of fg on bg (hex, or rgba over a base). Usage: node contrast.cjs
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const over = (rgba, base) => { const m = rgba.match(/rgba\(([^)]+)\)/); if (!m) return hex(rgba); const [r, g, b, a] = m[1].split(',').map(Number); const B = hex(base); return [r, g, b].map((v, i) => Math.round(v * a + B[i] * (1 - a))); };
const ratio = (fg, bg, base) => { const b = over(bg, base || bg); const f = over(fg, base ? '#' + b.map((x) => x.toString(16).padStart(2, '0')).join('') : bg); const l1 = L(f), l2 = L(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };
module.exports = { ratio, over, hex };
if (require.main === module) {
  const pairs = JSON.parse(process.argv[2]);
  for (const [name, fg, bg, base, need] of pairs) { const r = ratio(fg, bg, base); console.log(`${(+r >= (need || 4.5) ? 'ok ' : 'LOW')} ${r.padStart(6)}  ${name}  (${fg} on ${bg}${base ? ' over ' + base : ''})`); }
}

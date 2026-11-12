// Reads the details a photo carries besides its pixels: where it was taken
// (GPS), the device, the date, the author, captions. JPEG (EXIF, XMP, IPTC),
// PNG (text chunks, EXIF) and TIFF.
//
// Returns { text, error }. `error` is set when the picture has such details
// but they could not be parsed: the caller then blocks the file.

import zlib from 'node:zlib';

const TAGS = {
  0x010e: 'Description', 0x010f: 'Device make', 0x0110: 'Device model', 0x0131: 'Software', 0x0132: 'Date',
  0x013b: 'Author', 0x8298: 'Copyright', 0x9003: 'Date taken', 0x9286: 'Comment', 0xa430: 'Owner',
  0xa431: 'Serial no', 0xa434: 'Lens', 0x9c9b: 'Title', 0x9c9c: 'Comment', 0x9c9d: 'Author', 0x9c9e: 'Keywords', 0x9c9f: 'Subject',
};

function readTiff(buf, base, out) {
  const le = buf.toString('latin1', base, base + 2) === 'II';
  if (!le && buf.toString('latin1', base, base + 2) !== 'MM') throw new Error('unrecognised EXIF block');
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

  function entries(offset) {
    const list = [];
    const n = u16(base + offset);
    for (let i = 0; i < n; i++) {
      const e = base + offset + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const bytes = (SIZE[type] || 1) * count;
      const at = bytes <= 4 ? e + 8 : base + u32(e + 8);
      if (at + bytes > buf.length) throw new Error('EXIF data runs past the end of the file');
      list.push({ tag, type, count, at });
    }
    return list;
  }
  const str = (e) => (e.tag >= 0x9c9b && e.tag <= 0x9c9f ? buf.toString('utf16le', e.at, e.at + e.count) : buf.toString(e.type === 7 ? 'latin1' : 'utf8', e.at, e.at + e.count)).replace(/^(?:ASCII|UNICODE|JIS)\0+/, '').replace(/\0+/g, ' ').trim();
  const rationals = (e) => Array.from({ length: e.count }, (_, i) => u32(e.at + i * 8) / (u32(e.at + i * 8 + 4) || 1));

  function ifd(offset, gps) {
    const es = entries(offset);
    if (gps) {
      const get = (t) => es.find((e) => e.tag === t);
      const deg = (e) => { const [d, m = 0, s = 0] = rationals(e); return d + m / 60 + s / 3600; };
      if (get(2) && get(4)) {
        const lat = deg(get(2)) * (get(1) && str(get(1)).startsWith('S') ? -1 : 1);
        const lon = deg(get(4)) * (get(3) && str(get(3)).startsWith('W') ? -1 : 1);
        out.push(`GPS location: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
      }
      return;
    }
    for (const e of es) {
      if (e.tag === 0x8769) ifd(u32(e.at), false);
      else if (e.tag === 0x8825) ifd(u32(e.at), true);
      else if (TAGS[e.tag] && (e.type === 2 || e.type === 7 || e.type === 1)) { const v = str(e); if (v) out.push(`${TAGS[e.tag]}: ${v}`); }
    }
  }
  if (u16(base + 2) !== 42) throw new Error('unrecognised EXIF block');
  ifd(u32(base + 4), false);
}

function xmpText(xml) {
  const out = [];
  const decode = (s) => s.replace(/&(lt|gt|amp|quot|apos);/g, (m, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e]));
  for (const m of xml.matchAll(/<([\w-]+:[\w-]+)[^>]*>\s*(?:<rdf:(?:Alt|Seq|Bag)>\s*)?(?:<rdf:li[^>]*>)?([^<]{2,})</g)) {
    if (/^(?:rdf|x|xmpMM|stEvt|stRef):/.test(m[1])) continue;
    out.push(`${m[1].replace(/^.*:/, '')}: ${decode(m[2]).trim()}`);
  }
  for (const m of xml.matchAll(/\b((?:dc|photoshop|Iptc4xmpCore|xmp|exif|tiff|aux|xmpRights):[\w-]+)="([^"]{2,})"/g)) out.push(`${m[1].replace(/^.*:/, '')}: ${decode(m[2])}`);
  return out.filter((l) => !/^(?:CreatorTool|MetadataDate|ModifyDate|CreateDate|format|ColorMode|ICCProfile|Orientation|XResolution|YResolution|ResolutionUnit|PixelXDimension|PixelYDimension|ColorSpace|ExifVersion)\b/.test(l));
}

export function photoDetails(buf) {
  const out = [];
  let error = null;
  const attempt = (fn) => { try { fn(); } catch (err) { error = err.message; } };

  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    // JPEG: walk the segments before the picture data.
    let p = 2;
    while (p + 4 <= buf.length && buf[p] === 0xff) {
      const marker = buf[p + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const len = buf.readUInt16BE(p + 2);
      const seg = buf.subarray(p + 4, p + 2 + len);
      if (marker === 0xe1 && seg.toString('latin1', 0, 6) === 'Exif\0\0') attempt(() => readTiff(seg, 6, out));
      else if (marker === 0xe1 && seg.toString('latin1', 0, 28).startsWith('http://ns.adobe.com/xap/1.0/')) out.push(...xmpText(seg.toString('utf8', 29)));
      else if (marker === 0xed) out.push(...[...seg.toString('latin1').matchAll(/[\x20-\x7e]{4,}/g)].map((m) => m[0].trim()).filter((x) => !/^(?:Photoshop|8BIM)/.test(x)).map((x) => `Caption data: ${x}`));
      else if (marker === 0xfe) out.push(`Comment: ${seg.toString('utf8').replace(/\0/g, '').trim()}`);
      p += 2 + len;
    }
  } else if (buf.length > 8 && buf.toString('latin1', 1, 4) === 'PNG') {
    let p = 8;
    while (p + 12 <= buf.length) {
      const len = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      const data = buf.subarray(p + 8, p + 8 + len);
      if (type === 'tEXt') { const i = data.indexOf(0); out.push(`${data.toString('latin1', 0, i)}: ${data.toString('latin1', i + 1)}`); }
      else if (type === 'iTXt') {
        const i = data.indexOf(0);
        const key = data.toString('latin1', 0, i);
        const compressed = data[i + 1] === 1;
        let q = i + 3;
        q = data.indexOf(0, q) + 1; // language
        q = data.indexOf(0, q) + 1; // translated keyword
        attempt(() => {
          const text = (compressed ? zlib.inflateSync(data.subarray(q)) : data.subarray(q)).toString('utf8');
          if (key === 'XML:com.adobe.xmp') out.push(...xmpText(text)); else out.push(`${key}: ${text}`);
        });
      } else if (type === 'zTXt') {
        const i = data.indexOf(0);
        attempt(() => out.push(`${data.toString('latin1', 0, i)}: ${zlib.inflateSync(data.subarray(i + 2)).toString('latin1')}`));
      }
      else if (type === 'eXIf') attempt(() => readTiff(data, 0, out));
      else if (type === 'IEND') break;
      p += 12 + len;
    }
  } else if (buf.length > 8 && /^(?:II\*\0|MM\0\*)/.test(buf.toString('latin1', 0, 4))) {
    attempt(() => readTiff(buf, 0, out));
  }
  return { text: [...new Set(out.filter((l) => l.replace(/^[^:]*:\s*/, '').trim()))].join('\n'), error };
}

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractFile, closeOcr } from '../extract.js';

after(() => closeOcr());

// Scanners usually store black-and-white pages as fax (CCITT) or JBIG2
// pictures, and some as JPEG 2000. pdf.js decodes those only with decoders
// that ship inside the app, and reads some Chinese text only with its
// character maps. Without them such a page came out empty with no warning.
// The pictures below are made up: ImageMagick drew the words, then they were
// stored as raw fax and JPEG 2000 data.

// "Statement of Encik Zulkarnain / Made-up test page for the decoder", 1200 x 400, CCITT group 4.
const FAX = '/////////////+TZIKdlTMzOxdmZmTuF/+VIHUjAb+RYMv+EDMzJYZkENL//r/Jk//9ES/9Y/40CKH+svYHK2f4QP/+v8f/0vpf/pf//6/giDEyHQQYQQoZOyLQijCFDJ2RKEGFZCnILiJVmbEKcOaPJBJEhnR+SCPhzoZsZgzYh1DnVmZmxPhB4TwgwgwnhPQf4TCfoJf9BBB4XCYQfhPfeg9NNB6eE/019JL/SvXTv07gyepPmDJ1EeOJd0TuiPHEu2DJjRHbJz4l20R99JL/Sk+cSb4l25PnxLt4fKDegQeExCbQIPCD6CDfwg6CB/CVf4SlBuCGEHlBvhB7IQZF9JumnSbpvSfkNk02kPpJf6QvVNi/TdkH0/T009PX039dekv+l1X9dh7f9V/T6X9PXpJf6TfTt9PDD/W/tb///X0El/oLr/+DeRAY6f+n/35av/pV/pEuGPzoGP5WQmC8f8f9X/16SX+kC/gv8pY9f/////il/il/X++iJ3/////9L/RE7+iJ3++iSPLSflpP///aX9okj+iSP9vhf/////yY7r+THcL/hf/1//////20v9tf9f/9L3/f91/37a/7dL/S////////9tK19v///7+7/v76/7+2l/t///9L17/v9v/79tLX29f9f5LJe17/v/S/79um/27X+1/w0rbW2yRftki+2Gv+2UL20tfbbX9tf8hLyH5hZDzBgv7BgvyHCBhLkG/9hgvtohmzDBEx/t2F/sL/im2Jb22P9j9tiv9j9viv22Jb/2Jb/7Cdrd/392v9/b2v22v9r/gwg7WHDBfhgvDsL/DXhvDX4ba/2v+IiIiIiIiIiIiIiIiIiIiIiIiI//////////8ytk2WxTsGZ2oZ2FPhf5BBmsXX/+ZOZ3hpHdn/v/k9n/9f6///r/7///yx6LH///2////6////rKA5GCZ0CkDZ0ZmZgQEQYQQtRBOIMCCcESohxhEsvQhVZBehChk7I6iDGTYhThSJCZ0CkYHIYUpxM6BSGZsfb8IMIPCf6DwmE/QYQYQeE9B4XwmEwg8JhNBhB4Twv0u09B/p6DX07T0HhPX00GnoNQmnoPX/yfNEeDRHj+JdsGTqI8cl8GTAhLtyfNEeDRHjKs5HbiTeDJ6CXbRHjRHg0R40R9kdtEeDRHjiTf2/lBuEHQIP8IN6BB0ED8INyg3CDoEH0EG4IeEHQIPCDoEHQQOgg3CDoEHgh+li6TpN/T6TdD04uk6Tek9dNpNpOk2kKTpOk3Xb/+n+m+n+m/6fpuuun+nqm/p6+u2k////+2k/6X9P6T/SWk//6/1v6fW/p/1v+v1v1tf9brt+dAxXT/308P7JAYrp/f/p66f3rp/6WC7x//Gw/wXePq/+PeOqveP/6/nAT/+Qun1///////7foid///wwf6Inf///////paJI/LV//ljQf6JI/LLP/8sq8sn/5aT2Phf//+Df8L////////r/j/+Rcf6////////rpdb/+w/9La33X/et3da39/7+169v6////7/+//X/v9q772vvv67+/u+vv8fVtb1/v/1tb2//ttbtvbW/9r9t9pd12la2t+l/393pff9tW1bJFra22SI/rdq2ratki2GvftkibVskTZQmGratki/2FhhWDBWGCJj4YSkPMGCwYWQ5cMJWFYmHsGC7DCXIfuwYLDCsGCsMFYYShhWDBf7Et7EsexxXJjim2OKbkxxTEt7Wx7FbfsbEsexsbFMSx7H/a2t2vad6faa2t9rf3a3dprf+1hhYYINewg4YIMIPsJrDCwwWwsP4YIMLDBBphBhYYLiIiIiI4iIjiIioiIiIiIiIiIj//X1+vys6X4r9fr4MFER////////////////////////////wAQAQ=';
// "Encik Zulkarnain", 640 x 110 grey, JPEG 2000.
const JPX = 'AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAABDanAyaAAAABZpaGRyAAAAbgAAAoAAAgcHAAAAAAAPY29scgEAAAAAABEAAAAWY2RlZgACAAAAAAABAAEAAQAAAAAE32pwMmP/T/9RACwAAAAAAoAAAABuAAAAAAAAAAAAAAKAAAAAbgAAAAAAAAAAAAIHAQEHAQH/UgAMAAAAAQAFBAQAAf9cABNAQEhIUEhIUEhIUEhIUEhIUP9kACUAAUNyZWF0ZWQgYnkgT3BlbkpQRUcgdmVyc2lvbiAyLjUuMP+QAAoAAAAABFsAAf+T31m4Ditn8RH6vnG3s2DJ8SoNDq6piSEnd8k1ebIRsLrtaEAyoA04q+WSLtVTsUhFH646Uk8Z0f7Hjs+kKBQAXKbyx8RSPjMw8eAji7mQYZtjvT1emfzAE8lWOIfXWRj3712zU/GgCQb/HLDVfsfRAI2z5WNlplcRvMpCT0P5yyqwR3J6WqeA3ysp8SufEoC0NFqUW26QKDigUKCkoqKeGRNQPcn/WPLdFVr8K8lhitMGX9jlfP9kmd5SDnmllVNnvCLSIXCe3nrhFBEgsPu3FLFWWChGPZq+pZDWfQrHpSteWQxYk/lzuc+FR9NL7cwAszXdSIfEs+jWB8GiKsGISEiqxugA4fKUqsJllBKByzsvReOtgO/FW2/HX2faGLMMZFxnTyQfL/72Vada+UTuFru5GYRxzT78ehTHxuyyyyDAEJolPlWgFyfZblixIrxS7OQyVNWw8oQfQ1nzxeO8GjlBgOvwNww3JXZaPpq1t06mVCdnm0e6f1y0Iq0SpeeCqO/2/2N+wlrEi8KEHReNn+X39HElXo39i8XC9mv/LJrx39Bf2rJ3DbxC1+ccfELvbASDXHSJigSxWITd1qB9TMsN6NGMxe3Rk3eCMu6vXKz1PqjAxuEA6r0ZSbxCj7rYYgPk29aGjKe3+0KySbT5VlRoUpwyFGouHkmDjWeE9HGXoFBt4dFdq2UuTVon4D0+XViPmLy8D9JNTQqA8+6f7aOfdP82wOCAUcTzUejUyPipo3h76UrwlMKOckRwddB2qRkVSC3PpM0TWKZb3ZkxU2Mc1JoXxCRjMvvrsm7yHbmoBnsPBu6Ikm5gYV7oRfjAwUele9vdw6fF/cNrw48rc6TtLqd8UcIHdq5PuazBzn7sJCwzjxn542crJDUktGNAhajBu71h56j7zvlcGsJz1IXa3IqBr7PRGcoVDOOZZv8yvdoYBAwlsJVQAPXN10i3yWmPDbHNotI0nztfNvfYKRXA8wAipL//Enx2RHz3SgGJpHlagYnxQM1A/dC/CVa9IOHXgXtUrmP/BvQqaJ5bPNeDmkGLhxtd61HIhunZs8fAmyC3anbCT5FvgUuIpoD5+2/t5+6fVLz8u+acAOeob9fdvMH0BiH71io6VNAadCKHdN1ZAbMkLsrhyO637QxXEUNTSp0QZKarq+vgQFm7N6faq9rr8CXs2wI5oC0S/Irnq/9rlRgDUQ65TUSVVRucjwbshp43C0wz1KsDSNXSAmIO+gSVeRJPTzxMnIMe6Wfs1u4GqrQWZ9VbH5aIvtVWSMjh6jGpBsuN5Dnoc5ZBiaKaKuEAkmiTTlpvSX7JX0YBVK7ZxeEBiVI+RHQKsnGJXsxOxXp9ufUvQP2OD/ux6+Ua8nTbFkhp5M56Wt+EDj6f9iC2SbhAZSvAg279tbO9RwKJHIjjmWjKqZQZqLxmjquyvo/KxtHUrIbMs5/SJSe3Nc7nyEfGPAt7I6aA/9k=';

/** A one-page PDF: 1 catalog, 2 page list, 3 page, 4 page content, then `objects` from 5. */
function pdf({ resources, content, objects }) {
  const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
  const all = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents 4 0 R >>`),
    stream('', Buffer.from(content, 'latin1')),
    ...objects.map((o) => (Buffer.isBuffer(o.data) ? stream(o.dict, o.data) : Buffer.from(o))),
  ];
  const chunks = [Buffer.from('%PDF-1.5\n')];
  const offsets = [];
  let at = chunks[0].length;
  all.forEach((body, i) => {
    const piece = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
    offsets.push(at);
    at += piece.length;
    chunks.push(piece);
  });
  chunks.push(Buffer.from(`xref\n0 ${all.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

const picturePdf = (width, height, dict, data) => pdf({
  resources: '<< /XObject << /Im1 5 0 R >> >>',
  content: `q ${width / 2} 0 0 ${height / 2} 36 600 cm /Im1 Do Q`,
  objects: [{ dict: `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray ${dict}`, data }],
});

async function read(name, bytes) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-pdfdec-'));
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return extractFile(file);
}

test('a scanned page stored as a fax (CCITT) picture is read by OCR, not passed as empty', { timeout: 120000 }, async () => {
  const r = await read('fax.pdf', picturePdf(1200, 400, '/BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /BlackIs1 false /Columns 1200 /Rows 400 >>', Buffer.from(FAX, 'base64')));
  assert.deepEqual(r.proof.ocr, [1], JSON.stringify(r.proof));
  assert.match(r.parts.map((p) => p.text).join('\n'), /Zulkarnain/);
});

test('a picture stored as JPEG 2000 is read by OCR, not passed as empty', { timeout: 120000 }, async () => {
  const r = await read('jpx.pdf', picturePdf(640, 110, '/BitsPerComponent 8 /Filter /JPXDecode', Buffer.from(JPX, 'base64')));
  assert.deepEqual(r.proof.ocr, [1], JSON.stringify(r.proof));
  assert.match(r.parts.map((p) => p.text).join('\n'), /Zulkarnain/);
});

test('Chinese text written with a standard character map (not embedded) is read, so the non-Latin check sees it', async () => {
  const r = await read('cjk.pdf', pdf({
    resources: '<< /Font << /F1 5 0 R /F2 8 0 R >> >>',
    // 张三欠款五千 (made up: "Zhang San owes five thousand") in UCS-2, then a line in Helvetica.
    content: 'BT /F1 24 Tf 72 700 Td <5F204E096B206B3E4E945343> Tj ET\nBT /F2 18 Tf 72 650 Td (Made-up test line) Tj ET\n',
    objects: [
      '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>',
      '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor 7 0 R /DW 1000 >>',
      '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ],
  }));
  const text = r.parts.map((p) => p.text).join('\n');
  assert.match(text, /张三欠款五千/);
  assert.match(text, /Made-up test line/);
  assert.equal(r.status, 'manual');
  assert.match(r.reasons.join(' '), /non-Latin/);
});

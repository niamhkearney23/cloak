// Which language a written form is in, and how to say it in the other one.
// Used when a draft is restored: a form is put back in the language of the sentence it lands in.
// Covers month names, job titles and court names, English and Malay. Nothing else is translated.

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MS_MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const MONTH_LANG = { januari: 'ms', februari: 'ms', mac: 'ms', mei: 'ms', julai: 'ms', ogos: 'ms', oktober: 'ms', okt: 'ms', disember: 'ms', dis: 'ms', january: 'en', february: 'en', march: 'en', may: 'en', july: 'en', august: 'en', october: 'en', december: 'en', jan: 'en', feb: 'en', mar: 'en', jul: 'en', aug: 'en', oct: 'en', dec: 'en' };

const JOBS = [
  ['pengarah urusan', 'managing director'], ['pengarah kewangan', 'finance director'], ['pengarah', 'director'], ['pengurus cawangan', 'branch manager'], ['pengurus kewangan', 'finance manager'],
  ['pengurus besar', 'general manager'], ['pengurus jualan', 'sales manager'], ['pengurus operasi', 'operations manager'], ['pengurus projek', 'project manager'], ['pengurus', 'manager'],
  ['setiausaha syarikat', 'company secretary'], ['ketua pegawai eksekutif', 'chief executive officer'], ['ketua pegawai kewangan', 'chief financial officer'], ['pegawai eksekutif', 'executive officer'], ['kapten pelabuhan', 'port captain'], ['pengawal kewangan', 'financial controller'],
];
const COURTS = [
  ['mahkamah tinggi sabah dan sarawak', 'high court of sabah and sarawak'], ['mahkamah tinggi malaya', 'high court of malaya'], ['mahkamah sesyen', 'sessions court'], ['mahkamah majistret', "magistrates' court"], ['mahkamah rayuan', 'court of appeal'], ['mahkamah persekutuan', 'federal court'],
];

const EN_WORDS = new Set('the of and to in that was is by for with on at this which from has have had be as an i my he she they his her their it not but are were been will shall any all also such under after before between'.split(' '));
const MS_WORDS = new Set('yang dan untuk dengan pada kepada telah akan tidak atau dalam oleh adalah itu ini mereka kami kita saya beliau bagi atas ialah dari ke di daripada serta juga bahawa kerana apabila selepas sebelum antara plaintif defendan bertarikh pernyataan'.split(' '));

/** 'en' or 'ms' for a stretch of ordinary text; null when there is too little to tell. Tags and numbers are ignored. */
export function textLanguage(text) {
  let en = 0;
  let ms = 0;
  for (const w of String(text).replace(/\{\{[^}]*\}\}/g, ' ').toLowerCase().match(/\p{L}+/gu) || []) {
    if (EN_WORDS.has(w)) en++;
    if (MS_WORDS.has(w)) ms++;
  }
  if (en + ms < 3) return null;
  return ms > en ? 'ms' : 'en';
}

/** The language a stored form is written in: 'en', 'ms', 'zh', or null when it is the same in both (numbers, ISO dates, names). */
export function formLanguage(kind, surface) {
  const s = String(surface);
  if (/\p{Script=Han}/u.test(s)) return 'zh';
  if (kind === 'date') {
    const words = (s.toLowerCase().match(/\p{L}+/gu) || []).filter((w) => !/^(?:st|nd|rd|th|hb|of|day|hari|bulan|and|dan|to|hingga|sehingga|until|till)$/.test(w));
    for (const w of words) if (MONTH_LANG[w]) return MONTH_LANG[w];
    if (/\d(?:hb|\s?hb)\b|haribulan/i.test(s)) return 'ms';
    return null;
  }
  const low = s.toLowerCase();
  if (kind === 'job') {
    if (JOBS.some(([ms]) => low.includes(ms))) return 'ms';
    if (JOBS.some(([, en]) => low.includes(en)) || /harbour master|port captain|company secretary/.test(low)) return 'en';
    return null;
  }
  if (kind === 'court') {
    if (/\b(?:mahkamah|dalam)\b/.test(low)) return 'ms';
    if (/\b(?:court|in the)\b/.test(low)) return 'en';
    return null;
  }
  return null;
}

const matchCase = (source, text) => (source === source.toUpperCase() && /\p{L}/u.test(source) ? text.toUpperCase() : /^\p{Lu}/u.test(source) && source.split(/\s+/).every((w) => /^\p{Lu}/u.test(w) || w.length < 3) ? text.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : text);

function swapPhrase(surface, table, to) {
  const from = to === 'en' ? 0 : 1;
  const into = to === 'en' ? 1 : 0;
  for (const pair of table.slice().sort((a, b) => b[from].length - a[from].length)) {
    const re = new RegExp(`(?<![\\p{L}])${pair[from].replace(/ /g, '\\s+')}(?![\\p{L}])`, 'iu');
    const m = re.exec(surface);
    if (m) return surface.slice(0, m.index) + matchCase(m[0], pair[into]) + surface.slice(m.index + m[0].length);
  }
  return null;
}

/** The form written in the other language, or null when there is no translation. `date` is { key, precision } from findDates. */
export function translateForm(kind, surface, to, date = null) {
  if (kind === 'date') {
    if (!date) return null;
    const names = to === 'en' ? EN_MONTHS : MS_MONTHS;
    const style = (name, from) => (from === from.toUpperCase() ? name.toUpperCase() : name);
    const m = /(\p{L}+)\.?(?=\s*,?\s*\d{4}|\s*$)|\d{1,2}(?:st|nd|rd|th|hb\.?)?\s+(?:day\s+of\s+|of\s+)?(\p{L}+)/u.exec(surface);
    const word = m && (m[1] || m[2]);
    const month = word && Object.keys(MONTH_LANG).includes(word.toLowerCase()) ? word : null;
    // A form with no month word (a Chinese date, say) is written from the date itself.
    if (!month) {
      const k = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.key || '');
      return k ? `${+k[3]} ${names[+k[2] - 1]} ${k[1]}` : null;
    }
    let out = surface;
    // Every month word in the form (a range has two) is renamed.
    out = out.replace(/\p{L}+/gu, (w) => {
      const idx = Object.keys(MONTH_LANG).includes(w.toLowerCase()) ? monthIndex(w) : -1;
      return idx >= 0 ? style(names[idx], w) : w;
    });
    // "3hb" and "3rd" are not used in the other language's plain form.
    out = out.replace(/(\d)(?:st|nd|rd|th|\s?hb\.?)(?=\s)/gi, '$1');
    return out;
  }
  if (kind === 'job') {
    const lower = surface.replace(/^the\s+/i, '');
    const prefix = surface.slice(0, surface.length - lower.length);
    const hit = swapPhrase(lower, JOBS, to);
    return hit && prefix + hit;
  }
  if (kind === 'court') {
    let out = swapPhrase(surface, COURTS, to);
    if (!out) return null;
    out = to === 'en' ? out.replace(/(?<![\p{L}])DALAM\s+/u, 'IN THE ').replace(/(?<![\p{L}])Dalam\s+/u, 'In the ').replace(/(?<![\p{L}])dalam\s+/u, 'in the ').replace(/\s+DI\s+/u, ' AT ').replace(/\s+di\s+/u, ' at ')
      : out.replace(/(?<![\p{L}])IN THE\s+/u, 'DALAM ').replace(/(?<![\p{L}])In the\s+/u, 'Dalam ').replace(/\s+AT\s+/u, ' DI ').replace(/\s+at\s+/u, ' di ');
    return out;
  }
  return null;
}

function monthIndex(word) {
  const w = word.toLowerCase().replace(/\.$/, '');
  const lang = MONTH_LANG[w];
  const list = lang === 'ms' ? MS_MONTHS : EN_MONTHS;
  const full = list.findIndex((n) => n.toLowerCase() === w);
  if (full >= 0) return full;
  const abbrev = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dis: 11 };
  return abbrev[w] ?? -1;
}

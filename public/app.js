/* Cloak Drafting — front end.
 *
 * Flow: case details + facts -> pick documents -> cloak (names become tokens)
 * -> staff check what will be sent -> cloaked text goes to the drafter ->
 * drafts come back and are uncloaked here, in the browser.
 */
(function () {
  'use strict';

  const { Cloak, findSuspects } = window.Cloak;
  const STORE_KEY = 'cloak.matter.v1';

  // ---------------------------------------------------------------- constants

  // courts: suggestions for the court name box. terms: usual party names.
  const JURISDICTIONS = [
    { value: 'Malaysia (Peninsular)', terms: 'pd', languages: true, courts: [
      'In the High Court of Malaya at Kuala Lumpur',
      'In the High Court of Malaya at Shah Alam',
      'In the High Court of Malaya at Johor Bahru',
      'In the High Court of Malaya at Pulau Pinang',
      'In the Sessions Court at Kuala Lumpur',
      'In the Magistrates\' Court at Kuala Lumpur',
    ] },
    { value: 'Malaysia (Sabah and Sarawak)', terms: 'pd', languages: true, courts: [
      'In the High Court in Sabah and Sarawak at Kota Kinabalu',
      'In the High Court in Sabah and Sarawak at Kuching',
      'In the Sessions Court at Kota Kinabalu',
      'In the Sessions Court at Kuching',
    ] },
    { value: 'Singapore', terms: 'cd', courts: [
      'In the General Division of the High Court of the Republic of Singapore',
      'In the Singapore International Commercial Court',
      'In the District Court of the Republic of Singapore',
      'In the Magistrate\'s Court of the Republic of Singapore',
    ] },
    { value: 'Northern Ireland', terms: 'pd', courts: ['In the High Court of Justice in Northern Ireland, King\'s Bench Division', 'In the County Court for the Division of Belfast'] },
    { value: 'Ireland', terms: 'pd', courts: ['The High Court', 'The Circuit Court', 'The District Court'] },
    { value: 'England and Wales', terms: 'cd', courts: ['In the High Court of Justice, King\'s Bench Division', 'In the County Court at Central London'] },
    { value: 'Australia (New South Wales)', terms: 'pd', courts: ['Supreme Court of New South Wales, Common Law Division', 'District Court of New South Wales'] },
    { value: 'Australia (Victoria)', terms: 'pd', courts: ['In the Supreme Court of Victoria at Melbourne, Common Law Division', 'In the County Court of Victoria at Melbourne'] },
    { value: 'Other', terms: 'pd', courts: [] },
  ];

  const TERMS = {
    pd: { p: 'Plaintiff', d: 'Defendant', pt: 'PLAINTIFF', dt: 'DEFENDANT' },
    cd: { p: 'Claimant', d: 'Defendant', pt: 'CLAIMANT', dt: 'DEFENDANT' },
    ar: { p: 'Applicant', d: 'Respondent', pt: 'APPLICANT', dt: 'RESPONDENT' },
  };

  const DOCS = [
    { key: 'writ', label: 'Writ of Summons', blurb: 'Starts the case. Tells the other side they are being sued and what for.' },
    { key: 'statement_of_claim', label: 'Statement of Claim', blurb: 'Sets out the full facts, what went wrong, the injuries or losses, and what you are claiming.' },
    { key: 'witness_statement', label: 'Witness Statement', blurb: 'One person\'s account in their own words, signed with a statement of truth.' },
    { key: 'affidavit', label: 'Affidavit', blurb: 'Sworn written evidence, for example to support an application to court.' },
    { key: 'reply', label: 'Reply', blurb: 'Answers new points raised in the other side\'s Defence.' },
  ];

  const STEPS = [
    { key: 'case', label: 'Case details' },
    { key: 'facts', label: 'The facts' },
    { key: 'docs', label: 'Pick documents' },
    { key: 'check', label: 'Check what\'s hidden' },
    { key: 'drafts', label: 'Your drafts' },
  ];

  const blankParty = () => ({ kind: 'person', name: '', gender: '', idNo: '', description: '', address: '' });
  const blankPerson = () => ({ name: '', role: '', gender: '', address: '' });
  const GENDERS = [{ value: '', label: 'Not stated' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }];
  const blankFirm = () => ({ name: '', address: '', ref: '', email: '', phone: '' });

  function blankState() {
    return {
      step: 'case',
      jurisdiction: '',
      court: '',
      recordNo: '',
      terms: 'pd',
      language: 'English',
      actFor: 'p',
      plaintiffs: [blankParty()],
      defendants: [blankParty()],
      people: [],
      ourFirm: blankFirm(),
      otherFirm: blankFirm(),
      counsel: '',
      hide: [],
      allow: [],
      facts: '',
      relief: '',
      docs: {
        writ: { on: false, notes: '' },
        statement_of_claim: { on: false, notes: '' },
        witness_statement: { on: false, witness: '', occupation: '', number: '1', notes: '' },
        affidavit: { on: false, deponent: '', occupation: '', oath: 'swear', purpose: '', notes: '' },
        reply: { on: false, defence: '', counterclaim: false, notes: '' },
      },
      checked: false,
      checkedBy: '',
      markDraft: true,
      run: null, // { map, results: { docType: { status, cloaked, text, unknown, error, model, truncated } } }
      activeDraft: null,
    };
  }

  // -------------------------------------------------------------- persistence

  let state = load();
  // A draft that was still running when the page closed will never finish.
  for (const r of Object.values(state.run?.results || {})) {
    if (r.status === 'working') Object.assign(r, { status: 'error', error: 'The page was closed before this draft finished.' });
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return merge(blankState(), JSON.parse(raw));
    } catch { /* storage unavailable: start fresh */ }
    return blankState();
  }

  function merge(base, data) {
    if (!data || typeof data !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (!(k in data)) continue;
      const b = base[k];
      const d = data[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && d && typeof d === 'object' && !Array.isArray(d)) {
        base[k] = merge(b, d);
      } else {
        base[k] = d;
      }
    }
    return base;
  }

  let saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 150);
  }
  window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });

  // ------------------------------------------------------------------ helpers

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getPath(path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
  }

  function setPath(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => o[k], state);
    obj[last] = value;
    // Anything that changes what gets sent invalidates the "I've checked" tick.
    if (!path.startsWith('run') && !['checked', 'checkedBy', 'markDraft', 'step', 'activeDraft'].includes(path)) state.checked = false;
    save();
  }

  const T = () => TERMS[state.terms] || TERMS.pd;

  // Bound form controls: data-path="plaintiffs.0.name"
  function field(label, path, opts = {}) {
    const id = 'f-' + path.replace(/\./g, '-');
    const value = getPath(path) ?? '';
    let control;
    if (opts.type === 'textarea') {
      control = h('textarea', { id, rows: opts.rows || 4, placeholder: opts.placeholder || '', oninput: (e) => setPath(path, e.target.value) });
      control.value = value;
    } else if (opts.type === 'select') {
      control = h('select', { id, onchange: (e) => { setPath(path, e.target.value); if (opts.onchange) opts.onchange(e.target.value); if (opts.rerender) render(); } },
        opts.options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
    } else if (opts.type === 'checkbox') {
      control = h('input', { id, type: 'checkbox', checked: !!value, onchange: (e) => { setPath(path, e.target.checked); if (opts.rerender) render(); } });
      return h('label', { class: 'check', for: id }, control, h('span', {}, label), opts.hint && h('small', {}, opts.hint));
    } else {
      const listId = opts.suggestions && opts.suggestions.length ? id + '-list' : null;
      control = h('input', { id, type: 'text', value, list: listId, placeholder: opts.placeholder || '', autocomplete: 'off', oninput: (e) => { setPath(path, e.target.value); if (opts.oninput) opts.oninput(e.target.value); } });
      if (listId) control = [control, h('datalist', { id: listId }, opts.suggestions.map((v) => h('option', { value: v })))];
    }
    return h('div', { class: 'field' + (opts.wide ? ' wide' : '') },
      h('label', { for: id }, label, opts.optional && h('span', { class: 'optional' }, ' (optional)')),
      control,
      opts.hint && h('small', { class: 'hint' }, opts.hint));
  }

  function card(title, intro, ...body) {
    return h('section', { class: 'card' }, h('h2', {}, title), intro && h('p', { class: 'intro' }, intro), ...body);
  }

  function nav(prev, next, nextLabel) {
    return h('div', { class: 'nav' },
      prev ? h('button', { type: 'button', class: 'ghost', onclick: () => go(prev) }, '← Back') : h('span'),
      next && h('button', { type: 'button', class: 'primary', onclick: () => go(next) }, nextLabel || 'Next →'));
  }

  function go(step) {
    state.step = step;
    save();
    render();
    document.getElementById('main').focus();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ cloak + brief

  function partyLabel(side, i, list) {
    const t = T();
    return `${side === 'p' ? t.p : t.d}${list.length > 1 ? ' ' + (i + 1) : ''}`;
  }

  function partyTokenPrefix(side) {
    return side === 'p' ? T().pt : T().dt;
  }

  /** Everyone who could give a witness statement / affidavit. */
  function peopleOptions() {
    const out = [];
    state.plaintiffs.forEach((p, i) => p.name.trim() && out.push({ value: `plaintiffs.${i}`, label: `${p.name} (${partyLabel('p', i, state.plaintiffs)})` }));
    state.defendants.forEach((p, i) => p.name.trim() && out.push({ value: `defendants.${i}`, label: `${p.name} (${partyLabel('d', i, state.defendants)})` }));
    state.people.forEach((p, i) => p.name.trim() && out.push({ value: `people.${i}`, label: `${p.name}${p.role ? ' (' + p.role + ')' : ''}` }));
    return out;
  }

  function initials(name) {
    const words = name.replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return words.map((w) => w.replace(/^[^\p{L}]+/u, '')[0] || '').join('').toUpperCase();
  }

  function buildCloak() {
    const c = new Cloak();
    const t = T();
    state.plaintiffs.forEach((p) => addParty(c, partyTokenPrefix('p'), p));
    state.defendants.forEach((p) => addParty(c, partyTokenPrefix('d'), p));
    state.people.forEach((p) => c.addPerson('PERSON', p.name, { address: p.address }));
    const ourToken = state.actFor === 'p' ? `${t.pt}_SOLICITORS` : `${t.dt}_SOLICITORS`;
    const otherToken = state.actFor === 'p' ? `${t.dt}_SOLICITORS` : `${t.pt}_SOLICITORS`;
    addFirm(c, ourToken, state.ourFirm);
    addFirm(c, otherToken, state.otherFirm);
    if (state.counsel.trim()) c.addPerson('COUNSEL', state.counsel, { token: 'COUNSEL' });
    if (state.recordNo.trim()) c.register('RECORD_NO', state.recordNo);
    state.hide.forEach((v) => c.addLiteral('HIDDEN', v));
    const dep = personByRef(state.docs.affidavit.deponent);
    if (state.docs.affidavit.on && dep) c.register('EXHIBIT_PREFIX', initials(dep.name), { match: false });
    return c;
  }

  function addParty(c, prefix, p) {
    if (!p.name.trim()) return;
    if (p.kind === 'org') c.addOrganisation(prefix, p.name, { address: p.address, idNo: p.idNo });
    else c.addPerson(prefix, p.name, { address: p.address, idNo: p.idNo });
  }

  function addFirm(c, token, f) {
    if (!f.name.trim()) return;
    c.addOrganisation('FIRM', f.name, { token, address: f.address, email: f.email, phone: f.phone });
    if (f.ref.trim()) c.register(`${token}.REF`, f.ref);
  }

  function personByRef(ref) {
    if (!ref) return null;
    const [list, i] = ref.split('.');
    return (state[list] || [])[Number(i)] || null;
  }

  function roleOfRef(ref) {
    const [list, i] = ref.split('.');
    if (list === 'plaintiffs') return partyLabel('p', Number(i), state.plaintiffs);
    if (list === 'defendants') return partyLabel('d', Number(i), state.defendants);
    return state.people[Number(i)]?.role || 'witness';
  }

  function genderWord(g) {
    return g === 'female' ? 'female individual' : g === 'male' ? 'male individual' : 'individual (gender not stated)';
  }

  /** The case brief in plain words (real names). It is cloaked before sending. */
  function buildBrief() {
    const t = T();
    const L = [];
    L.push(`Jurisdiction: ${state.jurisdiction || '[not stated]'}`);
    L.push(`Court: ${state.court || '[not stated]'}`);
    L.push(`Record number: ${state.recordNo || '[to be assigned]'}`);
    L.push(`Party terminology: ${t.p} / ${t.d}`);
    L.push(`Language of the documents: ${state.language || 'English'}`);
    L.push(`We act for: the ${state.actFor === 'p' ? t.p : t.d}`);
    L.push('');
    L.push('PARTIES');
    const partyLine = (label, p) => [
      `${label}: ${p.name}`,
      p.kind === 'org' ? 'a company' : genderWord(p.gender),
      (p.idNo || '').trim() ? `${p.kind === 'org' ? 'company no.' : 'IC / NRIC / passport no.'}: ${p.idNo}` : null,
      p.description.trim() || null,
      p.address.trim() ? `address: ${p.address}` : null,
    ].filter(Boolean).join(' | ');
    state.plaintiffs.forEach((p, i) => p.name.trim() && L.push(partyLine(`${t.p} ${i + 1}`, p)));
    state.defendants.forEach((p, i) => p.name.trim() && L.push(partyLine(`${t.d} ${i + 1}`, p)));
    const firmLine = (label, f) => f.name.trim() && L.push([
      `${label}: ${f.name}`,
      f.address.trim() && `address: ${f.address}`,
      f.ref.trim() && `ref: ${f.ref}`,
      f.email.trim() && `email: ${f.email}`,
      f.phone.trim() && `phone: ${f.phone}`,
    ].filter(Boolean).join(' | '));
    const pFirm = state.actFor === 'p' ? state.ourFirm : state.otherFirm;
    const dFirm = state.actFor === 'p' ? state.otherFirm : state.ourFirm;
    firmLine(`${t.p}'s solicitors`, pFirm);
    firmLine(`${t.d}'s solicitors`, dFirm);
    if (state.counsel.trim()) L.push(`Counsel (for the side we act for): ${state.counsel}`);
    const others = state.people.filter((p) => p.name.trim());
    if (others.length) {
      L.push('');
      L.push('OTHER PEOPLE');
      others.forEach((p) => L.push([`- ${p.name}`, genderWord(p.gender), p.role.trim(), p.address.trim() && `address: ${p.address}`].filter(Boolean).join(' | ')));
    }
    L.push('');
    L.push('FACTS');
    L.push(state.facts.trim() || '[no facts entered]');
    if (state.relief.trim()) {
      L.push('');
      L.push('RELIEF SOUGHT');
      L.push(state.relief.trim());
    }
    return L.join('\n');
  }

  function buildInstructions(key) {
    const d = state.docs[key];
    const L = [];
    if (key === 'witness_statement') {
      const w = personByRef(d.witness);
      L.push(`Witness: ${w ? `${w.name} (${roleOfRef(d.witness)})` : '[witness not chosen]'}`);
      if (w && w.address.trim()) L.push(`Witness address: ${w.address}`);
      if (d.occupation.trim()) L.push(`Witness occupation: ${d.occupation}`);
      L.push(`Statement number: ${d.number || '1'}`);
    }
    if (key === 'affidavit') {
      const w = personByRef(d.deponent);
      L.push(`Deponent: ${w ? `${w.name} (${roleOfRef(d.deponent)})` : '[deponent not chosen]'}`);
      if (w && w.address.trim()) L.push(`Deponent address: ${w.address}`);
      if (d.occupation.trim()) L.push(`Deponent occupation: ${d.occupation}`);
      L.push(`Oath or affirmation: ${d.oath === 'affirm' ? 'affirmation' : 'oath (sworn)'}`);
      L.push(`Exhibit mark prefix token: {{EXHIBIT_PREFIX}}`);
      if (d.purpose.trim()) L.push(`Purpose of the affidavit: ${d.purpose}`);
    }
    if (key === 'reply') {
      L.push(`Is there a counterclaim to defend: ${d.counterclaim ? 'yes' : 'no'}`);
      L.push('THE DEFENCE (as delivered by the other side):');
      L.push(d.defence.trim() || '[defence text not supplied]');
    }
    if (d.notes.trim()) L.push(`Extra instructions: ${d.notes}`);
    return L.join('\n');
  }

  /** Cloak everything that will be sent, using one shared name map. */
  function preparePayload() {
    const c = buildCloak();
    const brief = c.cloak(buildBrief());
    const docs = DOCS.filter((d) => state.docs[d.key].on).map((d) => ({
      key: d.key,
      label: docLabel(d.key),
      instructions: c.cloak(buildInstructions(d.key)),
    }));
    const allText = [brief, ...docs.map((d) => d.instructions)].join('\n');
    const allow = new Set(state.allow.map((a) => a.toLowerCase()));
    const suspects = findSuspects(allText).filter((s) => !allow.has(s.text.toLowerCase()));
    return { cloak: c, brief, docs, suspects };
  }

  const CATEGORIES = [
    ['People and companies', /^(PLAINTIFF|DEFENDANT|CLAIMANT|APPLICANT|RESPONDENT|PERSON|COUNSEL)(_\d+)?$/],
    ['Law firms', /_SOLICITORS$/],
    ['IC, NRIC, passport and company numbers', /^(MY_IC|SG_NRIC|PASSPORT|PPSN|NINO|COMPANY_NO|UEN)_|\.ID_NO$/],
    ['Tax numbers', /^TAX_NO_/],
    ['Addresses and postcodes', /(\.ADDRESS$|^POSTCODE_|^EIRCODE_)/],
    ['Phone numbers, emails and links', /(\.EMAIL$|\.PHONE$|^PHONE_|^EMAIL_|^URL_)/],
    ['Case and record numbers', /^(CASE_NO_|RECORD_NO$)/],
    ['Bank, card and other ID numbers', /^(CARD|IBAN|ID_NUMBER|NUMBER)_|\.REF$/],
    ['Vehicle registrations', /^VEHICLE_/],
    ['Other things you asked to hide', /^HIDDEN_/],
  ];

  /** How many distinct things were hidden, grouped for people to read. */
  function hiddenSummary(table) {
    const counts = new Map();
    for (const { token, match } of table) {
      if (match === false) continue;
      const hit = CATEGORIES.find(([, re]) => re.test(token));
      if (hit) counts.set(hit[0], (counts.get(hit[0]) || 0) + 1);
    }
    return CATEGORIES.map(([label]) => [label, counts.get(label) || 0]).filter(([, n]) => n > 0);
  }

  // Some jurisdictions call a document something else.
  function docLabel(key) {
    const d = DOCS.find((x) => x.key === key);
    if (state.jurisdiction === 'Singapore' && key === 'writ') return 'Originating Claim';
    return d.label;
  }

  function docBlurb(key) {
    const d = DOCS.find((x) => x.key === key);
    if (state.jurisdiction === 'Singapore') {
      if (key === 'writ') return 'Starts the case under the Rules of Court 2021 (it replaced the writ). Usually served with the Statement of Claim.';
      if (key === 'witness_statement') return 'One person\'s account. Note: trial evidence in Singapore is normally given by affidavit of evidence-in-chief (AEIC). Tick Affidavit for that.';
    }
    return d.blurb;
  }

  // ------------------------------------------------------------ draft render

  /** Draft text -> HTML. ">> " centres a line; ALL-CAPS lines are bold. */
  function draftToHtml(text) {
    const blocks = String(text).replace(/\r/g, '').split(/\n\s*\n/);
    return blocks.map((block) => {
      const lines = block.split('\n');
      const centred = lines.every((l) => l.startsWith('>>'));
      const html = lines.map((l) => {
        const clean = l.replace(/^>>\s?/, '');
        const isHeading = /\p{L}/u.test(clean) && clean === clean.toUpperCase() && clean.trim().length > 2;
        return isHeading ? `<b>${esc(clean)}</b>` : esc(clean);
      }).join('<br>');
      const unknown = html.replace(/\[([A-Z][A-Z0-9_.]*)\?\]/g, '<mark class="unknown">[$1?]</mark>');
      return `<p${centred ? ' class="c"' : ''}>${unknown}</p>`;
    }).join('\n');
  }

  const DOC_CSS = `
    @page { size: A4; margin: 2.54cm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #000; }
    p { margin: 0 0 12pt; text-align: justify; }
    p.c { text-align: center; }
    mark.unknown { background: #ffe08a; }
    p.mark { text-align: right; font-size: 9pt; color: #888; font-family: Arial, sans-serif; }
  `;

  function draftMark() {
    if (!state.markDraft) return '';
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<p class="mark">DRAFT, for review. Privileged and confidential. ${esc(date)}</p>`;
  }

  function standaloneHtml(title, text) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body>${draftMark()}${draftToHtml(text)}</body></html>`;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function downloadWord(label, text) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(label)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${DOC_CSS}</style></head><body>${draftMark()}${draftToHtml(text)}</body></html>`;
    download(`${fileSafe(label)}.doc`, '﻿' + html, 'application/msword');
  }

  function printDraft(label, text) {
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups for this page to print.'); return; }
    w.document.write(standaloneHtml(label, text));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  function fileSafe(label) {
    const rec = state.recordNo.trim() ? state.recordNo.trim().replace(/[^\w-]+/g, '-') + ' ' : '';
    return (rec + label).replace(/[\\/:*?"<>|]+/g, '-');
  }

  // -------------------------------------------------------------- the steps

  const views = {};

  views.case = () => {
    const t = T();
    const jur = JURISDICTIONS.find((j) => j.value === state.jurisdiction);
    return [
      card('Court', 'Where the case is, and what the parties are called.',
        h('div', { class: 'grid' },
          field('Jurisdiction', 'jurisdiction', { type: 'select', rerender: true, options: [{ value: '', label: 'Choose…' }, ...JURISDICTIONS.map((j) => ({ value: j.value, label: j.value }))],
            onchange: (v) => {
              const j = JURISDICTIONS.find((x) => x.value === v);
              if (j) state.terms = j.terms;
              if (!j || !j.languages) state.language = 'English';
              save();
            } }),
          field('Court name', 'court', { placeholder: jur && jur.courts[0] ? jur.courts[0] : 'Type the full court name', suggestions: jur ? jur.courts : [], hint: jur && jur.courts.length ? 'Pick from the list or type your own.' : null }),
          jur && jur.languages && field('Language of the documents', 'language', { type: 'select', options: [{ value: 'English', label: 'English' }, { value: 'Bahasa Malaysia', label: 'Bahasa Malaysia' }] }),
          field('Record / case number', 'recordNo', { optional: true, placeholder: 'Leave blank if not issued yet' }),
          field('The parties are called', 'terms', { type: 'select', rerender: true, options: [
            { value: 'pd', label: 'Plaintiff and Defendant' },
            { value: 'cd', label: 'Claimant and Defendant' },
            { value: 'ar', label: 'Applicant and Respondent' },
          ] }),
          field('We act for the', 'actFor', { type: 'select', rerender: true, options: [{ value: 'p', label: t.p }, { value: 'd', label: t.d }] }),
        )),
      partyCard('plaintiffs', t.p + 's', 'p'),
      partyCard('defendants', t.d + 's', 'd'),
      card('Other people', 'Anyone else named in the facts: witnesses, doctors, police officers, employers. They will be hidden too.',
        ...state.people.map((p, i) => h('div', { class: 'row-card' },
          h('div', { class: 'grid' },
            field('Name', `people.${i}.name`),
            field('Gender', `people.${i}.gender`, { type: 'select', options: GENDERS, hint: 'So the drafts use the right he / she.' }),
            field('Who are they?', `people.${i}.role`, { placeholder: 'e.g. eye witness, treating doctor' }),
            field('Address', `people.${i}.address`, { optional: true, wide: true }),
          ),
          h('button', { type: 'button', class: 'link danger', onclick: () => { state.people.splice(i, 1); setPath('people', state.people); render(); } }, 'Remove'))),
        h('button', { type: 'button', class: 'secondary', onclick: () => { state.people.push(blankPerson()); setPath('people', state.people); render(); } }, '+ Add a person')),
      card('Solicitors and counsel', null,
        h('h3', {}, `Our firm (for the ${state.actFor === 'p' ? t.p : t.d})`),
        firmFields('ourFirm'),
        h('h3', {}, `Other side's solicitors`),
        firmFields('otherFirm'),
        h('div', { class: 'grid' }, field('Counsel', 'counsel', { optional: true }))),
      card('Anything else to hide', 'ID numbers, phone numbers, emails, postcodes, bank accounts and case numbers are found automatically. Add anything else that could identify someone, such as a school, a workplace, a building or a nickname. One per line.',
        (() => {
          const ta = h('textarea', { rows: 3, placeholder: 'e.g. SMK Taman Desa\nBlock 123 Ang Mo Kio', oninput: (e) => setPath('hide', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)) });
          ta.value = state.hide.join('\n');
          return h('div', { class: 'field wide' }, ta);
        })()),
      nav(null, 'facts'),
    ];
  };

  // Example names in placeholders that suit the jurisdiction.
  function ex() {
    if (/Malaysia/.test(state.jurisdiction)) return { person: 'Tan Ah Kow / Siti binti Abdullah', org: 'Syarikat Maju Jaya Sdn. Bhd.' };
    if (state.jurisdiction === 'Singapore') return { person: 'Lim Mei Ling', org: 'Lion City Logistics Pte. Ltd.' };
    return { person: 'Mary O\'Neill', org: 'Acme Haulage Limited' };
  }

  function partyCard(list, title, side) {
    return card(title, null,
      ...state[list].map((p, i) => h('div', { class: 'row-card' },
        h('div', { class: 'grid' },
          field('Person or company?', `${list}.${i}.kind`, { type: 'select', rerender: true, options: [{ value: 'person', label: 'Person' }, { value: 'org', label: 'Company / organisation' }] }),
          field(p.kind === 'org' ? 'Full company name' : 'Full name', `${list}.${i}.name`, { placeholder: p.kind === 'org' ? `e.g. ${ex().org}` : `e.g. ${ex().person}` }),
          p.kind !== 'org' && field('Gender', `${list}.${i}.gender`, { type: 'select', options: GENDERS, hint: 'So the drafts use the right he / she.' }),
          field(p.kind === 'org' ? 'Company no. / UEN' : 'IC / NRIC / passport no.', `${list}.${i}.idNo`, { optional: true, placeholder: p.kind === 'org' ? 'e.g. 202001012345 (1234567-X)' : 'e.g. 900101-14-5678' }),
          field('Description', `${list}.${i}.description`, { optional: true, placeholder: p.kind === 'org' ? 'e.g. a logistics company' : 'e.g. a retired teacher' }),
          field('Address', `${list}.${i}.address`, { optional: true, wide: true }),
        ),
        state[list].length > 1 && h('button', { type: 'button', class: 'link danger', onclick: () => { state[list].splice(i, 1); setPath(list, state[list]); render(); } }, 'Remove'))),
      h('button', { type: 'button', class: 'secondary', onclick: () => { state[list].push(blankParty()); setPath(list, state[list]); render(); } }, `+ Add another ${side === 'p' ? T().p : T().d}`));
  }

  function firmFields(key) {
    return h('div', { class: 'grid' },
      field('Firm name', `${key}.name`, { optional: key === 'otherFirm' }),
      field('Address', `${key}.address`, { optional: true }),
      field('Reference', `${key}.ref`, { optional: true }),
      field('Email', `${key}.email`, { optional: true }),
      field('Phone', `${key}.phone`, { optional: true }));
  }

  views.facts = () => [
    card('What happened?', 'Write the facts in your own words, just as the client told them: who, what, when, where, and what harm was caused. Use real names. They are hidden before anything leaves this computer.',
      field('Facts of the case', 'facts', { type: 'textarea', rows: 16, wide: true, placeholder: 'e.g. On 3 March 2024 at about 8.15am Mary O\'Neill was crossing Main Street, Newry at the pedestrian lights when a lorry driven by an employee of Acme Haulage Limited went through a red light and struck her…' }),
      field('What are we asking the court for?', 'relief', { type: 'textarea', rows: 4, wide: true, optional: true, placeholder: 'e.g. Damages for personal injury, loss and damage; special damages of £4,250; interest; costs.' })),
    nav('case', 'docs'),
  ];

  views.docs = () => {
    const opts = [{ value: '', label: 'Choose…' }, ...peopleOptions()];
    return [
      card('Which documents do you need?', 'Tick as many as you need. Each one is drafted separately from the same facts.',
        h('div', { class: 'doc-list' }, DOCS.map((d) => {
          const on = state.docs[d.key].on;
          return h('div', { class: 'doc-option' + (on ? ' on' : '') },
            field(docLabel(d.key), `docs.${d.key}.on`, { type: 'checkbox', rerender: true, hint: docBlurb(d.key) }),
            on && h('div', { class: 'doc-extra' }, docExtra(d.key, opts)));
        }))),
      nav('facts', DOCS.some((d) => state.docs[d.key].on) ? 'check' : null, 'Next: hide the names →'),
    ];
  };

  function docExtra(key, opts) {
    const base = `docs.${key}`;
    const notes = field('Anything special for this document?', `${base}.notes`, { type: 'textarea', rows: 2, optional: true, wide: true });
    if (key === 'witness_statement') {
      return h('div', { class: 'grid' },
        field('Whose statement?', `${base}.witness`, { type: 'select', rerender: true, options: opts, hint: opts.length === 1 ? 'Add names in Case details first.' : null }),
        field('Their occupation', `${base}.occupation`, { optional: true }),
        field('Statement number', `${base}.number`),
        notes);
    }
    if (key === 'affidavit') {
      return h('div', { class: 'grid' },
        field('Who is swearing it?', `${base}.deponent`, { type: 'select', rerender: true, options: opts }),
        field('Their occupation', `${base}.occupation`, { optional: true }),
        field('Sworn or affirmed?', `${base}.oath`, { type: 'select', options: [{ value: 'swear', label: 'Sworn (oath)' }, { value: 'affirm', label: 'Affirmed' }] }),
        field('What is it for?', `${base}.purpose`, { optional: true, wide: true, placeholder: /Malaysia|Singapore/.test(state.jurisdiction) ? 'e.g. in support of an application for summary judgment' : 'e.g. to ground a motion for judgment in default of defence' }),
        notes);
    }
    if (key === 'reply') {
      return h('div', { class: 'grid' },
        field('Paste the Defence you are replying to', `${base}.defence`, { type: 'textarea', rows: 8, wide: true, hint: 'Names in it are hidden too.' }),
        field('The Defence includes a counterclaim', `${base}.counterclaim`, { type: 'checkbox' }),
        notes);
    }
    return notes;
  }

  views.check = () => {
    const p = preparePayload();
    const map = p.cloak.table();
    const problems = [];
    if (!state.jurisdiction) problems.push('Choose a jurisdiction in Case details.');
    if (!state.facts.trim()) problems.push('Enter the facts.');
    if (!state.plaintiffs.some((x) => x.name.trim()) || !state.defendants.some((x) => x.name.trim())) problems.push(`Enter at least one ${T().p} and one ${T().d}.`);
    if (state.docs.witness_statement.on && !state.docs.witness_statement.witness) problems.push('Choose whose witness statement it is.');
    if (state.docs.affidavit.on && !state.docs.affidavit.deponent) problems.push('Choose who is swearing the affidavit.');
    if (state.docs.reply.on && !state.docs.reply.defence.trim()) problems.push('Paste the Defence for the Reply.');
    const summary = hiddenSummary(map);
    const canSend = () => state.checked && !!state.checkedBy.trim() && problems.length === 0;

    const highlight = (text) => esc(text).replace(/\{\{[^}]+\}\}/g, (m) => `<span class="tok">${m}</span>`);

    return [
      card('Check what will be sent', 'Names and details have been swapped for codes like {{PLAINTIFF_1}}. Only the text in the grey box leaves this computer. The list of real names stays here.',
        problems.length > 0 && h('div', { class: 'alert warn' }, h('b', {}, 'Before you send:'), h('ul', {}, problems.map((x) => h('li', {}, x)))),
        p.suspects.length > 0 && h('div', { class: 'alert' },
          h('b', {}, 'These might be names that weren\'t hidden. Check each one:'),
          h('ul', { class: 'suspects' }, p.suspects.slice(0, 30).map((s) => h('li', {},
            h('code', {}, s.text), s.count > 1 && h('small', {}, ` ×${s.count}`),
            h('button', { type: 'button', class: 'small primary', onclick: () => { setPath('hide', [...state.hide, s.text]); render(); } }, 'Hide it'),
            h('button', { type: 'button', class: 'small ghost', onclick: () => { setPath('allow', [...state.allow, s.text]); render(); } }, 'It\'s fine'))))),
        p.suspects.length === 0 && h('div', { class: 'alert ok' }, 'No obvious names left in the text. Still read it through before you send.'),
        summary.length > 0 && h('div', { class: 'summary' },
          h('b', {}, 'Hidden: '),
          summary.map(([label, n]) => h('span', { class: 'chip' }, `${label}: ${n}`))),
        h('h3', {}, 'Cloaked case brief'),
        h('pre', { class: 'payload', html: highlight(p.brief) }),
        p.docs.filter((d) => d.instructions.trim()).map((d) => [h('h3', {}, `${d.label}: extra instructions`), h('pre', { class: 'payload', html: highlight(d.instructions) })]),
        h('details', { class: 'map' },
          h('summary', {}, `Name map (${map.length}): stays on this computer, never sent`),
          h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Code'), h('th', {}, 'Real value'))),
            h('tbody', {}, map.map((r) => h('tr', {}, h('td', {}, h('code', {}, `{{${r.token}}}`)), h('td', {}, r.value))))))),
      card('Send for drafting', null,
        h('div', { class: 'grid' }, field('Checked by (your name or initials)', 'checkedBy', {
          hint: 'Kept in the send record on this computer. Not sent to the AI.',
          oninput: () => { document.getElementById('send-btn').disabled = !canSend(); },
        })),
        field('I have read the grey box and nothing in it identifies anyone', 'checked', { type: 'checkbox', rerender: true }),
        h('div', { class: 'nav' },
          h('button', { type: 'button', class: 'ghost', onclick: () => go('docs') }, '← Back'),
          h('button', { type: 'button', id: 'send-btn', class: 'primary', disabled: !canSend(), onclick: () => runDrafts(p, summary) },
            `Draft ${p.docs.length} document${p.docs.length === 1 ? '' : 's'} →`))),
    ];
  };

  views.drafts = () => {
    const run = state.run;
    if (!run) return [card('No drafts yet', 'Fill in the case, pick your documents and send them for drafting.'), nav('check')];
    const keys = Object.keys(run.results);
    if (!state.activeDraft || !run.results[state.activeDraft]) state.activeDraft = keys[0];
    const r = run.results[state.activeDraft];
    const doc = { ...DOCS.find((d) => d.key === state.activeDraft) };
    doc.label = run.labels?.[doc.key] || doc.label;

    return [
      h('div', { class: 'tabs', role: 'tablist' }, keys.map((k) => {
        const res = run.results[k];
        const d = DOCS.find((x) => x.key === k);
        return h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === state.activeDraft), class: 'tab ' + res.status,
          onclick: () => { state.activeDraft = k; save(); render(); } }, run.labels?.[k] || d.label, h('span', { class: 'dot', title: res.status }));
      })),
      h('section', { class: 'card draft' },
        r.status === 'working' && h('div', { class: 'working' }, h('span', { class: 'spinner' }), `Drafting the ${doc.label}… this can take a minute or two.`),
        r.status === 'error' && h('div', { class: 'alert warn' }, h('b', {}, 'Drafting failed: '), r.error,
          h('div', {}, h('button', { type: 'button', class: 'secondary', onclick: () => redraft(state.activeDraft) }, 'Try again'))),
        r.status === 'done' && draftView(doc, r)),
      h('div', { class: 'run-bar' },
        field('Mark printed and Word copies as DRAFT', 'markDraft', { type: 'checkbox' }),
        h('button', { type: 'button', class: 'ghost', onclick: downloadSendRecord }, 'Download send record'),
        run.sentAt && h('small', { class: 'hint' }, `Sent ${new Date(run.sentAt).toLocaleString('en-GB')}${run.checkedBy ? `, checked by ${run.checkedBy}` : ''}`)),
      h('p', { class: 'disclaimer' }, 'These are first drafts for a solicitor to check. Check every fact, date, amount and name, and fill in anything in [square brackets], before a document is signed, sworn, issued or served.'),
      nav('check', null),
    ];
  };

  let editing = false;
  let showCloaked = false;

  function draftView(doc, r) {
    const warnings = [];
    if (r.unknown && r.unknown.length) warnings.push(`The drafter used codes we don't recognise: ${r.unknown.join(', ')}. They're highlighted. Replace them by hand.`);
    if (r.truncated) warnings.push('This draft was cut off before the end. Try drafting it again.');
    const placeholders = (r.text.match(/\[[^\]\n]{2,60}\]/g) || []).filter((x) => !/\?\]$/.test(x));

    const toolbar = h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: editing ? 'primary' : 'secondary', onclick: () => { editing = !editing; showCloaked = false; render(); } }, editing ? 'Done editing' : 'Edit text'),
      h('button', { type: 'button', class: 'secondary', onclick: () => downloadWord(doc.label, r.text) }, 'Download Word'),
      h('button', { type: 'button', class: 'secondary', onclick: () => printDraft(doc.label, r.text) }, 'Print / PDF'),
      h('button', { type: 'button', class: 'secondary', onclick: (e) => copy(r.text, e.target) }, 'Copy'),
      h('button', { type: 'button', class: 'ghost', onclick: () => { showCloaked = !showCloaked; editing = false; render(); } }, showCloaked ? 'Show real names' : 'Show cloaked version'),
      h('button', { type: 'button', class: 'ghost', onclick: () => { if (confirm('Draft this document again? Your edits to it will be lost.')) redraft(doc.key); } }, 'Redraft'));

    let body;
    if (showCloaked) {
      body = h('pre', { class: 'payload', html: esc(r.cloaked).replace(/\{\{[^}]+\}\}/g, (m) => `<span class="tok">${m}</span>`) });
    } else if (editing) {
      const ta = h('textarea', { class: 'editor', rows: 30, oninput: (e) => { r.text = e.target.value; save(); } });
      ta.value = r.text;
      body = h('div', {}, h('small', { class: 'hint' }, 'Tip: start a line with ">> " to centre it. Lines in CAPITALS print in bold.'), ta);
    } else {
      body = h('div', { class: 'paper', html: draftToHtml(r.text) });
    }

    return [
      toolbar,
      warnings.map((w) => h('div', { class: 'alert warn' }, w)),
      placeholders.length > 0 && h('div', { class: 'alert' }, h('b', {}, `${placeholders.length} gap${placeholders.length === 1 ? '' : 's'} to fill in: `), [...new Set(placeholders)].slice(0, 12).join('  ')),
      body,
    ];
  }

  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = old; }, 1200);
    }, () => alert('Could not copy. Select the text and copy it by hand.'));
  }

  // --------------------------------------------------------------- drafting

  async function callDrafter(docType, brief, instructions) {
    const res = await fetch('api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType, brief, instructions }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    return data;
  }

  async function draftOne(key, brief, instructions) {
    const run = state.run;
    const cloak = Cloak.fromJSON(run.map);
    const r = run.results[key];
    Object.assign(r, { status: 'working', error: null });
    render();
    try {
      const data = await callDrafter(key, brief, instructions);
      const { text, unknown } = cloak.uncloak(data.text);
      Object.assign(r, { status: 'done', cloaked: data.text, text, unknown, model: data.model, truncated: !!data.truncated });
    } catch (err) {
      Object.assign(r, { status: 'error', error: err.message });
    }
    save();
    if (state.run === run) render();
  }

  function runDrafts(payload, summary) {
    editing = false;
    showCloaked = false;
    state.run = {
      sentAt: new Date().toISOString(),
      checkedBy: state.checkedBy.trim(),
      jurisdiction: state.jurisdiction,
      summary,
      labels: Object.fromEntries(payload.docs.map((d) => [d.key, d.label])),
      map: payload.cloak.toJSON(),
      brief: payload.brief,
      instructions: Object.fromEntries(payload.docs.map((d) => [d.key, d.instructions])),
      results: Object.fromEntries(payload.docs.map((d) => [d.key, { status: 'working' }])),
    };
    state.activeDraft = payload.docs[0]?.key || null;
    go('drafts');
    payload.docs.forEach((d) => draftOne(d.key, payload.brief, d.instructions));
  }

  function redraft(key) {
    editing = false;
    showCloaked = false;
    draftOne(key, state.run.brief, state.run.instructions[key]);
  }

  /**
   * A record of exactly what left the firm: when, who checked it, what was
   * hidden, and the cloaked text itself. The name map is not included.
   */
  function downloadSendRecord() {
    const run = state.run;
    if (!run) return;
    const models = [...new Set(Object.values(run.results).map((r) => r.model).filter(Boolean))].join(', ') || 'n/a';
    const docs = Object.keys(run.results).map((k) => run.labels?.[k] || k);
    const sections = [`<h2>Case brief</h2><pre>${esc(run.brief)}</pre>`]
      .concat(Object.entries(run.instructions).filter(([, v]) => v.trim()).map(([k, v]) => `<h2>${esc(run.labels?.[k] || k)}: instructions</h2><pre>${esc(v)}</pre>`));
    const rows = [
      ['Matter', [state.recordNo, state.ourFirm.ref].filter((x) => x && x.trim()).join(' / ') || 'not stated'],
      ['Sent', new Date(run.sentAt).toLocaleString('en-GB')],
      ['Checked by', run.checkedBy || 'not recorded'],
      ['Jurisdiction', run.jurisdiction || state.jurisdiction],
      ['Documents', docs.join(', ')],
      ['Drafting service', models],
      ['Items hidden', (run.summary || []).map(([l, n]) => `${l}: ${n}`).join('; ') || 'none'],
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cloak send record</title>
<style>body{font:14px/1.5 Arial,sans-serif;max-width:860px;margin:30px auto;color:#111}table{border-collapse:collapse}td{padding:4px 14px 4px 0;vertical-align:top}td:first-child{font-weight:bold;white-space:nowrap}pre{white-space:pre-wrap;background:#f3f3f3;padding:12px;border:1px solid #ddd;font-size:12px}.note{background:#eef5ee;border:1px solid #9c9;padding:10px}</style></head>
<body><h1>Cloak send record</h1>
<p class="note">This is exactly what was sent to the AI drafting service. Names and identifiers were replaced with codes before sending. The list linking codes to real details stayed on the sender's computer and was not sent.</p>
<table>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
${sections.join('\n')}
</body></html>`;
    download(`${fileSafe('send record')}.html`, html, 'text/html');
  }

  // ----------------------------------------------------------------- render

  function renderSteps() {
    const el = document.getElementById('steps');
    el.replaceChildren(h('ol', {}, STEPS.map((s, i) => h('li', {},
      h('button', { type: 'button', class: s.key === state.step ? 'active' : '', 'aria-current': s.key === state.step ? 'step' : null, onclick: () => go(s.key) },
        h('span', { class: 'num' }, i + 1), s.label)))),
    h('p', { class: 'privacy' }, 'Real names are kept only in this browser. Use "Clear everything" when you finish a matter on a shared computer.'));
  }

  function render() {
    renderSteps();
    const main = document.getElementById('main');
    const view = views[state.step] || views.case;
    main.replaceChildren(h('h1', {}, STEPS.find((s) => s.key === state.step)?.label || ''), ...view().flat());
  }

  // ---------------------------------------------------------------- toolbar

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear all case details, facts and drafts from this browser?')) return;
    state = blankState();
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    render();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const name = fileSafe('matter').trim() || 'matter';
    download(`${name}.json`, JSON.stringify(state, null, 2), 'application/json');
  });

  document.getElementById('btn-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      state = merge(blankState(), JSON.parse(await file.text()));
      save();
      render();
    } catch {
      alert('That file could not be opened. Is it a matter file saved from this page?');
    }
  });

  fetch('api/status').then((r) => r.json()).then((s) => {
    const el = document.getElementById('mode');
    el.hidden = false;
    el.textContent = s.mode === 'live' ? 'Live drafting' : 'Demo mode: no AI key set';
    el.className = 'mode ' + s.mode;
  }).catch(() => {});

  render();
})();

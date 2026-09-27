/*
 * Cloak — reversible pseudonymisation for legal drafting.
 *
 * cloak(text)   replaces every known name / identifier with a token such as
 *               {{PLAINTIFF_1}} and records the mapping.
 * uncloak(text) puts the real values back.
 *
 * The mapping only ever lives in the browser. Only cloaked text is sent to the
 * drafting service.
 *
 * Works in the browser (window.Cloak) and in Node (require / import).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Cloak = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TOKEN_RE = /\{\{\s*([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)?)\s*(?:\|\s*([A-Z]+)\s*)?\}\}/g;

  const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'dame', 'lord', 'lady', 'rev', 'fr', 'sr']);
  const PARTICLES = new Set(['ó', 'o', 'ní', 'nic', 'mac', 'mc', 'uí', 'de', 'di', 'da', 'du', 'del', 'della', 'van', 'von', 'der', 'den', 'le', 'la', 'st', 'st.', 'bin', 'bint', 'al', 'el']);
  const COMPANY_SUFFIX = /[\s,]+(limited|ltd\.?|plc|dac|clg|uc|llp|lp|inc\.?|llc|unlimited company|designated activity company|company limited by guarantee)$/i;

  // Identifiers detected automatically, even if nobody typed them into the
  // parties list. Order matters: earlier patterns win on overlap.
  const DETECTORS = [
    { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g },
    { type: 'PPSN', re: /\b\d{7}[A-W][A-IW]?\b/g },
    { type: 'NINO', re: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g },
    { type: 'EIRCODE', re: /\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/g },
    { type: 'POSTCODE', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b/g },
    { type: 'PHONE', re: /(?<![\w/])(?:\+\d{1,3}[\s-]?)?(?:\(0\)\s?)?\(?\d{2,5}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}(?![\w/])/g },
  ];

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function norm(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function applyModifier(value, mod) {
    if (mod === 'UPPER') return value.toUpperCase();
    if (mod === 'LOWER') return value.toLowerCase();
    return value;
  }

  // Word-boundary match that also works for names with accents (Ó Briain,
  // Siobhán) and apostrophes (O'Neill).
  function aliasRegex(alias) {
    const body = escapeRe(alias).replace(/\\?'|’/g, "['’]").replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'giu');
  }

  function splitPersonName(name) {
    const words = norm(name).split(' ').filter(Boolean);
    while (words.length && TITLES.has(words[0].toLowerCase().replace(/\.$/, ''))) words.shift();
    return words;
  }

  class Cloak {
    constructor() {
      this.entries = []; // { token, value, aliases: [{text, token}] }
      this.byToken = new Map(); // token -> value
      this.byValue = new Map(); // lowercased value -> token
      this.counters = new Map();
    }

    nextToken(prefix) {
      const n = (this.counters.get(prefix) || 0) + 1;
      this.counters.set(prefix, n);
      return `${prefix}_${n}`;
    }

    // Register one literal value under a token. Returns the token actually used
    // (an existing one if the same value was already registered).
    // With { match: false } the value is only used when uncloaking (e.g. exhibit
    // initials) and is never searched for in text.
    register(token, value, { match = true } = {}) {
      value = norm(value);
      if (!value) return null;
      const key = value.toLowerCase();
      if (match && this.byValue.has(key)) return this.byValue.get(key);
      if (this.byToken.has(token)) throw new Error(`Token ${token} already used`);
      this.byToken.set(token, value);
      if (match) this.byValue.set(key, token);
      const m = /^([A-Z][A-Z0-9_]*?)_(\d+)$/.exec(token);
      if (m && Number(m[2]) > (this.counters.get(m[1]) || 0)) this.counters.set(m[1], Number(m[2]));
      this.entries.push({ token, value, match });
      return token;
    }

    /**
     * Add a person. Registers the full name, plus the surname and first name on
     * their own so "Mr Murphy" and "Aoife" are also cloaked.
     */
    addPerson(prefix, name, extra = {}) {
      name = norm(name);
      if (!name) return null;
      const base = extra.token || this.nextToken(prefix);
      const token = this.register(base, name);
      if (token !== base) return token;
      const words = splitPersonName(name);
      if (words.length >= 2) {
        const stripped = words.join(' ');
        if (stripped.toLowerCase() !== name.toLowerCase()) this.register(`${base}.NAME`, stripped);
        // Keep surname particles: Ó Briain, Mac Giolla, de Búrca, van der Berg.
        let start = words.length - 1;
        while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase())) start--;
        const surname = words.slice(start).join(' ');
        const first = words[0];
        if (surname.length >= 2) this.register(`${base}.SURNAME`, surname);
        const core = words[words.length - 1];
        if (core !== surname && core.length >= 3) this.register(`${base}.SURNAME_CORE`, core);
        if (first.length >= 2) this.register(`${base}.FIRST`, first);
      }
      this.addDetails(base, extra);
      return base;
    }

    /** Add a company / firm. Also cloaks the name without "Limited" etc. */
    addOrganisation(prefix, name, extra = {}) {
      name = norm(name);
      if (!name) return null;
      const base = extra.token || this.nextToken(prefix);
      const token = this.register(base, name);
      if (token !== base) return token;
      const short = name.replace(COMPANY_SUFFIX, '').trim();
      if (short && short.length >= 3 && short.toLowerCase() !== name.toLowerCase()) {
        this.register(`${base}.SHORT`, short);
      }
      this.addDetails(base, extra);
      return base;
    }

    addDetails(base, { address, email, phone } = {}) {
      address = norm(address);
      if (address) {
        this.register(`${base}.ADDRESS`, address);
        const firstLine = norm(address.split(/,|\n/)[0]);
        if (firstLine && firstLine.length >= 5 && firstLine !== address) {
          this.register(`${base}.ADDRESS_LINE1`, firstLine);
        }
      }
      if (norm(email)) this.register(`${base}.EMAIL`, email);
      if (norm(phone)) this.register(`${base}.PHONE`, phone);
    }

    /** Any other literal the user wants hidden. */
    addLiteral(prefix, value) {
      value = norm(value);
      if (!value) return null;
      const existing = this.byValue.get(value.toLowerCase());
      if (existing) return existing;
      return this.register(this.nextToken(prefix), value);
    }

    /** Replace every known value (and auto-detected identifiers) with tokens. */
    cloak(text) {
      let out = String(text || '');

      // Replaced spans are parked on a shelf and stood in for by a single
      // private-use character, so later passes can never match inside them.
      const shelf = [];
      const shelve = (s) => String.fromCharCode(0xe000 + shelf.push(s) - 1);
      out = out.replace(TOKEN_RE, (m) => shelve(m));

      // Known values first, longest first, so "John Smith" wins over "Smith"
      // and a full address wins over the postcode inside it.
      const all = [...this.entries].sort((a, b) => b.value.length - a.value.length);
      for (const { token, value, match } of all) {
        if (!match) continue;
        const lowerValue = value === value.toLowerCase();
        out = out.replace(aliasRegex(value), (m) => {
          // "may" or "wood" in ordinary prose is not the surname May / Wood.
          if (!lowerValue && m === m.toLowerCase()) return m;
          return shelve(`{{${token}}}`);
        });
      }

      // Then identifiers nobody typed in: emails, phone numbers, postcodes...
      for (const d of DETECTORS) {
        out = out.replace(d.re, (m) => {
          if (/^\d{1,6}$/.test(m.replace(/\s/g, ''))) return m; // too short to be a phone number
          const token = this.addLiteral(d.type, m);
          return shelve(`{{${token}}}`);
        });
      }

      return out.replace(/[\ue000-\uf8ff]/g, (ch) => shelf[ch.charCodeAt(0) - 0xe000] ?? ch);
    }

    /**
     * Put the real values back. Returns { text, unknown } where unknown lists
     * tokens the drafter produced that we have no value for.
     */
    uncloak(text) {
      const unknown = new Set();
      const out = String(text || '').replace(TOKEN_RE, (m, token, mod) => {
        let value = this.byToken.get(token);
        if (value === undefined) {
          unknown.add(token);
          return `[${token}?]`;
        }
        return applyModifier(value, mod);
      });
      return { text: out, unknown: [...unknown] };
    }

    /** Token -> real value, for the local-only name map table. */
    table() {
      return this.entries.map(({ token, value, match }) => (match ? { token, value } : { token, value, match }));
    }

    toJSON() {
      return { entries: this.table() };
    }

    static fromJSON(data) {
      const c = new Cloak();
      for (const { token, value, match } of (data && data.entries) || []) c.register(token, value, { match: match !== false });
      return c;
    }
  }

  // Words that are normally capitalised in legal text and are not names.
  const COMMON = new Set(`
    a an the and or of in on at to for by with from as is was were be been it its this that these those
    i he she they we you his her their our my your him them us me
    mr mrs ms miss dr sir madam
    plaintiff plaintiffs defendant defendants claimant claimants applicant applicants respondent respondents
    appellant appellants deponent witness court high circuit district supreme county crown judge justice master registrar
    king kings queen queens bench division chancery family commercial common law civil criminal appeal
    honourable honorable statement claim claims writ summons affidavit reply defence defense counterclaim particulars
    notice order rules rule section act acts regulation regulations schedule article part paragraph exhibit exhibits
    record no number ltd limited plc dac company solicitor solicitors counsel barrister senior junior commissioner oaths
    euro eur gbp sterling pounds cent
    january february march april may june july august september october november december
    monday tuesday wednesday thursday friday saturday sunday
    ireland irish northern england wales welsh scotland scottish britain british uk united kingdom eu european union
    dublin belfast cork london
    garda gardaí police psni hse nhs hospital road street avenue lane
    further furthermore however accordingly thereafter subsequently whereas wherefore save except
    date dated sworn affirmed signed filed delivered issued served before
    true truth knowledge belief information
  `.split(/\s+/).filter(Boolean));

  /**
   * Heuristic scan of cloaked text for things that still look like names:
   * capitalised words mid-sentence, or anything following a title (Mr, Dr...).
   * Returns [{ text, count }] most frequent first.
   */
  function findSuspects(text) {
    const counts = new Map();
    const bump = (s) => counts.set(s, (counts.get(s) || 0) + 1);
    const plain = String(text || '').replace(TOKEN_RE, ' ');

    // Title + capitalised word: a strong signal.
    const titled = /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Sir|Dame|Garda|Sgt|Inspector|Judge)\.?\s+((?:[A-Z][\p{L}'’-]+)(?:\s+[A-Z][\p{L}'’-]+)*)/gu;
    const titledNames = [...plain.matchAll(titled)].map((m) => m[1]);

    // Runs of capitalised words, skipping ones that start a sentence.
    const sentences = plain.split(/(?<=[.!?:;])\s+|\n+/);
    for (const s of sentences) {
      const words = [...s.matchAll(/[\p{L}][\p{L}'’-]*/gu)];
      let run = [];
      const flush = () => {
        const isCommon = (w) => COMMON.has(w.text.toLowerCase().replace(/['’]s$/, ''));
        const first = run.findIndex((w) => !isCommon(w));
        if (first !== -1 && !(run.length === 1 && run[0].first)) {
          let last = run.length - 1;
          while (isCommon(run[last])) last--;
          bump(run.slice(first, last + 1).map((w) => w.text).join(' ').replace(/['’]s$/, ''));
        }
        run = [];
      };
      words.forEach((m, i) => {
        const w = m[0];
        const isCap = /^\p{Lu}/u.test(w) && !/^\p{Lu}+$/u.test(w); // skip ALL-CAPS headings
        if (isCap) run.push({ text: w, first: i === 0 });
        else flush();
      });
      flush();
    }

    // Names after a title are usually caught above; make sure they always are.
    for (const t of titledNames) if (!counts.has(t)) bump(t);

    return [...counts.entries()]
      .map(([t, count]) => ({ text: t, count }))
      .filter((s) => s.text.length > 1)
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
  }

  return { Cloak, findSuspects, TOKEN_RE };
});

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

  const TITLES = new Set([
    'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'dame', 'lord', 'lady', 'rev', 'fr', 'sr',
    // Malaysia / Singapore honorifics
    'encik', 'en', 'puan', 'pn', 'cik', 'tuan', 'tun', 'datuk', 'dato', "dato'", 'datin', 'datuk seri',
    'tengku', 'tunku', 'haji', 'hajah', 'hj', 'hjh', 'madam', 'mdm', 'ir', 'ar', 'yb', 'yab',
  ]);
  // Two-word titles. "Tan" and "Toh" on their own are common surnames, so they
  // only count as a title in these pairs.
  const TITLE_PAIRS = new Set(['tan sri', 'puan sri', 'toh puan', 'datuk seri', "dato' seri", 'dato seri', "dato' sri", 'dato sri', 'datin seri', 'yang berhormat', 'yang amat']);
  // Words that join the parts of a surname or patronymic: Ó Briain, van der
  // Berg, Ahmad bin Ismail, Siti binti Abdullah, Ravi a/l Muthu.
  const PARTICLES = new Set(['ó', 'o', 'ní', 'nic', 'mac', 'mc', 'uí', 'de', 'di', 'da', 'du', 'del', 'della', 'van', 'von', 'der', 'den', 'le', 'la', 'st', 'st.',
    'bin', 'bint', 'binti', 'bte', 'bt', 'b.', 'a/l', 'a/p', 's/o', 'd/o', 'al', 'el', 'ibni']);
  const COMPANY_SUFFIX = /[\s,]+(sdn\.?\s*bhd\.?|berhad|bhd\.?|pte\.?\s*ltd\.?|private limited|plt|limited|ltd\.?|plc|dac|clg|uc|llp|lp|inc\.?|llc|unlimited company|designated activity company|company limited by guarantee)$/i;

  // Case-insensitive pattern for a label, e.g. ci('NRIC') -> [Nn][Rr][Ii][Cc].
  function ci(word) {
    return word.replace(/[A-Za-z]/g, (c) => `[${c.toUpperCase()}${c.toLowerCase()}]`).replace(/\./g, '\\.').replace(/ /g, '\\s+');
  }

  // Labels that are followed by an identifier: "IC No. ...", "Account No: ...".
  // Matched in any case.
  const ID_LABELS = [
    'identity card', 'identification', 'id card', 'nric', 'i/c', 'mykad', 'mykid', 'mypr', 'mykas', 'mytentera', 'kad pengenalan', 'k/p',
    'fin', 'passport', 'pasport', 'birth certificate', 'sijil lahir',
    'bank account', 'account', 'acct', 'a/c', 'akaun', 'card', 'credit card', 'debit card',
    'policy', 'polisi', 'claim', 'tuntutan', 'member', 'membership', 'ahli',
    'epf', 'kwsp', 'socso', 'perkeso', 'eis', 'cpf', 'medisave', 'hrdf',
    'income tax', 'tax', 'tax reference', 'tin', 'lhdn', 'iras', 'gst', 'sst',
    'licence', 'license', 'lesen', 'driving licence', 'permit', 'work permit', 'employment pass', 's pass', 'visa',
    'company', 'company registration', 'business registration', 'registration', 'ssm', 'uen', 'acra',
    'serial', 'invoice', 'receipt', 'resit', 'reference', 'our ref', 'your ref', 'ref',
    'suit', 'guaman', 'civil suit', 'originating claim', 'originating summons', 'summons', 'saman', 'writ', 'appeal', 'rayuan', 'case', 'kes', 'file', 'fail',
    'police report', 'report', 'repot polis', 'repot', 'ip', 'mrn', 'patient', 'pesakit', 'medical record', 'hospital',
    'staff', 'employee', 'pekerja', 'student', 'matric', 'pelajar',
    'chassis', 'engine', 'enjin', 'vin', 'imei', 'meter', 'tnb account', 'contract', 'kontrak', 'loan', 'pinjaman', 'facility',
    'title', 'geran', 'grant', 'hakmilik', 'lot', 'pn', 'hs(d)', 'hs(m)', 'strata', 'mukim',
  ];
  const LABEL_TAIL = String.raw`(?:\s*(?:[Nn][Oo]s?\.?|[Nn]umber|[Nn]ombor|[Bb]il\.?|#|[Cc]ode))?\s*(?:[:.]|is|ialah)?\s*`;
  const LABEL_RE = `(?<![\\p{L}\\p{N}])(?:${ID_LABELS.slice().sort((a, b) => b.length - a.length).map((l) => ci(l).replace(/[()]/g, '\\$&')).join('|')})${LABEL_TAIL}`;
  // The identifier itself: digit groups ("5141 2345 6789") or a code with at
  // least one digit ("WA-22NCvC-123-01/2024", "IG12345678090").
  const ID_VALUE = String.raw`(?:\d{2,}(?:[ -]\d{2,})+|(?=[A-Za-z0-9\/\-().]*\d)[A-Za-z0-9](?:[A-Za-z0-9\/\-().]*[A-Za-z0-9])?)`;

  const VEHICLE_LABELS = ['vehicle', 'registration', 'reg', 'car', 'motorcar', 'motor car', 'lorry', 'van', 'bus', 'taxi', 'motorcycle', 'motorbike', 'plate', 'kenderaan', 'no. plat', 'kereta', 'motosikal'];
  const VEHICLE_LABEL_RE = `(?<![\\p{L}\\p{N}])(?:${VEHICLE_LABELS.map(ci).join('|')})(?:\\s+(?:[Nn]o\\.?|[Nn]umber|[Mm]ark|[Pp]late))?\\s*[:.]?\\s*`;

  const CURRENCY_BEFORE = String.raw`(?<!(?:RM|S\$|US\$|\$|USD|SGD|MYR|EUR|GBP|£|€)\s?)`;

  // Malaysian MyKad: YYMMDD-PB-####. A bare 12-digit number only counts if
  // the first six digits are a real date and the next two a valid place code.
  function validMyKad(m) {
    const d = m.replace(/\D/g, '');
    if (d.length !== 12) return false;
    const mm = Number(d.slice(2, 4));
    const dd = Number(d.slice(4, 6));
    const pb = Number(d.slice(6, 8));
    return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && pb >= 1 && pb <= 99 && ![0, 17, 18, 19, 20, 69, 70, 73, 80, 81, 94, 95, 96, 97].includes(pb);
  }

  // Identifiers detected automatically, even if nobody typed them into the
  // parties list. Order matters: earlier patterns win on overlap.
  const DETECTORS = [
    { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    { type: 'URL', re: /\bhttps?:\/\/[^\s<>"')\]]+/g },

    // Court case numbers. Malaysia: WA-22NCvC-123-01/2024, W-02(NCVC)(W)-1234-07/2023.
    // Singapore: HC/OC 123/2024, DC/DC 1234/2023, HC/S 456/2019.
    { type: 'CASE_NO', re: /\b(?:[A-Z]{1,3}-)?[A-Z]?\d{1,2}[A-Za-z]{0,6}(?:\([A-Za-z]{1,6}\))*-\d{1,6}-\d{1,2}\/\d{4}\b/g },
    { type: 'CASE_NO', re: /\b(?:HC|DC|MC|CA|SIC|FC|FJC|SCT|ECT|CTA|HCF|DCN|SUM|ORC|AD|CA\/CA)\/[A-Z]{1,6}\s?\d{1,6}\/\d{4}\b/g },

    { type: 'CARD', re: /\b(?:\d{4}[ -]){3}\d{1,7}\b/g },

    // Malaysia MyKad / MyKid / MyPR (with separators).
    { type: 'MY_IC', re: /\b\d{6}[-\s]\d{2}[-\s]\d{4}\b/g },
    // Singapore NRIC / FIN (S, T, F, G, M series), including masked forms.
    { type: 'SG_NRIC', re: /\b[STFGM]\d{7}[A-Z]\b/g },
    { type: 'SG_NRIC', re: /\b[STFGM][X*•]{4,5}\d{3,4}[A-Z]\b/g },
    // Passports: Malaysia A/H/K + 8 digits; Singapore E/K/X + 7 digits + letter.
    { type: 'PASSPORT', re: /\b[AHK]\d{8}\b/g },
    { type: 'PASSPORT', re: /\b[EKX]\d{7}[A-Z]\b/g },

    // Malaysian company / business numbers: 202001012345 (new SSM),
    // 1234567-X (old), JM0123456-X (business), LLP0012345-LGN.
    { type: 'COMPANY_NO', re: /\b(?:19|20)\d{2}0[1-6]\d{6}\b/g },
    { type: 'COMPANY_NO', re: /\bLLP\d{7}-[A-Z]{3}\b/g },
    { type: 'COMPANY_NO', re: /\b[A-Z]{2,3}\d{7}-[A-Z]\b/g },
    { type: 'COMPANY_NO', re: /\b\d{5,7}-[A-Z]\b/g },
    // Singapore UEN: 201912345K (company), 53123456A (business), T08LL1234A (others).
    { type: 'UEN', re: /\b(?:19|20)\d{7}[A-Z]\b/g },
    { type: 'UEN', re: /\b\d{8,9}[A-Z]\b/g },
    { type: 'UEN', re: /\b[TSR]\d{2}[A-Z]{2}\d{4}[A-Z]\b/g },

    // Malaysian tax file numbers (IG12345678090, SG 1234567890, C 2584563202)
    // and SST registration (W10-1808-31000123).
    { type: 'TAX_NO', re: /\b(?:IG|SG|OG|C|CS|D|E|F|FA|PT|TA|TC|TN|TR|TP|J|LE)\s?\d{9,11}\b/g },
    { type: 'TAX_NO', re: /\b[A-Z]\d{2}-\d{4}-\d{8}\b/g },

    { type: 'MY_IC', re: /\b\d{12}\b/g, valid: validMyKad },
    // Old Malaysian IC / police / army numbers: A1234567, RF123456, T1234567.
    { type: 'MY_IC', re: /\b(?:RF|RFT|PF|[A-Z])\d{6,7}\b/g },

    // Vehicles. Singapore plates carry a check letter (SBA 1234 A); Malaysian
    // plates (WXY 1234) are only taken when labelled, as they look like
    // "ROC 2012".
    { type: 'VEHICLE', re: /\b[SEGFPWYQ][A-Z]{1,2}\s?\d{1,4}\s?[A-HJ-MPR-Z]\b/g },
    { type: 'VEHICLE', re: new RegExp(`(?<=${VEHICLE_LABEL_RE})[A-Z]{1,3}\\s?\\d{1,4}(?:\\s?[A-Z]{1,2})?\\b`, 'gu') },

    // Postcodes. Singapore: "Singapore 238823" / "S(238823)". Malaysia:
    // five digits followed by the town, as in "50450 Kuala Lumpur".
    { type: 'POSTCODE', re: /(?<=\b(?:Singapore|SINGAPORE|S)\s?\(?)\d{6}\b/g },
    { type: 'POSTCODE', re: new RegExp(`${CURRENCY_BEFORE}(?<![\\d.,])\\b\\d{5}(?=\\s+\\p{Lu}[\\p{L}]+(?:\\s+\\p{Lu}[\\p{L}]+){0,2}\\s*(?:,|\\.|\\n|$))`, 'gmu') },

    { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g },
    { type: 'PPSN', re: /\b\d{7}[A-W][A-IW]?\b/g },
    { type: 'NINO', re: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g },
    { type: 'EIRCODE', re: /\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/g },
    { type: 'POSTCODE', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b/g },

    // Anything else with a label in front of it: "IC No. ...", "Policy No: ...".
    { type: 'ID_NUMBER', re: new RegExp(`(?<=${LABEL_RE})${ID_VALUE}`, 'gu') },

    // Malaysia: 012-345 6789, 03-2123 4567, +60 3-2123 4567, 088-123 456.
    { type: 'PHONE', re: /(?<![\w/+])(?:\+?60[\s-]?|0)(?:1\d[\s-]?\d{3,4}[\s-]?\d{4}|[3-79][\s-]?\d{3,4}[\s-]?\d{4}|8\d[\s-]?\d{3}[\s-]?\d{3,4})(?![\w/])/g },
    // Singapore 8-digit numbers: 9123 4567, +65 6123 4567.
    { type: 'PHONE', re: /(?<![\w/+$])(?:\+65[\s-]?)?[3689]\d{3}[\s-]?\d{4}(?![\w/])/g },
    { type: 'PHONE', re: new RegExp(`${CURRENCY_BEFORE}(?<![\\w/+])(?:\\+\\d{1,3}[\\s-]?)?(?:\\(0\\)\\s?)?\\(?\\d{2,5}\\)?[\\s-]?\\d{3,4}[\\s-]?\\d{3,4}(?![\\w/])`, 'g'), minDigits: 7 },

    // Safety net: any long run of digits is some kind of account or ID number.
    { type: 'NUMBER', re: new RegExp(`${CURRENCY_BEFORE}(?<![\\d.,\\/])\\d{9,19}(?![\\d.,\\/])`, 'g') },
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
    for (;;) {
      const pair = words.slice(0, 2).join(' ').toLowerCase();
      if (words.length > 2 && TITLE_PAIRS.has(pair)) words.splice(0, 2);
      else if (words.length > 1 && TITLES.has(words[0].toLowerCase().replace(/\.$/, ''))) words.shift();
      else break;
    }
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

    addDetails(base, { address, email, phone, idNo } = {}) {
      if (norm(idNo)) this.register(`${base}.ID_NO`, idNo);
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
          if (d.minDigits && m.replace(/\D/g, '').length < d.minDigits) return m;
          if (d.valid && !d.valid(m)) return m;
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
    malaysia malaysian malaya singapore singaporean sabah sarawak labuan kuala lumpur putrajaya johor selangor penang pulau pinang
    perak kedah kelantan terengganu pahang negeri sembilan melaka malacca perlis
    sdn bhd berhad pte private plt llp sessions magistrates magistrate general division appellate tribunal
    mahkamah tinggi sesyen majistret rayuan persekutuan malaya plaintif defendan afidavit writ saman tuntutan pernyataan
    encik puan cik tuan datuk dato datin tan sri seri tengku tunku haji hajah madam mdm yang berhormat
    bin binti a/l a/p s/o d/o jalan lorong taman persiaran lebuh lebuhraya kampung kampong blk block avenue drive
    ringgit rm sgd myr dollars cents
    pdpa evidence contracts limitation companies civil law act ordinance enactment
    originating oc os aeic peninsular east west
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
    const titled = /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Sir|Dame|Garda|Sgt|Inspector|Judge|Encik|En|Puan|Pn|Cik|Tuan|Datuk|Dato'?|Datin|Tan Sri|Puan Sri|Tengku|Tunku|Haji|Hajah|Hj|Madam|Mdm|ASP|DSP|Insp|Cpl|Kpl|Sjn)\.?\s+((?:[A-Z][\p{L}'’-]+)(?:\s+[A-Z][\p{L}'’-]+)*)/gu;
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

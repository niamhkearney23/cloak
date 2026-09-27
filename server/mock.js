// Demo-mode drafter. Produces a simple skeleton from the cloaked brief, using
// the same tokens a real model would, so the uncloak step can be seen working
// without an API key. It is not a substitute for a real draft.

import { DOCUMENTS } from './prompts.js';

function field(brief, label) {
  const m = new RegExp(`^${label}:\\s*(.+)$`, 'mi').exec(brief);
  return m ? m[1].trim() : '';
}

function section(brief, heading) {
  const m = new RegExp(`^${heading}\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z ]+\\n|$)`, 'm').exec(brief);
  return m ? m[1].trim() : '';
}

function parties(brief, role) {
  const re = new RegExp(`^${role} \\d+: (\\{\\{[^}]+\\}\\})`, 'gmi');
  return [...brief.matchAll(re)].map((m) => m[1]);
}

function upper(token) {
  return token.replace(/\}\}$/, '|UPPER}}');
}

export function mockDraft({ docType, brief, instructions }) {
  const [pTerm = 'Plaintiff', dTerm = 'Defendant'] = field(brief, 'Party terminology').split('/').map((s) => s.trim());
  const ps = parties(brief, pTerm);
  const ds = parties(brief, dTerm);
  const court = field(brief, 'Court') || '[Court]';
  const record = field(brief, 'Record number') || '[Record No.]';
  const facts = section(brief, 'FACTS').split(/\n+/).filter(Boolean);
  const title = DOCUMENTS[docType].label.toUpperCase();

  const head = [
    `[DEMO MODE: this skeleton was produced without an AI model. Set ANTHROPIC_API_KEY for a real draft.]`,
    '',
    `>> ${court.toUpperCase()}`,
    `>> Record No. ${record}`,
    '',
    '>> BETWEEN',
    ...ps.map((p) => `>> ${upper(p)}`),
    `>> ${pTerm.toUpperCase()}${ps.length > 1 ? 'S' : ''}`,
    '>> AND',
    ...ds.map((d) => `>> ${upper(d)}`),
    `>> ${dTerm.toUpperCase()}${ds.length > 1 ? 'S' : ''}`,
    '',
    `>> ${title}`,
    '',
  ];

  const body = facts.map((f, i) => `${i + 1}. ${f}`);
  const extra = instructions ? ['', 'DOCUMENT INSTRUCTIONS', instructions] : [];
  return [...head, ...body, ...extra, '', 'Dated the [date]', '', '[Signature]'].join('\n');
}

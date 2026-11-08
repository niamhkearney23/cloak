// Quick desk. Everything that identifies anyone is cloaked here, in the
// browser; only the cloaked text is sent. The answer is uncloaked here too.
// The server refuses to call the AI while any word still looks like a name,
// and hands those words back for a person to decide.
(function () {
  'use strict';
  const { Cloak } = window.Cloak;
  const $ = (id) => document.getElementById(id);
  const ALLOW_KEY = 'cloak.desk.allow';
  const ME_KEY = 'cloak.desk.me';

  const JOBS = [
    ['reply', 'Write a reply'],
    ['summary', 'Summarise it'],
    ['todo', 'Make a to-do list'],
    ['letter', 'Turn into a formal letter'],
  ];

  // Words people have marked "It's fine" are remembered on this computer so
  // they are not asked about again. They are ordinary words, not names.
  let allow = [];
  try { allow = JSON.parse(localStorage.getItem(ALLOW_KEY) || '[]'); } catch { /* ignore */ }
  try { $('me').value = localStorage.getItem(ME_KEY) || ''; } catch { /* ignore */ }
  let hide = [];      // words marked "Hide it" for this item only
  let job = null;
  let busy = false;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const looksLikeCompany = (n) => /\b(sdn\.?\s*bhd|berhad|bhd|pte\.?\s*ltd|ltd|limited|llp|plt|inc|corp|holdings)\b/i.test(n);

  function buildCloak() {
    const c = new Cloak();
    const add = (prefix, name, extra) => (looksLikeCompany(name) ? c.addOrganisation : c.addPerson).call(c, prefix, name, extra);
    const me = $('me').value.trim();
    if (me) add('ME', me, { token: 'ME' });
    const from = $('from').value.trim();
    if (from) add('SENDER', from, { token: 'SENDER' });
    for (const n of $('extra').value.split('\n').map((x) => x.trim()).filter(Boolean)) add('PERSON', n);
    for (const w of hide) c.addLiteral('HIDDEN', w);
    return c;
  }

  function saveAllow() {
    try { localStorage.setItem(ALLOW_KEY, JSON.stringify(allow.slice(-500))); } catch { /* ignore */ }
  }

  function showTokens(text) {
    return esc(text).replace(/\{\{[^}]+\}\}/g, (m) => `<span class="tok">${m}</span>`);
  }

  function render(html) { $('out').innerHTML = html; }

  async function run(task) {
    if (busy) return;
    const text = $('text').value;
    if (!text.trim()) { $('text').focus(); return; }
    job = task;
    busy = true;
    try { localStorage.setItem(ME_KEY, $('me').value.trim()); } catch { /* ignore */ }
    const cloak = buildCloak();
    const cloaked = cloak.cloak(text);
    render('<div class="card working"><div class="spinner"></div><span>Hiding names, then asking the AI…</span></div>');
    try {
      const res = await fetch('/api/desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, text: cloaked, allow }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('You have been signed out. Copy your text, refresh the page and sign in again.');
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      if (data.unsure) return askAbout(data.unsure, cloaked);
      showResult(cloak, cloaked, data);
    } catch (err) {
      render(`<div class="alert warn">${esc(err.message)}</div>`);
    } finally {
      busy = false;
    }
  }

  // Nothing has been sent to the AI yet. Ask about each word, then carry on
  // by itself once every word is decided.
  function askAbout(words, cloaked) {
    const pending = new Set(words);
    render(`<div class="card">
      <h2 class="desk-h">Check ${words.length === 1 ? 'one word' : `${words.length} words`} first</h2>
      <p class="hint">Cloak isn't sure whether these are names. <b>Nothing has been sent to the AI.</b></p>
      <ul class="suspects">${words.map((w, i) => `<li class="decision" data-i="${i}"><code>${esc(w)}</code>
        <button type="button" class="button primary small" data-hide="${i}">Hide it</button>
        <button type="button" class="button ghost small" data-ok="${i}">It's fine</button></li>`).join('')}</ul>
      <details class="desk-more"><summary>What would be sent</summary><pre class="desk-pre">${showTokens(cloaked)}</pre></details>
    </div>`);
    const decide = (i, hideIt) => {
      const w = words[i];
      if (hideIt) hide.push(w); else { allow.push(w); saveAllow(); }
      pending.delete(w);
      $('out').querySelector(`[data-i="${i}"]`).remove();
      if (!pending.size) run(job);
    };
    $('out').querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', () => decide(+b.dataset.hide, true)));
    $('out').querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => decide(+b.dataset.ok, false)));
  }

  function showResult(cloak, cloaked, data) {
    const { text, unknown } = cloak.uncloak(data.text);
    const label = JOBS.find(([k]) => k === job)[1];
    render(`<div class="card">
      <div class="desk-result-head"><h2 class="desk-h">${esc(label)}</h2>
        <button type="button" class="button primary" id="copy">Copy</button></div>
      ${unknown.length ? `<div class="alert warn">The AI used ${unknown.length === 1 ? 'a code' : 'codes'} Cloak doesn't know (${esc(unknown.join(', '))}). Check those parts.</div>` : ''}
      ${data.truncated ? '<div class="alert warn">The answer was cut short. Try a shorter piece of text.</div>' : ''}
      <textarea id="answer" class="desk-answer" rows="14">${esc(text)}</textarea>
      <p class="hint">Check it before you use it. Fill in anything in [square brackets].</p>
      <details class="desk-more"><summary>What the AI saw</summary>
        <p class="hint">Sent:</p><pre class="desk-pre">${showTokens(cloaked)}</pre>
        <p class="hint">Came back:</p><pre class="desk-pre">${showTokens(data.text)}</pre></details>
    </div>`);
    hide = [];
    $('copy').addEventListener('click', (e) => {
      navigator.clipboard.writeText($('answer').value).then(() => {
        e.target.textContent = 'Copied';
        setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
      }, () => { $('answer').select(); });
    });
  }

  $('jobs').innerHTML = JOBS.map(([k, l]) => `<button type="button" class="button ${k === 'reply' ? 'primary' : 'secondary'}" data-job="${k}">${l}</button>`).join('');
  $('jobs').querySelectorAll('[data-job]').forEach((b) => b.addEventListener('click', () => { hide = []; run(b.dataset.job); }));
  // A new piece of text starts fresh: words hidden for the last one don't carry over.
  $('text').addEventListener('input', () => { hide = []; });

  fetch('/api/status').then((r) => r.json()).then((s) => {
    const el = $('mode');
    el.hidden = false;
    el.textContent = s.mode === 'live' ? 'Live' : 'Demo mode: no AI key set';
    el.className = 'mode ' + s.mode;
    if (s.assistant) $('assistant-link').hidden = false;
    if (s.user) {
      $('user-name').textContent = s.user;
      $('logout-form').hidden = false;
    }
  }).catch(() => {});

  // On a shared computer, signing out forgets this person's settings.
  $('logout-form').addEventListener('submit', () => {
    try { localStorage.removeItem(ALLOW_KEY); localStorage.removeItem(ME_KEY); } catch { /* ignore */ }
  });
})();

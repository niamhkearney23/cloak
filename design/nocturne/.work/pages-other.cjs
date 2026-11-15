// Home, setup, progress, recovery, double check, restore and the file viewer.
const { icon, mark, t, page, flow } = require('./lib.cjs');

const MATTER = 'Seri Kembara v Teratai Jaya';

// ------------------------------------------------------------------ home
const home = () => page({
  title: 'Home',
  body: `<div class="home">
  <div class="hero-mark">${mark('mark', 'hero')}</div>
  <h1>Cloak</h1>
  <p class="lede">Hide client details before a document goes to an AI tool. Put them back afterwards.</p>
  <div class="choices">
    <button class="choice primary" type="button" id="go-cloak">
      <span class="choice-ico">${icon('folderLock', 'lg')}</span>
      <span class="go" aria-hidden="true">${icon('arrowRight')}</span>
      <b>Cloak a folder</b>
      <span>Hide names and numbers in a folder of documents.</span>
    </button>
    <button class="choice" type="button" id="go-restore">
      <span class="choice-ico">${icon('restore', 'lg')}</span>
      <span class="go" aria-hidden="true">${icon('arrowRight')}</span>
      <b>Restore a draft</b>
      <span>Put the real details back into a draft, and check it.</span>
    </button>
  </div>
  <div class="try-sample">
    <div class="ts-copy"><span class="ts-ico">${icon('layers')}</span><span><b>New to Cloak?</b> Try it on a sample matter: ten made-up documents, ready in a few minutes.</span></div>
    <button class="btn" type="button" id="go-sample" data-go-sample>Try a sample matter</button>
  </div>
  <nav class="help-links" aria-label="Help and information">
    <button class="link" type="button" data-help="how">${icon('book')}Help</button>
    <button class="link" type="button" data-help="data">${icon('shield')}Your data</button>
    <button class="link" type="button" data-help="about">${icon('info')}About</button>
    <button class="link" type="button" id="go-licence">${icon('seal')}Licence</button>
  </nav>
  <p class="signed">Signed in as <b>Nurul Aina binti Kamal</b> · <button class="link quiet" type="button" id="change-name">Change name</button></p>
</div>`,
});

// ------------------------------------------------------------------ setup
const setup = () => page({
  title: 'Cloak a folder',
  matter: '',
  body: `<div class="setup-grid">
  <aside class="rail" aria-label="Steps">
    <p class="eyebrow">Cloak a folder</p>
    <ol>
      <li class="is-done"><a href="#s1"><span class="rn">1</span><span>The documents<span class="rs">20 files, in OneDrive</span></span></a></li>
      <li class="is-now"><a href="#s2" aria-current="step"><span class="rn">2</span><span>The matter<span class="rs">Create or open</span></span></a></li>
      <li><a href="#s3"><span class="rn">3</span><span>The people<span class="rs">Client, other parties</span></span></a></li>
    </ol>
    <div class="rail-note"><b>Nothing is saved or sent</b> until you finish the review and export.</div>
  </aside>
  <div class="setup-main">
    <div class="page-head single">
      <h1>Cloak a folder</h1>
      ${flow('Set up')}
      <p class="lede">Choose the documents, choose or create the matter that holds the encrypted key, and say who the parties are.</p>
    </div>

    <section class="card step-card is-done" id="s1" aria-labelledby="s1-t">
      <div class="step-head"><span class="step-no" aria-hidden="true">1</span><div><h2 id="s1-t">The documents</h2><p>The folder is only read. Nothing in it is changed.</p></div><span class="chip cloaked">20 files found</span></div>
      <div class="step-body">
        <div class="picker"><div class="path" id="folder-path">${icon('folder')}<span>C:\\Users\\nurul.aina\\OneDrive - Cempaka Wong &amp; Partners\\Matters\\SK-2026-014 Seri Kembara\\<b>Documents</b></span></div><button class="btn" type="button" id="pick-folder">Choose folder…</button></div>
        <div class="msg info" id="source-note"><div><b>This folder is in OneDrive.</b> Cloak only reads it. It will never create, rename, move or change anything there, and nothing of the matter (key, cache or cloaked copies) will be saved there.<div class="small">Recognised from: the OneDrive folder path.</div></div></div>
        <div class="field"><label for="manual-src">Where is this folder?</label><select id="manual-src"><option value="">Work it out automatically</option><option value="imanage">It is on iManage Drive</option><option value="onedrive">It is in OneDrive</option><option value="googledrive">It is in Google Drive</option></select><span class="hint">Choose one if Cloak did not recognise the folder as synced.</span></div>
      </div>
    </section>

    <section class="card step-card is-now" id="s2" aria-labelledby="s2-t">
      <div class="step-head"><span class="step-no" aria-hidden="true">2</span><div><h2 id="s2-t">The matter</h2><p>Each matter has its own folder holding its encrypted key. Keep it on the firm’s shared drive, not inside the documents folder.</p></div></div>
      <div class="step-body">
        <div class="picker"><div class="path" id="matter-path">${icon('folderLock')}<span>\\\\fileserver\\matters\\<b>SK-2026-014 Seri Kembara</b></span></div><button class="btn" type="button" id="pick-matter">Choose matter folder…</button></div>
        <p class="sub-label">This folder has no matter yet. Create one:</p>
        <div class="field"><label for="m-name">Matter name <span class="opt">(optional)</span></label><input type="text" id="m-name" value="${MATTER}" autocomplete="off"></div>
        <div class="field"><span class="label" id="lvl">How much to hide</span>
          <div class="choice-cards" role="radiogroup" aria-labelledby="lvl">
            <label class="choice-card"><input type="radio" name="level" value="strict" checked><span><span class="cc-title">Strict <span class="badge">Recommended</span></span><span class="cc-text">Names, numbers and distinctive facts: dates, amounts, reference numbers, places, project names, job titles and court names.</span></span></label>
            <label class="choice-card"><input type="radio" name="level" value="standard"><span><span class="cc-title">Standard</span><span class="cc-text">Names and numbers only. Dates, amounts and legal provisions are kept unless you tick them.</span></span></label>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label for="m-pw">Matter password</label><input type="password" id="m-pw" value="kembara-roof-2026" autocomplete="new-password"><span class="pw-rule">10 characters or more</span></div>
          <div class="field"><label for="m-pw2">Type the password again</label><input type="password" id="m-pw2" value="kembara-roof-2026" autocomplete="new-password"><span class="pw-rule">The two passwords match</span></div>
        </div>
        <div class="row create-row"><button class="btn primary" type="button" id="m-create">${icon('key')}Create matter</button><span class="hint">The recovery code comes next. It is shown once.</span></div>
        <p class="hint or-open">Choosing a folder that already holds a matter asks for its password instead, or its recovery code, or opens it with the password remembered on this computer.</p>
      </div>
    </section>

    <section class="card step-card" id="s3" aria-labelledby="s3-t">
      <div class="step-head"><span class="step-no" aria-hidden="true">3</span><div><h2 id="s3-t">The people in this matter</h2><p>Every form typed here is hidden everywhere, file and folder names included.</p></div></div>
      <div class="step-body">
        <div class="field"><label for="client-name">Who is the client?</label><textarea id="client-name" rows="2" autocomplete="off">Seri Kembara Logistics Sdn Bhd; Seri Kembara; Kembara</textarea><span class="hint">Every way it is written, separated by <b>;</b> (for example: Seri Kembara Logistics Sdn Bhd; Seri Kembara; Kembara).</span></div>
        <div class="field"><label for="other-parties">Who are the other parties?</label><textarea id="other-parties" rows="4" autocomplete="off">Teratai Jaya Properties Berhad; Teratai Jaya
person: Lim Wei Jie; Wei Jie
person: Nurul Huda binti Rahman
company: Bayu Perdana Freight Sdn Bhd; Bayu Freight</textarea><span class="hint">One party per line. Forms of the same party are separated by <b>;</b>. Start a line with <b>person:</b> or <b>company:</b> if Cloak should treat it as one or the other.</span></div>
        <label class="check"><input type="checkbox" id="test-matter"><span class="check-text"><b>This matter holds made-up test documents only</b><span class="hint">Tick it only if every document in the folder is made up. Cloak cannot tell real documents from made-up ones.</span></span></label>
      </div>
    </section>

    <div class="finish" role="region" aria-label="Start">
      <div class="finish-status"><span class="lamp" aria-hidden="true"></span><div><b>Create or open the matter to start.</b> Nothing is saved or sent until you finish the review and export.</div></div>
      <div class="row"><button class="btn ghost" type="button" id="back">Back</button><button class="btn primary" type="button" id="start" disabled>Start cloaking</button></div>
    </div>
  </div>
</div>`,
});

// ------------------------------------------------------------------ progress
const files = [
  ['01 Statement of Claim (sealed).pdf', 0, 'done'],
  ['02 Perjanjian Sewa Gudang 2023.docx', 0, 'done'],
  ['03 Surat Tuntutan - Teratai Jaya.pdf', 1, 'done'],
  ['04 WhatsApp export - Lim Wei Jie.txt', 0, 'done'],
  ['05 Invoices Q3 2024.xlsx', 0, 'done'],
  ['06 合同补充协议 2024.pdf', 1, 'done'],
  ['07 சாட்சி அறிக்கை - ராஜேஷ்.docx', 0, 'done'],
  ['08 Board minutes 14.11.2024.docx', 0, 'done'],
  ['09 Emel daripada pengurus gudang.eml', 0, 'done'],
  ['09 Emel daripada pengurus gudang.eml › Gambar bumbung bocor.jpg', 1, 'done'],
  ['10 Site photos (scanned).pdf', 1, 'done'],
  ['11 Affidavit in Support - Nurul Huda binti Rahman.pdf', 0, 'done'],
  ['12 Penyata akaun Bank Seroja Mac 2024.pdf', 1, 'reading'],
  ['13 Lampiran C - Senarai stok rosak.xlsx', 0, 'reading'],
];
const progress = () => page({
  title: 'Cloaking',
  matter: MATTER,
  mainAttrs: ' tabindex="0" aria-label="Cloaking progress"',
  body: `<div class="wide">
  <div class="page-head">
    <h1>Cloaking<em>…</em></h1>
    ${flow('Read')}
    <p class="lede">Reading every part of every file on this computer. Scanned pages and pictures go through OCR, which takes longer.</p>
  </div>
  <section class="card progress-card">
    <div class="progress-head">
      <div class="progress-big" id="progress-count" aria-live="polite">12<small>of 20 files read</small></div>
      <span class="xs faint">Nothing is written anywhere until the review is finished.</span>
    </div>
    <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="20" aria-valuenow="12" aria-label="Files read"><span></span></div>
    <table class="progress-table">
      <thead><tr><th class="num">#</th><th>File</th><th>OCR</th><th>Progress</th></tr></thead>
      <tbody id="progress">
      ${files.map(([f, ocr, st], i) => `<tr${st === 'reading' ? ' class="is-reading"' : ''}><td class="num faint">${i + 1}</td><td><span class="file-name">${f}</span></td><td>${ocr ? '<span class="chip ocr">OCR</span>' : ''}</td><td>${st === 'reading' ? '<span class="stage"><span class="spinner" aria-hidden="true"></span>Reading…</span>' : '<span class="stage done">Done</span>'}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>
</div>`,
});

// ------------------------------------------------------------------ recovery code
const recovery = () => page({
  title: 'Recovery code',
  matter: MATTER,
  body: `<div class="narrow">
  <div class="page-head single">
    <h1>Write down the recovery code</h1>
    ${flow('Set up')}
    <p class="lede">This code opens the matter if the password is forgotten. <b>It is shown only once.</b> Print it or write it down, and keep it on the paper file or in the safe.</p>
  </div>
  <section class="card cert">
    <dl class="cert-meta"><dt>Matter</dt><dd>${MATTER}</dd><dt>Created</dt><dd>15 Nov 2026, 3:08 pm by Nurul Aina binti Kamal</dd></dl>
    <div class="code" id="recovery-code">7KQ4-M2XD-9PFA-W3HT-6RNC</div>
    <div class="msg warn"><div>If both the password and this code are lost, the key cannot be opened by anyone. <b>There is no back door.</b></div></div>
    <p class="print-only small">Do not keep this sheet with the cloaked copies or in the matter folder on the computer.</p>
    <div class="cert-foot no-print">
      <label class="check"><input type="checkbox" id="wrote"><span class="check-text">I have written the recovery code down</span></label>
      <div class="row"><button class="btn" type="button" id="print">${icon('print')}Print this page</button><button class="btn primary" type="button" id="continue" disabled>Continue</button></div>
    </div>
  </section>
</div>`,
});

// ------------------------------------------------------------------ double check
const fileList = [
  ['03 Surat Tuntutan - Teratai Jaya', 'fail', '1 to decide'],
  ['05 Invoices Q3 2024', 'fail', '1 to decide'],
  ['09 Emel daripada pengurus gudang', 'fail', '1 to decide'],
  ['Context sheet', 'pass', '1 marked fine'],
  ['01 Statement of Claim (sealed)', 'pass', ''],
  ['02 Perjanjian Sewa Gudang 2023', 'pass', ''],
  ['04 WhatsApp export - Lim Wei Jie', 'pass', '1 marked fine'],
  ['06 合同补充协议 2024', 'pass', ''],
  ['08 Board minutes 14.11.2024', 'pass', ''],
  ['11 Affidavit in Support', 'pass', ''],
  ['Chronology', 'pass', ''],
];
const doublecheck = () => page({
  title: 'Double check',
  matter: MATTER,
  body: `<div class="wide">
  <div class="page-head">
    <h1>Double check</h1>
    ${flow('Double check')}
    <p class="lede optional">A second, separate reading of everything about to be exported. Five checks run afresh: key sweep, patterns, leftover names, hidden places and tags.</p>
    <p class="meta"><span class="meta-item">${icon('clock')}<span>Checked <b>15 Nov 2026, 3:36 pm</b></span></span><span class="meta-item">${icon('shield')}<span>Nothing the first pass found is reused</span></span></p>
    <div class="head-side"><span class="chip fail">3 files fail</span><span class="chip cloaked">19 pass</span></div>
  </div>

  <div class="dc-grid">
    <aside class="dc-files card flush" aria-label="Files">
      <div class="dc-files-head"><span>Files</span><span class="faint tnum">22</span></div>
      <div class="dc-meter"><div class="meter"><span class="m-pass"></span></div><span class="xs faint">19 of 22 pass: 20 cloaked copies, the context sheet and the chronology</span></div>
      <ul class="dc-file-list">
        ${fileList.map(([n, st, note], i) => `<li class="${st}${i === 0 ? ' current' : ''}"><span class="chip ${st}"><span class="sr-only">${st === 'pass' ? 'Pass' : 'Fail'}</span></span><span class="dfl-name"><span class="file-name">${n}</span>${note ? `<span class="dfl-note">${note}</span>` : ''}</span></li>`).join('')}
        <li class="more-files"><button class="link quiet" type="button">Show 11 more that pass</button></li>
      </ul>
    </aside>

    <section class="dc-findings" aria-label="Findings">
      <div class="section-label"><span>To decide · 3 places</span><span class="faint">Hide it applies everywhere it is found. It is fine is recorded for each place.</span></div>

      <article class="fgroup">
        <header class="fg-head">
          <div class="fg-what">
            <div class="fg-value">Halim</div>
            <div class="fg-why"><span class="chip quiet">Leftover names</span><span>Possible name: a word from the name lists.</span></div>
          </div>
          <div class="fg-actions"><button class="btn small tonal" type="button">${icon('eyeOff')}Hide it<span class="as">as a person</span></button><button class="btn small" type="button">${icon('check')}It is fine</button></div>
        </header>
        <ol class="places">
          <li class="place"><div class="pl-where"><span class="file-name">03 Surat Tuntutan - Teratai Jaya</span><span class="loc">Body</span><span class="loc">line 14</span></div><div class="pl-excerpt">…sila jelaskan baki tunggakan kepada <mark class="leak">Halim</mark> sebelum ${t('{{DATE_7}}')} atau tindakan undang-undang akan diambil…</div></li>
          <li class="place"><div class="pl-where"><span class="file-name">09 Emel daripada pengurus gudang</span><span class="loc">Email headers</span><span class="loc">line 3</span></div><div class="pl-excerpt">Cc: <mark class="leak">Halim</mark> &lt;${t('{{EMAIL_2}}')}&gt;</div></li>
        </ol>
      </article>

      <article class="fgroup">
        <header class="fg-head">
          <div class="fg-what">
            <div class="fg-value tnum">RM 4,317,250</div>
            <div class="fg-why"><span class="chip quiet">Key sweep</span><span>The same amount as ${t('{{AMOUNT_2}}')}, written another way.</span></div>
          </div>
          <div class="fg-actions"><button class="btn small tonal" type="button">${icon('eyeOff')}Hide it</button><button class="btn small" type="button">${icon('check')}It is fine</button></div>
        </header>
        <ol class="places">
          <li class="place"><div class="pl-where"><span class="file-name">05 Invoices Q3 2024</span><span class="loc">Sheet “Summary”, cell comment</span><span class="loc">line 41</span></div><div class="pl-excerpt">Note by ${t('{{PERSON_1.FIRST}}')}: total claimed is <mark class="leak">RM 4,317,250</mark>, check against ${t('{{REF_9}}')}</div></li>
        </ol>
      </article>

      <div class="section-label"><span>Decided · 2 places</span></div>

      <article class="fgroup is-decided">
        <header class="fg-head">
          <div class="fg-what">
            <div class="fg-value">Tenancy Agreement</div>
            <div class="fg-why"><span class="chip quiet">Leftover names</span><span>Capitalised words that may be a name. No one has marked them as fine.</span></div>
          </div>
          <div class="decision"><span class="chip ok">Marked fine</span><span>by <b>Nurul Aina binti Kamal</b></span><span class="tnum">15 Nov 2026, 3:41 pm</span><button class="link quiet" type="button">Undo</button></div>
        </header>
        <ol class="places">
          <li class="place"><div class="pl-where"><span class="file-name">Context sheet</span><span class="loc">Cast list</span><span class="loc">line 9</span></div><div class="pl-excerpt">${t('{{COMPANY_2}}')}: the Defendant, landlord under the <mark class="decided">Tenancy Agreement</mark> with ${t('{{COMPANY_1}}')}.</div></li>
        </ol>
        <p class="fg-note">${icon('info', 'sm')}Cloak writes the context sheet from tags and numbers, so this can only be marked as fine.</p>
      </article>

      <article class="fgroup is-decided">
        <header class="fg-head">
          <div class="fg-what">
            <div class="fg-value">Kak Yati</div>
            <div class="fg-why"><span class="chip quiet">Leftover names</span><span>Possible name: it follows a title (Encik, Puan, Mr, Dato’…).</span></div>
          </div>
          <div class="decision"><span class="chip ok">Hidden as ${t('{{PERSON_9}}')}</span><span>by <b>Nurul Aina binti Kamal</b></span><span class="tnum">15 Nov 2026, 3:39 pm</span></div>
        </header>
      </article>
    </section>
  </div>

  <div class="finish" role="region" aria-label="Export">
    <div class="finish-status"><span class="lamp" aria-hidden="true"></span><div><b>3 places still to decide.</b> Export unlocks when every file passes, or every finding is decided.</div></div>
    <div class="row"><button class="btn" type="button" id="export" disabled>Export all files…</button><button class="btn primary" type="button" id="export-chrono" disabled>${icon('lock')}Export the chronology only (recommended)</button></div>
  </div>
</div>`,
});

// ------------------------------------------------------------------ restore
const draftText = `1. I, {{PERSON_2}} (NRIC No. {{NRIC_4}}), a director of {{COMPANY_1}}, the Plaintiff, affirm and say as follows.

3. By a tenancy agreement dated {{DATE_1.B}}, {{COMPANY_2}}, the Defendant, let to the Plaintiff the warehouse at {{ADDRESS_1}} for three years.

4. The Defendant agreed to repair the roof within 14 days of {{DATE_1.B}}, that is, by {{DATE_2}}. It did not do so.`;

const para = (n, html, issue) => `<p${issue ? ' class="has-issue"' : ''}><span class="pn">${n}</span><span>${html}</span><span class="flag"${issue ? ` title="${issue}"` : ' aria-hidden="true"'}>${issue ? `<span class="sr-only">${issue}</span>` : ''}</span></p>`;
const pb = (s) => `<span class="put-back">${s}</span>`;
const restore = () => page({
  title: 'Restore a draft',
  matter: MATTER,
  body: `<div class="wide">
  <div class="page-head">
    <p class="eyebrow">${icon('key', 'sm')}Matter open · ${MATTER}</p>
    <h1>Restore a draft</h1>
    <div class="head-side top"><button class="btn ghost" type="button" id="restore-back">${icon('check')}Done</button></div>
    <p class="lede optional">Put the real details back into a draft that has tags in it. This runs on this computer only.</p>
  </div>
  <div class="restore-grid">
    <section class="card draft-box" aria-labelledby="draft-t">
      <h2 id="draft-t">The draft</h2>
      <p class="hint draft-hint">Paste the draft the AI wrote, with its tags, or choose a file (.txt, .md or .docx).</p>
      <div class="field"><textarea id="draft" rows="9" aria-labelledby="draft-t" spellcheck="false">${draftText}</textarea></div>
      <div class="row draft-row"><button class="btn small" type="button" id="pick-draft">${icon('file')}Choose a file…</button><span class="xs faint tnum">11 paragraphs · 212 tags</span></div>
      <div class="divider"></div>
      <div class="field"><span class="label">The documents folder <span class="opt">(optional)</span></span>
        <div class="path" id="docs-path">${icon('folder')}<span>…\\SK-2026-014 Seri Kembara\\<b>Documents</b></span></div>
        <span class="hint">Lets Cloak check the draft against the documents. Without it, that check is skipped.</span>
        <div><button class="btn small" type="button" id="pick-docs">Choose the documents folder…</button></div>
      </div>
      <div class="row"><button class="btn" type="button" id="do-restore">${icon('restore')}Check and restore again</button></div>
    </section>

    <section class="card result" id="restore-report" aria-labelledby="verdict-t">
      <div class="result-head">
        <div class="verdict"><span class="verdict-ico">${icon('alert', 'lg')}</span><div><div class="verdict-t" id="verdict-t">Warnings</div><div class="verdict-s">Restored. Read the 3 issues below before you use the draft.</div></div></div>
        <span class="xs faint tnum">Checked 15 Nov 2026, 3:52 pm</span>
      </div>
      <div class="counts">
        <div class="count"><div class="cn">212</div><div class="cl">tags put back<br>64 different tags</div></div>
        <div class="count"><div class="cn">3</div><div class="cl">tags in the key are not in the draft</div><div class="tags-line">${t('{{PERSON_7}}{{DATE_12}}{{AMOUNT_9}}')}</div></div>
        <div class="count"><div class="cn">0</div><div class="cl">tag-like text that is not in the key</div></div>
      </div>
      <ol class="checks">
        <li class="check-row"><div class="check-row-head"><span class="t"><span class="k">1</span>Restore check</span><span class="chip pass">Passed</span></div><p class="note">No tag left over, none made up or damaged, no real value written in. 4 forms put back in the language of their sentence.</p></li>
        <li class="check-row"><div class="check-row-head"><span class="t"><span class="k">2</span>Source check</span><span class="chip warn">Warnings</span></div>
          <ul class="issues"><li><span class="para">Paragraph 6</span><span>RM 48,500.00 is not found in the documents.</span></li><li><span class="para">Paragraph 10</span><span>“Taman Seri Kenanga” is not found in the documents.</span></li></ul></li>
        <li class="check-row"><div class="check-row-head"><span class="t"><span class="k">3</span>Arithmetic and timeline</span><span class="chip warn">Warnings</span></div>
          <ul class="issues"><li><span class="para">Paragraph 4</span><span>14 days after 3 March 2023 is 17 March 2023, not 21 March 2023.</span></li></ul></li>
      </ol>
    </section>
  </div>

  <section class="card restored" aria-labelledby="restored-t">
    <div class="card-head">
      <div><h2 id="restored-t">The restored draft</h2><p>The real details are back. It is not encrypted: keep it with the matter’s other documents.</p></div>
      <div class="row"><button class="btn primary" type="button" id="copy-restored">${icon('copy')}Copy</button><button class="btn" type="button" id="save-restored">${icon('save')}Save as…</button></div>
    </div>
    <div class="legend"><span><span class="sw put"></span>Put back from the key</span><span><span class="sw iss"></span>A check has a question about this paragraph</span></div>
    <div class="reader" id="restored-text">
      ${para(1, `I, ${pb('Nurul Huda binti Rahman')} (NRIC No. ${pb('760101-14-5501')}), a director of ${pb('Seri Kembara Logistics Sdn Bhd')}, the Plaintiff, affirm and say as follows.`)}
      ${para(2, 'I am authorised to make this affidavit on behalf of the Plaintiff. The facts below are within my own knowledge, or come from the Plaintiff’s records, which I believe to be true.')}
      ${para(3, `By a tenancy agreement dated ${pb('3 March 2023')}, ${pb('Teratai Jaya Properties Berhad')}, the Defendant, let to the Plaintiff the warehouse at ${pb('Lot 12, Jalan Perusahaan 3, Kawasan Perindustrian Bukit Raja')} for three years.`)}
      ${para(4, `The Defendant agreed to repair the roof within 14 days of ${pb('3 March 2023')}, that is, by ${pb('21 March 2023')}. It did not do so.`, 'Arithmetic and timeline: 14 days after 3 March 2023 is 17 March 2023')}
      ${para(5, `On ${pb('15 April 2023')} the Plaintiff paid the Defendant a security deposit of ${pb('RM 250,000.00')} by cheque.`)}
      ${para(6, `On ${pb('5 June 2024')} water entered the warehouse during heavy rain and damaged stock worth RM 48,500.00.`, 'Source check: RM 48,500.00 is not found in the documents')}
      ${para(7, `The Plaintiff’s operations manager, ${pb('Lim Wei Jie')}, reported the damage to the Defendant the same day by WhatsApp message.`)}
      ${para(8, 'Between January and March 2024 the Plaintiff withheld rent pending the repairs, as clause 7.2 of the tenancy allows.')}
      ${para(9, `On ${pb('14 November 2024')} the Plaintiff’s board resolved to end the tenancy and to claim ${pb('RM 4,317,250.00')} for loss of stock and business.`)}
      ${para(10, `The Plaintiff moved its remaining stock to a temporary store in Taman Seri Kenanga on ${pb('2 December 2024')}.`, 'Source check: “Taman Seri Kenanga” is not found in the documents')}
      ${para(11, 'I affirm this affidavit in support of the Plaintiff’s claim.')}
    </div>
  </section>
</div>`,
});

// ------------------------------------------------------------------ file viewer (manual check, typed APPROVE)
const viewerText = `[Chat exported ${'{{DATE_15}}'}]
${'{{DATE_16}}'}, 9:14 am - ${'{{PERSON_1}}'}: Roof leaking again at bay 3. Stock on pallets 14-20 wet.
${'{{DATE_16}}'}, 9:20 am - ${'{{PERSON_6.FIRST}}'}: Noted. Contractor can only come next week.
${'{{DATE_16}}'}, 9:22 am - ${'{{PERSON_1}}'}: 老板说这批货全部报废，要拍照存档。
${'{{DATE_16}}'}, 9:31 am - ${'{{PERSON_6.FIRST}}'}: OK. Send photos to ${'{{EMAIL_2}}'} and copy ${'{{PERSON_2.FIRST}}'}.`;
const viewer = () => {
  const { page: pg } = require('./lib.cjs');
  const rows = [
    [3, '03 Surat Tuntutan - Teratai Jaya.pdf', '<span class="chip cloaked">Cloaked</span>', '4 of 4 pages<br>9,812 characters<br><span class="chip ocr">OCR</span> page 4', '<button class="btn small" type="button">View cloaked text</button>'],
    [4, '04 WhatsApp export - Lim Wei Jie.txt', '<span class="chip manual">Needs manual check</span><div class="reason">14 non-Latin characters showing</div>', '1 of 1 text<br>2,406 characters', '<button class="btn small primary" type="button">Check this file…</button>'],
    [7, '07 சாட்சி அறிக்கை - ராஜேஷ்.docx', '<span class="chip manual">Needs manual check</span><div class="reason">A page in a non-Latin script</div>', '6 of 6 parts<br>12,240 characters', '<button class="btn small" type="button">Check this file…</button>'],
    [10, '10 Site photos (scanned).pdf', '<span class="chip partial">Partly read – blocked</span><div class="reason">Page 7: OCR came out uncertain</div>', '11 of 12 pages<br><span class="chip ocr">OCR</span> pages 1–12', ''],
  ];
  const { icon: ic } = require('./lib.cjs');
  return pg({
    title: 'Check this file',
    matter: MATTER,
    body: `<div class="wide" aria-hidden="true">
  <div class="page-head"><h1>Review</h1>${flow('Review')}<p class="lede optional">20 files read in 48.2 seconds. Nothing has been exported. Check the lists below, then finish the review.</p><p class="meta"><span class="meta-item">${icon('cloud')}<span>Source: <b>OneDrive</b>, read only</span></span></p><div class="head-side"><span class="chip cloaked">18 files ready</span><span class="chip manual">2 held back</span></div></div>
  <div class="tabs" role="tablist"><button class="tab done" role="tab" aria-selected="false">Not sure<span class="n"></span></button><button class="tab done" role="tab" aria-selected="false">Joined names<span class="n"></span></button><button class="tab" role="tab" aria-selected="false">Everything replaced<span class="n">1,284</span></button><button class="tab" role="tab" aria-selected="false">Hidden facts<span class="n">312</span></button><button class="tab" role="tab" aria-selected="false">Chronology<span class="n">86</span></button><button class="tab" role="tab" aria-selected="true">Files<span class="n">20</span></button></div>
  <section class="panel"><div class="card flush"><table><thead><tr><th class="num">#</th><th>File</th><th>Result</th><th>Read</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td class="num faint">${r[0]}</td><td><span class="file-name">${r[1]}</span></td><td>${r[2]}</td><td class="small muted">${r[3]}</td><td class="tight">${r[4]}</td></tr>`).join('')}</tbody></table></div></section>
</div>`,
    extra: `<div class="overlay">
  <div class="dialog viewer" role="dialog" aria-modal="true" aria-labelledby="v-title">
    <div class="viewer-head"><div><p class="eyebrow">${ic('file', 'sm')}Manual check · file 4 of 20</p><h2 id="v-title"><span class="file-name">04 WhatsApp export - Lim Wei Jie.txt</span></h2></div><button class="btn ghost icon-only" type="button" aria-label="Close">${ic('x')}</button></div>
    <p class="small">This is the cloaked text as it would be exported. Read it against the original. If a name is still showing, close this, add it in the box at the top, and come back.</p>
    <pre class="filetext">${t(viewerText.replace('老板说这批货全部报废，要拍照存档。', '<mark class="hit">老板说这批货全部报废，要拍照存档。</mark>'))}</pre>
    <div class="msg warn"><div><b>14 characters of non-Latin text (Chinese, Tamil or similar) are still showing.</b> Cloak cannot check names in those scripts. The safe choice is to hide every passage: each becomes one tag and is put back when you restore a draft.</div></div>
    <div class="row viewer-actions"><button class="btn primary" type="button" id="hide-nl">${ic('eyeOff')}Hide all non-Latin text in this file</button><button class="btn" type="button" id="close">Close</button></div>
    <details class="more" open><summary>Approve it with the non-Latin text showing</summary>
      <p class="small">The text will go out as written. Only do this if you have read it and it identifies no one. Type <b>APPROVE</b> to confirm.</p>
      <div class="typed-row"><input type="text" id="typed" autocomplete="off" placeholder="APPROVE" aria-label="Type APPROVE to confirm" value="APPR"><button class="btn" type="button" id="approve" disabled>Approve this file</button><span class="xs faint">Your name and the time are recorded.</span></div>
    </details>
  </div>
</div>`,
  });
};

module.exports = { home, setup, progress, recovery, doublecheck, restore, viewer };

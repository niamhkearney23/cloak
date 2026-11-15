const fs = require('fs'); const path = require('path');
const { mark } = require('./lib.cjs');
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../style.css"></head><body class="spec">
<main><div class="spec-row">${[20, 28, 48, 72, 160].map((s) => `<span class="spec-cell s${s}">${mark('mark', String(s))}</span>`).join('')}<span class="wordmark spec-wm">Cloak</span></div>
<p class="spec-p">Tags: <span class="tag"><span class="b">{{</span>PERSON_1<span class="b">}}</span></span> <span class="tag"><span class="b">{{</span>DATE_3<span class="f">.B</span><span class="b">}}</span></span> <span class="tag"><span class="b">{{</span>AMOUNT_2<span class="b">}}</span></span> <span class="tag"><span class="b">{{</span>COMPANY_12<span class="f">.SHORT</span><span class="b">}}</span></span></p></main></body></html>`;
fs.writeFileSync(path.join(__dirname, 'markspec.html'), html);

'use strict';
(() => {
  const { words, makeNumber, esc, num, money, norm, today, frDate, qtyTxt } = window.Lib;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DEFAULT_HEADER = "GMC SARL (General Medico Consumable)\nCommerce général : Import-export - Représentation commerciale - Prestation de services & Distribution des consommables médicaux\nCel : 92 51 57 36 - 99 93 79 89 / Lomé - Adetikopé";
  // anciens en-têtes par défaut, remplacés automatiquement s'ils n'ont pas été personnalisés
  const LEGACY_HEADERS = ["Commerce général : Import-export - Représentation commerciale  - Prestation de services & Distribution des consommables médicaux\n Cel : 92 51 57 36 - 99 93 79 89 / LOME - DAVIE", "Commerce général : Import-export - Représentation commerciale  - Prestation de services & Distribution des consommables médicaux\n Cel : 92 51 57 36 - 99 93 79 89 / LOME - DAVIE"];
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------------- Stockage local (IndexedDB) ---------------- */
  const DB = {
    db: null,
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('facturation', 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          ['products', 'clients', 'invoices'].forEach((s) => d.createObjectStore(s, { keyPath: 'id' }));
          d.createObjectStore('kv');
        };
        r.onsuccess = () => { DB.db = r.result; res(); };
        r.onerror = () => rej(r.error);
      });
    },
    run(store, mode, fn) {
      return new Promise((res, rej) => {
        const t = DB.db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req ? req.result : undefined);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    },
    all: (s) => DB.run(s, 'readonly', (o) => o.getAll()),
    put: (s, v) => DB.run(s, 'readwrite', (o) => o.put(v)),
    del: (s, id) => DB.run(s, 'readwrite', (o) => o.delete(id)),
    clear: (s) => DB.run(s, 'readwrite', (o) => o.clear()),
    putMany: (s, arr) => DB.run(s, 'readwrite', (o) => { arr.forEach((v) => o.put(v)); }),
    kvGet: (k) => DB.run('kv', 'readonly', (o) => o.get(k)),
    kvDel: (k) => DB.run('kv', 'readwrite', (o) => o.delete(k)),
    kvSet: (k, v) => DB.run('kv', 'readwrite', (o) => o.put(v, k)),
  };

  /* ---------------- État ---------------- */
  const S = { products: [], clients: [], invoices: [], settings: null, draft: null, pmap: new Map(), ui: {} };
  const blankLine = () => ({ name: '', qty: '', price: '', auto: false, cost: '', costAuto: true });
  const blankDraft = () => ({ type: 'FACTURE', date: today(), client: '', lines: [blankLine(), blankLine(), blankLine()], editingId: null });
  const saveDraft = debounce(() => DB.kvSet('draft', S.draft), 300);
  // sauvegarde immédiate du brouillon quand la page se ferme ou passe en arrière-plan
  const flushDraft = () => { if (S.draft && DB.db) DB.kvSet('draft', S.draft); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDraft(); });
  window.addEventListener('pagehide', flushDraft);
  const findProduct = (name) => S.pmap.get(norm(name));
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

  function refreshLists() {
    S.products.sort(byName);
    S.clients.sort(byName);
    S.pmap = new Map(S.products.map((p) => [norm(p.name), p]));
    $('#products-dl').innerHTML = S.products.map((p) => `<option value="${esc(p.name)}"></option>`).join('');
    $('#clients-dl').innerHTML = S.clients.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
  }

  async function seed() {
    const d = window.__SEED || await (await fetch('seed.json')).json();
    S.products = d.products.map((p, i) => ({ id: 'p' + (i + 1), name: p.name, unit: p.unit || '', price: p.price || 0, fprice: p.fprice || null, cost: p.cost || null }));
    S.clients = d.clients.map((c, i) => ({ id: 'c' + (i + 1), name: c.name, phone: c.phone || '', address: c.address || '' }));
    S.settings = { header: DEFAULT_HEADER, nextSeq: 1 };
    await DB.putMany('products', S.products);
    await DB.putMany('clients', S.clients);
    await DB.kvSet('settings', S.settings);
  }

  /* ---------------- Utilitaires d'interface ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  // Boîtes de dialogue intégrées à la page (les fenêtres natives du navigateur ne marchent pas partout)
  function askDialog({ msg, input, def, ok }) {
    return new Promise((res) => {
      const o = document.createElement('div');
      o.id = 'ask';
      o.innerHTML = `<div class="mbox"><p class="amsg">${esc(msg)}</p>${input ? `<input id="ask-in" inputmode="decimal" value="${esc(def == null ? '' : def)}">` : ''}<div class="actions"><button class="btn primary" id="ask-ok">${esc(ok || 'Confirmer')}</button><button class="btn" id="ask-no">Annuler</button></div></div>`;
      document.body.appendChild(o);
      const done = (v) => { o.remove(); res(v); };
      $('#ask-ok', o).onclick = () => done(input ? $('#ask-in', o).value : true);
      $('#ask-no', o).onclick = () => done(input ? null : false);
      o.addEventListener('click', (e) => { if (e.target === o) done(input ? null : false); });
      const i = $('#ask-in', o);
      if (i) { i.focus(); i.select(); i.onkeydown = (e) => { if (e.key === 'Enter') $('#ask-ok', o).click(); }; } else $('#ask-ok', o).focus();
    });
  }
  const askConfirm = (msg, ok) => askDialog({ msg, ok });
  const askPrompt = (msg, def) => askDialog({ msg, input: true, def, ok: 'Enregistrer' });
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  function openForm({ title, fields, values, onSave, onDelete }) {
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = `<div class="mbox"><h2>${esc(title)}</h2><form id="mf">${fields.map((f) =>
      `<label>${esc(f.label)}<input name="${f.name}" ${f.mode ? `inputmode="${f.mode}"` : ''} ${f.required ? 'required' : ''} value="${esc(values[f.name] == null ? '' : values[f.name])}" autocomplete="off"></label>`).join('')}
      <div class="actions"><button class="btn primary">Enregistrer</button>${onDelete ? '<button type="button" class="btn danger" id="mf-del">Supprimer</button>' : ''}<button type="button" class="btn" id="mf-cancel">Annuler</button></div></form></div>`;
    $('#mf').onsubmit = async (e) => { e.preventDefault(); await onSave(Object.fromEntries(new FormData(e.target))); closeModal(); };
    $('#mf-cancel').onclick = closeModal;
    if (onDelete) $('#mf-del').onclick = async () => { if (await askConfirm('Supprimer définitivement ?', 'Supprimer')) { await onDelete(); closeModal(); } };
    const first = $('#mf input'); if (first) first.focus();
  }

  /* ---------------- Documents imprimables ---------------- */
  const BASE_CSS = `*{box-sizing:border-box}body{margin:0;padding:12mm 14mm;font-family:"Times New Roman",Times,serif;font-size:12pt;color:#000}
.hd{display:flex;align-items:center;gap:10px;min-height:20mm}.hd img{width:20mm;height:20mm;object-fit:contain}.hd div{flex:1;text-align:center;line-height:1.3}
hr{border:0;border-top:1px dashed #000;margin:5px 0 7px}
h1{text-align:center;font-size:16pt;margin:3px 0 6px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:0 4px;height:6.6mm;vertical-align:middle}
th{background:#d9d9d9;font-weight:bold;text-align:center}.c{text-align:center}.r{text-align:right}.g{background:#d9d9d9;font-weight:bold}
tr{page-break-inside:avoid}`;

  function headerHtml() {
    const lines = String(S.settings.header || '').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l, i) => (i === 0 ? `<b style="font-size:15pt">${esc(l)}</b>` : esc(l))).join('<br>');
    const logo = new URL('logo.png', location.href).href;
    return `<div class="hd"><img src="${logo}" alt=""><div>${lines}</div></div><hr>`;
  }

  function invoiceHtml(inv) {
    const total = inv.lines.reduce((s, l) => s + l.qty * l.price, 0);
    const n = Math.max(23, inv.lines.length);
    let body = '';
    for (let i = 0; i < n; i++) {
      const l = inv.lines[i];
      body += l
        ? `<tr><td class="c">${i + 1}</td><td>${esc(l.name)}</td><td class="c">${esc(qtyTxt(l.qty))}</td><td class="c">${l.price ? money(l.price) : ''}</td><td class="c">${l.price ? money(l.qty * l.price) : ''}</td></tr>`
        : '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td></tr>';
    }
    const isPro = inv.type === 'FACTURE PROFORMA';
    const letters = total ? `Arrêtée la présente facture${isPro ? ' proforma' : ''} à la somme de : ${words(total)} Francs CFA` : '';
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(inv.type)} ${esc(inv.id || '')}</title>
<style>@page{size:A4 portrait;margin:0}${BASE_CSS}
.info{display:flex;justify-content:space-between;align-items:flex-start;margin:4px 0 8px}
.info table{width:auto}.m1 td{width:52mm;font-size:12pt}.m1 td.g{width:30mm;font-size:11pt}.cl{width:75mm}.cl td{text-align:center}
.cl .t{border-bottom:1px solid #000}.cl .v{height:13mm;font-size:12pt}
.foot{display:flex;margin-top:0}.foot .sig{width:50%;height:19mm;border:1px solid #000;border-top:0;text-align:center;padding-top:1mm}
.foot .tt{width:50%}.foot .tt div{border:1px solid #000;border-top:0;border-left:0;text-align:center;height:7mm;line-height:7mm}
.foot .tt .big{font-size:14pt;font-weight:bold;height:12mm;line-height:12mm}.words{text-align:center;margin-top:7mm}
.foot,.words{page-break-inside:avoid}</style></head><body>
${headerHtml()}<h1>${esc(inv.type)}</h1>
<div class="info"><table class="m1"><tr><td class="g">N° facture</td><td class="c">${esc(inv.id || '')}</td></tr><tr><td class="g">Date</td><td class="c">${frDate(inv.date)}</td></tr></table>
<table class="cl"><tr><td class="g t">CLIENT PAYEUR</td></tr><tr><td class="v">${esc(inv.client)}</td></tr></table></div>
<table><tr><th style="width:11mm">N°</th><th>Désignation</th><th style="width:20mm">Quantité</th><th style="width:25mm">Prix Unitaire</th><th style="width:27mm">Montant</th></tr>${body}</table>
<div class="foot"><div class="sig">Cachet &amp; signature</div><div class="tt"><div>Montant total</div><div class="big">${money(total)} F CFA</div></div></div>
<div class="words">${esc(letters)}</div></body></html>`;
  }

  function detailHtml(d) {
    const rows = d.rows.filter((r) => r.name.trim());
    const total = rows.reduce((s, r) => s + num(r.qty) * num(r.price), 0);
    const n = Math.max(15, rows.length);
    let body = '';
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      body += r
        ? `<tr><td class="c">${i + 1}</td><td>${esc(r.name)}</td><td class="c">${esc(r.unit)}</td><td class="c">${esc(qtyTxt(num(r.qty)))}</td><td class="c"><b>${num(r.price) ? money(num(r.price)) : ''}</b></td><td class="c">${num(r.price) ? money(num(r.qty) * num(r.price)) : ''}</td></tr>`
        : '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';
    }
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Prix unitaire des médicaments</title>
<style>@page{size:A4 landscape;margin:0}${BASE_CSS}
td,th{height:6.4mm;font-size:11pt}.top{display:flex;justify-content:space-between;margin:2mm 0 3mm;font-weight:bold}
.tot{display:flex;justify-content:flex-end;margin-top:0}.tot div{border:1px solid #000;border-top:0;padding:0 6mm;height:9mm;line-height:9mm;font-weight:bold;font-size:14pt}
.tot .l{flex:1;border-right:0}.tot .v{width:50mm;text-align:center}.tot{page-break-inside:avoid}</style></head><body>
<h1>PRIX UNITAIRE DES MEDICAMENTS</h1>
<div class="top"><span>Client : ${esc(d.client)}</span><span>Date : ${frDate(d.date)}</span></div>
<table><tr><th style="width:11mm">N°</th><th>Désignation</th><th style="width:36mm">Conditionnement</th><th style="width:24mm">Quantité</th><th style="width:34mm">Prix de vente</th><th style="width:36mm">Montant</th></tr>${body}</table>
<div class="tot"><div class="l">Montant total</div><div class="v">${money(total)}</div></div></body></html>`;
  }

  function printHtml(html) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden';
    document.body.appendChild(f);
    f.onload = () => {
      const w = f.contentWindow;
      const imgs = [...w.document.images];
      Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => {
        w.focus();
        w.print();
        setTimeout(() => f.remove(), 60000);
      });
    };
    f.srcdoc = html;
  }

  function showDoc(html, landscape, pdf) {
    const W = landscape ? 1123 : 794, H = landscape ? 794 : 1123;
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = `<div class="mbox wide"><div class="mbar">${pdf && window.PDFLib ? '<button class="btn primary" id="m-pdf">Enregistrer en PDF</button>' : ''}<button class="btn${pdf && window.PDFLib ? '' : ' primary'}" id="m-print">Imprimer</button><button class="btn" id="m-close">Fermer</button></div><div class="mview"><div class="mwrap"><iframe></iframe></div></div></div>`;
    const wrap = $('.mwrap', m), fr = $('iframe', m), view = $('.mview', m);
    fr.style.width = W + 'px';
    fr.style.height = H + 'px';
    fr.srcdoc = html;
    const fit = () => {
      const s = Math.min(1, (view.clientWidth - 10) / W);
      fr.style.transform = `scale(${s})`;
      wrap.style.width = W * s + 'px';
      wrap.style.height = H * s + 'px';
    };
    fit();
    setTimeout(fit, 80);
    $('#m-print').onclick = () => printHtml(html);
    if (pdf && window.PDFLib) $('#m-pdf').onclick = () => savePdf(pdf.kind, pdf.name, pdf.make);
    $('#m-close').onclick = closeModal;
  }


  /* ---------------- Enregistrement des PDF dans les dossiers ---------------- */
  const FS_OK = 'showDirectoryPicker' in window;
  const DIRNAME = { fac: 'D:\\GMC FAC\\Facture', prix: 'D:\\GMC FAC\\Prix' };
  const slug = (x) => String(x || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '_');
  const fileName = (label, client, id) => `${label}_${slug(client) || 'Client'}_${slug(String(id || '').replace(/\//g, '-'))}.pdf`;
  const getDirs = async () => (await DB.kvGet('dirs')) || {};
  async function pickDir(kind) {
    const h = await window.showDirectoryPicker({ id: 'gmc-' + kind, mode: 'readwrite' });
    const dirs = await getDirs();
    dirs[kind] = h;
    await DB.kvSet('dirs', dirs);
    return h;
  }
  function downloadBytes(bytes, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function savePdf(kind, name, make) {
    let h = null;
    try {
      h = (await getDirs())[kind] || null;
      if (FS_OK && !h) {
        if (!(await askConfirm(`Choisissez maintenant le dossier ${DIRNAME[kind]}. Cette question n'est posée qu'une fois.`, 'Choisir le dossier'))) return;
        h = await pickDir(kind);
      }
      if (h && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') h = null;
    } catch (e) { if (e && e.name === 'AbortError') return; h = null; }
    try {
      const bytes = await make();
      if (h) {
        const w = await (await h.getFileHandle(name, { create: true })).createWritable();
        await w.write(bytes); await w.close();
        toast(`Enregistré dans « ${h.name} » : ${name}`);
      } else { downloadBytes(bytes, name); toast(`PDF téléchargé : ${name}`); }
    } catch (e) {
      try { downloadBytes(await make(), name); toast(`Dossier inaccessible : PDF téléchargé (${name}).`); } catch (e2) { toast('Impossible de créer le PDF.'); }
    }
  }
  let logoBytes = null;
  async function getLogo() { if (!logoBytes) logoBytes = new Uint8Array(await (await fetch('logo.png')).arrayBuffer()); return logoBytes; }
  function invoicePdfOpts(inv) {
    const isPro = inv.type === 'FACTURE PROFORMA';
    return {
      kind: 'fac', name: fileName(isPro ? 'Proforma' : 'Facture', inv.client, inv.id),
      make: async () => {
        const total = inv.lines.reduce((t, l) => t + l.qty * l.price, 0);
        return PdfGen.invoice({
          header: S.settings.header, type: inv.type, id: inv.id || '', date: frDate(inv.date), client: inv.client,
          lines: inv.lines.map((l) => ({ name: l.name, qty: qtyTxt(l.qty), price: l.price ? money(l.price) : '', amount: l.price ? money(l.qty * l.price) : '' })),
          total: money(total), letters: total ? `Arrêtée la présente facture${isPro ? ' proforma' : ''} à la somme de : ${words(total)} Francs CFA` : ''
        }, await getLogo());
      }
    };
  }
  function detailPdfOpts(d) {
    return {
      kind: 'prix', name: fileName('Prix', d.client, d.src && d.src !== 'draft' ? d.src : d.date),
      make: async () => {
        const rows = d.rows.filter((r) => r.name.trim());
        return PdfGen.detail({
          header: S.settings.header, client: d.client, date: frDate(d.date),
          rows: rows.map((r) => ({ name: r.name, unit: r.unit, qty: qtyTxt(num(r.qty)), price: num(r.price) ? money(num(r.price)) : '', amount: num(r.price) ? money(num(r.qty) * num(r.price)) : '' })),
          total: money(rows.reduce((t, r) => t + num(r.qty) * num(r.price), 0))
        }, await getLogo());
      }
    };
  }

  /* ---------------- Numérotation ---------------- */
  function freshNumber(dateISO) {
    let seq = S.settings.nextSeq || 1, n;
    do { n = makeNumber(seq, dateISO); seq++; } while (S.invoices.some((i) => i.id === n));
    return { n, seq };
  }
  const previewNumber = (dateISO) => freshNumber(dateISO).n;

  /* ---------------- Écran : Facture (saisie) ---------------- */
  const draftTotal = () => S.draft.lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0);
  const draftHasContent = () => S.draft.client.trim() || S.draft.lines.some((l) => l.name.trim() || l.qty !== '');

  function lineHtml(l, i) {
    return `<div class="line" data-i="${i}"><div class="ln">${i + 1}</div><div class="lf">
      <input class="f-name" list="products-dl" placeholder="Produit (tapez pour chercher)" value="${esc(l.name)}" autocomplete="off">
      <div class="lrow"><label>Qté<input class="f-qty" inputmode="decimal" value="${esc(l.qty)}"></label>
      <label>Prix unitaire<input class="f-price${l.name && l.price === '' ? ' warn' : ''}" inputmode="decimal" value="${esc(l.price)}"></label>
      <div class="amt"><small>Montant</small><b class="f-amt"></b></div><button class="x f-del" aria-label="Supprimer la ligne">✕</button></div>
      <div class="lrow2"><label>Prix d'achat<input class="f-cost" inputmode="decimal" placeholder="—" value="${esc(l.cost)}"></label>
      <div class="gain"><small>Gain</small><b class="f-gain"></b></div></div></div></div>`;
  }

  function renderLines() {
    $('#lines').innerHTML = S.draft.lines.map(lineHtml).join('');
    updateTotals();
  }

  const pct = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + ' %' : '');
  const signed = (v) => (v > 0 ? '+' : '') + money(v);

  function updateTotals() {
    const d = S.draft;
    $$('#lines .line').forEach((row) => {
      const l = d.lines[+row.dataset.i];
      const a = num(l.qty) * num(l.price);
      $('.f-amt', row).textContent = l.qty !== '' && l.price !== '' ? money(a) : '';
      const g = $('.f-gain', row);
      if (l.qty !== '' && l.price !== '' && l.cost !== '') {
        const v = num(l.qty) * (num(l.price) - num(l.cost));
        g.textContent = signed(v);
        g.className = 'f-gain ' + (v < 0 ? 'neg' : 'pos');
      } else { g.textContent = ''; g.className = 'f-gain'; }
    });
    const t = draftTotal();
    $('#f-total').textContent = money(t) + ' F CFA';
    $('#f-words').textContent = t ? `Arrêtée la présente facture${d.type === 'FACTURE PROFORMA' ? ' proforma' : ''} à la somme de : ${words(t)} Francs CFA` : '';
    let gain = 0, sales = 0, miss = 0;
    d.lines.forEach((l) => {
      if (!l.name.trim() || num(l.qty) <= 0) return;
      if (l.cost === '') { miss++; return; }
      gain += num(l.qty) * (num(l.price) - num(l.cost));
      sales += num(l.qty) * num(l.price);
    });
    const gp = $('#f-gain');
    if (sales || gain) {
      gp.innerHTML = `Gain estimé : <b class="${gain < 0 ? 'neg' : 'pos'}">${signed(gain)} F</b> (marge ${pct(gain, sales)})${miss ? ` · ${miss} ligne(s) sans prix d'achat non comptée(s)` : ''}`;
    } else gp.textContent = miss ? "Renseignez les prix d'achat pour voir votre gain." : '';
  }

  function applyAutoPrice(row, l) {
    const p = findProduct(l.name);
    if (!p) return;
    if (l.price === '' || l.auto) {
      l.price = p.fprice != null ? String(p.fprice) : '';
      l.auto = true;
      const pi = $('.f-price', row);
      pi.value = l.price;
      pi.classList.toggle('warn', l.price === '');
    }
    if (l.cost === '' || l.costAuto) {
      l.cost = p.cost != null ? String(p.cost) : '';
      l.costAuto = true;
      $('.f-cost', row).value = l.cost;
    }
  }

  function viewFacture() {
    const d = S.draft;
    $('#view').innerHTML = `
    <section class="card"><div class="grid2">
      <label>Type<select id="f-type"><option value="FACTURE"${d.type === 'FACTURE' ? ' selected' : ''}>FACTURE</option><option value="FACTURE PROFORMA"${d.type === 'FACTURE PROFORMA' ? ' selected' : ''}>FACTURE PROFORMA</option></select></label>
      <label>N° (automatique)<input id="f-num" readonly value="${esc(d.editingId || previewNumber(d.date))}"></label>
      <label>Date<input type="date" id="f-date" value="${esc(d.date)}"></label>
      <label>Client payeur<input id="f-client" list="clients-dl" placeholder="Nom du client" value="${esc(d.client)}" autocomplete="off"></label>
    </div>${d.editingId ? '<p class="note">Vous modifiez une facture enregistrée : son n° est conservé.</p>' : ''}</section>
    <section class="card"><div id="lines"></div><button class="btn ghost" id="f-add" style="margin-top:10px">+ Ajouter une ligne</button></section>
    <section class="card total"><div><span>Montant total</span><strong id="f-total"></strong></div><p id="f-words"></p><p id="f-gain" class="gainp"></p></section>
    <div class="actions"><button class="btn" id="f-preview">Aperçu / PDF</button><button class="btn primary" id="f-save">Enregistrer</button><button class="btn" id="f-reset">Vider</button></div>`;
    renderLines();

    $('#f-type').onchange = (e) => { d.type = e.target.value; updateTotals(); saveDraft(); };
    $('#f-date').onchange = (e) => { d.date = e.target.value || today(); if (!d.editingId) $('#f-num').value = previewNumber(d.date); saveDraft(); };
    $('#f-client').oninput = (e) => { d.client = e.target.value; saveDraft(); };
    $('#f-add').onclick = () => { d.lines.push(blankLine()); renderLines(); const n = $$('#lines .f-name'); n[n.length - 1].focus(); saveDraft(); };

    const lines = $('#lines');
    const onEdit = (e) => {
      const row = e.target.closest('.line');
      if (!row) return;
      const l = d.lines[+row.dataset.i];
      if (e.target.classList.contains('f-name')) { l.name = e.target.value; applyAutoPrice(row, l); }
      else if (e.target.classList.contains('f-qty')) l.qty = e.target.value;
      else if (e.target.classList.contains('f-price')) { l.price = e.target.value; l.auto = false; e.target.classList.toggle('warn', l.price === '' && !!l.name); }
      else if (e.target.classList.contains('f-cost')) { l.cost = e.target.value; l.costAuto = false; }
      else return;
      updateTotals();
      saveDraft();
    };
    lines.addEventListener('input', onEdit);
    lines.addEventListener('change', onEdit);
    lines.addEventListener('click', (e) => {
      if (!e.target.classList.contains('f-del')) return;
      const i = +e.target.closest('.line').dataset.i;
      d.lines.splice(i, 1);
      if (!d.lines.length) d.lines.push(blankLine());
      renderLines();
      saveDraft();
    });

    $('#f-preview').onclick = () => {
      const lns = cleanLines(d);
      if (!lns.length) return toast('Ajoutez au moins une ligne avec un produit et une quantité.');
      const pv = { id: d.editingId || previewNumber(d.date), type: d.type, date: d.date, client: d.client, lines: lns };
      showDoc(invoiceHtml(pv), false, invoicePdfOpts(pv));
    };
    $('#f-save').onclick = saveInvoice;
    $('#f-reset').onclick = async () => {
      if (draftHasContent() && !(await askConfirm('Vider la facture en cours ?', 'Vider'))) return;
      S.draft = blankDraft();
      await DB.kvSet('draft', S.draft);
      viewFacture();
    };
  }

  const cleanLines = (d) => d.lines.filter((l) => l.name.trim() && num(l.qty) > 0).map((l) => ({ name: l.name.trim(), qty: num(l.qty), price: num(l.price), cost: l.cost === '' ? null : num(l.cost) }));

  async function saveInvoice() {
    const d = S.draft;
    const lines = cleanLines(d);
    if (!lines.length) return toast('Ajoutez au moins une ligne avec un produit et une quantité.');
    if (!d.client.trim()) return toast('Indiquez le client.');
    if (lines.some((l) => !l.price) && !(await askConfirm("Certaines lignes n'ont pas de prix (montant 0). Enregistrer quand même ?", 'Enregistrer'))) return;
    let id = d.editingId, old = null;
    if (id) old = S.invoices.find((i) => i.id === id);
    else {
      const f = freshNumber(d.date);
      id = f.n;
      S.settings.nextSeq = f.seq;
      await DB.kvSet('settings', S.settings);
    }
    const inv = {
      id, type: d.type, date: d.date, client: d.client.trim(), lines,
      total: lines.reduce((s, l) => s + l.qty * l.price, 0),
      paid: old ? old.paid : 0, createdAt: old ? old.createdAt : Date.now(),
    };
    await DB.put('invoices', inv);
    S.invoices = S.invoices.filter((i) => i.id !== id).concat(inv);
    if (!S.clients.some((c) => norm(c.name) === norm(inv.client))) {
      const c = { id: uid(), name: inv.client, phone: '', address: '' };
      S.clients.push(c);
      await DB.put('clients', c);
      refreshLists();
    }
    S.draft = blankDraft();
    await DB.kvSet('draft', S.draft);
    toast(`${inv.type === 'FACTURE' ? 'Facture' : 'Proforma'} n° ${id} enregistrée.`);
    location.hash = '#/factures';
  }

  /* ---------------- Écran : Archives ---------------- */
  const payState = (i) => (i.type !== 'FACTURE' ? null : i.paid >= i.total && i.total > 0 ? 'ok' : i.paid > 0 ? 'part' : 'no');
  const PAY_TXT = { ok: 'Payée', part: 'Partielle', no: 'Non payée' };

  const invCalc = (i) => {
    let gain = 0, sales = 0, miss = 0;
    i.lines.forEach((l) => {
      if (l.cost == null) { miss++; return; }
      gain += l.qty * (l.price - l.cost);
      sales += l.qty * l.price;
    });
    return { gain, sales, miss };
  };
  const monthLabel = (ym) => {
    const [y, m] = ym.split('-');
    const t = new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  function viewFactures() {
    const months = [...new Set(S.invoices.map((i) => i.date.slice(0, 7)))].sort().reverse();
    if (S.ui.im && !months.includes(S.ui.im)) S.ui.im = '';
    $('#view').innerHTML = `<div class="bar"><input id="i-q" type="search" placeholder="Rechercher : n°, client, produit…" value="${esc(S.ui.iq || '')}"><select id="i-m" aria-label="Mois"><option value="">Tous les mois</option>${months.map((m) => `<option value="${m}"${m === S.ui.im ? ' selected' : ''}>${esc(monthLabel(m))}</option>`).join('')}</select></div><div id="i-sum"></div><div id="i-list"></div>`;
    const draw = () => {
      const k = norm(S.ui.iq || '');
      const list = S.invoices.filter((i) => (!S.ui.im || i.date.startsWith(S.ui.im)) && (!k || norm(i.id + ' ' + i.client + ' ' + i.type + ' ' + frDate(i.date) + ' ' + i.lines.map((l) => l.name).join(' ')).includes(k)))
        .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
      const fact = list.filter((i) => i.type === 'FACTURE');
      const ventes = fact.reduce((s, i) => s + i.total, 0);
      const due = fact.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);
      const tc = fact.reduce((a, i) => { const c = invCalc(i); a.gain += c.gain; a.sales += c.sales; a.miss += c.miss; return a; }, { gain: 0, sales: 0, miss: 0 });
      $('#i-sum').innerHTML = `<div class="stats"><div><small>Ventes (factures)</small><b>${money(ventes)} F</b></div><div><small>Gain</small><b class="${tc.gain < 0 ? 'neg' : 'pos'}">${money(tc.gain)} F</b><small>${pct(tc.gain, tc.sales)}</small></div><div><small>Reste à encaisser</small><b>${money(due)} F</b></div></div>`
        + (tc.miss ? `<p class="note">${tc.miss} ligne(s) sans prix d'achat : le gain est partiel. Ouvrez la facture (Modifier) pour les renseigner.</p>` : '')
        + `<div class="sum"><span><b>${list.length}</b> document(s)</span></div>`;
      $('#i-list').innerHTML = list.length ? list.map((i) => {
        const ps = payState(i);
        const c = invCalc(i);
        const gtxt = c.sales || c.gain ? ` · ${i.type === 'FACTURE' ? 'Gain' : 'Gain prévu'} : <b class="${c.gain < 0 ? 'neg' : 'pos'}">${money(c.gain)} F</b>${c.miss ? ' (partiel)' : ''}` : '';
        return `<div class="item" data-id="${esc(i.id)}"><div class="grow"><b>N° ${esc(i.id)} <span class="badge">${i.type === 'FACTURE' ? 'Facture' : 'Proforma'}</span>${ps ? `<span class="badge ${ps}">${PAY_TXT[ps]}</span>` : ''}</b>
          <small>${esc(i.client)} · ${frDate(i.date)} · <b>${money(i.total)} F</b>${gtxt}${ps && ps !== 'ok' && i.paid ? ` (payé ${money(i.paid)} F)` : ''}</small>
          <div class="btns"><button class="btn sm" data-a="view">Voir / Imprimer</button><button class="btn sm" data-a="detail">Détail prix</button><button class="btn sm" data-a="edit">Modifier</button><button class="btn sm" data-a="dup">Dupliquer</button>${i.type !== 'FACTURE' ? '<button class="btn sm" data-a="conv">En facture</button>' : '<button class="btn sm" data-a="pay">Paiement</button>'}<button class="btn sm danger" data-a="del">Supprimer</button></div></div></div>`;
      }).join('') : '<div class="empty">Aucune facture enregistrée.</div>';
    };
    draw();
    $('#i-q').oninput = (e) => { S.ui.iq = e.target.value; draw(); };
    $('#i-m').onchange = (e) => { S.ui.im = e.target.value; draw(); };
    $('#i-list').onclick = async (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const inv = S.invoices.find((i) => i.id === b.closest('.item').dataset.id);
      if (!inv) return;
      const a = b.dataset.a;
      if (a === 'view') return showDoc(invoiceHtml(inv), false, invoicePdfOpts(inv));
      if (a === 'detail') { S.ui.detail = { src: inv.id }; location.hash = '#/detail'; return; }
      if (a === 'del') {
        if (!(await askConfirm(`Supprimer définitivement le n° ${inv.id} ?`, 'Supprimer'))) return;
        await DB.del('invoices', inv.id);
        S.invoices = S.invoices.filter((i) => i.id !== inv.id);
        return viewFactures();
      }
      if (a === 'pay') {
        const v = await askPrompt(`Montant total déjà payé pour le n° ${inv.id} (total : ${money(inv.total)} F)`, inv.paid || '');
        if (v === null) return;
        inv.paid = Math.max(0, num(v));
        await DB.put('invoices', inv);
        return draw();
      }
      if (draftHasContent() && !(await askConfirm('La facture en cours de saisie sera remplacée. Continuer ?', 'Continuer'))) return;
      const lines = inv.lines.map((l) => {
        const p = findProduct(l.name);
        const has = l.cost != null;
        return { name: l.name, qty: String(l.qty), price: String(l.price), auto: false, cost: has ? String(l.cost) : (p && p.cost != null ? String(p.cost) : ''), costAuto: !has };
      });
      if (a === 'edit') S.draft = { type: inv.type, date: inv.date, client: inv.client, lines, editingId: inv.id };
      else S.draft = { type: a === 'conv' ? 'FACTURE' : inv.type, date: today(), client: inv.client, lines, editingId: null };
      await DB.kvSet('draft', S.draft);
      location.hash = '#/facture';
    };
  }

  /* ---------------- Écran : Détail prix du client ---------------- */
  function buildDetail(src, convert) {
    let inv;
    if (src === 'draft') {
      const d = S.draft;
      inv = { client: d.client, date: d.date, lines: cleanLines(d) };
    } else inv = S.invoices.find((i) => i.id === src);
    if (!inv) return { src: 'draft', convert, client: '', date: today(), rows: [] };
    const rows = inv.lines.map((l) => {
      const p = findProduct(l.name);
      const m = /B\s*\/\s*(\d+)/i.exec(l.name);
      let qty = l.qty;
      if (convert && p && m) qty = l.qty * +m[1];
      return { name: l.name, unit: p ? p.unit : '', qty: String(qty), price: String(p ? p.price : l.price), listed: !!p };
    });
    return { src, convert, client: inv.client, date: inv.date, rows };
  }

  function viewDetail() {
    const cur = S.ui.detail || { src: 'draft', convert: false };
    let D = buildDetail(cur.src, !!cur.convert);
    S.ui.detail = { src: D.src, convert: D.convert };
    const invs = [...S.invoices].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    $('#view').innerHTML = `<section class="card">
      <label>Facture à détailler<select id="d-src"><option value="draft">Facture en cours de saisie</option>${invs.map((i) => `<option value="${esc(i.id)}"${i.id === D.src ? ' selected' : ''}>N° ${esc(i.id)} – ${esc(i.client)} – ${frDate(i.date)}</option>`).join('')}</select></label>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="d-conv" style="width:auto;margin:0"${D.convert ? ' checked' : ''}> Convertir les boîtes en unités (ex. B/50 : 2 boîtes → 100)</label>
      <p class="help">Les prix de vente unitaires viennent de la liste « Produits » (colonne cabinet). Vous pouvez corriger chaque ligne avant d'imprimer.</p></section>
      <section class="card"><div class="grid2"><label>Client<input id="d-client" value="${esc(D.client)}"></label><label>Date<input type="date" id="d-date" value="${esc(D.date)}"></label></div></section>
      <section class="card"><div id="d-rows"></div></section>
      <section class="card total"><div><span>Montant total</span><strong id="d-total"></strong></div></section>
      <div class="actions"><button class="btn primary" id="d-preview">Aperçu / PDF</button></div>`;
    $('#d-src').value = D.src;
    const drawRows = () => {
      $('#d-rows').innerHTML = D.rows.length ? D.rows.map((r, i) => `<div class="line" data-i="${i}"><div class="ln">${i + 1}</div><div class="lf">
        <input class="r-name" value="${esc(r.name)}"><div class="lrow d"><label>Conditionnement<input class="r-unit" value="${esc(r.unit)}"></label>
        <label>Qté<input class="r-qty" inputmode="decimal" value="${esc(r.qty)}"></label><label>Prix de vente<input class="r-price${r.listed ? '' : ' warn'}" inputmode="decimal" value="${esc(r.price)}"></label></div>
        <div class="amt" style="margin-top:4px"><small>Montant</small><b class="r-amt"></b></div></div></div>`).join('') : '<div class="empty">Aucune ligne : choisissez une facture ou saisissez-en une d\'abord.</div>';
      tot();
    };
    const tot = () => {
      $$('#d-rows .line').forEach((el) => { const r = D.rows[+el.dataset.i]; $('.r-amt', el).textContent = money(num(r.qty) * num(r.price)); });
      $('#d-total').textContent = money(D.rows.reduce((s, r) => s + num(r.qty) * num(r.price), 0)) + ' F CFA';
    };
    drawRows();
    const reload = () => { D = buildDetail($('#d-src').value, $('#d-conv').checked); S.ui.detail = { src: D.src, convert: D.convert }; $('#d-client').value = D.client; $('#d-date').value = D.date; drawRows(); };
    $('#d-src').onchange = reload;
    $('#d-conv').onchange = reload;
    $('#d-client').oninput = (e) => { D.client = e.target.value; };
    $('#d-date').onchange = (e) => { D.date = e.target.value; };
    $('#d-rows').addEventListener('input', (e) => {
      const el = e.target.closest('.line');
      if (!el) return;
      const r = D.rows[+el.dataset.i], c = e.target.classList;
      if (c.contains('r-name')) r.name = e.target.value;
      else if (c.contains('r-unit')) r.unit = e.target.value;
      else if (c.contains('r-qty')) r.qty = e.target.value;
      else if (c.contains('r-price')) { r.price = e.target.value; c.remove('warn'); }
      tot();
    });
    $('#d-preview').onclick = () => {
      if (!D.rows.length) return toast("Aucune ligne à afficher.");
      showDoc(detailHtml(D), true, detailPdfOpts(D));
    };
  }

  /* ---------------- Écran : Produits ---------------- */
  const PFIELDS = [
    { name: 'name', label: 'Désignation', required: true },
    { name: 'unit', label: 'Conditionnement chez le client (ex. Boîte, Flacon, Unité)' },
    { name: 'price', label: 'Prix de vente unitaire du client (cabinet, FCFA)', mode: 'decimal' },
    { name: 'fprice', label: 'Votre prix de vente (FCFA, par conditionnement de la facture)', mode: 'decimal' },
    { name: 'cost', label: "Votre prix d'achat chez le grossiste (FCFA, par conditionnement de la facture)", mode: 'decimal' },
  ];
  const marginTxt = (p) => {
    if (p.cost == null || p.fprice == null) return '';
    const m = p.fprice - p.cost;
    return `Marge : ${signed(m)} F (${p.fprice ? Math.round(m / p.fprice * 100) : 0} %)`;
  };
  const saveProduct = (p) => DB.put('products', p);
  function editProduct(p) {
    const isNew = !p;
    openForm({
      title: isNew ? 'Nouveau produit' : 'Modifier le produit', fields: PFIELDS,
      values: p ? { ...p, fprice: p.fprice == null ? '' : p.fprice, cost: p.cost == null ? '' : p.cost } : {},
      onSave: async (v) => {
        const opt = (x) => (String(x).trim() === '' ? null : num(x));
        const o = { id: p ? p.id : uid(), name: v.name.trim(), unit: v.unit.trim(), price: num(v.price), fprice: opt(v.fprice), cost: opt(v.cost) };
        await DB.put('products', o);
        S.products = S.products.filter((x) => x.id !== o.id).concat(o);
        refreshLists();
        viewProduits();
      },
      onDelete: isNew ? null : async () => { await DB.del('products', p.id); S.products = S.products.filter((x) => x.id !== p.id); refreshLists(); viewProduits(); },
    });
  }
  function viewProduits() {
    const cm = !!S.ui.pcost;
    $('#view').innerHTML = `<div class="bar"><input id="p-q" type="search" placeholder="Rechercher un produit…" value="${esc(S.ui.pq || '')}"><button class="btn${cm ? ' primary' : ''}" id="p-mode">${cm ? 'Terminer la saisie' : "Saisir les prix d'achat"}</button><button class="btn" id="p-add">+ Produit</button></div>`
      + (cm ? `<label class="chk"><input type="checkbox" id="p-miss"${S.ui.pmiss ? ' checked' : ''}> Seulement les produits sans prix d'achat</label><p class="help">Indiquez ce que vous paie le grossiste, par conditionnement de la facture (même unité que votre prix de vente). L'enregistrement est automatique.</p>` : '')
      + '<div id="p-sum" class="sum"></div><div id="p-list"></div>';
    const draw = () => {
      const k = norm(S.ui.pq || '');
      let list = S.products.filter((p) => !k || norm(p.name).includes(k));
      if (cm && S.ui.pmiss) list = list.filter((p) => p.cost == null);
      const miss = S.products.filter((p) => p.cost == null).length;
      $('#p-sum').innerHTML = `<span><b>${list.length}</b> / ${S.products.length} produits</span><span>${miss} sans prix d'achat</span>`;
      const vente = (p) => (p.fprice == null ? '<i>à renseigner</i>' : money(p.fprice) + ' F');
      $('#p-list').innerHTML = list.slice(0, 300).map((p) => (cm
        ? `<div class="item" data-id="${esc(p.id)}"><div class="grow"><b>${esc(p.name)}</b><small>Vente : ${vente(p)} <span class="mg">${esc(marginTxt(p))}</span></small></div><input class="cin" inputmode="decimal" placeholder="Achat" aria-label="Prix d'achat" value="${p.cost == null ? '' : esc(p.cost)}"></div>`
        : `<div class="item" data-id="${esc(p.id)}"><div class="grow"><b>${esc(p.name)}</b><small>Achat : ${p.cost == null ? '<i>à renseigner</i>' : money(p.cost) + ' F'} · Vente : ${vente(p)}${marginTxt(p) ? ' · ' + esc(marginTxt(p)) : ''} · Cabinet : ${money(p.price)} F${p.unit ? ' / ' + esc(p.unit) : ''}</small></div><button class="btn sm">Modifier</button></div>`)).join('')
        + (list.length > 300 ? '<p class="help">Affichage limité à 300 résultats : précisez la recherche.</p>' : '');
    };
    draw();
    const timers = new Map();
    $('#p-q').oninput = (e) => { S.ui.pq = e.target.value; draw(); };
    $('#p-add').onclick = () => editProduct(null);
    $('#p-mode').onclick = () => { S.ui.pcost = !cm; viewProduits(); };
    if (cm) $('#p-miss').onchange = (e) => { S.ui.pmiss = e.target.checked; draw(); };
    const list = $('#p-list');
    const costEdit = (e, now) => {
      if (!e.target.classList.contains('cin')) return;
      const it = e.target.closest('.item');
      const p = S.products.find((x) => x.id === it.dataset.id);
      if (!p) return;
      const v = e.target.value.trim();
      p.cost = v === '' ? null : num(v);
      $('.mg', it).textContent = marginTxt(p);
      clearTimeout(timers.get(p.id));
      if (now) saveProduct(p); else timers.set(p.id, setTimeout(() => saveProduct(p), 300));
    };
    list.addEventListener('input', (e) => costEdit(e, false));
    list.addEventListener('change', (e) => costEdit(e, true));
    list.onclick = (e) => { if (cm) return; const it = e.target.closest('.item'); if (it) editProduct(S.products.find((p) => p.id === it.dataset.id)); };
  }

  /* ---------------- Écran : Clients ---------------- */
  const CFIELDS = [{ name: 'name', label: 'Nom du client', required: true }, { name: 'phone', label: 'Téléphone', mode: 'tel' }, { name: 'address', label: 'Adresse / observations' }];
  function editClient(c) {
    openForm({
      title: c ? 'Modifier le client' : 'Nouveau client', fields: CFIELDS, values: c || {},
      onSave: async (v) => {
        const o = { id: c ? c.id : uid(), name: v.name.trim(), phone: v.phone.trim(), address: v.address.trim() };
        await DB.put('clients', o);
        S.clients = S.clients.filter((x) => x.id !== o.id).concat(o);
        refreshLists();
        viewClients();
      },
      onDelete: c ? async () => { await DB.del('clients', c.id); S.clients = S.clients.filter((x) => x.id !== c.id); refreshLists(); viewClients(); } : null,
    });
  }
  function viewClients() {
    $('#view').innerHTML = `<div class="bar"><button class="btn primary" id="c-add">+ Client</button></div><div id="c-list"></div>`;
    $('#c-list').innerHTML = S.clients.length ? S.clients.map((c) => {
      const n = S.invoices.filter((i) => norm(i.client) === norm(c.name));
      const due = n.filter((i) => i.type === 'FACTURE').reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);
      return `<div class="item" data-id="${esc(c.id)}"><div class="grow"><b>${esc(c.name)}</b><small>${esc([c.phone, c.address].filter(Boolean).join(' · ') || '—')} · ${n.length} document(s)${due ? ` · à encaisser : ${money(due)} F` : ''}</small></div><button class="btn sm">Modifier</button></div>`;
    }).join('') : '<div class="empty">Aucun client.</div>';
    $('#c-add').onclick = () => editClient(null);
    $('#c-list').onclick = (e) => { const it = e.target.closest('.item'); if (it) editClient(S.clients.find((c) => c.id === it.dataset.id)); };
  }


  /* ---------------- Mot de passe (verrouillage) ---------------- */
  const hex = (u8) => Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
  const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
  async function pwHash(pw, saltHex) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(saltHex), iterations: 100000, hash: 'SHA-256' }, k, 256)));
  }
  async function makeLock(pw) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return { salt, hash: await pwHash(pw, salt) };
  }
  const checkPw = async (lk, pw) => (await pwHash(pw, lk.salt)) === lk.hash;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  // Formulaire de saisie du mot de passe ; appelle onOk() si correct.
  function pwForm(host, title, onOk) {
    host.innerHTML = `<form class="pwbox" autocomplete="off"><h2>${esc(title)}</h2>
      <input type="password" id="pw-in" placeholder="Mot de passe" autocomplete="current-password" autofocus>
      <p class="pwerr" id="pw-err"></p><button class="btn primary" type="submit">Ouvrir</button></form>`;
    const f = host.querySelector('form'), inp = host.querySelector('#pw-in'), err = host.querySelector('#pw-err');
    let fails = 0;
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (await checkPw(S.lock, inp.value)) { onOk(); return; }
      fails++; inp.value = ''; err.textContent = 'Mot de passe incorrect.';
      f.querySelector('button').disabled = true;
      setTimeout(() => { f.querySelector('button').disabled = false; inp.focus(); }, Math.min(1000 * fails, 8000));
    };
    setTimeout(() => inp.focus(), 50);
  }
  function showLock() {
    return new Promise((resolve) => {
      let el = document.getElementById('lock');
      if (!el) { el = document.createElement('div'); el.id = 'lock'; document.body.appendChild(el); }
      el.hidden = false;
      el.innerHTML = '<div class="lockin"><img src="logo.png" alt="" width="64" height="64"><div id="lock-f"></div></div>';
      pwForm(el.querySelector('#lock-f'), 'Application verrouillée', () => { el.hidden = true; el.innerHTML = ''; resolve(); });
    });
  }

  /* ---------------- Écran : Réglages ---------------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (location.hash === '#/reglages') viewReglages(); });

  function viewReglages() {
    if (S.lock && !S.regOk) {
      $('#view').innerHTML = '<section class="card" id="gate"></section>';
      pwForm($('#gate'), 'Réglages protégés', () => { S.regOk = true; viewReglages(); });
      return;
    }
    $('#view').innerHTML = `
    <section class="card"><h2>En-tête des documents</h2><label>Texte affiché à côté du logo (une ligne par retour)<textarea id="s-head" rows="5">${esc(S.settings.header)}</textarea></label><p class="help">Modifié automatiquement à la saisie.</p></section>
    <section class="card"><h2>Sauvegarde</h2><p class="help">Vos données sont enregistrées <b>sur cet appareil uniquement</b>. Faites une sauvegarde régulièrement et pour passer d'un appareil à l'autre (téléphone ↔ PC).</p>
      <div class="actions"><button class="btn primary" id="s-exp">Exporter une sauvegarde</button><button class="btn" id="s-imp">Importer une sauvegarde</button></div><input type="file" id="s-file" accept=".json,application/json" hidden></section>
    <section class="card"><h2>Dossiers des PDF</h2>${FS_OK
      ? `<p class="help">Les PDF sont enregistrés automatiquement sous le nom <b>Facture_Client_N°</b>, <b>Proforma_Client_N°</b> ou <b>Prix_Client_N°</b>.</p>
         <label>Factures et proformas<input id="dir-fac" readonly placeholder="Non choisi"></label><div class="actions"><button class="btn" id="dir-fac-b">Choisir le dossier…</button></div>
         <label>Détail des prix<input id="dir-prix" readonly placeholder="Non choisi"></label><div class="actions"><button class="btn" id="dir-prix-b">Choisir le dossier…</button></div>
         <p class="help">Choisissez par exemple ${esc(DIRNAME.fac)} et ${esc(DIRNAME.prix)}.</p>`
      : '<p class="help">Ce navigateur ne permet pas de choisir un dossier : les PDF seront placés dans le dossier Téléchargements.</p>'}</section>
    <section class="card"><h2>Mot de passe</h2>${S.lock
      ? `<p class="help">Un mot de passe est demandé à l'ouverture de l'application et pour accéder aux Réglages.</p>
         <label>Nouveau mot de passe<input type="password" id="k-new" autocomplete="new-password"></label>
         <div class="actions"><button class="btn" id="k-chg">Changer le mot de passe</button><button class="btn" id="k-now">Verrouiller maintenant</button><button class="btn" id="k-off">Supprimer le mot de passe</button></div>`
      : `<p class="help">Protégez l'ouverture de l'application et les Réglages (sauvegarde, restauration, installation). Notez bien le mot de passe : il ne peut pas être récupéré.</p>
         <label>Mot de passe (4 caractères minimum)<input type="password" id="k-new" autocomplete="new-password"></label>
         <label>Confirmer<input type="password" id="k-new2" autocomplete="new-password"></label>
         <div class="actions"><button class="btn primary" id="k-on">Activer le mot de passe</button></div>`}
      <p class="help" id="k-msg"></p></section>
    ${standalone() ? '' : `<section class="card"><h2>Installer l'application</h2>${installEvt ? '<button class="btn primary" id="s-inst">Installer sur cet appareil</button>' : ''}
      <p class="help"><b>Android (Chrome)</b> : menu ⋮ → « Installer l'application ».<br><b>iPhone / iPad (Safari)</b> : bouton Partager → « Sur l'écran d'accueil ».<br><b>PC (Chrome / Edge)</b> : icône d'installation à droite de la barre d'adresse.</p></section>`}
    <p class="help" style="text-align:center">Facturation · version 1.0</p>`;
    $('#s-head').oninput = debounce((e) => { S.settings.header = e.target.value; DB.kvSet('settings', S.settings); }, 400);
    $('#s-exp').onclick = () => {
      const data = { version: 1, exportedAt: new Date().toISOString(), settings: S.settings, products: S.products, clients: S.clients, invoices: S.invoices };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      a.download = `sauvegarde-facturation-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      toast('Sauvegarde téléchargée.');
    };
    $('#s-imp').onclick = () => $('#s-file').click();
    $('#s-file').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.products) || !Array.isArray(d.clients) || !Array.isArray(d.invoices) || !d.settings) throw new Error('format');
        if (!(await askConfirm(`Remplacer TOUTES les données de cet appareil par cette sauvegarde (${d.invoices.length} document(s), ${d.products.length} produits) ?`, 'Remplacer'))) return;
        for (const s of ['products', 'clients', 'invoices']) { await DB.clear(s); await DB.putMany(s, d[s]); }
        await DB.kvSet('settings', d.settings);
        await DB.kvSet('draft', blankDraft());
        location.reload();
      } catch (err) { toast("Fichier de sauvegarde non valide."); }
    };
    if (FS_OK) {
      getDirs().then((dirs) => { ['fac', 'prix'].forEach((k) => { if (dirs[k]) $('#dir-' + k).value = dirs[k].name; }); });
      ['fac', 'prix'].forEach((k) => { $('#dir-' + k + '-b').onclick = async () => { try { const h = await pickDir(k); $('#dir-' + k).value = h.name; toast('Dossier enregistré.'); } catch (e) { /* annulé */ } }; });
    }
    const kmsg = (t) => { $('#k-msg').textContent = t; };
    const kval = (a, b) => (a.length < 4 ? 'Au moins 4 caractères.' : (b != null && a !== b) ? 'Les deux mots de passe ne correspondent pas.' : '');
    if (S.lock) {
      $('#k-chg').onclick = async () => { const p = $('#k-new').value, e = kval(p); if (e) return kmsg(e); S.lock = await makeLock(p); await DB.kvSet('lock', S.lock); $('#k-new').value = ''; kmsg('Mot de passe modifié.'); };
      $('#k-now').onclick = async () => { S.regOk = false; location.hash = '#/facture'; await showLock(); };
      $('#k-off').onclick = async () => { if (!(await askConfirm('Supprimer le mot de passe ? L\'application s\'ouvrira sans protection.', 'Supprimer'))) return; await DB.kvDel('lock'); S.lock = null; viewReglages(); };
    } else {
      $('#k-on').onclick = async () => { const p = $('#k-new').value, e = kval(p, $('#k-new2').value); if (e) return kmsg(e); S.lock = await makeLock(p); await DB.kvSet('lock', S.lock); S.regOk = true; viewReglages(); toast('Mot de passe activé.'); };
    }
    if (installEvt && $('#s-inst')) $('#s-inst').onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; viewReglages(); };
  }

  /* ---------------- Navigation ---------------- */
  const ROUTES = { facture: viewFacture, factures: viewFactures, detail: viewDetail, produits: viewProduits, clients: viewClients, reglages: viewReglages };
  const TITLES = { facture: 'Nouvelle facture', factures: 'Archives', detail: 'Détail des prix', produits: 'Produits et prix', clients: 'Clients', reglages: 'Réglages' };
  function render() {
    const r = (location.hash.replace('#/', '') || 'facture');
    const route = ROUTES[r] ? r : 'facture';
    closeModal();
    if (route !== 'reglages') S.regOk = false;
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === route));
    $('#title').textContent = TITLES[route];
    ROUTES[route]();
    window.scrollTo(0, 0);
  }

  async function boot() {
    await DB.open();
    S.lock = (await DB.kvGet('lock')) || null;
    if (S.lock) await showLock();
    S.products = await DB.all('products');
    S.clients = await DB.all('clients');
    S.invoices = await DB.all('invoices');
    S.settings = await DB.kvGet('settings');
    if (!S.settings) await seed();
    else if (LEGACY_HEADERS.some((h) => h.replace(/\s+/g, ' ').trim() === String(S.settings.header).replace(/\s+/g, ' ').trim())) { S.settings.header = DEFAULT_HEADER; await DB.kvSet('settings', S.settings); }
    else if (/DAVIE/i.test(S.settings.header || '')) {
      // ancien en-tête par défaut : remplacé par le nouveau (nom GMC SARL, adresse Lomé - Adetikopé)
      const d = window.__SEED || await (await fetch('seed.json')).json();
      S.settings.header = d.header;
      await DB.kvSet('settings', S.settings);
    }
    S.draft = (await DB.kvGet('draft')) || blankDraft();
    S.draft.lines.forEach((l) => { if (l.cost == null) l.cost = ''; if (l.costAuto == null) l.costAuto = true; });
    refreshLists();
    window.addEventListener('hashchange', render);
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot().catch((e) => { $('#view').innerHTML = `<div class="card"><h2>Erreur au démarrage</h2><p>${esc(e && e.message ? e.message : e)}</p><p class="help">Ouvrez l'application depuis une adresse https (GitHub Pages) et non depuis un fichier local.</p></div>`; });
})();

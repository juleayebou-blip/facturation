'use strict';
// Génération des PDF (factures, proformas, détail des prix) avec pdf-lib : texte net, fichiers légers, aucun en-tête de navigateur.
(function (root) {
  const MM = 72 / 25.4;
  const mm = (v) => v * MM;
  const clean = (s) => String(s == null ? '' : s)
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E¡-ÿ]/g, '?');

  async function newDoc(landscape, logoBytes) {
    const L = root.PDFLib;
    const pdf = await L.PDFDocument.create();
    const f = await pdf.embedFont(L.StandardFonts.TimesRoman);
    const fb = await pdf.embedFont(L.StandardFonts.TimesRomanBold);
    let logo = null;
    if (logoBytes) { try { logo = await pdf.embedPng(logoBytes); } catch (e) { logo = null; } }
    const c = { L, pdf, f, fb, logo, W: mm(landscape ? 297 : 210), H: mm(landscape ? 210 : 297), page: null, y: 0, ml: mm(14), mr: mm(14), mt: mm(landscape ? 10 : 12), mb: mm(12) };
    c.cw = c.W - c.ml - c.mr;
    return c;
  }
  const newPage = (c) => { c.page = c.pdf.addPage([c.W, c.H]); c.y = c.mt; };
  const font = (c, bold) => (bold ? c.fb : c.f);
  const tw = (c, s, size, bold) => font(c, bold).widthOfTextAtSize(clean(s), size);

  // texte posé sur sa ligne de base (y mesuré depuis le haut de la page)
  function text(c, s, x, base, size, bold) {
    c.page.drawText(clean(s), { x, y: c.H - base, size, font: font(c, bold), color: c.L.rgb(0, 0, 0) });
  }
  function box(c, x, y, w, h, fill) {
    c.page.drawRectangle({ x, y: c.H - y - h, width: w, height: h, borderWidth: 0.75, borderColor: c.L.rgb(0, 0, 0), color: fill ? c.L.rgb(0.85, 0.85, 0.85) : undefined });
  }
  // case avec texte (plusieurs lignes possibles), alignement l / c / r
  function cell(c, x, y, w, h, s, o) {
    o = o || {};
    box(c, x, y, w, h, o.fill);
    const lines = Array.isArray(s) ? s : [s];
    let size = o.size || 12;
    const pad = mm(1.06);
    if (lines.length === 1) while (size > 6 && tw(c, lines[0], size, o.bold) > w - 2 * pad) size -= 0.5;
    const lh = size * 1.15;
    let base = y + h / 2 - (lines.length * lh) / 2 + size * 0.9;
    lines.forEach((ln) => {
      const t = tw(c, ln, size, o.bold);
      const x0 = o.align === 'l' ? x + pad : o.align === 'r' ? x + w - pad - t : x + (w - t) / 2;
      text(c, ln, x0, base, size, o.bold);
      base += lh;
    });
  }
  function wrap(c, s, width, size, bold) {
    const out = [];
    String(s || '').split('\n').forEach((para) => {
      let line = '';
      para.split(/\s+/).filter(Boolean).forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (line && tw(c, t, size, bold) > width) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }

  // logo + en-tête de la société + ligne pointillée
  function header(c, headerText) {
    const lines = String(headerText || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const lg = mm(20), gap = mm(2.7);
    const tx = c.ml + lg + gap, tWidth = c.W - c.mr - tx;
    const out = [];
    lines.forEach((l, i) => wrap(c, l, tWidth, i === 0 ? 15 : 12, i === 0).forEach((w) => out.push({ t: w, size: i === 0 ? 15 : 12, bold: i === 0 })));
    const lhs = out.map((o) => o.size * 1.3);
    const textH = lhs.reduce((s, v) => s + v, 0);
    const blockH = Math.max(lg, textH);
    if (c.logo) {
      const sc = Math.min(lg / c.logo.width, lg / c.logo.height);
      const w = c.logo.width * sc, h = c.logo.height * sc;
      c.page.drawImage(c.logo, { x: c.ml + (lg - w) / 2, y: c.H - (c.y + (blockH - h) / 2) - h, width: w, height: h });
    }
    let base = c.y + (blockH - textH) / 2;
    out.forEach((o, i) => {
      base += lhs[i];
      const t = tw(c, o.t, o.size, o.bold);
      text(c, o.t, tx + (tWidth - t) / 2, base - o.size * 0.3, o.size, o.bold);
    });
    c.y += blockH + mm(1.3);
    c.page.drawLine({ start: { x: c.ml, y: c.H - c.y }, end: { x: c.W - c.mr, y: c.H - c.y }, thickness: 0.75, color: c.L.rgb(0, 0, 0), dashArray: [3, 3] });
    c.y += mm(2.2);
  }
  function title(c, s) {
    const size = 16;
    c.y += mm(0.8);
    text(c, s, c.ml + (c.cw - tw(c, s, size, true)) / 2, c.y + size * 0.9, size, true);
    c.y += size * 1.15 + mm(1.6);
  }
  function tableHead(c, cols, h, size) {
    let x = c.ml;
    cols.forEach((col) => { cell(c, x, c.y, col.w, h, col.label, { fill: true, bold: true, size }); x += col.w; });
    c.y += h;
  }
  function tableRows(c, cols, rows, h, size, minRows, headH, needAfter) {
    const n = Math.max(minRows, rows.length);
    for (let i = 0; i < n; i++) {
      if (c.y + h > c.H - c.mb) { newPage(c); tableHead(c, cols, headH, size); }
      let x = c.ml;
      cols.forEach((col, k) => {
        const v = rows[i] ? rows[i][k] : '';
        cell(c, x, c.y, col.w, h, v && v.t != null ? v.t : v, { size, align: col.align, bold: v && v.b });
        x += col.w;
      });
      c.y += h;
    }
    if (c.y + needAfter > c.H - c.mb) newPage(c);
  }

  async function invoice(d, logoBytes) {
    const c = await newDoc(false, logoBytes);
    newPage(c);
    header(c, d.header);
    title(c, d.type);
    c.y += mm(1);
    const rh = mm(6.6);
    // N° facture / date
    cell(c, c.ml, c.y, mm(30), rh, 'N° facture', { fill: true, bold: true, size: 11, align: 'l' });
    cell(c, c.ml + mm(30), c.y, mm(52), rh, d.id, { size: 12 });
    cell(c, c.ml, c.y + rh, mm(30), rh, 'Date', { fill: true, bold: true, size: 11, align: 'l' });
    cell(c, c.ml + mm(30), c.y + rh, mm(52), rh, d.date, { size: 12 });
    // client payeur
    const cx = c.W - c.mr - mm(75);
    cell(c, cx, c.y, mm(75), rh, 'CLIENT PAYEUR', { fill: true, bold: true, size: 11 });
    cell(c, cx, c.y + rh, mm(75), mm(13), wrap(c, d.client, mm(73), 12, false).slice(0, 2), { size: 12 });
    c.y += rh + mm(13) + mm(2.1);

    const wd = c.cw - mm(11 + 20 + 25 + 27);
    const cols = [{ w: mm(11), label: 'N°', align: 'c' }, { w: wd, label: 'Désignation', align: 'l' }, { w: mm(20), label: 'Quantité', align: 'c' },
      { w: mm(25), label: ['Prix', 'Unitaire'], align: 'c' }, { w: mm(27), label: 'Montant', align: 'c' }];
    const headH = mm(10.5);
    tableHead(c, cols, headH, 12);
    const rows = d.lines.map((l, i) => [String(i + 1), l.name, l.qty, l.price, l.amount]);
    const wordsLines = d.letters ? wrap(c, d.letters, c.cw, 12, false) : [];
    const footH = mm(19) + mm(7) + wordsLines.length * 12 * 1.2;
    tableRows(c, cols, rows, mm(6.6), 12, 23, headH, footH);

    // cachet + total
    const half = c.cw / 2;
    box(c, c.ml, c.y, half, mm(19));
    text(c, 'Cachet & signature', c.ml + (half - tw(c, 'Cachet & signature', 12, false)) / 2, c.y + mm(1) + 12 * 0.9, 12, false);
    box(c, c.ml + half, c.y, half, mm(7));
    text(c, 'Montant total', c.ml + half + (half - tw(c, 'Montant total', 12, false)) / 2, c.y + mm(7) / 2 + 12 * 0.35, 12, false);
    box(c, c.ml + half, c.y + mm(7), half, mm(12));
    const tt = d.total + ' F CFA';
    text(c, tt, c.ml + half + (half - tw(c, tt, 14, true)) / 2, c.y + mm(7) + mm(12) / 2 + 14 * 0.35, 14, true);
    c.y += mm(19) + mm(7);
    wordsLines.forEach((ln) => { text(c, ln, c.ml + (c.cw - tw(c, ln, 12, false)) / 2, c.y + 12, 12, false); c.y += 12 * 1.2; });
    c.pdf.setTitle(d.type + ' ' + d.id);
    return c.pdf.save();
  }

  async function detail(d, logoBytes) {
    const c = await newDoc(true, logoBytes);
    newPage(c);
    header(c, d.header);
    title(c, 'PRIX UNITAIRE DES MEDICAMENTS');
    c.y += mm(2);
    text(c, 'Client : ' + d.client, c.ml, c.y + 12, 12, true);
    const dt = 'Date : ' + d.date;
    text(c, dt, c.W - c.mr - tw(c, dt, 12, true), c.y + 12, 12, true);
    c.y += 12 * 1.2 + mm(3);
    const fixed = 11 + 36 + 24 + 34 + 36;
    const cols = [{ w: mm(11), label: 'N°', align: 'c' }, { w: c.cw - mm(fixed), label: 'Désignation', align: 'l' }, { w: mm(36), label: 'Conditionnement', align: 'c' },
      { w: mm(24), label: 'Quantité', align: 'c' }, { w: mm(34), label: 'Prix de vente', align: 'c' }, { w: mm(36), label: 'Montant', align: 'c' }];
    const h = mm(6.4);
    tableHead(c, cols, h, 11);
    const rows = d.rows.map((r, i) => [String(i + 1), r.name, r.unit, r.qty, { t: r.price, b: true }, r.amount]);
    tableRows(c, cols, rows, h, 11, 15, h, mm(9));
    const wv = mm(50);
    box(c, c.ml, c.y, c.cw - wv, mm(9));
    text(c, 'Montant total', c.ml + mm(6), c.y + mm(9) / 2 + 14 * 0.35, 14, true);
    box(c, c.ml + c.cw - wv, c.y, wv, mm(9));
    text(c, d.total, c.ml + c.cw - wv + (wv - tw(c, d.total, 14, true)) / 2, c.y + mm(9) / 2 + 14 * 0.35, 14, true);
    c.pdf.setTitle('Prix unitaire des médicaments');
    return c.pdf.save();
  }

  const api = { invoice, detail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PdfGen = api;
})(typeof window !== 'undefined' ? window : globalThis);

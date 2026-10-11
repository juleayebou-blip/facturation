'use strict';
// Fonctions pures (sans accès à la page) : testables avec Node.
(function (root) {
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze',
    'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const TENS = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

  function w99(n) {
    if (n < 20) return U[n];
    if (n < 70) {
      const d = Math.floor(n / 10), u = n % 10;
      return u === 0 ? TENS[d] : TENS[d] + (u === 1 ? ' et un' : '-' + U[u]);
    }
    if (n < 80) { const r = n - 60; return r === 11 ? 'soixante et onze' : 'soixante-' + U[r]; }
    if (n === 80) return 'quatre-vingts';
    return 'quatre-vingt-' + U[n - 80];
  }

  // final = le nombre se termine ici (accord de « cents » et « quatre-vingts »)
  function w999(n, final) {
    const out = [];
    const c = Math.floor(n / 100), r = n % 100;
    if (c > 0) out.push(c === 1 ? 'cent' : U[c] + (r === 0 && final ? ' cents' : ' cent'));
    if (r > 0) out.push(r === 80 && !final ? 'quatre-vingt' : w99(r));
    return out.join(' ');
  }

  function words(value) {
    let n = Math.round(Number(value) || 0);
    if (n === 0) return 'zéro';
    const parts = [];
    const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
    if (mil > 0) parts.push(mil === 1 ? 'un million' : w999(mil % 1000, true) + ' millions');
    if (th > 0) parts.push(th === 1 ? 'mille' : w999(th, false) + ' mille');
    if (rest > 0) parts.push(w999(rest, true));
    return parts.join(' ');
  }

  // N° de facture : 4 chiffres (suite stable et sans doublon) / mois / 2 derniers chiffres de l'année
  function makeNumber(seq, dateISO) {
    const [y, m] = dateISO.split('-');
    return (1000 + ((seq * 7919) % 9000)) + '/' + m + '/' + y.slice(-2);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const money = (n) => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const frDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  const qtyTxt = (q) => String(q).replace('.', ',');

  const lib = { words, makeNumber, esc, num, money, norm, today, frDate, qtyTxt };
  if (typeof module !== 'undefined' && module.exports) module.exports = lib;
  else root.Lib = lib;
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// js/duree.js — repris à l'identique de LEADER ELECTRONIC (public/js/duree.js)
// Durée de formation : nombre en lettres, analyse de la saisie, contrôle de cohérence avec les dates.
// Navigateur : window.LEDuree. Apps Script en contient une copie identique
// (GAS/attestations_manuelles.gs, section DURÉE) : les tests vérifient qu'elles concordent.
// ============================================================
(function (racine) {
  'use strict';

  const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  const DIZAINES = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
  const JOURS_PAR_MOIS = 30.4375;
  const EN_MOIS = { jour: 1 / JOURS_PAR_MOIS, semaine: 7 / JOURS_PAR_MOIS, mois: 1, an: 12 };

  // Nombre en lettres (1 à 99), orthographe traditionnelle : vingt et un, soixante-dix, quatre-vingts
  function lettres(n) {
    if (n < 17) return UNITES[n];
    if (n < 20) return 'dix-' + UNITES[n - 10];
    if (n < 70) {
      const d = Math.floor(n / 10), u = n % 10;
      return DIZAINES[d] + (u === 0 ? '' : u === 1 ? ' et un' : '-' + UNITES[u]);
    }
    if (n < 80) return 'soixante' + (n === 71 ? ' et onze' : '-' + lettres(n - 60));
    if (n === 80) return 'quatre-vingts';
    return 'quatre-vingt-' + lettres(n - 80);
  }

  // Comparaison tolérante aux variantes d'écriture (traits d'union, « et », vingt/vingts, majuscules)
  const forme = s => String(s).toLowerCase().normalize('NFC').replace(/[\s-]+et[\s-]+/g, ' ')
    .replace(/vingts/g, 'vingt').replace(/[\s-]+/g, '');

  const pad = n => (n < 10 ? '0' : '') + n;
  function segment(n, unite, une) {
    const mot = n === 1 && une ? 'une' : lettres(n);
    const u = unite === 'mois' ? 'mois' : unite + (n > 1 ? 's' : '');
    return mot + ' (' + pad(n) + ') ' + u;
  }

  // « un (01) an et six (06) mois » -> { ok, mois, texte (forme canonique) } ou { ok: false, message }
  const SEG = /^\s*(?:et\s+)?([a-zà-ÿœ' -]+?)\s*\((\d{1,2})\)\s*(jours?|semaines?|mois|ans?)\b\s*/i;
  function analyser(saisie) {
    let reste = String(saisie || '').trim();
    if (!reste) return { ok: false, message: 'Durée obligatoire.' };
    const parties = [];
    let mois = 0;
    while (reste) {
      const m = SEG.exec(reste);
      if (!m) return { ok: false, message: 'Durée : écrivez « nombre en lettres (chiffres) unité », par exemple « trois (03) ans » ou « six (06) mois ».' };
      const mot = m[1].trim(), n = Number(m[2]), brut = m[3].toLowerCase();
      const unite = brut.startsWith('an') ? 'an' : brut.startsWith('semaine') ? 'semaine' : brut.startsWith('jour') ? 'jour' : 'mois';
      if (n < 1) return { ok: false, message: 'Durée : le nombre doit être au moins 1.' };
      const une = n === 1 && forme(mot) === 'une';
      if (!une && forme(mot) !== forme(lettres(n))) {
        return { ok: false, message: 'Durée : « ' + mot + ' » ne correspond pas à ' + pad(n) + ' (il faut « ' + lettres(n) + ' »).' };
      }
      parties.push(segment(n, unite, une));
      mois += n * EN_MOIS[unite];
      reste = reste.slice(m[0].length);
    }
    return { ok: true, mois, texte: parties.join(' et ') };
  }

  function joursEntre(debut, fin) {
    return Math.round((Date.parse(fin + 'T12:00:00Z') - Date.parse(debut + 'T12:00:00Z')) / 86400000);
  }

  // Durée proposée à partir des dates : années pleines, puis mois ; semaines sous un mois
  function suggerer(debut, fin) {
    const jours = joursEntre(debut, fin);
    if (!(jours > 0)) return '';
    const mois = Math.round(jours / JOURS_PAR_MOIS);
    if (mois < 1) return segment(Math.max(1, Math.round(jours / 7)), 'semaine');
    const a = Math.floor(mois / 12), m = mois % 12;
    return [a ? segment(a, 'an') : '', m ? segment(m, 'mois') : ''].filter(Boolean).join(' et ');
  }

  // Contrôle final : saisie valide ET cohérente avec les dates (tolérance : 10 %, au moins 15 jours)
  function controler(saisie, debut, fin) {
    const a = analyser(saisie);
    if (!a.ok) return a;
    const reel = joursEntre(debut, fin) / JOURS_PAR_MOIS;
    if (Math.abs(a.mois - reel) > Math.max(0.5, reel * 0.1)) {
      return { ok: false, message: 'Durée incohérente : « ' + a.texte + ' » alors que les dates couvrent environ ' +
        (reel >= 12 ? (reel / 12).toFixed(1).replace('.', ',') + ' an(s)' : Math.round(reel) + ' mois') +
        '. Proposition : « ' + suggerer(debut, fin) + ' ».' };
    }
    return a;
  }

  const api = { lettres, analyser, suggerer, controler };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.LEDuree = api;
})(typeof window !== 'undefined' ? window : this);

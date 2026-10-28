/* ==================================================================
   js/traduction-documents.js — documents traduits dans la langue du site

   Les documents (attestation, carte, fiche, badge, documents de travail)
   sont dessinés sur un canvas : la traduction Google du site ne les voit
   pas. Ce module les traduit automatiquement quand le site n'est pas en
   français (cookie "googtrans" de js/traduction.js) :

   1. Passe de COLLECTE : le générateur dessine une première fois ; chaque
      texte passé à measureText / fillText est relevé (les paragraphes
      entiers via TradDoc.bloc dans les fonctions de mise en page).
   2. Traduction par le serveur (GAS traduction_documents.gs, LanguageApp)
      — noms, numéros et raison sociale protégés (non traduits).
   3. Passe de RENDU : le générateur redessine ; measureText et fillText
      reçoivent le texte traduit, donc centrages et retours à la ligne
      s'adaptent à la longueur réelle de la traduction.
   4. Bandeau « Traduction automatique — seul l'original en français fait
      foi ». L'original reste disponible (bouton dans la fenêtre).

   Jamais chargé dans l'admin : les documents délivrés et archivés par le
   centre restent en français.
================================================================== */
(function () {
  'use strict';
  const GAS_DEFAUT = 'https://script.google.com/macros/s/AKfycbxqsoRAJXxa1nSE0wSy_NhYq-j8kdFYrAqfJuz3zW-jtIVk7hXkC1Bx7rgyrdC3wYHf/exec';
  const NOMS_LANGUES = { en: 'English', es: 'Español', pt: 'Português', de: 'Deutsch', ar: 'العربية', 'zh-CN': '中文', ee: 'Eʋegbe' };
  const BANDEAU_FR = 'Traduction automatique non officielle — seul l\'original en français fait foi.';
  const CIVILITES = /\b(Monsieur|Madame|Mademoiselle|M\.|Mme\.?|Mlle\.?)\s*/g;
  const memoire = new Map();   // langue|texte -> traduction (durée de la page)

  const TD = {
    mode: null, pause: 0, dict: new Map(), collecte: new Set(), proteges: [], forcerFrancais: false, dernier: null,

    langue() {
      const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]*\/([^;]+)/);
      const code = m ? decodeURIComponent(m[1]) : 'fr';
      return NOMS_LANGUES[code] ? code : 'fr';
    },
    nomLangue(code) { return NOMS_LANGUES[code || this.langue()] || 'Français'; },
    actif() { return this.langue() !== 'fr' && !this.forcerFrancais; },

    // Texte à traduire ? (lettres, pas une adresse, un identifiant ni un nom protégé seul)
    eligible(s) {
      if (typeof s !== 'string') return false;
      const t = s.trim();
      if (t.length < 2 || !/\p{L}{2,}/u.test(t)) return false;
      // Adresse web ou e-mail SEULS : jamais traduits (dans une phrase, ils sont protégés)
      if (/^(https?:\/\/|www\.)\S+$/i.test(t) || /^\S+@\S+\.\S+$/.test(t) || /^[\w.-]+\.(com|bj|org|net)(\/\S*)?$/i.test(t)) return false;
      if (/^[A-Z]{2,6}-[0-9A-Z-]+$/.test(t) || /^\d{4}\/[A-Z]+\/\d{4}$/.test(t)) return false;
      let reste = t.replace(CIVILITES, ' ');
      this.proteges.forEach(p => { reste = reste.split(p).join(' '); reste = reste.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '); });
      return /\p{L}{2,}/u.test(reste.replace(/[★✦•·—–\-|,.;:()]/g, ' '));
    },

    // Point d'entrée de chaque texte dessiné ou mesuré
    t(s) {
      if (!this.mode || this.pause > 0 || !this.eligible(s)) return s;
      if (this.mode === 'collecte') { this.collecte.add(s); return s; }
      const r = this.dict.get(s);
      return r == null ? s : r;
    },
    // Paragraphe mis en page mot à mot : traduit en entier, puis fragments laissés tels quels
    bloc(s, fn) {
      const tt = this.t(s);
      this.pause++;
      try { return fn(tt); } finally { this.pause--; }
    },
    sansTraduction(fn) {
      this.pause++;
      try { return fn(); } finally { this.pause--; }
    },

    // Noms, numéros, raison sociale : jamais traduits
    definirProteges(source) {
      const o = source || {};
      const fixes = ['LES QUALITÉS DE DIEU SERVICE SARL', 'LES QUALITÉS DE DIEU SERVICE', 'Les Qualités de Dieu Service', 'LQD Service', 'LQD',
        'SARL', 'STÉ', 'ATO Blaise', 'TOSSOU C. Philippe', 'https://www.qualitededieuservice.com/verifier', 'www.qualitededieuservice.com',
        'qualitededieuservice.com', 'Comé', 'Hongodé', 'Apehvedji', 'RCCM', 'IFU'];
      const ent = typeof ATT_ENTREPRISE !== 'undefined' ? ATT_ENTREPRISE : {};
      const liste = fixes.concat([ent.EMAIL, ent.TEL, ent.RCCM, ent.IFU, ent.SITE, o.id, o.ref, o.numero, o.code, o.codeVerification,
        o.email, o.telephone, o.nom, o.prenom, o.prenoms, o.lieuNaissance, o.lieu,
        o.nom && (o.prenom || o.prenoms) ? String(o.nom).toUpperCase() + ' ' + (o.prenom || o.prenoms) : '']);
      String((o.prenom || o.prenoms || '')).split(/\s+/).forEach(p => liste.push(p));
      this.proteges = liste.map(x => String(x == null ? '' : x).trim()).filter(x => x.length >= 2)
        .filter((x, i, t) => t.indexOf(x) === i).sort((a, b) => b.length - a.length);
    },
    // HTML envoyé au traducteur : parties protégées en <span translate="no">
    versHtml(s) {
      const esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let html = esc(s);
      if (this.proteges.length) {
        const re = new RegExp('(' + this.proteges.map(p => esc(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
        html = html.replace(re, '<span class="notranslate" translate="no">$1</span>');
      }
      return html;
    },
    depuisHtml(html) {
      const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    },

    async traduire(textes, jeton) {
      const langue = this.langue(), url = (typeof GAS_WEBAPP_URL !== 'undefined' && GAS_WEBAPP_URL) || GAS_DEFAUT;
      const manquants = textes.filter(t => !memoire.has(langue + '|' + t));
      // Lots compatibles avec les limites du serveur (200 textes, 40 000 caractères)
      const lots = []; let lot = [], taille = 0;
      manquants.forEach(t => {
        const h = this.versHtml(t);
        if (lot.length >= 150 || taille + h.length > 35000) { lots.push(lot); lot = []; taille = 0; }
        lot.push({ t, h }); taille += h.length;
      });
      if (lot.length) lots.push(lot);
      for (const l of lots) {
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'traduire_textes', token: jeton, langue: langue, textes: l.map(x => x.h) }) });
        const r = await resp.json();
        if (r.status !== 'success') throw new Error(r.message || 'Traduction indisponible.');
        // Espaces de début et de fin conservés : « du » + date en gras + « au » restent séparés
        l.forEach((x, i) => {
          const debut = (x.t.match(/^\s*/) || [''])[0], fin = (x.t.match(/\s*$/) || [''])[0];
          memoire.set(langue + '|' + x.t, debut + this.depuisHtml(r.traductions[i] || x.h) + fin);
        });
      }
      const dict = new Map();
      textes.forEach(t => dict.set(t, memoire.get(langue + '|' + t)));
      return dict;
    },

    // Deux passes autour d'un générateur ; repli sur l'original si la traduction échoue
    async generer(orig, args, jeton) {
      if (!this.actif()) return orig.apply(null, args);
      this.definirProteges(args[0]);
      this.mode = 'collecte'; this.collecte = new Set(); this.pause = 0;
      try { await orig.apply(null, args); } finally { this.mode = null; }
      this.collecte.add(BANDEAU_FR);
      try {
        this.dict = await this.traduire(Array.from(this.collecte), jeton);
      } catch (e) {
        console.warn('[TradDoc] traduction impossible, document en français :', e.message);
        this.erreur = e.message;
        return orig.apply(null, args);
      }
      this.erreur = '';
      this.mode = 'traduction';
      let res;
      try { res = await orig.apply(null, args); } finally { this.mode = null; }
      if (res && res.getContext) this.bandeau(res);
      return res;
    },

    bandeau(canvas) {
      const ctx = canvas.getContext('2d'), W = canvas.width;
      const h = Math.max(28, Math.round(Math.max(W, canvas.height) * 0.016));
      const texte = (this.dict.get(BANDEAU_FR) || BANDEAU_FR) + '   |   ' + BANDEAU_FR;
      ctx.save();
      ctx.fillStyle = 'rgba(160, 30, 30, 0.92)';
      ctx.fillRect(0, 0, W, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + Math.round(h * 0.5) + 'px "DM Sans", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      this.sansTraduction(() => ctx.fillText(texte, W / 2, h / 2, W * 0.97));
      ctx.restore();
    },

    // Barre au-dessus de l'aperçu : langue du document + bascule vers l'original
    barre(previewId) {
      const preview = document.getElementById(previewId);
      if (!preview || this.langue() === 'fr') return;
      const id = 'td-barre-' + previewId;
      let b = document.getElementById(id);
      if (!b) {
        b = document.createElement('div'); b.id = id;
        b.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between;padding:10px 12px;margin-bottom:10px;border-radius:10px;background:#FFF6E5;border:1px solid #FDE8BB;color:#7A4A00;font-size:13px;';
        preview.parentNode.insertBefore(b, preview);
      }
      const traduit = !this.forcerFrancais;
      b.innerHTML = '<span>' + (traduit
        ? (this.erreur ? 'Traduction indisponible pour le moment : document affiché en français.' : 'Document traduit automatiquement (' + this.nomLangue() + '). Seul l\'original en français fait foi.')
        : 'Original en français (document officiel).') + '</span>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'border:1.5px solid #B7791F;background:#fff;color:#7A4A00;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;';
      btn.textContent = traduit ? 'Voir l\'original en français' : 'Voir la traduction (' + this.nomLangue() + ')';
      btn.onclick = () => this.basculer();
      if (!(traduit && this.erreur)) b.appendChild(btn);
    },
    basculer() {
      this.forcerFrancais = !this.forcerFrancais;
      if (this.dernier) this.dernier.fn.apply(null, this.dernier.args);
    }
  };

  // Chaque contexte 2D passe ses textes par TradDoc (aucun effet hors génération).
  const getContextOrig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    const ctx = getContextOrig.call(this, type, opts);
    if (type !== '2d' || !ctx || ctx.__tradDoc) return ctx;
    ctx.__tradDoc = true;
    const mesurer = ctx.measureText, remplir = ctx.fillText, contour = ctx.strokeText;
    ctx.measureText = function (s) { return mesurer.call(this, TD.t(s)); };
    const dessiner = (orig) => function (s, x, y, mw) {
      const tt = TD.t(s);
      // Texte traduit plus long : resserré pour ne jamais sortir de la page
      if (TD.mode === 'traduction' && tt !== s && mw === undefined) {
        const W = this.canvas.width, w = mesurer.call(this, tt).width, a = this.textAlign;
        const dispo = a === 'center' ? 2 * Math.min(x, W - x) * 0.97 : (a === 'right' || a === 'end' ? x - W * 0.03 : W * 0.97 - x);
        if (w > dispo && dispo > 20) return orig.call(this, tt, x, y, dispo);
      }
      return mw === undefined ? orig.call(this, tt, x, y) : orig.call(this, tt, x, y, mw);
    };
    ctx.fillText = dessiner(remplir);
    if (contour) ctx.strokeText = dessiner(contour);
    return ctx;
  };

  function jetonFormateur() {
    try { return (JSON.parse(sessionStorage.getItem('lqd_formateur') || 'null') || {}).token || ''; } catch (e) { return ''; }
  }

  // Générateurs : traduits automatiquement quand le site n'est pas en français
  function envelopper() {
    const gen = { genererAttestationCanvas: a => a[1], genererCarteCanvas: a => a[1], genererCarteVersoCanvas: a => a[1],
      genererFicheApprenant: a => a[1], genererBadgeCertification: a => a[1], genererDocumentTravailCanvas: () => jetonFormateur() };
    Object.keys(gen).forEach(nom => {
      const orig = window[nom];
      if (typeof orig !== 'function' || orig.__tradDoc) return;
      const f = function () { const args = Array.prototype.slice.call(arguments); return TD.generer(orig, args, gen[nom](args)); };
      f.__tradDoc = true;
      window[nom] = f;
    });
    // Fenêtres d'aperçu : barre de langue + bascule original / traduction
    const aff = { afficherAttestationCanvas: 'attestation-preview', afficherCarteCanvas: 'carte-preview',
      afficherFicheApprenant: 'fiche-preview', afficherBadgeCertification: 'badge-preview' };
    Object.keys(aff).forEach(nom => {
      const orig = window[nom];
      if (typeof orig !== 'function' || orig.__tradDoc) return;
      const f = async function () {
        const args = Array.prototype.slice.call(arguments);
        TD.dernier = { fn: f, args: args };
        const r = await orig.apply(null, args);
        TD.barre(aff[nom]);
        return r;
      };
      f.__tradDoc = true;
      window[nom] = f;
    });
  }

  window.TradDoc = TD;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', envelopper);
  else envelopper();
})();

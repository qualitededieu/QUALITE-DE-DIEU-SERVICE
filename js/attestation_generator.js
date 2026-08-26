"use strict";

/* ============================================================
   ATTESTATION DE FIN DE FORMATION — LES QUALITÉS DE DIEU SERVICE
   Génération canvas 100% côté client — aucune dépendance serveur
   autre que GAS (déjà utilisé pour retrouver le dossier apprenant).
   Format : A4 Paysage — 3508 x 2480 px @ 300 DPI
   ============================================================ */

const ATT = {
  MARINE:   "#04342C",   // teal-900 (identité LQD)
  MARINE_2: "#0F6E56",   // teal-700
  OR:       "#F5A623",   // orange-500
  OR_LIGHT: "#FABD50",   // orange-400
  BLANC:    "#FFFFFF",
  CREME:    "#F8F7F2",
  GRIS:     "#6B7280",
  TEXTE:    "#1A1A2E",
  W: 3508,
  H: 2480,
};

// Signataires — l'attestation LQD Service porte toujours deux
// signatures/cachets : le Formateur à gauche, le PDG à droite.
// Si .nom reste vide, seul le titre est affiché (cas du Formateur,
// dont le nom varie selon la session — à renseigner au cas par cas
// si besoin).
const ATT_SIGNATAIRE_FORMATEUR = { nom: "M. TOSSOU C. Philippe", titre: "Le Formateur" };
const ATT_SIGNATAIRE_PDG       = { nom: "M. ATO Blaise", titre: "Président Directeur Général" };

const ATT_ENTREPRISE = {
  NOM:      "LES QUALITÉS DE DIEU SERVICE",
  SUFFIXE:  "SARL — Centre de formation professionnelle",
  ADRESSE:  "Comé, Hongodé — en face Hôpital de Zone de Comé, Bénin",
  TEL:      "+229 01 97 95 12 30",
  EMAIL:    "contact@lqdservice.bj",
  SITE:     "qualitededieu.vercel.app",
  LOGO_URL: "icons/logoqds.jpg",
};

// ─── Descriptions par filière (clés = valeurs exactes CONFIG.FORMATIONS_VALIDES) ───
const ATT_DESCRIPTIONS = {
  "Informatique & Bureautique": "Maîtrise des outils bureautiques (Word, Excel, PowerPoint), gestion de base de l'outil informatique, saisie et mise en forme de documents professionnels, navigation Internet.",
  "Graphisme & PAO":            "Publication assistée par ordinateur, conception d'affiches et de supports visuels, maîtrise des logiciels professionnels (Photoshop, Illustrator, CorelDRAW, Canva Pro).",
  "Sérigraphie":                "Techniques d'impression sur tout support (tissu, enseignes, objets promotionnels), préparation des écrans, gestion des couleurs et finitions.",
  "Création de sites web":      "Conception et publication de sites internet, bases HTML/CSS, gestion de contenu avec WordPress et Wix, mise en ligne et hébergement.",
};

function _attDescription(filiere) {
  const f = String(filiere || "");
  if (ATT_DESCRIPTIONS[f]) return ATT_DESCRIPTIONS[f];
  // Dossier multi-formations ("A, B") ou libellé partiel : recherche par inclusion
  const cle = Object.keys(ATT_DESCRIPTIONS).find(k => f.includes(k) || k.includes(f));
  if (cle) return ATT_DESCRIPTIONS[cle];
  return "Formation professionnelle qualifiante dispensée par le centre.";
}

// ─── Description de stage à partir des missions cochées en admin ───
// Construit une phrase française correcte à partir d'une liste de
// fragments (déjà rédigés pour s'enchaîner naturellement après
// "notamment"), avec "et" avant le dernier élément plutôt qu'une
// simple virgule. Retombe sur la phrase générique si la liste est
// vide (dossier créé avant l'ajout de cette fonctionnalité, ou aucune
// mission cochée).
function _joindreListeFr(items) {
  if (!items || items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " et " + items[items.length - 1];
}

function _attDescriptionStage(missionsStage) {
  const missions = Array.isArray(missionsStage) ? missionsStage.filter(Boolean) : [];
  if (missions.length === 0) {
    return "Stage effectué avec sérieux et professionnalisme au sein de notre structure.";
  }
  return "Stage effectué avec sérieux et professionnalisme, portant notamment sur " +
    _joindreListeFr(missions) + ".";
}

// ─── Utilitaires canvas ─────────────────────────────────────
function _font(ctx, size, style = "normal", family = "Times New Roman") {
  ctx.font = `${style} ${size}px '${family}', Times, serif`;
}
function _mw(ctx, txt) { return ctx.measureText(txt).width; }
function _rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function _roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
function _clipRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
}
function _drawImageCover(ctx, img, x, y, w, h, topBias = 0.5) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) { sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) * topBias; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function _loadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function _wrapCentre(ctx, txt, cy, maxW, lh) {
  const words = String(txt).split(" ");
  let line = "", lignes = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (_mw(ctx, test) > maxW && line) { lignes.push(line); line = w; }
    else line = test;
  }
  if (line) lignes.push(line);
  let y = cy;
  lignes.forEach(l => { ctx.fillText(l, (ATT.W - _mw(ctx, l)) / 2, y); y += lh; });
  return y;
}
function _wrap(ctx, txt, x, y, maxW, lh) {
  const words = String(txt).split(" ");
  let line = "", curY = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (_mw(ctx, test) > maxW && line) { ctx.fillText(line, x, curY); curY += lh; line = w; }
    else line = test;
  }
  if (line) { ctx.fillText(line, x, curY); curY += lh; }
  return curY;
}

// ─── Police calligraphique pour l'intitulé de formation ──────
let _policeScriptChargee = false;
async function _chargerPoliceScript() {
  if (_policeScriptChargee) return;
  try {
    const face = new FontFace(
      "Great Vibes",
      "url(https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2) format('woff2')"
    );
    const loaded = await face.load();
    document.fonts.add(loaded);
    await document.fonts.load("120px 'Great Vibes'");
    _policeScriptChargee = true;
  } catch (e) {
    console.warn("[ATT] Police script non chargée :", e.message);
  }
}

// ─── GÉNÉRATEUR PRINCIPAL ──────────────────────────────────────
// apprenant : { id, prenom, nom, sexe, dateNaissance, filiere, dateEntree, dateFin, photoUrl, email }
// token     : token carte HMAC déjà obtenu (sert au QR de vérification)
async function genererAttestationCanvas(apprenant, token) {
  await _chargerPoliceScript();

  // Deux origines possibles pour cette attestation : un apprenant qui a
  // suivi une formation (source par défaut, cartes.gs), ou un candidat
  // qui a effectué un stage via la page Postuler (source explicite
  // "candidature-stage", voir GAS/candidatures.gs). Le texte s'adapte.
  const estStage = apprenant.source === "candidature-stage";

  const canvas = document.createElement("canvas");
  canvas.width  = ATT.W;
  canvas.height = ATT.H;
  const ctx = canvas.getContext("2d");

  const dateAujourdhui = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const fmt = (d) => {
    if (!d) return dateAujourdhui;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  };
  const dateDebut = fmt(apprenant.dateEntree);
  const dateFin   = fmt(apprenant.dateFin);

  const lienVerif = token
    ? `https://${ATT_ENTREPRISE.SITE}/verifier.html?t=${encodeURIComponent(token)}`
    : `https://${ATT_ENTREPRISE.SITE}/verifier.html`;
  const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=2&data=" + encodeURIComponent(lienVerif);

  const [logo, qr, photo, sigFormateur, sigPdg, cachet] = await Promise.all([
    _loadImg(ATT_ENTREPRISE.LOGO_URL),
    _loadImg(QR_URL),
    _loadImg(apprenant.photoUrl),
    _loadImg(typeof SIGNATURE_FORMATEUR_DATA !== "undefined" ? SIGNATURE_FORMATEUR_DATA : "icons/signature-formateur.png"),
    _loadImg(typeof SIGNATURE_PDG_DATA       !== "undefined" ? SIGNATURE_PDG_DATA       : "icons/signature-pdg.png"),
    _loadImg(typeof CACHET_DATA              !== "undefined" ? CACHET_DATA              : "icons/cachet.png"), // cachet officiel, partagé par les deux signatures
  ]);

  // ── FOND ──
  _rect(ctx, 0, 0, ATT.W, ATT.H, ATT.CREME);
  _rect(ctx, 0, 0, 18, ATT.H, ATT.OR);
  _rect(ctx, ATT.W - 18, 0, 18, ATT.H, ATT.OR);

  ctx.save();
  ctx.strokeStyle = ATT.OR; ctx.lineWidth = 10;
  const C = 90;
  [[18, C, 18, 18, C, 18],
   [ATT.W - 18, C, ATT.W - 18, 18, ATT.W - C, 18],
   [18, ATT.H - C, 18, ATT.H - 18, C, ATT.H - 18],
   [ATT.W - 18, ATT.H - C, ATT.W - 18, ATT.H - 18, ATT.W - C, ATT.H - 18]]
    .forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
    });
  ctx.restore();

  // ── HEADER ──
  const HDR_H = 402;
  _rect(ctx, 0, 0, ATT.W, HDR_H, ATT.MARINE);
  _rect(ctx, 0, HDR_H, ATT.W, 14, ATT.OR);

  ctx.save();
  ctx.beginPath(); ctx.arc(213, 191, 155, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill();
  ctx.restore();
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(213, 191, 140, 0, Math.PI * 2); ctx.clip();
    _drawImageCover(ctx, logo, 73, 51, 280, 280);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(213, 191, 142, 0, Math.PI * 2);
    ctx.strokeStyle = ATT.OR; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
  }

  _font(ctx, 94, "bold");
  ctx.fillStyle = ATT.BLANC;
  ctx.fillText(ATT_ENTREPRISE.NOM, 406, 158);

  _font(ctx, 40, "normal", "DM Sans");
  ctx.fillStyle = ATT.OR_LIGHT;
  ctx.fillText(ATT_ENTREPRISE.SUFFIXE, 406, 224);

  _font(ctx, 32, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(ATT_ENTREPRISE.ADRESSE, 406, 270);

  _rect(ctx, 2510, 42, 3, 318, "rgba(245,166,35,0.4)");

  const LG_X = 2540;
  const infos = [
    { txt: ATT_ENTREPRISE.TEL,   bold: true,  color: ATT.BLANC },
    { txt: ATT_ENTREPRISE.EMAIL, bold: false, color: "rgba(255,255,255,0.75)" },
    { txt: "www." + ATT_ENTREPRISE.SITE, bold: false, color: "rgba(255,255,255,0.55)" },
    { txt: "République du Bénin", bold: false, color: ATT.OR },
  ];
  infos.forEach((info, i) => {
    _font(ctx, 36, info.bold ? "bold" : "normal", "DM Sans");
    ctx.fillStyle = info.color;
    ctx.fillText(info.txt, LG_X, 130 + i * 56);
  });

  // ── PHOTO IDENTITÉ ──
  const PHOTO_W = 413, PHOTO_H = 531;
  const PHOTO_X = ATT.W - 240 - PHOTO_W;
  const PHOTO_Y = HDR_H + 68;

  _roundRect(ctx, PHOTO_X - 8, PHOTO_Y - 8, PHOTO_W + 16, PHOTO_H + 16, 16, ATT.OR);
  _roundRect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 10, ATT.BLANC);

  if (photo) {
    ctx.save();
    _clipRoundRect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 10);
    _drawImageCover(ctx, photo, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 0.12);
    ctx.restore();
  } else {
    _rect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, "#EDE7DA");
    ctx.save();
    ctx.fillStyle = "rgba(107,114,128,0.35)";
    ctx.beginPath(); ctx.arc(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H * 0.38, 46, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H * 0.95, 90, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  if (cachet) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    const C2_W = 236, C2_X = PHOTO_X - 65, C2_Y = PHOTO_Y + PHOTO_H - 160;
    ctx.drawImage(cachet, C2_X, C2_Y, C2_W, C2_W);
    ctx.restore();
  }

  _font(ctx, 22, "normal", "DM Sans");
  ctx.fillStyle = ATT.GRIS;
  const lblPhoto = "Photo d'identité";
  ctx.fillText(lblPhoto, PHOTO_X + (PHOTO_W - _mw(ctx, lblPhoto)) / 2, PHOTO_Y + PHOTO_H + 40);

  // ── FILIGRANE ──
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.beginPath(); ctx.arc(ATT.W / 2, 1300, 560, 0, Math.PI * 2); ctx.clip();
    _drawImageCover(ctx, logo, ATT.W / 2 - 560, 740, 1120, 1120);
    ctx.restore();
  }

  // ── TITRE ──
  const TITRE_Y = HDR_H + 14;
  _rect(ctx, 240, TITRE_Y + 60, 610, 7, ATT.OR);
  _rect(ctx, ATT.W - 850, TITRE_Y + 60, 150, 7, ATT.OR);

  _font(ctx, 220, "bold");
  ctx.fillStyle = ATT.MARINE;
  const attW = _mw(ctx, "ATTESTATION");
  ctx.fillText("ATTESTATION", (ATT.W - attW) / 2, TITRE_Y + 240);

  _font(ctx, 72, "normal");
  ctx.fillStyle = ATT.OR;
  const stW = _mw(ctx, "DE FIN DE STAGE / FORMATION");
  ctx.fillText("DE FIN DE STAGE / FORMATION", (ATT.W - stW) / 2, TITRE_Y + 328);

  _rect(ctx, 240, TITRE_Y + 358, 1376, 7, ATT.OR);
  _font(ctx, 64, "normal");
  ctx.fillStyle = ATT.OR;
  ctx.fillText("✦", (ATT.W - _mw(ctx, "✦")) / 2, TITRE_Y + 376);
  _rect(ctx, 1892, TITRE_Y + 358, 920, 7, ATT.OR);

  // ── CORPS ──
  const CX = 240, CW = ATT.W - 480;
  let posY = TITRE_Y + 410;

  _font(ctx, 46, "normal");
  const intro1 = "Nous soussignés, ";
  const intro2 = ATT_ENTREPRISE.NOM;
  const intro3 = estStage
    ? ", attestons que :"
    : ", centre de formation professionnelle, attestons que :";
  ctx.fillStyle = ATT.TEXTE;
  ctx.fillText(intro1, CX, posY);
  let ix = CX + _mw(ctx, intro1);
  _font(ctx, 40, "bold");
  ctx.fillStyle = ATT.MARINE;
  ctx.fillText(intro2, ix, posY);
  ix += _mw(ctx, intro2);
  _font(ctx, 46, "normal");
  ctx.fillStyle = ATT.TEXTE;
  ctx.fillText(intro3, ix, posY);
  posY += 80;

  const civilite   = apprenant.sexe === "F" ? "Mme. " : (apprenant.sexe === "M" ? "M. " : "");
  const nomComplet = `${civilite}${(apprenant.prenom || "").toUpperCase()} ${(apprenant.nom || "").toUpperCase()}`;
  const BANNER_CX  = 1512.5;
  _roundRect(ctx, 210, posY - 52, 2605, 158, 24, ATT.MARINE);
  _font(ctx, 90, "bold");
  ctx.fillStyle = ATT.OR_LIGHT;
  ctx.fillText(nomComplet, BANNER_CX - _mw(ctx, nomComplet) / 2, posY + 56);
  posY += 190;

  _font(ctx, 46, "normal");
  ctx.fillStyle = ATT.TEXTE;
  ctx.fillText(
    estStage
      ? "a effectué avec assiduité un stage professionnel dans le domaine de :"
      : "a suivi avec assiduité et a validé la formation en :",
    CX, posY
  );
  posY += 72;

  const intitule = apprenant.filiere || (estStage ? "Stage professionnel" : "Formation professionnelle");
  ctx.font = document.fonts.check("120px 'Great Vibes'")
    ? "120px 'Great Vibes'"
    : "italic bold 90px 'Times New Roman', Times, serif";
  ctx.fillStyle = ATT.MARINE;
  {
    const iW = _mw(ctx, intitule);
    ctx.fillText(intitule, (ATT.W - iW) / 2, posY + 20);
    posY += 40;
    _rect(ctx, (ATT.W - iW) / 2 - 40, posY + 12, iW + 80, 6, ATT.OR);
    posY += 65;
  }

  _font(ctx, 33, "italic");
  ctx.fillStyle = ATT.GRIS;
  const descriptionTexte = estStage
    ? _attDescriptionStage(apprenant.missionsStage)
    : _attDescription(apprenant.filiere);
  posY = _wrapCentre(ctx, descriptionTexte, posY, CW - 120, 42) + 14;

  _font(ctx, 46, "normal");
  const p1 = "durant la période du  ", p2 = dateDebut, p3 = "  au  ", p4 = dateFin;
  let cx = CX;
  ctx.fillStyle = ATT.TEXTE; ctx.fillText(p1, cx, posY); cx += _mw(ctx, p1);
  _font(ctx, 46, "bold"); ctx.fillStyle = ATT.MARINE; ctx.fillText(p2, cx, posY); cx += _mw(ctx, p2);
  _font(ctx, 46, "normal"); ctx.fillStyle = ATT.TEXTE; ctx.fillText(p3, cx, posY); cx += _mw(ctx, p3);
  _font(ctx, 46, "bold"); ctx.fillStyle = ATT.MARINE; ctx.fillText(p4, cx, posY);
  posY += 64;

  _font(ctx, 42, "normal");
  ctx.fillStyle = ATT.TEXTE;
  posY = _wrap(ctx, estStage
    ? "Ce stage lui a permis d'acquérir une expérience pratique et professionnelle au sein de notre structure."
    : "Cette formation lui a permis d'acquérir des compétences pratiques et professionnelles dans le domaine concerné.",
    CX, posY, CW, 52);
  posY = _wrap(ctx, "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", CX, posY, CW, 52);

  posY += 20;

  // ── RUBAN D'APPRÉCIATION — suit désormais le flux dynamique du texte
  // (posY), juste après "Fait à Comé". FIX : l'ancienne version le
  // plaçait à une position FIXE (1500px) calculée en supposant une
  // description courte sur une seule ligne — dès que le corps du texte
  // (description + 2 phrases de clôture) dépassait cette estimation,
  // le ruban se dessinait PAR-DESSUS le texte au lieu d'en dessous
  // (chevauchement visible sur l'attestation de stage de test). En le
  // faisant suivre posY, il ne peut plus jamais chevaucher ce qui est
  // au-dessus, quelle que soit la longueur réelle du texte.
  _font(ctx, 32, "italic");
  ctx.fillStyle = ATT.OR;
  const ruban = estStage
    ? "✦  STAGE VALIDÉ — Assiduité et sérieux reconnus par le centre  ✦"
    : "✦  FORMATION VALIDÉE — Assiduité et sérieux reconnus par le centre  ✦";
  ctx.fillText(ruban, (ATT.W - _mw(ctx, ruban)) / 2, posY);
  posY += 46;

  // ── DEUX SIGNATURES — Formateur à gauche, PDG à droite ──
  // SIG_Y suit lui aussi posY (avec un plancher à 1560 pour ne pas
  // remonter inutilement sur un document court, et un plafond à 1700
  // pour ne jamais empiéter sur le pied de page même dans le pire des
  // cas) — même principe que le ruban ci-dessus.
  const SIG_Y = Math.min(Math.max(1560, posY + 30), 1700);

  // Bloc réutilisable, translaté horizontalement (ancrage = bord gauche
  // de la ligne pointillée) pour dupliquer exactement la même
  // composition (signature légèrement sous le cachet — chevauchement
  // volontaire, mesure anti-fraude) des deux côtés.
  function _dessinerSignataire(ancrageX, signatureImg, titre, nom, avecDateFait, cachetIntegreDansSignature) {
    const centreTitre = ancrageX + 480;

    // "Fait à Comé, le [date]" — affiché uniquement au-dessus de la
    // signature du PDG (là où on signe traditionnellement ce genre de
    // mention sur un document papier), plus au centre du corps du
    // texte comme avant : évite la redondance avec la mention réelle
    // déjà présente sur le tampon/signature scanné du PDG.
    if (avecDateFait) {
      _font(ctx, 30, "normal", "DM Sans");
      ctx.fillStyle = ATT.GRIS;
      const ld1 = "Fait à Comé, le ";
      const ld2 = dateAujourdhui;
      const largeurTotale = _mw(ctx, ld1) + (() => { _font(ctx, 30, "bold", "DM Sans"); const w = _mw(ctx, ld2); _font(ctx, 30, "normal", "DM Sans"); return w; })();
      let fx = centreTitre - largeurTotale / 2;
      _font(ctx, 30, "normal", "DM Sans");
      ctx.fillText(ld1, fx, SIG_Y + 20);
      fx += _mw(ctx, ld1);
      _font(ctx, 30, "bold", "DM Sans");
      ctx.fillText(ld2, fx, SIG_Y + 20);
    }

    _font(ctx, 40, "normal");
    ctx.fillStyle = ATT.TEXTE;
    ctx.fillText(titre, centreTitre - _mw(ctx, titre) / 2, SIG_Y + 80);

    const SIG_W = 300;
    const CACHET_W = 340; // cachet seul (icons/cachet.png), redessiné sous une signature séparée

    if (cachetIntegreDansSignature) {
      // Cas où le cachet officiel et la signature ne font qu'un seul
      // fichier (tampon + paraphe scannés ensemble) : on dessine cette
      // image unique, en conservant ses vraies proportions, et on NE
      // redessine PAS le cachet séparé en-dessous (il y serait en
      // double, l'un par-dessus l'autre). Agrandie (largeur 660, était
      // 560) — le cachet paraissait trop petit sur le document complet.
      if (signatureImg) {
        const ratio = signatureImg.height / signatureImg.width;
        const largeur = 660;
        const hauteur = Math.round(largeur * ratio);
        ctx.drawImage(signatureImg, ancrageX + 220, SIG_Y + 30, largeur, hauteur);
      }
    } else {
      if (signatureImg) {
        const ratio = signatureImg.height / signatureImg.width;
        const SIG_H = Math.min(Math.round(SIG_W * ratio), 140);
        ctx.drawImage(signatureImg, ancrageX + 140, SIG_Y + 280, SIG_W, SIG_H);
      }
      if (cachet) ctx.drawImage(cachet, ancrageX + 260, SIG_Y + 70, CACHET_W, CACHET_W);
    }

    ctx.save();
    ctx.strokeStyle = ATT.OR; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(ancrageX, SIG_Y + 450);
    ctx.lineTo(ancrageX + 908, SIG_Y + 450);
    ctx.stroke();
    ctx.restore();

    if (nom) {
      _font(ctx, 44, "bold");
      ctx.fillStyle = ATT.MARINE;
      ctx.fillText(nom, centreTitre - _mw(ctx, nom) / 2, SIG_Y + 505);
    }
    _font(ctx, 30, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    const titreY = nom ? SIG_Y + 546 : SIG_Y + 515;
    ctx.fillText(titre, centreTitre - _mw(ctx, titre) / 2, titreY);
  }

  const titreFormateur = estStage ? "Le Responsable du Stage" : ATT_SIGNATAIRE_FORMATEUR.titre;
  _dessinerSignataire(CX, sigFormateur, titreFormateur, ATT_SIGNATAIRE_FORMATEUR.nom, false, false);
  _dessinerSignataire(ATT.W - CX - 908, sigPdg, ATT_SIGNATAIRE_PDG.titre, ATT_SIGNATAIRE_PDG.nom, true, true);

  // ── QR de vérification — centré dans l'espace vide entre les deux
  // blocs de signature (1212px de large exactement, entre 1148 et 2360
  // sur une largeur totale de 3508 — vérifié par calcul, pas occupé
  // par les signatures contrairement à ce que suggérait l'ancien
  // commentaire à cet endroit). Remplace l'ancienne version, plus
  // petite, qui vivait dans le pied de page.
  const QR_CENTRE_S = 300;
  if (qr) {
    const qrX = (ATT.W - QR_CENTRE_S) / 2;
    const qrY = SIG_Y + 60;
    _roundRect(ctx, qrX - 10, qrY - 10, QR_CENTRE_S + 20, QR_CENTRE_S + 20, 12, ATT.BLANC);
    ctx.drawImage(qr, qrX, qrY, QR_CENTRE_S, QR_CENTRE_S);
    _font(ctx, 24, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    const lblQr = "Scanner pour vérifier";
    ctx.fillText(lblQr, (ATT.W - _mw(ctx, lblQr)) / 2, qrY + QR_CENTRE_S + 38);
  }

  // ── FOOTER — hauteur réduite (200 au lieu de 270) pour dégager de la
  // marge au-dessus, quitte à ce que SIG_Y grandisse sur un document
  // au texte long (voir plafond 1700 ci-dessus, qui garantit toujours
  // au moins ~30px de marge avant ce bandeau) ──
  const FTR_Y = ATT.H - 210;
  _rect(ctx, 0, FTR_Y, ATT.W, 10, ATT.OR);
  _rect(ctx, 0, FTR_Y + 10, ATT.W, 200, ATT.MARINE);

  _font(ctx, 28, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  const refTxt = `Réf : ${apprenant.id}   —   Document généré le ${dateAujourdhui}`;
  ctx.fillText(refTxt, (ATT.W - _mw(ctx, refTxt)) / 2, FTR_Y + 62);

  _font(ctx, 36, "bold", "DM Sans");
  ctx.fillStyle = ATT.OR_LIGHT;
  const sloganTxt = "LA FORMATION AU SERVICE DE VOTRE AVENIR";
  ctx.fillText(sloganTxt, (ATT.W - _mw(ctx, sloganTxt)) / 2, FTR_Y + 118);

  _font(ctx, 26, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  const siteTxt = "www." + ATT_ENTREPRISE.SITE + "  —  " + ATT_ENTREPRISE.ADRESSE;
  ctx.fillText(siteTxt, (ATT.W - _mw(ctx, siteTxt)) / 2, FTR_Y + 165);

  _rect(ctx, 0, ATT.H - 18, ATT.W, 18, ATT.OR);

  return canvas;
}

// ─── AFFICHAGE + TÉLÉCHARGEMENT ───────────────────────────────
async function afficherAttestationCanvas(apprenant, token) {
  const preview = document.getElementById("attestation-preview");
  if (!preview) return;

  preview.innerHTML = `
    <div style="text-align:center;padding:2.5rem;">
      <div style="display:inline-block;width:44px;height:44px;border:3px solid rgba(245,166,35,0.3);
           border-top-color:#F5A623;border-radius:50%;animation:pk-spin 0.8s linear infinite;"></div>
      <p style="margin-top:1rem;font-size:0.9rem;opacity:0.7;">Génération de l'attestation...</p>
    </div>`;

  try {
    const canvas  = await genererAttestationCanvas(apprenant, token);
    const dataURL = canvas.toDataURL("image/png");

    preview.innerHTML = `
      <div style="text-align:center;background:#12241f;padding:10px;border-radius:8px;">
        <img src="${dataURL}" style="max-width:100%;height:auto;border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,0.4);" alt="Aperçu attestation" />
      </div>`;

    window._attestCanvas = canvas;
    window._attestId     = apprenant.id;

    const btnPDF = document.getElementById("btn-telecharger-attestation-pdf");
    if (btnPDF) btnPDF.onclick = () => telechargerAttestation(canvas, apprenant.id, "pdf");
    const btnPNG = document.getElementById("btn-telecharger-attestation-png");
    if (btnPNG) btnPNG.onclick = () => telechargerAttestation(canvas, apprenant.id, "png");

  } catch (err) {
    preview.innerHTML = `
      <div style="padding:2rem;text-align:center;color:#E24B4A;">
        <p style="font-size:1rem;margin-bottom:0.5rem;">Erreur de génération</p>
        <p style="font-size:0.85rem;opacity:0.7;">${err.message}</p>
      </div>`;
  }
}

async function telechargerAttestation(canvas, id, format = "pdf") {
  const dateISO = new Date().toISOString().split("T")[0];

  if (format === "png") {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `Attestation_${id}_${dateISO}.png`;
    a.click();
    if (window.showToast) showToast("Image téléchargée", "success");
    return;
  }

  // FIX : l'ancienne version passait par html2pdf.js (rendu d'un <img>
  // dans le DOM, puis capture html2canvas de cet élément) — le PDF sortait
  // vide car html2canvas capturait souvent le DOM avant que l'image en
  // base64 n'ait fini de se décoder (pas d'attente de son "load"). On
  // insère directement le canvas déjà généré dans un PDF via jsPDF, sans
  // repasser par un rendu DOM intermédiaire — même approche fiable que
  // verifier.html.
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("jsPDF non disponible"));
      document.head.appendChild(s);
    });
  }

  try {
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf     = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
    pdf.save(`Attestation_${id}_${dateISO}.pdf`);
    if (window.showToast) showToast("PDF téléchargé avec succès", "success");
  } catch (err) {
    if (window.showToast) showToast("Erreur PDF : " + err.message, "error");
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `Attestation_${id}_${dateISO}.png`;
    a.click();
  }
}

window.genererAttestationCanvas  = genererAttestationCanvas;
window.afficherAttestationCanvas = afficherAttestationCanvas;
window.telechargerAttestation    = telechargerAttestation;

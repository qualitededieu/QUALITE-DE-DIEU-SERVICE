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

// Signataire — à compléter une fois le nom officiel communiqué.
// Si ATT_SIGNATAIRE.nom reste vide, seul le titre est affiché.
const ATT_SIGNATAIRE = { nom: "", titre: "Le Responsable de Formation" };

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

  const [logo, qr, photo, sig, cachet] = await Promise.all([
    _loadImg(ATT_ENTREPRISE.LOGO_URL),
    _loadImg(QR_URL),
    _loadImg(apprenant.photoUrl),
    _loadImg(typeof SIGNATURE_DATA !== "undefined" ? SIGNATURE_DATA : "icons/signature.png"),
    _loadImg(typeof CACHET_DATA    !== "undefined" ? CACHET_DATA    : "icons/cachet.png"),
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
  const intro3 = ", centre de formation professionnelle, attestons que :";
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

  const civilite   = apprenant.sexe === "F" ? "Mme." : "M.";
  const nomComplet = `${civilite} ${(apprenant.prenom || "").toUpperCase()} ${(apprenant.nom || "").toUpperCase()}`;
  const BANNER_CX  = 1512.5;
  _roundRect(ctx, 210, posY - 52, 2605, 158, 24, ATT.MARINE);
  _font(ctx, 90, "bold");
  ctx.fillStyle = ATT.OR_LIGHT;
  ctx.fillText(nomComplet, BANNER_CX - _mw(ctx, nomComplet) / 2, posY + 56);
  posY += 190;

  _font(ctx, 46, "normal");
  ctx.fillStyle = ATT.TEXTE;
  ctx.fillText("a suivi avec assiduité et a validé la formation en :", CX, posY);
  posY += 82;

  const intitule = apprenant.filiere || "Formation professionnelle";
  ctx.font = document.fonts.check("120px 'Great Vibes'")
    ? "120px 'Great Vibes'"
    : "italic bold 90px 'Times New Roman', Times, serif";
  ctx.fillStyle = ATT.MARINE;
  {
    const iW = _mw(ctx, intitule);
    ctx.fillText(intitule, (ATT.W - iW) / 2, posY + 20);
    posY += 46;
    _rect(ctx, (ATT.W - iW) / 2 - 40, posY + 12, iW + 80, 6, ATT.OR);
    posY += 76;
  }

  _font(ctx, 33, "italic");
  ctx.fillStyle = ATT.GRIS;
  posY = _wrapCentre(ctx, _attDescription(apprenant.filiere), posY, CW - 120, 46) + 18;

  _font(ctx, 46, "normal");
  const p1 = "durant la période du  ", p2 = dateDebut, p3 = "  au  ", p4 = dateFin;
  let cx = CX;
  ctx.fillStyle = ATT.TEXTE; ctx.fillText(p1, cx, posY); cx += _mw(ctx, p1);
  _font(ctx, 46, "bold"); ctx.fillStyle = ATT.MARINE; ctx.fillText(p2, cx, posY); cx += _mw(ctx, p2);
  _font(ctx, 46, "normal"); ctx.fillStyle = ATT.TEXTE; ctx.fillText(p3, cx, posY); cx += _mw(ctx, p3);
  _font(ctx, 46, "bold"); ctx.fillStyle = ATT.MARINE; ctx.fillText(p4, cx, posY);
  posY += 72;

  _font(ctx, 44, "normal");
  ctx.fillStyle = ATT.TEXTE;
  posY = _wrap(ctx, "Cette formation lui a permis d'acquérir des compétences pratiques et professionnelles dans le domaine concerné.", CX, posY, CW, 60);
  posY = _wrap(ctx, "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", CX, posY, CW, 60);

  posY += 30;
  _font(ctx, 42, "normal");
  const ld1 = "Fait à Comé, le  ";
  ctx.fillStyle = ATT.TEXTE;
  ctx.fillText(ld1, CX, posY);
  _font(ctx, 42, "bold");
  ctx.fillText(dateAujourdhui, CX + _mw(ctx, ld1), posY);

  // ── SIGNATURE / QR / RUBAN ──
  const SIG_Y = 1560;

  _font(ctx, 42, "normal");
  ctx.fillStyle = ATT.TEXTE;
  ctx.fillText(ATT_SIGNATAIRE.titre, 2840 - _mw(ctx, ATT_SIGNATAIRE.titre) / 2, SIG_Y + 95);

  if (qr) {
    _roundRect(ctx, CX, SIG_Y + 90, 300, 300, 14, ATT.BLANC);
    ctx.drawImage(qr, CX + 8, SIG_Y + 98, 284, 284);
  }
  _font(ctx, 28, "normal", "DM Sans");
  ctx.fillStyle = ATT.GRIS;
  ctx.fillText("Scanner pour vérifier", CX + 16, SIG_Y + 408);

  // Ruban de validation générique (pas de système de notation chez LQD)
  const BADGE_X = 620, BADGE_W = 1660, BADGE_Y = SIG_Y + 50, BADGE_H = 340;
  const BADGE_CX = BADGE_X + BADGE_W / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(245,166,35,0.35)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(BADGE_X + 20, BADGE_Y);
  ctx.lineTo(BADGE_X + BADGE_W - 20, BADGE_Y);
  ctx.quadraticCurveTo(BADGE_X + BADGE_W, BADGE_Y, BADGE_X + BADGE_W, BADGE_Y + 20);
  ctx.lineTo(BADGE_X + BADGE_W, BADGE_Y + BADGE_H - 20);
  ctx.quadraticCurveTo(BADGE_X + BADGE_W, BADGE_Y + BADGE_H, BADGE_X + BADGE_W - 20, BADGE_Y + BADGE_H);
  ctx.lineTo(BADGE_X + 20, BADGE_Y + BADGE_H);
  ctx.quadraticCurveTo(BADGE_X, BADGE_Y + BADGE_H, BADGE_X, BADGE_Y + BADGE_H - 20);
  ctx.lineTo(BADGE_X, BADGE_Y + 20);
  ctx.quadraticCurveTo(BADGE_X, BADGE_Y, BADGE_X + 20, BADGE_Y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  _font(ctx, 26, "normal", "DM Sans");
  ctx.fillStyle = ATT.GRIS;
  const lbl1 = "APPRÉCIATION GÉNÉRALE";
  ctx.fillText(lbl1, BADGE_CX - _mw(ctx, lbl1) / 2, BADGE_Y + 70);

  _font(ctx, 58, "bold");
  ctx.fillStyle = ATT.OR;
  const msg1 = "FORMATION VALIDÉE";
  ctx.fillText(msg1, BADGE_CX - _mw(ctx, msg1) / 2, BADGE_Y + 165);

  _font(ctx, 32, "italic");
  ctx.fillStyle = ATT.GRIS;
  const msg2 = "Assiduité et sérieux reconnus par le centre de formation.";
  ctx.fillText(msg2, BADGE_CX - _mw(ctx, msg2) / 2, BADGE_Y + 230);

  _font(ctx, 40, "normal");
  ctx.fillStyle = ATT.OR;
  ctx.fillText("✦ ✦ ✦", BADGE_CX - _mw(ctx, "✦ ✦ ✦") / 2, BADGE_Y + 295);

  // ── Groupe signature + cachet ──
  const SIG_IMG_X = 2500, SIG_W = 300;
  if (sig) {
    const ratio = sig.height / sig.width;
    const SIG_H = Math.min(Math.round(SIG_W * ratio), 150);
    ctx.drawImage(sig, SIG_IMG_X, SIG_Y + 320, SIG_W, SIG_H);
  }
  const CACHET_X = 2600, CACHET_W = 472;
  if (cachet) ctx.drawImage(cachet, CACHET_X, SIG_Y + 80, CACHET_W, CACHET_W);

  ctx.save();
  ctx.strokeStyle = ATT.OR; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(2360, SIG_Y + 510);
  ctx.lineTo(ATT.W - CX, SIG_Y + 510);
  ctx.stroke();
  ctx.restore();

  const NOM_CX = 2840;
  if (ATT_SIGNATAIRE.nom) {
    _font(ctx, 48, "bold");
    ctx.fillStyle = ATT.MARINE;
    ctx.fillText(ATT_SIGNATAIRE.nom, NOM_CX - _mw(ctx, ATT_SIGNATAIRE.nom) / 2, SIG_Y + 570);
  }
  _font(ctx, 36, "normal", "DM Sans");
  ctx.fillStyle = ATT.GRIS;
  const titreY = ATT_SIGNATAIRE.nom ? SIG_Y + 618 : SIG_Y + 580;
  ctx.fillText(ATT_ENTREPRISE.NOM, NOM_CX - _mw(ctx, ATT_ENTREPRISE.NOM) / 2, titreY);

  // ── FOOTER ──
  const FTR_Y = ATT.H - 280;
  _rect(ctx, 0, FTR_Y, ATT.W, 10, ATT.OR);
  _rect(ctx, 0, FTR_Y + 10, ATT.W, 270, ATT.MARINE);

  _font(ctx, 32, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  const refTxt = `Réf : ${apprenant.id}   —   Document généré le ${dateAujourdhui}`;
  ctx.fillText(refTxt, (ATT.W - _mw(ctx, refTxt)) / 2, FTR_Y + 90);

  _font(ctx, 40, "bold", "DM Sans");
  ctx.fillStyle = ATT.OR_LIGHT;
  const sloganTxt = "LA FORMATION AU SERVICE DE VOTRE AVENIR";
  ctx.fillText(sloganTxt, (ATT.W - _mw(ctx, sloganTxt)) / 2, FTR_Y + 156);

  _font(ctx, 30, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  const siteTxt = "www." + ATT_ENTREPRISE.SITE + "  —  " + ATT_ENTREPRISE.ADRESSE;
  ctx.fillText(siteTxt, (ATT.W - _mw(ctx, siteTxt)) / 2, FTR_Y + 210);

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

  if (!window.html2pdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      s.onload = res;
      s.onerror = () => rej(new Error("html2pdf non disponible"));
      document.head.appendChild(s);
    });
  }

  try {
    const jpegURL = canvas.toDataURL("image/jpeg", 0.98);
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "width:297mm;height:210mm;margin:0;padding:0;overflow:hidden;";
    wrapper.innerHTML = `<img src="${jpegURL}" style="width:297mm;height:210mm;display:block;object-fit:cover;"/>`;
    document.body.appendChild(wrapper);

    await html2pdf().set({
      margin: 0,
      filename: `Attestation_${id}_${dateISO}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
    }).from(wrapper).save();

    document.body.removeChild(wrapper);
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

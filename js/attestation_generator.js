"use strict";

const ATT = {
  MARINE:   "#04342C",
  MARINE_2: "#0F6E56",
  OR:       "#F5A623",
  OR_LIGHT: "#FABD50",
  BLANC:    "#FFFFFF",
  CREME:    "#F8F7F2",
  GRIS:     "#6B7280",
  TEXTE:    "#1A1A2E",
  W: 3508,
  H: 2480,
};

const ATT_SIGNATAIRE_FORMATEUR = { nom: "M. TOSSOU C. Philippe", titre: "Le Formateur" };
const ATT_SIGNATAIRE_PDG       = { nom: "M. ATO Blaise", titre: "Président Directeur Général" };

const ATT_ENTREPRISE = {
  NOM:      "LES QUALITÉS DE DIEU SERVICE",
  SUFFIXE:  "SARL — Centre de formation professionnelle",
  ADRESSE:  "Comé, Hongodé — en face Hôpital de Zone de Comé, Bénin",
  TEL:      "+229 01 97 95 12 30 / 01 60 98 90 94",
  EMAIL:    "papablaise1993@gmail.com",
  SITE:     "www.qualitededieuservice.com",
  LOGO_URL: "icons/logoqds.jpg",
};

const ATT_DESCRIPTIONS = {
  "Informatique & Bureautique": "Maîtrise des outils bureautiques (Word, Excel, PowerPoint), gestion de base de l'outil informatique, saisie et mise en forme de documents professionnels, navigation Internet.",
  "Graphisme & PAO":            "Publication assistée par ordinateur, conception d'affiches et de supports visuels, maîtrise des logiciels professionnels (Photoshop, Illustrator, CorelDRAW, Canva Pro).",
  "Sérigraphie":                "Techniques d'impression sur tout support (tissu, enseignes, objets promotionnels), préparation des écrans, gestion des couleurs et finitions.",
  "Création de sites web":      "Conception et publication de sites internet, bases HTML/CSS, gestion de contenu avec WordPress et Wix, mise en ligne et hébergement.",
  "Initiation rapide (1 mois)": "Initiation accélérée aux outils numériques essentiels : prise en main de l'ordinateur, bureautique de base et navigation Internet.",
};

function _attDescription(filiere) {
  const f = String(filiere || "");
  if (ATT_DESCRIPTIONS[f]) return ATT_DESCRIPTIONS[f];
  const cle = Object.keys(ATT_DESCRIPTIONS).find(k => f.includes(k) || k.includes(f));
  if (cle) return ATT_DESCRIPTIONS[cle];
  return "Formation professionnelle qualifiante dispensée par le centre.";
}

const ATT_CATEGORIES_LONGUE = {
  "Informatique & Bureautique": { categorie: "Bureautique & Digital", texte: ATT_DESCRIPTIONS["Informatique & Bureautique"] },
  "Graphisme & PAO":            { categorie: "Design & Impression",   texte: ATT_DESCRIPTIONS["Graphisme & PAO"] },
  "Sérigraphie":                { categorie: "Design & Impression",   texte: ATT_DESCRIPTIONS["Sérigraphie"] },
  "Création de sites web":      { categorie: "Développement Web",     texte: ATT_DESCRIPTIONS["Création de sites web"] },
  "Initiation rapide (1 mois)": { categorie: "Initiation numérique",  texte: ATT_DESCRIPTIONS["Initiation rapide (1 mois)"] },
};

const ATT_MODULE_MANAGEMENT = {
  categorie: "Management",
  texte: "Initiation à la gestion d'entreprise et à l'entrepreneuriat.",
};

function _competencesLongue(filiereStr) {
  const filieres = String(filiereStr || "").split(",").map(s => s.trim()).filter(Boolean);
  const parCategorie = new Map();

  filieres.forEach(f => {
    const entree = ATT_CATEGORIES_LONGUE[f];
    if (!entree) return;
    if (!parCategorie.has(entree.categorie)) parCategorie.set(entree.categorie, []);
    parCategorie.get(entree.categorie).push(entree.texte);
  });

  const resultat = Array.from(parCategorie.entries()).map(([categorie, textes]) => ({
    categorie,
    texte: textes.join(" "),
  }));

  resultat.push(ATT_MODULE_MANAGEMENT);
  return resultat;
}

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

function _bboxEncre(img, seuilAlpha = 10) {
  try {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, img.width, img.height).data;
    let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (data[(y * img.width + x) * 4 + 3] > seuilAlpha) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) throw new Error("image transparente");
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch (e) {
    return { x: 0, y: 0, w: img.width, h: img.height };
  }
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

function _dessinerRubanCoin(ctx, ancrageX, ancrageY, angleDeg, longueur, largeurPrincipale, couleurPrincipale, couleurSecondaire) {
  ctx.save();
  ctx.translate(ancrageX, ancrageY);
  ctx.rotate(angleDeg * Math.PI / 180);
  ctx.fillStyle = couleurPrincipale;
  ctx.fillRect(-longueur / 2, 0, longueur, largeurPrincipale);
  ctx.fillStyle = couleurSecondaire;
  ctx.fillRect(-longueur / 2, largeurPrincipale, longueur, largeurPrincipale * 0.32);
  ctx.restore();
}

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

async function genererAttestationCanvas(apprenant, token) {
  await _chargerPoliceScript();

  const estStage = apprenant.source === "candidature-stage";

  function _dureeEnMois(debut, fin) {
    if (!debut || !fin) return null;
    const d1 = new Date(debut);
    const d2 = new Date(fin);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  }
  const dureeMois = _dureeEnMois(apprenant.dateEntree, apprenant.dateFin);
  const estFormationLongue = !estStage && (dureeMois === null || dureeMois >= 6);

  const COULEUR_PRINCIPALE = (estStage || estFormationLongue) ? ATT.MARINE : "#0B2447";

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
    _loadImg(typeof SIGNATURE_FORMATEUR_DATA !== "undefined" ? SIGNATURE_FORMATEUR_DATA : "icons/signature-formateur.png?v=2"),
    _loadImg(typeof SIGNATURE_PDG_DATA       !== "undefined" ? SIGNATURE_PDG_DATA       : "icons/signature-pdg.png?v=2"),
    _loadImg(typeof CACHET_DATA              !== "undefined" ? CACHET_DATA              : "icons/cachet.png?v=2"),
  ]);

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

  let HDR_H;

  if (estFormationLongue) {
    HDR_H = 560;

    _dessinerRubanCoin(ctx, 0, 0, -35, 900, 70, "#1B3A6B", ATT.OR);
    _dessinerRubanCoin(ctx, 0, ATT.H, -35, 900, 70, "#1B3A6B", ATT.OR);

    if (logo) {
      const LOGO_D = 210;
      ctx.save();
      ctx.beginPath(); ctx.arc(ATT.W / 2, 150, LOGO_D / 2, 0, Math.PI * 2); ctx.clip();
      _drawImageCover(ctx, logo, ATT.W / 2 - LOGO_D / 2, 150 - LOGO_D / 2, LOGO_D, LOGO_D);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.arc(ATT.W / 2, 150, LOGO_D / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = ATT.OR; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    }

    _font(ctx, 62, "bold");
    ctx.fillStyle = "#C97A1A";
    const nomLg = "STÉ " + ATT_ENTREPRISE.NOM + " SARL";
    ctx.fillText(nomLg, (ATT.W - _mw(ctx, nomLg)) / 2, 300);

    _font(ctx, 40, "bold", "DM Sans");
    ctx.fillStyle = "#1B3A6B";
    const sousTitreLg = "Centre de Formation Professionnelle en Informatique";
    ctx.fillText(sousTitreLg, (ATT.W - _mw(ctx, sousTitreLg)) / 2, 350);

    _font(ctx, 30, "normal", "DM Sans");
    ctx.fillStyle = ATT.TEXTE;
    const detailLg = "Imprimerie, Graphisme et Sérigraphie Numérique";
    ctx.fillText(detailLg, (ATT.W - _mw(ctx, detailLg)) / 2, 392);

    _font(ctx, 26, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    const ligneLegale = `RCCM RB/ABC/23 B 7078  —  IFU 3202357917037  —  Tél : ${ATT_ENTREPRISE.TEL}  —  ${ATT_ENTREPRISE.EMAIL}`;
    ctx.fillText(ligneLegale, (ATT.W - _mw(ctx, ligneLegale)) / 2, 428);

    _font(ctx, 32, "normal");
    ctx.fillStyle = ATT.OR;
    const etoiles = "★  ★  ★  ★  ★  ★";
    ctx.fillText(etoiles, (ATT.W - _mw(ctx, etoiles)) / 2, 470);

    _font(ctx, 30, "bold", "DM Sans");
    ctx.fillStyle = ATT.TEXTE;
    ctx.fillText(`Réf. : ${apprenant.id}`, 240, 520);

  } else {
    HDR_H = 402;
    _rect(ctx, 0, 0, ATT.W, HDR_H, COULEUR_PRINCIPALE);
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
  }

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

  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.beginPath(); ctx.arc(ATT.W / 2, 1300, 560, 0, Math.PI * 2); ctx.clip();
    _drawImageCover(ctx, logo, ATT.W / 2 - 560, 740, 1120, 1120);
    ctx.restore();
  }

  const CX = 240, CW = ATT.W - 480;
  let posY;

  if (estFormationLongue) {

    const TITRE_Y = HDR_H + 60;
    _font(ctx, 108, "bold");
    ctx.fillStyle = "#1B3A6B";
    const t1 = "ATTESTATION DE FIN DE FORMATION";
    ctx.fillText(t1, (ATT.W - _mw(ctx, t1)) / 2, TITRE_Y);

    _font(ctx, 60, "bold");
    const t2 = "PROFESSIONNELLE";
    ctx.fillText(t2, (ATT.W - _mw(ctx, t2)) / 2, TITRE_Y + 76);

    posY = TITRE_Y + 160;

    _font(ctx, 40, "normal");
    ctx.fillStyle = ATT.TEXTE;
    const preambule =
      `Nous soussignés, Monsieur ${ATT_SIGNATAIRE_PDG.nom.replace(/^M\.\s*/, "")}, Président Directeur Général de la Société ` +
      `${ATT_ENTREPRISE.NOM} SARL, entreprise spécialisée dans l'Informatique & Bureautique, Design & Impression, sise à Comé, ` +
      `Hongodé, et Monsieur ${ATT_SIGNATAIRE_FORMATEUR.nom.replace(/^M\.\s*/, "")}, Formateur Principal,`;
    posY = _wrap(ctx, preambule, CX, posY, CW, 52) + 16;

    _font(ctx, 44, "bold");
    ctx.fillStyle = "#A6402F";
    const attestePar = "ATTESTONS PAR LA PRÉSENTE QUE :";
    ctx.fillText(attestePar, (ATT.W - _mw(ctx, attestePar)) / 2, posY);
    posY += 76;

    const sexeNorm   = String(apprenant.sexe || "").trim().toUpperCase();
    const civiliteLg = sexeNorm === "F" ? "Madame " : (sexeNorm === "M" ? "Monsieur " : "");
    const nomComplet = `${civiliteLg}${(apprenant.prenom || "").toUpperCase()} ${(apprenant.nom || "").toUpperCase()}`;
    const BANNER_CX  = 1512.5;
    _roundRect(ctx, 210, posY - 52, 2605, 158, 24, COULEUR_PRINCIPALE);
    _font(ctx, 82, "bold");
    ctx.fillStyle = ATT.OR_LIGHT;
    ctx.fillText(nomComplet, BANNER_CX - _mw(ctx, nomComplet) / 2, posY + 56);
    posY += 190;

    if (apprenant.dateNaissance) {
      _font(ctx, 40, "normal");
      ctx.fillStyle = ATT.TEXTE;
      const lieuTxt = apprenant.lieuNaissance ? ` à ${apprenant.lieuNaissance}` : "";
      const naissanceTxt = `né(e) le ${fmt(apprenant.dateNaissance)}${lieuTxt}.`;
      ctx.fillText(naissanceTxt, (ATT.W - _mw(ctx, naissanceTxt)) / 2, posY);
      posY += 64;
    }

    _font(ctx, 44, "normal");
    const dureeTxt = dureeMois !== null ? ` (${dureeMois} mois)` : "";
    const d1 = "A suivi avec assiduité et succès, du ", d2 = dateDebut, d3 = " au ", d4 = dateFin + dureeTxt + ",";
    let dx = CX;
    ctx.fillStyle = ATT.TEXTE; ctx.fillText(d1, dx, posY); dx += _mw(ctx, d1);
    _font(ctx, 44, "bold"); ctx.fillStyle = COULEUR_PRINCIPALE; ctx.fillText(d2, dx, posY); dx += _mw(ctx, d2);
    _font(ctx, 44, "normal"); ctx.fillStyle = ATT.TEXTE; ctx.fillText(d3, dx, posY); dx += _mw(ctx, d3);
    _font(ctx, 44, "bold"); ctx.fillStyle = COULEUR_PRINCIPALE; ctx.fillText(d4, dx, posY);
    posY += 64;

    _font(ctx, 44, "normal");
    ctx.fillStyle = ATT.TEXTE;
    posY = _wrap(ctx, "une formation professionnelle complète. À l'issue de ce parcours, l'intéressé(e) a validé les compétences suivantes :", CX, posY, CW, 54) + 10;

    const competences = _competencesLongue(apprenant.filiere);
    competences.forEach(bloc => {
      _font(ctx, 42, "bold");
      ctx.fillStyle = COULEUR_PRINCIPALE;
      const label = bloc.categorie + " : ";
      ctx.fillText(label, CX, posY);
      const labelW = _mw(ctx, label);

      _font(ctx, 42, "normal");
      ctx.fillStyle = ATT.TEXTE;
      const words = String(bloc.texte).split(" ");
      let ligne = "", x = CX + labelW, premierMot = true;
      const finLigneX = CX + CW;
      for (const mot of words) {
        const test = ligne ? ligne + " " + mot : mot;
        const largeurTest = _mw(ctx, test) + (premierMot ? labelW : 0);
        if (CX + largeurTest > finLigneX && ligne) {
          ctx.fillText(ligne, premierMot ? x : CX, posY);
          posY += 54;
          ligne = mot; premierMot = false; x = CX;
        } else {
          ligne = test;
        }
      }
      if (ligne) { ctx.fillText(ligne, premierMot ? x : CX, posY); posY += 54; }
      posY += 12;
    });

    posY += 10;
    _font(ctx, 40, "italic");
    ctx.fillStyle = ATT.TEXTE;
    posY = _wrap(ctx, "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", CX, posY, CW, 52);
    posY += 20;

  } else {

    const TITRE_Y = HDR_H + 14;
    _rect(ctx, 240, TITRE_Y + 60, 610, 7, ATT.OR);
    _rect(ctx, ATT.W - 850, TITRE_Y + 60, 150, 7, ATT.OR);

    _font(ctx, 220, "bold");
    ctx.fillStyle = COULEUR_PRINCIPALE;
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

    posY = TITRE_Y + 410;

    _font(ctx, 52, "normal");
    const intro1 = "Nous soussignés, ";
    const intro2 = ATT_ENTREPRISE.NOM;
    const intro3 = estStage
      ? ", attestons que :"
      : ", centre de formation professionnelle, attestons que :";
    ctx.fillStyle = ATT.TEXTE;
    ctx.fillText(intro1, CX, posY);
    let ix = CX + _mw(ctx, intro1);
    _font(ctx, 46, "bold");
    ctx.fillStyle = COULEUR_PRINCIPALE;
    ctx.fillText(intro2, ix, posY);
    ix += _mw(ctx, intro2);
    _font(ctx, 52, "normal");
    ctx.fillStyle = ATT.TEXTE;
    ctx.fillText(intro3, ix, posY);
    posY += 90;

    const sexeNorm   = String(apprenant.sexe || "").trim().toUpperCase();
    const civilite   = sexeNorm === "F" ? "Mme. " : (sexeNorm === "M" ? "M. " : "");
    const nomComplet = `${civilite}${(apprenant.prenom || "").toUpperCase()} ${(apprenant.nom || "").toUpperCase()}`;
    const BANNER_CX  = 1512.5;
    _roundRect(ctx, 210, posY - 52, 2605, 158, 24, COULEUR_PRINCIPALE);
    _font(ctx, 90, "bold");
    ctx.fillStyle = ATT.OR_LIGHT;
    ctx.fillText(nomComplet, BANNER_CX - _mw(ctx, nomComplet) / 2, posY + 56);
    posY += 190;

    _font(ctx, 52, "normal");
    ctx.fillStyle = ATT.TEXTE;
    ctx.fillText(
      estStage
        ? "a effectué avec assiduité un stage professionnel dans le domaine de :"
        : "a suivi avec assiduité et a validé la formation en :",
      CX, posY
    );
    posY += 80;

    const intitule = apprenant.filiere || (estStage ? "Stage professionnel" : "Formation professionnelle");
    ctx.font = document.fonts.check("120px 'Great Vibes'")
      ? "120px 'Great Vibes'"
      : "italic bold 90px 'Times New Roman', Times, serif";
    ctx.fillStyle = COULEUR_PRINCIPALE;
    {
      const iW = _mw(ctx, intitule);
      ctx.fillText(intitule, (ATT.W - iW) / 2, posY + 20);
      posY += 40;
      _rect(ctx, (ATT.W - iW) / 2 - 40, posY + 12, iW + 80, 6, ATT.OR);
      posY += 70;
    }

    _font(ctx, 38, "italic");
    ctx.fillStyle = ATT.GRIS;
    const descriptionTexte = estStage
      ? _attDescriptionStage(apprenant.missionsStage)
      : _attDescription(apprenant.filiere);
    posY = _wrapCentre(ctx, descriptionTexte, posY, CW - 120, 48) + 16;

    _font(ctx, 52, "normal");
    const p1 = "durant la période du  ", p2 = dateDebut, p3 = "  au  ", p4 = dateFin;
    let cx = CX;
    ctx.fillStyle = ATT.TEXTE; ctx.fillText(p1, cx, posY); cx += _mw(ctx, p1);
    _font(ctx, 52, "bold"); ctx.fillStyle = COULEUR_PRINCIPALE; ctx.fillText(p2, cx, posY); cx += _mw(ctx, p2);
    _font(ctx, 52, "normal"); ctx.fillStyle = ATT.TEXTE; ctx.fillText(p3, cx, posY); cx += _mw(ctx, p3);
    _font(ctx, 52, "bold"); ctx.fillStyle = COULEUR_PRINCIPALE; ctx.fillText(p4, cx, posY);
    posY += 72;

    _font(ctx, 48, "normal");
    ctx.fillStyle = ATT.TEXTE;
    posY = _wrap(ctx, estStage
      ? "Ce stage lui a permis d'acquérir une expérience pratique et professionnelle au sein de notre structure."
      : "Cette formation lui a permis d'acquérir des compétences pratiques et professionnelles dans le domaine concerné.",
      CX, posY, CW, 58);
    posY = _wrap(ctx, "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", CX, posY, CW, 58);

    posY += 20;
  }

  _font(ctx, 36, "italic");
  ctx.fillStyle = ATT.OR;
  const ruban = estStage
    ? "✦  STAGE VALIDÉ — Assiduité et sérieux reconnus par le centre  ✦"
    : "✦  FORMATION VALIDÉE — Assiduité et sérieux reconnus par le centre  ✦";
  ctx.fillText(ruban, (ATT.W - _mw(ctx, ruban)) / 2, posY);
  posY += 50;

  const SIG_Y = Math.min(Math.max(1560, posY + 30), 1700);

  function _dessinerSignataire(ancrageX, signatureImg, titre, nom, avecDateFait, cachetIntegreDansSignature) {
    const centreTitre = ancrageX + 480;

    if (avecDateFait) {
      _font(ctx, 34, "normal", "DM Sans");
      ctx.fillStyle = ATT.GRIS;
      const ld1 = "Fait à Comé, le ";
      const ld2 = dateAujourdhui;
      const largeurTotale = _mw(ctx, ld1) + (() => { _font(ctx, 34, "bold", "DM Sans"); const w = _mw(ctx, ld2); _font(ctx, 34, "normal", "DM Sans"); return w; })();
      let fx = centreTitre - largeurTotale / 2;
      _font(ctx, 34, "normal", "DM Sans");
      ctx.fillText(ld1, fx, SIG_Y + 20);
      fx += _mw(ctx, ld1);
      _font(ctx, 34, "bold", "DM Sans");
      ctx.fillText(ld2, fx, SIG_Y + 20);
    }

    _font(ctx, 46, "normal");
    ctx.fillStyle = ATT.TEXTE;
    ctx.fillText(titre, centreTitre - _mw(ctx, titre) / 2, SIG_Y + 80);

    const SIG_W = 300;
    const CACHET_W = 340;

    if (cachetIntegreDansSignature) {
      if (signatureImg) {
        const b = _bboxEncre(signatureImg);
        const ratio = b.h / b.w;
        const CACHET_SIG_START_Y = SIG_Y + 105;
        const CACHET_SIG_MAX_W = 575;
        const CACHET_SIG_MAX_H = 335;
        let largeur = CACHET_SIG_MAX_W;
        let hauteur = Math.round(largeur * ratio);
        if (hauteur > CACHET_SIG_MAX_H) {
          hauteur = CACHET_SIG_MAX_H;
          largeur = Math.round(hauteur / ratio);
        }
        ctx.drawImage(signatureImg, b.x, b.y, b.w, b.h, ancrageX + 220, CACHET_SIG_START_Y, largeur, hauteur);
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
      _font(ctx, 50, "bold");
      ctx.fillStyle = COULEUR_PRINCIPALE;
      ctx.fillText(nom, centreTitre - _mw(ctx, nom) / 2, SIG_Y + 505);
    }
    _font(ctx, 34, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    const titreY = nom ? SIG_Y + 552 : SIG_Y + 519;
    ctx.fillText(titre, centreTitre - _mw(ctx, titre) / 2, titreY);
  }

  const titreFormateur = estStage ? "Le Responsable du Stage" : ATT_SIGNATAIRE_FORMATEUR.titre;
  _dessinerSignataire(CX, sigFormateur, titreFormateur, ATT_SIGNATAIRE_FORMATEUR.nom, false, false);
  _dessinerSignataire(ATT.W - CX - 908, sigPdg, ATT_SIGNATAIRE_PDG.titre, ATT_SIGNATAIRE_PDG.nom, true, true);

  const QR_CENTRE_S = 300;
  if (qr) {
    const qrX = (ATT.W - QR_CENTRE_S) / 2;
    const qrY = SIG_Y + 60;
    _roundRect(ctx, qrX - 10, qrY - 10, QR_CENTRE_S + 20, QR_CENTRE_S + 20, 12, ATT.BLANC);
    ctx.drawImage(qr, qrX, qrY, QR_CENTRE_S, QR_CENTRE_S);
    _font(ctx, 26, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    const lblQr = "Scanner pour vérifier";
    ctx.fillText(lblQr, (ATT.W - _mw(ctx, lblQr)) / 2, qrY + QR_CENTRE_S + 38);
  }

  const FTR_Y = ATT.H - 210;
  _rect(ctx, 0, FTR_Y, ATT.W, 10, ATT.OR);
  _rect(ctx, 0, FTR_Y + 10, ATT.W, 200, COULEUR_PRINCIPALE);

  _font(ctx, 30, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  const refTxt = `Réf : ${apprenant.id}   —   Document généré le ${dateAujourdhui}`;
  ctx.fillText(refTxt, (ATT.W - _mw(ctx, refTxt)) / 2, FTR_Y + 62);

  _font(ctx, 40, "bold", "DM Sans");
  ctx.fillStyle = ATT.OR_LIGHT;
  const sloganTxt = "LA FORMATION AU SERVICE DE VOTRE AVENIR";
  ctx.fillText(sloganTxt, (ATT.W - _mw(ctx, sloganTxt)) / 2, FTR_Y + 118);

  _font(ctx, 28, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  const siteTxt = "www." + ATT_ENTREPRISE.SITE + "  —  " + ATT_ENTREPRISE.ADRESSE;
  ctx.fillText(siteTxt, (ATT.W - _mw(ctx, siteTxt)) / 2, FTR_Y + 165);

  _rect(ctx, 0, ATT.H - 18, ATT.W, 18, ATT.OR);

  return canvas;
}

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

"use strict";

/* ==================================================================
   GÉNÉRATEUR CANVAS — CARTE D'APPRENTISSAGE (format CR80)
   ------------------------------------------------------------------
   Carte de poche véritable, PAS un document A5 : format CR80 standard
   (85,6 x 54 mm — celui d'une carte bancaire ou d'un badge), pensée
   pour être imprimée puis plastifiée par l'apprenant. Décision prise
   avec le PDG le 22/09/2026 après constat que les apprenants
   plastifient déjà leur carte de leur propre initiative — mieux vaut
   leur fournir un format adapté à ça plutôt qu'un A5 mal proportionné.

   300 dpi (résolution d'impression standard) : 1011 x 638 px.
   Même mécanisme de génération/téléchargement que les autres documents
   de l'Espace apprenant (attestation, fiche, badge) — voir index.html.

   verifier.html continue d'exister séparément pour la vérification
   PUBLIQUE d'authenticité (lien scanné via le QR imprimé sur la carte),
   un usage distinct de l'auto-téléchargement par l'apprenant.
================================================================== */

const CARTE_C = {
  TEAL:       "#04342C",
  TEAL_MID:   "#0A5C4A",
  TEAL_LIGHT: "#1A8A6E",
  ORANGE:     "#F5A623",
  BG:         "#F0F4F2",
  BLANC:      "#FFFFFF",
  TEXTE:      "#0D1F1A",
  TEXTE_2:    "#3D5A52",
  TEXTE_3:    "#7A9E95",
  BORDER:     "#D4E4DF",
  // CR80 @ 300 dpi : 85,6mm x 54mm -> 1011 x 638 px. Format fixe (pas
  // dynamique comme l'ancienne version A5) : une vraie carte de poche a
  // une taille imposée par les pochettes/plastifieuses, le contenu doit
  // s'y adapter, jamais l'inverse.
  W: 1011,
  H: 638,
};

const CARTE_ENTREPRISE = {
  NOM:      "LES QUALITÉS DE DIEU SERVICE",
  LOGO_URL: "icons/logoqds.jpg",
  ADRESSE:  "Comé, Hongodé — en face Hôpital de Zone de Comé, Bénin",
  TEL:      "+229 01 97 95 12 30",
  SITE:     "qualitededieuservice.com",
  // Mêmes mentions légales que sur l'attestation (attestation_generator.js
  // ATT_ENTREPRISE) — cohérence entre documents, même entité juridique.
  RCCM:     "RB/ABC/23 B 7078",
  IFU:      "3202357917037",
  // Signature PDG : fichier présent dans icons/. Le cachet
  // (icons/cachet.png, comme utilisé par attestation_generator.js et
  // fiche_apprenant_generator.js) est ABSENT de ce projet au moment où
  // ce fichier est écrit — le chargement échoue proprement (_carteLoadImg
  // renvoie null) et le cachet est simplement omis, jamais un blocage.
  SIGNATURE_PDG_URL: "icons/signature-pdg.png?v=2",
  CACHET_URL:        "icons/cachet.png?v=2",
  SIGNATAIRE_PDG:    "M. ATO Blaise",
  SIGNATAIRE_TITRE:  "Président Directeur Général",
  // Second signataire, ajouté le 22/09/2026 : le Formateur Principal a son
  // propre cachet (icons/cachet-formateur.png), distinct de celui du PDG —
  // jamais l'un à la place de l'autre.
  SIGNATURE_FORMATEUR_URL: "icons/signature-formateur.png?v=2",
  CACHET_FORMATEUR_URL:    "icons/cachet-formateur.png?v=1",
  SIGNATAIRE_FORMATEUR:       "M. TOSSOU C. Philippe",
  SIGNATAIRE_FORMATEUR_TITRE: "Le Formateur",
};

function _carteFont(ctx, size, style = "normal", family = "DM Sans") {
  ctx.font = `${style} ${size}px '${family}', Arial, sans-serif`;
}
function _carteMw(ctx, txt) { return ctx.measureText(txt).width; }
function _carteRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
function _carteFillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  _carteRoundRect(ctx, x, y, w, h, r);
  ctx.fill();
}
function _carteDrawImageCover(ctx, img, x, y, w, h, topBias = 0.5) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) { sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) * topBias; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
// Filigrane discret du logo en fond de carte — même principe que sur
// l'attestation (alpha très faible, cercle clippé). Ajouté le 22/09/2026
// à la demande du PDG : dessiné avant le reste du contenu (recto ET
// verso) pour rester DERRIÈRE le texte/la photo, jamais par-dessus.
function _carteFiligraneLogo(ctx, logo, cx, cy, rayon) {
  if (!logo) return;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2); ctx.clip();
  _carteDrawImageCover(ctx, logo, cx - rayon, cy - rayon, rayon * 2, rayon * 2);
  ctx.restore();
}
function _carteLoadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
// Retour à la ligne simple, aligné à gauche — utilisé pour l'adresse du
// verso, seul texte de la carte assez long pour en avoir besoin.
function _carteWrap(ctx, txt, x, y, maxW, lh) {
  const words = String(txt).split(" ");
  let ligne = "", curY = y;
  for (const mot of words) {
    const test = ligne ? ligne + " " + mot : mot;
    if (_carteMw(ctx, test) > maxW && ligne) { ctx.fillText(ligne, x, curY); curY += lh; ligne = mot; }
    else ligne = test;
  }
  if (ligne) { ctx.fillText(ligne, x, curY); curY += lh; }
  return curY;
}
function _carteEllipseBlob(ctx, cx, cy, rx, ry, rotationDeg, colorStops) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationDeg * Math.PI / 180);
  const grad = ctx.createLinearGradient(-rx, -ry, rx, ry);
  colorStops.forEach(([offset, color]) => grad.addColorStop(offset, color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let _carteScriptChargee = false;
async function _chargerPoliceScriptCarte() {
  if (_carteScriptChargee) return;
  try {
    const face = new FontFace(
      "Great Vibes",
      "url(https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2) format('woff2')"
    );
    const loaded = await face.load();
    document.fonts.add(loaded);
    await document.fonts.load("50px 'Great Vibes'");
    _carteScriptChargee = true;
  } catch (e) {
    console.warn("[CARTE] Police script non chargée :", e.message);
  }
}

// Même logique que verifier.html::_formatFiliereCarte — scinde le nom
// d'affichage (CONFIG.NOMS_AFFICHAGE_PUBLIC côté GAS) en un titre + un
// sous-titre optionnel (séparateur ' — '), ou joint une liste multi-
// filières (séparateur ' | ', jamais une virgule — voir attestation_
// generator.js pour le pourquoi du choix de ce séparateur).
function _formatFiliereCarte(filiereStr) {
  const brut = String(filiereStr || "");
  if (brut.includes(" | ")) {
    return { titre: brut.split(" | ").map(s => s.trim()).join(", "), sousTitre: "" };
  }
  const sepIdx = brut.indexOf(" — ");
  if (sepIdx > -1) {
    return { titre: brut.slice(0, sepIdx), sousTitre: brut.slice(sepIdx + 3) };
  }
  return { titre: brut, sousTitre: "" };
}

function _carteFormatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// Format court (JJ/MM/AAAA) — la carte CR80 n'a pas la place pour une
// date en toutes lettres comme sur l'attestation.
function _carteFormatDateCourte(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Marge de sécurité : une carte CR80 a les coins découpés à la forme
// (rayon ~3,2mm) et est souvent recadrée légèrement par l'imprimeur ou
// la plastifieuse. Rien d'important (texte, visage) ne doit s'approcher
// des bords à moins de cette marge.
const CARTE_LAYOUT = {
  MARGE:  34,   // ~2,9mm @ 300dpi
  RAYON:  34,   // rayon des coins de la carte
  HDR_H:  148,
};

function _carteChargerQR(lienVerif) {
  if (!lienVerif) return Promise.resolve(null);
  const url = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&data=" + encodeURIComponent(lienVerif);
  return _carteLoadImg(url);
}

async function genererCarteCanvas(apprenant, token) {
  await _chargerPoliceScriptCarte();

  const estStage = apprenant.source === "candidature-stage";
  const C = CARTE_C;
  const L = CARTE_LAYOUT;

  const canvas = document.createElement("canvas");
  canvas.width  = C.W;
  canvas.height = C.H;
  const ctx = canvas.getContext("2d");

  const [logo, photo] = await Promise.all([
    _carteLoadImg(CARTE_ENTREPRISE.LOGO_URL),
    _carteLoadImg(apprenant.photoUrl),
  ]);

  const maintenant = new Date();
  const dateFinObj = apprenant.dateFin ? new Date(apprenant.dateFin) : null;
  const enCours    = dateFinObj && !isNaN(dateFinObj.getTime()) && maintenant < dateFinObj;
  const filiereFmt = _formatFiliereCarte(apprenant.filiere);

  // ----- fond carte + bordure fine -----
  _carteFillRoundRect(ctx, 0, 0, C.W, C.H, L.RAYON, C.BLANC);
  ctx.save();
  _carteRoundRect(ctx, 2, 2, C.W - 4, C.H - 4, L.RAYON - 2);
  ctx.strokeStyle = C.BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  _carteRoundRect(ctx, 0, 0, C.W, C.H, L.RAYON);
  ctx.clip();

  // ----- en-tête marine + liseré or -----
  const HDR_H = L.HDR_H;
  _carteFillRoundRect(ctx, 0, 0, C.W, HDR_H, 0, C.TEAL);
  _carteEllipseBlob(ctx, C.W + 30, -50, 140, 140, 25, [
    [0, C.ORANGE], [0.55, "rgba(245,166,35,0.35)"], [1, "rgba(245,166,35,0)"],
  ]);
  ctx.fillStyle = C.ORANGE;
  ctx.fillRect(0, HDR_H - 5, C.W, 5);

  // logo, petit badge blanc en haut à gauche
  const LOGO_D = 96, LOGO_X = L.MARGE, LOGO_Y = (HDR_H - LOGO_D) / 2 - 3;
  _carteFillRoundRect(ctx, LOGO_X, LOGO_Y, LOGO_D, LOGO_D, 16, C.BLANC);
  if (logo) {
    ctx.save();
    _carteRoundRect(ctx, LOGO_X + 6, LOGO_Y + 6, LOGO_D - 12, LOGO_D - 12, 12);
    ctx.clip();
    _carteDrawImageCover(ctx, logo, LOGO_X + 6, LOGO_Y + 6, LOGO_D - 12, LOGO_D - 12);
    ctx.restore();
  }

  // texte de marque à droite du logo
  const BRAND_X = LOGO_X + LOGO_D + 22, BRAND_W = C.W - BRAND_X - L.MARGE;
  _carteFont(ctx, 25, "800", "DM Sans");
  ctx.fillStyle = C.BLANC;
  {
    // Réduit la taille si "LES QUALITÉS DE DIEU SERVICE" ne tient pas sur
    // une ligne — l'en-tête ne fait que 148px de haut, pas de place pour
    // un retour à la ligne comme sur la version A5.
    let taille = 25;
    _carteFont(ctx, taille, "800", "DM Sans");
    while (_carteMw(ctx, CARTE_ENTREPRISE.NOM) > BRAND_W && taille > 15) {
      taille -= 1;
      _carteFont(ctx, taille, "800", "DM Sans");
    }
    ctx.fillText(CARTE_ENTREPRISE.NOM, BRAND_X, LOGO_Y + 34);
  }
  _carteFont(ctx, 13, "700", "DM Sans");
  ctx.fillStyle = C.ORANGE;
  ctx.fillText("FORMATION · COMPÉTENCES · AVENIR", BRAND_X, LOGO_Y + 58);
  _carteFont(ctx, 15, "italic", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText("Carte d'apprentissage officielle", BRAND_X, LOGO_Y + 82);

  _carteFiligraneLogo(ctx, logo, C.W / 2, HDR_H + (C.H - HDR_H) / 2, 240);

  // ----- colonne gauche : photo -----
  // Le QR déménage au verso (voir genererCarteVersoCanvas) — c'est la
  // convention standard sur une carte de poche officielle : le recto
  // reste personnel (photo/identité), le verso porte le contrôle
  // d'authenticité et les mentions légales. Ça libère aussi la colonne
  // gauche : la photo grandit au lieu de laisser un vide sous un QR.
  const PHOTO_W = 210, PHOTO_H = 272;
  const PHOTO_X = L.MARGE, PHOTO_Y = HDR_H + 18;
  _carteFillRoundRect(ctx, PHOTO_X - 6, PHOTO_Y - 6, PHOTO_W + 12, PHOTO_H + 12, 16, C.BLANC);
  ctx.save();
  _carteRoundRect(ctx, PHOTO_X - 3, PHOTO_Y - 3, PHOTO_W + 6, PHOTO_H + 6, 13);
  ctx.strokeStyle = C.ORANGE; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  if (photo) {
    ctx.save();
    _carteRoundRect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 10);
    ctx.clip();
    _carteDrawImageCover(ctx, photo, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 0.15);
    ctx.restore();
  } else {
    _carteFillRoundRect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 10, C.BG);
    ctx.save();
    ctx.fillStyle = "rgba(122,158,149,0.55)";
    ctx.beginPath(); ctx.arc(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H * 0.34, 38, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H * 0.98, 72, Math.PI, 0); ctx.fill();
    ctx.restore();
  }
  // Petit repère sous la photo : renvoie au verso pour la vérification
  // plutôt que de laisser un vide muet.
  _carteFont(ctx, 10.5, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.textAlign = "center";
  const lblVerso = "Vérification au verso";
  ctx.fillText(lblVerso, PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H + 24);
  ctx.textAlign = "left";

  // ----- colonne droite : identité + infos -----
  const COL_X = PHOTO_X + PHOTO_W + 26;
  const COL_W = C.W - COL_X - L.MARGE;
  const PY_DEPART = HDR_H + 46;
  let py = PY_DEPART;

  // ----- redistribution structurelle de l'espace vertical -----
  // Le nombre de champs optionnels (sous-titre filière, niveau atteint)
  // varie d'un dossier à l'autre, mais le bloc du bas (devise + site)
  // reste ANCRÉ au bas de la carte. Avec des espacements fixes, un
  // dossier à peu de champs laissait un grand vide juste avant ce bloc
  // ancré (signalé deux fois par le PDG). Plutôt que d'ajouter encore
  // une constante à la main, on calcule la hauteur "naturelle" du
  // contenu (avec les espacements de base ci-dessous) et on redistribue
  // l'écart avec le bloc ancré comme respiration SUPPLÉMENTAIRE entre
  // les sections, pour que la carte occupe toute sa hauteur quel que
  // soit le nombre de champs renseignés.
  const hasSousTitre = !!filiereFmt.sousTitre;
  const hasNiveau    = !!apprenant.niveauAtteint;
  const FOOTER_RULE_Y_PREV = (C.H - L.MARGE - 4) - 30 - 34; // = RULE_Y, voir plus bas
  const finContenuNaturelle = PY_DEPART
    + 22 + 26 + 22 + 22
    + (hasSousTitre ? 20 : 0)
    + 6 + 22 + (38 + 26) + 32 + 44
    + (hasNiveau ? 44 : 0);
  const MARGE_AVANT_PIED = 24;
  const ecartDisponible = (FOOTER_RULE_Y_PREV - MARGE_AVANT_PIED) - finContenuNaturelle;
  // 4 points de respiration supplémentaires (après le filet sous le nom,
  // avant la pastille de statut, après la pastille, avant Réf./dates) —
  // bornée pour ne jamais écarter le contenu au point de le rendre
  // décousu si un dossier n'a presque aucun champ optionnel.
  const RESPIRATION = Math.max(0, Math.min(34, ecartDisponible / 4));

  const civilite  = String(apprenant.sexe || "").trim().toUpperCase() === "F" ? "Mme " : "";
  const nomComplet = `${civilite}${apprenant.prenom || ""} ${String(apprenant.nom || "").toUpperCase()}`.trim();
  _carteFont(ctx, 27, "800", "DM Sans");
  ctx.fillStyle = C.TEAL;
  {
    let taille = 27;
    _carteFont(ctx, taille, "800", "DM Sans");
    while (_carteMw(ctx, nomComplet) > COL_W && taille > 17) {
      taille -= 1;
      _carteFont(ctx, taille, "800", "DM Sans");
    }
    ctx.fillText(nomComplet, COL_X, py);
  }
  py += 22;
  ctx.fillStyle = C.ORANGE;
  ctx.fillRect(COL_X, py, 46, 3);
  py += 26 + RESPIRATION;

  _carteFont(ctx, 13, "700", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText((estStage ? "STAGE" : "FORMATION").toUpperCase(), COL_X, py);
  py += 22;
  _carteFont(ctx, 19, "700", "DM Sans");
  ctx.fillStyle = C.TEXTE;
  {
    let taille = 19;
    _carteFont(ctx, taille, "700", "DM Sans");
    while (_carteMw(ctx, filiereFmt.titre) > COL_W && taille > 13) {
      taille -= 1;
      _carteFont(ctx, taille, "700", "DM Sans");
    }
    ctx.fillText(filiereFmt.titre, COL_X, py);
  }
  py += 22;
  if (filiereFmt.sousTitre) {
    _carteFont(ctx, 13, "normal", "DM Sans");
    ctx.fillStyle = C.TEXTE_2;
    ctx.fillText(filiereFmt.sousTitre, COL_X, py);
    py += 20;
  }

  py += 6;
  ctx.fillStyle = C.BORDER;
  ctx.fillRect(COL_X, py, COL_W, 1.5);
  py += 22 + RESPIRATION;

  // Statut : pastille pleine largeur, plus lisible qu'un pill isolé sur
  // une carte de cette taille.
  const statutTxt = estStage
    ? (enCours ? "Stage en cours" : "Stage terminé")
    : (enCours ? "Formation en cours" : "Formation terminée");
  const statutCouleurs = enCours
    ? { bg: "rgba(245,166,35,0.16)", texte: "#B4740F" }
    : { bg: "rgba(15,110,86,0.13)",  texte: C.TEAL_MID };
  _carteFillRoundRect(ctx, COL_X, py, COL_W, 38, 9, statutCouleurs.bg);
  _carteFont(ctx, 15, "800", "DM Sans");
  ctx.fillStyle = statutCouleurs.texte;
  ctx.fillText((enCours ? "⌛  " : "✓  ") + statutTxt, COL_X + 14, py + 25);
  py += 38 + 26 + RESPIRATION;

  // Réf. + dates compactées sur 2 colonnes internes pour tenir dans la
  // hauteur restante. L'espacement de base est complété par RESPIRATION
  // (calculé plus haut) qui absorbe l'écart avec le bloc ancré du bas —
  // voir le commentaire à la déclaration de RESPIRATION.
  _carteFont(ctx, 13, "700", "DM Mono, monospace");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText(`Réf. ${apprenant.id || ""}`, COL_X, py);
  py += 32 + RESPIRATION;

  const DEMI_W = COL_W / 2 - 8;
  function _champCompact(x, w, label, valeur) {
    _carteFont(ctx, 11, "800", "DM Sans");
    ctx.fillStyle = C.TEXTE_3;
    ctx.fillText(label.toUpperCase(), x, py);
    _carteFont(ctx, 16, "700", "DM Sans");
    ctx.fillStyle = C.TEXTE;
    let taille = 16;
    _carteFont(ctx, taille, "700", "DM Sans");
    while (_carteMw(ctx, valeur) > w && taille > 10) {
      taille -= 1;
      _carteFont(ctx, taille, "700", "DM Sans");
    }
    ctx.fillText(valeur, x, py + 21);
  }

  const dateEntreeCourte = apprenant.dateEntree ? _carteFormatDateCourte(apprenant.dateEntree) : "—";
  const dateFinCourte    = apprenant.dateFin    ? _carteFormatDateCourte(apprenant.dateFin)    : null;

  _champCompact(COL_X, DEMI_W, estStage ? "Début stage" : "Début formation", dateEntreeCourte);
  if (dateFinCourte) {
    _champCompact(COL_X + DEMI_W + 16, DEMI_W, estStage ? "Fin stage" : "Fin validité", dateFinCourte);
  }
  py += 44;

  if (apprenant.niveauAtteint) {
    _champCompact(COL_X, COL_W, "Niveau atteint", String(apprenant.niveauAtteint));
    py += 44;
  }

  // ----- bloc bas ANCRÉ au bas de la carte (pas à la suite de py) -----
  // Contrairement au reste du contenu, ce bloc part du BAS de la carte
  // et remonte : il apparaît toujours à la même hauteur, qu'il y ait 2
  // ou 4 champs au-dessus. C'est ce qui comble le grand vide signalé —
  // un footer qui suit simplement le dernier champ laisse un trou de
  // taille variable selon le dossier, ce bloc ancré non.
  const FOOTER_SITE_Y = C.H - L.MARGE - 4;
  const TAGLINE_Y      = FOOTER_SITE_Y - 30;
  const RULE_Y          = TAGLINE_Y - 34;

  ctx.fillStyle = C.ORANGE;
  ctx.fillRect(COL_X, RULE_Y, 64, 3);

  const policeTagline = document.fonts.check("26px 'Great Vibes'")
    ? "26px 'Great Vibes'"
    : "italic 17px Georgia, serif";
  ctx.font = policeTagline;
  ctx.fillStyle = C.TEAL_MID;
  ctx.fillText("Plus de compétences pour un meilleur demain", COL_X, TAGLINE_Y);

  _carteFont(ctx, 11, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText(CARTE_ENTREPRISE.SITE, COL_X, FOOTER_SITE_Y);

  // Averti visuellement si le contenu dynamique (rare : nom très long +
  // tous les champs optionnels) a dépassé la zone réservée avant le
  // bloc ancré — en développement seulement, jamais visible à l'usage
  // normal, mais évite un chevauchement silencieux si une future
  // modification ajoute un champ sans revoir cet espacement.
  if (py > RULE_Y - 10 && console && console.warn) {
    console.warn("[CARTE] Contenu du recto proche du bloc ancré du bas — vérifier l'espacement.");
  }

  ctx.restore(); // clip carte

  return canvas;
}

/* ==================================================================
   VERSO — mentions légales, vérification, signatures PDG + Formateur
   ------------------------------------------------------------------
   Convention standard sur une carte officielle : le recto reste
   personnel (photo, identité, formation), le verso porte tout ce qui
   authentifie le document — QR de vérification, RCCM/IFU, signatures +
   cachets du PDG ET du Formateur Principal, coordonnées du centre —
   plus la devise de la marque. Deux signataires (pas un seul) depuis
   le 22/09/2026 : le cachet du Formateur Principal ne remplace jamais
   celui du PDG, il s'y ajoute dans un second bloc.
================================================================== */
async function genererCarteVersoCanvas(apprenant, token) {
  await _chargerPoliceScriptCarte();

  const C = CARTE_C;
  const L = CARTE_LAYOUT;

  const canvas = document.createElement("canvas");
  canvas.width  = C.W;
  canvas.height = C.H;
  const ctx = canvas.getContext("2d");

  const CARTE_VERIF_URL = "https://qualitededieuservice.com/verifier-document";
  const lienVerif = token ? `${CARTE_VERIF_URL}?t=${encodeURIComponent(token)}` : CARTE_VERIF_URL;

  const [logo, qr, signature, cachet, signatureFormateur, cachetFormateur] = await Promise.all([
    _carteLoadImg(CARTE_ENTREPRISE.LOGO_URL),
    _carteChargerQR(lienVerif),
    _carteLoadImg(CARTE_ENTREPRISE.SIGNATURE_PDG_URL),
    _carteLoadImg(CARTE_ENTREPRISE.CACHET_URL),
    _carteLoadImg(CARTE_ENTREPRISE.SIGNATURE_FORMATEUR_URL),
    _carteLoadImg(CARTE_ENTREPRISE.CACHET_FORMATEUR_URL),
  ]);

  // ----- fond + bordure -----
  _carteFillRoundRect(ctx, 0, 0, C.W, C.H, L.RAYON, C.BLANC);
  ctx.save();
  _carteRoundRect(ctx, 2, 2, C.W - 4, C.H - 4, L.RAYON - 2);
  ctx.strokeStyle = C.BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  _carteRoundRect(ctx, 0, 0, C.W, C.H, L.RAYON);
  ctx.clip();

  // ----- bandeau haut, plus discret qu'au recto -----
  const HDR_H = 74;
  _carteFillRoundRect(ctx, 0, 0, C.W, HDR_H, 0, C.TEAL);
  ctx.fillStyle = C.ORANGE;
  ctx.fillRect(0, HDR_H - 4, C.W, 4);

  if (logo) {
    const LD = 44;
    ctx.save();
    _carteRoundRect(ctx, L.MARGE, (HDR_H - LD) / 2 - 2, LD, LD, 9);
    ctx.clip();
    _carteDrawImageCover(ctx, logo, L.MARGE, (HDR_H - LD) / 2 - 2, LD, LD);
    ctx.restore();
  }
  _carteFont(ctx, 15, "800", "DM Sans");
  ctx.fillStyle = C.BLANC;
  ctx.fillText(CARTE_ENTREPRISE.NOM, L.MARGE + 58, HDR_H / 2 - 3);
  _carteFont(ctx, 11, "normal", "DM Sans");
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Carte d'apprentissage — Verso", L.MARGE + 58, HDR_H / 2 + 15);

  _carteFont(ctx, 11, "700", "DM Mono, monospace");
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.textAlign = "right";
  ctx.fillText(`Réf. ${apprenant.id || ""}`, C.W - L.MARGE, HDR_H / 2 + 4);
  ctx.textAlign = "left";

  _carteFiligraneLogo(ctx, logo, C.W / 2, HDR_H + (C.H - HDR_H) / 2, 240);

  // ----- colonne gauche : QR de vérification -----
  const QR_D = 148;
  const QR_X = L.MARGE, QR_Y = HDR_H + 26;
  _carteFillRoundRect(ctx, QR_X - 8, QR_Y - 8, QR_D + 16, QR_D + 16, 12, C.BLANC);
  ctx.save();
  ctx.strokeStyle = C.BORDER; ctx.lineWidth = 1.5;
  _carteRoundRect(ctx, QR_X - 8, QR_Y - 8, QR_D + 16, QR_D + 16, 12);
  ctx.stroke();
  ctx.restore();
  if (qr) {
    ctx.drawImage(qr, QR_X, QR_Y, QR_D, QR_D);
  } else {
    // Repli si le service de génération de QR est injoignable (coupure
    // réseau côté navigateur) — jamais un cadre vide sans explication à
    // côté d'un texte qui dit "scannez ceci".
    _carteFont(ctx, 11, "normal", "DM Sans");
    ctx.fillStyle = C.TEXTE_3;
    ctx.textAlign = "center";
    ctx.fillText("QR indisponible", QR_X + QR_D / 2, QR_Y + QR_D / 2 - 6);
    ctx.fillText("(hors ligne)", QR_X + QR_D / 2, QR_Y + QR_D / 2 + 10);
    ctx.textAlign = "left";
  }
  _carteFont(ctx, 11.5, "800", "DM Sans");
  ctx.fillStyle = C.TEAL_MID;
  ctx.textAlign = "center";
  ctx.fillText("SCANNER POUR VÉRIFIER", QR_X + QR_D / 2, QR_Y + QR_D + 26);
  _carteFont(ctx, 10, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText("l'authenticité de ce document", QR_X + QR_D / 2, QR_Y + QR_D + 42);
  ctx.textAlign = "left";

  // ----- colonne droite : identité légale + contact -----
  const COL_X = QR_X + QR_D + 34;
  const COL_W = C.W - COL_X - L.MARGE;
  let py = HDR_H + 46;

  _carteFont(ctx, 15, "800", "DM Sans");
  ctx.fillStyle = C.TEAL;
  ctx.fillText(CARTE_ENTREPRISE.NOM + " SARL", COL_X, py);
  py += 20;
  _carteFont(ctx, 12, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_2;
  ctx.fillText("Centre de formation professionnelle", COL_X, py);
  py += 24;

  _carteFont(ctx, 11.5, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_2;
  py = _carteWrap(ctx, CARTE_ENTREPRISE.ADRESSE, COL_X, py, COL_W, 16);
  py += 4;
  ctx.fillText(CARTE_ENTREPRISE.TEL, COL_X, py);
  py += 22;

  // Mentions légales — mêmes numéros que sur l'attestation, réponse
  // directe à "faut-il les mettre" : oui, mais ici au verso plutôt que
  // sur le recto déjà chargé (voir échange avec le PDG, 22/09/2026).
  ctx.fillStyle = C.BORDER;
  ctx.fillRect(COL_X, py, COL_W, 1.5);
  py += 20;
  _carteFont(ctx, 11, "700", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText(`RCCM ${CARTE_ENTREPRISE.RCCM}`, COL_X, py);
  py += 18;
  ctx.fillText(`IFU ${CARTE_ENTREPRISE.IFU}`, COL_X, py);
  py += 30;

  // ----- signatures + cachets : PDG et Formateur Principal, côte à côte -----
  // Deux signataires distincts depuis le 22/09/2026 — le cachet du Formateur
  // (icons/cachet-formateur.png) ne remplace jamais celui du PDG, voir le
  // commentaire en tête de cette fonction.
  const SIG_W = 190, SIG_BOTTOM = py + 96;
  const SIG2_X = COL_X + SIG_W + 40;

  function _carteDessinerSignataire(x, sigImg, cachetImg, nom, titre) {
    ctx.save();
    ctx.strokeStyle = C.BORDER; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x, SIG_BOTTOM); ctx.lineTo(x + SIG_W, SIG_BOTTOM); ctx.stroke();
    ctx.restore();

    if (cachetImg) {
      // Le cachet est presque toujours une image non carrée (tampon rond ou
      // ovale sur fond souvent rectangulaire) : un drawImage forcé en 96x96
      // l'écrase/l'étire. On l'inscrit ici dans une boîte MAX de 96x96 en
      // conservant son ratio natif, comme pour la signature juste en dessous.
      const CACHET_MAX = 96;
      const ratioC = cachetImg.height / cachetImg.width;
      let cW = CACHET_MAX, cH = Math.round(CACHET_MAX * ratioC);
      if (cH > CACHET_MAX) { cH = CACHET_MAX; cW = Math.round(CACHET_MAX / ratioC); }
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(cachetImg, x + SIG_W - cW, py - 6 + (CACHET_MAX - cH) / 2, cW, cH);
      ctx.restore();
    }
    if (sigImg) {
      // Même précaution que pour le cachet juste au-dessus : la hauteur
      // cible (60) écrasait certaines signatures larges (ex.
      // signature-pdg.png, qui inclut son propre cachet et est donc plus
      // large que haute) sans recalculer la largeur en conséquence —
      // l'image ressortait aplatie/ovale. Signalé par le PDG le
      // 22/09/2026 (visible sur la carte ET sur les attestations avant
      // ce correctif).
      // Plafond de hauteur aligné sur celui du cachet juste au-dessus (96)
      // — avec l'ancien plafond de 60, le cachet du PDG (intégré dans la
      // signature) ressortait correct mais minuscule à côté du cachet du
      // Formateur (96px) une fois le ratio respecté. Largeur plafonnée à
      // SIG_W, toute la colonne étant disponible puisque ce bloc n'a pas
      // de cachet séparé (cachetImg est vide pour le PDG). Signalé par le
      // PDG le 22/09/2026.
      const ratio = sigImg.height / sigImg.width;
      const SIG_MAX_W = SIG_W, SIG_MAX_H = 96;
      let sigW = SIG_MAX_W, sigH = Math.round(SIG_MAX_W * ratio);
      if (sigH > SIG_MAX_H) { sigH = SIG_MAX_H; sigW = Math.round(SIG_MAX_H / ratio); }
      ctx.drawImage(sigImg, x + 6, SIG_BOTTOM - sigH - 4, sigW, sigH);
    }

    _carteFont(ctx, 12, "700", "DM Sans");
    ctx.fillStyle = C.TEAL;
    ctx.fillText(nom, x, SIG_BOTTOM + 18);
    _carteFont(ctx, 10.5, "normal", "DM Sans");
    ctx.fillStyle = C.TEXTE_3;
    ctx.fillText(titre, x, SIG_BOTTOM + 34);
  }

  _carteDessinerSignataire(COL_X, signature, cachet, CARTE_ENTREPRISE.SIGNATAIRE_PDG, CARTE_ENTREPRISE.SIGNATAIRE_TITRE);
  _carteDessinerSignataire(SIG2_X, signatureFormateur, cachetFormateur, CARTE_ENTREPRISE.SIGNATAIRE_FORMATEUR, CARTE_ENTREPRISE.SIGNATAIRE_FORMATEUR_TITRE);

  // ----- bandeau bas : devise, ancré comme au recto -----
  // Empilé depuis la limite basse de sécurité (C.H - MARGE) vers le
  // haut, jamais l'inverse — sinon le texte le plus bas déborde dans la
  // marge de sécurité et risque d'être rogné à la découpe/plastification.
  const BAS_SECURITE  = C.H - L.MARGE;
  const MENTION_Y = BAS_SECURITE - 6;
  const DEVISE_Y  = MENTION_Y - 24;
  const RULE_Y    = DEVISE_Y - 26;

  ctx.fillStyle = C.ORANGE;
  ctx.fillRect(C.W / 2 - 60, RULE_Y, 120, 1.5);

  const policeDevise = document.fonts.check("24px 'Great Vibes'")
    ? "24px 'Great Vibes'"
    : "italic 16px Georgia, serif";
  ctx.font = policeDevise;
  ctx.fillStyle = C.TEAL_MID;
  ctx.textAlign = "center";
  ctx.fillText("« Plus de compétences pour un meilleur demain »", C.W / 2, DEVISE_Y);
  ctx.textAlign = "left";

  _carteFont(ctx, 9.5, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.textAlign = "center";
  ctx.fillText("Cette carte demeure la propriété de LES QUALITÉS DE DIEU SERVICE — en cas de perte, contacter le centre.", C.W / 2, MENTION_Y);
  ctx.textAlign = "left";

  ctx.restore(); // clip carte

  return canvas;
}

async function afficherCarteCanvas(apprenant, token) {
  const preview = document.getElementById("carte-preview");
  if (!preview) return;

  preview.innerHTML = `
    <div style="text-align:center;padding:2.5rem;">
      <div style="display:inline-block;width:44px;height:44px;border:3px solid rgba(245,166,35,0.3);
           border-top-color:#F5A623;border-radius:50%;animation:pk-spin 0.8s linear infinite;"></div>
      <p style="margin-top:1rem;font-size:0.9rem;opacity:0.7;">Génération de la carte (recto + verso)...</p>
    </div>`;

  try {
    const [rectoCanvas, versoCanvas] = await Promise.all([
      genererCarteCanvas(apprenant, token),
      genererCarteVersoCanvas(apprenant, token),
    ]);
    const rectoURL = rectoCanvas.toDataURL("image/png");
    const versoURL = versoCanvas.toDataURL("image/png");

    preview.innerHTML = `
      <div style="text-align:center;background:#12241f;padding:18px 10px;border-radius:8px;">
        <div style="display:grid;grid-template-columns:1fr;gap:14px;max-width:460px;margin:0 auto;">
          <div>
            <p style="font-size:0.72rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:6px;">Recto</p>
            <img src="${rectoURL}" style="width:100%;height:auto;border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,0.4);" alt="Recto de la carte d'apprentissage" />
          </div>
          <div>
            <p style="font-size:0.72rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:6px;">Verso</p>
            <img src="${versoURL}" style="width:100%;height:auto;border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,0.4);" alt="Verso de la carte d'apprentissage" />
          </div>
        </div>
        <p style="margin-top:14px;font-size:0.78rem;color:rgba(255,255,255,0.55);">
          Format carte de poche CR80 (85,6 x 54 mm) — recto/verso prêts à imprimer et plastifier.
        </p>
      </div>`;

    const btnPDF = document.getElementById("btn-telecharger-carte-pdf");
    if (btnPDF) btnPDF.onclick = () => telechargerCarte(rectoCanvas, versoCanvas, apprenant.id, "pdf");
    const btnPNG = document.getElementById("btn-telecharger-carte-png");
    if (btnPNG) btnPNG.onclick = () => telechargerCarte(rectoCanvas, versoCanvas, apprenant.id, "png");

  } catch (err) {
    preview.innerHTML = `
      <div style="padding:2rem;text-align:center;color:#E24B4A;">
        <p style="font-size:1rem;margin-bottom:0.5rem;">Erreur de génération</p>
        <p style="font-size:0.85rem;opacity:0.7;">${err.message}</p>
      </div>`;
  }
}

// `rectoCanvas` + `versoCanvas` : les deux faces sont TOUJOURS livrées
// ensemble — une carte imprimée sans son verso perd la vérification, les
// mentions légales et la signature du PDG, ce qui viderait le travail
// fait sur le verso de son sens.
async function telechargerCarte(rectoCanvas, versoCanvas, id, format = "pdf") {
  const dateISO = new Date().toISOString().split("T")[0];

  if (format === "png") {
    // Deux fichiers séparés (pas un montage recto+verso dans une seule
    // image) : une plastifieuse/imprimante veut deux images distinctes
    // pour un recto-verso, pas une image composite.
    const a1 = document.createElement("a");
    a1.href = rectoCanvas.toDataURL("image/png");
    a1.download = `Carte-apprentissage_${id}_${dateISO}_recto.png`;
    a1.click();
    setTimeout(() => {
      const a2 = document.createElement("a");
      a2.href = versoCanvas.toDataURL("image/png");
      a2.download = `Carte-apprentissage_${id}_${dateISO}_verso.png`;
      a2.click();
    }, 400);
    if (window.showToast) showToast("Images téléchargées (recto + verso)", "success");
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
    // Format réel CR80 (85,6 x 54 mm), taille exacte d'impression — pas
    // une feuille A5 avec la carte dedans : chaque page du PDF EST une
    // face de la carte, prête à découper/plastifier directement.
    // 2 pages : page 1 = recto, page 2 = verso — impression recto-verso
    // standard (la plupart des imprimantes/logiciels d'impression
    // proposent "recto-verso" directement depuis un PDF multi-pages).
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
    pdf.addImage(rectoCanvas.toDataURL("image/png"), "PNG", 0, 0, 85.6, 54);
    pdf.addPage([85.6, 54], "landscape");
    pdf.addImage(versoCanvas.toDataURL("image/png"), "PNG", 0, 0, 85.6, 54);
    pdf.save(`Carte-apprentissage_${id}_${dateISO}.pdf`);
    if (window.showToast) showToast("PDF téléchargé avec succès (2 pages, recto + verso, format CR80)", "success");
  } catch (err) {
    if (window.showToast) showToast("Erreur PDF : " + err.message, "error");
    const a = document.createElement("a");
    a.href = rectoCanvas.toDataURL("image/png");
    a.download = `Carte-apprentissage_${id}_${dateISO}_recto.png`;
    a.click();
  }
}

window.genererCarteCanvas      = genererCarteCanvas;
window.genererCarteVersoCanvas = genererCarteVersoCanvas;
window.afficherCarteCanvas     = afficherCarteCanvas;
window.telechargerCarte    = telechargerCarte;

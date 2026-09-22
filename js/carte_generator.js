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

  const CARTE_VERIF_URL = "https://qualitededieuservice.com/verifier-document";
  const lienVerif = token ? `${CARTE_VERIF_URL}?t=${encodeURIComponent(token)}` : "";

  const [logo, photo, qr] = await Promise.all([
    _carteLoadImg(CARTE_ENTREPRISE.LOGO_URL),
    _carteLoadImg(apprenant.photoUrl),
    _carteChargerQR(lienVerif),
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

  // ----- colonne gauche : photo + QR -----
  const PHOTO_W = 186, PHOTO_H = 224;
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
    ctx.beginPath(); ctx.arc(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H * 0.36, 32, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H * 0.98, 60, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  // QR de vérification sous la photo, dans l'espace restant de la
  // colonne gauche — absent si aucun token (carte générée sans accès
  // au dossier, cas théorique uniquement).
  if (qr) {
    const QR_D = C.H - (PHOTO_Y + PHOTO_H) - L.MARGE - 22;
    const QR_D_CLAMPED = Math.max(0, Math.min(QR_D, PHOTO_W));
    if (QR_D_CLAMPED > 40) {
      const QR_X = PHOTO_X + (PHOTO_W - QR_D_CLAMPED) / 2, QR_Y = PHOTO_Y + PHOTO_H + 14;
      ctx.drawImage(qr, QR_X, QR_Y, QR_D_CLAMPED, QR_D_CLAMPED);
      _carteFont(ctx, 11, "normal", "DM Sans");
      ctx.fillStyle = C.TEXTE_3;
      const lbl = "Scanner pour vérifier";
      ctx.fillText(lbl, PHOTO_X + (PHOTO_W - _carteMw(ctx, lbl)) / 2, QR_Y + QR_D_CLAMPED + 16);
    }
  }

  // ----- colonne droite : identité + infos -----
  const COL_X = PHOTO_X + PHOTO_W + 26;
  const COL_W = C.W - COL_X - L.MARGE;
  let py = HDR_H + 46;

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
  py += 26;

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
  py += 22;

  // Statut : pastille pleine largeur, plus lisible qu'un pill isolé sur
  // une carte de cette taille.
  const statutTxt = estStage
    ? (enCours ? "Stage en cours" : "Stage terminé")
    : (enCours ? "Formation en cours" : "Formation terminée");
  const statutCouleurs = enCours
    ? { bg: "rgba(245,166,35,0.16)", texte: "#B4740F" }
    : { bg: "rgba(15,110,86,0.13)",  texte: C.TEAL_MID };
  _carteFillRoundRect(ctx, COL_X, py, COL_W, 34, 8, statutCouleurs.bg);
  _carteFont(ctx, 14, "800", "DM Sans");
  ctx.fillStyle = statutCouleurs.texte;
  ctx.fillText((enCours ? "⌛  " : "✓  ") + statutTxt, COL_X + 12, py + 23);
  py += 34 + 18;

  // Réf. + dates compactées sur 2 colonnes internes pour tenir dans la
  // hauteur restante.
  _carteFont(ctx, 12, "700", "DM Mono, monospace");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText(`Réf. ${apprenant.id || ""}`, COL_X, py);
  py += 24;

  const DEMI_W = COL_W / 2 - 8;
  function _champCompact(x, w, label, valeur) {
    _carteFont(ctx, 10.5, "800", "DM Sans");
    ctx.fillStyle = C.TEXTE_3;
    ctx.fillText(label.toUpperCase(), x, py);
    _carteFont(ctx, 15, "700", "DM Sans");
    ctx.fillStyle = C.TEXTE;
    let taille = 15;
    _carteFont(ctx, taille, "700", "DM Sans");
    while (_carteMw(ctx, valeur) > w && taille > 10) {
      taille -= 1;
      _carteFont(ctx, taille, "700", "DM Sans");
    }
    ctx.fillText(valeur, x, py + 19);
  }

  const dateEntreeCourte = apprenant.dateEntree ? _carteFormatDateCourte(apprenant.dateEntree) : "—";
  const dateFinCourte    = apprenant.dateFin    ? _carteFormatDateCourte(apprenant.dateFin)    : null;

  _champCompact(COL_X, DEMI_W, estStage ? "Début stage" : "Début formation", dateEntreeCourte);
  if (dateFinCourte) {
    _champCompact(COL_X + DEMI_W + 16, DEMI_W, estStage ? "Fin stage" : "Fin validité", dateFinCourte);
  }
  py += 36;

  if (apprenant.niveauAtteint) {
    _champCompact(COL_X, COL_W, "Niveau atteint", String(apprenant.niveauAtteint));
    py += 36;
  }

  // ----- pied de carte : site web -----
  _carteFont(ctx, 10.5, "normal", "DM Sans");
  ctx.fillStyle = C.TEXTE_3;
  ctx.fillText("qualitededieuservice.com", COL_X, C.H - L.MARGE + 4);

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
      <p style="margin-top:1rem;font-size:0.9rem;opacity:0.7;">Génération de la carte...</p>
    </div>`;

  try {
    const canvas  = await genererCarteCanvas(apprenant, token);
    const dataURL = canvas.toDataURL("image/png");

    preview.innerHTML = `
      <div style="text-align:center;background:#12241f;padding:18px 10px;border-radius:8px;">
        <img src="${dataURL}" style="max-width:100%;height:auto;border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,0.4);" alt="Aperçu carte d'apprentissage (format CR80)" />
        <p style="margin-top:12px;font-size:0.78rem;color:rgba(255,255,255,0.55);">
          Format carte de poche CR80 (85,6 x 54 mm) — prête à imprimer et plastifier.
        </p>
      </div>`;

    const btnPDF = document.getElementById("btn-telecharger-carte-pdf");
    if (btnPDF) btnPDF.onclick = () => telechargerCarte(canvas, apprenant.id, "pdf");
    const btnPNG = document.getElementById("btn-telecharger-carte-png");
    if (btnPNG) btnPNG.onclick = () => telechargerCarte(canvas, apprenant.id, "png");

  } catch (err) {
    preview.innerHTML = `
      <div style="padding:2rem;text-align:center;color:#E24B4A;">
        <p style="font-size:1rem;margin-bottom:0.5rem;">Erreur de génération</p>
        <p style="font-size:0.85rem;opacity:0.7;">${err.message}</p>
      </div>`;
  }
}

async function telechargerCarte(canvas, id, format = "pdf") {
  const dateISO = new Date().toISOString().split("T")[0];

  if (format === "png") {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `Carte-apprentissage_${id}_${dateISO}.png`;
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
    const imgData = canvas.toDataURL("image/png");
    // Format réel CR80 (85,6 x 54 mm), taille exacte d'impression — pas
    // une feuille A5 avec la carte dedans : le PDF EST la carte, prête à
    // découper/plastifier directement. `format` en tableau [largeur,
    // hauteur] force jsPDF à une page sur mesure plutôt qu'un format
    // standard.
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
    pdf.addImage(imgData, "PNG", 0, 0, 85.6, 54);
    pdf.save(`Carte-apprentissage_${id}_${dateISO}.pdf`);
    if (window.showToast) showToast("PDF téléchargé avec succès (format CR80, prêt à imprimer)", "success");
  } catch (err) {
    if (window.showToast) showToast("Erreur PDF : " + err.message, "error");
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `Carte-apprentissage_${id}_${dateISO}.png`;
    a.click();
  }
}

window.genererCarteCanvas  = genererCarteCanvas;
window.afficherCarteCanvas = afficherCarteCanvas;
window.telechargerCarte    = telechargerCarte;

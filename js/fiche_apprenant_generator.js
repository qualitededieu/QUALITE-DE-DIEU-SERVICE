"use strict";

const DPI_FICHE = 300;
function _fMmToPx(mm) { return Math.round(mm * DPI_FICHE / 25.4); }

const FICHE = {
  W_MM: 148, H_MM: 210,
  MARINE: "#04342C", MARINE_2: "#0F6E56", OR: "#F5A623", OR_LIGHT: "#FABD50",
  BLANC: "#FFFFFF", CREME: "#F8F7F2", GRIS: "#6B7280", TEXTE: "#1A1A2E",
};
FICHE.W = _fMmToPx(FICHE.W_MM);
FICHE.H = _fMmToPx(FICHE.H_MM);
FICHE.MARGE = _fMmToPx(10);

const FICHE_ENTREPRISE = {
  NOM: "LES QUALITÉS DE DIEU SERVICE",
  ADRESSE: "Comé, Hongodé — Bénin",
  SITE: "www.qualitededieuservice.com",
  LOGO_URL: "icons/logoqds.jpg",
  // Mêmes mentions légales que sur l'attestation (voir ATT_ENTREPRISE dans
  // attestation_generator.js) — la fiche apprenant est aussi un document
  // administratif qui peut sortir du centre, elle doit donc les porter.
  RCCM: "RB/ABC/23 B 7078",
  IFU:  "3202357917037",
};

function _fFont(ctx, size, style = "normal", family = "DM Sans, Arial") {
  ctx.font = `${style} ${size}px '${family}', Arial, sans-serif`;
}
function _fMw(ctx, txt) { return ctx.measureText(txt).width; }
function _fRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill();
}
function _fRectFill(ctx, x, y, w, h, colorOrGrad) { ctx.save(); ctx.fillStyle = colorOrGrad; ctx.fillRect(x, y, w, h); ctx.restore(); }
function _fClipRound(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.clip();
}
function _fLoadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => resolve(null);
    img.src = src;
  });
}
function _fDrawCover(ctx, img, x, y, w, h, topBias = 0.5) {
  const imgRatio = img.width / img.height, boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) { sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) * topBias; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function _fWrap(ctx, texte, x, y, maxW, lh) {
  const mots = String(texte).split(" ");
  let ligne = "", curY = y;
  for (const mot of mots) {
    const test = ligne ? ligne + " " + mot : mot;
    if (_fMw(ctx, test) > maxW && ligne) { ctx.fillText(ligne, x, curY); curY += lh; ligne = mot; }
    else ligne = test;
  }
  if (ligne) { ctx.fillText(ligne, x, curY); curY += lh; }
  return curY;
}
function _fWrapCentre(ctx, texte, cx, y, maxW, lh) {
  const mots = String(texte).split(" ");
  let ligne = "", lignes = [];
  for (const mot of mots) {
    const test = ligne ? ligne + " " + mot : mot;
    if (_fMw(ctx, test) > maxW && ligne) { lignes.push(ligne); ligne = mot; }
    else ligne = test;
  }
  if (ligne) lignes.push(ligne);
  let curY = y;
  lignes.forEach(l => { ctx.fillText(l, cx - _fMw(ctx, l) / 2, curY); curY += lh; });
  return curY;
}
function _fIconUrl(nom, couleur, taille = 70) {
  return `https://api.iconify.design/${nom}.svg?color=${encodeURIComponent(couleur)}&width=${taille}&height=${taille}`;
}
async function _fChargerIcones(liste) {
  const entries = await Promise.all(liste.map(async ([cle, nom, c]) => [cle, await _fLoadImg(_fIconUrl(nom, c))]));
  return Object.fromEntries(entries);
}

const TEL_URGENCE_FICHE = "+229 01 97 95 12 30";

function _fLigne(ctx, icone, x, y, label, valeur, tailleLabel = 22, tailleValeur = 30) {
  if (icone) ctx.drawImage(icone, x, y - 26, 30, 30);
  const decal = icone ? 40 : 0;
  _fFont(ctx, tailleLabel, "700"); ctx.fillStyle = FICHE.OR;
  ctx.fillText(label, x + decal, y - 4);
  _fFont(ctx, tailleValeur, "700"); ctx.fillStyle = FICHE.TEXTE;
  ctx.fillText(valeur, x + decal, y + 26);
}

async function genererFicheApprenant(apprenant, token) {
  const LOGO_URL = FICHE_ENTREPRISE.LOGO_URL;
  const SIG_SRC    = typeof SIGNATURE_PDG_DATA !== "undefined" ? SIGNATURE_PDG_DATA : "icons/signature-pdg.png?v=2";
  const CACHET_SRC = typeof CACHET_DATA    !== "undefined" ? CACHET_DATA    : "icons/cachet.png?v=2";
  const FICHE_VERIF_URL = `https://${FICHE_ENTREPRISE.SITE}/verifier-document`;
  const lienVerif = token
    ? `${FICHE_VERIF_URL}?t=${encodeURIComponent(token)}`
    : FICHE_VERIF_URL;
  const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=1&data=" + encodeURIComponent(lienVerif);

  const icones = await _fChargerIcones([
    ["identifiant", "mdi:card-account-details-outline", FICHE.OR],
    ["debut", "mdi:calendar-start-outline", FICHE.OR],
    ["duree", "mdi:clock-outline", FICHE.OR],
    ["fin", "mdi:calendar-check-outline", FICHE.OR],
    ["naissance", "mdi:cake-variant-outline", FICHE.OR],
    ["sexe", "mdi:account-outline", FICHE.OR],
    ["centre", "mdi:office-building-outline", FICHE.OR],
    ["reglement", "mdi:file-document-outline", FICHE.OR_LIGHT],
    ["avantages", "mdi:star-outline", FICHE.OR_LIGHT],
    ["contacts", "mdi:phone-alert-outline", FICHE.OR_LIGHT],
  ]);

  const [logo, photo, qr, sig, cachet] = await Promise.all([
    _fLoadImg(LOGO_URL), _fLoadImg(apprenant.photoUrl), _fLoadImg(QR_URL), _fLoadImg(SIG_SRC), _fLoadImg(CACHET_SRC),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = FICHE.W; canvas.height = FICHE.H;
  const ctx = canvas.getContext("2d");
  const W = FICHE.W, H = FICHE.H, M = FICHE.MARGE;

  _fRectFill(ctx, 0, 0, W, H, FICHE.CREME);

  const HEADER_H = 260;
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, FICHE.MARINE); grad.addColorStop(1, FICHE.MARINE_2);
  _fRectFill(ctx, 0, 0, W, HEADER_H, grad);
  _fRectFill(ctx, 0, HEADER_H - 6, W, 6, FICHE.OR);

  ctx.save();
  ctx.beginPath(); ctx.arc(140, 130, 78, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fill();
  ctx.beginPath(); ctx.arc(140, 130, 78, 0, Math.PI * 2); ctx.strokeStyle = FICHE.OR; ctx.lineWidth = 4; ctx.stroke();
  if (logo) { ctx.save(); ctx.beginPath(); ctx.arc(140, 130, 66, 0, Math.PI * 2); ctx.clip(); _fDrawCover(ctx, logo, 74, 64, 132, 132); ctx.restore(); }
  ctx.restore();

  _fFont(ctx, 40, "700"); ctx.fillStyle = FICHE.BLANC;
  ctx.fillText(FICHE_ENTREPRISE.NOM.split(" ").slice(0, 3).join(" "), 250, 108);
  _fFont(ctx, 26, "500"); ctx.fillStyle = FICHE.OR_LIGHT;
  ctx.fillText("FICHE APPRENANT DÉTAILLÉE", 250, 160);
  _fFont(ctx, 20, "400"); ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Complément d'information à la carte d'apprenant", 250, 194);

  const PH_W = 230, PH_H = 285, PH_X = W - M - PH_W, PH_Y = HEADER_H + 40;
  ctx.save();
  ctx.shadowColor = "rgba(13,43,94,0.25)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  _fRoundRect(ctx, PH_X - 6, PH_Y - 6, PH_W + 12, PH_H + 12, 14, FICHE.OR);
  ctx.restore();
  ctx.save(); _fClipRound(ctx, PH_X, PH_Y, PH_W, PH_H, 10);
  if (photo) _fDrawCover(ctx, photo, PH_X, PH_Y, PH_W, PH_H, 0.15);
  else { ctx.fillStyle = "#E5E0D5"; ctx.fillRect(PH_X, PH_Y, PH_W, PH_H); }
  ctx.restore();

  const sexeNorm = String(apprenant.sexe || "").trim().toUpperCase();
  const civ = sexeNorm === "F" ? "Mme" : (sexeNorm === "M" ? "M." : "");
  const nomComplet = (civ ? civ + " " : "") + (apprenant.prenom || "").toUpperCase() + " " + (apprenant.nom || "").toUpperCase();
  _fFont(ctx, 38, "700"); ctx.fillStyle = FICHE.MARINE;
  _fWrap(ctx, nomComplet, M, HEADER_H + 90, PH_X - M - 30, 46);
  ctx.save(); ctx.fillStyle = FICHE.OR; ctx.fillRect(M, HEADER_H + 108, 100, 5); ctx.restore();

  _fFont(ctx, 26, "500"); ctx.fillStyle = FICHE.GRIS;
  ctx.fillText(apprenant.filiere || "—", M, HEADER_H + 156);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
  let duree = "—";
  if (apprenant.dateEntree && apprenant.dateFin) {
    const j = Math.round((new Date(apprenant.dateFin) - new Date(apprenant.dateEntree)) / 86400000);
    if (j > 0) duree = j > 60 ? Math.round(j / 30) + " mois" : j + " jours";
  }

  const colGX = M, colDX = W / 2 + 20;
  let yG = HEADER_H + 250, yD = HEADER_H + 250;
  const pas = 110;

  _fLigne(ctx, icones.identifiant, colGX, yG, "IDENTIFIANT", apprenant.id); yG += pas;
  _fLigne(ctx, icones.debut, colGX, yG, "DÉBUT DE FORMATION", fmtDate(apprenant.dateEntree)); yG += pas;
  _fLigne(ctx, icones.duree, colGX, yG, "DURÉE", duree); yG += pas;
  _fLigne(ctx, icones.fin, colGX, yG, "FIN PRÉVUE", fmtDate(apprenant.dateFin)); yG += pas;

  _fLigne(ctx, icones.naissance, colDX, yD, "DATE DE NAISSANCE", apprenant.dateNaissance ? fmtDate(apprenant.dateNaissance) : "—"); yD += pas;
  _fLigne(ctx, icones.sexe, colDX, yD, "SEXE", sexeNorm === "F" ? "Féminin" : (sexeNorm === "M" ? "Masculin" : "—")); yD += pas;
  _fLigne(ctx, icones.centre, colDX, yD, "CENTRE DE FORMATION", "Comé, Bénin"); yD += pas;
  _fLigne(ctx, null, colDX, yD, "VALIDITÉ DE LA CARTE", "Jusqu'au " + (apprenant.dateFin ? fmtDate(apprenant.dateFin) : "fin de formation")); yD += pas;

  const BAND_Y = Math.max(yG, yD) + 40;
  const BAND_H = 780;
  const gradBand = ctx.createLinearGradient(0, BAND_Y, 0, BAND_Y + BAND_H);
  gradBand.addColorStop(0, FICHE.MARINE); gradBand.addColorStop(1, FICHE.MARINE_2);
  _fRectFill(ctx, 0, BAND_Y, W, BAND_H, gradBand);

  const COL_W = (W - 2 * M) / 3;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1.5;
  [1, 2].forEach(i => {
    ctx.beginPath(); ctx.moveTo(M + COL_W * i, BAND_Y + 40); ctx.lineTo(M + COL_W * i, BAND_Y + BAND_H - 40); ctx.stroke();
  });
  ctx.restore();

  const padCol = 36;

  let cx1 = M + padCol, cy1 = BAND_Y + 56;
  if (icones.reglement) ctx.drawImage(icones.reglement, cx1, cy1 - 26, 28, 28);
  _fFont(ctx, 24, "700"); ctx.fillStyle = FICHE.OR_LIGHT;
  ctx.fillText("RÈGLEMENT INTÉRIEUR", cx1 + (icones.reglement ? 36 : 0), cy1);
  cy1 += 44;
  const reglementComplet = [
    "Cette carte est strictement personnelle.",
    "Elle doit être présentée à toute réquisition.",
    "Elle ne peut être prêtée ou cédée à un tiers.",
    "En cas de perte, aviser immédiatement l'administration.",
    "Cette carte demeure la propriété de LQD Service.",
  ];
  _fFont(ctx, 19, "400");
  reglementComplet.forEach(ligne => {
    ctx.fillStyle = FICHE.OR;
    ctx.fillText("•", cx1, cy1);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    cy1 = _fWrap(ctx, ligne, cx1 + 24, cy1, COL_W - padCol * 2 - 24, 26) + 8;
  });

  let cx2 = M + COL_W + padCol, cy2 = BAND_Y + 56;
  if (icones.avantages) ctx.drawImage(icones.avantages, cx2, cy2 - 26, 28, 28);
  _fFont(ctx, 24, "700"); ctx.fillStyle = FICHE.OR_LIGHT;
  ctx.fillText("AVANTAGES", cx2 + (icones.avantages ? 36 : 0), cy2);
  cy2 += 44;
  const avantagesComplet = [
    "Accès à tous les espaces de formation.",
    "Accès aux ressources et supports du centre.",
    "Attestation officielle à la fin de la formation.",
    "Suivi personnalisé par un formateur dédié.",
  ];
  _fFont(ctx, 19, "400");
  avantagesComplet.forEach(ligne => {
    ctx.fillStyle = FICHE.OR;
    ctx.fillText("✓", cx2, cy2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    cy2 = _fWrap(ctx, ligne, cx2 + 28, cy2, COL_W - padCol * 2 - 28, 26) + 8;
  });
  cy2 += 30;
  ctx.font = "italic 600 20px 'DM Sans', Arial";
  ctx.fillStyle = FICHE.OR_LIGHT;
  ctx.fillText("Se former aujourd'hui,", cx2, cy2);
  _fFont(ctx, 22, "700"); ctx.fillStyle = FICHE.BLANC;
  ctx.fillText("RÉUSSIR DEMAIN", cx2, cy2 + 30);

  let cx3 = M + 2 * COL_W + padCol, cy3 = BAND_Y + 56;
  if (icones.contacts) ctx.drawImage(icones.contacts, cx3, cy3 - 26, 28, 28);
  _fFont(ctx, 24, "700"); ctx.fillStyle = FICHE.OR_LIGHT;
  ctx.fillText("CONTACT", cx3 + (icones.contacts ? 36 : 0), cy3);
  cy3 += 46;
  _fFont(ctx, 18, "400"); ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Administration", cx3, cy3);
  _fFont(ctx, 24, "700"); ctx.fillStyle = FICHE.BLANC;
  ctx.fillText(TEL_URGENCE_FICHE, cx3, cy3 + 30);
  cy3 += 90;

  const QR_S2 = 170, QR_X2 = cx3, QR_Y2 = BAND_Y + BAND_H - QR_S2 - 30;
  if (qr) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 12;
    _fRoundRect(ctx, QR_X2 - 8, QR_Y2 - 8, QR_S2 + 16, QR_S2 + 16, 10, FICHE.BLANC);
    ctx.restore();
    ctx.drawImage(qr, QR_X2, QR_Y2, QR_S2, QR_S2);
  }
  _fFont(ctx, 16, "500"); ctx.fillStyle = "rgba(255,255,255,0.7)";
  _fWrap(ctx, "Scanner pour vérifier l'authenticité de ce document.", QR_X2, QR_Y2 - 20, COL_W - padCol - 20, 20);

  const SIG_Y = BAND_Y + BAND_H + 60;
  ctx.save();
  ctx.strokeStyle = "rgba(245,166,35,0.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(M, SIG_Y); ctx.lineTo(W - M, SIG_Y); ctx.stroke();
  ctx.restore();

  _fFont(ctx, 20, "700"); ctx.fillStyle = FICHE.OR;
  ctx.fillText("SIGNATURE ET CACHET DU PDG", M, SIG_Y + 40);
  const SIG_W = 190;
  if (sig) { const ratio = sig.height / sig.width; const sigH = Math.min(Math.round(SIG_W * ratio), 84); ctx.drawImage(sig, M, SIG_Y + 54, SIG_W, sigH); }
  if (cachet) { ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(cachet, M + 140, SIG_Y + 30, 150, 150); ctx.restore(); }
  const blocSigCentreX = M + 145;
  _fFont(ctx, 22, "700"); ctx.fillStyle = FICHE.MARINE;
  const nomTxt = "M. ATO Blaise";
  ctx.fillText(nomTxt, blocSigCentreX - _fMw(ctx, nomTxt) / 2 < 0 ? M : blocSigCentreX - _fMw(ctx, nomTxt) / 2, SIG_Y + 196);
  _fFont(ctx, 17, "500"); ctx.fillStyle = FICHE.GRIS;
  const titreTxt = "Président Directeur Général";
  ctx.fillText(titreTxt, blocSigCentreX - _fMw(ctx, titreTxt) / 2 < 0 ? M : blocSigCentreX - _fMw(ctx, titreTxt) / 2, SIG_Y + 220);

  // Bande agrandie (70 → 128px) pour loger la ligne d'authentification
  // manuelle et les mentions légales en plus des infos existantes —
  // nécessaire pour toute personne qui ne peut pas scanner le QR code
  // (photocopie, impression N&B, etc.). +12px par rapport à la version
  // précédente (116px) : gain minimal pour limiter le risque de
  // chevauchement avec le bloc signature au-dessus.
  const FOOTER_H = 128;
  const FOOTER_Y = H - FOOTER_H;
  _fRectFill(ctx, 0, FOOTER_Y, W, FOOTER_H, FICHE.MARINE);
  _fFont(ctx, 18, "500"); ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Comé, Bénin  —  " + FICHE_ENTREPRISE.SITE, M, FOOTER_Y + 28);
  _fFont(ctx, 16, "500"); ctx.fillStyle = "rgba(255,255,255,0.55)";
  const refTxt = "Réf : " + apprenant.id;
  ctx.fillText(refTxt, W - M - _fMw(ctx, refTxt), FOOTER_Y + 28);

  _fFont(ctx, 14, "400"); ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`RCCM ${FICHE_ENTREPRISE.RCCM}  —  IFU ${FICHE_ENTREPRISE.IFU}`, M, FOOTER_Y + 50);

  _fFont(ctx, 15, "400"); ctx.fillStyle = "rgba(255,255,255,0.55)";
  _fWrapCentre(ctx, "Pour authentifier cet acte, veuillez utiliser le site sur n'importe quel navigateur ou via : " + FICHE_VERIF_URL, W / 2, FOOTER_Y + 74, W - M * 2, 19);

  return canvas;
}

async function afficherFicheApprenant(apprenant, token) {
  const preview = document.getElementById("fiche-preview");
  if (!preview) return;
  preview.innerHTML = `<div style="text-align:center;padding:2rem;color:#E8E0D4;">
    <div style="display:inline-block;width:36px;height:36px;border:3px solid rgba(245,166,35,0.3);border-top-color:#F5A623;border-radius:50%;animation:pk-spin 0.8s linear infinite;"></div>
    <p style="margin-top:0.75rem;font-size:0.85rem;">Génération de votre fiche...</p>
  </div>`;
  try {
    const canvas = await genererFicheApprenant(apprenant, token);
    const dataURL = canvas.toDataURL("image/png");
    preview.innerHTML = `<div style="text-align:center;background:#12241f;padding:12px;border-radius:10px;">
      <img src="${dataURL}" style="max-width:100%;height:auto;border-radius:4px;" alt="Fiche apprenant" />
    </div>`;
    const btn = document.getElementById("btn-telecharger-fiche");
    if (btn) btn.onclick = () => {
      const a = document.createElement("a");
      a.href = dataURL; a.download = `Fiche_Apprenant_${apprenant.id}.png`; a.click();
    };
    const btnPDF = document.getElementById("btn-telecharger-fiche-pdf");
    if (btnPDF) btnPDF.onclick = () => telechargerFichePDF(dataURL, apprenant.id);
  } catch (err) {
    preview.innerHTML = `<p style="color:#E24B4A;text-align:center;padding:2rem;">Erreur : ${err.message}</p>`;
  }
}

async function telechargerFichePDF(dataURL, idApprenant) {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = () => rej(new Error("jsPDF non disponible"));
      document.head.appendChild(s);
    });
  }
  try {
    const { jsPDF } = window.jspdf;
    const pdf   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataURL, "PNG", 0, 0, pageW, pageH);
    pdf.save(`Fiche_Apprenant_${idApprenant}.pdf`);
    if (window.showToast) showToast("Fiche apprenant (PDF A5) téléchargée", "success");
  } catch (err) {
    if (window.showToast) showToast("Erreur PDF : " + err.message, "error");
  }
}

window.genererFicheApprenant = genererFicheApprenant;
window.afficherFicheApprenant = afficherFicheApprenant;
window.telechargerFichePDF = telechargerFichePDF;

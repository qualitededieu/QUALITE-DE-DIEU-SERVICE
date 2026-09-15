"use strict";

const BADGE_C = {
  MARINE: "#04342C", MARINE_2: "#0F6E56", OR: "#F5A623", OR_LIGHT: "#FABD50",
  BLANC: "#FFFFFF", CREME: "#F8F7F2", GRIS: "#6B7280", TEXTE: "#1A1A2E",
  // Hauteur augmentée (1080 → 1150) pour loger la ligne d'authentification
  // manuelle sous le QR code, sans resserrer le reste de la mise en page —
  // tout le contenu du haut est positionné en pixels absolus depuis le
  // haut, seule la zone décorative centrée (cercle du logo, dégradé) se
  // recale légèrement plus bas, ce qui reste purement cosmétique.
  W: 1080, H: 1150,
};

const BADGE_ENTREPRISE = {
  NOM: "LES QUALITÉS DE DIEU SERVICE",
  LOGO_URL: "icons/logoqds.jpg",
  SITE: "www.qualitededieuservice.com",
};

function _bFont(ctx, size, style = "normal", family = "DM Sans, Arial") {
  ctx.font = `${style} ${size}px '${family}', Arial, sans-serif`;
}
function _bMw(ctx, txt) { return ctx.measureText(txt).width; }
function _bCenterText(ctx, txt, cx, y, color) {
  ctx.fillStyle = color;
  ctx.fillText(txt, cx - _bMw(ctx, txt) / 2, y);
}
function _bWrapCentre(ctx, texte, cx, y, maxW, lh) {
  const mots = String(texte).split(" ");
  let ligne = "", lignes = [];
  for (const mot of mots) {
    const test = ligne ? ligne + " " + mot : mot;
    if (_bMw(ctx, test) > maxW && ligne) { lignes.push(ligne); ligne = mot; }
    else ligne = test;
  }
  if (ligne) lignes.push(ligne);
  let curY = y;
  lignes.forEach(l => { _bCenterText(ctx, l, cx, curY, ctx.fillStyle); curY += lh; });
  return curY;
}
function _bLoadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function _bDrawCover(ctx, img, x, y, w, h, topBias = 0.5) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) { sh = img.height; sw = sh * boxRatio; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / boxRatio; sx = 0; sy = (img.height - sh) * topBias; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function _bFeuille(ctx, x, y, taille, angle, couleur, opacite) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = opacite;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(taille * 0.3, -taille * 0.35, taille, 0);
  ctx.quadraticCurveTo(taille * 0.3, taille * 0.35, 0, 0);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
  ctx.restore();
}

function _bCouronneLaurier(ctx, cx, cy, rayon, couleur) {
  const nbFeuilles = 7;
  for (let cote = -1; cote <= 1; cote += 2) {
    for (let i = 0; i < nbFeuilles; i++) {
      const t = i / (nbFeuilles - 1);
      const angleBase = Math.PI * 0.62 + t * Math.PI * 0.5;
      const r = rayon + 14 + t * 10;
      const px = cx + cote * r * Math.sin(angleBase);
      const py = cy + r * Math.cos(angleBase) * -1 + rayon * 0.9;
      const taille = 26 - t * 8;
      const angleFeuille = cote * (Math.PI / 2.6 + t * 0.5);
      _bFeuille(ctx, px, py, taille, angleFeuille, couleur, 0.85 - t * 0.25);
    }
  }
}

async function genererBadgeCertification(apprenant, token) {
  const canvas = document.createElement("canvas");
  canvas.width = BADGE_C.W;
  canvas.height = BADGE_C.H;
  const ctx = canvas.getContext("2d");

  const LOGO_URL = BADGE_ENTREPRISE.LOGO_URL;
  const BADGE_VERIF_URL = `https://${BADGE_ENTREPRISE.SITE}/verifier-document`;
  const lienVerif = token
    ? `${BADGE_VERIF_URL}?t=${encodeURIComponent(token)}`
    : BADGE_VERIF_URL;
  const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&data=" + encodeURIComponent(lienVerif);

  const [logo, photo, qr] = await Promise.all([
    _bLoadImg(LOGO_URL), _bLoadImg(apprenant.photoUrl), _bLoadImg(QR_URL),
  ]);

  const couleur = BADGE_C.OR;
  const CX = BADGE_C.W / 2;
  const MED_CY = 400;

  const gradFond = ctx.createRadialGradient(CX, MED_CY, 100, CX, BADGE_C.H / 2, 800);
  gradFond.addColorStop(0, "#0F6E56");
  gradFond.addColorStop(0.5, "#04342C");
  gradFond.addColorStop(1, "#021c17");
  ctx.fillStyle = gradFond;
  ctx.fillRect(0, 0, BADGE_C.W, BADGE_C.H);

  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.arc(CX, BADGE_C.H / 2, 480, 0, Math.PI * 2);
    ctx.clip();
    _bDrawCover(ctx, logo, CX - 480, BADGE_C.H / 2 - 480, 960, 960);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(245,166,35,0.07)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const y = 40 + i * 108;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BADGE_C.W, y - 60);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  [230, 270, 310].forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(CX, MED_CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = i === 1 ? "rgba(245,166,35,0.22)" : "rgba(245,166,35,0.1)";
    ctx.lineWidth = i === 1 ? 1.5 : 1;
    if (i !== 1) ctx.setLineDash([2, 6]); else ctx.setLineDash([]);
    ctx.stroke();
  });
  ctx.restore();

  _bFont(ctx, 15, "600");
  _bCenterText(ctx, "◆ ATTESTATION DE COMPÉTENCE ◆", CX, 62, "rgba(250,189,80,0.75)");
  _bFont(ctx, 32, "700");
  _bCenterText(ctx, BADGE_ENTREPRISE.NOM, CX, 108, "#FFFFFF");
  _bFont(ctx, 14, "500");
  _bCenterText(ctx, "CENTRE DE FORMATION PROFESSIONNELLE", CX, 134, BADGE_C.OR_LIGHT);

  const MED_R = 158;
  ctx.save();
  const haloGrad = ctx.createRadialGradient(CX, MED_CY, MED_R * 0.6, CX, MED_CY, MED_R * 2.1);
  haloGrad.addColorStop(0, "rgba(245,166,35,0.25)");
  haloGrad.addColorStop(1, "rgba(245,166,35,0)");
  ctx.fillStyle = haloGrad;
  ctx.fillRect(CX - MED_R * 2.1, MED_CY - MED_R * 2.1, MED_R * 4.2, MED_R * 4.2);
  ctx.restore();

  _bCouronneLaurier(ctx, CX, MED_CY, MED_R, BADGE_C.OR_LIGHT);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.arc(CX, MED_CY, MED_R + 22, 0, Math.PI * 2);
  ctx.strokeStyle = couleur; ctx.lineWidth = 11; ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(CX, MED_CY, MED_R + 38, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(245,166,35,0.6)"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(CX, MED_CY, MED_R, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#0F6E56"; ctx.fillRect(CX - MED_R, MED_CY - MED_R, MED_R * 2, MED_R * 2);
  if (photo) _bDrawCover(ctx, photo, CX - MED_R, MED_CY - MED_R, MED_R * 2, MED_R * 2, 0.15);
  else if (logo) _bDrawCover(ctx, logo, CX - MED_R, MED_CY - MED_R, MED_R * 2, MED_R * 2, 0.5);
  ctx.restore();

  ctx.save();
  ctx.font = "50px serif";
  ctx.fillStyle = "#FFD700";
  ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 6;
  ctx.fillText("★", CX + MED_R - 6, MED_CY - MED_R + 34);
  ctx.restore();

  const sexeNorm = String(apprenant.sexe || "").trim().toUpperCase();
  const civ = sexeNorm === "F" ? "Mme" : (sexeNorm === "M" ? "M." : "");
  const nomComplet = (civ ? civ + " " : "") + (apprenant.prenom || "").toUpperCase() + " " + (apprenant.nom || "").toUpperCase();
  _bFont(ctx, 40, "700");
  _bCenterText(ctx, nomComplet.length > 26 ? nomComplet.slice(0, 26) + "…" : nomComplet, CX, 648, "#FFFFFF");

  ctx.save();
  ctx.fillStyle = BADGE_C.OR;
  ctx.fillRect(CX - 40, 662, 80, 3);
  ctx.restore();

  _bFont(ctx, 24, "500");
  _bCenterText(ctx, apprenant.filiere || "", CX, 700, BADGE_C.OR_LIGHT);

  const pillY = 738, pillH = 58;
  _bFont(ctx, 27, "700");
  const pillTxt = "FORMATION VALIDÉE";
  const pillW = _bMw(ctx, pillTxt) + 64;
  const pillX = CX - pillW / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
  ctx.beginPath();
  const r = pillH / 2;
  ctx.moveTo(pillX + r, pillY);
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
  ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
  ctx.restore();
  _bCenterText(ctx, pillTxt, CX, pillY + 39, "#FFFFFF");

  // Position du QR fixée en absolu (et non plus "BADGE_C.H - 234") pour
  // rester identique à la mise en page d'origine : c'est bien BADGE_C.H
  // qu'on a agrandi (1080 → 1150) pour gagner de la place en dessous,
  // pas la position du QR qui doit se décaler avec.
  const QR_S = 108, QR_Y = 846;
  if (qr) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 10;
    ctx.fillStyle = "#FFFFFF";
    const qx = CX - QR_S / 2 - 6, qy = QR_Y - 6;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(qx, qy, QR_S + 12, QR_S + 12, 10);
    else ctx.rect(qx, qy, QR_S + 12, QR_S + 12);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(qr, CX - QR_S / 2, QR_Y, QR_S, QR_S);
  }

  const dateTxt = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  _bFont(ctx, 15, "500");
  _bCenterText(ctx, "Certifié le " + dateTxt, CX, QR_Y + QR_S + 42, "rgba(255,255,255,0.6)");
  _bFont(ctx, 13, "400");
  _bCenterText(ctx, apprenant.id, CX, QR_Y + QR_S + 66, "rgba(255,255,255,0.4)");

  _bFont(ctx, 14, "500");
  _bCenterText(ctx, BADGE_ENTREPRISE.SITE + " — Comé, Bénin", CX, QR_Y + QR_S + 96, "rgba(255,255,255,0.4)");

  _bFont(ctx, 12, "400");
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  _bWrapCentre(
    ctx,
    "Pour authentifier cet acte, veuillez utiliser le site sur n'importe quel navigateur ou via : " + BADGE_VERIF_URL,
    CX, QR_Y + QR_S + 121, BADGE_C.W - 140, 17
  );

  ctx.save();
  ctx.strokeStyle = "rgba(245,166,35,0.35)";
  ctx.lineWidth = 2.5;
  const corner = 46;
  [[24, 24, 1, 1], [BADGE_C.W - 24, 24, -1, 1], [24, BADGE_C.H - 24, 1, -1], [BADGE_C.W - 24, BADGE_C.H - 24, -1, -1]]
    .forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + corner * dy);
      ctx.lineTo(x, y);
      ctx.lineTo(x + corner * dx, y);
      ctx.stroke();
    });
  ctx.restore();

  return canvas;
}

async function afficherBadgeCertification(apprenant, token) {
  const preview = document.getElementById("badge-preview");
  if (!preview) return;
  preview.innerHTML = `<div style="text-align:center;padding:2rem;color:#E8E0D4;">
    <div style="display:inline-block;width:36px;height:36px;border:3px solid rgba(245,166,35,0.3);border-top-color:#F5A623;border-radius:50%;animation:pk-spin 0.8s linear infinite;"></div>
    <p style="margin-top:0.75rem;font-size:0.85rem;">Génération de votre badge...</p>
  </div>`;
  try {
    const canvas = await genererBadgeCertification(apprenant, token);
    const dataURL = canvas.toDataURL("image/png");
    preview.innerHTML = `<div style="text-align:center;background:#12241f;padding:14px;border-radius:10px;">
      <img src="${dataURL}" style="max-width:100%;height:auto;max-height:60vh;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.4);" alt="Badge de certification" />
    </div>`;
    const btn = document.getElementById("btn-telecharger-badge");
    if (btn) btn.onclick = () => {
      const a = document.createElement("a");
      a.href = dataURL;
      a.download = `Badge_Certification_${apprenant.id}.png`;
      a.click();
    };
  } catch (err) {
    preview.innerHTML = `<p style="color:#E24B4A;text-align:center;padding:2rem;">Erreur : ${err.message}</p>`;
  }
}

window.genererBadgeCertification = genererBadgeCertification;
window.afficherBadgeCertification = afficherBadgeCertification;

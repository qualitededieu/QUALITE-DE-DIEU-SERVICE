// ================================================================
// ATTESTATION / CERTIFICAT DE TRAVAIL — génération (canvas A4 portrait)
// Dépend de js/attestation_generator.js (chargé avant) : ATT, ATT_ENTREPRISE,
// ATT_SIGNATAIRE_PDG, _loadImg, _lieuAffiche, _capitaliserPrenom, _accorderGenre.
// Les données viennent du serveur (personnel.gs), FIGÉES à la délivrance :
// le document se régénère à l'identique à chaque téléchargement.
// ================================================================

const TRAV = { W: 2480, H: 3508, MARGE: 230 };

const TRAV_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function _travDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso || "");
  const j = Number(m[3]);
  return (j === 1 ? "1er" : j) + " " + TRAV_MOIS[Number(m[2]) - 1] + " " + m[1];
}

// Nationalité accordée au masculin quand elle est saisie au féminin
// ("Béninoise" -> "béninois", "Ivoirienne" -> "ivoirien").
function _travNationalite(nat, sexe) {
  let n = String(nat || "").trim().toLowerCase();
  if (!n) return "";
  if (String(sexe).toUpperCase() === "M") n = n.replace(/ise$/, "is").replace(/enne$/, "en").replace(/ane$/, "an").replace(/aise$/, "ais");
  return n;
}

// Formule du lien contractuel selon le type de contrat.
function _travContrat(contrat) {
  return {
    "CDI": { salarie: true, txt: "sous contrat à durée indéterminée (CDI)" },
    "CDD": { salarie: true, txt: "sous contrat à durée déterminée (CDD)" },
    "Prestataire / vacataire": { salarie: false, txt: "en tant que prestataire / vacataire" },
    "Stage": { salarie: false, txt: "dans le cadre d'un stage" },
    "Bénévole": { salarie: false, txt: "à titre bénévole" }
  }[contrat] || { salarie: true, txt: "" };
}

// Paragraphe justifié avec segments gras : [{ t: "texte", g: true }, ...].
// Renvoie la position verticale sous le paragraphe.
function _travParagraphe(ctx, segments, x, y, largeur, taille, interligne, justifier) {
  if (!window.TradDoc) return _travParagrapheBrut(ctx, segments, x, y, largeur, taille, interligne, justifier);
  const traduits = segments.map(sg => ({ t: TradDoc.t(sg.t), g: sg.g }));
  return TradDoc.sansTraduction(() => _travParagrapheBrut(ctx, traduits, x, y, largeur, taille, interligne, justifier));
}
function _travParagrapheBrut(ctx, segments, x, y, largeur, taille, interligne, justifier) {
  const police = g => (g ? "bold " : "") + taille + "px 'Times New Roman', Times, serif";
  // Un mot qui commence par une ponctuation (", ." ...) se colle au précédent :
  // jamais d'espace avant une virgule entre deux segments de style différent.
  const mots = [];
  // Découpe sur les espaces ordinaires seulement : l'espace insécable (\u00A0) lie "n°" à son numéro.
  segments.forEach(s => String(s.t).split(/[ \t\n]+/).filter(Boolean).forEach(m => mots.push({ t: m, g: !!s.g, colle: /^[,.;:)]/.test(m) && mots.length > 0 })));
  const largeurMot = m => { ctx.font = police(m.g); return ctx.measureText(m.t).width; };
  ctx.font = police(false);
  const espace = ctx.measureText(" ").width;
  // Groupes insécables : un mot + la ponctuation collée qui le suit.
  const groupes = [];
  mots.forEach(m => { const w = largeurMot(m); if (m.colle) groupes[groupes.length - 1].push(Object.assign({ w: w }, m)); else groupes.push([Object.assign({ w: w }, m)]); });
  const largeurGroupe = gr => gr.reduce((a, m) => a + m.w, 0);
  const lignes = [];
  let ligne = [], l = 0;
  groupes.forEach(gr => {
    const w = largeurGroupe(gr);
    if (ligne.length && l + espace + w > largeur) { lignes.push({ groupes: ligne, l: l }); ligne = []; l = 0; }
    l += (ligne.length ? espace : 0) + w;
    ligne.push(gr);
  });
  if (ligne.length) lignes.push({ groupes: ligne, l: l, derniere: true });
  lignes.forEach(li => {
    const extra = justifier && !li.derniere && li.groupes.length > 1 ? (largeur - li.l) / (li.groupes.length - 1) : 0;
    let cx = x;
    li.groupes.forEach(gr => {
      gr.forEach(m => { ctx.font = police(m.g); ctx.fillText(m.t, cx, y); cx += m.w; });
      cx += espace + extra;
    });
    y += interligne;
  });
  return y;
}

async function genererDocumentTravailCanvas(doc) {
  const canvas = document.createElement("canvas");
  canvas.width = TRAV.W; canvas.height = TRAV.H;
  const ctx = canvas.getContext("2d");
  const M = TRAV.MARGE, LARGEUR = TRAV.W - 2 * M;
  const estCertificat = doc.cle === "certificat";
  const lienVerif = "https://" + ATT_ENTREPRISE.SITE + "/verifier?ref=" + encodeURIComponent(doc.ref);
  const [logo, qr, signature] = await Promise.all([
    _loadImg(ATT_ENTREPRISE.LOGO_URL),
    _loadImg("https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=2&data=" + encodeURIComponent(lienVerif)),
    _loadImg(typeof SIGNATURE_PDG_DATA !== "undefined" ? SIGNATURE_PDG_DATA : "icons/signature-pdg.png?v=3")
  ]);

  // Fond et cadre
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, TRAV.W, TRAV.H);
  ctx.fillStyle = ATT.OR; ctx.fillRect(0, 0, 24, TRAV.H);
  ctx.fillStyle = ATT.MARINE; ctx.fillRect(24, 0, 10, TRAV.H);

  // En-tête : logo + raison sociale + mentions légales
  const LOGO = 230;
  if (logo) {
    ctx.save(); ctx.beginPath(); ctx.arc(M + LOGO / 2, 140 + LOGO / 2, LOGO / 2, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logo, M, 140, LOGO, LOGO); ctx.restore();
    ctx.beginPath(); ctx.arc(M + LOGO / 2, 140 + LOGO / 2, LOGO / 2 + 4, 0, Math.PI * 2); ctx.strokeStyle = ATT.OR; ctx.lineWidth = 6; ctx.stroke();
  }
  const TX = M + LOGO + 50;
  ctx.fillStyle = "#C97A1A"; ctx.font = "bold 64px 'Times New Roman', Times, serif";
  ctx.fillText("STÉ " + ATT_ENTREPRISE.NOM + " SARL", TX, 210);
  ctx.fillStyle = "#1B3A6B"; ctx.font = "bold 38px 'DM Sans', Arial, sans-serif";
  ctx.fillText("Centre de Formation Professionnelle en Informatique", TX, 268);
  ctx.fillStyle = ATT.GRIS; ctx.font = "30px 'DM Sans', Arial, sans-serif";
  ctx.fillText("RCCM " + ATT_ENTREPRISE.RCCM + "  —  IFU " + ATT_ENTREPRISE.IFU, TX, 318);
  ctx.fillText(ATT_ENTREPRISE.ADRESSE, TX, 360);
  ctx.fillText("Tél : " + ATT_ENTREPRISE.TEL + "  —  " + ATT_ENTREPRISE.EMAIL, TX, 402);
  ctx.fillStyle = ATT.OR; ctx.fillRect(M, 470, LARGEUR, 6);

  // Référence
  ctx.fillStyle = ATT.TEXTE; ctx.font = "34px 'DM Sans', Arial, sans-serif";
  const refTxt = "Réf. : " + doc.ref;
  ctx.fillText(refTxt, TRAV.W - M - ctx.measureText(refTxt).width, 560);

  // Titre
  ctx.fillStyle = ATT.MARINE; ctx.font = "bold 104px 'Times New Roman', Times, serif";
  const titre = estCertificat ? "CERTIFICAT DE TRAVAIL" : "ATTESTATION DE TRAVAIL";
  const tw = ctx.measureText(titre).width;
  ctx.fillText(titre, (TRAV.W - tw) / 2, 760);
  ctx.fillStyle = ATT.OR; ctx.fillRect((TRAV.W - tw) / 2, 800, tw, 8);

  // Corps
  const sexe = String(doc.sexe || "").toUpperCase();
  const civilite = sexe === "F" ? "Madame" : "Monsieur";
  const nomComplet = civilite + " " + String(doc.nom || "").toUpperCase() + " " + _capitaliserPrenom(doc.prenoms);
  const ne = _accorderGenre("né(e)", sexe);
  const lieu = _lieuAffiche(doc.lieuNaissance);
  const nat = _travNationalite(doc.nationalite, sexe);
  const contrat = _travContrat(doc.contrat);
  const interesse = sexe === "F" ? "l'intéressée" : (sexe === "M" ? "l'intéressé" : "l'intéressé(e)");
  const signataire = ATT_SIGNATAIRE_PDG.nom.replace(/^M\.\s*/, "");
  const T = 52, IL = 84, PARA = 46;
  ctx.fillStyle = ATT.TEXTE;
  let y = 1000;
  y = _travParagraphe(ctx, [{ t: "Je soussigné, Monsieur" }, { t: signataire, g: true }, { t: ", Président Directeur Général de la Société " + ATT_ENTREPRISE.NOM + " SARL, immatriculée au RCCM sous le n°\u00A0" + ATT_ENTREPRISE.RCCM.replace(/ /g, "\u00A0") + ", IFU n°\u00A0" + ATT_ENTREPRISE.IFU + ", sise à Comé, Hongodé (République du Bénin)," }], M, y, LARGEUR, T, IL, true) + PARA;
  y = _travParagraphe(ctx, [{ t: estCertificat ? "certifie que" : "atteste que", g: true }, { t: nomComplet, g: true },
    { t: (doc.dateNaissance ? ", " + ne + " le " + _travDate(doc.dateNaissance) + (lieu ? " à " + lieu : "") : "") + (nat ? ", de nationalité " + nat : "") + "," }], M, y, LARGEUR, T, IL, true) + PARA;
  const poste = [{ t: "en qualité de" }, { t: doc.poste, g: true }, { t: (contrat.txt ? ", " + contrat.txt : "") + "." }];
  if (estCertificat) {
    y = _travParagraphe(ctx, [{ t: (contrat.salarie ? _accorderGenre("a été employé(e)", sexe) : "a exercé") + " au sein de notre société du" }, { t: _travDate(doc.dateEmbauche), g: true },
      { t: "au" }, { t: _travDate(doc.dateSortie) + ",", g: true }].concat(poste), M, y, LARGEUR, T, IL, true) + PARA;
    y = _travParagraphe(ctx, [{ t: (sexe === "F" ? "L'intéressée" : (sexe === "M" ? "L'intéressé" : "L'intéressé(e)")) + " nous quitte libre de tout engagement." }], M, y, LARGEUR, T, IL, true) + PARA;
    y = _travParagraphe(ctx, [{ t: "En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit." }], M, y, LARGEUR, T, IL, true);
  } else {
    y = _travParagraphe(ctx, [{ t: (contrat.salarie ? _accorderGenre("est employé(e)", sexe) : "exerce") + " au sein de notre société depuis le" }, { t: _travDate(doc.dateEmbauche) + ",", g: true }].concat(poste), M, y, LARGEUR, T, IL, true) + PARA;
    y = _travParagraphe(ctx, [{ t: "La présente attestation est délivrée à " + interesse + ", sur sa demande, pour servir et valoir ce que de droit." }], M, y, LARGEUR, T, IL, true);
  }

  // Lieu, date, signature (le visuel de signature du PDG intègre son cachet)
  const SX = TRAV.W - M - 900, SY = Math.max(y + 140, 2300);
  ctx.textAlign = "center";
  ctx.fillStyle = ATT.TEXTE; ctx.font = "44px 'Times New Roman', Times, serif";
  ctx.fillText("Fait à Comé, le " + _travDate(doc.dateDelivrance), SX + 450, SY);
  ctx.font = "bold 46px 'Times New Roman', Times, serif";
  ctx.fillText(ATT_SIGNATAIRE_PDG.titre, SX + 450, SY + 80);
  if (signature) {
    const h = 420, w = signature.width * (h / signature.height);
    ctx.drawImage(signature, SX + 450 - w / 2, SY + 110, w, h);
  }
  ctx.font = "bold 50px 'Times New Roman', Times, serif";
  ctx.fillText(ATT_SIGNATAIRE_PDG.nom, SX + 450, SY + 600);
  ctx.textAlign = "left";

  // QR de vérification
  const QY = SY + 120;
  if (qr) ctx.drawImage(qr, M, QY, 300, 300);
  ctx.fillStyle = ATT.GRIS; ctx.font = "28px 'DM Sans', Arial, sans-serif";
  ctx.fillText("Scanner pour vérifier", M, QY + 345);
  ctx.fillText(ATT_ENTREPRISE.SITE + "/verifier", M, QY + 383);
  ctx.fillText("Réf. " + doc.ref, M, QY + 421);

  // Pied de page
  ctx.fillStyle = ATT.MARINE; ctx.fillRect(0, TRAV.H - 150, TRAV.W, 150);
  ctx.fillStyle = ATT.OR_LIGHT; ctx.font = "bold 36px 'DM Sans', Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("LES QUALITÉS DE DIEU SERVICE SARL — " + ATT_ENTREPRISE.SITE, TRAV.W / 2, TRAV.H - 85);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "28px 'DM Sans', Arial, sans-serif";
  ctx.fillText("Document authentifiable en ligne par sa référence. Toute rature ou surcharge l'annule.", TRAV.W / 2, TRAV.H - 40);
  ctx.textAlign = "left";
  return canvas;
}

async function telechargerDocumentTravail(doc) {
  const canvas = await genererDocumentTravailCanvas(doc);
  const nom = (doc.cle === "certificat" ? "Certificat_de_travail_" : "Attestation_de_travail_") + String(doc.nom || "").replace(/[^\w-]+/g, "_") + "_" + doc.ref;
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = () => rej(new Error("jsPDF non disponible"));
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
  pdf.save(nom + ".pdf");
  return canvas;
}

window.genererDocumentTravailCanvas = genererDocumentTravailCanvas;
window.telechargerDocumentTravail = telechargerDocumentTravail;

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
  // Mentions légales — la même entité (LQD Service SARL) délivre TOUTE
  // attestation quelle que soit la durée de la formation ; ces mentions
  // doivent donc apparaître sur les deux gabarits (long ET court), pas
  // uniquement sur celui des formations longues comme c'était le cas.
  RCCM:     "RB/ABC/23 B 7078",
  IFU:      "3202357917037",
};

// Indexé par nom D'AFFICHAGE (pas la clé technique GAS) : apprenant.filiere,
// injecté par carte.gs::_mapperApprenantInscription, est déjà passé au
// travers de CONFIG.NOMS_AFFICHAGE_PUBLIC côté serveur — ces clés doivent
// donc rester synchronisées avec ce dictionnaire-là (GAS/code.gs).
const ATT_DESCRIPTIONS = {
  "Informatique & Bureautique":                    "Maîtrise des outils bureautiques (Word, Excel, PowerPoint), gestion de base de l'outil informatique, saisie et mise en forme de documents professionnels, navigation Internet.",
  "Graphisme & PAO":                                "Publication assistée par ordinateur, conception d'affiches et de supports visuels, maîtrise des logiciels professionnels (Photoshop, Illustrator, CorelDRAW, Canva Pro).",
  "Sérigraphie":                                    "Techniques d'impression sur tout support (tissu, enseignes, objets promotionnels), préparation des écrans, gestion des couleurs et finitions.",
  "Création de sites web & Application Mobile":     "Conception et publication de sites internet (HTML/CSS, WordPress, Wix) et d'applications mobiles, mise en ligne, hébergement et publication sur les stores.",
  "Initiation rapide (1 mois)":                     "Initiation accélérée aux outils numériques essentiels : prise en main de l'ordinateur, bureautique de base et navigation Internet.",
  "Pack 3 Filières":                                "Parcours combiné couvrant trois filières du centre (Bureautique, Graphisme, Sérigraphie), avec remise d'un PC portable Core i7.",
};

function _attDescription(filiere) {
  const f = String(filiere || "");
  if (ATT_DESCRIPTIONS[f]) return ATT_DESCRIPTIONS[f];
  const cle = Object.keys(ATT_DESCRIPTIONS).find(k => f.includes(k) || k.includes(f));
  if (cle) return ATT_DESCRIPTIONS[cle];
  return "Formation professionnelle qualifiante dispensée par le centre.";
}

const ATT_CATEGORIES_LONGUE = {
  "Informatique & Bureautique":                { categorie: "Bureautique & Digital", texte: ATT_DESCRIPTIONS["Informatique & Bureautique"] },
  "Graphisme & PAO":                            { categorie: "Design & Impression",   texte: ATT_DESCRIPTIONS["Graphisme & PAO"] },
  "Sérigraphie":                                { categorie: "Design & Impression",   texte: ATT_DESCRIPTIONS["Sérigraphie"] },
  "Création de sites web & Application Mobile": { categorie: "Développement Web & Mobile", texte: ATT_DESCRIPTIONS["Création de sites web & Application Mobile"] },
  "Initiation rapide (1 mois)":                 { categorie: "Initiation numérique",  texte: ATT_DESCRIPTIONS["Initiation rapide (1 mois)"] },
};

// Les 3 filières couvertes par le Pack 3 Filières — utilisées pour
// développer ses compétences dans _competencesLongue, puisque
// ATT_CATEGORIES_LONGUE n'a pas d'entrée directe pour "Pack 3 Filières".
// N'inclut PAS "Création de sites web & Application Mobile" — exclue
// délibérément de ce pack (confirmé par le PDG, 22/09/2026).
const ATT_PACK_COMPLET_FILIERES = [
  "Informatique & Bureautique",
  "Graphisme & PAO",
  "Sérigraphie",
];

const ATT_MODULE_MANAGEMENT = {
  categorie: "Management",
  texte: "Initiation à la gestion d'entreprise et à l'entrepreneuriat.",
};

// Intitulé "métier" affiché en cursive sur l'attestation — distinct du nom
// commercial/produit (utilisé pour la tarification, l'admin, le Sheet, les
// emails). Répond à la question qu'un recruteur se pose devant un nom de
// pack ou d'offre marketing : "c'est quel métier ?". Ne jamais modifier
// CONFIG.FORMATION_COURTE.NOM ou CONFIG.PACK_COMPLET.NOM directement pour
// changer ce texte : ça casserait la tarification et l'exclusivité.
const ATT_NOMS_AFFICHAGE = {
  "Initiation rapide (1 mois)": "Bureautique & Internet — Niveau Initiation",
  // Forme épicène "(ne)"/"(e)" conservée comme SOURCE ici — _accorderGenre()
  // l'accorde ensuite au masculin ou au féminin selon apprenant.sexe.
  "Pack 3 Filières":            "Technicien(ne) Polyvalent(e) en Bureautique, Graphisme & Sérigraphie",
};

// Accorde un texte porteur de marques épicènes "Mot(suffixe)" (ex.
// "Technicien(ne)", "Polyvalent(e)") au genre de l'apprenant : "M" retire
// la parenthèse ("Technicien"), "F" fusionne base+suffixe ("Technicienne").
// Genre absent/inconnu : la forme épicène entre parenthèses est conservée
// telle quelle — jamais un genre par défaut deviné. Demande du PDG,
// 22/09/2026 : une attestation nominative doit accorder l'intitulé du
// métier au genre de la personne, pas rester au générique épicène par
// défaut quand le genre est connu.
function _accorderGenre(texte, sexe) {
  const s = String(sexe || "").trim().toUpperCase();
  if (s !== "M" && s !== "F") return texte;
  return String(texte).replace(/(\S+?)\(([^)]+)\)/g, (_, base, suffixe) => s === "F" ? base + suffixe : base);
}

// Convention civile/administrative française : NOM (majuscules) puis
// Prénom (casse normale, chaque mot capitalisé) — ex. "TOSSOU Cossi
// Philippe", pas "COSSI PHILIPPE TOSSOU" tout en capitales. Gère les
// prénoms composés (espace, tiret, apostrophe) et les accents.
// Demande du PDG le 22/09/2026.
function _capitaliserPrenom(prenom) {
  return String(prenom || "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (m, sep, lettre) => sep + lettre.toUpperCase());
}

function _intituleAffichage(filiere, estStage, sexe) {
  if (!filiere) return estStage ? "Stage professionnel" : "Formation professionnelle";
  if (ATT_NOMS_AFFICHAGE[filiere]) return _accorderGenre(ATT_NOMS_AFFICHAGE[filiere], sexe);
  // Correspondance par préfixe : apprenant.filiere porte ici le nom
  // d'AFFICHAGE complet côté GAS (ex. "Pack 3 Filières — Bureautique,
  // Graphisme & Sérigraphie"), pas la clé technique courte ci-dessus.
  const cle = Object.keys(ATT_NOMS_AFFICHAGE).find(k => filiere.startsWith(k));
  return cle ? _accorderGenre(ATT_NOMS_AFFICHAGE[cle], sexe) : filiere;
}

function _competencesLongue(filiereStr) {
  // Séparateur '|' — apprenant.filiere (carte.gs) joint les filières
  // multiples avec ' | ', jamais une virgule : le nom d'affichage du Pack
  // 3 Filières contient lui-même une virgule ("Pack 3 Filières —
  // Bureautique, Graphisme & Sérigraphie"), qui casserait un split(",").
  let filieres = String(filiereStr || "").split("|").map(s => s.trim()).filter(Boolean);

  // Le Pack 3 Filières est stocké comme une seule "filière" (son nom
  // d'affichage complet, exclusif — voir GAS/code.gs CONFIG.PACK_COMPLET /
  // NOMS_AFFICHAGE_PUBLIC) : on le développe ici en ses 3 domaines réels
  // pour que l'attestation détaille les mêmes compétences que si
  // l'apprenant avait suivi chaque filière séparément. startsWith() plutôt
  // qu'une égalité stricte : robuste si le libellé complet est ajusté côté
  // GAS sans synchronisation immédiate de ce fichier front.
  if (filieres.some(f => f.startsWith("Pack 3 Filières"))) {
    filieres = ATT_PACK_COMPLET_FILIERES;
  }

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
function _wrapCentre(ctx, txt, cy, maxW, lh, centreX) {
  const cx = centreX !== undefined ? centreX : ATT.W / 2;
  const words = String(txt).split(" ");
  let line = "", lignes = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (_mw(ctx, test) > maxW && line) { lignes.push(line); line = w; }
    else line = test;
  }
  if (line) lignes.push(line);
  let y = cy;
  lignes.forEach(l => { ctx.fillText(l, cx - _mw(ctx, l) / 2, y); y += lh; });
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

// Variante "à blanc" de _wrap : mesure la hauteur sans dessiner (measureText
// n'a pas besoin de fillStyle ni de fillText). Utilisée pour choisir la
// bonne taille de police AVANT de dessiner — voir _choisirTailleCompetences.
function _mesurerFinWrap(ctx, txt, y, maxW, lh) {
  const words = String(txt).split(" ");
  let line = "", curY = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (_mw(ctx, test) > maxW && line) { curY += lh; line = w; }
    else line = test;
  }
  if (line) { curY += lh; }
  return curY;
}

// Version "à blanc" de la boucle de compétences (voir plus bas, la boucle
// réelle) : même algorithme de retour à la ligne, sans fillText. Sert à
// mesurer où se terminerait le bloc compétences pour une taille de police
// donnée, avant de choisir laquelle utiliser réellement.
function _mesurerFinCompetences(ctx, competences, startPosY, photoLimitY, CX, CW_HAUT, CW, taille, ligneH, gapBloc) {
  let posY = startPosY;
  competences.forEach(bloc => {
    const largeurDisponible = (posY < photoLimitY) ? CW_HAUT : CW;
    _font(ctx, taille, "bold");
    const label = bloc.categorie + " : ";
    const labelW = _mw(ctx, label);
    _font(ctx, taille, "normal");
    const words = String(bloc.texte).split(" ");
    let ligne = "", premierMot = true;
    const finLigneX = CX + largeurDisponible;
    for (const mot of words) {
      const test = ligne ? ligne + " " + mot : mot;
      const largeurTest = _mw(ctx, test) + (premierMot ? labelW : 0);
      if (CX + largeurTest > finLigneX && ligne) {
        posY += ligneH;
        ligne = mot; premierMot = false;
      } else {
        ligne = test;
      }
    }
    if (ligne) { posY += ligneH; }
    posY += gapBloc;
  });
  return posY;
}

// Choisit la plus grande taille de police (parmi une liste décroissante) qui
// permet au bloc compétences + à la phrase de clôture ("En foi de quoi...")
// de tenir AVANT la zone réservée aux signatures/QR (SIG_Y, plafonnée à
// 1700 — voir plus bas). Répond au cas réel du Pack 3 Filières
// ("Technicien Polyvalent") : 3 catégories + Management détaillées en
// entier débordaient sur la zone signature/QR à taille fixe 42px — signalé
// par le PDG le 22/09/2026 (cachet et texte "Fait à Comé" chevauchant le
// bloc compétences sur une vraie attestation). Plutôt que replâtrer avec
// une constante de plus, la taille s'adapte désormais au volume réel de
// texte, comme pour d'autres blocs du document (nom, intitulé filière).
function _choisirTailleCompetences(ctx, competences, startPosY, photoLimitY, CX, CW_HAUT, CW, gapBloc, gapFinal) {
  const SAFE_MAX = 1670; // marge de 30px avant le plafond SIG_Y (1700)
  const CANDIDATS = [[42, 54], [38, 50], [34, 46], [30, 42]];
  for (const [taille, ligneH] of CANDIDATS) {
    let fin = _mesurerFinCompetences(ctx, competences, startPosY, photoLimitY, CX, CW_HAUT, CW, taille, ligneH, gapBloc);
    fin += gapFinal; // même espacement que le code réel avant "En foi de quoi..."
    fin = _mesurerFinWrap(ctx, "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", fin, CW, 52);
    if (fin <= SAFE_MAX || taille === CANDIDATS[CANDIDATS.length - 1][0]) {
      return [taille, ligneH];
    }
  }
  return CANDIDATS[CANDIDATS.length - 1];
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

  const ATT_VERIF_URL = `https://${ATT_ENTREPRISE.SITE}/verifier-document`;
  const lienVerif = token
    ? `${ATT_VERIF_URL}?t=${encodeURIComponent(token)}`
    : ATT_VERIF_URL;
  const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=2&data=" + encodeURIComponent(lienVerif);

  const [logo, qr, photo, sigFormateur, sigPdg, cachet] = await Promise.all([
    _loadImg(ATT_ENTREPRISE.LOGO_URL),
    _loadImg(QR_URL),
    _loadImg(apprenant.photoUrl),
    _loadImg(typeof SIGNATURE_FORMATEUR_DATA !== "undefined" ? SIGNATURE_FORMATEUR_DATA : "icons/signature-formateur.png?v=2"),
    _loadImg(typeof SIGNATURE_PDG_DATA       !== "undefined" ? SIGNATURE_PDG_DATA       : "icons/signature-pdg.png?v=2"),
    // Cachet du Formateur Principal (toi) — distinct du cachet institutionnel
    // du PDG. Décision confirmée le 22/09/2026 : ce cachet accompagne
    // TOUJOURS le bloc Formateur, jamais le bloc PDG (dont la signature
    // intègre déjà son propre cachet dans signature-pdg.png).
    _loadImg(typeof CACHET_FORMATEUR_DATA    !== "undefined" ? CACHET_FORMATEUR_DATA    : "icons/cachet-formateur.png?v=1"),
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
    // En-tête logo-à-gauche + texte à droite (comme le gabarit court) au
    // lieu de logo empilé au-dessus d'un bloc de texte centré : ça libère
    // ~160px de hauteur (HDR_H 560 → 400) qui redescendent directement
    // dans le budget du corps du document (photo, compétences, signatures)
    // — demande du PDG le 22/09/2026, en complément du resserrement
    // dynamique déjà en place pour le cas Pack 3 Filières.
    HDR_H = 400;

    _dessinerRubanCoin(ctx, 0, 0, -35, 900, 70, "#1B3A6B", ATT.OR);
    _dessinerRubanCoin(ctx, 0, ATT.H, -35, 900, 70, "#1B3A6B", ATT.OR);

    const LOGO_D = 220, LOGO_CX = 240 + LOGO_D / 2, LOGO_CY = HDR_H / 2;
    if (logo) {
      ctx.save();
      ctx.beginPath(); ctx.arc(LOGO_CX, LOGO_CY, LOGO_D / 2, 0, Math.PI * 2); ctx.clip();
      _drawImageCover(ctx, logo, LOGO_CX - LOGO_D / 2, LOGO_CY - LOGO_D / 2, LOGO_D, LOGO_D);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.arc(LOGO_CX, LOGO_CY, LOGO_D / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = ATT.OR; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    }

    // Zone de texte centrée à droite du logo (et non plus alignée à
    // gauche sur TXT_X) — demande du PDG le 22/09/2026 : le logo reste à
    // gauche, mais chaque ligne se centre dans l'espace qui lui reste.
    // La référence du document a été retirée d'ici : elle fait doublon
    // avec la ligne "Réf : ..." déjà présente en pied de page.
    const TXT_ZONE_X = LOGO_CX + LOGO_D / 2 + 50;
    const TXT_ZONE_W = (ATT.W - 240) - TXT_ZONE_X;
    const _centrerTxt = (txt) => TXT_ZONE_X + (TXT_ZONE_W - _mw(ctx, txt)) / 2;

    _font(ctx, 56, "bold");
    ctx.fillStyle = "#C97A1A";
    const nomLg = "STÉ " + ATT_ENTREPRISE.NOM + " SARL";
    ctx.fillText(nomLg, _centrerTxt(nomLg), 140);

    _font(ctx, 34, "bold", "DM Sans");
    ctx.fillStyle = "#1B3A6B";
    const sousTitreLg = "Centre de Formation Professionnelle en Informatique";
    ctx.fillText(sousTitreLg, _centrerTxt(sousTitreLg), 190);

    _font(ctx, 26, "normal", "DM Sans");
    ctx.fillStyle = ATT.TEXTE;
    const detailLg = "Imprimerie, Graphisme et Sérigraphie Numérique";
    ctx.fillText(detailLg, _centrerTxt(detailLg), 228);

    _font(ctx, 23, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    const ligneLegale = `RCCM ${ATT_ENTREPRISE.RCCM}  —  IFU ${ATT_ENTREPRISE.IFU}  —  Tél : ${ATT_ENTREPRISE.TEL}  —  ${ATT_ENTREPRISE.EMAIL}`;
    ctx.fillText(ligneLegale, _centrerTxt(ligneLegale), 262);

    _font(ctx, 28, "normal");
    ctx.fillStyle = ATT.OR;
    const etoiles = "★  ★  ★  ★  ★  ★";
    ctx.fillText(etoiles, _centrerTxt(etoiles), 306);

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

    _font(ctx, 34, "normal", "DM Sans");
    ctx.fillStyle = ATT.OR_LIGHT;
    ctx.fillText("Centre de Formation Professionnelle en Informatique", 406, 204);

    _font(ctx, 30, "normal", "DM Sans");
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Imprimerie, Graphisme et Sérigraphie Numérique", 406, 240);

    _font(ctx, 28, "normal", "DM Sans");
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(ATT_ENTREPRISE.ADRESSE, 406, 278);

    // Mentions légales — absentes ici auparavant, ajoutées pour que le
    // document soit tout aussi officiel qu'une formation longue.
    _font(ctx, 24, "normal", "DM Sans");
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`RCCM ${ATT_ENTREPRISE.RCCM}  —  IFU ${ATT_ENTREPRISE.IFU}`, 406, 312);

    _rect(ctx, 2510, 42, 3, 318, "rgba(245,166,35,0.4)");

    const LG_X = 2540;
    const infos = [
      { txt: ATT_ENTREPRISE.TEL,   bold: true,  color: ATT.BLANC },
      { txt: ATT_ENTREPRISE.EMAIL, bold: false, color: "rgba(255,255,255,0.75)" },
      { txt: ATT_ENTREPRISE.SITE, bold: false, color: "rgba(255,255,255,0.55)" },
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

  const C2_W = 236, C2_X = PHOTO_X - 65, C2_Y = PHOTO_Y + PHOTO_H - 160;
  if (cachet) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.drawImage(cachet, C2_X, C2_Y, C2_W, C2_W);
    ctx.restore();
  }

  // Étiquette repoussée sous le bas réel du cachet (C2_Y + C2_W), pas sous
  // la photo seule : le cachet déborde de 76px sous la photo (effet
  // "cachet de cire" volontaire sur son coin), et l'étiquette se
  // retrouvait en plein dedans dès qu'un vrai cachet (non transparent) a
  // été câblé — signalé par le PDG le 22/09/2026.
  _font(ctx, 22, "normal", "DM Sans");
  ctx.fillStyle = ATT.GRIS;
  const lblPhoto = "Photo d'identité";
  const lblPhotoY = Math.max(PHOTO_Y + PHOTO_H + 40, C2_Y + C2_W + 26);
  ctx.fillText(lblPhoto, PHOTO_X + (PHOTO_W - _mw(ctx, lblPhoto)) / 2, lblPhotoY);

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

    // Tant que la position verticale reste dans la zone occupée par la
    // photo d'identité (haut-droite), on réserve sa largeur : le texte
    // ne doit jamais passer derrière/devant le visage de l'apprenant.
    const CW_HAUT = (PHOTO_X - 40) - CX;
    const CENTRE_HAUT = CX + CW_HAUT / 2;

    const TITRE_Y = HDR_H + 60;
    _font(ctx, 108, "bold");
    ctx.fillStyle = "#1B3A6B";
    const t1 = "ATTESTATION DE FIN DE FORMATION";
    ctx.fillText(t1, (ATT.W - _mw(ctx, t1)) / 2, TITRE_Y);

    _font(ctx, 60, "bold");
    const t2 = "PROFESSIONNELLE";
    ctx.fillText(t2, (ATT.W - _mw(ctx, t2)) / 2, TITRE_Y + 76);

    posY = TITRE_Y + 160;

    // Calculé ICI (avant le préambule) et pas seulement avant la boucle de
    // compétences, pour pouvoir resserrer TOUT le préambule quand il y a
    // beaucoup de catégories à détailler (cas Pack 3 Filières = 3 domaines
    // + Management) — un simple rétrécissement de la police des
    // compétences ne suffisait pas à éviter le chevauchement avec la zone
    // signature/QR (constaté sur une vraie attestation, 22/09/2026) : même
    // à la taille plancher, le texte débordait encore d'environ 140px.
    const competences = _competencesLongue(apprenant.filiere);
    const beaucoupDeCompetences = competences.length >= 3;
    // Facteur de compaction appliqué UNIQUEMENT aux espaces de respiration
    // (jamais à la taille des textes/titres, ni à la hauteur des blocs
    // dessinés comme le bandeau du nom) — 1 = mise en page inchangée pour
    // le cas courant (1 ou 2 catégories), qui reste identique à avant.
    const G = beaucoupDeCompetences ? 0.72 : 1;
    const _g = (px) => Math.round(px * G);

    _font(ctx, 40, "normal");
    ctx.fillStyle = ATT.TEXTE;
    const preambule =
      `Nous soussignés, Monsieur ${ATT_SIGNATAIRE_PDG.nom.replace(/^M\.\s*/, "")}, Président Directeur Général de la Société ` +
      `${ATT_ENTREPRISE.NOM} SARL, entreprise spécialisée dans l'Informatique & Bureautique, Design & Impression, sise à Comé, ` +
      `Hongodé, et Monsieur ${ATT_SIGNATAIRE_FORMATEUR.nom.replace(/^M\.\s*/, "")}, Formateur Principal,`;
    posY = _wrap(ctx, preambule, CX, posY, CW_HAUT, 52) + 16;

    _font(ctx, 44, "bold");
    ctx.fillStyle = "#A6402F";
    const attestePar = "ATTESTONS PAR LA PRÉSENTE QUE :";
    ctx.fillText(attestePar, CENTRE_HAUT - _mw(ctx, attestePar) / 2, posY);
    posY += _g(76);

    // NOM (majuscules) puis Prénom (casse normale) — convention civile,
    // au lieu de "Prénom NOM" tout en capitales — demande du PDG du
    // 22/09/2026, pour une lecture "Monsieur TOSSOU Cossi Philippe".
    const sexeNorm   = String(apprenant.sexe || "").trim().toUpperCase();
    const civiliteLg = sexeNorm === "F" ? "Madame " : (sexeNorm === "M" ? "Monsieur " : "");
    const nomComplet = `${civiliteLg}${(apprenant.nom || "").toUpperCase()} ${_capitaliserPrenom(apprenant.prenom)}`;
    const BANNER_CX  = CX + CW_HAUT / 2;
    const BANNER_W   = CW_HAUT;
    _roundRect(ctx, CX, posY - 52, BANNER_W, 158, 24, COULEUR_PRINCIPALE);
    _font(ctx, 82, "bold");
    ctx.fillStyle = ATT.OR_LIGHT;
    ctx.fillText(nomComplet, BANNER_CX - _mw(ctx, nomComplet) / 2, posY + 56);
    posY += 106 + _g(84); // 106 = jusqu'au bas du bandeau (hauteur fixe), seule la marge sous le bandeau se resserre

    // Ordre de lecture corrigé le 22/09/2026 (demande du PDG) : le nom est
    // immédiatement suivi de "né(e) le ... à ...", PUIS de "a suivi avec
    // assiduité...", pour une phrase qui coule ("Monsieur TOSSOU Cossi
    // Philippe né le 30 juin 1995 à Comé a suivi avec assiduité et validé
    // la formation en : ..."), au lieu de renvoyer la naissance après le
    // nom de la filière comme c'était le cas avant.
    if (apprenant.dateNaissance) {
      _font(ctx, 44, "normal");
      ctx.fillStyle = ATT.TEXTE;
      const lieuTxt = apprenant.lieuNaissance ? ` à ${apprenant.lieuNaissance}` : "";
      const naissanceTxt = `${_accorderGenre("né(e)", apprenant.sexe)} le ${fmt(apprenant.dateNaissance)}${lieuTxt}`;
      ctx.fillText(naissanceTxt, CENTRE_HAUT - _mw(ctx, naissanceTxt) / 2, posY);
      posY += _g(70);
    }

    // "a suivi ... la formation en :" + nom de la filière en cursive —
    // même traitement que le gabarit court (initiation), au lieu de la
    // ligne "Domaine de formation : X" en police normale d'avant (jugée
    // trop administrative / peu soignée pour un document officiel).
    _font(ctx, 44, "normal");
    ctx.fillStyle = ATT.TEXTE;
    const introFormation = "a suivi avec assiduité et a validé la formation en :";
    ctx.fillText(introFormation, CENTRE_HAUT - _mw(ctx, introFormation) / 2, posY);
    posY += _g(78);

    if (apprenant.filiere) {
      // _intituleAffichage() substitue un intitulé "métier" au nom
      // commercial quand une entrée existe dans ATT_NOMS_AFFICHAGE (Pack 3
      // Filières, Initiation) — sinon renvoie le nom de filière inchangé.
      const domaineTxt = _intituleAffichage(String(apprenant.filiere), estStage, apprenant.sexe);
      // Taille réduite progressivement si le nom est trop large pour la
      // zone réservée (cas des libellés longs, ex. l'intitulé métier du
      // Pack) — jamais de retour à la ligne en cursive, illisible sur un
      // document officiel.
      let taille = 108;
      let police = document.fonts.check(taille + "px 'Great Vibes'")
        ? taille + "px 'Great Vibes'"
        : "italic bold 80px 'Times New Roman', Times, serif";
      ctx.font = police;
      while (_mw(ctx, domaineTxt) > CW_HAUT - 40 && taille > 46) {
        taille -= 6;
        police = document.fonts.check(taille + "px 'Great Vibes'")
          ? taille + "px 'Great Vibes'"
          : "italic bold " + Math.round(taille * 0.74) + "px 'Times New Roman', Times, serif";
        ctx.font = police;
      }
      ctx.fillStyle = COULEUR_PRINCIPALE;
      const dW = _mw(ctx, domaineTxt);
      ctx.fillText(domaineTxt, CENTRE_HAUT - dW / 2, posY + 14);
      posY += _g(34);
      _rect(ctx, CENTRE_HAUT - dW / 2 - 40, posY + 10, dW + 80, 6, ATT.OR);
      posY += _g(76);
    }

    _font(ctx, 44, "normal");
    const dureeTxt = dureeMois !== null ? ` (${dureeMois} mois)` : "";
    const d1 = "durant la période du ", d2 = dateDebut, d3 = " au ", d4 = dateFin + dureeTxt + ",";
    let dx = CX;
    ctx.fillStyle = ATT.TEXTE; ctx.fillText(d1, dx, posY); dx += _mw(ctx, d1);
    _font(ctx, 44, "bold"); ctx.fillStyle = COULEUR_PRINCIPALE; ctx.fillText(d2, dx, posY); dx += _mw(ctx, d2);
    _font(ctx, 44, "normal"); ctx.fillStyle = ATT.TEXTE; ctx.fillText(d3, dx, posY); dx += _mw(ctx, d3);
    _font(ctx, 44, "bold"); ctx.fillStyle = COULEUR_PRINCIPALE; ctx.fillText(d4, dx, posY);
    posY += _g(64);

    _font(ctx, 44, "normal");
    ctx.fillStyle = ATT.TEXTE;
    posY = _wrap(ctx, "Cette formation professionnelle complète lui a permis de valider les compétences suivantes :", CX, posY, CW_HAUT, 54) + _g(10);

    const gapBloc = _g(12);
    const [tailleComp, ligneHComp] = _choisirTailleCompetences(ctx, competences, posY, PHOTO_Y + PHOTO_H, CX, CW_HAUT, CW, gapBloc, _g(10));
    competences.forEach(bloc => {
      // Zone photo dépassée (posY sous PHOTO_Y + PHOTO_H) : on repasse
      // en pleine largeur pour les compétences restantes.
      const largeurDisponible = (posY < PHOTO_Y + PHOTO_H) ? CW_HAUT : CW;

      _font(ctx, tailleComp, "bold");
      ctx.fillStyle = COULEUR_PRINCIPALE;
      const label = bloc.categorie + " : ";
      ctx.fillText(label, CX, posY);
      const labelW = _mw(ctx, label);

      _font(ctx, tailleComp, "normal");
      ctx.fillStyle = ATT.TEXTE;
      const words = String(bloc.texte).split(" ");
      let ligne = "", x = CX + labelW, premierMot = true;
      const finLigneX = CX + largeurDisponible;
      for (const mot of words) {
        const test = ligne ? ligne + " " + mot : mot;
        const largeurTest = _mw(ctx, test) + (premierMot ? labelW : 0);
        if (CX + largeurTest > finLigneX && ligne) {
          ctx.fillText(ligne, premierMot ? x : CX, posY);
          posY += ligneHComp;
          ligne = mot; premierMot = false; x = CX;
        } else {
          ligne = test;
        }
      }
      if (ligne) { ctx.fillText(ligne, premierMot ? x : CX, posY); posY += ligneHComp; }
      posY += gapBloc;
    });

    posY += _g(10);
    _font(ctx, 40, "italic");
    ctx.fillStyle = ATT.TEXTE;
    posY = _wrap(ctx, "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", CX, posY, CW, 52);
    posY += _g(20);

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

    // Même précaution que pour le format long : réserver la largeur de
    // la photo tant qu'on reste dans sa zone verticale.
    const CW_HAUT_COURT    = (PHOTO_X - 40) - CX;
    const CENTRE_HAUT_COURT = CX + CW_HAUT_COURT / 2;

    const sexeNorm   = String(apprenant.sexe || "").trim().toUpperCase();
    // Même convention NOM + Prénom que le gabarit long — cohérence entre
    // les deux formats de document (demande du PDG le 22/09/2026).
    const civilite   = sexeNorm === "F" ? "Mme. " : (sexeNorm === "M" ? "M. " : "");
    const nomComplet = `${civilite}${(apprenant.nom || "").toUpperCase()} ${_capitaliserPrenom(apprenant.prenom)}`;
    const BANNER_CX  = CENTRE_HAUT_COURT;
    _roundRect(ctx, CX, posY - 52, CW_HAUT_COURT, 158, 24, COULEUR_PRINCIPALE);
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

    const intitule = _intituleAffichage(apprenant.filiere, estStage, apprenant.sexe);
    ctx.font = document.fonts.check("120px 'Great Vibes'")
      ? "120px 'Great Vibes'"
      : "italic bold 90px 'Times New Roman', Times, serif";
    ctx.fillStyle = COULEUR_PRINCIPALE;
    {
      const iW = _mw(ctx, intitule);
      ctx.fillText(intitule, CENTRE_HAUT_COURT - iW / 2, posY + 20);
      posY += 40;
      _rect(ctx, CENTRE_HAUT_COURT - iW / 2 - 40, posY + 12, iW + 80, 6, ATT.OR);
      posY += 70;
    }

    _font(ctx, 38, "italic");
    ctx.fillStyle = ATT.GRIS;
    const descriptionTexte = estStage
      ? _attDescriptionStage(apprenant.missionsStage)
      : _attDescription(apprenant.filiere);
    posY = _wrapCentre(ctx, descriptionTexte, posY, CW_HAUT_COURT - 120, 48, CENTRE_HAUT_COURT) + 16;

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
        // Largeur recalculée si la hauteur bute sur son plafond (140) —
        // même précaution que la carte et la fiche apprenant, pour ne
        // jamais écraser une signature large sans réduire sa largeur en
        // conséquence (22/09/2026).
        const ratio = signatureImg.height / signatureImg.width;
        let sigW = SIG_W, SIG_H = Math.round(SIG_W * ratio);
        if (SIG_H > 140) { SIG_H = 140; sigW = Math.round(140 / ratio); }
        ctx.drawImage(signatureImg, ancrageX + 140, SIG_Y + 280, sigW, SIG_H);
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

    // Ligne d'authentification manuelle — pour toute personne sans lecteur
    // QR (vérification papier, dossier RH, etc.) : le texte complet doit
    // rester lisible même imprimé en noir et blanc.
    _font(ctx, 22, "normal", "DM Sans");
    ctx.fillStyle = ATT.GRIS;
    _wrapCentre(
      ctx,
      "Pour authentifier cet acte, veuillez utiliser le site sur n'importe quel navigateur ou via : " + ATT_VERIF_URL,
      qrY + QR_CENTRE_S + 74,
      760,
      30
    );
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
  const siteTxt = ATT_ENTREPRISE.SITE + "  —  " + ATT_ENTREPRISE.ADRESSE;
  ctx.fillText(siteTxt, (ATT.W - _mw(ctx, siteTxt)) / 2, FTR_Y + 165);

  _rect(ctx, 0, ATT.H - 18, ATT.W, 18, ATT.OR);

  // GARDE-FOU CRITIQUE : une attestation "fin de formation" ne doit
  // jamais pouvoir sortir avec l'apparence d'un document final tant que
  // la formation n'est pas réellement terminée (dateFin non atteinte).
  // Le blocage existe déjà côté téléchargement public (verifierAccesTelechargement
  // dans carte.gs), mais PAS côté aperçu admin (adminApercuAttestation) —
  // qui doit rester utilisable pour vérifier la mise en page avant la fin
  // du cursus. Solution : on laisse la génération se faire, mais on
  // recouvre le document entier d'un filigrane impossible à ignorer ou à
  // recadrer, rendant le document inutilisable comme preuve officielle
  // tant que la date de fin n'est pas passée.
  _dessinerFiligraneSiNonTerminee(ctx, apprenant);

  return canvas;
}

function _dessinerFiligraneSiNonTerminee(ctx, apprenant) {
  if (!apprenant.dateFin) return;
  const finFormation = new Date(apprenant.dateFin);
  if (isNaN(finFormation.getTime())) return;

  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  finFormation.setHours(0, 0, 0, 0);
  if (aujourdHui >= finFormation) return; // Formation bien terminée — document valide, rien à signaler.

  const dateFinTxt = finFormation.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const ligne1 = "APERÇU — FORMATION EN COURS";
  const ligne2 = `Document non valide avant le ${dateFinTxt}`;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.translate(ATT.W / 2, ATT.H / 2);
  ctx.rotate(-Math.PI / 8);

  // Bandeau plein pour garantir la lisibilité même sur fond clair/photo.
  _font(ctx, 96, "bold");
  const largeurBandeau = Math.max(_mw(ctx, ligne1), _mw(ctx, ligne2)) + 160;
  ctx.fillStyle = "rgba(200, 30, 30, 0.92)";
  ctx.fillRect(-largeurBandeau / 2, -110, largeurBandeau, 220);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.strokeRect(-largeurBandeau / 2, -110, largeurBandeau, 220);

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText(ligne1, 0, -18);
  _font(ctx, 46, "bold", "DM Sans");
  ctx.fillText(ligne2, 0, 55);
  ctx.textAlign = "left";

  ctx.restore();
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

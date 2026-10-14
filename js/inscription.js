/* js/inscription.js — page Inscription : calcul des frais, étapes,
   pièces jointes (+ contrôle visage), signature, envoi du dossier.
   Dépend de js/site.js (GAS_WEBAPP_URL, formatFCFA, showToast). */
/* ================================================================
   CONFIG — Coûts formations (FCFA), grille d'octobre 2026.
   TOUJOURS identique à GAS/code.gs (CONFIG.COUTS_FORMATIONS,
   FRAIS_INSCRIPTION, PACK_COMPLET) : le serveur recalcule les montants
   de son côté, un écart ici afficherait un faux montant à l'apprenant.
   Les clés sont les identifiants techniques (jamais les noms affichés).
================================================================ */
const COUTS_FORMATIONS = {
  'Informatique & Bureautique': 100000,   // affiché "Secrétariat bureautique"
  'Secrétariat comptable':      150000,
  'Graphisme & PAO':            200000,   // affiché "Graphisme"
  'Montage audio-visuel':       150000,
  'Sérigraphie':                100000,
  'Création de sites web':      200000    // affiché "Développeur Web / Mobile / Windows"
};
const FRAIS_INSCRIPTION = 5000;
// Noms montrés à l'apprenant (même table que CONFIG.NOMS_AFFICHAGE_PUBLIC
// côté GAS). Une clé absente s'affiche telle quelle.
const NOMS_AFFICHAGE = {
  'Informatique & Bureautique': 'Secrétariat bureautique',
  'Graphisme & PAO':            'Graphisme',
  'Création de sites web':      'Développeur Web / Mobile / Windows',
};
function nomAffichage(cle) { return NOMS_AFFICHAGE[cle] || cle; }
// Initiation rapide : plus proposée aux nouvelles inscriptions depuis
// octobre 2026 (case retirée du formulaire). Constante conservée car le
// calcul des frais ci-dessous la référence encore sans risque.
const FORMATION_COURTE = { NOM: 'Initiation rapide (1 mois)', COUT: 25000, FRAIS_INSCRIPTION: 5000 };
// Pack "toutes les filières" — coût forfaitaire fixe (PC portable Core
// i7 inclus), jamais une somme de COUTS_FORMATIONS. Reste sur le
// système de tranches (50/25/25%) comme les filières classiques —
// synchronisé avec CONFIG.PACK_COMPLET côté GAS/code.gs.
// N'inclut PAS "Création de sites web & Application Mobile" — exclue
// délibérément de ce pack.
const PACK_COMPLET = { NOM: 'Pack 3 Filières', COUT: 570000, DUREE_MOIS: 18 };
const MAX_FILE_SIZE     = 2 * 1024 * 1024; // 2 Mo

/* ---- Stockage fichiers base64 ---- */
const fichiers = { piece1: null, photo: null, preuve: null };
// Vrai pendant la détection de visage : la photo n'est pas encore
// acceptée, on ne doit pas laisser passer l'étape 4 entre-temps.
let photoEnVerification = false;

/* ================================================================
   CALCUL FRAIS
================================================================ */
function getFormationsSelectionnees() {
  return Array.from(document.querySelectorAll('input[name="formations"]:checked')).map(cb => cb.value);
}

// L'offre courte ET le Pack Complet sont chacun exclusifs : cocher
// l'un décoche et désactive toutes les autres cases (les 4 filières
// longues ET l'autre offre exclusive), et vice-versa — impossible de
// mélanger paiement unique, tranches sur pack et tranches sur
// filière(s) dans le même dossier. Miroir exact de l'exclusivité
// appliquée côté serveur dans GAS/code.gs::traiterInscription.
// Octobre 2026 : la case Initiation rapide (#f5) a été retirée du
// formulaire — chaque accès à #f5 est donc protégé (null toléré). Seul le
// Pack (#f6) reste une offre exclusive.
function gererExclusiviteFormationCourte() {
  const caseCourte   = document.getElementById('f5');
  const casePack     = document.getElementById('f6');
  const casesLongues = Array.from(document.querySelectorAll('input[name="formations"]:not(#f5):not(#f6)'));
  const hintCourte   = document.getElementById('hint-courte');
  const hintPack     = document.getElementById('hint-pack');
  const exclusives   = [caseCourte, casePack].filter(Boolean);

  const exclusiveCochee = exclusives.find(cb => cb.checked);
  if (exclusiveCochee) {
    casesLongues.forEach(cb => { cb.checked = false; cb.disabled = true; });
    exclusives.forEach(cb => { if (cb !== exclusiveCochee) { cb.checked = false; cb.disabled = true; } });
  } else {
    casesLongues.forEach(cb => cb.disabled = false);
    exclusives.forEach(cb => cb.disabled = false);
  }
  if (hintCourte) hintCourte.style.display = caseCourte && caseCourte.checked ? 'block' : 'none';
  if (hintPack)   hintPack.style.display   = casePack && casePack.checked ? 'block' : 'none';

  const uneLongueCochee = casesLongues.some(cb => cb.checked);
  exclusives.forEach(cb => { cb.disabled = cb.disabled || uneLongueCochee; });
}

function mettreAJourFrais() {
  gererExclusiviteFormationCourte();
  const formations = getFormationsSelectionnees();
  const fraisBloc  = document.getElementById('fraisBloc');

  if (formations.length === 0) {
    fraisBloc.classList.remove('show');
    resetBtnLabel();
    return;
  }

  const estFormationCourte = formations.includes(FORMATION_COURTE.NOM);
  const estPackComplet     = formations.includes(PACK_COMPLET.NOM);

  let fraisInscription, coutTotal, tranche1, tranche2, tranche3, premierVirement, paiementUnique;

  if (estFormationCourte) {
    fraisInscription = FORMATION_COURTE.FRAIS_INSCRIPTION;
    coutTotal         = FORMATION_COURTE.COUT;
    tranche1          = coutTotal;
    tranche2          = 0;
    tranche3          = 0;
    premierVirement   = fraisInscription + coutTotal;
    paiementUnique    = true;
  } else if (estPackComplet) {
    // Coût forfaitaire fixe (PC portable inclus), sur le système de
    // tranches habituel — jamais une somme de COUTS_FORMATIONS.
    fraisInscription = FRAIS_INSCRIPTION;
    coutTotal         = PACK_COMPLET.COUT;
    tranche1          = Math.round(coutTotal * 0.50);
    tranche2          = Math.round(coutTotal * 0.25);
    tranche3          = coutTotal - tranche1 - tranche2;
    premierVirement   = fraisInscription + tranche1;
    paiementUnique    = false;
  } else {
    fraisInscription = FRAIS_INSCRIPTION;
    coutTotal         = formations.reduce((s, f) => s + (COUTS_FORMATIONS[f] || 0), 0);
    tranche1          = Math.round(coutTotal * 0.50);
    tranche2          = Math.round(coutTotal * 0.25);
    tranche3          = coutTotal - tranche1 - tranche2;
    premierVirement   = fraisInscription + tranche1;
    paiementUnique    = false;
  }

  document.getElementById('fraisInscriptionVal').textContent = formatFCFA(fraisInscription);
  document.getElementById('coutTotalVal').textContent        = formatFCFA(coutTotal);
  document.getElementById('tranche1Val').textContent         = formatFCFA(tranche1);
  document.getElementById('tranche2Val').textContent         = formatFCFA(tranche2);
  document.getElementById('tranche3Val').textContent         = formatFCFA(tranche3);
  document.getElementById('premierVirementVal').textContent  = formatFCFA(premierVirement);

  document.getElementById('labelTranche1').innerHTML = paiementUnique
    ? 'Coût de la formation'
    : 'Tranche 1 — 50% <span class="t1">Immédiat</span>';
  document.getElementById('ligneTranche2').style.display = paiementUnique ? 'none' : '';
  document.getElementById('ligneTranche3').style.display = paiementUnique ? 'none' : '';
  document.getElementById('labelVirement').textContent = paiementUnique
    ? 'TOTAL — paiement unique'
    : '1er virement à effectuer';

  fraisBloc.classList.add('show');

  const btn = document.getElementById('submitBtn');
  btn.innerHTML = `<span class="iconify" data-icon="tabler:send"></span> Soumettre — virement de ${formatFCFA(premierVirement)}`;

}

function resetBtnLabel() {
  document.getElementById('submitBtn').innerHTML =
    `<span class="iconify" data-icon="tabler:send"></span> Soumettre mon dossier`;
}

document.querySelectorAll('input[name="formations"]').forEach(cb => {
  cb.addEventListener('change', mettreAJourFrais);
});

/* ================================================================
   UPLOAD FICHIERS
================================================================ */
['piece1', 'photo', 'preuve'].forEach(cle => {
  document.getElementById(cle).addEventListener('change', function () {
    gererFichier(this, cle);
  });
});

function gererFichier(input, cle) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    showToast('Fichier trop lourd (max 2 Mo). Compressez et réessayez.', 'error');
    effacerZone(cle);
    input.value = '';
    return;
  }

  const typesImage = ['image/jpeg', 'image/png'];
  const typesPDF   = ['image/jpeg', 'image/png', 'application/pdf'];
  const types      = cle === 'photo' ? typesImage : typesPDF;

  if (!types.includes(file.type)) {
    showToast(`Format non accepté pour ${cle === 'photo' ? 'la photo' : 'ce fichier'}. Utilisez JPG, PNG${cle !== 'photo' ? ' ou PDF' : ''}.`, 'error');
    effacerZone(cle);
    input.value = '';
    return;
  }

  document.getElementById('zone-' + cle).classList.remove('error');

  const reader = new FileReader();
  reader.onload = async e => {
    const dataURL = e.target.result;

    // Contrôle qualité spécifique à la photo d'identité : on refuse
    // toute image sans visage net et bien cadré (selfie de loin,
    // photo de groupe, paysage envoyé par erreur...). Voir
    // verifierVisagePhoto() plus bas — tout se passe dans le
    // navigateur, aucune donnée envoyée à un tiers.
    if (cle === 'photo') {
      majUIUpload('photo', 'Vérification du visage...', true);
      photoEnVerification = true;
      const verif = await verifierVisagePhoto(dataURL);
      photoEnVerification = false;
      if (verif.rejet) {
        showToast(verif.message, 'error');
        effacerZone(cle);
        input.value = '';
        return;
      }
    }

    fichiers[cle] = { base64: dataURL.split(',')[1], mimeType: file.type, nom: file.name };
    majUIUpload(cle, file.name, true);
    effacerErreurEtape(4);
  };
  reader.onerror = () => showToast('Erreur de lecture du fichier. Réessayez.', 'error');
  reader.readAsDataURL(file);
}

/* ================================================================
   CONTRÔLE QUALITÉ PHOTO D'IDENTITÉ — détection de visage
   Bibliothèque face-api.js (tourne entièrement dans le navigateur,
   modèle léger "TinyFaceDetector" ~190 Ko). Objectif : refuser les
   photos qui ne sont manifestement pas des photos d'identité
   (aucun visage, plusieurs visages, visage minuscule dans le cadre).

   IMPORTANT — principe de tolérance : si le modèle ne charge pas
   (CDN bloqué chez l'apprenant, connexion instable...), on laisse
   passer la photo plutôt que de bloquer toute l'inscription à cause
   d'un problème d'infrastructure tiers qui n'a rien à voir avec la
   qualité réelle de la photo. Le blocage strict ne s'applique QUE
   quand la détection a bien fonctionné et a trouvé un problème.
================================================================ */
let _faceApiChargement = null;
function _chargerFaceApi() {
  if (_faceApiChargement) return _faceApiChargement;
  _faceApiChargement = (async () => {
    if (typeof faceapi === 'undefined') throw new Error('face-api.js non chargé');
    const MODELS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
  })();
  return _faceApiChargement;
}

async function verifierVisagePhoto(dataURL) {
  try {
    await _chargerFaceApi();
  } catch (e) {
    console.warn('[Photo] Détection de visage indisponible (CDN/réseau) — photo acceptée sans vérification :', e.message);
    return { rejet: false };
  }

  const img = new Image();
  const chargee = new Promise((resolve, reject) => {
    img.onload  = resolve;
    img.onerror = reject;
  });
  img.src = dataURL;

  try {
    await chargee;
    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }));

    if (detections.length === 0) {
      return { rejet: true, message: "Aucun visage détecté sur cette photo. Utilisez une photo d'identité récente, de face, visage bien visible." };
    }
    if (detections.length > 1) {
      return { rejet: true, message: 'Plusieurs visages détectés. La photo doit contenir uniquement votre visage, seul(e).' };
    }

    const boite      = detections[0].box;
    const aireVisage = (boite.width * boite.height) / (img.width * img.height);
    if (aireVisage < 0.04) {
      return { rejet: true, message: 'Le visage est trop petit sur cette photo. Rapprochez-vous ou recadrez avant de renvoyer.' };
    }

    return { rejet: false };
  } catch (e) {
    console.warn('[Photo] Erreur pendant la détection — photo acceptée sans vérification :', e.message);
    return { rejet: false };
  }
}

function majUIUpload(cle, nomFichier, ok) {
  const zone    = document.getElementById('zone-'    + cle);
  const icon    = document.getElementById('icon-'    + cle);
  const text    = document.getElementById('text-'    + cle);
  const badge   = document.getElementById('badge-'   + cle);
  const preview = document.getElementById('preview-' + cle);
  const name    = document.getElementById('name-'    + cle);

  if (ok) {
    zone.classList.add('has-file');
    zone.classList.remove('error');
    icon.innerHTML   = '<span class="iconify" data-icon="tabler:circle-check"></span>';
    text.textContent = 'Fichier sélectionné';
    badge.textContent= cle === 'preuve' ? 'Chargé' : 'OK';
    preview.classList.add('show');
    name.textContent = nomFichier;
  } else {
    effacerZone(cle);
  }
}

function effacerZone(cle) {
  const icones = { piece1: 'tabler:cloud-upload', photo: 'tabler:user-circle', preuve: 'tabler:receipt' };
  const textes = { piece1: 'Cliquez ou glissez le fichier ici', photo: 'Cliquez ou glissez le fichier ici', preuve: 'Joindre votre reçu de virement (si disponible)' };
  document.getElementById('zone-'    + cle).classList.remove('has-file', 'error');
  document.getElementById('icon-'    + cle).innerHTML   = `<span class="iconify" data-icon="${icones[cle]}"></span>`;
  document.getElementById('text-'    + cle).textContent = textes[cle];
  document.getElementById('badge-'   + cle).textContent = cle === 'preuve' ? 'Optionnel' : 'Requis';
  document.getElementById('preview-' + cle).classList.remove('show');
  document.getElementById('name-'    + cle).textContent = '—';
  fichiers[cle] = null;
}

function supprimerFichier(cle) {
  document.getElementById(cle).value = '';
  effacerZone(cle);
}

/* ================================================================
   SIGNATURE NUMÉRIQUE — canvas tactile/souris
================================================================ */
let signatureApposee = false;

(function initSignature() {
  const canvas = document.getElementById('sigCanvas');
  const ctx    = canvas.getContext('2d');
  const hint   = document.getElementById('sig-hint');
  let dessin   = false;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#1A1A2E';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function debut(e) { e.preventDefault(); dessin = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function trace(e) {
    e.preventDefault();
    if (!dessin) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!signatureApposee) {
      signatureApposee = true;
      hint.textContent = 'Signature apposée';
      document.getElementById('signatureError').style.display = 'none';
    }
  }
  function fin(e) { e.preventDefault(); dessin = false; }

  canvas.addEventListener('mousedown',  debut);
  canvas.addEventListener('mousemove',  trace);
  canvas.addEventListener('mouseup',    fin);
  canvas.addEventListener('mouseleave', fin);
  canvas.addEventListener('touchstart', debut, { passive: false });
  canvas.addEventListener('touchmove',  trace, { passive: false });
  canvas.addEventListener('touchend',   fin,   { passive: false });
})();

function effacerSignature() {
  const canvas = document.getElementById('sigCanvas');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  signatureApposee = false;
  document.getElementById('sig-hint').textContent = 'Signez dans cet espace';
}

function obtenirSignatureBase64() {
  return document.getElementById('sigCanvas').toDataURL('image/png').split(',')[1];
}

/* ================================================================
   FORMULAIRE EN 5 ÉTAPES
   Identité > Parents > Formations > Pièces > Validation.
   Une seule étape visible à la fois ; "Suivant" refuse d'avancer tant
   que l'étape en cours n'est pas correcte (message clair + champs en
   rouge). Toutes les étapes restent dans le même <form> : l'envoi
   final vers GAS (plus bas) est inchangé.
================================================================ */
const NB_ETAPES = 5;
let etapeCourante    = 1;
let etapeMaxAtteinte = 1;

// Même règle que l'ancienne validation globale (numéros béninois).
const REGEX_TEL_PRINCIPAL = /^(\+229|229|0)[0-9]{8,15}$/;
// Téléphones facultatifs (parents, tuteur) : contrôle plus souple, on
// accepte aussi un numéro étranger — on refuse seulement le n'importe quoi.
const REGEX_TEL_SOUPLE    = /^\+?[0-9]{8,15}$/;
const REGEX_EMAIL         = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function _val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function _marquer(id, ok) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('error', !ok);
  return ok;
}
function _obligatoires(ids) {
  let ok = true;
  ids.forEach(id => { if (!_marquer(id, _val(id) !== '')) ok = false; });
  return ok;
}
function _telOk(id, regex) {
  const v = _val(id).replace(/\s/g, '');
  return v === '' || regex.test(v);
}

const VALIDATEURS = {
  1() {
    const ok = _obligatoires(['prenom', 'nom', 'sexe', 'telephone', 'dateNaissance', 'lieuNaissance', 'nationalite', 'adresse']);
    if (!ok) return { ok: false, message: 'Complétez les champs en rouge pour continuer.' };
    if (!_marquer('telephone', _telOk('telephone', REGEX_TEL_PRINCIPAL))) {
      return { ok: false, message: 'Numéro de téléphone invalide. Exemple : 01 97 95 12 30.' };
    }
    if (!_marquer('email', _val('email') === '' || REGEX_EMAIL.test(_val('email')))) {
      return { ok: false, message: 'Adresse email invalide. Laissez le champ vide si vous n\'en avez pas.' };
    }
    const naissance = new Date(_val('dateNaissance') + 'T00:00:00');
    if (!_marquer('dateNaissance', !isNaN(naissance.getTime()) && naissance < new Date())) {
      return { ok: false, message: 'La date de naissance doit être une date passée.' };
    }
    return { ok: true };
  },
  2() {
    const ok = _obligatoires(['prenomMere', 'nomMere', 'prenomPere', 'nomPere']);
    if (!ok) return { ok: false, message: 'Le nom et le prénom de la mère et du père sont obligatoires.' };
    const telsOk = ['telephoneMere', 'telephonePere', 'telephoneTuteur']
      .map(id => _marquer(id, _telOk(id, REGEX_TEL_SOUPLE)))
      .every(Boolean);
    if (!telsOk) return { ok: false, message: 'Un numéro de téléphone est invalide (chiffres uniquement, 8 au minimum).' };
    return { ok: true };
  },
  3() {
    const ok = getFormationsSelectionnees().length > 0;
    document.getElementById('formationsError').classList.toggle('show', !ok);
    return ok ? { ok: true } : { ok: false, message: 'Choisissez au moins une formation.' };
  },
  4() {
    if (photoEnVerification) {
      return { ok: false, message: 'Vérification de la photo en cours… patientez quelques secondes puis réessayez.' };
    }
    const champsOk = _obligatoires(['typePiece', 'numeroPiece']);
    const pieceOk  = !!fichiers.piece1;
    const photoOk  = !!fichiers.photo;
    document.getElementById('zone-piece1').classList.toggle('error', !pieceOk);
    document.getElementById('zone-photo').classList.toggle('error', !photoOk);
    if (!champsOk || !pieceOk || !photoOk) {
      const manque = [];
      if (!champsOk) manque.push('le type et le numéro de la pièce');
      if (!pieceOk)  manque.push('le fichier de la pièce d\'identité');
      if (!photoOk)  manque.push('la photo d\'identité');
      return { ok: false, message: 'Il manque : ' + manque.join(', ') + '.' };
    }
    return { ok: true };
  },
  5() {
    const clausesOk = document.getElementById('clause1').checked && document.getElementById('clause2').checked;
    document.getElementById('signatureError').style.display = signatureApposee ? 'none' : 'block';
    if (!clausesOk && !signatureApposee) return { ok: false, message: 'Cochez les deux engagements et signez avant d\'envoyer.' };
    if (!clausesOk) return { ok: false, message: 'Cochez les deux engagements avant d\'envoyer.' };
    if (!signatureApposee) return { ok: false, message: 'Apposez votre signature dans le cadre avant d\'envoyer.' };
    return { ok: true };
  },
};

// Défilement VERTICAL uniquement. scrollIntoView() est à éviter ici :
// #inscription a overflow:hidden (cercle décoratif qui déborde), et
// scrollIntoView peut faire défiler horizontalement cette section en
// coupant le texte à gauche.
function _defilerVers(el, decalage = 0.35) {
  const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * decalage;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

function afficherErreurEtape(n, message) {
  const el = document.getElementById('erreur-etape-' + n);
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  const champ = document.querySelector('#etape-' + n + ' .error');
  _defilerVers(champ || el);
}
function effacerErreurEtape(n) {
  const el = document.getElementById('erreur-etape-' + n);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

function rendreIndicateur() {
  for (let i = 1; i <= NB_ETAPES; i++) {
    const pastille = document.getElementById('step-' + i);
    if (!pastille) continue;
    const etat = i === etapeCourante ? 'active' : (i < etapeMaxAtteinte ? 'done' : '');
    pastille.className = 'form-step' + (etat ? ' ' + etat : '');
    // Retour en arrière uniquement : jamais de saut vers une étape suivante
    // sans repasser par la validation de "Suivant".
    pastille.disabled = i >= etapeCourante;
    if (i === etapeCourante) pastille.setAttribute('aria-current', 'step');
    else pastille.removeAttribute('aria-current');
  }
  const barre = document.getElementById('wizardBarre');
  if (barre) barre.style.width = ((etapeCourante - 1) / (NB_ETAPES - 1) * 100) + '%';
}

function allerEtape(n) {
  if (n < 1 || n > NB_ETAPES) return;
  document.querySelectorAll('.wizard-etape').forEach(f => { f.hidden = Number(f.dataset.etape) !== n; });
  etapeCourante    = n;
  etapeMaxAtteinte = Math.max(etapeMaxAtteinte, n);
  rendreIndicateur();
  if (n === NB_ETAPES) { preparerSignature(); construireRecap(); }

  // Remonter en haut du formulaire (sous la barre de navigation fixe).
  const carte = document.querySelector('.form-card');
  if (carte) {
    const y = carte.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  // Focus sur le premier champ (ordinateur uniquement : sur mobile, ça
  // ouvrirait le clavier à chaque changement d'étape).
  if (window.matchMedia('(min-width: 769px)').matches) {
    const premier = document.querySelector('#etape-' + n + ' input:not([type="file"]):not([type="checkbox"]), #etape-' + n + ' select');
    if (premier) premier.focus({ preventScroll: true });
  }
}

function etapeSuivante() {
  const r = VALIDATEURS[etapeCourante]();
  if (!r.ok) { afficherErreurEtape(etapeCourante, r.message); return; }
  effacerErreurEtape(etapeCourante);
  allerEtape(etapeCourante + 1);
}
function etapePrecedente() {
  effacerErreurEtape(etapeCourante);
  allerEtape(etapeCourante - 1);
}

// La signature est un canvas : dessiné pendant qu'il était masqué, il a
// une taille nulle. On le redimensionne à la première ouverture de
// l'étape 5 (et seulement si sa taille a vraiment changé, pour ne pas
// effacer une signature déjà faite quand on revient sur l'étape).
function preparerSignature() {
  const canvas = document.getElementById('sigCanvas');
  const rect   = canvas.getBoundingClientRect();
  const dpr    = window.devicePixelRatio || 1;
  if (rect.width && canvas.width !== Math.floor(rect.width * dpr)) {
    window.dispatchEvent(new Event('resize'));
    if (signatureApposee) effacerSignature();
  }
}

function construireRecap() {
  const sexe = { M: 'Masculin', F: 'Féminin' }[_val('sexe')] || '';
  const dn   = _val('dateNaissance')
    ? new Date(_val('dateNaissance') + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const tuteur = (_val('prenomTuteur') || _val('nomTuteur')) ? ' — Tuteur : ' + _val('prenomTuteur') + ' ' + _val('nomTuteur') : '';
  const lignes = [
    ['Identité',     `${_val('prenom')} ${_val('nom')} (${sexe})`, 1],
    ['Naissance',    `${dn} à ${_val('lieuNaissance')} — ${_val('nationalite')}`, 1],
    ['Contact',      _val('telephone') + (_val('email') ? ' — ' + _val('email') : ' — pas d\'email'), 1],
    ['Adresse',      _val('adresse'), 1],
    ['Parents',      `Mère : ${_val('prenomMere')} ${_val('nomMere')} — Père : ${_val('prenomPere')} ${_val('nomPere')}${tuteur}`, 2],
    ['Formation(s)', getFormationsSelectionnees().map(nomAffichage).join(', '), 3],
    [document.getElementById('labelVirement').textContent, document.getElementById('premierVirementVal').textContent, 3],
    ['Pièces',       `${_val('typePiece')} n° ${_val('numeroPiece')} — photo jointe` + (fichiers.preuve ? ' — preuve de paiement jointe' : ''), 4],
  ];
  document.getElementById('recapContenu').innerHTML = lignes.map(([lib, val, etape]) => `
    <div class="recap-ligne">
      <span class="recap-lib">${_escapeHtml(lib)}</span>
      <span class="recap-val">${_escapeHtml(val)}</span>
      <button type="button" class="recap-modifier" onclick="allerEtape(${etape})">Modifier</button>
    </div>`).join('');
}

// Affichage final après un envoi réussi : on masque le formulaire, on
// garde le message de confirmation (n° de dossier, consignes de virement).
function wizardSucces() {
  document.getElementById('inscriptionForm').hidden = true;
  document.getElementById('wizardIndicateur').hidden = true;
  const prog = document.querySelector('.wizard-progression');
  if (prog) prog.hidden = true;
  const fb = document.getElementById('formFeedback');
  fb.insertAdjacentHTML('beforeend', `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
      <a href="/espace-apprenant" class="btn-contour">Mon espace apprenant</a>
      <a href="/inscription" class="btn-contour">Nouvelle inscription</a>
    </div>`);
  _defilerVers(fb, 0.25);
}

(function initWizard() {
  const formEl = document.getElementById('inscriptionForm');
  // Entrée dans un champ = "Suivant" (et non un envoi prématuré du dossier).
  formEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || etapeCourante === NB_ETAPES) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    etapeSuivante();
  });
  // Dès que l'apprenant corrige quelque chose, le message d'erreur disparaît.
  formEl.addEventListener('input',  () => effacerErreurEtape(etapeCourante));
  formEl.addEventListener('change', () => effacerErreurEtape(etapeCourante));
  document.querySelectorAll('#wizardIndicateur .form-step').forEach(p => {
    p.addEventListener('click', () => {
      const cible = Number(p.dataset.cible);
      if (cible < etapeCourante) allerEtape(cible);
    });
  });
  rendreIndicateur();
})();

/* ================================================================
   SOUMISSION INSCRIPTION
   FIX : Content-Type text/plain pour éviter le preflight CORS
================================================================ */
const form      = document.getElementById('inscriptionForm');
const submitBtn = document.getElementById('submitBtn');
const feedback  = document.getElementById('formFeedback');

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  feedback.className     = 'form-feedback';
  feedback.style.display = 'none';

  // Pas encore à la dernière étape (ex. touche Entrée) : on avance au
  // lieu d'envoyer.
  if (etapeCourante < NB_ETAPES) { etapeSuivante(); return; }

  // Contrôle complet avant envoi : si une étape précédente a été
  // modifiée entre-temps et n'est plus valide, on y renvoie l'apprenant.
  for (let n = 1; n <= NB_ETAPES; n++) {
    const r = VALIDATEURS[n]();
    if (!r.ok) {
      if (n !== etapeCourante) allerEtape(n);
      afficherErreurEtape(n, r.message);
      return;
    }
  }

  const formations = getFormationsSelectionnees();

  const payload = {
    action:          'inscription',
    prenom:          document.getElementById('prenom').value.trim(),
    nom:             document.getElementById('nom').value.trim(),
    sexe:            document.getElementById('sexe').value,
    dateNaissance:   document.getElementById('dateNaissance').value,
    lieuNaissance:   document.getElementById('lieuNaissance').value.trim(),
    nationalite:     document.getElementById('nationalite').value.trim(),
    adresse:         document.getElementById('adresse').value.trim(),
    telephone:       document.getElementById('telephone').value.trim(),
    email:           document.getElementById('email').value.trim(),
    prenomMere:      document.getElementById('prenomMere').value.trim(),
    nomMere:         document.getElementById('nomMere').value.trim(),
    telephoneMere:   document.getElementById('telephoneMere').value.trim(),
    professionMere:  document.getElementById('professionMere').value.trim(),
    prenomPere:      document.getElementById('prenomPere').value.trim(),
    nomPere:         document.getElementById('nomPere').value.trim(),
    telephonePere:   document.getElementById('telephonePere').value.trim(),
    professionPere:  document.getElementById('professionPere').value.trim(),
    prenomTuteur:    document.getElementById('prenomTuteur').value.trim(),
    nomTuteur:       document.getElementById('nomTuteur').value.trim(),
    telephoneTuteur: document.getElementById('telephoneTuteur').value.trim(),
    formations,
    message:         document.getElementById('message').value.trim(),
    typePiece:       document.getElementById('typePiece').value,
    numeroPiece:     document.getElementById('numeroPiece').value.trim(),
    piece1Base64:    fichiers.piece1.base64,
    piece1MimeType:  fichiers.piece1.mimeType,
    photoBase64:     fichiers.photo.base64,
    photoMimeType:   fichiers.photo.mimeType,
    signatureBase64: obtenirSignatureBase64(),
    clause1:         document.getElementById('clause1').checked,
    clause2:         document.getElementById('clause2').checked,
    preuveBase64:    fichiers.preuve ? fichiers.preuve.base64   : '',
    preuveMimeType:  fichiers.preuve ? fichiers.preuve.mimeType : '',
    date:            new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' })
  };

  const btnOriginal    = submitBtn.innerHTML;
  submitBtn.disabled   = true;
  submitBtn.innerHTML  = `<span class="iconify" data-icon="tabler:loader-2" style="animation:spin 1s linear infinite;"></span> Envoi en cours...`;

  try {
    // FIX CORS : text/plain évite le preflight OPTIONS que GAS ne gère pas
    const resp   = await fetch(GAS_WEBAPP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload)
    });
    const result = await resp.json();

    if (result.status === 'success') {
      feedback.className    = 'form-feedback success';
      feedback.innerHTML    = `
        <strong>Dossier n° ${result.id} enregistré.</strong><br>
        Les coordonnées bancaires ont été envoyées à ${payload.email || 'votre email'}.
        Effectuez votre virement en mentionnant la référence <strong>${result.id}</strong> dans le motif.
        Envoyez ensuite la preuve par WhatsApp au <strong>+229 01 97 95 12 30</strong>.
      `;
      feedback.style.display = 'block';
      form.reset();
      ['piece1','photo','preuve'].forEach(c => effacerZone(c));
      document.querySelectorAll('input[name="formations"]').forEach(cb => { cb.checked = false; cb.disabled = false; });
      effacerSignature();
      document.getElementById('fraisBloc').classList.remove('show');
      resetBtnLabel();
      showToast(`Dossier ${result.id} enregistré. Virement attendu.`, 'success');
      wizardSucces();
    } else {
      // AVANT : on affichait un message générique qui masquait la vraie
      // raison du rejet (ex. "Champs invalides : formation(s), ...") —
      // l'apprenant ne savait jamais quoi corriger et abandonnait, ou
      // ré-essayait à l'identique en pensant que "le site ne marche pas".
      // On affiche maintenant le message précis renvoyé par GAS, tout
      // en gardant une trace console pour le diagnostic technique.
      console.error('[Inscription] Rejet serveur — formations:', formations, 'clause1:', payload.clause1, 'clause2:', payload.clause2, '— message:', result.message);
      feedback.className     = 'form-feedback error-msg';
      feedback.textContent   = result.message || 'Votre dossier n\'a pas pu être enregistré. Vérifiez les champs signalés puis réessayez.';
      feedback.style.display = 'block';
      showToast(result.message || 'Dossier rejeté — vérifiez le formulaire.', 'error');
    }

  } catch (err) {
    console.error('[Inscription]', err);
    feedback.className     = 'form-feedback error-msg';
    feedback.textContent   = 'Une erreur de connexion est survenue. Vérifiez votre connexion internet et réessayez, ou appelez-nous au +229 01 97 95 12 30.';
    feedback.style.display = 'block';
    showToast('Erreur d\'envoi. Réessayez.', 'error');
  } finally {
    submitBtn.disabled  = false;
    submitBtn.innerHTML = btnOriginal;
  }
});

form.querySelectorAll('.form-control').forEach(el => {
  el.addEventListener('input',  () => el.classList.remove('error'));
  el.addEventListener('change', () => el.classList.remove('error'));
});

/* ================================================================
   PRÉSÉLECTION depuis la page Formations (/inscription?formation=...)
================================================================ */
function preselectionnerFormation(formation) {
  const cb = Array.from(document.querySelectorAll('input[name="formations"]')).find(c => c.value === formation);
  if (!cb) return;
  if (!cb.disabled) cb.checked = true;
  mettreAJourFrais();
  showToast('Formation présélectionnée : ' + nomAffichage(formation), 'success');
}
(function preselectionDepuisUrl() {
  const formation = new URLSearchParams(window.location.search).get('formation');
  if (formation) preselectionnerFormation(formation);
})();

/* js/inscription.js — page Inscription : calcul des frais, étapes,
   pièces jointes (+ contrôle visage), signature, envoi du dossier.
   Dépend de js/site.js (GAS_WEBAPP_URL, formatFCFA, showToast). */
/* ================================================================
   CONFIG — Coûts formations (FCFA)
   TODO : renseigner les montants réels — même valeurs que code.gs
================================================================ */
const COUTS_FORMATIONS = {
  'Informatique & Bureautique': 100000,
  'Graphisme & PAO':           200000,
  'Sérigraphie':                100000,
  'Création de sites web':      250000
};
const FRAIS_INSCRIPTION = 10000;
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
function gererExclusiviteFormationCourte() {
  const caseCourte   = document.getElementById('f5');
  const casePack     = document.getElementById('f6');
  const casesLongues = Array.from(document.querySelectorAll('input[name="formations"]:not(#f5):not(#f6)'));
  const hintCourte   = document.getElementById('hint-courte');
  const hintPack     = document.getElementById('hint-pack');

  if (caseCourte.checked) {
    casesLongues.forEach(cb => { cb.checked = false; cb.disabled = true; });
    casePack.checked = false; casePack.disabled = true;
    hintCourte.style.display = 'block';
  } else if (casePack.checked) {
    casesLongues.forEach(cb => { cb.checked = false; cb.disabled = true; });
    caseCourte.checked = false; caseCourte.disabled = true;
    hintPack.style.display = 'block';
  } else {
    casesLongues.forEach(cb => cb.disabled = false);
    caseCourte.disabled = false;
    casePack.disabled   = false;
    hintCourte.style.display = 'none';
    hintPack.style.display   = 'none';
  }

  const uneLongueCochee = casesLongues.some(cb => cb.checked);
  caseCourte.disabled = caseCourte.disabled || uneLongueCochee;
  casePack.disabled   = casePack.disabled   || uneLongueCochee;
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

  updateStep(2, 'done');
  updateStep(3, 'active');
}

function resetBtnLabel() {
  document.getElementById('submitBtn').innerHTML =
    `<span class="iconify" data-icon="tabler:send"></span> Soumettre mon dossier`;
}

document.querySelectorAll('input[name="formations"]').forEach(cb => {
  cb.addEventListener('change', mettreAJourFrais);
});

/* ================================================================
   STEPS
================================================================ */
function updateStep(num, state) {
  const el = document.getElementById('step-' + num);
  if (el) el.className = 'form-step ' + state;
}

['prenom','nom','telephone'].forEach(id => {
  document.getElementById(id).addEventListener('input', checkStep1);
});
document.getElementById('sexe').addEventListener('change', checkStep1);
function checkStep1() {
  const ok = document.getElementById('prenom').value.trim() &&
             document.getElementById('nom').value.trim() &&
             document.getElementById('sexe').value &&
             document.getElementById('telephone').value.trim();
  updateStep(1, ok ? 'done' : 'active');
  if (ok) updateStep(2, 'active');
}

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
      const verif = await verifierVisagePhoto(dataURL);
      if (verif.rejet) {
        showToast(verif.message, 'error');
        effacerZone(cle);
        input.value = '';
        return;
      }
    }

    fichiers[cle] = { base64: dataURL.split(',')[1], mimeType: file.type, nom: file.name };
    majUIUpload(cle, file.name, true);
    if (cle === 'piece1' || cle === 'photo') {
      const piece1ok = !!fichiers.piece1;
      const photoOk  = !!fichiers.photo;
      if (piece1ok && photoOk) { updateStep(3, 'done'); updateStep(4, 'active'); }
      else updateStep(3, 'active');
    }
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
   VALIDATION INSCRIPTION
================================================================ */
function validateInscription() {
  let valid = true;

  ['prenom','nom','sexe','telephone','typePiece','dateNaissance','lieuNaissance','nationalite','adresse',
   'prenomMere','nomMere','prenomPere','nomPere','numeroPiece'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('error');
    if (!el.value.trim()) { el.classList.add('error'); valid = false; }
  });

  const tel = document.getElementById('telephone');
  if (tel.value && !/^(\+229|229|0)[0-9\s]{8,15}$/.test(tel.value.replace(/\s/g,''))) {
    tel.classList.add('error'); valid = false;
  }

  const email = document.getElementById('email');
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    email.classList.add('error'); valid = false;
  }

  const formations = getFormationsSelectionnees();
  const errEl      = document.getElementById('formationsError');
  if (formations.length === 0) {
    errEl.classList.add('show'); valid = false;
  } else {
    errEl.classList.remove('show');
  }

  if (!fichiers.piece1) { document.getElementById('zone-piece1').classList.add('error'); valid = false; }
  if (!fichiers.photo)  { document.getElementById('zone-photo').classList.add('error');  valid = false; }

  const sigErrEl = document.getElementById('signatureError');
  if (!signatureApposee) { sigErrEl.style.display = 'block'; valid = false; }
  else { sigErrEl.style.display = 'none'; }

  if (!document.getElementById('clause1').checked) valid = false;
  if (!document.getElementById('clause2').checked) valid = false;

  return valid;
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

  if (!validateInscription()) {
    feedback.className     = 'form-feedback error-msg';
    feedback.textContent   = 'Veuillez corriger les champs manquants ou invalides.';
    feedback.style.display = 'block';
    return;
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
  showToast('Formation présélectionnée : ' + formation, 'success');
}
(function preselectionDepuisUrl() {
  const formation = new URLSearchParams(window.location.search).get('formation');
  if (formation) preselectionnerFormation(formation);
})();

/* =====================================================================
   TÉMOIGNAGES — affichage public + formulaire ancien apprenant
   Backend : GAS/temoignages.gs (actions temoignages_publies /
   temoignage_soumettre). Dépend de GAS_WEBAPP_URL (index.html).
===================================================================== */
"use strict";

// Clé de SITE reCAPTCHA v3 (publique par nature). À créer sur
// https://www.google.com/recaptcha/admin (type v3, domaine
// qualitededieuservice.com). La clé SECRÈTE va UNIQUEMENT dans GAS :
// Propriétés du script -> RECAPTCHA_SECRET. Tant que ce champ est vide,
// le formulaire fonctionne sans reCAPTCHA (vérification ID + téléphone
// et modération admin restent actives).
const RECAPTCHA_SITE_KEY = '';

const TEM_CFG = {
  LONGUEUR_MIN: 30,
  LONGUEUR_MAX: 800,
  PHOTO_BRUTE_MAX: 10 * 1024 * 1024, // fichier choisi (avant compression)
  PHOTO_COTE_MAX: 800,               // px — redimensionnement navigateur
  PHOTO_QUALITE: 0.82
};

let _temPhotoBase64 = '';
let _temNote = 0;

/* ---------- reCAPTCHA v3 : chargé uniquement si une clé est définie ---------- */
function _temChargerRecaptcha() {
  if (!RECAPTCHA_SITE_KEY || document.getElementById('recaptcha-v3-script')) return;
  const s = document.createElement('script');
  s.id = 'recaptcha-v3-script';
  s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(RECAPTCHA_SITE_KEY);
  s.async = true;
  document.head.appendChild(s);
}

function _temObtenirJetonRecaptcha() {
  return new Promise(resolve => {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) return resolve('');
    window.grecaptcha.ready(() => {
      window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'temoignage' })
        .then(resolve).catch(() => resolve(''));
    });
  });
}

/* ---------- Affichage public ---------- */
function _temEtoiles(note) {
  const wrap = document.createElement('div');
  wrap.className = 'tem-etoiles';
  wrap.setAttribute('aria-label', note + ' sur 5');
  for (let i = 1; i <= 5; i++) {
    const e = document.createElement('span');
    e.className = 'iconify';
    e.setAttribute('data-icon', i <= note ? 'tabler:star-filled' : 'tabler:star');
    wrap.appendChild(e);
  }
  return wrap;
}

function _temInitiales(nom) {
  return String(nom || '?').split(' ').filter(Boolean).slice(0, 2).map(m => m.charAt(0).toUpperCase()).join('');
}

// Construction 100 % DOM (textContent) : aucun texte saisi par un
// visiteur n'est jamais injecté comme HTML.
function _temCarte(t) {
  const carte = document.createElement('article');
  carte.className = 'tem-card reveal visible';

  carte.appendChild(_temEtoiles(t.note));

  const p = document.createElement('p');
  p.className = 'tem-texte';
  p.textContent = '« ' + t.texte + ' »';
  carte.appendChild(p);

  const pied = document.createElement('div');
  pied.className = 'tem-auteur';

  if (t.photo) {
    const img = document.createElement('img');
    img.src = t.photo;
    img.alt = t.nom;
    img.loading = 'lazy';
    img.className = 'tem-avatar';
    img.onerror = () => { img.replaceWith(_temAvatarTexte(t.nom)); };
    pied.appendChild(img);
  } else {
    pied.appendChild(_temAvatarTexte(t.nom));
  }

  const infos = document.createElement('div');
  const nom = document.createElement('strong');
  nom.textContent = t.nom;
  const fil = document.createElement('span');
  fil.textContent = t.filiere;
  const badge = document.createElement('span');
  badge.className = 'tem-badge';
  badge.innerHTML = '<span class="iconify" data-icon="tabler:rosette-discount-check"></span> Apprenant certifié';
  infos.append(nom, fil, badge);
  pied.appendChild(infos);

  carte.appendChild(pied);
  return carte;
}

function _temAvatarTexte(nom) {
  const d = document.createElement('div');
  d.className = 'tem-avatar tem-avatar-texte';
  d.textContent = _temInitiales(nom);
  return d;
}

async function chargerTemoignages() {
  const grille = document.getElementById('tem-grille');
  const resume = document.getElementById('tem-resume');
  if (!grille) return;
  try {
    const resp = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'temoignages_publies' })
    });
    const res = await resp.json();
    grille.innerHTML = '';
    if (res.status !== 'success' || !res.temoignages || !res.temoignages.length) {
      const vide = document.createElement('p');
      vide.className = 'tem-vide';
      vide.textContent = "Les premiers témoignages de nos apprenants certifiés arrivent bientôt. Vous avez terminé votre formation chez nous ? Soyez le premier à partager votre expérience.";
      grille.appendChild(vide);
      if (resume) resume.style.display = 'none';
      return;
    }
    res.temoignages.forEach(t => grille.appendChild(_temCarte(t)));
    if (resume) {
      resume.style.display = 'inline-flex';
      resume.textContent = '';
      resume.appendChild(_temEtoiles(Math.round(res.moyenne)));
      const txt = document.createElement('span');
      txt.textContent = String(res.moyenne).replace('.', ',') + '/5 — ' + res.total + ' avis d\'apprenants certifiés';
      resume.appendChild(txt);
    }
  } catch (e) {
    console.error('[chargerTemoignages]', e);
    grille.innerHTML = '';
  }
}

/* ---------- Formulaire ---------- */
function ouvrirFormulaireTemoignage() {
  const bloc = document.getElementById('tem-form-bloc');
  if (!bloc) return;
  bloc.style.display = 'block';
  _temChargerRecaptcha();
  bloc.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _temMessage(texte, type) {
  const m = document.getElementById('tem-msg');
  m.textContent = texte;
  m.className = 'tem-msg show ' + (type === 'ok' ? 'ok' : 'err');
}

function _temChoisirNote(n) {
  _temNote = n;
  document.querySelectorAll('#tem-note-choix button').forEach(b => {
    const actif = Number(b.dataset.note) <= n;
    b.classList.toggle('actif', actif);
    b.setAttribute('aria-pressed', Number(b.dataset.note) === n ? 'true' : 'false');
  });
}

// Compression navigateur : redimensionne à 800 px max et réencode en
// JPEG. Réduit la photo à ~100-250 Ko et retire les métadonnées EXIF
// (dont la position GPS éventuelle du téléphone).
function _temCompresserPhoto(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('lecture'));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image'));
      img.onload = () => {
        const ratio = Math.min(1, TEM_CFG.PHOTO_COTE_MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', TEM_CFG.PHOTO_QUALITE));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

async function _temPhotoChoisie(evt) {
  const fichier = evt.target.files && evt.target.files[0];
  const apercu = document.getElementById('tem-photo-apercu');
  _temPhotoBase64 = '';
  apercu.innerHTML = '';
  if (!fichier) return;

  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
    evt.target.value = '';
    return _temMessage('Photo : formats acceptés JPG, PNG ou WEBP.', 'err');
  }
  if (fichier.size > TEM_CFG.PHOTO_BRUTE_MAX) {
    evt.target.value = '';
    return _temMessage('Photo trop lourde (10 Mo maximum).', 'err');
  }
  try {
    _temPhotoBase64 = await _temCompresserPhoto(fichier);
    const img = document.createElement('img');
    img.src = _temPhotoBase64;
    img.alt = 'Aperçu de votre photo';
    apercu.appendChild(img);
    document.getElementById('tem-msg').className = 'tem-msg';
  } catch (e) {
    evt.target.value = '';
    _temMessage('Impossible de lire cette photo. Essayez-en une autre.', 'err');
  }
}

function _temCompteur() {
  const t = document.getElementById('tem-texte');
  const c = document.getElementById('tem-compteur');
  const n = t.value.trim().length;
  c.textContent = n + ' / ' + TEM_CFG.LONGUEUR_MAX;
  c.classList.toggle('insuffisant', n < TEM_CFG.LONGUEUR_MIN);
}

async function soumettreTemoignage(evt) {
  evt.preventDefault();
  const id = document.getElementById('tem-id').value.trim().toUpperCase();
  const tel = document.getElementById('tem-tel').value.trim();
  const texte = document.getElementById('tem-texte').value.trim();
  const consent = document.getElementById('tem-consent').checked;
  const formatNom = document.querySelector('input[name="tem-format-nom"]:checked').value;

  // Validation locale (doublée côté serveur).
  if (!/^[A-Z0-9][A-Z0-9-]{5,29}$/.test(id)) return _temMessage('Numéro de dossier invalide (ex. : LQD-250312-AB12). Il figure sur votre attestation.', 'err');
  if (tel.replace(/\D/g, '').length < 8) return _temMessage('Numéro de téléphone invalide.', 'err');
  if (!_temNote) return _temMessage('Choisissez une note de 1 à 5 étoiles.', 'err');
  if (texte.length < TEM_CFG.LONGUEUR_MIN) return _temMessage(`Votre témoignage doit contenir au moins ${TEM_CFG.LONGUEUR_MIN} caractères.`, 'err');
  if (!consent) return _temMessage('Merci d\'accepter la publication de votre témoignage.', 'err');

  const btn = document.getElementById('tem-btn');
  const libelle = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  try {
    const recaptchaToken = await _temObtenirJetonRecaptcha();
    const resp = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'temoignage_soumettre',
        id, telephone: tel, note: _temNote, texte, formatNom,
        consentement: true,
        photoBase64: _temPhotoBase64 || '',
        recaptchaToken
      })
    });
    const res = await resp.json();
    if (res.status === 'success') {
      _temMessage(res.message, 'ok');
      document.getElementById('tem-form').reset();
      document.getElementById('tem-photo-apercu').innerHTML = '';
      _temPhotoBase64 = '';
      _temChoisirNote(0);
      _temCompteur();
    } else {
      _temMessage(res.message || 'Une erreur est survenue.', 'err');
    }
  } catch (e) {
    console.error('[soumettreTemoignage]', e);
    _temMessage('Erreur de connexion. Vérifiez votre réseau et réessayez.', 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = libelle;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('temoignages')) return;

  document.querySelectorAll('#tem-note-choix button').forEach(b => {
    b.addEventListener('click', () => _temChoisirNote(Number(b.dataset.note)));
  });
  document.getElementById('tem-photo').addEventListener('change', _temPhotoChoisie);
  document.getElementById('tem-texte').addEventListener('input', _temCompteur);
  document.getElementById('tem-form').addEventListener('submit', soumettreTemoignage);
  _temCompteur();

  // Lien reçu par email en fin de formation : ?ref=LQD-...#temoignages
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[A-Za-z0-9][A-Za-z0-9-]{5,29}$/.test(ref)) {
    document.getElementById('tem-id').value = ref.toUpperCase();
    ouvrirFormulaireTemoignage();
  }

  // Chargement différé : uniquement quand la section approche de l'écran.
  const section = document.getElementById('temoignages');
  const obs = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) { obs.disconnect(); chargerTemoignages(); }
  }, { rootMargin: '300px' });
  obs.observe(section);
});

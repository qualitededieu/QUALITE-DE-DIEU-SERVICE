/* ==================================================================
   js/temoignages.js — témoignages d'apprenants
   - Page /temoignages : liste complète + formulaire de dépôt.
   - Page d'accueil : les 3 plus récents (bloc masqué s'il n'y en a pas).
   Un témoignage n'est accepté par GAS (GAS/temoignages.gs) qu'avec un
   numéro de dossier + téléphone d'apprenant confirmé. Dépend de
   js/site.js (GAS_WEBAPP_URL, _escapeHtml, showToast).
================================================================== */
(function () {
  const TEXTE_MIN = 30;
  const TEXTE_MAX = 600;
  const PHOTO_COTE = 320;           // photo de profil finale : carré 320 x 320
  const PHOTO_SOURCE_MAX = 8 * 1024 * 1024;

  /* ------------------------------ Affichage ------------------------------ */
  function etoiles(note) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="iconify${i <= note ? ' pleine' : ''}" data-icon="${i <= note ? 'tabler:star-filled' : 'tabler:star'}"></span>`;
    }
    return `<span class="temo-etoiles" role="img" aria-label="${note} sur 5">${html}</span>`;
  }

  function initiales(nom) {
    return String(nom || '?').split(/\s+/).map(m => m.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  function dateCourte(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  function carte(t) {
    const avatar = t.photo
      ? `<img class="temo-avatar" src="${_escapeHtml(t.photo)}" alt="" loading="lazy" />`
      : `<span class="temo-avatar temo-avatar-initiales" aria-hidden="true">${_escapeHtml(initiales(t.nom))}</span>`;
    return `
      <article class="temo-carte reveal visible">
        <span class="temo-guillemet iconify" data-icon="tabler:quote" aria-hidden="true"></span>
        ${etoiles(t.note)}
        <p class="temo-texte">${_escapeHtml(t.texte)}</p>
        <div class="temo-auteur">
          ${avatar}
          <div>
            <strong translate="no">${_escapeHtml(t.nom)}</strong>
            <span>${_escapeHtml(t.filiere)}${t.date ? ' — ' + _escapeHtml(dateCourte(t.date)) : ''}</span>
          </div>
        </div>
      </article>`;
  }

  async function lister(limite) {
    const resp = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'temoignages_lister', limite })
    });
    const r = await resp.json();
    if (r.status !== 'success') throw new Error(r.message || 'Erreur');
    return r;
  }

  // Le serveur GAS peut mettre quelques secondes à "se réveiller" : on
  // retente une fois avant d'abandonner.
  async function listerAvecReprise(limite) {
    try { return await lister(limite); }
    catch (e) {
      await new Promise(ok => setTimeout(ok, 2500));
      return lister(limite);
    }
  }

  // Message affiché quand la liste est vide OU indisponible : on ne parle
  // jamais de panne au visiteur, on l'invite à agir. La vraie cause reste
  // visible dans la console (F12) pour le diagnostic.
  function blocInvitation(texte) {
    return `<div class="temo-vide">
      <span class="iconify" data-icon="tabler:message-heart"></span>
      <p>${texte}</p>
      <a href="#formTemoignage" class="temo-vide-btn">Laisser mon témoignage</a>
    </div>`;
  }

  // Page Témoignages : liste complète + note moyenne
  async function chargerPage() {
    const liste = document.getElementById('temoignagesListe');
    if (!liste) return;
    const stats = document.getElementById('temoignagesStats');
    try {
      const r = await listerAvecReprise(100);
      if (!r.temoignages.length) {
        liste.innerHTML = blocInvitation('Les avis de nos apprenants seront bientôt publiés ici. Vous avez suivi une formation chez nous ? Soyez le premier ou la première à partager votre expérience.');
        if (stats) stats.hidden = true;
        return;
      }
      liste.innerHTML = r.temoignages.map(carte).join('');
      if (stats) {
        stats.hidden = false;
        stats.innerHTML = `${etoiles(Math.round(r.moyenne))}
          <strong>${String(r.moyenne).replace('.', ',')} / 5</strong>
          <span>sur ${r.total} témoignage${r.total > 1 ? 's' : ''} d'apprenants vérifiés</span>`;
      }
    } catch (e) {
      liste.innerHTML = blocInvitation('Nos apprenants partagent ici leur expérience au centre. Vous avez suivi une formation chez nous ? Votre avis compte : laissez votre témoignage ci-dessous.');
      if (stats) stats.hidden = true;
      console.warn('[temoignages] liste indisponible :', e.message);
    }
  }

  // Accueil : 3 plus récents, bloc entier masqué s'il n'y en a aucun
  async function chargerAccueil() {
    const zone = document.getElementById('temoignagesAccueil');
    if (!zone) return;
    const section = document.getElementById('sectionTemoignagesAccueil');
    try {
      const r = await listerAvecReprise(3);
      if (!r.temoignages.length) return;
      zone.innerHTML = r.temoignages.map(carte).join('');
      if (section) section.hidden = false;
    } catch (e) { /* bloc facultatif : on reste silencieux */ }
  }

  /* ------------------------- Formulaire de dépôt ------------------------- */
  const form = document.getElementById('formTemoignage');
  let photoBase64 = '';

  function initFormulaire() {
    if (!form) return;
    const champNote = document.getElementById('temo-note');
    const boutons = Array.from(form.querySelectorAll('.temo-etoile-btn'));
    function choisirNote(n) {
      champNote.value = String(n);
      boutons.forEach((b, i) => {
        b.classList.toggle('active', i < n);
        b.setAttribute('aria-checked', i + 1 === n ? 'true' : 'false');
        // Icône recréée (et non modifiée) : Iconify remplace le <span> par un <svg>.
        b.innerHTML = `<span class="iconify" data-icon="${i < n ? 'tabler:star-filled' : 'tabler:star'}"></span>`;
      });
      document.getElementById('temo-note-lib').textContent = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent'][n];
    }
    boutons.forEach((b, i) => {
      b.addEventListener('click', () => choisirNote(i + 1));
      b.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp')  { e.preventDefault(); const n = Math.min(5, (Number(champNote.value) || 0) + 1); choisirNote(n); boutons[n - 1].focus(); }
        if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') { e.preventDefault(); const n = Math.max(1, (Number(champNote.value) || 2) - 1); choisirNote(n); boutons[n - 1].focus(); }
      });
    });

    const zoneTexte = document.getElementById('temo-texte');
    const compteur  = document.getElementById('temo-compteur');
    zoneTexte.addEventListener('input', () => {
      const n = zoneTexte.value.trim().length;
      compteur.textContent = `${n} / ${TEXTE_MAX}`;
      compteur.classList.toggle('alerte', n > 0 && (n < TEXTE_MIN || n > TEXTE_MAX));
    });

    // Le message d'erreur et le cadre rouge disparaissent dès que l'on corrige.
    form.addEventListener('input', e => {
      if (e.target.classList) e.target.classList.remove('error');
      if (e.target.id === 'temo-consent') e.target.closest('label').classList.remove('error');
      const fb = document.getElementById('temo-feedback');
      if (fb.classList.contains('error-msg')) fb.style.display = 'none';
    });
    document.getElementById('temo-photo').addEventListener('change', gererPhoto);
    document.getElementById('temo-photo-retirer').addEventListener('click', retirerPhoto);
    form.addEventListener('submit', envoyer);

    // Lien envoyé à l'apprenant : /temoignages?ref=LQD-...#formTemoignage
    // pré-remplit son numéro de dossier.
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && /^[A-Za-z0-9][A-Za-z0-9-]{3,29}$/.test(ref)) {
      document.getElementById('temo-id').value = ref.toUpperCase();
    }
  }

  function retirerPhoto() {
    photoBase64 = '';
    document.getElementById('temo-photo').value = '';
    document.getElementById('temo-photo-apercu').hidden = true;
    document.getElementById('temo-photo-zone').hidden = false;
  }

  // face-api.js (même librairie que la photo d'inscription), chargée
  // seulement si l'apprenant joint une photo. En cas d'échec réseau, on
  // recadre simplement au centre : la photo n'est jamais refusée pour ça.
  let _faceApi = null;
  function chargerFaceApi() {
    if (_faceApi) return _faceApi;
    _faceApi = new Promise((resolve, reject) => {
      if (window.faceapi) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('face-api indisponible'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('délai dépassé')), 10000);
    }).then(() => faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'));
    _faceApi.catch(() => { _faceApi = null; });
    return _faceApi;
  }

  // Lecture en data: URL (autorisée par la CSP du site, contrairement
  // aux adresses blob: qui faisaient échouer toutes les photos).
  function chargerImage(file) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onerror = () => reject(new Error('image illisible'));
      lecteur.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image illisible'));
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(file);
    });
  }

  // Ne garde que le visage ("le profil") : carré centré sur le visage
  // détecté, avec un peu de marge pour les épaules et les cheveux.
  async function recadrerProfil(file) {
    const img = await chargerImage(file);
    let boite = null;
    try {
      await chargerFaceApi();
      const det = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }));
      if (det) boite = det.box;
    } catch (e) {
      console.warn('[temoignages] détection de visage indisponible, recadrage au centre :', e.message);
    }
    let cx, cy, cote;
    if (boite) {
      cote = Math.max(boite.width, boite.height) * 2.1;
      cx = boite.x + boite.width / 2;
      cy = boite.y + boite.height / 2.3;
    } else {
      cote = Math.min(img.width, img.height);
      cx = img.width / 2;
      cy = img.height / 2;
    }
    cote = Math.min(cote, img.width, img.height);
    const sx = Math.max(0, Math.min(img.width - cote, cx - cote / 2));
    const sy = Math.max(0, Math.min(img.height - cote, cy - cote / 2));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_COTE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cote, cote, 0, 0, PHOTO_COTE, PHOTO_COTE);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.86), visageTrouve: !!boite };
  }

  async function gererPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Format non accepté : utilisez une photo JPG ou PNG.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > PHOTO_SOURCE_MAX) {
      showToast('Photo trop lourde (8 Mo maximum).', 'error');
      e.target.value = '';
      return;
    }
    const info = document.getElementById('temo-photo-info');
    info.textContent = 'Recadrage sur votre visage...';
    document.getElementById('temo-photo-zone').hidden = true;
    document.getElementById('temo-photo-apercu').hidden = false;
    try {
      const r = await recadrerProfil(file);
      photoBase64 = r.dataUrl.split(',')[1];
      document.getElementById('temo-photo-img').src = r.dataUrl;
      info.textContent = r.visageTrouve ? 'Photo recadrée sur votre visage.' : 'Visage non détecté : photo recadrée au centre.';
    } catch (err) {
      retirerPhoto();
      showToast('Impossible de lire cette photo. Essayez-en une autre.', 'error');
    }
  }

  function erreurForm(message) {
    const fb = document.getElementById('temo-feedback');
    fb.className = 'form-feedback error-msg';
    fb.textContent = message;
    fb.style.display = 'block';
  }

  async function envoyer(e) {
    e.preventDefault();
    const fb    = document.getElementById('temo-feedback');
    const id    = document.getElementById('temo-id').value.trim().toUpperCase();
    const tel   = document.getElementById('temo-tel').value.trim();
    const note  = Number(document.getElementById('temo-note').value);
    const texte = document.getElementById('temo-texte').value.trim();
    fb.style.display = 'none';

    ['temo-id', 'temo-tel', 'temo-texte'].forEach(c => document.getElementById(c).classList.remove('error'));
    if (!id)  { document.getElementById('temo-id').classList.add('error');  return erreurForm('Indiquez votre numéro de dossier (il figure sur votre carte d\'apprenant).'); }
    if (!/^(\+229|229|0)?[0-9]{8,15}$/.test(tel.replace(/\s/g, ''))) { document.getElementById('temo-tel').classList.add('error'); return erreurForm('Indiquez le numéro de téléphone donné à l\'inscription.'); }
    if (!(note >= 1 && note <= 5)) return erreurForm('Choisissez une note de 1 à 5 étoiles.');
    if (texte.length < TEXTE_MIN || texte.length > TEXTE_MAX) {
      document.getElementById('temo-texte').classList.add('error');
      return erreurForm(`Votre témoignage doit faire entre ${TEXTE_MIN} et ${TEXTE_MAX} caractères.`);
    }
    const consent = document.getElementById('temo-consent');
    if (consent && !consent.checked) {
      consent.closest('label').classList.add('error');
      return erreurForm('Cochez la case pour accepter la publication de votre témoignage.');
    }

    const btn = document.getElementById('temo-btn');
    const libelle = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="iconify" data-icon="tabler:loader-2" style="animation:spin 1s linear infinite;"></span> Vérification de votre dossier...';
    try {
      const resp = await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'temoignage_deposer', id, telephone: tel, note, texte, consentement: true,
          photoBase64: photoBase64 || '', photoMimeType: photoBase64 ? 'image/jpeg' : ''
        })
      });
      const r = await resp.json();
      if (r.status === 'success') {
        fb.className = 'form-feedback success';
        fb.textContent = r.message;
        fb.style.display = 'block';
        form.reset();
        retirerPhoto();
        document.getElementById('temo-note').value = '';
        form.querySelectorAll('.temo-etoile-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); b.innerHTML = '<span class="iconify" data-icon="tabler:star"></span>'; });
        document.getElementById('temo-note-lib').textContent = '';
        document.getElementById('temo-compteur').textContent = `0 / ${TEXTE_MAX}`;
        showToast('Merci pour votre témoignage !', 'success');
        chargerPage();
      } else if (/^Champs invalides|prénom, nom, sexe/i.test(r.message || '')) {
        // Serveur GAS pas encore mis à jour : il traite l'envoi comme une
        // inscription. Le visiteur n'y est pour rien, on ne lui montre pas ça.
        console.error('[temoignages] le déploiement GAS en ligne ne connaît pas "temoignage_deposer" : redéployez une nouvelle version.');
        erreurForm('Le dépôt de témoignages est en cours de mise à jour. Merci de réessayer un peu plus tard ou d\'appeler le centre au 01 97 95 12 30.');
      } else {
        erreurForm(r.message || 'Envoi impossible. Vérifiez vos informations.');
      }
    } catch (err) {
      erreurForm('Erreur de connexion. Réessayez dans un instant.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = libelle;
    }
  }

  initFormulaire();
  chargerPage();
  chargerAccueil();
})();

/* js/renseignement.js — page Renseignements : formulaire "Vous avez
   des questions ?". Dépend de js/site.js (GAS_WEBAPP_URL, showToast). */
/* ================================================================
   SOUMISSION RENSEIGNEMENT
   FIX 1 : Content-Type text/plain — évite le preflight CORS
   FIX 2 : URL sans ?action= (déjà dans le body JSON)
   FIX 3 : console.error ajouté pour déboguer si besoin
================================================================ */
const rensForm = document.getElementById('rensForm');
const rensBtn  = document.getElementById('rensBtn');
const rensFeed = document.getElementById('rensFeedback');

rensForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  rensFeed.className     = 'form-feedback';
  rensFeed.style.display = 'none';

  const prenom    = document.getElementById('rens-prenom').value.trim();
  const nom       = document.getElementById('rens-nom').value.trim();
  const telephone = document.getElementById('rens-telephone').value.trim();
  const email     = document.getElementById('rens-email').value.trim();
  const question  = document.getElementById('rens-question').value.trim();
  const formations = Array.from(document.querySelectorAll('input[name="rens-formations"]:checked')).map(cb => cb.value);

  let valid = true;
  [['rens-prenom', prenom], ['rens-nom', nom], ['rens-telephone', telephone]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    el.classList.remove('error');
    if (!val || val.length < 2) { el.classList.add('error'); valid = false; }
  });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('rens-email').classList.add('error'); valid = false;
  }

  if (!valid) {
    rensFeed.className     = 'form-feedback error-msg';
    rensFeed.textContent   = 'Veuillez remplir correctement les champs obligatoires.';
    rensFeed.style.display = 'block';
    return;
  }

  const btnOrig    = rensBtn.innerHTML;
  rensBtn.disabled = true;
  rensBtn.innerHTML = `<span class="iconify" data-icon="tabler:loader-2" style="animation:spin 1s linear infinite;"></span> Envoi...`;

  try {
    // FIX CORS : text/plain + action dans le body + URL sans query param
    const resp = await fetch(GAS_WEBAPP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ action: 'renseignement', prenom, nom, telephone, email, formations, question })
    });
    const result = await resp.json();

    if (result.status === 'success') {
      rensFeed.className    = 'form-feedback success';
      rensFeed.innerHTML    = `<strong>Demande n° ${_escapeHtml(result.id)} reçue.</strong><br>Nous vous répondons sous 24 h au ${_escapeHtml(telephone)}.
        Notez ce numéro : avec votre téléphone, il vous permet de lire notre réponse
        <a href="#suivi" style="font-weight:700;">ci-dessous, dans « Suivre ma demande »</a>.`;
      const champSuivi = document.getElementById('suivi-id');
      if (champSuivi) { champSuivi.value = result.id; document.getElementById('suivi-tel').value = telephone; }
      rensFeed.style.display = 'block';
      rensForm.reset();
      showToast('Demande de renseignement envoyée !', 'success');
    } else {
      throw new Error(result.message || 'Erreur');
    }
  } catch (err) {
    // FIX : console.error pour visualiser l'erreur réelle dans la console navigateur
    console.error('[Renseignement]', err);
    rensFeed.className     = 'form-feedback error-msg';
    rensFeed.textContent   = 'Erreur d\'envoi. Appelez-nous au +229 01 97 95 12 30.';
    rensFeed.style.display = 'block';
  } finally {
    rensBtn.disabled  = false;
    rensBtn.innerHTML = btnOrig;
  }
});

/* ================================================================
   SUIVRE MA DEMANDE — affiche la réponse publiée depuis l'admin
   (GAS/renseignements_suivi.gs, action renseignement_suivre).
================================================================ */
(function () {
  const form = document.getElementById('suiviForm');
  if (!form) return;
  const fb = document.getElementById('suiviFeedback');
  const zone = document.getElementById('suiviResultat');

  // Les textes du formulaire public sont stockés avec < et > échappés côté
  // serveur : on les remet en clair avant de les réafficher (en texte brut).
  const decoder = t => String(t || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const texteHtml = t => _escapeHtml(decoder(t)).replace(/\n/g, '<br>');

  // Pièce jointe facultative de l'admin (image ou PDF hébergé sur Drive).
  // Seules les adresses Google Drive sont acceptées. Le lien Drive n'est
  // JAMAIS affiché au client : tout s'ouvre dans la visionneuse du site.
  // Image : aperçu direct, clic = plein écran avec zoom + / - et fermer.
  // PDF : carte, clic = lecture du PDF dans la visionneuse.
  function idDrive(url) {
    const m = String(url || '').match(/\/d\/([\w-]{10,})/) || String(url || '').match(/[?&]id=([\w-]{10,})/);
    return m ? m[1] : '';
  }

  function blocPieceJointe(pj) {
    if (!pj || !/^https:\/\/drive\.google\.com\//.test(String(pj.url || ''))) return '';
    const id = idDrive(pj.url);
    if (!id) return '';
    const nom = pj.nom || 'Pièce jointe';
    const estImage = /\.(jpe?g|png|webp)$/i.test(nom);
    const type = estImage ? 'image' : 'pdf';
    const actions = `
      <div class="suivi-pj-actions">
        <button type="button" class="suivi-pj-btn suivi-pj-agrandir" data-id="${_escapeHtml(id)}" data-nom="${_escapeHtml(nom)}" data-type="${type}"><span class="iconify" data-icon="${estImage ? 'tabler:zoom-in' : 'tabler:eye'}"></span> ${estImage ? 'Agrandir' : 'Lire le document'}</button>
        <button type="button" class="suivi-pj-btn suivi-pj-telecharger" data-id="${_escapeHtml(id)}"><span class="iconify" data-icon="tabler:download"></span> Télécharger</button>
      </div>`;

    if (estImage) {
      return `<div class="suivi-pj-bloc">
        <span class="suivi-lib"><span class="iconify" data-icon="tabler:paperclip"></span> Pièce jointe</span>
        <button type="button" class="suivi-pj-apercu suivi-pj-agrandir" data-id="${_escapeHtml(id)}" data-nom="${_escapeHtml(nom)}" data-type="image" aria-label="Agrandir l'image ${_escapeHtml(nom)}">
          <img src="https://drive.google.com/thumbnail?id=${_escapeHtml(id)}&amp;sz=w900" alt="${_escapeHtml(nom)}" loading="lazy" />
          <span class="suivi-pj-loupe"><span class="iconify" data-icon="tabler:zoom-in"></span></span>
        </button>
        <span class="suivi-pj-nom">${_escapeHtml(nom)}</span>
        ${actions}
      </div>`;
    }
    return `<div class="suivi-pj-bloc">
      <span class="suivi-lib"><span class="iconify" data-icon="tabler:paperclip"></span> Pièce jointe</span>
      <button type="button" class="suivi-pj suivi-pj-agrandir" data-id="${_escapeHtml(id)}" data-nom="${_escapeHtml(nom)}" data-type="pdf">
        <span class="iconify" data-icon="tabler:file-type-pdf"></span>
        <span><strong>${_escapeHtml(nom)}</strong><small>Document PDF — cliquez pour le lire</small></span>
        <span class="iconify" data-icon="tabler:eye"></span>
      </button>
      ${actions}
    </div>`;
  }

  /* ---------------- Visionneuse plein écran (zoom, déplacement) ---------------- */
  const ZOOM_MIN = 1, ZOOM_MAX = 5, ZOOM_PAS = 1.4;
  let vis = null;                 // éléments de la visionneuse, créés au premier usage
  let zoom = 1, dx = 0, dy = 0;   // échelle et déplacement courants
  let focusAvant = null;
  const pointeurs = new Map();    // doigts / souris posés (pincer pour zoomer)
  let pinceDepart = null, glisseDepart = null;

  function creerVisionneuse() {
    const el = document.createElement('div');
    el.className = 'visionneuse';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Pièce jointe agrandie');
    el.innerHTML = `
      <div class="visionneuse-barre">
        <span class="visionneuse-titre"></span>
        <div class="visionneuse-outils">
          <button type="button" data-a="moins" aria-label="Diminuer le zoom" title="Diminuer (-)"><span class="iconify" data-icon="tabler:minus"></span></button>
          <span class="visionneuse-taux" aria-live="polite">100 %</span>
          <button type="button" data-a="plus" aria-label="Augmenter le zoom" title="Agrandir (+)"><span class="iconify" data-icon="tabler:plus"></span></button>
          <button type="button" data-a="reset" aria-label="Taille d'origine" title="Taille d'origine (0)"><span class="iconify" data-icon="tabler:arrows-minimize"></span></button>
          <button type="button" data-a="telecharger" aria-label="Télécharger" title="Télécharger"><span class="iconify" data-icon="tabler:download"></span></button>
          <button type="button" data-a="fermer" class="visionneuse-fermer" aria-label="Fermer" title="Fermer (Échap)"><span class="iconify" data-icon="tabler:x"></span></button>
        </div>
      </div>
      <div class="visionneuse-scene">
        <span class="visionneuse-chargement"><span class="iconify" data-icon="tabler:loader-2"></span> Chargement de l'image...</span>
        <img class="visionneuse-img" alt="" draggable="false" />
        <iframe class="visionneuse-pdf" title="Document PDF" hidden></iframe>
        <p class="visionneuse-erreur" hidden>Le fichier ne peut pas s'afficher ici. Utilisez le bouton Télécharger, en haut à droite.</p>
      </div>
      <p class="visionneuse-aide">Molette, double-clic ou pincement pour zoomer — glissez pour déplacer l'image.</p>`;
    document.body.appendChild(el);
    vis = {
      racine: el, img: el.querySelector('.visionneuse-img'), scene: el.querySelector('.visionneuse-scene'),
      titre: el.querySelector('.visionneuse-titre'), taux: el.querySelector('.visionneuse-taux'),
      chargement: el.querySelector('.visionneuse-chargement'), erreurBloc: el.querySelector('.visionneuse-erreur'),
      pdf: el.querySelector('.visionneuse-pdf'), aide: el.querySelector('.visionneuse-aide'),
      telecharger: el.querySelector('[data-a="telecharger"]'), fermer: el.querySelector('[data-a="fermer"]')
    };

    el.querySelector('.visionneuse-outils').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'plus')   appliquerZoom(zoom * ZOOM_PAS);
      if (b.dataset.a === 'moins')  appliquerZoom(zoom / ZOOM_PAS);
      if (b.dataset.a === 'reset')  appliquerZoom(1);
      if (b.dataset.a === 'telecharger') telecharger(vis.idCourant);
      if (b.dataset.a === 'fermer') fermerVisionneuse();
    });
    // Clic sur le fond (hors image) = fermer, comme la galerie.
    vis.scene.addEventListener('click', e => { if (e.target === vis.scene && zoom === 1) fermerVisionneuse(); });
    vis.img.addEventListener('load', () => { vis.chargement.hidden = true; vis.img.hidden = false; });
    vis.img.addEventListener('error', () => { vis.chargement.hidden = true; vis.erreurBloc.hidden = false; });
    vis.img.addEventListener('dblclick', e => { appliquerZoom(zoom > 1 ? 1 : 2.5, e.clientX, e.clientY); });
    vis.scene.addEventListener('wheel', e => {
      e.preventDefault();
      appliquerZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    }, { passive: false });

    // Déplacement (1 pointeur) et pincement (2 pointeurs).
    vis.scene.addEventListener('pointerdown', e => {
      if (e.target !== vis.img) return;
      vis.scene.setPointerCapture(e.pointerId);
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size === 2) {
        const [p1, p2] = [...pointeurs.values()];
        pinceDepart = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom: zoom };
        glisseDepart = null;
      } else {
        glisseDepart = { x: e.clientX, y: e.clientY, dx: dx, dy: dy };
      }
    });
    vis.scene.addEventListener('pointermove', e => {
      if (!pointeurs.has(e.pointerId)) return;
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size === 2 && pinceDepart) {
        const [p1, p2] = [...pointeurs.values()];
        appliquerZoom(pinceDepart.zoom * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinceDepart.dist);
      } else if (glisseDepart && zoom > 1) {
        dx = glisseDepart.dx + (e.clientX - glisseDepart.x);
        dy = glisseDepart.dy + (e.clientY - glisseDepart.y);
        borner();
        rendre();
      }
    });
    const lever = e => {
      pointeurs.delete(e.pointerId);
      if (pointeurs.size < 2) pinceDepart = null;
      if (!pointeurs.size) glisseDepart = null;
    };
    vis.scene.addEventListener('pointerup', lever);
    vis.scene.addEventListener('pointercancel', lever);

    document.addEventListener('keydown', e => {
      if (!vis || vis.racine.hidden) return;
      if (e.key === 'Escape') fermerVisionneuse();
      if (vis.mode === 'pdf') return;   // le zoom d'un PDF est géré par le lecteur intégré
      if (e.key === '+' || e.key === '=') appliquerZoom(zoom * ZOOM_PAS);
      if (e.key === '-' || e.key === '_') appliquerZoom(zoom / ZOOM_PAS);
      if (e.key === '0') appliquerZoom(1);
      if (e.key === 'Tab') {        // le focus reste dans la visionneuse
        const f = [...vis.racine.querySelectorAll('button, a[href]')];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  // L'image ne peut pas sortir complètement de l'écran.
  function borner() {
    const r = vis.img.getBoundingClientRect();
    const largeur = r.width / zoom, hauteur = r.height / zoom;
    const maxX = Math.max(0, (largeur * zoom - largeur) / 2);
    const maxY = Math.max(0, (hauteur * zoom - hauteur) / 2);
    dx = Math.max(-maxX, Math.min(maxX, dx));
    dy = Math.max(-maxY, Math.min(maxY, dy));
  }

  function rendre() {
    vis.img.style.transform = `translate(${dx}px, ${dy}px) scale(${zoom})`;
    vis.img.classList.toggle('zoome', zoom > 1);
    vis.taux.textContent = Math.round(zoom * 100) + ' %';
    vis.racine.querySelector('[data-a="moins"]').disabled = zoom <= ZOOM_MIN;
    vis.racine.querySelector('[data-a="plus"]').disabled = zoom >= ZOOM_MAX;
  }

  // Zoom centré sur le point visé (curseur) quand il est fourni.
  function appliquerZoom(nouveau, cx, cy) {
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nouveau));
    if (cx !== undefined) {
      const r = vis.scene.getBoundingClientRect();
      const ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
      dx = ox - (ox - dx) * (z / zoom);
      dy = oy - (oy - dy) * (z / zoom);
    }
    zoom = z;
    if (zoom === 1) { dx = 0; dy = 0; }
    borner();
    rendre();
  }

  // Téléchargement : lien créé à la volée et jamais affiché. Drive répond
  // par un fichier à enregistrer : la page du site reste ouverte.
  function telecharger(id) {
    if (!/^[\w-]{10,}$/.test(String(id || ''))) return;
    const a = document.createElement('a');
    a.href = 'https://drive.google.com/uc?export=download&id=' + id;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function ouvrirVisionneuse(id, nom, type) {
    if (!vis) creerVisionneuse();
    if (!/^[\w-]{10,}$/.test(String(id || ''))) return;
    focusAvant = document.activeElement;
    zoom = 1; dx = 0; dy = 0;
    vis.idCourant = id;
    vis.mode = type === 'pdf' ? 'pdf' : 'image';
    vis.racine.classList.toggle('mode-pdf', vis.mode === 'pdf');
    vis.titre.textContent = nom;
    vis.img.alt = nom;
    vis.erreurBloc.hidden = true;
    vis.img.hidden = true;
    vis.pdf.hidden = true;
    if (vis.mode === 'pdf') {
      // Lecteur PDF intégré de Drive, affiché DANS la page du site.
      vis.chargement.hidden = true;
      vis.pdf.src = 'https://drive.google.com/file/d/' + id + '/preview';
      vis.pdf.hidden = false;
      vis.aide.textContent = 'Faites défiler pour lire le document.';
    } else {
      vis.chargement.hidden = false;
      vis.img.src = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w2400';
      vis.aide.textContent = 'Boutons + et -, molette, double-clic ou pincement pour zoomer — glissez pour déplacer l\'image.';
    }
    rendre();
    vis.racine.hidden = false;
    document.body.style.overflow = 'hidden';
    vis.fermer.focus();
  }

  function fermerVisionneuse() {
    vis.racine.hidden = true;
    vis.img.removeAttribute('src');
    vis.pdf.removeAttribute('src');
    document.body.style.overflow = '';
    if (focusAvant && focusAvant.focus) focusAvant.focus();
  }

  zone.addEventListener('click', e => {
    const b = e.target.closest('.suivi-pj-agrandir');
    if (b) return ouvrirVisionneuse(b.dataset.id, b.dataset.nom, b.dataset.type);
    const t = e.target.closest('.suivi-pj-telecharger');
    if (t) telecharger(t.dataset.id);
  });

  function erreur(msg) {
    fb.className = 'form-feedback error-msg';
    fb.textContent = msg;
    fb.style.display = 'block';
  }

  form.addEventListener('input', e => { e.target.classList && e.target.classList.remove('error'); fb.style.display = 'none'; });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    fb.style.display = 'none';
    zone.hidden = true;
    const id  = document.getElementById('suivi-id').value.trim().toUpperCase();
    const tel = document.getElementById('suivi-tel').value.trim();
    if (!/^RNS-[A-Z0-9-]{4,}$/.test(id)) { document.getElementById('suivi-id').classList.add('error'); return erreur('Le numéro de demande commence par RNS- (exemple : RNS-261014-AB12).'); }
    if (!/^(\+229|229|0)?[0-9]{8,15}$/.test(tel.replace(/\s/g, ''))) { document.getElementById('suivi-tel').classList.add('error'); return erreur('Indiquez le téléphone donné dans votre demande.'); }

    const btn = document.getElementById('suiviBtn');
    const libelle = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="iconify" data-icon="tabler:loader-2" style="animation:spin 1s linear infinite;"></span> Recherche...';
    try {
      const resp = await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'renseignement_suivre', id, telephone: tel })
      });
      const r = await resp.json();
      if (r.status !== 'success') return erreur(r.message || 'Demande introuvable.');
      const d = r.demande;
      zone.innerHTML = `
        <div class="suivi-bloc">
          <span class="suivi-lib">Votre demande ${_escapeHtml(d.id)}${d.date ? ' du ' + _escapeHtml(String(d.date).split(' ')[0]) : ''}</span>
          ${d.formations ? `<p class="suivi-formations">Formation(s) : ${_escapeHtml(d.formations)}</p>` : ''}
          <p>${d.question ? texteHtml(d.question) : '<em>Demande de rappel, sans question écrite.</em>'}</p>
        </div>
        ${d.reponse ? `
        <div class="suivi-bloc suivi-reponse">
          <span class="suivi-lib"><span class="iconify" data-icon="tabler:message-check"></span> Réponse du centre${d.dateReponse ? ' — ' + _escapeHtml(d.dateReponse) : ''}</span>
          <p>${texteHtml(d.reponse)}</p>
          ${blocPieceJointe(d.pieceJointe)}
        </div>` : `
        <div class="suivi-bloc suivi-attente">
          <span class="suivi-lib"><span class="iconify" data-icon="tabler:clock"></span> Réponse en préparation</span>
          <p>Bonjour ${_escapeHtml(decoder(d.prenom))}, votre demande est bien enregistrée. Nous vous répondons sous 24 h ; revenez sur cette page ou attendez notre appel.</p>
        </div>`}`;
      zone.hidden = false;
    } catch (err) {
      erreur('Erreur de connexion. Réessayez dans un instant.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = libelle;
    }
  });
})();

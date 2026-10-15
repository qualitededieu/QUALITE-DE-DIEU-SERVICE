/* ==================================================================
   js/galerie.js — page /galerie
   Carrousel (12 premières photos), filtres par catégorie, mosaïque et
   visionneuse plein écran. Photos publiées depuis l'admin
   (GAS/galerie.gs, action galerie_lister). Dépend de js/site.js
   (GAS_WEBAPP_URL, _escapeHtml).
================================================================== */
(function () {
  const el = id => document.getElementById(id);
  if (!el('galerieStage')) return;

  const CARROUSEL_MAX = 12;
  const DELAI_DIAPO_MS = 6000;
  const mouvementReduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let photos = [];          // toutes les photos visibles, dans l'ordre défini par l'admin
  let diapos = [];          // sous-ensemble du carrousel
  let indexDiapo = 0;
  let minuteur = null;
  let enPause = mouvementReduit;
  let filtre = 'Toutes';
  let listeVisionneuse = [];
  let indexVisionneuse = 0;

  /* ------------------------------ Chargement ------------------------------ */
  async function lister() {
    const resp = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'galerie_lister' })
    });
    const r = await resp.json();
    if (r.status !== 'success') throw new Error(r.message || 'Erreur');
    return r;
  }

  // Le serveur GAS peut mettre quelques secondes à se réveiller : une reprise.
  async function listerAvecReprise() {
    try { return await lister(); }
    catch (e) {
      await new Promise(ok => setTimeout(ok, 2500));
      return lister();
    }
  }

  // N'accepte que des images servies par Google Drive (aucune URL arbitraire).
  function urlSure(u) {
    return /^https:\/\/(drive\.google\.com|lh[0-9]\.googleusercontent\.com)\//.test(String(u || ''));
  }

  async function init() {
    try {
      const r = await listerAvecReprise();
      photos = (r.photos || []).filter(p => urlSure(p.url));
    } catch (e) {
      // Jamais de message de panne pour le visiteur : on affiche l'état "bientôt".
      console.warn('[galerie] chargement impossible :', e.message);
      photos = [];
    }
    el('galerieChargement').hidden = true;
    el('galerieChargement').style.display = 'none';
    if (!photos.length) { el('galerieVide').hidden = false; return; }
    el('galerieStage').hidden = false;
    construireCarrousel();
    construireFiltres();
    construireMosaique();
    brancherVisionneuse();
  }

  /* ------------------------------ Carrousel ------------------------------ */
  function construireCarrousel() {
    diapos = photos.slice(0, CARROUSEL_MAX);
    const piste = el('carrouselPiste');
    piste.innerHTML = diapos.map((p, i) => `
      <figure class="diapo${i === 0 ? ' active' : ''}" aria-hidden="${i === 0 ? 'false' : 'true'}">
        <img ${i < 2 ? `src="${_escapeHtml(p.url)}"` : `data-src="${_escapeHtml(p.url)}"`} alt="${_escapeHtml(p.legende || p.categorie)}" ${i === 0 ? '' : 'loading="lazy"'} />
      </figure>`).join('');
    el('carrouselPoints').innerHTML = diapos.length > 1 ? diapos.map((p, i) =>
      `<button type="button" class="point${i === 0 ? ' actif' : ''}" aria-label="Photo ${i + 1}" data-i="${i}"></button>`).join('') : '';

    const carrousel = el('carrousel');
    carrousel.classList.toggle('unique', diapos.length < 2);
    el('carrouselPrec').addEventListener('click', () => { allerA(indexDiapo - 1); relancer(); });
    el('carrouselSuiv').addEventListener('click', () => { allerA(indexDiapo + 1); relancer(); });
    el('carrouselPoints').addEventListener('click', e => {
      const b = e.target.closest('.point');
      if (b) { allerA(Number(b.dataset.i)); relancer(); }
    });
    el('carrouselPause').addEventListener('click', () => { enPause = !enPause; majBoutonPause(); relancer(); });
    piste.addEventListener('click', () => ouvrirVisionneuse(diapos, indexDiapo));
    carrousel.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); allerA(indexDiapo - 1); relancer(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); allerA(indexDiapo + 1); relancer(); }
      if (e.key === 'Enter')      { e.preventDefault(); ouvrirVisionneuse(diapos, indexDiapo); }
    });
    // Survol souris : pause temporaire (le bouton pause reste prioritaire).
    carrousel.addEventListener('mouseenter', arreter);
    carrousel.addEventListener('mouseleave', relancer);
    brancherBalayage(carrousel, sens => { allerA(indexDiapo + sens); relancer(); });
    document.addEventListener('visibilitychange', () => (document.hidden ? arreter() : relancer()));

    majBoutonPause();
    afficherLegende();
    relancer();
  }

  function allerA(i) {
    if (diapos.length < 2) return;
    indexDiapo = (i + diapos.length) % diapos.length;
    const figures = el('carrouselPiste').querySelectorAll('.diapo');
    figures.forEach((f, k) => {
      const actif = k === indexDiapo;
      f.classList.toggle('active', actif);
      f.setAttribute('aria-hidden', actif ? 'false' : 'true');
    });
    // Chargement progressif : photo affichée + la suivante.
    [indexDiapo, (indexDiapo + 1) % diapos.length].forEach(k => {
      const img = figures[k].querySelector('img');
      if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
    });
    el('carrouselPoints').querySelectorAll('.point').forEach((p, k) => p.classList.toggle('actif', k === indexDiapo));
    afficherLegende();
  }

  function afficherLegende() {
    const p = diapos[indexDiapo];
    el('carrouselLegende').innerHTML = `
      <span class="carrousel-cat">${_escapeHtml(p.categorie)}</span>
      ${p.legende ? `<strong>${_escapeHtml(p.legende)}</strong>` : ''}
      <span class="carrousel-compteur">${indexDiapo + 1} / ${diapos.length}</span>`;
  }

  function arreter() { clearInterval(minuteur); minuteur = null; }
  function relancer() {
    arreter();
    if (!enPause && diapos.length > 1 && !document.hidden) {
      minuteur = setInterval(() => allerA(indexDiapo + 1), DELAI_DIAPO_MS);
    }
  }
  function majBoutonPause() {
    const b = el('carrouselPause');
    b.innerHTML = `<span class="iconify" data-icon="${enPause ? 'tabler:player-play' : 'tabler:player-pause'}"></span>`;
    b.setAttribute('aria-label', enPause ? 'Reprendre le défilement' : 'Mettre en pause le défilement');
  }

  // Balayage tactile horizontal (mobile).
  function brancherBalayage(zone, rappel) {
    let x0 = null, y0 = null;
    zone.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    zone.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) rappel(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* --------------------------- Filtres et mosaïque --------------------------- */
  function categoriesPresentes() {
    const vues = [];
    photos.forEach(p => { if (vues.indexOf(p.categorie) === -1) vues.push(p.categorie); });
    return vues;
  }

  function construireFiltres() {
    const cats = categoriesPresentes();
    const zone = el('galerieFiltres');
    if (cats.length < 2) { zone.innerHTML = ''; return; }
    zone.innerHTML = ['Toutes'].concat(cats).map(c => {
      const n = c === 'Toutes' ? photos.length : photos.filter(p => p.categorie === c).length;
      return `<button type="button" role="tab" class="galerie-filtre${c === filtre ? ' actif' : ''}" aria-selected="${c === filtre}" data-c="${_escapeHtml(c)}">${_escapeHtml(c)} <span>${n}</span></button>`;
    }).join('');
    zone.addEventListener('click', e => {
      const b = e.target.closest('.galerie-filtre');
      if (!b) return;
      filtre = b.dataset.c;
      zone.querySelectorAll('.galerie-filtre').forEach(x => {
        const actif = x === b;
        x.classList.toggle('actif', actif);
        x.setAttribute('aria-selected', String(actif));
      });
      construireMosaique();
    });
  }

  function photosFiltrees() {
    return filtre === 'Toutes' ? photos : photos.filter(p => p.categorie === filtre);
  }

  function construireMosaique() {
    const liste = photosFiltrees();
    const zone = el('galerieMosaique');
    zone.innerHTML = liste.map((p, i) => `
      <button type="button" class="mosaique-item" data-i="${i}" aria-label="Agrandir : ${_escapeHtml(p.legende || p.categorie)}">
        <img src="${_escapeHtml(urlSure(p.miniature) ? p.miniature : p.url)}" alt="${_escapeHtml(p.legende || p.categorie)}" loading="lazy" />
        <span class="mosaique-voile"><span class="iconify" data-icon="tabler:zoom-in"></span>${_escapeHtml(p.legende || p.categorie)}</span>
      </button>`).join('');
    zone.onclick = e => {
      const b = e.target.closest('.mosaique-item');
      if (b) ouvrirVisionneuse(liste, Number(b.dataset.i));
    };
  }

  /* ------------------------------ Visionneuse ------------------------------ */
  let dernierFocus = null;

  function ouvrirVisionneuse(liste, i) {
    listeVisionneuse = liste;
    dernierFocus = document.activeElement;
    arreter();
    afficherVisionneuse(i);
    el('lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
    el('lightboxFermer').focus();
  }

  function afficherVisionneuse(i) {
    const n = listeVisionneuse.length;
    indexVisionneuse = (i + n) % n;
    const p = listeVisionneuse[indexVisionneuse];
    el('lightboxImage').src = p.url;
    el('lightboxImage').alt = p.legende || p.categorie;
    el('lightboxLegende').innerHTML = `${p.legende ? `<strong>${_escapeHtml(p.legende)}</strong>` : ''}
      <span>${_escapeHtml(p.categorie)} — ${indexVisionneuse + 1} / ${n}</span>`;
    // style.display (et non hidden) : .lightbox-nav impose display:flex.
    el('lightboxPrec').style.display = el('lightboxSuiv').style.display = n < 2 ? 'none' : '';
  }

  function fermerVisionneuse() {
    el('lightbox').hidden = true;
    el('lightboxImage').src = '';
    document.body.style.overflow = '';
    if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
    relancer();
  }

  function brancherVisionneuse() {
    const lb = el('lightbox');
    el('lightboxFermer').addEventListener('click', fermerVisionneuse);
    el('lightboxPrec').addEventListener('click', () => afficherVisionneuse(indexVisionneuse - 1));
    el('lightboxSuiv').addEventListener('click', () => afficherVisionneuse(indexVisionneuse + 1));
    lb.addEventListener('click', e => { if (e.target === lb) fermerVisionneuse(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape')     fermerVisionneuse();
      if (e.key === 'ArrowLeft')  afficherVisionneuse(indexVisionneuse - 1);
      if (e.key === 'ArrowRight') afficherVisionneuse(indexVisionneuse + 1);
    });
    brancherBalayage(lb, sens => afficherVisionneuse(indexVisionneuse + sens));
  }

  init();
})();

/* ==================================================================
   js/photo-identite.js — Prise de photo d'identité (espace apprenant)
   Inspiré des guichets d'identité : consignes, caméra frontale avec cadre
   ovale, capture, contrôles de qualité, recadrage au format 3,5 x 4,5 cm,
   « Reprendre » à volonté, import d'un fichier en secours.
   La photo n'est PAS appliquée ici : elle part en validation à
   l'administration (GAS photos.gs : photo_demande_envoyer).
   Aucune bibliothèque externe (poids minimal, fonctionne en 3G).
================================================================== */
(function () {
  'use strict';

  const SORTIE_L = 700, SORTIE_H = 900;          // 35 x 45 mm, 20 px/mm
  const RATIO = SORTIE_L / SORTIE_H;
  const ICONE = n => `<span class="iconify" data-icon="tabler:${n}"></span>`;

  let stylesPoses = false;
  function styles() {
    if (stylesPoses) return;
    stylesPoses = true;
    const s = document.createElement('style');
    s.textContent = `
.pi-fond{position:fixed;inset:0;z-index:2000;background:rgba(4,20,17,.78);display:flex;align-items:center;justify-content:center;padding:12px}
.pi-carte{background:#FFF;color:#1F2937;border-radius:18px;width:100%;max-width:480px;max-height:96vh;overflow:auto;font-family:inherit}
.pi-tete{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #EEF0F2}
.pi-tete h3{font-size:16px;margin:0}
.pi-fermer{border:none;background:#F3F4F6;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
.pi-corps{padding:16px}
.pi-consignes{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:8px}
.pi-consignes li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.4}
.pi-consignes .iconify{font-size:20px;color:#0D7A8A;flex-shrink:0}
.pi-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border-radius:12px;padding:13px 16px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;border:1.5px solid #0D7A8A}
.pi-btn:disabled{opacity:.55;cursor:wait}
.pi-plein{background:#0D7A8A;color:#FFF}
.pi-contour{background:#FFF;color:#0D7A8A;margin-top:8px}
.pi-lien{background:none;border:none;color:#0D7A8A;font:inherit;font-weight:700;cursor:pointer;margin-top:12px;width:100%;padding:8px}
.pi-video{position:relative;width:100%;aspect-ratio:3/4;background:#111;border-radius:14px;overflow:hidden}
.pi-video video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
.pi-video svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.pi-consigne-live{position:absolute;left:0;right:0;bottom:12px;text-align:center;color:#FFF;font-size:13.5px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.7);padding:0 12px}
.pi-commandes{display:flex;align-items:center;justify-content:center;gap:22px;margin-top:14px}
.pi-declencheur{width:68px;height:68px;border-radius:50%;border:5px solid #0D7A8A;background:#FFF;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.pi-declencheur:active{transform:scale(.94)}
.pi-rond{width:46px;height:46px;border-radius:50%;border:1px solid #D1D5DB;background:#FFF;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;color:#374151}
.pi-apercu{display:block;width:62%;max-width:260px;margin:0 auto 12px;aspect-ratio:35/45;object-fit:cover;border-radius:10px;border:1px solid #E5E7EB}
.pi-controles{list-style:none;padding:0;margin:0 0 14px;display:grid;gap:6px}
.pi-controles li{display:flex;gap:8px;align-items:center;font-size:13.5px;padding:8px 10px;border-radius:10px}
.pi-controles li.ok{background:#E6F6EF;color:#0F6E56}
.pi-controles li.alerte{background:#FEF6E7;color:#8A5A12}
.pi-msg{font-size:13.5px;padding:10px 12px;border-radius:10px;margin-bottom:12px}
.pi-msg.erreur{background:#FDEDEC;color:#C0392B}
.pi-msg.ok{background:#E6F6EF;color:#0F6E56}
.pi-discret{font-size:12.5px;color:#6B7280;margin:10px 0 0;text-align:center}`;
    document.head.appendChild(s);
  }

  /* ------------------------ Mesures de qualité ------------------------ */
  // Calculées sur une petite copie en niveaux de gris : rapides même sur
  // un téléphone d'entrée de gamme. Indicatives : l'admin tranche.
  function mesurer(canvas) {
    const w = 140, h = 180;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(canvas, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const gris = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) gris[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    // Luminosité mesurée sur la zone du VISAGE (centre) : un fond blanc,
    // conseillé, ne doit pas faire croire à une photo surexposée.
    let somme = 0, nb = 0;
    for (let y = Math.round(h * 0.2); y < h * 0.7; y++) for (let x = Math.round(w * 0.28); x < w * 0.72; x++) { somme += gris[y * w + x]; nb++; }
    const luminosite = somme / nb;
    // Netteté : variance du laplacien (plus c'est élevé, plus c'est net).
    // Mesurée sur le visage seulement : un fond très détaillé masquerait le flou.
    let s1 = 0, s2 = 0, n = 0;
    for (let y = Math.round(h * 0.2); y < h * 0.75; y++) for (let x = Math.round(w * 0.25); x < w * 0.75; x++) {
      const i = y * w + x;
      const l = 4 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - w] - gris[i + w];
      s1 += l; s2 += l * l; n++;
    }
    const nettete = s2 / n - (s1 / n) * (s1 / n);
    // Fond : bandes du haut et des côtés (hors visage), moyenne et régularité.
    const fondPx = [];
    for (let y = 0; y < h * 0.45; y++) for (let x = 0; x < w; x++) {
      if (y > h * 0.12 && x > w * 0.18 && x < w * 0.82) continue;
      fondPx.push(gris[y * w + x]);
    }
    const fm = fondPx.reduce((a, b) => a + b, 0) / fondPx.length;
    const fe = Math.sqrt(fondPx.reduce((a, b) => a + (b - fm) * (b - fm), 0) / fondPx.length);
    const avertissements = [];
    if (luminosite < 70) avertissements.push('Photo trop sombre');
    if (luminosite > 215) avertissements.push('Photo trop claire (surexposée)');
    if (nettete < 60) avertissements.push('Photo floue');
    if (fm < 115) avertissements.push('Fond trop sombre');
    else if (fe > 32) avertissements.push('Fond chargé ou non uni');
    return { luminosite: Math.round(luminosite), nettete: Math.round(nettete), fond: Math.round(fm), fondEcart: Math.round(fe), avertissements: avertissements };
  }

  // Recadrage centré au format 35 x 45 (photo d'identité), fond blanc.
  function recadrer(source, sw, sh) {
    let cw = sw, ch = sw / RATIO;
    if (ch > sh) { ch = sh; cw = sh * RATIO; }
    const c = document.createElement('canvas'); c.width = SORTIE_L; c.height = SORTIE_H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, SORTIE_L, SORTIE_H);
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, SORTIE_L, SORTIE_H);
    return c;
  }

  /* ------------------------------ Fenêtre ------------------------------ */
  // opts.envoyer({ base64, mime, source, controles }) -> Promise<{status, message}>
  function ouvrir(opts) {
    styles();
    const fond = document.createElement('div');
    fond.className = 'pi-fond';
    fond.setAttribute('role', 'dialog');
    fond.setAttribute('aria-modal', 'true');
    fond.innerHTML = `<div class="pi-carte"><div class="pi-tete"><h3>Mettre à jour ma photo</h3>
      <button type="button" class="pi-fermer" aria-label="Fermer">${ICONE('x')}</button></div><div class="pi-corps"></div></div>`;
    document.body.appendChild(fond);
    const corps = fond.querySelector('.pi-corps');
    let flux = null, minuteur = null, cameras = [], indexCamera = 0, capture = null;

    function arreterCamera() {
      clearInterval(minuteur); minuteur = null;
      if (flux) { flux.getTracks().forEach(t => t.stop()); flux = null; }
    }
    function fermer() { arreterCamera(); fond.remove(); document.removeEventListener('keydown', echap); }
    function echap(e) { if (e.key === 'Escape') fermer(); }
    document.addEventListener('keydown', echap);
    fond.querySelector('.pi-fermer').addEventListener('click', fermer);

    const cameraPossible = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;

    function ecranConsignes(message) {
      arreterCamera();
      corps.innerHTML = `${message ? `<div class="pi-msg erreur">${message}</div>` : ''}
        <p style="margin:0 0 12px;font-size:14px;">Comme pour une pièce d'identité, votre photo doit respecter ces règles :</p>
        <ul class="pi-consignes">
          <li>${ICONE('user-circle')}<span>Visage <strong>de face</strong>, regard vers l'objectif, expression neutre.</span></li>
          <li>${ICONE('bulb')}<span>Visage <strong>bien éclairé</strong>, sans ombre ni contre-jour.</span></li>
          <li>${ICONE('square')}<span>Fond <strong>clair et uni</strong> (mur blanc ou gris clair).</span></li>
          <li>${ICONE('eyeglass-off')}<span>Sans lunettes de soleil, casquette ni masque. Le voile religieux est accepté si le visage est entièrement visible.</span></li>
          <li>${ICONE('focus-2')}<span>Tête et haut des épaules dans le cadre.</span></li>
        </ul>
        ${cameraPossible ? `<button type="button" class="pi-btn pi-plein" data-pi="camera">${ICONE('camera')} Ouvrir la caméra</button>` : '<div class="pi-msg erreur">Caméra indisponible sur cet appareil ou ce navigateur : importez une photo.</div>'}
        <button type="button" class="${cameraPossible ? 'pi-lien' : 'pi-btn pi-plein'}" data-pi="importer">${ICONE('photo-up')} Importer une photo depuis l'appareil</button>
        <input type="file" accept="image/jpeg,image/png" hidden data-pi="fichier">
        <p class="pi-discret">Votre photo sera vérifiée par l'administration avant de remplacer l'actuelle sur votre carte et votre attestation.</p>`;
      const btn = corps.querySelector('[data-pi="camera"]');
      if (btn) btn.addEventListener('click', ouvrirCamera);
      corps.querySelector('[data-pi="importer"]').addEventListener('click', () => corps.querySelector('[data-pi="fichier"]').click());
      corps.querySelector('[data-pi="fichier"]').addEventListener('change', e => importer(e.target.files && e.target.files[0]));
    }

    async function ouvrirCamera() {
      corps.innerHTML = '<p style="text-align:center;padding:30px 0;color:#6B7280;">Ouverture de la caméra…</p>';
      try {
        const contrainte = cameras.length && cameras[indexCamera]
          ? { deviceId: { exact: cameras[indexCamera].deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } };
        flux = await navigator.mediaDevices.getUserMedia({ video: contrainte, audio: false });
        if (!cameras.length) {
          try { cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) { cameras = []; }
        }
      } catch (e) {
        const msg = e && e.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorisez la caméra dans votre navigateur, ou importez une photo.'
          : (e && e.name === 'NotFoundError' ? 'Aucune caméra détectée sur cet appareil : importez une photo.'
          : 'Impossible d\'ouvrir la caméra (' + (e && e.name || 'erreur') + ') : importez une photo.');
        return ecranConsignes(msg);
      }
      corps.innerHTML = `<div class="pi-video">
          <video playsinline autoplay muted></video>
          <svg viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">
            <defs><mask id="pi-masque"><rect width="300" height="400" fill="#fff"/><ellipse cx="150" cy="178" rx="92" ry="122" fill="#000"/></mask></defs>
            <rect width="300" height="400" fill="rgba(0,0,0,.45)" mask="url(#pi-masque)"/>
            <ellipse cx="150" cy="178" rx="92" ry="122" fill="none" stroke="#FFF" stroke-width="2.5" stroke-dasharray="7 6"/>
          </svg>
          <div class="pi-consigne-live" data-pi="live">Placez votre visage dans l'ovale</div>
        </div>
        <div class="pi-commandes">
          <button type="button" class="pi-rond" data-pi="retour" title="Retour aux consignes">${ICONE('arrow-left')}</button>
          <button type="button" class="pi-declencheur" data-pi="declencher" aria-label="Prendre la photo"></button>
          <button type="button" class="pi-rond" data-pi="basculer" title="Changer de caméra"${cameras.length > 1 ? '' : ' style="visibility:hidden"'}>${ICONE('camera-rotate')}</button>
        </div>
        <p class="pi-discret">Tenez l'appareil à hauteur des yeux, à environ 50 cm.</p>`;
      const video = corps.querySelector('video');
      video.srcObject = flux;
      try { await video.play(); } catch (e) { /* lecture automatique bloquée : le flux s'affichera au premier geste */ }
      // Conseil en direct sur la lumière (sans bloquer la capture).
      const petit = document.createElement('canvas'); petit.width = 40; petit.height = 53;
      minuteur = setInterval(() => {
        if (!video.videoWidth) return;
        const c = petit.getContext('2d'); c.drawImage(video, 0, 0, 40, 53);
        const d = c.getImageData(0, 0, 40, 53).data; let s = 0;
        for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const l = s / (d.length / 4);
        const live = corps.querySelector('[data-pi="live"]');
        if (live) live.textContent = l < 60 ? 'Trop sombre : placez-vous face à une source de lumière' : (l > 220 ? 'Trop de lumière : évitez le contre-jour' : 'Placez votre visage dans l\'ovale');
      }, 700);
      corps.querySelector('[data-pi="retour"]').addEventListener('click', () => ecranConsignes());
      corps.querySelector('[data-pi="basculer"]').addEventListener('click', () => { arreterCamera(); indexCamera = (indexCamera + 1) % cameras.length; ouvrirCamera(); });
      corps.querySelector('[data-pi="declencher"]').addEventListener('click', () => {
        if (!video.videoWidth) return;
        // Image enregistrée NON inversée (comme une vraie photo d'identité),
        // même si l'aperçu vidéo est en miroir pour être naturel.
        capture = { canvas: recadrer(video, video.videoWidth, video.videoHeight), source: 'Caméra' };
        arreterCamera();
        ecranApercu();
      });
    }

    function importer(fichier) {
      if (!fichier) return;
      if (['image/jpeg', 'image/png'].indexOf(fichier.type) === -1) return ecranConsignes('Format refusé : choisissez une photo JPEG ou PNG.');
      if (fichier.size > 15 * 1024 * 1024) return ecranConsignes('Photo trop lourde (15 Mo maximum).');
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (Math.min(img.naturalWidth, img.naturalHeight) < 300) return ecranConsignes('Photo trop petite (300 px minimum) : elle serait floue sur la carte.');
        capture = { canvas: recadrer(img, img.naturalWidth, img.naturalHeight), source: 'Import' };
        ecranApercu();
      };
      img.onerror = () => { URL.revokeObjectURL(url); ecranConsignes('Image illisible.'); };
      img.src = url;
    }

    function ecranApercu() {
      const m = mesurer(capture.canvas);
      capture.controles = m;
      const lignes = [
        ['Luminosité', m.avertissements.some(a => /sombre|claire/.test(a) && !/Fond/.test(a)) ? m.avertissements.filter(a => /Photo trop/.test(a))[0] : 'Correcte'],
        ['Netteté', m.avertissements.indexOf('Photo floue') !== -1 ? 'Photo floue' : 'Correcte'],
        ['Fond', m.avertissements.filter(a => /Fond/.test(a))[0] || 'Clair et uni']
      ];
      corps.innerHTML = `<img class="pi-apercu" alt="Aperçu de la photo" src="${capture.canvas.toDataURL('image/jpeg', 0.9)}">
        <ul class="pi-controles">${lignes.map(l => {
          const ok = /Correcte|Clair et uni/.test(l[1]);
          return `<li class="${ok ? 'ok' : 'alerte'}">${ICONE(ok ? 'circle-check' : 'alert-triangle')} <strong>${l[0]} :</strong>&nbsp;${l[1]}</li>`;
        }).join('')}</ul>
        ${m.avertissements.length ? '<p style="font-size:13px;margin:0 0 12px;color:#8A5A12;">Nous vous conseillons de reprendre la photo : une photo de mauvaise qualité risque d\'être refusée.</p>' : ''}
        <div data-pi="msg"></div>
        <button type="button" class="pi-btn pi-plein" data-pi="envoyer">${ICONE('send')} Envoyer pour validation</button>
        <button type="button" class="pi-btn pi-contour" data-pi="reprendre">${ICONE('refresh')} Reprendre la photo</button>`;
      corps.querySelector('[data-pi="reprendre"]').addEventListener('click', () => (capture.source === 'Caméra' ? ouvrirCamera() : ecranConsignes()));
      corps.querySelector('[data-pi="envoyer"]').addEventListener('click', async e => {
        const b = e.currentTarget; b.disabled = true;
        const zone = corps.querySelector('[data-pi="msg"]');
        try {
          const r = await opts.envoyer({ base64: capture.canvas.toDataURL('image/jpeg', 0.88).split(',')[1], mime: 'image/jpeg', source: capture.source, controles: capture.controles });
          if (!r) { fermer(); return; }
          if (r.status !== 'success') { zone.innerHTML = `<div class="pi-msg erreur"></div>`; zone.firstChild.textContent = r.message || 'Envoi impossible.'; b.disabled = false; return; }
          corps.innerHTML = `<div class="pi-msg ok" style="text-align:center;padding:18px;">${ICONE('circle-check')} ${r.message}</div>
            <button type="button" class="pi-btn pi-plein" data-pi="fin">Fermer</button>`;
          corps.querySelector('[data-pi="fin"]').addEventListener('click', fermer);
          if (opts.apresEnvoi) opts.apresEnvoi();
        } catch (err) {
          zone.innerHTML = '<div class="pi-msg erreur">Connexion interrompue : la photo n\'a pas été envoyée. Réessayez.</div>';
          b.disabled = false;
        }
      });
    }

    ecranConsignes();
    return { fermer: fermer };
  }

  window.PhotoIdentite = { ouvrir: ouvrir, _mesurer: mesurer, _recadrer: recadrer };
})();

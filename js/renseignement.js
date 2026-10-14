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

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
      rensFeed.innerHTML    = `<strong>Demande n° ${result.id} reçue.</strong><br>Nous vous rappelons dans les 24 h au ${telephone}.`;
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

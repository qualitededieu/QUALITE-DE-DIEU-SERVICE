/* ==================================================================
   js/site.js — socle commun à TOUTES les pages publiques
   (nav, bandeau, toast, apparition au scroll, newsletter du footer).
   Chaque bloc vérifie que ses éléments existent avant de s'y brancher :
   une page qui n'a pas un élément donné ne doit jamais casser le reste.
================================================================== */
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwbEkz8PsyWMnOMkXbV1ZY5pBSHTO4l-cw5r5tE8kDw2tEsXAmdRotmjaWg9cT6Ousg/exec';

function formatFCFA(n) { return Number(n || 0).toLocaleString('fr-BJ') + ' F CFA'; }

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ================================================================
   TOAST
================================================================ */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icon  = type === 'success' ? 'tabler:circle-check' : 'tabler:alert-circle';
  const color = type === 'success' ? '#1D9E75' : '#E24B4A';
  toast.innerHTML = `<span class="iconify" data-icon="${icon}" style="font-size:20px;color:${color}"></span>${msg}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4500);
}

/* ================================================================
   BANDEAU D'INFORMATION — plusieurs messages possibles côté admin,
   affichés un par un en rotation (voir bandeauGetPublic dans
   GAS/annonces.gs). Masqué si l'admin ne l'a pas activé.
================================================================ */
async function chargerBandeau() {
  try {
    const resp = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'bandeau_get_public' })
    });
    const result = await resp.json();
    if (result.status === 'success' && result.actif && result.messages && result.messages.length > 0) {
      const el = document.getElementById('bandeau-texte');
      const messages = result.messages;
      const dureeMs  = (result.dureeRotationSec || 12) * 1000;
      let index = 0;

      el.textContent = messages[0];
      document.getElementById('bandeau-info').style.display = 'flex';
      document.body.classList.add('bandeau-visible');

      if (messages.length > 1) {
        setInterval(() => {
          el.classList.add('sortant');
          setTimeout(() => {
            index = (index + 1) % messages.length;
            el.textContent = messages[index];
            el.classList.remove('sortant');
            el.classList.add('entrant');
            setTimeout(() => el.classList.remove('entrant'), 350);
          }, 350);
        }, dureeMs);
      }
    }
  } catch (e) {
    // Silencieux : l'absence de bandeau n'est jamais bloquante pour le reste du site
    console.warn('[bandeau] chargement impossible :', e.message);
  }
}
if (document.getElementById('bandeau-info')) chargerBandeau();

/* ================================================================
   NAVBAR (la page active est marquée en dur dans le HTML via
   aria-current="page" — plus de "scroll spy" depuis le passage en
   multi-pages)
================================================================ */
const navbar = document.getElementById('navbar');
if (navbar) window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 40));

// Bouton retour en haut : visible seulement après un scroll significatif.
const btnRetourHaut = document.getElementById('btnRetourHaut');
if (btnRetourHaut) window.addEventListener('scroll', () => btnRetourHaut.classList.toggle('visible', window.scrollY > 480));

const navBurger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');
if (navBurger && navMobile) navBurger.addEventListener('click', () => navMobile.classList.toggle('open'));
function closeMobileNav() { if (navMobile) navMobile.classList.remove('open'); }

/* ================================================================
   ALLER À L'INSCRIPTION avec présélection de la formation
   - Sur la page Inscription : coche la case et recalcule les frais.
   - Ailleurs (page Formations...) : ouvre /inscription?formation=...
     et js/inscription.js fait la présélection à l'arrivée.
================================================================ */
function scrollToInscription(formation) {
  if (document.getElementById('inscriptionForm') && typeof preselectionnerFormation === 'function') {
    preselectionnerFormation(formation);
    return;
  }
  window.location.href = '/inscription?formation=' + encodeURIComponent(formation);
}

/* ================================================================
   SCROLL REVEAL
================================================================ */
const revealItems = document.querySelectorAll('.reveal');
const revObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = Array.from(revealItems).indexOf(entry.target) % 4 * 100;
      setTimeout(() => entry.target.classList.add('visible'), delay);
      revObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
revealItems.forEach(el => revObserver.observe(el));

/* =====================================================================
   NEWSLETTER — Inscription depuis le pied de page
===================================================================== */
async function inscrireNewsletter(evt) {
  evt.preventDefault();

  const emailInput = document.getElementById('newsletter-email');
  const consentInput = document.getElementById('newsletter-consentement');
  const btn = document.getElementById('btn-newsletter');
  const msg = document.getElementById('newsletter-msg');

  const email = emailInput.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.textContent = 'Adresse email invalide.';
    msg.className = 'footer-newsletter-msg show err';
    return false;
  }
  if (!consentInput.checked) {
    msg.textContent = 'Veuillez accepter de recevoir la newsletter.';
    msg.className = 'footer-newsletter-msg show err';
    return false;
  }

  btn.disabled = true;
  btn.textContent = 'Envoi…';
  msg.className = 'footer-newsletter-msg';

  try {
    const resp = await fetch(GAS_WEBAPP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify({ action: 'newsletter_inscrire', email, consentement: true, source: 'site' })
    });
    const result = await resp.json();

    msg.textContent = result.message || (result.status === 'success' ? 'Inscription confirmée.' : 'Une erreur est survenue.');
    // "Déjà abonné" n'est pas une erreur technique, mais ce n'est pas non
    // plus une nouvelle inscription réussie — affiché en rouge pour bien
    // distinguer visuellement les deux cas, comme demandé.
    const estErreurOuDejaAbonne = result.status !== 'success' || result.dejaAbonne === true;
    msg.className = 'footer-newsletter-msg show ' + (estErreurOuDejaAbonne ? 'err' : 'ok');
    if (result.status === 'success' && !result.dejaAbonne) {
      emailInput.value = '';
      consentInput.checked = false;
    }
  } catch (err) {
    console.error('[inscrireNewsletter]', err);
    msg.textContent = 'Erreur de connexion. Réessayez.';
    msg.className = 'footer-newsletter-msg show err';
  }

  btn.disabled = false;
  btn.textContent = "S'abonner";
  return false;
}

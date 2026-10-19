/* ==================================================================
   js/espace-formateur.js — Espace formateur (GAS/formateurs.gs)
   Connexion email + mot de passe + code, puis : accueil, apprenants,
   présences, notes, cours, questions. Toutes les données passent par
   le serveur qui vérifie la session et les filières à chaque appel.
================================================================== */
(function () {
  'use strict';

  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwbEkz8PsyWMnOMkXbV1ZY5pBSHTO4l-cw5r5tE8kDw2tEsXAmdRotmjaWg9cT6Ousg/exec';
  const CLE_SESSION = 'lqd_formateur';
  const STATUTS = ['Présent', 'Absent', 'Retard', 'Excusé'];
  const ABREV = { 'Présent': 'P', 'Absent': 'A', 'Retard': 'R', 'Excusé': 'E' };
  const FICHIER_MAX = 25 * 1024 * 1024;
  const TYPES_FICHIER = { pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

  const $ = id => document.getElementById(id);
  let session = null;          // { token, profil }
  let apprenantsCache = [];
  let coursCache = [];
  let coursEnModif = null;
  let fichierCours = null;
  let seanceCourante = null;   // { id, apprenants: [...] }
  let evalCourante = null;

  /* ============================ Outils ============================ */

  // Textes du serveur : < et > y sont déjà neutralisés (&lt; &gt;) ; on les
  // remet en clair puis on échappe tout pour l'affichage.
  function esc(t) {
    const d = document.createElement('div');
    d.textContent = String(t == null ? '' : t).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return d.innerHTML;
  }
  function clair(t) { return String(t == null ? '' : t).replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
  function dateFr(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function aujourdhui() {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function initiales(p, n) { return ((p || '?').charAt(0) + (n || '').charAt(0)).toUpperCase(); }
  function avatar(a) {
    return /^https:\/\//.test(a.photoUrl || '')
      ? `<span class="avatar"><img src="${esc(a.photoUrl)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${esc(initiales(a.prenom, a.nom))}'"></span>`
      : `<span class="avatar">${esc(initiales(a.prenom, a.nom))}</span>`;
  }
  function numeroWa(tel) {
    let n = String(tel || '').replace(/\D/g, '');
    if (n.startsWith('00')) n = n.slice(2);
    if (!n.startsWith('229')) n = '229' + n;
    return n;
  }
  function taille(o) { return o > 1048576 ? (o / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.round(o / 1024) + ' Ko'; }
  function chargement(el) { el.innerHTML = '<div class="chargement"><span class="iconify" data-icon="tabler:loader-2"></span> Chargement...</div>'; }

  let minuteurToast = null;
  function toast(msg, erreur) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast visible' + (erreur ? ' erreur' : '');
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(() => { t.className = 'toast'; }, 4500);
  }

  function messageAuth(texte, type) {
    const m = $('auth-msg');
    m.textContent = texte;
    m.className = 'message ' + (type || 'erreur');
    m.hidden = !texte;
  }

  async function api(action, extra) {
    const corps = Object.assign({ action: action }, extra || {});
    if (session) corps.token = session.token;
    const resp = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corps) });
    const r = await resp.json();
    if (r.sessionExpiree) {
      deconnecter(r.message || 'Session expirée. Reconnectez-vous.');
      throw new Error('session');
    }
    return r;
  }

  // Erreur réseau ou serveur, sans doublon quand la session a expiré.
  function echec(e) { if (e && e.message !== 'session') toast(/fetch|network/i.test(e.message) ? 'Connexion interrompue. Réessayez.' : e.message, true); }

  /* ============================ Connexion ============================ */

  function etape(id) {
    ['form-login', 'form-otp', 'form-oubli', 'form-mdp'].forEach(f => { $(f).hidden = f !== id; });
    messageAuth('');
  }

  document.querySelectorAll('.voir-mdp').forEach(b => b.addEventListener('click', () => {
    const c = $(b.dataset.cible);
    c.type = c.type === 'password' ? 'text' : 'password';
  }));
  $('lien-oubli').addEventListener('click', () => { $('oubli-email').value = $('login-email').value; etape('form-oubli'); });
  $('lien-retour-login').addEventListener('click', () => etape('form-login'));
  $('lien-retour-login2').addEventListener('click', () => etape('form-login'));

  async function avecBouton(btn, fn) {
    const libelle = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="iconify" data-icon="tabler:loader-2" style="animation:tourne 1s linear infinite"></span> Patientez...';
    try { await fn(); } finally { btn.disabled = false; btn.innerHTML = libelle; }
  }

  $('form-login').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('login-email').value.trim(), mdp = $('login-mdp').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return messageAuth('Saisissez une adresse email valide.');
    if (!mdp) return messageAuth('Saisissez votre mot de passe.');
    avecBouton($('btn-login'), async () => {
      try {
        const r = await api('formateur_login', { email: email, password: mdp });
        if (r.status !== 'otp_sent') return messageAuth(r.message || 'Connexion impossible.');
        $('otp-info').textContent = r.message;
        etape('form-otp');
        $('otp-code').value = '';
        $('otp-code').focus();
      } catch (err) { messageAuth('Connexion au serveur impossible. Vérifiez votre réseau.'); }
    });
  });

  $('form-otp').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('otp-code').value.replace(/\D/g, '');
    if (code.length !== 6) return messageAuth('Le code contient 6 chiffres.');
    avecBouton($('btn-otp'), async () => {
      try {
        const r = await api('formateur_verify_otp', { email: $('login-email').value.trim(), otp: code });
        if (r.status !== 'success') return messageAuth(r.message || 'Code refusé.');
        session = { token: r.token, profil: r.profil };
        try { sessionStorage.setItem(CLE_SESSION, JSON.stringify(session)); } catch (x) { /* navigation privée : session en mémoire */ }
        $('login-mdp').value = '';
        ouvrirApplication();
      } catch (err) { messageAuth('Connexion au serveur impossible. Vérifiez votre réseau.'); }
    });
  });

  $('form-oubli').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('oubli-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return messageAuth('Saisissez une adresse email valide.');
    avecBouton($('btn-oubli'), async () => {
      try {
        const r = await api('formateur_mdp_oublie', { email: email });
        messageAuth(r.message, 'ok');
      } catch (err) { messageAuth('Connexion au serveur impossible.'); }
    });
  });

  $('form-mdp').addEventListener('submit', e => {
    e.preventDefault();
    const m1 = $('mdp-1').value, m2 = $('mdp-2').value;
    if (m1.length < 8 || !/[A-Za-z]/.test(m1) || !/\d/.test(m1)) return messageAuth('8 caractères minimum, avec au moins une lettre et un chiffre.');
    if (m1 !== m2) return messageAuth('Les deux mots de passe ne correspondent pas.');
    const code = new URLSearchParams(location.search).get('code') || '';
    avecBouton($('btn-mdp'), async () => {
      try {
        const r = await api('formateur_definir_mdp', { code: code, password: m1 });
        if (r.status !== 'success') return messageAuth(r.message);
        history.replaceState(null, '', location.pathname);      // le code ne reste pas dans l'adresse
        etape('form-login');
        $('login-email').value = r.email || '';
        messageAuth(r.message, 'ok');
        $('login-mdp').focus();
      } catch (err) { messageAuth('Connexion au serveur impossible.'); }
    });
  });

  function deconnecter(message) {
    session = null;
    try { sessionStorage.removeItem(CLE_SESSION); } catch (x) {}
    $('ecran-app').hidden = true;
    $('ecran-auth').hidden = false;
    etape('form-login');
    if (message) messageAuth(message);
  }
  $('btn-deconnexion').addEventListener('click', () => deconnecter(''));

  /* ============================ Application ============================ */

  function optionsFilieres(select, avecToutes) {
    select.innerHTML = (avecToutes ? '<option value="">Toutes mes filières</option>' : '')
      + session.profil.filieres.map(f => `<option value="${esc(f.cle)}">${esc(f.nom)}</option>`).join('');
  }

  function ouvrirApplication() {
    const p = session.profil;
    $('ecran-auth').hidden = true;
    $('ecran-app').hidden = false;
    $('f-nom').textContent = p.prenom + ' ' + p.nom;
    $('f-prenom').textContent = p.prenom;
    $('f-avatar').textContent = initiales(p.prenom, p.nom);
    $('f-filieres').textContent = p.filieres.map(f => f.nom).join(' · ');
    ['filtre-filiere-app'].forEach(id => optionsFilieres($(id), true));
    ['appel-filiere', 'eval-filiere', 'c-filiere'].forEach(id => optionsFilieres($(id), false));
    afficherOnglet('accueil');
  }

  const chargeurs = {
    accueil: chargerAccueil, apprenants: chargerApprenants, presences: chargerSeances,
    notes: chargerEvals, cours: chargerCours, questions: chargerQuestions
  };

  function afficherOnglet(nom) {
    document.querySelectorAll('.onglets button').forEach(b => b.classList.toggle('actif', b.dataset.onglet === nom));
    document.querySelectorAll('.panneau').forEach(p => p.classList.toggle('actif', p.id === 'p-' + nom));
    window.scrollTo({ top: 0 });
    if (chargeurs[nom]) chargeurs[nom]();
  }
  document.querySelectorAll('.onglets button').forEach(b => b.addEventListener('click', () => afficherOnglet(b.dataset.onglet)));
  document.querySelectorAll('[data-aller]').forEach(b => b.addEventListener('click', () => {
    afficherOnglet(b.dataset.aller);
    if (b.dataset.action === 'appel') ouvrirAppel('');
    if (b.dataset.action === 'eval') ouvrirEval('');
  }));

  /* ---------------------------- Accueil ---------------------------- */
  async function chargerAccueil() {
    chargement($('stats'));
    try {
      const r = await api('formateur_tableau');
      if (r.status !== 'success') throw new Error(r.message);
      const s = r.stats;
      $('stats').innerHTML = [
        [s.apprenants, 'apprenants suivis'],
        [s.enFormation, 'en formation aujourd\'hui'],
        [s.seances, 'séances enregistrées'],
        [s.tauxPresence === null ? '—' : s.tauxPresence + ' %', 'taux de présence'],
        [s.evaluations, 'évaluations'],
        [s.questionsEnAttente, 'questions en attente', s.questionsEnAttente > 0]
      ].map(x => `<div class="stat${x[2] ? ' alerte' : ''}"><strong>${esc(x[0])}</strong><span>${esc(x[1])}</span></div>`).join('');
      const pas = $('pastille-questions');
      pas.hidden = !s.questionsEnAttente;
      pas.textContent = s.questionsEnAttente;
    } catch (e) { $('stats').innerHTML = ''; echec(e); }
  }

  /* ---------------------------- Apprenants ---------------------------- */
  async function chargerApprenants() {
    chargement($('liste-apprenants'));
    try {
      const r = await api('formateur_apprenants');
      if (r.status !== 'success') throw new Error(r.message);
      apprenantsCache = r.apprenants;
      rendreApprenants();
    } catch (e) { $('liste-apprenants').innerHTML = ''; echec(e); }
  }

  function rendreApprenants() {
    const q = $('rech-apprenant').value.trim().toLowerCase();
    const fil = $('filtre-filiere-app').value;
    const liste = apprenantsCache.filter(a =>
      (!fil || a.filieresCles.indexOf(fil) !== -1) &&
      (!q || (a.prenom + ' ' + a.nom + ' ' + a.id + ' ' + a.telephone).toLowerCase().indexOf(q) !== -1));
    if (!liste.length) { $('liste-apprenants').innerHTML = '<div class="vide">Aucun apprenant.</div>'; return; }
    const badge = s => `<span class="badge ${s === 'Terminé' ? '' : 'vert'}">${esc(s)}</span>`;
    $('liste-apprenants').innerHTML = liste.map(a => `
      <article class="app-carte">
        <div class="app-tete">${avatar(a)}<div><strong>${esc(a.prenom)} ${esc(a.nom)}</strong><span class="discret">${esc(a.filiere)} — ${esc(a.id)}</span></div></div>
        <div>${badge(a.statut)} <span class="discret">${dateFr(a.dateEntree)} → ${dateFr(a.dateFin)}</span></div>
        <div class="app-chiffres">
          <span>Présence <b>${a.tauxPresence === null ? '—' : a.tauxPresence + ' %'}</b></span>
          <span>Absences <b>${a.absences}</b></span>
          <span>Moyenne <b>${a.moyenne === null ? '—' : String(a.moyenne).replace('.', ',') + '/20'}</b></span>
        </div>
        <div class="app-contacts">
          ${a.telephone ? `<a class="btn btn-fantome btn-petit" href="tel:${esc(a.telephone.replace(/[^\d+]/g, ''))}"><span class="iconify" data-icon="tabler:phone"></span> Appeler</a>
          <a class="btn btn-fantome btn-petit" href="https://wa.me/${numeroWa(a.telephone)}" target="_blank" rel="noopener"><span class="iconify" data-icon="tabler:brand-whatsapp"></span> WhatsApp</a>` : ''}
          ${/^[^\s@]+@[^\s@]+$/.test(a.email) ? `<a class="btn btn-fantome btn-petit" href="mailto:${esc(a.email)}"><span class="iconify" data-icon="tabler:mail"></span> Email</a>` : ''}
        </div>
      </article>`).join('');
  }
  $('rech-apprenant').addEventListener('input', rendreApprenants);
  $('filtre-filiere-app').addEventListener('change', rendreApprenants);

  /* ---------------------------- Présences ---------------------------- */
  async function chargerSeances() {
    $('vue-seances').hidden = false; $('vue-appel').hidden = true;
    chargement($('liste-seances'));
    try {
      const r = await api('formateur_seances_lister');
      if (r.status !== 'success') throw new Error(r.message);
      if (!r.seances.length) { $('liste-seances').innerHTML = '<div class="vide">Aucune séance enregistrée. Cliquez sur « Faire l\'appel ».</div>'; return; }
      $('liste-seances').innerHTML = r.seances.map(s => `
        <div class="ligne">
          <div class="ligne-corps"><strong>${dateFr(s.date)} — ${esc(s.filiereNom)}</strong><span class="discret">${esc(s.intitule || 'Séance')}</span></div>
          <div><span class="badge vert">${s.presents} présent${s.presents > 1 ? 's' : ''}</span> ${s.retards ? `<span class="badge orange">${s.retards} retard${s.retards > 1 ? 's' : ''}</span>` : ''} ${s.absents ? `<span class="badge rouge">${s.absents} absent${s.absents > 1 ? 's' : ''}</span>` : ''}</div>
          <div class="ligne-actions"><button type="button" class="btn btn-contour btn-petit" data-seance="${esc(s.id)}"><span class="iconify" data-icon="tabler:pencil"></span> Ouvrir</button></div>
        </div>`).join('');
    } catch (e) { $('liste-seances').innerHTML = ''; echec(e); }
  }
  $('liste-seances').addEventListener('click', e => { const b = e.target.closest('[data-seance]'); if (b) ouvrirAppel(b.dataset.seance); });
  $('btn-nouvel-appel').addEventListener('click', () => ouvrirAppel(''));
  $('retour-seances').addEventListener('click', chargerSeances);

  async function ouvrirAppel(id, garderChamps) {
    $('vue-seances').hidden = true; $('vue-appel').hidden = false;
    $('appel-date').max = aujourdhui();
    if (!garderChamps) {
      $('appel-date').value = aujourdhui();
      $('appel-intitule').value = '';
    }
    $('btn-suppr-seance').hidden = !id;
    $('appel-filiere').disabled = !!id;
    chargement($('liste-appel'));
    try {
      const r = await api('formateur_seance_get', { id: id, filiere: $('appel-filiere').value, date: $('appel-date').value });
      if (r.status !== 'success') throw new Error(r.message);
      seanceCourante = { id: r.seance.id, apprenants: r.apprenants };
      if (id) {
        $('appel-filiere').value = r.seance.filiere;
        $('appel-date').value = r.seance.date;
        $('appel-intitule').value = clair(r.seance.intitule);
      }
      rendreAppel();
    } catch (e) { $('liste-appel').innerHTML = ''; echec(e); }
  }
  // Nouvelle séance : la liste dépend de la filière et de la date.
  $('appel-filiere').addEventListener('change', () => { if (seanceCourante && !seanceCourante.id) ouvrirAppel('', true); });
  $('appel-date').addEventListener('change', () => { if (seanceCourante && !seanceCourante.id) ouvrirAppel('', true); });

  function rendreAppel() {
    const l = seanceCourante.apprenants;
    if (!l.length) { $('liste-appel').innerHTML = '<div class="vide">Aucun apprenant en formation dans cette filière à cette date.</div>'; $('appel-compteur').textContent = ''; return; }
    $('liste-appel').innerHTML = l.map((a, i) => `
      <div class="appel-ligne" data-i="${i}">
        <div class="appel-nom">${avatar(a)}<strong>${esc(a.prenom)} ${esc(a.nom)}</strong></div>
        <div class="segments" role="group" aria-label="Présence de ${esc(a.prenom)}">
          ${STATUTS.map(s => `<button type="button" data-s="${s}" aria-pressed="${a.statut === s}" title="${s}">${ABREV[s]}</button>`).join('')}
        </div>
        <input type="text" class="appel-remarque" maxlength="200" placeholder="Remarque (facultatif)" value="${esc(a.remarque)}" />
      </div>`).join('');
    majCompteurAppel();
  }
  function majCompteurAppel() {
    const l = seanceCourante.apprenants;
    const c = s => l.filter(a => a.statut === s).length;
    $('appel-compteur').textContent = `${l.length} apprenant(s) — P ${c('Présent')} · A ${c('Absent')} · R ${c('Retard')} · E ${c('Excusé')}`;
  }
  $('liste-appel').addEventListener('click', e => {
    const b = e.target.closest('.segments button');
    if (!b) return;
    const ligne = b.closest('.appel-ligne');
    seanceCourante.apprenants[Number(ligne.dataset.i)].statut = b.dataset.s;
    ligne.querySelectorAll('.segments button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    majCompteurAppel();
  });
  $('liste-appel').addEventListener('input', e => {
    if (!e.target.classList.contains('appel-remarque')) return;
    seanceCourante.apprenants[Number(e.target.closest('.appel-ligne').dataset.i)].remarque = e.target.value;
  });
  $('btn-tous-presents').addEventListener('click', () => {
    if (!seanceCourante) return;
    seanceCourante.apprenants.forEach(a => { a.statut = 'Présent'; });
    rendreAppel();
  });
  $('btn-enreg-appel').addEventListener('click', () => {
    if (!seanceCourante || !seanceCourante.apprenants.length) return toast('Aucun apprenant à enregistrer.', true);
    if (!$('appel-date').value || $('appel-date').value > aujourdhui()) return toast('Choisissez une date de séance passée ou du jour.', true);
    avecBouton($('btn-enreg-appel'), async () => {
      try {
        const r = await api('formateur_seance_enregistrer', {
          id: seanceCourante.id, filiere: $('appel-filiere').value, date: $('appel-date').value, intitule: $('appel-intitule').value.trim(),
          presences: seanceCourante.apprenants.map(a => ({ dossierId: a.id, statut: a.statut, remarque: (a.remarque || '').trim() }))
        });
        if (r.status !== 'success') throw new Error(r.message);
        toast('Appel enregistré.');
        $('appel-filiere').disabled = false;
        chargerSeances();
      } catch (e) { echec(e); }
    });
  });
  $('btn-suppr-seance').addEventListener('click', async () => {
    if (!seanceCourante || !seanceCourante.id || !confirm('Supprimer définitivement cette séance et ses présences ?')) return;
    try {
      const r = await api('formateur_seance_supprimer', { id: seanceCourante.id });
      if (r.status !== 'success') throw new Error(r.message);
      toast('Séance supprimée.');
      $('appel-filiere').disabled = false;
      chargerSeances();
    } catch (e) { echec(e); }
  });

  /* ---------------------------- Notes ---------------------------- */
  async function chargerEvals() {
    $('vue-evals').hidden = false; $('vue-eval').hidden = true;
    chargement($('liste-evals'));
    try {
      const r = await api('formateur_evals_lister');
      if (r.status !== 'success') throw new Error(r.message);
      if (!r.evaluations.length) { $('liste-evals').innerHTML = '<div class="vide">Aucune évaluation. Cliquez sur « Nouvelle évaluation ».</div>'; return; }
      $('liste-evals').innerHTML = r.evaluations.map(e => `
        <div class="ligne">
          <div class="ligne-corps"><strong>${esc(e.intitule)}</strong><span class="discret">${dateFr(e.date)} — ${esc(e.filiereNom)} — sur ${e.bareme}, coef. ${String(e.coefficient).replace('.', ',')}</span></div>
          <div>${e.publiee ? '<span class="badge vert">Publiée</span>' : '<span class="badge orange">Non publiée</span>'} <span class="discret">${e.nbNotes} note(s)${e.moyenneClasse === null ? '' : ' — moyenne ' + String(e.moyenneClasse).replace('.', ',') + '/' + e.bareme}</span></div>
          <div class="ligne-actions"><button type="button" class="btn btn-contour btn-petit" data-eval="${esc(e.id)}"><span class="iconify" data-icon="tabler:pencil"></span> Ouvrir</button></div>
        </div>`).join('');
    } catch (e) { $('liste-evals').innerHTML = ''; echec(e); }
  }
  $('liste-evals').addEventListener('click', e => { const b = e.target.closest('[data-eval]'); if (b) ouvrirEval(b.dataset.eval); });
  $('btn-nouvelle-eval').addEventListener('click', () => ouvrirEval(''));
  $('retour-evals').addEventListener('click', chargerEvals);

  async function ouvrirEval(id, garderChamps) {
    $('vue-evals').hidden = true; $('vue-eval').hidden = false;
    if (!garderChamps) {
      $('eval-date').value = aujourdhui();
      $('eval-intitule').value = '';
      $('eval-bareme').value = '20';
      $('eval-coef').value = '1';
      $('eval-publiee').checked = false;
    }
    $('btn-suppr-eval').hidden = !id;
    $('eval-filiere').disabled = !!id;
    chargement($('liste-notes'));
    try {
      const r = await api('formateur_eval_get', { id: id, filiere: $('eval-filiere').value, date: $('eval-date').value });
      if (r.status !== 'success') throw new Error(r.message);
      evalCourante = { id: r.evaluation.id, apprenants: r.apprenants };
      if (id) {
        const ev = r.evaluation;
        $('eval-filiere').value = ev.filiere; $('eval-date').value = ev.date; $('eval-intitule').value = clair(ev.intitule);
        $('eval-bareme').value = String(ev.bareme); $('eval-coef').value = String(ev.coefficient); $('eval-publiee').checked = !!ev.publiee;
      }
      rendreNotes();
    } catch (e) { $('liste-notes').innerHTML = ''; echec(e); }
  }
  $('eval-filiere').addEventListener('change', () => { if (evalCourante && !evalCourante.id) ouvrirEval('', true); });
  $('eval-date').addEventListener('change', () => { if (evalCourante && !evalCourante.id) ouvrirEval('', true); });
  $('eval-bareme').addEventListener('change', () => { $('liste-notes').querySelectorAll('input.note').forEach(i => { i.max = $('eval-bareme').value; validerNote(i); }); });

  function rendreNotes() {
    const l = evalCourante.apprenants;
    if (!l.length) { $('liste-notes').innerHTML = '<div class="vide">Aucun apprenant en formation dans cette filière à cette date.</div>'; return; }
    const b = $('eval-bareme').value;
    $('liste-notes').innerHTML = l.map((a, i) => `
      <div class="note-ligne" data-i="${i}">
        <div class="appel-nom">${avatar(a)}<strong>${esc(a.prenom)} ${esc(a.nom)}</strong></div>
        <input type="text" inputmode="decimal" class="note" aria-label="Note de ${esc(a.prenom)}" placeholder="— / ${b}" value="${a.note === null ? '' : String(a.note).replace('.', ',')}" />
        <input type="text" class="appreciation" maxlength="200" placeholder="Appréciation (facultatif)" value="${esc(a.appreciation)}" />
      </div>`).join('');
  }
  function validerNote(input) {
    const v = input.value.trim().replace(',', '.');
    const ok = v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= Number($('eval-bareme').value));
    input.classList.toggle('erreur', !ok);
    return ok;
  }
  $('liste-notes').addEventListener('input', e => {
    const ligne = e.target.closest('.note-ligne');
    if (!ligne) return;
    const a = evalCourante.apprenants[Number(ligne.dataset.i)];
    if (e.target.classList.contains('note')) validerNote(e.target);
    else a.appreciation = e.target.value;
  });
  $('btn-enreg-eval').addEventListener('click', () => {
    if (!evalCourante) return;
    if (!$('eval-intitule').value.trim()) return toast('Donnez un intitulé à l\'évaluation.', true);
    const champs = [...$('liste-notes').querySelectorAll('.note-ligne')];
    if (champs.some(l => !validerNote(l.querySelector('input.note')))) return toast('Corrigez les notes en rouge (entre 0 et ' + $('eval-bareme').value + ').', true);
    const notes = champs.map(l => {
      const a = evalCourante.apprenants[Number(l.dataset.i)];
      return { dossierId: a.id, note: l.querySelector('input.note').value.trim().replace(',', '.'), appreciation: l.querySelector('.appreciation').value.trim() };
    });
    avecBouton($('btn-enreg-eval'), async () => {
      try {
        const r = await api('formateur_eval_enregistrer', {
          id: evalCourante.id, filiere: $('eval-filiere').value, date: $('eval-date').value, intitule: $('eval-intitule').value.trim(),
          bareme: Number($('eval-bareme').value), coefficient: Number($('eval-coef').value), publiee: $('eval-publiee').checked, notes: notes
        });
        if (r.status !== 'success') throw new Error(r.message);
        toast($('eval-publiee').checked ? 'Notes enregistrées et publiées aux apprenants.' : 'Notes enregistrées (non publiées).');
        $('eval-filiere').disabled = false;
        chargerEvals();
      } catch (e) { echec(e); }
    });
  });
  $('btn-suppr-eval').addEventListener('click', async () => {
    if (!evalCourante || !evalCourante.id || !confirm('Supprimer définitivement cette évaluation et toutes ses notes ?')) return;
    try {
      const r = await api('formateur_eval_supprimer', { id: evalCourante.id });
      if (r.status !== 'success') throw new Error(r.message);
      toast('Évaluation supprimée.');
      $('eval-filiere').disabled = false;
      chargerEvals();
    } catch (e) { echec(e); }
  });

  /* ---------------------------- Cours ---------------------------- */
  function sourceCours() { const r = document.querySelector('input[name="c-source"]:checked'); return r ? r.value : 'lien'; }
  function majZonesCours() {
    $('c-zone-fichier').hidden = sourceCours() !== 'fichier';
    $('c-zone-lien').hidden = sourceCours() === 'fichier';
  }
  document.querySelectorAll('input[name="c-source"]').forEach(r => r.addEventListener('change', majZonesCours));
  $('c-fichier').addEventListener('change', function () {
    fichierCours = null;
    $('c-fichier-nom').textContent = 'Aucun fichier choisi';
    const f = this.files && this.files[0];
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const mime = Object.values(TYPES_FICHIER).includes(f.type) ? f.type : (TYPES_FICHIER[ext] || '');
    if (!mime) { this.value = ''; return toast('Format non accepté : PDF, MP4, WEBM ou MOV.', true); }
    if (f.size > FICHIER_MAX) { this.value = ''; return toast('Fichier trop lourd (25 Mo maximum). Pour une vidéo plus longue, utilisez YouTube « non répertoriée ».', true); }
    fichierCours = { file: f, mimeType: mime };
    $('c-fichier-nom').textContent = f.name + ' — ' + taille(f.size);
    if (!$('c-titre').value.trim()) $('c-titre').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 150);
  });

  async function chargerCours() {
    chargement($('liste-cours'));
    try {
      const r = await api('formateur_cours_lister');
      if (r.status !== 'success') throw new Error(r.message);
      coursCache = r.cours;
      $('c-modules').innerHTML = r.modules.map(m => `<option value="${esc(m)}"></option>`).join('');
      if (!coursCache.length) { $('liste-cours').innerHTML = '<div class="vide">Aucun support pour vos filières.</div>'; return; }
      let mod = null;
      $('liste-cours').innerHTML = coursCache.map(c => {
        const nom = c.module || 'Autres supports';
        const tete = nom !== mod ? `<div class="module-titre">${esc(nom)}</div>` : '';
        mod = nom;
        return `${tete}<div class="ligne">
          <div class="ligne-corps"><strong>${esc(c.titre)}</strong><span class="discret">${esc(c.filiereNom)} — ${esc(c.type)} — ordre ${Number(c.ordre) || 0}</span></div>
          <div class="discret">${c.vues ? `<button type="button" class="lien" data-vues="${esc(c.id)}">${c.vues} ouverture(s) — ${c.apprenantsDistincts} apprenant(s)</button>` : 'Pas encore ouvert'}</div>
          <div class="ligne-actions">
            <button type="button" class="btn btn-fantome btn-petit" data-modif="${esc(c.id)}" title="Modifier"><span class="iconify" data-icon="tabler:pencil"></span></button>
            <button type="button" class="btn btn-danger btn-petit" data-suppr="${esc(c.id)}" title="Supprimer"><span class="iconify" data-icon="tabler:trash"></span></button>
          </div>
        </div>`;
      }).join('');
    } catch (e) { $('liste-cours').innerHTML = ''; echec(e); }
  }

  function viderFormCours() {
    coursEnModif = null; fichierCours = null;
    ['c-titre', 'c-description', 'c-url', 'c-module'].forEach(id => { $(id).value = ''; });
    $('c-ordre').value = '0'; $('c-fichier').value = ''; $('c-notifier').checked = false;
    $('c-fichier-nom').textContent = 'Aucun fichier choisi';
    $('c-source-bloc').hidden = false; $('c-notifier-bloc').hidden = false; $('c-filiere').disabled = false;
    majZonesCours();
    $('cours-titre-form').innerHTML = '<span class="iconify" data-icon="tabler:circle-plus"></span> Ajouter un support';
    $('btn-c-libelle').textContent = 'Ajouter';
    $('btn-c-annuler').hidden = true;
  }
  $('btn-c-annuler').addEventListener('click', viderFormCours);

  $('liste-cours').addEventListener('click', async e => {
    const m = e.target.closest('[data-modif]'), s = e.target.closest('[data-suppr]'), v = e.target.closest('[data-vues]');
    if (m) {
      const c = coursCache.find(x => x.id === m.dataset.modif);
      if (!c) return;
      coursEnModif = c;
      $('c-filiere').value = c.filiere; $('c-module').value = clair(c.module); $('c-titre').value = clair(c.titre);
      $('c-description').value = clair(c.description); $('c-ordre').value = Number(c.ordre) || 0;
      $('c-url').value = c.fileId ? '' : c.url; $('c-type').value = ['PDF', 'Vidéo', 'Lien'].includes(c.type) ? c.type : 'Lien';
      $('c-source-bloc').hidden = true; $('c-zone-fichier').hidden = true; $('c-zone-lien').hidden = !!c.fileId; $('c-notifier-bloc').hidden = true;
      $('cours-titre-form').innerHTML = '<span class="iconify" data-icon="tabler:pencil"></span> Modifier : ' + esc(c.titre);
      $('btn-c-libelle').textContent = 'Enregistrer';
      $('btn-c-annuler').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (s) {
      if (!confirm('Supprimer ce support ? Les apprenants n\'y auront plus accès.')) return;
      try {
        const r = await api('formateur_cours_supprimer', { id: s.dataset.suppr });
        if (r.status !== 'success') throw new Error(r.message);
        toast('Support supprimé.'); if (coursEnModif && coursEnModif.id === s.dataset.suppr) viderFormCours(); chargerCours();
      } catch (err) { echec(err); }
    }
    if (v) {
      $('fenetre-titre').textContent = 'Consultations';
      chargement($('fenetre-corps'));
      $('fenetre').hidden = false;
      try {
        const r = await api('formateur_cours_consultations', { id: v.dataset.vues });
        if (r.status !== 'success') throw new Error(r.message);
        $('fenetre-corps').innerHTML = `<table class="tableau"><thead><tr><th>Date</th><th>Apprenant</th></tr></thead><tbody>${
          r.consultations.map(x => `<tr><td>${x.date ? new Date(x.date).toLocaleString('fr-FR') : '—'}</td><td>${esc(x.nom)}</td></tr>`).join('')}</tbody></table>`;
      } catch (err) { $('fenetre').hidden = true; echec(err); }
    }
  });
  $('fenetre-fermer').addEventListener('click', () => { $('fenetre').hidden = true; });
  $('fenetre').addEventListener('click', e => { if (e.target === $('fenetre')) $('fenetre').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('fenetre').hidden = true; });

  function lireDataUrl(file) {
    return new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(l.result); l.onerror = () => ko(new Error('Fichier illisible.')); l.readAsDataURL(file); });
  }

  $('btn-c-enreg').addEventListener('click', () => {
    const charge = {
      filiere: $('c-filiere').value, module: $('c-module').value.trim(), titre: $('c-titre').value.trim(),
      description: $('c-description').value.trim(), ordre: Number($('c-ordre').value) || 0, type: $('c-type').value
    };
    if (!charge.titre) return toast('Le titre est obligatoire.', true);
    const parFichier = !coursEnModif && sourceCours() === 'fichier';
    if (coursEnModif) { charge.id = coursEnModif.id; if (!coursEnModif.fileId) charge.url = $('c-url').value.trim(); }
    else if (parFichier) { if (!fichierCours) return toast('Choisissez le fichier à envoyer.', true); }
    else charge.url = $('c-url').value.trim();
    if (charge.url !== undefined && !/^https:\/\/\S{4,}$/i.test(charge.url)) return toast('Le lien doit commencer par https://', true);
    if (!coursEnModif) charge.notifier = $('c-notifier').checked;

    avecBouton($('btn-c-enreg'), async () => {
      try {
        if (parFichier) {
          $('c-progression').textContent = 'Préparation du fichier...';
          charge.fichier = { base64: String(await lireDataUrl(fichierCours.file)).split(',')[1] || '', mimeType: fichierCours.mimeType, nom: fichierCours.file.name };
          $('c-progression').textContent = 'Envoi (' + taille(fichierCours.file.size) + ')... ne fermez pas la page.';
        }
        const r = await api(coursEnModif ? 'formateur_cours_modifier' : 'formateur_cours_ajouter', charge);
        if (r.status !== 'success') throw new Error(r.message);
        let msg = coursEnModif ? 'Support modifié.' : 'Support ajouté.';
        if (r.notification && r.notification.envoyes) msg += ' Email envoyé à ' + r.notification.envoyes + ' apprenant(s).';
        if (r.notification && r.notification.avertissement) toast(r.notification.avertissement, true); else toast(msg);
        viderFormCours();
        chargerCours();
      } catch (e) { echec(e); }
      finally { $('c-progression').textContent = ''; }
    });
  });

  /* ---------------------------- Questions ---------------------------- */
  async function chargerQuestions() {
    chargement($('liste-questions'));
    try {
      const r = await api('formateur_forum_lister');
      if (r.status !== 'success') throw new Error(r.message);
      const attente = r.questions.filter(q => q.statut === 'en_attente').length;
      $('pastille-questions').hidden = !attente; $('pastille-questions').textContent = attente;
      if (!r.questions.length) { $('liste-questions').innerHTML = '<div class="vide">Aucune question pour vos filières.</div>'; return; }
      $('liste-questions').innerHTML = r.questions.map(q => {
        const wa = q.telephone ? 'https://wa.me/' + numeroWa(q.telephone) + '?text=' + encodeURIComponent('Bonjour ' + clair(q.nom).split(' ')[0] + ', j\'ai répondu à votre question. Consultez votre espace apprenant : https://www.qualitededieuservice.com/espace-apprenant') : '';
        return `<article class="question${q.statut === 'en_attente' ? ' attente' : ''}">
          <span class="discret">${esc(q.nom)} — ${esc(q.filiere)} — ${q.dateQuestion ? new Date(q.dateQuestion).toLocaleString('fr-FR') : ''}</span>
          <p><strong>${esc(q.question)}</strong></p>
          ${q.statut === 'repondu'
            ? `<div class="reponse"><strong>Réponse (${esc(q.reponduPar)}) :</strong> ${esc(q.reponse)}</div>
               ${wa ? `<a class="btn btn-fantome btn-petit" style="margin-top:8px;" href="${esc(wa)}" target="_blank" rel="noopener"><span class="iconify" data-icon="tabler:brand-whatsapp"></span> Prévenir par WhatsApp</a>` : ''}`
            : `<textarea maxlength="3000" rows="4" placeholder="Votre réponse..." data-rep="${esc(q.id)}"></textarea>
               <div class="compteur">0 / 3000</div>
               <div class="pied-form"><button type="button" class="btn btn-plein btn-petit" data-envoyer="${esc(q.id)}"><span class="iconify" data-icon="tabler:send"></span> Répondre</button></div>`}
        </article>`;
      }).join('');
    } catch (e) { $('liste-questions').innerHTML = ''; echec(e); }
  }
  $('liste-questions').addEventListener('input', e => {
    if (e.target.dataset.rep) e.target.nextElementSibling.textContent = e.target.value.length + ' / 3000';
  });
  $('liste-questions').addEventListener('click', e => {
    const b = e.target.closest('[data-envoyer]');
    if (!b) return;
    const zone = $('liste-questions').querySelector(`textarea[data-rep="${CSS.escape(b.dataset.envoyer)}"]`);
    const rep = zone.value.trim();
    if (!rep) return toast('Écrivez votre réponse.', true);
    avecBouton(b, async () => {
      try {
        const r = await api('formateur_forum_repondre', { id: b.dataset.envoyer, reponse: rep });
        if (r.status !== 'success') throw new Error(r.message);
        toast(r.emailEnvoye ? 'Réponse publiée et envoyée par email à l\'apprenant.' : 'Réponse publiée. Pas d\'email : prévenez-le par WhatsApp.');
        chargerQuestions();
      } catch (err) { echec(err); }
    });
  });

  /* ============================ Démarrage ============================ */
  (function demarrer() {
    const code = new URLSearchParams(location.search).get('code');
    if (code && /^[A-Za-z0-9]{20,80}$/.test(code)) { etape('form-mdp'); $('mdp-1').focus(); return; }
    try { session = JSON.parse(sessionStorage.getItem(CLE_SESSION) || 'null'); } catch (x) { session = null; }
    if (session && session.token && session.profil) ouvrirApplication();
    else { session = null; etape('form-login'); }
  })();
})();

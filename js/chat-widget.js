"use strict";

/* ============================================================
   WIDGET DE CHAT PUBLIC — LES QUALITÉS DE DIEU SERVICE
   Autonome (aucune dépendance de build), 100% GAS pur.
   FAQ locale par mots-clés + quiz d'orientation + prise de RDV
   + capture de contact. Aucun contenu variable n'est jamais
   inséré via innerHTML — uniquement textContent (anti-XSS).
   ============================================================ */

(function () {

  // ─── CONFIG ───────────────────────────────────────────────
  // Backend GAS — même URL que sur le reste du site (à garder
  // synchronisée avec GAS_WEBAPP_URL dans index.html si le
  // déploiement GAS change).
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwbEkz8PsyWMnOMkXbV1ZY5pBSHTO4l-cw5r5tE8kDw2tEsXAmdRotmjaWg9cT6Ousg/exec';

  // Catalogue formations — à garder synchronisé avec CONFIG.COUTS_FORMATIONS
  // et CONFIG.FRAIS_INSCRIPTION dans GAS/code.gs, et avec la section
  // #formations d'index.html.
  const FORMATIONS = {
    informatique:   { label: 'Informatique & Bureautique', duree: '3 mois', prix: '45 000 F' },
    graphisme:      { label: 'Graphisme & PAO',             duree: '4 mois', prix: '65 000 F' },
    serigraphie:    { label: 'Sérigraphie',                 duree: '3 mois', prix: '35 000 F' },
    developpement:  { label: 'Création de sites web',       duree: '4 mois', prix: '200 000 F' },
  };
  const FRAIS_INSCRIPTION = '10 000 F';
  const TEL_CONTACT   = '+229 01 97 95 12 30';
  const EMAIL_CONTACT = 'contact@lqdservice.bj';

  const CRENEAUX = ['Matin (8h-12h)', 'Après-midi (13h-17h)', 'À définir par téléphone'];
  const TYPES_RDV = ['Visite du centre', 'Renseignements formation', 'Inscription', 'Autre'];

  // ─── ÉTAT ─────────────────────────────────────────────────
  const Etat = { mode: 'idle', quiz: { index: 0, scores: {} }, rdv: {}, lead: {} };

  // ─── STYLE ────────────────────────────────────────────────
  const STYLE = `
  #pkc-launcher{position:fixed;bottom:22px;right:22px;width:58px;height:58px;border-radius:50%;
    background:var(--teal-600,#0D7A8A);color:#fff;border:none;cursor:pointer;z-index:9998;
    box-shadow:0 6px 24px rgba(4,52,44,0.35);display:flex;align-items:center;justify-content:center;
    font-size:26px;transition:transform .2s ease;}
  #pkc-launcher:hover{transform:scale(1.06);}
  #pkc-panel{position:fixed;bottom:92px;right:22px;width:360px;max-width:calc(100vw - 32px);
    height:520px;max-height:calc(100vh - 130px);background:#fff;border-radius:18px;
    box-shadow:0 16px 50px rgba(0,0,0,0.25);z-index:9998;display:none;flex-direction:column;
    overflow:hidden;font-family:'DM Sans',sans-serif;}
  #pkc-panel.open{display:flex;}
  #pkc-header{background:var(--teal-900,#04342C);color:#fff;padding:16px 18px;display:flex;
    align-items:center;gap:10px;}
  #pkc-header img{width:34px;height:34px;border-radius:8px;object-fit:cover;}
  #pkc-header .pkc-title{font-weight:700;font-size:14px;line-height:1.2;}
  #pkc-header .pkc-sub{font-size:11px;color:#9FE1CB;}
  #pkc-close{margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;
    opacity:.75;}
  #pkc-close:hover{opacity:1;}
  #pkc-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;
    background:#F9FAFB;}
  .pkc-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.5;}
  .pkc-msg.bot{background:#fff;color:#1A1A2E;align-self:flex-start;border:1px solid #E5E7EB;
    border-bottom-left-radius:4px;}
  .pkc-msg.user{background:var(--teal-600,#0D7A8A);color:#fff;align-self:flex-end;
    border-bottom-right-radius:4px;}
  .pkc-quick{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px;}
  .pkc-chip{background:#fff;border:1.5px solid var(--teal-600,#0D7A8A);color:var(--teal-700,#0F6E56);
    font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:20px;cursor:pointer;
    transition:background .15s ease;}
  .pkc-chip:hover{background:var(--teal-50,#E1F5EE);}
  #pkc-inputwrap{display:flex;gap:8px;padding:12px;border-top:1px solid #E5E7EB;background:#fff;}
  #pkc-input{flex:1;border:1.5px solid #D1D5DB;border-radius:10px;padding:9px 12px;font-size:13.5px;
    outline:none;font-family:inherit;}
  #pkc-input:focus{border-color:var(--teal-500,#1D9E75);}
  #pkc-send{background:var(--teal-600,#0D7A8A);color:#fff;border:none;border-radius:10px;
    width:38px;height:38px;cursor:pointer;font-size:16px;flex-shrink:0;}
  .pkc-form-field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;}
  .pkc-form-field label{font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;
    letter-spacing:.04em;}
  .pkc-form-field input,.pkc-form-field select{border:1.5px solid #D1D5DB;border-radius:8px;
    padding:8px 10px;font-size:13px;font-family:inherit;outline:none;}
  .pkc-form-submit{background:var(--orange-500,#F5A623);color:#fff;border:none;border-radius:10px;
    padding:9px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;}
  @media (max-width:420px){#pkc-panel{right:16px;left:16px;width:auto;bottom:82px;}}
  `;

  // ─── DOM ──────────────────────────────────────────────────
  let elLauncher, elPanel, elBody, elQuick, elInput, elSend;

  function injecterDOM() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button id="pkc-launcher" aria-label="Ouvrir le chat">
        <span class="iconify" data-icon="tabler:message-circle-2"></span>
      </button>
      <div id="pkc-panel" role="dialog" aria-label="Chat LQD Service">
        <div id="pkc-header">
          <img src="icons/logoqds.jpg" alt="LQD" />
          <div>
            <div class="pkc-title">LQD Service</div>
            <div class="pkc-sub">Assistant en ligne</div>
          </div>
          <button id="pkc-close" aria-label="Fermer">&times;</button>
        </div>
        <div id="pkc-body" aria-live="polite"></div>
        <div class="pkc-quick" id="pkc-quick"></div>
        <div id="pkc-inputwrap">
          <input type="text" id="pkc-input" placeholder="Écrivez votre question..." autocomplete="off" />
          <button id="pkc-send" aria-label="Envoyer"><span class="iconify" data-icon="tabler:send-2"></span></button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }

  function ajouterMessage(texte, type) {
    const div = document.createElement('div');
    div.className = 'pkc-msg ' + type;
    div.textContent = texte;
    elBody.appendChild(div);
    elBody.scrollTop = elBody.scrollHeight;
  }

  function ajouterOptions(options, onChoix) {
    elQuick.innerHTML = '';
    options.forEach(opt => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pkc-chip';
      chip.textContent = opt.label;
      chip.onclick = () => { elQuick.innerHTML = ''; ajouterMessage(opt.label, 'user'); onChoix(opt.value); };
      elQuick.appendChild(chip);
    });
  }

  function viderOptions() { elQuick.innerHTML = ''; }

  function afficherFormulaire(champs, onSubmit, labelBouton) {
    viderOptions();
    const form = document.createElement('div');
    form.style.cssText = 'background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px;align-self:stretch;';

    const inputs = {};
    champs.forEach(c => {
      const field = document.createElement('div');
      field.className = 'pkc-form-field';
      const label = document.createElement('label');
      label.textContent = c.label;
      field.appendChild(label);

      let input;
      if (c.type === 'select') {
        input = document.createElement('select');
        c.options.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o; opt.textContent = o;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement('input');
        input.type = c.type || 'text';
        input.placeholder = c.placeholder || '';
      }
      input.id = 'pkc-f-' + c.key;
      field.appendChild(input);
      form.appendChild(field);
      inputs[c.key] = input;
    });

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pkc-form-submit';
    btn.textContent = labelBouton || 'Envoyer';
    btn.onclick = () => {
      const valeurs = {};
      champs.forEach(c => { valeurs[c.key] = inputs[c.key].value.trim(); });
      if (champs.some(c => c.required && !valeurs[c.key])) {
        ajouterMessage('Merci de remplir les champs obligatoires.', 'bot');
        return;
      }
      form.remove();
      onSubmit(valeurs);
    };
    form.appendChild(btn);

    elBody.appendChild(form);
    elBody.scrollTop = elBody.scrollHeight;
  }

  // ─── FAQ LOCALE PAR MOTS-CLÉS ─────────────────────────────
  function detecterFormation(t) {
    if (/bureau|word|excel|powerpoint|informatique/.test(t)) return 'informatique';
    if (/graph|photoshop|illustrator|corel|pao|design/.test(t)) return 'graphisme';
    if (/s[ée]rigraph|impression|tissu/.test(t)) return 'serigraphie';
    if (/web|site|d[ée]veloppement|html|css|wordpress/.test(t)) return 'developpement';
    return null;
  }

  function repondreFAQLocale(texteOriginal) {
    const t = texteOriginal.toLowerCase();
    const cleFormation = detecterFormation(t);

    if (/bonjour|salut|bonsoir|hello/.test(t) && t.length < 20) {
      return `Bonjour ! Je suis l'assistant LQD Service. Je peux vous renseigner sur nos formations, les tarifs, ou vous aider à prendre rendez-vous.`;
    }
    if (/merci/.test(t)) return `Avec plaisir ! N'hésitez pas si vous avez d'autres questions.`;
    if (/au revoir|bye/.test(t)) return `Au revoir, et à bientôt chez LQD Service !`;

    if (/tarif|prix|co[ûu]t|combien/.test(t)) {
      if (cleFormation) {
        const f = FORMATIONS[cleFormation];
        return `${f.label} coûte ${f.prix} (durée : ${f.duree}), plus ${FRAIS_INSCRIPTION} de frais d'inscription uniques. Le paiement se fait en 3 tranches par virement bancaire.`;
      }
      return `Nos formations vont de 35 000 F à 200 000 F selon la filière, plus ${FRAIS_INSCRIPTION} de frais d'inscription. Quelle formation vous intéresse ?`;
    }
    if (/dur[ée]e|combien de temps|mois/.test(t)) {
      if (cleFormation) return `${FORMATIONS[cleFormation].label} dure ${FORMATIONS[cleFormation].duree}.`;
      return `Nos formations durent entre 3 et 4 mois selon la filière.`;
    }
    if (/paiement|virement|payer|tranche/.test(t)) {
      return `Le paiement se fait uniquement par virement bancaire, en 3 tranches (50% à l'inscription, 25% en milieu de formation, 25% en fin de formation). Les coordonnées bancaires vous sont envoyées après inscription.`;
    }
    if (/attestation|certificat|diplome|diplôme/.test(t)) {
      return `Une attestation de fin de formation officielle vous est délivrée à la fin de votre parcours, téléchargeable directement depuis l'espace apprenant du site avec votre numéro de dossier.`;
    }
    if (/stage|postuler|emploi|recrut|formateur/.test(t)) {
      return `Vous pouvez postuler comme formateur/staff ou pour un stage via notre page dédiée.`;
    }
    if (/adresse|o[uù] .*(trouve|situ[ée])|localisation/.test(t)) {
      return `Nous sommes situés à Comé, Hongodé — en face de l'Hôpital de Zone de Comé, Bénin.`;
    }
    if (/contact|t[ée]l[ée]phone|num[ée]ro/.test(t)) {
      return `Vous pouvez nous joindre au ${TEL_CONTACT} ou par e-mail à ${EMAIL_CONTACT}.`;
    }
    if (cleFormation) {
      const f = FORMATIONS[cleFormation];
      return `${f.label} : ${f.prix}, sur ${f.duree}. Souhaitez-vous vous inscrire ou prendre rendez-vous pour en savoir plus ?`;
    }
    return null;
  }

  function envoyerQuestionLibre(texte) {
    const reponse = repondreFAQLocale(texte);
    if (reponse) {
      ajouterMessage(reponse, 'bot');
    } else {
      ajouterMessage(`Je n'ai pas toute l'information sous la main, mais notre équipe peut vous répondre directement.`, 'bot');
    }
    proposerActionsPrincipales();
  }

  function proposerActionsPrincipales() {
    ajouterOptions([
      { label: 'Trouver ma formation', value: 'quiz' },
      { label: 'Prendre RDV', value: 'rdv' },
      { label: 'Être rappelé', value: 'lead' },
      { label: "S'inscrire", value: 'inscription' },
    ], (choix) => {
      if (choix === 'quiz') demarrerQuiz();
      else if (choix === 'rdv') demarrerRdv();
      else if (choix === 'lead') demarrerLead();
      else if (choix === 'inscription') {
        ajouterMessage(`Direction le formulaire d'inscription !`, 'bot');
        fermerPanel();
        const cible = document.getElementById('inscription');
        if (cible) cible.scrollIntoView({ behavior: 'smooth' });
        else window.location.href = 'index.html#inscription';
      }
    });
  }

  // ─── QUIZ D'ORIENTATION ────────────────────────────────────
  const QUIZ_QUESTIONS = [
    {
      texte: "Qu'est-ce qui vous attire le plus ?",
      options: [
        { label: 'Word, Excel, gestion de bureau', scores: { informatique: 3 } },
        { label: 'Créer des visuels, des logos', scores: { graphisme: 3 } },
        { label: 'Imprimer sur tissu, objets promo', scores: { serigraphie: 3 } },
        { label: 'Construire des sites internet', scores: { developpement: 3 } },
      ],
    },
    {
      texte: 'Quel métier vous fait rêver ?',
      options: [
        { label: 'Assistant(e) de direction / secrétariat', scores: { informatique: 2 } },
        { label: 'Graphiste / infographe', scores: { graphisme: 2 } },
        { label: 'Entrepreneur en sérigraphie', scores: { serigraphie: 2 } },
        { label: 'Développeur web / webmaster', scores: { developpement: 2 } },
      ],
    },
  ];

  function demarrerQuiz() {
    Etat.mode = 'quiz';
    Etat.quiz = { index: 0, scores: {} };
    ajouterMessage('Répondons à 2 petites questions pour trouver la formation qui vous correspond.', 'bot');
    poserQuestionQuiz();
  }

  function poserQuestionQuiz() {
    const q = QUIZ_QUESTIONS[Etat.quiz.index];
    if (!q) return conclureQuiz();
    ajouterMessage(q.texte, 'bot');
    ajouterOptions(
      q.options.map((o, i) => ({ label: o.label, value: i })),
      (i) => {
        const opt = q.options[i];
        Object.entries(opt.scores).forEach(([k, v]) => {
          Etat.quiz.scores[k] = (Etat.quiz.scores[k] || 0) + v;
        });
        Etat.quiz.index++;
        poserQuestionQuiz();
      }
    );
  }

  function conclureQuiz() {
    const scores = Etat.quiz.scores;
    let meilleure = null, max = -1;
    Object.entries(scores).forEach(([k, v]) => { if (v > max) { max = v; meilleure = k; } });
    if (!meilleure) meilleure = 'informatique';

    const f = FORMATIONS[meilleure];
    ajouterMessage(`D'après vos réponses, la formation "${f.label}" (${f.duree}, ${f.prix}) devrait vous plaire !`, 'bot');
    Etat.mode = 'idle';
    proposerActionsPrincipales();
  }

  // ─── PRISE DE RDV ──────────────────────────────────────────
  function demarrerRdv() {
    Etat.mode = 'rdv';
    ajouterMessage('Parfait, prenons rendez-vous. Quelques informations :', 'bot');
    afficherFormulaire([
      { key: 'nom', label: 'Nom complet', required: true },
      { key: 'telephone', label: 'Téléphone', type: 'tel', required: true },
      { key: 'email', label: 'E-mail (optionnel)', type: 'email' },
    ], (valeurs) => {
      Etat.rdv = valeurs;
      ajouterMessage(`${valeurs.nom} — ${valeurs.telephone}`, 'user');
      ajouterMessage('Quel type de rendez-vous souhaitez-vous ?', 'bot');
      ajouterOptions(TYPES_RDV.map(t => ({ label: t, value: t })), (type) => {
        Etat.rdv.typeRdv = type;
        ajouterMessage('Quel créneau vous conviendrait ?', 'bot');
        ajouterOptions(CRENEAUX.map(c => ({ label: c, value: c })), (creneau) => {
          Etat.rdv.creneau = creneau;
          confirmerRdv();
        });
      });
    }, 'Continuer');
  }

  async function confirmerRdv() {
    ajouterMessage('Envoi de votre demande...', 'bot');
    try {
      const resp = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'chat_rdv', ...Etat.rdv }),
      });
      const data = await resp.json();
      ajouterMessage(data.message || 'Votre demande de RDV a été enregistrée.', 'bot');
    } catch (e) {
      ajouterMessage("Erreur de connexion. Vous pouvez aussi nous appeler au " + TEL_CONTACT + ".", 'bot');
    }
    Etat.mode = 'idle';
    proposerActionsPrincipales();
  }

  // ─── CAPTURE DE LEAD ("être rappelé") ──────────────────────
  function demarrerLead() {
    Etat.mode = 'lead';
    ajouterMessage("Laissez-nous vos coordonnées, un conseiller vous rappelle rapidement.", 'bot');
    afficherFormulaire([
      { key: 'nom', label: 'Nom complet', required: true },
      { key: 'telephone', label: 'Téléphone', type: 'tel', required: true },
      { key: 'email', label: 'E-mail (optionnel)', type: 'email' },
      { key: 'formation', label: 'Formation qui vous intéresse', type: 'select',
        options: Object.values(FORMATIONS).map(f => f.label).concat('Je ne sais pas encore') },
    ], async (valeurs) => {
      ajouterMessage(`${valeurs.nom} — ${valeurs.telephone}`, 'user');
      ajouterMessage('Envoi en cours...', 'bot');
      try {
        const resp = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'chat_lead', ...valeurs }),
        });
        const data = await resp.json();
        ajouterMessage(data.message || 'Merci ! Nous vous recontactons bientôt.', 'bot');
      } catch (e) {
        ajouterMessage("Erreur de connexion. Vous pouvez aussi nous appeler au " + TEL_CONTACT + ".", 'bot');
      }
      Etat.mode = 'idle';
      proposerActionsPrincipales();
    }, 'Envoyer');
  }

  // ─── SAISIE LIBRE ──────────────────────────────────────────
  function traiterSaisie(texte) {
    if (!texte.trim()) return;
    ajouterMessage(texte, 'user');
    elInput.value = '';
    if (Etat.mode === 'idle') {
      envoyerQuestionLibre(texte);
    }
  }

  // ─── OUVERTURE / FERMETURE ─────────────────────────────────
  function ouvrirPanel() {
    elPanel.classList.add('open');
    if (!elBody.children.length) demarrerConversation();
  }
  function fermerPanel() { elPanel.classList.remove('open'); }

  function demarrerConversation() {
    ajouterMessage("Bonjour et bienvenue chez LQD Service ! Comment puis-je vous aider ?", 'bot');
    proposerActionsPrincipales();
  }

  // ─── INIT ───────────────────────────────────────────────────
  function init() {
    injecterDOM();
    elLauncher = document.getElementById('pkc-launcher');
    elPanel    = document.getElementById('pkc-panel');
    elBody     = document.getElementById('pkc-body');
    elQuick    = document.getElementById('pkc-quick');
    elInput    = document.getElementById('pkc-input');
    elSend     = document.getElementById('pkc-send');

    elLauncher.addEventListener('click', () => {
      elPanel.classList.contains('open') ? fermerPanel() : ouvrirPanel();
    });
    document.getElementById('pkc-close').addEventListener('click', fermerPanel);
    elSend.addEventListener('click', () => traiterSaisie(elInput.value));
    elInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') traiterSaisie(elInput.value); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

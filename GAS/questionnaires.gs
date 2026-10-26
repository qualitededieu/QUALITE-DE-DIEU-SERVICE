// ================================================================
// QUESTIONNAIRES DES FORMATEURS (octobre 2026)
//
// Idée de la Direction : la fiche d'entrée ne suffit pas, les besoins
// changent au fil de la formation. Chaque formateur crée donc ses propres
// questionnaires (mi-parcours, fin de module, satisfaction...) :
// - éditeur de questions (choix unique / multiple, texte, note de 1 à 5),
//   3 modèles prêts à l'emploi ;
// - envoi direct à ses apprenants en formation, l'admin est informé par
//   email et peut suspendre un questionnaire ;
// - un questionnaire envoyé n'est plus modifiable (on le duplique) :
//   les réponses restent cohérentes avec les questions posées ;
// - option "Réponses anonymes" : personne (ni formateur, ni admin) ne voit
//   qui a répondu quoi. La participation est notée par une empreinte
//   (HMAC) triée, sans lien avec la ligne de réponse ; résultats visibles
//   à partir de 3 réponses seulement.
// Les questions sur la santé, l'argent, la famille... restent réservées
// à la fiche officielle : l'éditeur avertit, l'admin est alerté.
// ================================================================

const QUESTIONNAIRES = {
  FEUILLE:          'Questionnaires',
  FEUILLE_REPONSES: 'Réponses questionnaires',
  MAX_QUESTIONS:    40,
  MIN_ANONYMES:     3,         // seuil d'affichage des résultats anonymes
  RELANCE_HEURES:   24,
  MOMENTS:          ['Début de formation', 'Mi-parcours', 'Fin de module', 'Fin de formation', 'Après un stage', 'Autre moment']
};

// 0 ID | 1 Formateur (email) | 2 Nom formateur | 3 Titre | 4 Moment | 5 Filière (clé) |
// 6 Anonyme | 7 Questions (JSON) | 8 Statut | 9 Créé le | 10 Envoyé le |
// 11 Destinataires (JSON) | 12 Participations (empreintes triées) |
// 13 Dernière relance | 14 Alerte contenu | 15 Modifié le
const ENTETES_QUESTIONNAIRES = ['ID', 'Formateur', 'Nom formateur', 'Titre', 'Moment', 'Filière', 'Anonyme', 'Questions (JSON)',
  'Statut', 'Créé le', 'Envoyé le', 'Destinataires', 'Participations', 'Dernière relance', 'Alerte contenu', 'Modifié le'];
// Réponses : jamais de nom ni de dossier quand le questionnaire est anonyme,
// et seulement la DATE (pas l'heure) pour ne pas recouper avec la participation.
const ENTETES_REPONSES_Q = ['Questionnaire', 'Date', 'Dossier ID', 'Apprenant', 'Réponses (JSON)'];

/* ============================ MODÈLES ============================ */

const QUESTIONNAIRE_MODELES = [
  { id: 'mi-parcours', titre: 'Bilan de mi-parcours', moment: 'Mi-parcours', anonyme: false, schema: [
    { titre: 'Où en êtes-vous ?', questions: [
      { type: 'note', requis: true, label: 'Je comprends bien les cours depuis le début de la formation.' },
      { type: 'note', requis: true, label: 'Les exercices pratiques m’aident à progresser.' },
      { type: 'multiple', requis: true, autre: true, label: 'Sur quoi avez-vous encore besoin d’aide ?',
        options: ['Comprendre les explications', 'Faire les exercices pratiques', 'Utiliser les logiciels', 'Réviser et mémoriser', 'Préparer les évaluations', 'Rien de particulier'],
        exclusif: 'Rien de particulier' },
      { type: 'unique', requis: true, label: 'Le rythme de la formation vous convient-il ?', options: ['Trop lent', 'Adapté', 'Trop rapide'] },
      { type: 'texte', max: 800, label: 'Qu’est-ce qui vous aiderait à mieux réussir la suite de la formation ?' }
    ]}
  ]},
  { id: 'fin-formation', titre: 'Bilan de fin de formation', moment: 'Fin de formation', anonyme: false, schema: [
    { titre: 'Autoévaluation de fin de parcours', questions: [
      { type: 'unique', requis: true, label: 'Comment évaluez-vous votre niveau aujourd’hui ?', options: ['Débutant', 'Moyen', 'Bon', 'Très bon'] },
      { type: 'unique', requis: true, label: 'Comment évaluez-vous votre motivation ?', options: ['Faible', 'Moyenne', 'Bonne', 'Très bonne'] },
      { type: 'unique', requis: true, label: 'Avez-vous atteint vos objectifs de départ ?', options: ['Oui', 'En partie', 'Non'] },
      { type: 'texte', max: 800, label: 'Quelles compétences avez-vous le plus développées ?' }
    ]},
    { titre: 'Après la formation', questions: [
      { type: 'unique', requis: true, autre: true, label: 'Quel est votre projet maintenant ?',
        options: ['Trouver un emploi', 'Créer mon entreprise', 'Poursuivre une formation', 'Améliorer mon travail actuel'] },
      { type: 'unique', requis: true, label: 'Souhaitez-vous être accompagné(e) dans ce projet par le centre ?', options: ['Oui', 'Non', 'Je ne sais pas encore'] },
      { type: 'texte', max: 800, label: 'Un conseil pour améliorer la formation ?' }
    ]}
  ]},
  { id: 'satisfaction', titre: 'Satisfaction du module', moment: 'Fin de module', anonyme: true, schema: [
    { titre: 'Votre avis sur le module', questions: [
      { type: 'note', requis: true, label: 'Les explications du formateur étaient claires.' },
      { type: 'note', requis: true, label: 'Le contenu correspond à ce que j’attendais.' },
      { type: 'note', requis: true, label: 'Les supports de cours (documents, vidéos) sont utiles.' },
      { type: 'note', requis: true, label: 'Je me sens capable d’appliquer ce que j’ai appris.' },
      { type: 'texte', max: 800, label: 'Ce que vous avez le plus apprécié' },
      { type: 'texte', max: 800, label: 'Ce qu’il faudrait améliorer' }
    ]}
  ]}
];

function _modelesQuestionnaire() {
  return QUESTIONNAIRE_MODELES.map(m => {
    const v = _validerSchema(m.schema, { maxQuestions: QUESTIONNAIRES.MAX_QUESTIONS, premiereSection: 0 });
    return { id: m.id, titre: m.titre, moment: m.moment, anonyme: m.anonyme, schema: v.schema };
  });
}

/* ============================ LECTURE ============================ */

function _feuilleQuestionnaires() { return _feuilleFormation(QUESTIONNAIRES.FEUILLE, ENTETES_QUESTIONNAIRES); }
function _feuilleReponsesQ() { return _feuilleFormation(QUESTIONNAIRES.FEUILLE_REPONSES, ENTETES_REPONSES_Q); }

function _ligneVersQuestionnaire(r, i) {
  return {
    ligne: i + 1, id: String(r[0] || ''), formateur: String(r[1] || '').toLowerCase(), nomFormateur: String(r[2] || ''),
    titre: String(r[3] || ''), moment: String(r[4] || ''), filiere: String(r[5] || ''), anonyme: String(r[6] || '') === 'Oui',
    schema: _jsonTableau(r[7]), statut: String(r[8] || 'Brouillon'), creeLe: _isoDate(r[9]), envoyeLe: _isoDate(r[10]),
    destinataires: _jsonTableau(r[11]), participations: _jsonTableau(r[12]), derniereRelance: _isoDate(r[13]),
    alerte: String(r[14] || ''), modifieLe: _isoDate(r[15])
  };
}

function _lireQuestionnaires() {
  const f = _feuilleQuestionnaires();
  if (!f) return [];
  return f.getDataRange().getValues().map(_ligneVersQuestionnaire).slice(1).filter(x => x.id);
}

function _questionnaire(id) { return _lireQuestionnaires().filter(x => x.id === String(id || ''))[0] || null; }

function _lireReponsesQ(qid) {
  const f = _feuilleReponsesQ();
  if (!f) return [];
  return f.getDataRange().getValues().slice(1).filter(r => String(r[0]) === qid)
    .map(r => ({ date: _dateIso(r[1]), dossierId: String(r[2] || ''), apprenant: String(r[3] || ''), reponses: _jsonSur(r[4]) }));
}

function _ecrireQuestionnaire(q, valeurs) {
  const f = _feuilleQuestionnaires();
  Object.keys(valeurs).forEach(col => f.getRange(q.ligne, Number(col) + 1).setValue(valeurs[col]));
  f.getRange(q.ligne, 16).setValue(new Date());
}

// Empreinte de participation : prouve qu'un apprenant a répondu sans
// permettre de retrouver SA réponse (aucun lien avec la ligne de réponse).
function _empreinteParticipation(qid, dossierId) {
  return _b64(Utilities.computeHmacSha256Signature(qid + '|' + dossierId, _secretFormateur())).slice(0, 22);
}
function _aRepondu(q, dossierId) { return q.participations.indexOf(_empreinteParticipation(q.id, dossierId)) !== -1; }

function _resumeQuestionnaire(q) {
  return { id: q.id, titre: q.titre, moment: q.moment, filiere: q.filiere, filiereNom: q.filiere ? nomAffichagePublic(q.filiere) : '',
    anonyme: q.anonyme, statut: q.statut, creeLe: q.creeLe, envoyeLe: q.envoyeLe, nbDestinataires: q.destinataires.length,
    nbReponses: q.participations.length, nbQuestions: _questionsDe(q.schema).length, alerte: q.alerte,
    formateur: q.formateur, nomFormateur: q.nomFormateur, derniereRelance: q.derniereRelance };
}

/* ============================ RÉSULTATS ============================ */

function _resultatsQuestionnaire(q, avecNoms) {
  const reponses = _lireReponsesQ(q.id);
  const res = { nbReponses: q.participations.length, nbDestinataires: q.destinataires.length, anonyme: q.anonyme, questions: [] };
  if (q.anonyme && reponses.length < QUESTIONNAIRES.MIN_ANONYMES) {
    res.masque = true;
    res.message = 'Questionnaire anonyme : les résultats s\'affichent à partir de ' + QUESTIONNAIRES.MIN_ANONYMES + ' réponses, pour que personne ne puisse être reconnu.';
    return res;
  }
  _questionsDe(q.schema).forEach(x => {
    const item = { id: x.id, num: x.num || null, label: x.label, type: x.type, nbReponses: 0 };
    if (x.type === 'texte') {
      item.textes = reponses.map(r => r.reponses[x.id] && r.reponses[x.id].texte).filter(Boolean);
      if (q.anonyme) item.textes.sort();         // ordre neutre : pas de recoupement avec l'ordre d'arrivée
      item.nbReponses = item.textes.length;
    } else {
      const comptes = {}, autres = [];
      let somme = 0, n = 0;
      reponses.forEach(r => {
        const v = r.reponses[x.id];
        if (!v) return;
        item.nbReponses++;
        (Array.isArray(v.choix) ? v.choix : [v.choix]).forEach(c => { comptes[c] = (comptes[c] || 0) + 1; });
        if (v.autre) autres.push(v.autre);
        if (x.type === 'note') { somme += Number(v.choix); n++; }
      });
      item.options = x.options.concat(x.autre ? ['Autre'] : []).map(o => ({ libelle: o, nombre: comptes[o] || 0 }));
      if (autres.length) item.autres = q.anonyme ? autres.sort() : autres;
      if (x.type === 'note') item.moyenne = n ? Math.round(somme / n * 10) / 10 : null;
    }
    res.questions.push(item);
  });
  if (avecNoms && !q.anonyme) {
    res.individuelles = reponses.map(r => ({ dossierId: r.dossierId, apprenant: r.apprenant, date: r.date, reponses: r.reponses }));
    const ont = reponses.map(r => r.dossierId);
    const noms = {};
    _lignesInscriptions().forEach(r => { noms[String(r[0]).trim()] = (String(r[2] || '') + ' ' + String(r[3] || '')).trim(); });
    res.nonRepondants = q.destinataires.filter(id => ont.indexOf(id) === -1).map(id => noms[id] || id);
  }
  return res;
}

/* ============================ EMAILS ============================ */

function _emailsDossiers(ids) {
  const emails = [];
  _lignesInscriptions().forEach(r => {
    if (ids.indexOf(String(r[0]).trim()) === -1) return;
    const m = String(r[10] || '').trim().toLowerCase();
    if (_emailValide(m) && emails.indexOf(m) === -1) emails.push(m);
  });
  return emails;
}

function _emailQuestionnaire(emails, q, relance) {
  if (!emails.length || MailApp.getRemainingDailyQuota() < 1) return 0;
  const titre = (relance ? 'Rappel : ' : 'Nouveau questionnaire : ') + q.titre;
  const corps = `<p>Bonjour,</p>
<p>Votre formateur, <strong>${q.nomFormateur}</strong>, vous invite à répondre au questionnaire « <strong>${q.titre}</strong> » (${q.moment}).</p>
<p>${q.anonyme ? 'Vos réponses sont <strong>anonymes</strong> : personne ne saura qui a répondu quoi.' : 'Vos réponses aident votre formateur à adapter la suite de la formation.'} Quelques minutes suffisent.</p>
<p style="margin:18px 0 0;"><a href="${CONFIG.SITE_URL}/espace-apprenant" style="display:inline-block;background:${CONFIG.COULEUR_TEAL};color:#FFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Répondre</a></p>
<p style="font-size:13px;color:#6B7280;">Espace apprenant > onglet « Mes fiches ».</p>`;
  const opts = { htmlBody: _gabaritBesoins('Espace apprenant — LQD Service', titre, corps), name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL };
  if (emails.length === 1) GmailApp.sendEmail(emails[0], titre, corps.replace(/<[^>]+>/g, ' '), opts);
  else GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, titre, corps.replace(/<[^>]+>/g, ' '), Object.assign({ bcc: emails.join(',') }, opts));
  return emails.length;
}

// "Envoi direct, admin informé" : l'admin reçoit le contenu de chaque questionnaire envoyé.
function _informerAdminQuestionnaire(q) {
  const liste = _questionsDe(q.schema).map(x => `<li>${x.label}${x.options && x.type !== 'note' ? ' <span style="color:#6B7280;">(' + x.options.join(' / ') + ')</span>' : (x.type === 'note' ? ' <span style="color:#6B7280;">(note de 1 à 5)</span>' : '')}</li>`).join('');
  const alerte = q.alerte ? `<p style="background:#FEF6E7;border:1px solid #F5A623;border-radius:8px;padding:10px;"><strong>À vérifier :</strong> mots sensibles détectés (${q.alerte}). Ces sujets relèvent de la fiche officielle (partie confidentielle).</p>` : '';
  GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, 'Questionnaire envoyé par ' + q.nomFormateur + ' : ' + q.titre, 'Questionnaire envoyé. Admin > Fiches besoins > Questionnaires.', {
    htmlBody: _gabaritBesoins('Administration — LQD Service', 'Nouveau questionnaire envoyé',
      `<p><strong>${q.nomFormateur}</strong> a envoyé « <strong>${q.titre}</strong> » (${q.moment}) à <strong>${q.destinataires.length}</strong> apprenant(s) de ${nomAffichagePublic(q.filiere)}${q.anonyme ? ', en mode anonyme' : ''}.</p>${alerte}<ol>${liste}</ol><p>Vous pouvez le suspendre dans <strong>Admin > Fiches besoins > Questionnaires des formateurs</strong>.</p>`),
    name: CONFIG.EXPEDITEUR_NOM });
}

/* ========================= CÔTÉ FORMATEUR ========================= */

function _questionnaireDuFormateur(f, id) {
  const q = _questionnaire(id);
  return q && q.formateur === f.email ? q : null;
}

function _qIntrouvable() { return reponseJSON({ status: 'error', message: 'Questionnaire introuvable.' }); }

function formateurQLister(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  return reponseJSON({ status: 'success',
    questionnaires: _lireQuestionnaires().filter(q => q.formateur === f.email).map(_resumeQuestionnaire)
      .sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe))),
    modeles: _modelesQuestionnaire(), moments: QUESTIONNAIRES.MOMENTS });
}

function formateurQGet(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const q = _questionnaireDuFormateur(s.formateur, data.id);
  if (!q) return _qIntrouvable();
  return reponseJSON({ status: 'success', questionnaire: Object.assign(_resumeQuestionnaire(q), { schema: q.schema }) });
}

function _validerEnteteQuestionnaire(f, data) {
  const titre = _texteSchema(data.titre, 120);
  if (titre.length < 3) return { erreur: 'Donnez un titre au questionnaire.' };
  const moment = QUESTIONNAIRES.MOMENTS.indexOf(data.moment) !== -1 ? data.moment : '';
  if (!moment) return { erreur: 'Choisissez le moment du questionnaire.' };
  const filiere = cleFiliere(data.filiere || '');
  if (!filiere || f.filieres.indexOf(filiere) === -1) return { erreur: 'Choisissez une de vos filières.' };
  const v = _validerSchema(data.schema, { maxQuestions: QUESTIONNAIRES.MAX_QUESTIONS, premiereSection: 0 });
  if (v.erreur) return { erreur: v.erreur };
  return { titre: titre, moment: moment, filiere: filiere, anonyme: data.anonyme === true, schema: v.schema, alerte: _motsSensibles(v.schema).join(', ') };
}

function formateurQEnregistrer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  // Modification : d'abord vérifier que le questionnaire est encore un brouillon.
  const q = data.id ? _questionnaireDuFormateur(f, data.id) : null;
  if (data.id && !q) return _qIntrouvable();
  if (q && q.statut !== 'Brouillon') return reponseJSON({ status: 'error', message: 'Ce questionnaire a déjà été envoyé : dupliquez-le pour le modifier.' });
  const v = _validerEnteteQuestionnaire(f, data);
  if (v.erreur) return reponseJSON({ status: 'error', message: v.erreur });
  const valeurs = { 3: v.titre, 4: v.moment, 5: v.filiere, 6: v.anonyme ? 'Oui' : '', 7: JSON.stringify(v.schema), 14: v.alerte };
  if (q) {
    _ecrireQuestionnaire(q, valeurs);
    return reponseJSON({ status: 'success', id: q.id, alerte: v.alerte, message: 'Questionnaire enregistré.' });
  }
  const id = 'QF-' + Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  const maintenant = new Date();
  _ajouterLignes(_feuilleQuestionnaires(), [[id, f.email, f.prenom + ' ' + f.nom, v.titre, v.moment, v.filiere, v.anonyme ? 'Oui' : '',
    JSON.stringify(v.schema), 'Brouillon', maintenant, '', '[]', '[]', '', v.alerte, maintenant]]);
  return reponseJSON({ status: 'success', id: id, alerte: v.alerte, message: 'Questionnaire enregistré (brouillon).' });
}

function formateurQDupliquer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const q = _questionnaireDuFormateur(f, data.id);
  if (!q) return _qIntrouvable();
  const id = 'QF-' + Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  const maintenant = new Date();
  const filiere = f.filieres.indexOf(q.filiere) !== -1 ? q.filiere : f.filieres[0];
  _ajouterLignes(_feuilleQuestionnaires(), [[id, f.email, f.prenom + ' ' + f.nom, ('Copie de ' + q.titre).slice(0, 120), q.moment, filiere,
    q.anonyme ? 'Oui' : '', JSON.stringify(q.schema), 'Brouillon', maintenant, '', '[]', '[]', '', q.alerte, maintenant]]);
  return reponseJSON({ status: 'success', id: id, message: 'Copie créée : vous pouvez la modifier.' });
}

function formateurQSupprimer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const q = _questionnaireDuFormateur(s.formateur, data.id);
  if (!q) return _qIntrouvable();
  if (q.participations.length) return reponseJSON({ status: 'error', message: 'Des apprenants ont déjà répondu : clôturez-le plutôt que de le supprimer.' });
  _feuilleQuestionnaires().deleteRow(q.ligne);
  return reponseJSON({ status: 'success', message: 'Questionnaire supprimé.' });
}

function formateurQEnvoyer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const q = _questionnaireDuFormateur(f, data.id);
  if (!q) return _qIntrouvable();
  if (q.statut !== 'Brouillon') return reponseJSON({ status: 'error', message: 'Ce questionnaire a déjà été envoyé.' });
  // Destinataires : ses apprenants en formation (ou à venir) de la filière du questionnaire.
  const possibles = _apprenantsDuFormateur(f).filter(a => a.phase !== 'termine' && a.filieresCles.indexOf(q.filiere) !== -1).map(a => a.id);
  const voulus = Array.isArray(data.dossierIds) && data.dossierIds.length ? data.dossierIds.map(String) : possibles;
  const dest = possibles.filter(id => voulus.indexOf(id) !== -1);
  if (!dest.length) return reponseJSON({ status: 'error', message: 'Aucun apprenant en formation dans cette filière.' });
  if (q.anonyme && dest.length < QUESTIONNAIRES.MIN_ANONYMES) {
    return reponseJSON({ status: 'error', message: 'Un questionnaire anonyme doit être envoyé à au moins ' + QUESTIONNAIRES.MIN_ANONYMES + ' apprenants (sinon on devine qui a répondu).' });
  }
  _ecrireQuestionnaire(q, { 8: 'Envoyé', 10: new Date(), 11: JSON.stringify(dest) });
  q.destinataires = dest;
  let emails = 0;
  try { emails = _emailQuestionnaire(_emailsDossiers(dest), q, false); } catch (e) { console.error('[formateurQEnvoyer email]', e.toString()); }
  try { _informerAdminQuestionnaire(q); } catch (e) { console.error('[formateurQEnvoyer admin]', e.toString()); }
  const sansEmail = dest.length - emails;
  return reponseJSON({ status: 'success', message: 'Questionnaire envoyé à ' + dest.length + ' apprenant(s)'
    + (sansEmail > 0 ? ' — ' + sansEmail + ' sans email : prévenez-les en classe (il apparaît dans leur espace).' : '.') });
}

function formateurQRelancer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const q = _questionnaireDuFormateur(s.formateur, data.id);
  if (!q) return _qIntrouvable();
  if (q.statut !== 'Envoyé') return reponseJSON({ status: 'error', message: 'Seul un questionnaire en cours peut être relancé.' });
  if (q.derniereRelance && Date.now() - new Date(q.derniereRelance).getTime() < QUESTIONNAIRES.RELANCE_HEURES * 3600000) {
    return reponseJSON({ status: 'error', message: 'Une relance a déjà été envoyée il y a moins de 24 h.' });
  }
  // Relance aux seuls non-répondants (calculé ici, jamais montré si anonyme).
  const restants = q.destinataires.filter(id => !_aRepondu(q, id));
  if (!restants.length) return reponseJSON({ status: 'error', message: 'Tous les apprenants ont déjà répondu.' });
  const n = _emailQuestionnaire(_emailsDossiers(restants), q, true);
  _ecrireQuestionnaire(q, { 13: new Date() });
  return reponseJSON({ status: 'success', message: n ? 'Relance envoyée à ' + n + ' apprenant(s).' : 'Aucun email disponible : prévenez-les en classe.' });
}

function formateurQClore(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const q = _questionnaireDuFormateur(s.formateur, data.id);
  if (!q) return _qIntrouvable();
  if (q.statut !== 'Envoyé') return reponseJSON({ status: 'error', message: 'Ce questionnaire n\'est pas en cours.' });
  _ecrireQuestionnaire(q, { 8: 'Clos' });
  return reponseJSON({ status: 'success', message: 'Questionnaire clôturé : plus aucune réponse acceptée.' });
}

function formateurQResultats(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const q = _questionnaireDuFormateur(s.formateur, data.id);
  if (!q) return _qIntrouvable();
  return reponseJSON({ status: 'success', questionnaire: Object.assign(_resumeQuestionnaire(q), { schema: q.schema }),
    resultats: _resultatsQuestionnaire(q, true) });
}

/* ========================= CÔTÉ APPRENANT ========================= */

function _questionnairesDeLApprenant(id) {
  return _lireQuestionnaires().filter(q => (q.statut === 'Envoyé' || q.statut === 'Clos') && q.destinataires.indexOf(id) !== -1);
}

function questionnairesMes(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const id = session.apprenant.id;
  const liste = _questionnairesDeLApprenant(id).map(q => {
    const fait = _aRepondu(q, id);
    return { id: q.id, titre: q.titre, moment: q.moment, formateur: q.nomFormateur, anonyme: q.anonyme, envoyeLe: q.envoyeLe,
      nbQuestions: _questionsDe(q.schema).length, etat: fait ? 'Répondu' : (q.statut === 'Clos' ? 'Clos' : 'À remplir') };
  }).sort((a, b) => String(b.envoyeLe).localeCompare(String(a.envoyeLe)));
  return reponseJSON({ status: 'success', questionnaires: liste });
}

function questionnaireGet(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const q = _questionnairesDeLApprenant(session.apprenant.id).filter(x => x.id === String(data.id || ''))[0];
  if (!q) return _qIntrouvable();
  if (q.statut !== 'Envoyé') return reponseJSON({ status: 'error', message: 'Ce questionnaire est clôturé.' });
  if (_aRepondu(q, session.apprenant.id)) return reponseJSON({ status: 'error', message: 'Vous avez déjà répondu à ce questionnaire. Merci !' });
  return reponseJSON({ status: 'success', questionnaire: { id: q.id, titre: q.titre, moment: q.moment, formateur: q.nomFormateur, anonyme: q.anonyme, schema: q.schema } });
}

function questionnaireRepondre(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const a = session.apprenant;
  // Verrou : deux réponses simultanées ne doivent pas écraser la liste des participations.
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const q = _questionnairesDeLApprenant(a.id).filter(x => x.id === String(data.id || ''))[0];
    if (!q) return _qIntrouvable();
    if (q.statut !== 'Envoyé') return reponseJSON({ status: 'error', message: 'Ce questionnaire est clôturé.' });
    if (_aRepondu(q, a.id)) return reponseJSON({ status: 'error', message: 'Vous avez déjà répondu à ce questionnaire.' });
    const n = _normaliserReponses(data.reponses, q.schema);
    if (n.manquants.length) return reponseJSON({ status: 'error', message: 'Il manque des réponses : ' + n.manquants.join(', ') + '.', manquants: n.manquants });
    const jour = Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd');
    _ajouterLignes(_feuilleReponsesQ(), [[q.id, jour, q.anonyme ? '' : a.id, q.anonyme ? '' : (a.prenom + ' ' + a.nom).trim(), JSON.stringify(n.reponses)]]);
    const participations = q.participations.concat([_empreinteParticipation(q.id, a.id)]).sort();
    _ecrireQuestionnaire(q, { 12: JSON.stringify(participations) });
    return reponseJSON({ status: 'success', message: 'Merci ! Vos réponses ont bien été envoyées.' });
  } finally {
    verrou.releaseLock();
  }
}

/* =========================== CÔTÉ ADMIN =========================== */

function adminQLister(data, email) {
  return reponseJSON({ status: 'success', questionnaires: _lireQuestionnaires().filter(q => q.statut !== 'Brouillon')
    .map(_resumeQuestionnaire).sort((a, b) => String(b.envoyeLe).localeCompare(String(a.envoyeLe))) });
}

// Même anonymat que pour le formateur : l'admin ne voit pas non plus qui a répondu quoi.
function adminQResultats(data, email) {
  const q = _questionnaire(data.id);
  if (!q) return _qIntrouvable();
  return reponseJSON({ status: 'success', questionnaire: Object.assign(_resumeQuestionnaire(q), { schema: q.schema }),
    resultats: _resultatsQuestionnaire(q, true) });
}

function adminQSuspendre(data, email) {
  const q = _questionnaire(data.id);
  if (!q) return _qIntrouvable();
  if (data.suspendre === true) {
    if (q.statut !== 'Envoyé' && q.statut !== 'Clos') return reponseJSON({ status: 'error', message: 'Seul un questionnaire envoyé peut être suspendu.' });
    _ecrireQuestionnaire(q, { 8: 'Suspendu' });
    try {
      _emailFormateur(q.formateur, 'Questionnaire suspendu : ' + q.titre, 'Votre questionnaire a été suspendu',
        `<p>L'administration a suspendu votre questionnaire « <strong>${q.titre}</strong> ». Les apprenants ne le voient plus.</p><p>Rapprochez-vous de la direction pour en connaître la raison.</p>`);
    } catch (e) { console.error('[adminQSuspendre email]', e.toString()); }
    return reponseJSON({ status: 'success', message: 'Questionnaire suspendu : les apprenants ne le voient plus, le formateur est prévenu.' });
  }
  if (q.statut !== 'Suspendu') return reponseJSON({ status: 'error', message: 'Ce questionnaire n\'est pas suspendu.' });
  _ecrireQuestionnaire(q, { 8: 'Envoyé' });
  return reponseJSON({ status: 'success', message: 'Questionnaire réactivé.' });
}

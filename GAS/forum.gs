// ================================================================
// FORUM DE QUESTIONS — Espace apprenant
// Ajouté le 25/09/2026. Un apprenant pose une question liée à sa
// filière ; le Formateur/PDG y répond depuis l'admin. La question
// n'est visible des AUTRES apprenants de la même filière qu'une fois
// répondue (modération implicite) — l'auteur voit toujours sa propre
// question, même en attente, pour suivre son statut.
//
// Authentification apprenant : _sessionApprenant() (cours.gs) — jeton
// signé, durée 8 h, dossier vérifié en direct.
//
// Octobre 2026 :
//  - CORRECTIF : nettoyer() coupait questions ET réponses à 500
//    caractères sans prévenir. Limites désormais explicites : 1 000
//    pour une question, 3 000 pour une réponse, avec message d'erreur.
//  - L'apprenant est prévenu par email quand le Formateur répond ;
//    l'admin dispose aussi d'un lien WhatsApp prêt à envoyer.
// ================================================================

const FORUM = { QUESTION_MAX: 1000, REPONSE_MAX: 3000 };

// Balises neutralisées (comme avant), sans coupure silencieuse.
function _texteForum(str) {
  return String(str || '').replace(/\r\n/g, '\n').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Contact de l'apprenant (email, téléphone, prénom) depuis son dossier.
function _contactsApprenants() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  const contacts = {};
  if (!feuille) return contacts;
  feuille.getDataRange().getValues().slice(1).forEach(r => {
    const id = String(r[0] || '').trim();
    if (id) contacts[id] = { prenom: String(r[2] || ''), telephone: String(r[9] || ''), email: String(r[10] || '').trim() };
  });
  return contacts;
}

const ENTETES_FORUM = [
  'ID',
  'ID dossier',
  'Nom',
  'Filière',
  'Question',
  'Date question',
  'Réponse',
  'Date réponse',
  'Répondu par',
  'Statut'          // en_attente / repondu
];

function _getOrCreateFeuilleForum() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName('Forum');
  if (!feuille) {
    feuille = ss.insertSheet('Forum');
    feuille.appendRow(ENTETES_FORUM);
    feuille.setFrozenRows(1);
  }
  return feuille;
}

function _ligneForumVersObjet(row) {
  return {
    id:           String(row[0] || ''),
    dossierId:    String(row[1] || ''),
    nom:          String(row[2] || ''),
    filiere:      String(row[3] || ''),
    question:     String(row[4] || ''),
    dateQuestion: row[5] instanceof Date ? row[5].toISOString() : String(row[5] || ''),
    reponse:      String(row[6] || ''),
    dateReponse:  row[7] instanceof Date ? row[7].toISOString() : String(row[7] || ''),
    reponduPar:   String(row[8] || ''),
    statut:       String(row[9] || 'en_attente')
  };
}

// ---------------- Public (apprenant) ----------------

function forumPosterQuestion(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const payload = session.apprenant;

  const question = _texteForum(data.question);
  if (!question) return reponseJSON({ status: 'error', message: 'Veuillez rédiger votre question.' });
  if (question.length < 10) return reponseJSON({ status: 'error', message: 'Question trop courte — précisez votre préoccupation.' });
  if (question.length > FORUM.QUESTION_MAX) return reponseJSON({ status: 'error', message: 'Question trop longue (' + FORUM.QUESTION_MAX + ' caractères maximum).' });

  const feuille = _getOrCreateFeuilleForum();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const id = genererID('FORUM');
  feuille.appendRow([
    id,
    payload.id,
    `${payload.prenom} ${payload.nom}`.trim(),
    payload.filiere,
    question,
    new Date(),
    '',
    '',
    '',
    'en_attente'
  ]);

  return reponseJSON({ status: 'success', id });
}

// Renvoie : les questions RÉPONDUES de la/les filière(s) de l'apprenant
// (visibles par tous, pédagogie partagée), PLUS ses propres questions
// à lui même si encore en attente.
function forumLister(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const payload = session.apprenant;

  const feuille = _getOrCreateFeuilleForum();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  // Comparaison par clé technique : les questions anciennes portent les
  // noms affichés de l'époque (voir cleFiliere / clesFilieres, code.gs).
  const mesCles = clesFilieres(payload.filiere);
  const donnees = feuille.getDataRange().getValues();
  const questions = [];
  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;
    const obj = _ligneForumVersObjet(row);
    const estMoi = obj.dossierId === payload.id;
    const memeFiliere = clesFilieres(obj.filiere).some(c => mesCles.indexOf(c) !== -1);
    if (!estMoi && !(memeFiliere && obj.statut === 'repondu')) continue;
    questions.push(obj);
  }
  questions.reverse();
  return reponseJSON({ status: 'success', questions });
}

// ---------------- Admin ----------------

function adminForumLister(data, email) {
  const feuille = _getOrCreateFeuilleForum();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  const contacts = _contactsApprenants();
  const questions = [];
  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;
    const q = _ligneForumVersObjet(row);
    q.telephone = (contacts[q.dossierId] || {}).telephone || '';   // pour le lien WhatsApp de l'admin
    questions.push(q);
  }
  // En attente d'abord, plus récent en premier dans chaque groupe.
  questions.sort((a, b) => {
    if (a.statut !== b.statut) return a.statut === 'en_attente' ? -1 : 1;
    return new Date(b.dateQuestion) - new Date(a.dateQuestion);
  });
  return reponseJSON({ status: 'success', questions });
}

function adminForumRepondre(data, email) {
  const id      = String(data.id || '').trim();
  const reponse = _texteForum(data.reponse);
  if (!id || !reponse) return reponseJSON({ status: 'error', message: 'Réponse vide.' });
  if (reponse.length > FORUM.REPONSE_MAX) return reponseJSON({ status: 'error', message: 'Réponse trop longue (' + FORUM.REPONSE_MAX + ' caractères maximum) : découpez-la ou joignez un support de cours.' });

  const feuille = _getOrCreateFeuilleForum();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      const ligne = i + 1;
      feuille.getRange(ligne, 7, 1, 4).setValues([[reponse, new Date(), email, 'repondu']]);
      console.log('[Forum] Répondu par', email, ':', id);

      // Prévenir l'apprenant par email (sans bloquer la réponse en cas d'échec).
      const contact = _contactsApprenants()[String(donnees[i][1]).trim()] || {};
      let emailEnvoye = false;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || '') && MailApp.getRemainingDailyQuota() > 0) {
        try {
          const corps = '<p style="margin:0 0 14px;">Le Formateur a répondu à votre question :</p>'
            + '<p style="margin:0 0 14px;padding:12px 14px;background:#F3F4F6;border-radius:8px;white-space:pre-line;">' + String(donnees[i][4]) + '</p>'
            + '<p style="margin:0 0 14px;white-space:pre-line;">' + reponse + '</p>'
            + '<p style="margin:18px 0 0;"><a href="' + CONFIG.SITE_URL + '/espace-apprenant" style="display:inline-block;background:' + CONFIG.COULEUR_TEAL + ';color:#FFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Voir dans mon espace apprenant</a></p>';
          GmailApp.sendEmail(contact.email, 'Réponse du Formateur à votre question', 'Le Formateur a répondu à votre question. Consultez votre espace apprenant : ' + CONFIG.SITE_URL + '/espace-apprenant', {
            htmlBody: construireEmailReponseAdmin('Question', contact.prenom || 'cher apprenant', 'Réponse du Formateur', corps, String(donnees[i][1])),
            name: CONFIG.EXPEDITEUR_NOM,
            replyTo: CONFIG.ADMIN_EMAIL
          });
          emailEnvoye = true;
        } catch (e) { console.error('[Forum] email', e.toString()); }
      }
      return reponseJSON({ status: 'success', emailEnvoye: emailEnvoye, telephone: contact.telephone || '', prenom: contact.prenom || '' });
    }
  }
  return reponseJSON({ status: 'error', message: 'Question introuvable.' });
}

function adminForumSupprimer(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _getOrCreateFeuilleForum();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      feuille.deleteRow(i + 1);
      console.log('[Forum] Supprimé par', email, ':', id);
      return reponseJSON({ status: 'success' });
    }
  }
  return reponseJSON({ status: 'error', message: 'Question introuvable.' });
}

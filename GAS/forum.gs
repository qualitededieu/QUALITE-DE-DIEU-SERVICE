// ================================================================
// FORUM DE QUESTIONS — Espace apprenant
// Ajouté le 25/09/2026. Un apprenant pose une question liée à sa
// filière ; le Formateur/PDG y répond depuis l'admin. La question
// n'est visible des AUTRES apprenants de la même filière qu'une fois
// répondue (modération implicite) — l'auteur voit toujours sa propre
// question, même en attente, pour suivre son statut.
//
// Authentification apprenant : token émis par getCarte() (carte.gs),
// comme pour cours.gs.
// ================================================================

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
  const payload = _verifierTokenCarte(String(data.token || ''));
  if (!payload) return reponseJSON({ status: 'error', message: 'Session expirée — veuillez vous reconnecter à votre espace apprenant.' });

  const question = nettoyer(data.question || '');
  if (!question) return reponseJSON({ status: 'error', message: 'Veuillez rédiger votre question.' });
  if (question.length < 10) return reponseJSON({ status: 'error', message: 'Question trop courte — précisez votre préoccupation.' });

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
  const payload = _verifierTokenCarte(String(data.token || ''));
  if (!payload) return reponseJSON({ status: 'error', message: 'Session expirée — veuillez vous reconnecter à votre espace apprenant.' });

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
  const questions = [];
  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;
    questions.push(_ligneForumVersObjet(row));
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
  const reponse = nettoyer(data.reponse || '');
  if (!id || !reponse) return reponseJSON({ status: 'error', message: 'Réponse vide.' });

  const feuille = _getOrCreateFeuilleForum();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      const ligne = i + 1;
      feuille.getRange(ligne, 7, 1, 4).setValues([[reponse, new Date(), email, 'repondu']]);
      console.log('[Forum] Répondu par', email, ':', id);
      return reponseJSON({ status: 'success' });
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

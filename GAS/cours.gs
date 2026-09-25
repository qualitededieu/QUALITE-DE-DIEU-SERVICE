// ================================================================
// SUPPORTS DE COURS — Espace apprenant
// Ajouté le 25/09/2026. Portée volontairement limitée à la
// CONSULTATION de supports (PDF/vidéo/lien) déposés par l'admin,
// filtrés par filière de l'apprenant connecté — pas une réplique
// d'AcademyPhanos (pas d'exercices notés, pas de suivi de
// progression). Voir échange du 25/09/2026 avec le PDG/Formateur.
//
// Authentification : le token émis par getCarte() (carte.gs) sert de
// preuve d'identité pour toutes les actions "apprenant" ci-dessous —
// on évite ainsi de redemander le téléphone à chaque appel.
// ================================================================

const ENTETES_COURS = [
  'ID',
  'Filière',
  'Titre',
  'Type',        // PDF / Vidéo / Lien
  'URL',
  'Description',
  'Date ajout'
];

function _getOrCreateFeuilleCours() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName('Cours');
  if (!feuille) {
    feuille = ss.insertSheet('Cours');
    feuille.appendRow(ENTETES_COURS);
    feuille.setFrozenRows(1);
  }
  return feuille;
}

function _filieresApprenant(filiereAffichee) {
  return String(filiereAffichee || '').split(' | ').map(f => f.trim()).filter(Boolean);
}

// ---------------- Public (apprenant) ----------------

function coursListerApprenant(data) {
  const payload = _verifierTokenCarte(String(data.token || ''));
  if (!payload) return reponseJSON({ status: 'error', message: 'Session expirée — veuillez vous reconnecter à votre espace apprenant.' });

  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const mesFilieres = _filieresApprenant(payload.filiere);
  const donnees = feuille.getDataRange().getValues();
  const cours = [];
  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;
    const filiereCours = String(row[1] || '').trim();
    // 'Tous' = support commun visible par toutes les filières (ex.
    // rappel de sécurité informatique, guide d'utilisation du centre).
    if (filiereCours !== 'Tous' && mesFilieres.indexOf(filiereCours) === -1) continue;

    cours.push({
      id:          String(row[0]),
      filiere:     filiereCours,
      titre:       String(row[2] || ''),
      type:        String(row[3] || ''),
      url:         String(row[4] || ''),
      description: String(row[5] || ''),
      dateAjout:   row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '')
    });
  }
  // Plus récent en premier.
  cours.reverse();
  return reponseJSON({ status: 'success', cours });
}

// ---------------- Admin ----------------

function adminCoursLister(data, email) {
  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  const cours = [];
  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;
    cours.push({
      id:          String(row[0]),
      filiere:     String(row[1] || ''),
      titre:       String(row[2] || ''),
      type:        String(row[3] || ''),
      url:         String(row[4] || ''),
      description: String(row[5] || ''),
      dateAjout:   row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '')
    });
  }
  cours.reverse();
  return reponseJSON({ status: 'success', cours });
}

function adminCoursAjouter(data, email) {
  const filiere = nettoyer(data.filiere || '');
  const titre   = nettoyer(data.titre   || '');
  const url     = String(data.url || '').trim();
  const type    = nettoyer(data.type || 'Lien');
  const description = nettoyer(data.description || '');

  if (!filiere || !titre || !url) {
    return reponseJSON({ status: 'error', message: 'Filière, titre et lien sont obligatoires.' });
  }

  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const id = genererID('COURS');
  feuille.appendRow([id, filiere, titre, type, url, description, new Date()]);

  console.log('[Cours] Ajouté par', email, ':', id, titre);
  return reponseJSON({ status: 'success', id });
}

function adminCoursSupprimer(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      feuille.deleteRow(i + 1);
      console.log('[Cours] Supprimé par', email, ':', id);
      return reponseJSON({ status: 'success' });
    }
  }
  return reponseJSON({ status: 'error', message: 'Support introuvable.' });
}

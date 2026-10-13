// ================================================================
// SUIVI DES APPRENANTS — journal des téléchargements + vue paiement
// Ajouté le 25/09/2026 à la demande du PDG : savoir qui a téléchargé
// quoi, quand, depuis où (pays/ville via IP, jamais de GPS — voir
// note plus bas), et qui n'a pas encore payé les 3000 F "Initiation
// rapide (1 mois)".
//
// Choix technique important : un Web App Google Apps Script ne reçoit
// JAMAIS l'adresse IP de l'appelant (Google la masque volontairement,
// contrairement à un serveur classique). La localisation est donc
// résolue côté NAVIGATEUR (index.html interroge un service gratuit de
// géolocalisation par IP) puis transmise au backend avec la requête de
// téléchargement — jamais calculée ici.
// ================================================================

const ENTETES_TELECHARGEMENTS = [
  'Date/Heure',
  'ID dossier',
  'Nom complet',
  'Filière',
  'Type document',
  'Pays',
  'Ville',
  'Statut paiement attestation'
];

function _getOrCreateFeuilleTelechargements() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName('Téléchargements');
  if (!feuille) {
    feuille = ss.insertSheet('Téléchargements');
    feuille.appendRow(ENTETES_TELECHARGEMENTS);
    feuille.setFrozenRows(1);
  }
  return feuille;
}

// Libellé de statut paiement à figer dans le journal AU MOMENT du
// téléchargement (pas recalculé après coup) — donne à l'admin une
// photo fidèle de la situation telle qu'elle était ce jour-là.
function _libelleStatutPaiementAttestation(row) {
  const filiere = String(row[22] || '');
  if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) {
    return 'Formation longue — sans frais';
  }
  const restants = Number(row[46]) || 0;
  return restants > 0 ? `Payé (${restants} restants)` : 'Non payé';
}

// Appelée depuis carte.gs::enregistrerTelechargement pour CHAQUE type
// de document (carte, attestation, fiche, badge) — contrairement au
// compteur de quota qui, lui, ne concerne que l'attestation. On veut
// voir tous les mouvements dans ce journal, pas seulement les payants.
function _journaliserTelechargement(id, type, geo) {
  try {
    const trouve = _trouverLigneInscription(id);
    if (!trouve) return;

    const feuille = _getOrCreateFeuilleTelechargements();
    if (!feuille) return;

    const nomComplet = `${String(trouve.row[2] || '').trim()} ${String(trouve.row[3] || '').trim()}`.trim();
    const filiere    = String(trouve.row[22] || '').split(' | ').map(f => nomAffichagePublic(f.trim())).join(' | ');
    const pays       = nettoyer((geo && geo.pays)  || '—');
    const ville      = nettoyer((geo && geo.ville) || '—');

    feuille.appendRow([
      new Date(),
      id,
      nomComplet,
      filiere,
      type,
      pays,
      ville,
      _libelleStatutPaiementAttestation(trouve.row)
    ]);
  } catch (err) {
    // Un échec de journalisation ne doit jamais bloquer un
    // téléchargement déjà autorisé — on logge et on continue.
    console.error('[Suivi] Échec journalisation téléchargement :', err);
  }
}

// Vue admin : le journal (le plus récent en premier) + la liste des
// apprenants "Initiation rapide (1 mois)" actuellement à 0 téléchargement
// restant (donc bloqués tant qu'ils n'ont pas payé), qu'ils aient ou non
// déjà tenté un téléchargement — utile pour relancer proactivement.
function adminGetSuiviTelechargements(data, email) {
  try {
    const feuille = _getOrCreateFeuilleTelechargements();
    if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

    const donnees = feuille.getDataRange().getValues();
    const journal = [];
    for (let i = donnees.length - 1; i >= 1; i--) {
      const row = donnees[i];
      if (!row[1]) continue;
      journal.push({
        date:           row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
        id:             String(row[1] || ''),
        nom:            String(row[2] || ''),
        filiere:        String(row[3] || ''),
        type:           String(row[4] || ''),
        pays:           String(row[5] || ''),
        ville:          String(row[6] || ''),
        statutPaiement: String(row[7] || '')
      });
      if (journal.length >= 500) break; // garde-fou taille de réponse
    }

    const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
    const feuilleMaitre = ss ? ss.getSheetByName('Toutes les inscriptions') : null;
    const enAttentePaiement = [];
    if (feuilleMaitre) {
      const inscriptions = feuilleMaitre.getDataRange().getValues();
      for (let i = 1; i < inscriptions.length; i++) {
        const row = inscriptions[i];
        if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;
        const filiere = String(row[22] || '');
        if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) continue;
        const restants = Number(row[46]) || 0;
        if (restants > 0) continue;
        enAttentePaiement.push({
          id:        String(row[0]  || ''),
          nom:       `${String(row[2] || '').trim()} ${String(row[3] || '').trim()}`.trim(),
          telephone: String(row[9]  || ''),
          statut:    String(row[28] || '')
        });
      }
    }

    return reponseJSON({ status: 'success', journal, enAttentePaiement });
  } catch (err) {
    console.error('[adminGetSuiviTelechargements]', err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  }
}

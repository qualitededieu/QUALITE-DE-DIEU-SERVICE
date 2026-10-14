/* =====================================================================
   TÉMOIGNAGES D'APPRENANTS (octobre 2026)

   Principe demandé par le PDG : seul un VRAI apprenant du centre peut
   laisser un témoignage. À l'envoi, on vérifie le numéro de dossier ET
   le téléphone (même contrôle que la connexion à l'espace apprenant :
   dossier confirmé, migré ou terminé). Le nom et la filière affichés
   viennent du dossier, jamais de la saisie : impossible de témoigner
   sous un autre nom.

   - Un seul témoignage par dossier : un nouvel envoi remplace l'ancien.
   - Publication immédiate après vérification (TEMOIGNAGES.MODERATION =
     false). Passer à true pour exiger une validation dans l'admin.
   - L'admin peut masquer, republier ou supprimer à tout moment.
===================================================================== */

const TEMOIGNAGES = {
  MODERATION:  false,
  TEXTE_MIN:   30,
  TEXTE_MAX:   600,
  PHOTO_MAX_B64: 400000,          // ~300 Ko : la photo arrive déjà recadrée/compressée par le navigateur
  ENVOIS_MAX_PAR_HEURE: 5,        // tentatives par dossier et par heure (réussies ou non) : anti-abus
  NOM_FEUILLE: 'Témoignages',
  NOM_DOSSIER_DRIVE: 'Témoignages — LQD Service'
};

const ENTETES_TEMOIGNAGES = [
  'ID', 'Date', 'Dossier ID', 'Nom affiché', 'Filière', 'Note', 'Texte',
  'Photo URL', 'Photo ID', 'Statut'
];
const STATUTS_TEMOIGNAGE = ['Publié', 'Masqué', 'En attente'];

function _feuilleTemoignages() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName(TEMOIGNAGES.NOM_FEUILLE);
  // Une ancienne version du module a pu créer un onglet "Témoignages" avec
  // d'autres colonnes : on le renomme (rien n'est supprimé) et on repart
  // sur un onglet propre, sinon les colonnes seraient lues de travers.
  if (feuille && feuille.getLastColumn() > 0) {
    const entetes = feuille.getRange(1, 1, 1, Math.max(feuille.getLastColumn(), ENTETES_TEMOIGNAGES.length)).getValues()[0];
    const conforme = ENTETES_TEMOIGNAGES.every((h, i) => String(entetes[i]).trim() === h);
    if (!conforme) {
      feuille.setName(TEMOIGNAGES.NOM_FEUILLE + ' (ancienne version ' + Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd HHmm') + ')');
      feuille = null;
    }
  }
  if (feuille && feuille.getLastRow() === 0) feuille.appendRow(ENTETES_TEMOIGNAGES);
  if (!feuille) {
    feuille = ss.insertSheet(TEMOIGNAGES.NOM_FEUILLE);
    feuille.appendRow(ENTETES_TEMOIGNAGES);
    feuille.getRange(1, 1, 1, ENTETES_TEMOIGNAGES.length)
      .setBackground(CONFIG.COULEUR_DARK).setFontColor('#FFFFFF').setFontWeight('bold');
    feuille.setFrozenRows(1);
  }
  return feuille;
}

function _ligneVersTemoignage(row) {
  return {
    id:       String(row[0] || ''),
    date:     row[1] instanceof Date ? row[1].toISOString() : String(row[1] || ''),
    dossierId: String(row[2] || ''),
    nom:      String(row[3] || ''),
    filiere:  String(row[4] || ''),
    note:     Math.max(1, Math.min(5, Number(row[5]) || 5)),
    texte:    String(row[6] || ''),
    photo:    String(row[7] || ''),
    photoId:  String(row[8] || ''),
    statut:   STATUTS_TEMOIGNAGE.indexOf(row[9]) !== -1 ? row[9] : 'En attente'
  };
}

// Version publique : sans numéro de dossier ni identifiant Drive.
function _temoignagePublic(t) {
  return { id: t.id, date: t.date, nom: t.nom, filiere: t.filiere, note: t.note, texte: t.texte, photo: t.photo };
}

// "Marie AGBOSSOU" -> "Marie A." : on ne publie jamais le nom complet.
function _nomPublicTemoignage(prenom, nom) {
  const p = String(prenom || '').trim().split(/\s+/)[0] || '';
  const premierePrenom = p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
  const initiale = String(nom || '').trim().charAt(0).toUpperCase();
  return (premierePrenom + (initiale ? ' ' + initiale + '.' : '')).trim() || 'Apprenant(e)';
}

// Même vérification que l'espace apprenant (getCarte, carte.gs).
function _verifierApprenantTemoignage(id, telephone) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return { erreur: 'Erreur serveur.' };
  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return { erreur: 'Erreur serveur.' };

  let idTrouve = false;
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (String(row[0] || '').trim() !== id || id === 'LQD-EXEMPLE') continue;
    idTrouve = true;
    const telRow = String(row[9] || '').trim();
    if (!telRow || !_telephonesEquivalents(telRow, telephone)) continue;
    const statut = String(row[28] || '').trim();
    if (statut !== 'Confirmé' && statut !== 'Migré' && statut !== 'Terminé') {
      return { erreur: 'Votre dossier n\'est pas encore confirmé : vous pourrez témoigner dès sa validation par le centre.' };
    }
    return { apprenant: _mapperApprenantInscription(row) };
  }
  return { erreur: idTrouve
    ? 'Numéro de dossier reconnu, mais le téléphone ne correspond pas.'
    : 'Numéro de dossier introuvable. Seuls les apprenants du centre peuvent laisser un témoignage.' };
}

function _enregistrerPhotoTemoignage(base64, mimeType, dossierId) {
  let racine = trouverDossierDrive(TEMOIGNAGES.NOM_DOSSIER_DRIVE);
  if (!racine) racine = DriveApp.createFolder(TEMOIGNAGES.NOM_DOSSIER_DRIVE);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, 'temoignage-' + dossierId + '-' + Date.now() + '.jpg');
  const fichier = racine.createFile(blob);
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = fichier.getId();
  return { url: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400', fileId: fileId };
}

function _supprimerFichierDrive(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* déjà supprimé : sans gravité */ }
}

/* --------------------------- PUBLIC --------------------------- */

function temoignagesLister(data) {
  const feuille = _feuilleTemoignages();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const tous = feuille.getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(_ligneVersTemoignage)
    .filter(t => t.statut === 'Publié');
  tous.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const moyenne = tous.length ? Math.round(tous.reduce((s, t) => s + t.note, 0) / tous.length * 10) / 10 : 0;
  const limite = Math.max(0, Math.min(100, Number(data && data.limite) || 100));
  return reponseJSON({
    status: 'success',
    temoignages: tous.slice(0, limite).map(_temoignagePublic),
    total: tous.length,
    moyenne: moyenne
  });
}

function temoignageDeposer(data) {
  const id        = String(data.id || '').trim().toUpperCase();
  const telephone = String(data.telephone || '').trim();
  const texte     = String(data.texte || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const note      = Math.round(Number(data.note));

  // Validation des champs — même règles que dans le formulaire.
  if (!id || !telephone) return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  if (data.consentement !== true) return reponseJSON({ status: 'error', message: 'Merci d\'accepter la publication de votre témoignage.' });
  if (!(note >= 1 && note <= 5)) return reponseJSON({ status: 'error', message: 'Choisissez une note de 1 à 5 étoiles.' });
  if (texte.length < TEMOIGNAGES.TEXTE_MIN) return reponseJSON({ status: 'error', message: 'Votre témoignage est trop court (' + TEMOIGNAGES.TEXTE_MIN + ' caractères minimum).' });
  if (texte.length > TEMOIGNAGES.TEXTE_MAX) return reponseJSON({ status: 'error', message: 'Votre témoignage est trop long (' + TEMOIGNAGES.TEXTE_MAX + ' caractères maximum).' });

  let photoB64 = '';
  let photoMime = '';
  if (data.photoBase64) {
    photoB64  = String(data.photoBase64);
    photoMime = String(data.photoMimeType || 'image/jpeg');
    if (['image/jpeg', 'image/png'].indexOf(photoMime) === -1) return reponseJSON({ status: 'error', message: 'Format de photo non accepté (JPG ou PNG).' });
    if (photoB64.length > TEMOIGNAGES.PHOTO_MAX_B64) return reponseJSON({ status: 'error', message: 'Photo trop lourde.' });
  }

  // Anti-abus : nombre de tentatives limité par dossier et par heure.
  // Compté AVANT la vérification, échecs compris : empêche d'essayer des
  // numéros de téléphone au hasard sur un numéro de dossier connu.
  const cache = CacheService.getScriptCache();
  const cleCache = 'TEMOIG_' + id;
  const nbEnvois = Number(cache.get(cleCache) || 0);
  if (nbEnvois >= TEMOIGNAGES.ENVOIS_MAX_PAR_HEURE) {
    return reponseJSON({ status: 'error', message: 'Trop de tentatives pour ce dossier. Réessayez dans une heure.' });
  }
  cache.put(cleCache, String(nbEnvois + 1), 3600);

  const verif = _verifierApprenantTemoignage(id, telephone);
  if (verif.erreur) return reponseJSON({ status: 'error', message: verif.erreur });

  const apprenant = verif.apprenant;
  const feuille   = _feuilleTemoignages();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Un seul témoignage par dossier : on cherche l'existant pour le remplacer.
    const donnees = feuille.getDataRange().getValues();
    let ligneExistante = -1;
    let ancien = null;
    for (let i = 1; i < donnees.length; i++) {
      if (String(donnees[i][2] || '').trim() === id) { ligneExistante = i + 1; ancien = _ligneVersTemoignage(donnees[i]); break; }
    }

    let photo = ancien ? { url: ancien.photo, fileId: ancien.photoId } : { url: '', fileId: '' };
    if (photoB64) {
      if (ancien) _supprimerFichierDrive(ancien.photoId);
      photo = _enregistrerPhotoTemoignage(photoB64, photoMime, id);
    } else if (data.supprimerPhoto === true && ancien) {
      _supprimerFichierDrive(ancien.photoId);
      photo = { url: '', fileId: '' };
    }

    const statut = TEMOIGNAGES.MODERATION ? 'En attente' : 'Publié';
    const ligne = [
      ancien ? ancien.id : genererID('TEM'),
      new Date(),
      id,
      _nomPublicTemoignage(apprenant.prenom, apprenant.nom),
      apprenant.filiere,
      note,
      texte,
      photo.url,
      photo.fileId,
      statut
    ];
    if (ligneExistante > 0) feuille.getRange(ligneExistante, 1, 1, ligne.length).setValues([ligne]);
    else feuille.appendRow(ligne);

    return reponseJSON({
      status: 'success',
      remplace: !!ancien,
      publie: statut === 'Publié',
      message: statut === 'Publié'
        ? (ancien ? 'Votre témoignage a été mis à jour. Merci !' : 'Merci ! Votre témoignage est en ligne.')
        : 'Merci ! Votre témoignage sera publié après validation par le centre.'
    });
  } finally {
    lock.releaseLock();
  }
}

/* --------------------------- ADMIN --------------------------- */

function adminTemoignagesLister(data, email) {
  const feuille = _feuilleTemoignages();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const tous = feuille.getDataRange().getValues().slice(1).filter(r => r[0]).map(_ligneVersTemoignage);
  tous.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return reponseJSON({ status: 'success', temoignages: tous, moderation: TEMOIGNAGES.MODERATION });
}

function adminTemoignageStatut(data, email) {
  const id = String(data.id || '');
  const statut = String(data.statut || '');
  if (!id || STATUTS_TEMOIGNAGE.indexOf(statut) === -1) return reponseJSON({ status: 'error', message: 'Paramètres invalides.' });
  const feuille = _feuilleTemoignages();
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]) === id) {
      feuille.getRange(i + 1, 10).setValue(statut);
      console.log('[Admin:' + email + '] Témoignage ' + id + ' -> ' + statut);
      return reponseJSON({ status: 'success' });
    }
  }
  return reponseJSON({ status: 'error', message: 'Témoignage introuvable.' });
}

function adminTemoignageSupprimer(data, email) {
  const id = String(data.id || '');
  const feuille = _feuilleTemoignages();
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]) === id) {
      _supprimerFichierDrive(String(donnees[i][8] || ''));
      feuille.deleteRow(i + 1);
      console.log('[Admin:' + email + '] Témoignage supprimé : ' + id);
      return reponseJSON({ status: 'success' });
    }
  }
  return reponseJSON({ status: 'error', message: 'Témoignage introuvable.' });
}

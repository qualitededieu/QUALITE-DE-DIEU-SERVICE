/* =====================================================================
   GALERIE PHOTOS (page publique /galerie) — octobre 2026

   CORRECTIF : admin.gs (routerAdmin) et code.gs (doPost) appelaient
   galerieLister / adminGalerieAjouter / adminGalerieModifier /
   adminGalerieSupprimer, mais ce fichier n'existait pas dans le projet
   GAS : toute publication de photo depuis l'admin échouait.

   - Les photos arrivent déjà redimensionnées en JPEG par le navigateur
     (admin.html, 1600 px max) : rien à retraiter ici.
   - Stockage : dossier Drive "Galerie — LQD Service" (partage "lecture
     avec le lien", indispensable pour l'affichage sur le site) + onglet
     "Galerie" du classeur des inscriptions.
   - Ordre d'affichage : le plus petit numéro d'ordre d'abord ; à
     égalité, la photo la plus récente d'abord.
===================================================================== */

const GALERIE = {
  NOM_FEUILLE:       'Galerie',
  NOM_DOSSIER_DRIVE: 'Galerie — LQD Service',
  LEGENDE_MAX:       140,
  IMAGE_MAX_B64:     8000000,     // ~6 Mo : très au-dessus d'une photo 1600 px compressée
  TYPES_ACCEPTES:    ['image/jpeg', 'image/png', 'image/webp'],
  CATEGORIES:        ['Le centre', 'Cours & ateliers', 'Réalisations', 'Événements', "Remise d'attestations"]
};

const ENTETES_GALERIE = [
  'ID', 'Date', 'Catégorie', 'Légende', 'Ordre', 'Visible', 'Fichier ID', 'Ajoutée par'
];

function _feuilleGalerie() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName(GALERIE.NOM_FEUILLE);
  // Onglet créé à la main ou par une ancienne version avec d'autres
  // colonnes : on le renomme (rien n'est supprimé) et on repart propre.
  if (feuille && feuille.getLastColumn() > 0) {
    const entetes = feuille.getRange(1, 1, 1, Math.max(feuille.getLastColumn(), ENTETES_GALERIE.length)).getValues()[0];
    const conforme = ENTETES_GALERIE.every((h, i) => String(entetes[i]).trim() === h);
    if (!conforme) {
      feuille.setName(GALERIE.NOM_FEUILLE + ' (ancienne version ' + Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd HHmm') + ')');
      feuille = null;
    }
  }
  if (feuille && feuille.getLastRow() === 0) feuille.appendRow(ENTETES_GALERIE);
  if (!feuille) {
    feuille = ss.insertSheet(GALERIE.NOM_FEUILLE);
    feuille.appendRow(ENTETES_GALERIE);
    feuille.getRange(1, 1, 1, ENTETES_GALERIE.length)
      .setBackground(CONFIG.COULEUR_DARK).setFontColor('#FFFFFF').setFontWeight('bold');
    feuille.setFrozenRows(1);
  }
  return feuille;
}

function _dossierGalerie() {
  return trouverDossierDrive(GALERIE.NOM_DOSSIER_DRIVE) || DriveApp.createFolder(GALERIE.NOM_DOSSIER_DRIVE);
}

// Adresses servies par Drive (domaines autorisés par la CSP de vercel.json).
function _urlPhotoGalerie(fileId, largeur) {
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + largeur;
}

function _ligneVersPhoto(row) {
  const fileId = String(row[6] || '');
  const cat    = String(row[2] || '');
  return {
    id:        String(row[0] || ''),
    date:      row[1] instanceof Date ? row[1].toISOString() : String(row[1] || ''),
    categorie: GALERIE.CATEGORIES.indexOf(cat) !== -1 ? cat : GALERIE.CATEGORIES[0],
    legende:   String(row[3] || ''),
    ordre:     Number(row[4]) || 0,
    visible:   String(row[5]).trim() !== 'Non',
    fileId:    fileId,
    url:       fileId ? _urlPhotoGalerie(fileId, 1600) : '',
    miniature: fileId ? _urlPhotoGalerie(fileId, 600)  : ''
  };
}

// Version publique : sans identifiant Drive ni auteur.
function _photoPublique(p) {
  return { id: p.id, date: p.date, categorie: p.categorie, legende: p.legende, url: p.url, miniature: p.miniature };
}

function _trierPhotos(photos) {
  return photos.sort((a, b) => (a.ordre - b.ordre) || String(b.date).localeCompare(String(a.date)));
}

function _lirePhotosGalerie(feuille) {
  return feuille.getDataRange().getValues().slice(1).filter(r => r[0]).map(_ligneVersPhoto);
}

function _nettoyerLegende(texte) {
  return String(texte || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, GALERIE.LEGENDE_MAX);
}

/* --------------------------- PUBLIC --------------------------- */

function galerieLister(data) {
  const feuille = _feuilleGalerie();
  if (!feuille) return reponseJSON({ status: 'success', photos: [], categories: GALERIE.CATEGORIES });
  const photos = _trierPhotos(_lirePhotosGalerie(feuille).filter(p => p.visible && p.fileId));
  return reponseJSON({ status: 'success', photos: photos.map(_photoPublique), categories: GALERIE.CATEGORIES });
}

/* --------------------------- ADMIN --------------------------- */

function adminGalerieLister(data, email) {
  const feuille = _feuilleGalerie();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Classeur des inscriptions introuvable.' });
  return reponseJSON({ status: 'success', photos: _trierPhotos(_lirePhotosGalerie(feuille)), categories: GALERIE.CATEGORIES });
}

function adminGalerieAjouter(data, email) {
  const base64    = String(data.imageBase64 || '');
  const mime      = String(data.imageMimeType || 'image/jpeg');
  const categorie = String(data.categorie || '');
  const legende   = _nettoyerLegende(data.legende);

  // Validation avant toute écriture (Drive ou Sheets).
  if (!base64) return reponseJSON({ status: 'error', message: 'Image manquante.' });
  if (GALERIE.TYPES_ACCEPTES.indexOf(mime) === -1) return reponseJSON({ status: 'error', message: 'Format non accepté (JPG, PNG ou WEBP).' });
  if (base64.length > GALERIE.IMAGE_MAX_B64) return reponseJSON({ status: 'error', message: 'Image trop lourde après compression.' });
  if (GALERIE.CATEGORIES.indexOf(categorie) === -1) return reponseJSON({ status: 'error', message: 'Catégorie inconnue.' });

  const feuille = _feuilleGalerie();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Classeur des inscriptions introuvable.' });

  let octets;
  try { octets = Utilities.base64Decode(base64); }
  catch (e) { return reponseJSON({ status: 'error', message: 'Image illisible (données corrompues).' }); }

  const nomFichier = String(data.nomFichier || '').replace(/[^\w.\- ]+/g, '').slice(0, 80) || ('photo-' + Date.now() + '.jpg');
  const fichier = _dossierGalerie().createFile(Utilities.newBlob(octets, mime, nomFichier));
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const ligne = [genererID('GAL'), new Date(), categorie, legende, 0, 'Oui', fichier.getId(), email];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    feuille.appendRow(ligne);
  } catch (e) {
    _supprimerFichierDrive(fichier.getId());   // pas de fichier orphelin si la feuille refuse
    throw e;
  } finally {
    lock.releaseLock();
  }
  console.log('[Admin:' + email + '] Galerie : photo ajoutée ' + ligne[0]);
  return reponseJSON({ status: 'success', photo: _ligneVersPhoto(ligne) });
}

function adminGalerieModifier(data, email) {
  const id = String(data.id || '');
  const categorie = String(data.categorie || '');
  if (!id) return reponseJSON({ status: 'error', message: 'Photo non précisée.' });
  if (GALERIE.CATEGORIES.indexOf(categorie) === -1) return reponseJSON({ status: 'error', message: 'Catégorie inconnue.' });
  const ordre = Math.max(-9999, Math.min(9999, Math.round(Number(data.ordre) || 0)));

  const feuille = _feuilleGalerie();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Classeur des inscriptions introuvable.' });
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]) !== id) continue;
    // Colonnes C à F : Catégorie, Légende, Ordre, Visible
    const valeurs = [categorie, _nettoyerLegende(data.legende), ordre, data.visible === false ? 'Non' : 'Oui'];
    feuille.getRange(i + 1, 3, 1, 4).setValues([valeurs]);
    const maj = donnees[i].slice();
    maj.splice(2, 4, valeurs[0], valeurs[1], valeurs[2], valeurs[3]);
    return reponseJSON({ status: 'success', photo: _ligneVersPhoto(maj) });
  }
  return reponseJSON({ status: 'error', message: 'Photo introuvable (déjà supprimée ?).' });
}

function adminGalerieSupprimer(data, email) {
  const id = String(data.id || '');
  const feuille = _feuilleGalerie();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Classeur des inscriptions introuvable.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const donnees = feuille.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      if (String(donnees[i][0]) !== id) continue;
      _supprimerFichierDrive(String(donnees[i][6] || ''));
      feuille.deleteRow(i + 1);
      console.log('[Admin:' + email + '] Galerie : photo supprimée ' + id);
      return reponseJSON({ status: 'success' });
    }
  } finally {
    lock.releaseLock();
  }
  return reponseJSON({ status: 'error', message: 'Photo introuvable (déjà supprimée ?).' });
}

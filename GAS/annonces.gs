const ENTETES_ANNONCE = [
  'ID', 'Titre', 'Contenu', 'Catégorie', 'Statut',
  'Date publication', 'Auteur', 'Date création',
  'Image couverture URL', 'Image couverture ID'
];

const STATUTS_ANNONCE_VALIDES = ['Brouillon', 'Publié'];

const ANNONCE_CATEGORIES = {
  'Informatique & Bureautique': { icone: 'tabler:device-laptop', couleur: '#0F6E56', fond: 'linear-gradient(135deg,#E6F5F1,#CDEBE3)' },
  'Graphisme & PAO':            { icone: 'tabler:vector-bezier', couleur: '#7B2EFF', fond: 'linear-gradient(135deg,#F0E8FF,#E2D0FF)' },
  'Sérigraphie':                { icone: 'tabler:shirt',         couleur: '#C97A1A', fond: 'linear-gradient(135deg,#FDF0E0,#FBE1C2)' },
  'Création de sites web':      { icone: 'tabler:code',          couleur: '#0D7A8A', fond: 'linear-gradient(135deg,#E0F4F7,#C2E9EF)' },
  'Général':                    { icone: 'tabler:speakerphone',  couleur: '#04342C', fond: 'linear-gradient(135deg,#E7EEEC,#CFDFDA)' },
};

function _feuilleAnnonces() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName('Annonces');
  if (!feuille) {
    feuille = ss.insertSheet('Annonces');
    feuille.appendRow(ENTETES_ANNONCE);
    const rangeEntete = feuille.getRange(1, 1, 1, ENTETES_ANNONCE.length);
    rangeEntete.setBackground('#04342C');
    rangeEntete.setFontColor('#FFFFFF');
    rangeEntete.setFontWeight('bold');
    feuille.setFrozenRows(1);
  } else if (feuille.getLastColumn() < ENTETES_ANNONCE.length) {
    const manquantes = ENTETES_ANNONCE.slice(feuille.getLastColumn());
    const debut = feuille.getLastColumn() + 1;
    const plage = feuille.getRange(1, debut, 1, manquantes.length);
    plage.setValues([manquantes]);
    plage.setFontWeight('bold').setBackground('#04342C').setFontColor('#FFFFFF');
  }
  return feuille;
}

function _mapperAnnonce(row) {
  return {
    id:                String(row[0] || ''),
    titre:             String(row[1] || ''),
    contenu:           String(row[2] || ''),
    categorie:         String(row[3] || 'Général'),
    statut:            String(row[4] || 'Brouillon'),
    datePublication:   String(row[5] || ''),
    auteur:            String(row[6] || ''),
    dateCreation:      String(row[7] || ''),
    imageCouverture:   String(row[8] || ''),
    imageCouvertureId: String(row[9] || ''),
  };
}

function _sanitiserContenuHTML(html) {
  let propre = String(html || '');

  propre = propre.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  propre = propre.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  propre = propre.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
  propre = propre.replace(/<embed\b[^>]*>/gi, '');
  propre = propre.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  propre = propre.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  propre = propre.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  propre = propre.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"');
  propre = propre.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");

  return propre.slice(0, 60000);
}

function _extraireTexteBrut(html, longueurMax) {
  const texte = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  const max = longueurMax || 140;
  return texte.length > max ? texte.slice(0, max).trim() + '…' : texte;
}

function _dossierAnnonces(sousDossier) {
  const NOM_RACINE = 'Annonces — LQD Service';
  let racine = trouverDossierDrive(NOM_RACINE);
  if (!racine) racine = DriveApp.createFolder(NOM_RACINE);

  if (!sousDossier) return racine;
  const existant = trouverSousDossier(racine, sousDossier);
  return existant || racine.createFolder(sousDossier);
}

function _annonceEnregistrerImage(base64Data, mimeType, nomFichier, sousDossier) {
  const dossier = _dossierAnnonces(sousDossier || 'Couvertures');
  const octets   = Utilities.base64Decode(base64Data);
  const blob     = Utilities.newBlob(octets, mimeType || 'image/jpeg', nomFichier || ('image-' + Date.now() + '.jpg'));
  const fichier  = dossier.createFile(blob);
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = fichier.getId();
  return { url: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200', fileId };
}

function adminAnnonceUploadImage(data, email) {
  const imageBase64 = data.imageBase64;
  if (!imageBase64) return reponseJSON({ status: 'error', message: 'Image manquante.' });

  try {
    const image = _annonceEnregistrerImage(imageBase64, data.imageMimeType, data.imageNomFichier, 'Contenu');
    return reponseJSON({ status: 'success', url: image.url });
  } catch (err) {
    return reponseJSON({ status: 'error', message: 'Échec de l\'upload : ' + err.toString() });
  }
}

function annoncesListPubliees(data) {
  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'success', annonces: [] });

  const donnees = feuille.getDataRange().getValues();
  const annonces = [];
  for (let i = 1; i < donnees.length; i++) {
    const a = _mapperAnnonce(donnees[i]);
    if (a.statut === 'Publié' && a.titre) {
      annonces.push({
        id:              a.id,
        titre:           a.titre,
        extrait:         _extraireTexteBrut(a.contenu, 140),
        categorie:       a.categorie,
        datePublication: a.datePublication,
        imageCouverture: a.imageCouverture,
      });
    }
  }
  annonces.sort((a, b) => new Date(b.datePublication) - new Date(a.datePublication));

  return reponseJSON({ status: 'success', annonces: annonces.slice(0, 12) });
}

function annonceGetPublique(data) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Annonce introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    const a = _mapperAnnonce(donnees[i]);
    if (a.id !== id) continue;
    if (a.statut !== 'Publié') return reponseJSON({ status: 'error', message: 'Cette annonce n\'est pas publiée.' });

    return reponseJSON({
      status: 'success',
      annonce: {
        id:              a.id,
        titre:           a.titre,
        contenu:         a.contenu,
        categorie:       a.categorie,
        datePublication: a.datePublication,
        imageCouverture: a.imageCouverture,
      }
    });
  }

  return reponseJSON({ status: 'error', message: 'Annonce introuvable.' });
}

function adminAnnoncesList(data, email) {
  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'success', annonces: [] });

  const donnees = feuille.getDataRange().getValues();
  const annonces = [];
  for (let i = 1; i < donnees.length; i++) {
    const a = _mapperAnnonce(donnees[i]);
    if (a.titre) annonces.push(a);
  }
  annonces.sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));

  return reponseJSON({ status: 'success', annonces });
}

function adminAnnonceCreer(data, email) {
  const titre     = nettoyer(data.titre || '');
  const contenu   = _sanitiserContenuHTML(data.contenu || '');
  const categorie = ANNONCE_CATEGORIES[data.categorie] ? data.categorie : 'Général';
  const statut    = STATUTS_ANNONCE_VALIDES.includes(data.statut) ? data.statut : 'Brouillon';

  if (!titre)   return reponseJSON({ status: 'error', message: 'Le titre est obligatoire.' });
  if (!_extraireTexteBrut(contenu, 999999)) return reponseJSON({ status: 'error', message: 'Le contenu est obligatoire.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const id = genererID('ANN');
  const maintenant = new Date();
  const datePublication = statut === 'Publié' ? maintenant.toISOString() : '';

  let image = { url: '', fileId: '' };
  if (data.imageCouvertureBase64) {
    try {
      image = _annonceEnregistrerImage(data.imageCouvertureBase64, data.imageCouvertureMimeType, data.imageCouvertureNomFichier, 'Couvertures');
    } catch (err) {
      return reponseJSON({ status: 'error', message: 'Échec de l\'envoi de l\'image de couverture : ' + err.toString() });
    }
  }

  feuille.appendRow([
    id, titre, contenu, categorie, statut, datePublication, email, maintenant.toISOString(),
    image.url, image.fileId
  ]);

  return reponseJSON({ status: 'success', message: 'Annonce créée.', id });
}

function adminAnnonceModifier(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() !== id) continue;

    const titre     = nettoyer(data.titre || donnees[i][1]);
    const contenu   = data.contenu !== undefined ? _sanitiserContenuHTML(data.contenu) : String(donnees[i][2] || '');
    const categorie = ANNONCE_CATEGORIES[data.categorie] ? data.categorie : String(donnees[i][3] || 'Général');
    const statut    = STATUTS_ANNONCE_VALIDES.includes(data.statut) ? data.statut : String(donnees[i][4] || 'Brouillon');

    let datePublication = String(donnees[i][5] || '');
    if (statut === 'Publié' && !datePublication) {
      datePublication = new Date().toISOString();
    }
    if (statut === 'Brouillon') {
      datePublication = '';
    }

    feuille.getRange(i + 1, 2).setValue(titre);
    feuille.getRange(i + 1, 3).setValue(contenu);
    feuille.getRange(i + 1, 4).setValue(categorie);
    feuille.getRange(i + 1, 5).setValue(statut);
    feuille.getRange(i + 1, 6).setValue(datePublication);

    if (data.imageCouvertureBase64) {
      const ancienFileId = String(donnees[i][9] || '');
      try {
        const image = _annonceEnregistrerImage(data.imageCouvertureBase64, data.imageCouvertureMimeType, data.imageCouvertureNomFichier, 'Couvertures');
        feuille.getRange(i + 1, 9).setValue(image.url);
        feuille.getRange(i + 1, 10).setValue(image.fileId);
        if (ancienFileId) {
          try { DriveApp.getFileById(ancienFileId).setTrashed(true); } catch (e) {}
        }
      } catch (err) {
        return reponseJSON({ status: 'error', message: 'Échec de l\'envoi de l\'image de couverture : ' + err.toString() });
      }
    }

    return reponseJSON({ status: 'success', message: 'Annonce mise à jour.' });
  }

  return reponseJSON({ status: 'error', message: 'Annonce introuvable.' });
}

function adminAnnonceSupprimer(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() !== id) continue;

    const imageFileId = String(donnees[i][9] || '');
    feuille.deleteRow(i + 1);

    if (imageFileId) {
      try { DriveApp.getFileById(imageFileId).setTrashed(true); } catch (e) {}
    }

    return reponseJSON({ status: 'success', message: 'Annonce supprimée.' });
  }

  return reponseJSON({ status: 'error', message: 'Annonce introuvable.' });
}

function _getBandeauConfig() {
  const brut = PropertiesService.getScriptProperties().getProperty('BANDEAU_CONFIG');
  if (!brut) return { actif: false, texte: '' };
  try {
    return JSON.parse(brut);
  } catch (e) {
    return { actif: false, texte: '' };
  }
}

function adminBandeauGet(data, email) {
  return reponseJSON({ status: 'success', bandeau: _getBandeauConfig() });
}

function adminBandeauSet(data, email) {
  const texte = nettoyer(data.texte || '');
  const actif = !!data.actif;

  if (actif && !texte) {
    return reponseJSON({ status: 'error', message: 'Un bandeau actif doit avoir un texte.' });
  }

  PropertiesService.getScriptProperties().setProperty('BANDEAU_CONFIG', JSON.stringify({ actif, texte }));
  return reponseJSON({ status: 'success', message: 'Bandeau mis à jour.' });
}

function bandeauGetPublic(data) {
  const config = _getBandeauConfig();
  if (!config.actif) return reponseJSON({ status: 'success', actif: false, texte: '' });
  return reponseJSON({ status: 'success', actif: true, texte: config.texte });
}

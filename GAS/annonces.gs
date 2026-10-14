const ENTETES_ANNONCE = [
  'ID', 'Titre', 'Contenu', 'Catégorie', 'Statut',
  'Date publication', 'Auteur', 'Date création',
  'Image couverture URL', 'Image couverture ID', 'Type',
  'CTA Mode', 'CTA Libellé', 'CTA Valeur'
];

const STATUTS_ANNONCE_VALIDES = ['Brouillon', 'Publié'];
const TYPES_ANNONCE_VALIDES   = ['Formation', 'Recrutement'];
const CTA_MODES_VALIDES       = ['auto', 'formulaire', 'telephone', 'email', 'lien'];

const ANNONCE_CATEGORIES = {
  'Informatique & Bureautique': { icone: 'tabler:device-laptop', couleur: '#0F6E56', fond: 'linear-gradient(135deg,#E6F5F1,#CDEBE3)' },
  'Graphisme & PAO':            { icone: 'tabler:vector-bezier', couleur: '#7B2EFF', fond: 'linear-gradient(135deg,#F0E8FF,#E2D0FF)' },
  'Sérigraphie':                { icone: 'tabler:shirt',         couleur: '#C97A1A', fond: 'linear-gradient(135deg,#FDF0E0,#FBE1C2)' },
  'Création de sites web':      { icone: 'tabler:code',          couleur: '#0D7A8A', fond: 'linear-gradient(135deg,#E0F4F7,#C2E9EF)' },
  'Secrétariat comptable':      { icone: 'tabler:calculator',    couleur: '#2563A8', fond: 'linear-gradient(135deg,#E7F0FB,#CFE0F5)' },
  'Montage audio-visuel':       { icone: 'tabler:movie',         couleur: '#C2410C', fond: 'linear-gradient(135deg,#FDECEC,#FBD5C9)' },
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
    type:              TYPES_ANNONCE_VALIDES.includes(row[10]) ? row[10] : 'Formation',
    ctaMode:           CTA_MODES_VALIDES.includes(row[11]) ? row[11] : 'auto',
    ctaLabel:          String(row[12] || ''),
    ctaValeur:         String(row[13] || ''),
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

// Table des entités HTML nommées les plus courantes en contenu francophone.
// Nécessaire car GAS n'a pas de DOMParser côté serveur pour décoder
// nativement — contrairement au navigateur qui gère déjà tout ça seul
// quand le contenu complet est affiché sur article.html.
const ENTITES_HTML = {
  'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ',
  'eacute': 'é', 'egrave': 'è', 'ecirc': 'ê', 'euml': 'ë',
  'agrave': 'à', 'acirc': 'â', 'auml': 'ä',
  'ccedil': 'ç', 'ocirc': 'ô', 'ouml': 'ö',
  'ugrave': 'ù', 'ucirc': 'û', 'uuml': 'ü',
  'icirc': 'î', 'iuml': 'ï', 'ntilde': 'ñ',
  'oelig': 'œ', 'aelig': 'æ', 'szlig': 'ß',
  'Eacute': 'É', 'Egrave': 'È', 'Agrave': 'À', 'Ccedil': 'Ç',
  'hellip': '…', 'mdash': '—', 'ndash': '–',
  'lsquo': '‘', 'rsquo': '’', 'ldquo': '“', 'rdquo': '”',
  'laquo': '«', 'raquo': '»', 'middot': '·',
  'deg': '°', 'euro': '€', 'copy': '©', 'reg': '®', 'trade': '™',
  'times': '×', 'divide': '÷', 'plusmn': '±', 'sect': '§', 'para': '¶',
};

function _decoderEntitesHTML(texte) {
  return String(texte || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, nom) => (nom in ENTITES_HTML) ? ENTITES_HTML[nom] : m);
}

function _extraireTexteBrut(html, longueurMax) {
  const texte = _decoderEntitesHTML(
    String(html || '').replace(/<[^>]*>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
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
        type:            a.type,
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
        type:            a.type,
        ctaMode:         a.ctaMode,
        ctaLabel:        a.ctaLabel,
        ctaValeur:       a.ctaValeur,
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

// Valide et normalise le trio (mode, libellé, valeur) du bouton d'action.
// 'auto' et 'formulaire' n'ont besoin d'aucune valeur — le premier suit le
// Type de l'annonce, le second pointe toujours vers /postuler.
// 'telephone' / 'email' / 'lien' exigent une valeur cohérente avec le mode.
function _validerCTA(modeBrut, labelBrut, valeurBrut) {
  const mode  = CTA_MODES_VALIDES.includes(modeBrut) ? modeBrut : 'auto';
  const label = nettoyer(labelBrut || '');
  let   valeur = String(valeurBrut || '').trim();

  if (mode === 'telephone') {
    valeur = valeur.replace(/[\s.\-()]/g, '');
    if (!/^\+?\d{6,15}$/.test(valeur)) {
      return { erreur: 'Le numéro de téléphone du bouton semble invalide.' };
    }
  } else if (mode === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur)) {
      return { erreur: "L'adresse email du bouton semble invalide." };
    }
  } else if (mode === 'lien') {
    if (!/^https?:\/\//i.test(valeur)) {
      return { erreur: 'Le lien personnalisé doit commencer par http:// ou https://' };
    }
  } else {
    valeur = '';
  }

  return { mode, label, valeur };
}

function adminAnnonceCreer(data, email) {
  const titre     = nettoyer(data.titre || '');
  const contenu   = _sanitiserContenuHTML(data.contenu || '');
  const categorie = ANNONCE_CATEGORIES[data.categorie] ? data.categorie : 'Général';
  const statut    = STATUTS_ANNONCE_VALIDES.includes(data.statut) ? data.statut : 'Brouillon';
  const type      = TYPES_ANNONCE_VALIDES.includes(data.type) ? data.type : 'Formation';

  const cta = _validerCTA(data.ctaMode, data.ctaLabel, data.ctaValeur);
  if (cta.erreur) return reponseJSON({ status: 'error', message: cta.erreur });

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
    image.url, image.fileId, type, cta.mode, cta.label, cta.valeur
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
    const type      = TYPES_ANNONCE_VALIDES.includes(data.type) ? data.type : (TYPES_ANNONCE_VALIDES.includes(donnees[i][10]) ? donnees[i][10] : 'Formation');

    const cta = _validerCTA(
      data.ctaMode !== undefined ? data.ctaMode : donnees[i][11],
      data.ctaLabel !== undefined ? data.ctaLabel : donnees[i][12],
      data.ctaValeur !== undefined ? data.ctaValeur : donnees[i][13]
    );
    if (cta.erreur) return reponseJSON({ status: 'error', message: cta.erreur });

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
    feuille.getRange(i + 1, 11).setValue(type);
    feuille.getRange(i + 1, 12).setValue(cta.mode);
    feuille.getRange(i + 1, 13).setValue(cta.label);
    feuille.getRange(i + 1, 14).setValue(cta.valeur);

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
  const parDefaut = { actif: false, messages: [], dureeRotationSec: 12 };
  if (!brut) return parDefaut;
  try {
    const config = JSON.parse(brut);
    // Rétrocompatibilité : ancien format { actif, texte } à un seul message.
    if (config.texte !== undefined && !Array.isArray(config.messages)) {
      return { actif: !!config.actif, messages: config.texte ? [{ texte: config.texte, actif: true }] : [], dureeRotationSec: 12 };
    }
    return {
      actif: !!config.actif,
      messages: Array.isArray(config.messages) ? config.messages : [],
      dureeRotationSec: Number(config.dureeRotationSec) || 12
    };
  } catch (e) {
    return parDefaut;
  }
}

function adminBandeauGet(data, email) {
  return reponseJSON({ status: 'success', bandeau: _getBandeauConfig() });
}

function adminBandeauSet(data, email) {
  const messages = Array.isArray(data.messages)
    ? data.messages.map(m => ({ texte: nettoyer(m.texte || ''), actif: !!m.actif })).filter(m => m.texte)
    : [];
  const actif = !!data.actif;
  const dureeRotationSec = Math.max(3, Math.min(60, Number(data.dureeRotationSec) || 12));

  if (actif && messages.filter(m => m.actif).length === 0) {
    return reponseJSON({ status: 'error', message: 'Au moins un message actif est requis.' });
  }

  PropertiesService.getScriptProperties().setProperty(
    'BANDEAU_CONFIG',
    JSON.stringify({ actif, messages, dureeRotationSec })
  );
  return reponseJSON({ status: 'success', message: 'Bandeau mis à jour.' });
}

function bandeauGetPublic(data) {
  const config = _getBandeauConfig();
  if (!config.actif) return reponseJSON({ status: 'success', actif: false, messages: [] });

  const messagesActifs = config.messages.filter(m => m.actif).map(m => m.texte);
  if (messagesActifs.length === 0) return reponseJSON({ status: 'success', actif: false, messages: [] });

  return reponseJSON({
    status: 'success',
    actif: true,
    messages: messagesActifs,
    dureeRotationSec: config.dureeRotationSec
  });
}

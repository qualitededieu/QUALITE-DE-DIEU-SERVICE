/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Actualités & Bandeau d'information
   Fichier  : annonces.gs
   Version  : 1.0.0

   Deux fonctionnalités indépendantes dans ce fichier :
   1. ANNONCES : articles courts publiés par l'admin, remplacent les
      3 fausses cartes codées en dur qui vivaient dans la section
      "Blog" (renommée "Actualités" côté public).
   2. BANDEAU : bande d'information défilante en haut de page, même
      principe que sur Le Compagnon Yaovi — un texte + un interrupteur
      actif/inactif, stocké dans les Propriétés du script (pas besoin
      d'un onglet dédié pour une seule valeur de configuration).
   ===================================================================== */


// =====================================================================
// EN-TÊTES — Feuille "Annonces"
// =====================================================================
const ENTETES_ANNONCE = [
  'ID', 'Titre', 'Contenu', 'Catégorie', 'Statut',
  'Date publication', 'Auteur', 'Date création'
];

const STATUTS_ANNONCE_VALIDES = ['Brouillon', 'Publié'];

// Catégories alignées sur CONFIG.FORMATIONS_VALIDES + une catégorie
// générale pour les annonces qui ne concernent pas une filière précise
// (fermeture exceptionnelle, événement, etc.) — chaque catégorie a son
// icône et sa couleur déjà utilisées ailleurs sur le site, pour rester
// visuellement cohérent avec le reste (cartes de formation, etc.).
const ANNONCE_CATEGORIES = {
  'Informatique & Bureautique': { icone: 'tabler:device-laptop', couleur: '#0F6E56', fond: 'linear-gradient(135deg,#E6F5F1,#CDEBE3)' },
  'Graphisme & PAO':            { icone: 'tabler:vector-bezier', couleur: '#7B2EFF', fond: 'linear-gradient(135deg,#F0E8FF,#E2D0FF)' },
  'Sérigraphie':                { icone: 'tabler:shirt',         couleur: '#C97A1A', fond: 'linear-gradient(135deg,#FDF0E0,#FBE1C2)' },
  'Création de sites web':      { icone: 'tabler:code',          couleur: '#0D7A8A', fond: 'linear-gradient(135deg,#E0F4F7,#C2E9EF)' },
  'Général':                    { icone: 'tabler:speakerphone',  couleur: '#04342C', fond: 'linear-gradient(135deg,#E7EEEC,#CFDFDA)' },
};


// =====================================================================
// HELPER — Récupère (ou crée) la feuille "Annonces"
// =====================================================================
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
  }
  return feuille;
}

function _mapperAnnonce(row) {
  return {
    id:              String(row[0] || ''),
    titre:           String(row[1] || ''),
    contenu:         String(row[2] || ''),
    categorie:       String(row[3] || 'Général'),
    statut:          String(row[4] || 'Brouillon'),
    datePublication: String(row[5] || ''),
    auteur:          String(row[6] || ''),
    dateCreation:    String(row[7] || ''),
  };
}


// =====================================================================
// PUBLIC — Liste des annonces publiées, les plus récentes en premier
// Utilisé par la section "Actualités" d'index.html.
// =====================================================================
function annoncesListPubliees(data) {
  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'success', annonces: [] });

  const donnees = feuille.getDataRange().getValues();
  const annonces = [];
  for (let i = 1; i < donnees.length; i++) {
    const a = _mapperAnnonce(donnees[i]);
    if (a.statut === 'Publié' && a.titre) annonces.push(a);
  }
  annonces.sort((a, b) => new Date(b.datePublication) - new Date(a.datePublication));

  // Limite raisonnable côté serveur : évite de renvoyer un historique
  // interminable à charger sur la page d'accueil.
  return reponseJSON({ status: 'success', annonces: annonces.slice(0, 12) });
}


// =====================================================================
// ADMIN — Liste complète (brouillons + publiées), pour le panneau admin
// =====================================================================
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


// =====================================================================
// ADMIN — Créer une annonce
// =====================================================================
function adminAnnonceCreer(data, email) {
  const titre   = nettoyer(data.titre || '');
  const contenu = nettoyer(data.contenu || '');
  const categorie = ANNONCE_CATEGORIES[data.categorie] ? data.categorie : 'Général';
  const statut  = STATUTS_ANNONCE_VALIDES.includes(data.statut) ? data.statut : 'Brouillon';

  if (!titre)   return reponseJSON({ status: 'error', message: 'Le titre est obligatoire.' });
  if (!contenu) return reponseJSON({ status: 'error', message: 'Le contenu est obligatoire.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const id = genererID('ANN');
  const maintenant = new Date();
  const datePublication = statut === 'Publié' ? maintenant.toISOString() : '';

  feuille.appendRow([id, titre, contenu, categorie, statut, datePublication, email, maintenant.toISOString()]);

  return reponseJSON({ status: 'success', message: 'Annonce créée.', id });
}


// =====================================================================
// ADMIN — Modifier une annonce existante (contenu et/ou statut)
// Si le statut passe de "Brouillon" à "Publié" sans date de publication
// déjà fixée, la date du jour est posée automatiquement — l'admin n'a
// jamais besoin d'y penser lui-même.
// =====================================================================
function adminAnnonceModifier(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() !== id) continue;

    const titre     = nettoyer(data.titre || donnees[i][1]);
    const contenu   = nettoyer(data.contenu || donnees[i][2]);
    const categorie = ANNONCE_CATEGORIES[data.categorie] ? data.categorie : String(donnees[i][3] || 'Général');
    const statut    = STATUTS_ANNONCE_VALIDES.includes(data.statut) ? data.statut : String(donnees[i][4] || 'Brouillon');

    let datePublication = String(donnees[i][5] || '');
    if (statut === 'Publié' && !datePublication) {
      datePublication = new Date().toISOString();
    }
    if (statut === 'Brouillon') {
      datePublication = ''; // dépublié : n'apparaît plus, et une republication ultérieure aura une date fraîche
    }

    feuille.getRange(i + 1, 2).setValue(titre);
    feuille.getRange(i + 1, 3).setValue(contenu);
    feuille.getRange(i + 1, 4).setValue(categorie);
    feuille.getRange(i + 1, 5).setValue(statut);
    feuille.getRange(i + 1, 6).setValue(datePublication);

    return reponseJSON({ status: 'success', message: 'Annonce mise à jour.' });
  }

  return reponseJSON({ status: 'error', message: 'Annonce introuvable.' });
}


// =====================================================================
// ADMIN — Supprimer une annonce
// =====================================================================
function adminAnnonceSupprimer(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _feuilleAnnonces();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() !== id) continue;
    feuille.deleteRow(i + 1);
    return reponseJSON({ status: 'success', message: 'Annonce supprimée.' });
  }

  return reponseJSON({ status: 'error', message: 'Annonce introuvable.' });
}


/* =====================================================================
   BANDEAU D'INFORMATION — bande défilante en haut de page
   Configuration légère (un texte + un interrupteur), stockée dans les
   Propriétés du script plutôt qu'un onglet dédié : une seule valeur à
   la fois, jamais d'historique à conserver — un onglet Sheet serait
   disproportionné pour ça.
   ===================================================================== */

function _getBandeauConfig() {
  const brut = PropertiesService.getScriptProperties().getProperty('BANDEAU_CONFIG');
  if (!brut) return { actif: false, texte: '' };
  try {
    return JSON.parse(brut);
  } catch (e) {
    return { actif: false, texte: '' };
  }
}

// ADMIN — Lire la configuration actuelle (pour pré-remplir le formulaire admin)
function adminBandeauGet(data, email) {
  return reponseJSON({ status: 'success', bandeau: _getBandeauConfig() });
}

// ADMIN — Modifier la configuration
function adminBandeauSet(data, email) {
  const texte = nettoyer(data.texte || '');
  const actif = !!data.actif;

  if (actif && !texte) {
    return reponseJSON({ status: 'error', message: 'Un bandeau actif doit avoir un texte.' });
  }

  PropertiesService.getScriptProperties().setProperty('BANDEAU_CONFIG', JSON.stringify({ actif, texte }));
  return reponseJSON({ status: 'success', message: 'Bandeau mis à jour.' });
}

// PUBLIC — Lue par index.html à chaque chargement de page
function bandeauGetPublic(data) {
  const config = _getBandeauConfig();
  // Ne renvoie jamais de texte si le bandeau est désactivé : évite au
  // frontend d'avoir à vérifier deux champs séparément.
  if (!config.actif) return reponseJSON({ status: 'success', actif: false, texte: '' });
  return reponseJSON({ status: 'success', actif: true, texte: config.texte });
}

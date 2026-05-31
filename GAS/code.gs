/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Google Apps Script Backend
   Version : 3.1.0
   Auteur  : LQD Web Studio / PHANOS KOSMOS
   Changelog v3.1 :
     - Correction guard e / e.postData dans doPost
     - Ajout fonction testerDoPost() pour tests depuis l'éditeur GAS
     - Suppression complète de l'API FedaPay
     - Paiement uniquement par virement bancaire
     - Upload preuve de paiement (optionnel, base64 → Drive)
     - Multi-formations : une personne peut s'inscrire à N formations
     - Section renseignement : formulaire de contact léger
   ===================================================================== */


// =====================================================================
// CONFIGURATION CENTRALE
// =====================================================================
const CONFIG = {

  ADMIN_EMAIL:       'lqddssarl@gmail.com',
  EXPEDITEUR_NOM:    'Les Qualités de Dieu Service',
  SPREADSHEET_NAME:  'Inscriptions — LQD Service',
  DRIVE_DOSSIER_NOM: 'Inscriptions LQD Service',
  LOGO_URL:          'https://qualitededieu.vercel.app/icons/logoqds.jpg',
  SITE_URL:          'https://qualitededieu.vercel.app',

  COULEUR_TEAL:   '#0D7A8A',
  COULEUR_ORANGE: '#F5A623',
  COULEUR_DARK:   '#04342C',
  WHATSAPP:       '22997951230'.replace(/\s/g, ''),

  // -------------------------------------------------------
  // FRAIS D'INSCRIPTION FIXES (FCFA)
  // -------------------------------------------------------
  FRAIS_INSCRIPTION: 10000,

  // -------------------------------------------------------
  // COÛTS TOTAUX PAR FORMATION (FCFA)
  // TODO : renseigner les montants réels avant déploiement
  // -------------------------------------------------------
  COUTS_FORMATIONS: {
    'Informatique & Bureautique': 45000,   // TODO : ex. 50000
    'Graphisme & PAO':            65000,   // TODO : ex. 75000
    'Sérigraphie':                35000,   // TODO : ex. 50000
    'Création de sites web':      200000    // TODO : ex. 75000
  },

  // -------------------------------------------------------
  // COORDONNÉES BANCAIRES POUR VIREMENTS
  // TODO : renseigner avant déploiement
  // -------------------------------------------------------
  BANQUE: {
    TITULAIRE:     'LES QUALITÉS DE DIEU SERVICE SARL',
    NOM_BANQUE:    'UBA Bénin',   // TODO : ex. 'BOA Bénin'
    NUMERO_COMPTE: 'BJ66 XXXX XXX XXX XX',   // TODO : ex. 'BJ66 BJ011 2345 6789 0123 456'
    CODE_BANQUE:   'IBAN',   // TODO : si requis par la banque
    CODE_AGENCE:   'BJ0COBJ'    // TODO : si requis par la banque
  },

  // -------------------------------------------------------
  // LISTE BLANCHE DES FORMATIONS (anti-injection)
  // -------------------------------------------------------
  FORMATIONS_VALIDES: [
    'Informatique & Bureautique',
    'Graphisme & PAO',
    'Sérigraphie',
    'Création de sites web'
  ]
};


// =====================================================================
// EN-TÊTES COLONNES GOOGLE SHEETS
// =====================================================================
const ENTETES_INSCRIPTION = [
  'ID',
  'Date',
  'Prénom',
  'Nom',
  'Téléphone',
  'Email',
  'Formations',                    // séparées par " | "
  'Nombre de formations',
  'Message',
  'Statut dossier',                // En attente | Confirmé | Annulé
  'Type pièce identité',
  'Pièce identité (Drive URL)',
  'Photo identité (Drive URL)',
  'Preuve paiement (Drive URL)',   // Optionnel
  'Dossier Drive (URL)',
  'Frais inscription (F)',
  'Coût formations total (F)',
  'Tranche 1 — 50% (F)',
  'Tranche 2 — 25% (F)',
  'Tranche 3 — 25% (F)',
  '1er versement attendu (F)',
  'Statut paiement',               // En attente | Reçu | Vérifié
  'Rappel J+1 envoyé'
];

const ENTETES_RENSEIGNEMENT = [
  'ID',
  'Date',
  'Prénom',
  'Nom',
  'Téléphone',
  'Email',
  'Formations intéressées',
  'Question / Message',
  'Statut'                         // Nouveau | Traité
];


// =====================================================================
// ROUTAGE PRINCIPAL — doPost
// =====================================================================
function doPost(e) {

  // -------------------------------------------------------
  // GUARD v3.1 — Protection si e est undefined
  // Cause : fonction lancée manuellement depuis l'éditeur GAS
  // sans requête HTTP réelle. Utiliser testerDoPost() à la place.
  // -------------------------------------------------------
  if (!e || !e.postData) {
    return reponseJSON({
      status:  'error',
      message: 'Requête POST invalide. Appelez cette URL depuis le frontend ou utilisez testerDoPost() dans l\'éditeur.'
    });
  }

  try {
    const raw = e.postData.contents;
    if (!raw) return reponseJSON({ status: 'error', message: 'Corps de requête vide.' });

    const data   = JSON.parse(raw);
    const action = (e.parameter && e.parameter.action) || data.action || 'inscription';
// Routing admin — doit être en premier
  if (action.startsWith('admin_')) return routerAdmin(data, action);
  if (action === 'renseignement') return traiterRenseignement(data);
    return traiterInscription(data);

  } catch (err) {
    console.error('[doPost]', err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur interne. Veuillez réessayer.' });
  }
}


// doGet — santé API
function doGet(e) {
  return reponseJSON({ status: 'ok', message: 'LQD Service API v3.1 opérationnelle.' });
}


// =====================================================================
// FONCTION DE TEST — À utiliser depuis l'éditeur GAS
// Ne jamais "Exécuter" doPost directement depuis l'éditeur.
// Sélectionner testerDoPost dans le menu puis cliquer Exécuter.
// =====================================================================
function testerDoPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action:         'inscription',
        prenom:         'Philippe',
        nom:            'Bénin',
        telephone:      '+2290162484491',
        email:          'phanoskosmos@gmail.com',
        formations:     ['Informatique & Bureautique'],
        typePiece:      'CIP (Carte d\'Identité Personnelle)',
        message:        'Test depuis éditeur GAS v3.1',
        // Fichiers minimalistes en base64 (chaîne valide)
        piece1Base64:   'dGVzdA==',
        piece1MimeType: 'image/jpeg',
        photoBase64:    'dGVzdA==',
        photoMimeType:  'image/jpeg',
        preuveBase64:   '',
        preuveMimeType: ''
      })
    },
    parameter: { action: 'inscription' }
  };

  const resultat = doPost(fakeEvent);
  Logger.log('[testerDoPost] Réponse : ' + resultat.getContent());
}

function testerRenseignement() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action:     'renseignement',
        prenom:     'Marie',
        nom:        'Test',
        telephone:  '+22901000000001',
        email:      'marie@test.bj',
        formations: ['Graphisme & PAO', 'Sérigraphie'],
        question:   'Quels sont les horaires disponibles le soir ?'
      })
    },
    parameter: { action: 'renseignement' }
  };

  const resultat = doPost(fakeEvent);
  Logger.log('[testerRenseignement] Réponse : ' + resultat.getContent());
}


// =====================================================================
// INSCRIPTION — Traitement complet
// =====================================================================
function traiterInscription(data) {

  // 1. Validation champs textuels
  const erreursChamps = validerDonneesInscription(data);
  if (erreursChamps.length > 0) {
    return reponseJSON({ status: 'error', message: 'Champs invalides : ' + erreursChamps.join(', ') });
  }

  // 2. Validation fichiers (pièce + photo obligatoires, preuve optionnelle)
  const erreursFichiers = validerFichiersInscription(data);
  if (erreursFichiers.length > 0) {
    return reponseJSON({ status: 'error', message: erreursFichiers.join(' ') });
  }

  // 3. Formations validées
  const formations = Array.isArray(data.formations)
    ? data.formations.filter(f => CONFIG.FORMATIONS_VALIDES.includes(f))
    : [data.formations].filter(f => CONFIG.FORMATIONS_VALIDES.includes(f));

  if (formations.length === 0) {
    return reponseJSON({ status: 'error', message: 'Aucune formation valide sélectionnée.' });
  }

  // 4. Calcul montants (somme de toutes les formations choisies)
  const montants = calculerMontantsTotal(formations);

  // 5. Construction objet inscription
  const inscription = {
    id:              genererID(),
    date:            new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    prenom:          nettoyer(data.prenom),
    nom:             nettoyer(data.nom),
    telephone:       nettoyer(data.telephone),
    email:           nettoyer(data.email || ''),
    formations,
    formationsLabel: formations.join(' | '),
    nbFormations:    formations.length,
    message:         nettoyer(data.message || ''),
    statut:          'En attente',
    typePiece:       nettoyer(data.typePiece || 'Non spécifié'),
    pieceUrl:        '',
    photoUrl:        '',
    preuveUrl:       '',
    dossierUrl:      '',
    statutPaiement:  'En attente',
    rappelEnvoye:    'Non'
  };

  // 6. Création dossier Drive + upload pièces
  try {
    const driveResult    = creerStructureDrive(inscription, data);
    inscription.pieceUrl  = driveResult.pieceUrl;
    inscription.photoUrl  = driveResult.photoUrl;
    inscription.preuveUrl = driveResult.preuveUrl;
    inscription.dossierUrl= driveResult.dossierUrl;
  } catch (errDrive) {
    console.error('[Drive]', errDrive.toString());
    // On ne bloque pas l'inscription si Drive échoue
    inscription.pieceUrl  = 'Erreur upload Drive';
    inscription.photoUrl  = 'Erreur upload Drive';
  }

  // 7. Enregistrement Google Sheets
  enregistrerInscription(inscription, montants, formations);

  // 8. Emails
  envoyerEmailAdmin(inscription, montants);
  if (inscription.email) {
    envoyerEmailApprenant(inscription, montants);
    envoyerEmailVirement(inscription, montants);
    programmerRappelJ1(inscription);
  }

  return reponseJSON({
    status:   'success',
    id:       inscription.id,
    mode:     'virement',
    montants,
    banque:   CONFIG.BANQUE,
    message:  'Dossier enregistré. Les coordonnées bancaires ont été envoyées par email.'
  });
}


// =====================================================================
// RENSEIGNEMENT — Traitement
// =====================================================================
function traiterRenseignement(data) {

  const erreurs = validerDonneesRenseignement(data);
  if (erreurs.length > 0) {
    return reponseJSON({ status: 'error', message: 'Champs invalides : ' + erreurs.join(', ') });
  }

  const formations = Array.isArray(data.formations)
    ? data.formations.filter(f => CONFIG.FORMATIONS_VALIDES.includes(f))
    : [];

  const renseignement = {
    id:        genererID('RNS'),
    date:      new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    prenom:    nettoyer(data.prenom),
    nom:       nettoyer(data.nom),
    telephone: nettoyer(data.telephone),
    email:     nettoyer(data.email || ''),
    formations:formations.join(' | ') || 'Non précisé',
    question:  nettoyer(data.question || ''),
    statut:    'Nouveau'
  };

  enregistrerRenseignement(renseignement);
  envoyerEmailAdminRenseignement(renseignement);
  if (renseignement.email) envoyerEmailAutoReponseRenseignement(renseignement);

  return reponseJSON({
    status:  'success',
    id:      renseignement.id,
    message: 'Votre demande a bien été reçue. Nous vous répondons sous 24 h.'
  });
}


// =====================================================================
// CALCUL MONTANTS — Somme de toutes les formations sélectionnées
// =====================================================================
function calculerMontantsTotal(formations) {
  const fraisInscription = CONFIG.FRAIS_INSCRIPTION;
  const coutTotal        = formations.reduce((s, f) => s + (CONFIG.COUTS_FORMATIONS[f] || 0), 0);
  const tranche1         = Math.round(coutTotal * 0.50);
  const tranche2         = Math.round(coutTotal * 0.25);
  const tranche3         = coutTotal - tranche1 - tranche2;
  const premierVirement  = fraisInscription + tranche1;
  return { fraisInscription, coutTotal, tranche1, tranche2, tranche3, premierVirement };
}


// =====================================================================
// VALIDATION
// =====================================================================
function validerDonneesInscription(data) {
  const erreurs = [];
  if (!data.prenom    || data.prenom.trim().length < 2)    erreurs.push('prénom');
  if (!data.nom       || data.nom.trim().length < 2)       erreurs.push('nom');
  if (!data.telephone || data.telephone.trim().length < 8)  erreurs.push('téléphone');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) erreurs.push('email');
  if (!data.typePiece || data.typePiece.trim().length < 2) erreurs.push('type de pièce');

  const formations = Array.isArray(data.formations) ? data.formations : [data.formations];
  if (!formations || !formations.some(f => CONFIG.FORMATIONS_VALIDES.includes(f)))
    erreurs.push('formation(s)');

  return erreurs;
}

function validerFichiersInscription(data) {
  const erreurs = [];
  if (!data.piece1Base64 || data.piece1Base64.length < 4)
    erreurs.push('La pièce d\'identité (acte ou CIP) est obligatoire.');
  if (!data.photoBase64 || data.photoBase64.length < 4)
    erreurs.push('La photo d\'identité est obligatoire.');
  // Preuve de paiement : optionnelle — pas de validation bloquante
  return erreurs;
}

function validerDonneesRenseignement(data) {
  const erreurs = [];
  if (!data.prenom    || data.prenom.trim().length < 2)    erreurs.push('prénom');
  if (!data.nom       || data.nom.trim().length < 2)       erreurs.push('nom');
  if (!data.telephone || data.telephone.trim().length < 8)  erreurs.push('téléphone');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) erreurs.push('email');
  return erreurs;
}


// =====================================================================
// DRIVE — Création arborescence + upload fichiers base64
// Structure : [Racine LQD] → [Formation ou Multi-formations] → [ID — Prénom Nom]
// =====================================================================
function creerStructureDrive(inscription, data) {

  // Dossier racine
  let racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (!racine) racine = DriveApp.createFolder(CONFIG.DRIVE_DOSSIER_NOM);

  // Sous-dossier par catégorie
  const nomCategorie = inscription.formations.length === 1
    ? inscription.formations[0]
    : 'Multi-formations';

  let dossierCat = trouverSousDossier(racine, nomCategorie);
  if (!dossierCat) dossierCat = racine.createFolder(nomCategorie);

  // Dossier apprenant
  const nomApprenant  = `${inscription.id} — ${inscription.prenom} ${inscription.nom}`;
  const dossierApprenant = dossierCat.createFolder(nomApprenant);

  // Upload pièce identité (obligatoire)
  const p1Mime = data.piece1MimeType || 'image/jpeg';
  const pieceUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.piece1Base64,
    `piece-identite_${inscription.id}.${extensionDepuisMime(p1Mime)}`,
    p1Mime
  );

  // Upload photo identité (obligatoire)
  const phMime = data.photoMimeType || 'image/jpeg';
  const photoUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.photoBase64,
    `photo-identite_${inscription.id}.${extensionDepuisMime(phMime)}`,
    phMime
  );

  // Upload preuve paiement (optionnelle)
  let preuveUrl = '';
  if (data.preuveBase64 && data.preuveBase64.length > 10) {
    const prMime = data.preuveMimeType || 'image/jpeg';
    preuveUrl = sauvegarderFichierDrive(
      dossierApprenant,
      data.preuveBase64,
      `preuve-paiement_${inscription.id}.${extensionDepuisMime(prMime)}`,
      prMime
    );
  }

  return { pieceUrl, photoUrl, preuveUrl, dossierUrl: dossierApprenant.getUrl() };
}

function sauvegarderFichierDrive(dossier, base64, nom, mimeType) {
  const octets  = Utilities.base64Decode(base64);
  const blob    = Utilities.newBlob(octets, mimeType, nom);
  const fichier = dossier.createFile(blob);
  // Accès lecture pour tout utilisateur avec le lien
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return fichier.getUrl();
}

function extensionDepuisMime(mime) {
  const map = {
    'image/jpeg':      'jpg',
    'image/jpg':       'jpg',
    'image/png':       'png',
    'application/pdf': 'pdf'
  };
  return map[mime] || 'bin';
}


// =====================================================================
// GOOGLE SHEETS — Enregistrement inscription
// =====================================================================
function enregistrerInscription(inscription, montants, formations) {

  let ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    const defaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (defaut) ss.deleteSheet(defaut);
  }

  const ligne = [
    inscription.id,
    inscription.date,
    inscription.prenom,
    inscription.nom,
    inscription.telephone,
    inscription.email,
    inscription.formationsLabel,
    inscription.nbFormations,
    inscription.message,
    inscription.statut,
    inscription.typePiece,
    inscription.pieceUrl,
    inscription.photoUrl,
    inscription.preuveUrl || '—',
    inscription.dossierUrl,
    montants.fraisInscription,
    montants.coutTotal,
    montants.tranche1,
    montants.tranche2,
    montants.tranche3,
    montants.premierVirement,
    inscription.statutPaiement,
    inscription.rappelEnvoye
  ];

  // Feuille maître (toutes les inscriptions)
  ajouterLigneFeuille(ss, 'Toutes les inscriptions', ENTETES_INSCRIPTION, ligne);

  // Feuille par catégorie
  const nomFeuille = formations.length === 1 ? formations[0] : 'Multi-formations';
  ajouterLigneFeuille(ss, nomFeuille, ENTETES_INSCRIPTION, ligne);
}


// =====================================================================
// GOOGLE SHEETS — Enregistrement renseignement
// =====================================================================
function enregistrerRenseignement(renseignement) {

  let ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    const defaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (defaut) ss.deleteSheet(defaut);
  }

  const ligne = [
    renseignement.id,
    renseignement.date,
    renseignement.prenom,
    renseignement.nom,
    renseignement.telephone,
    renseignement.email,
    renseignement.formations,
    renseignement.question,
    renseignement.statut
  ];

  ajouterLigneFeuille(ss, 'Renseignements', ENTETES_RENSEIGNEMENT, ligne);
}


// =====================================================================
// HELPER — Créer/alimenter une feuille Sheets
// =====================================================================
function ajouterLigneFeuille(ss, nomFeuille, entetes, ligne) {

  let feuille = ss.getSheetByName(nomFeuille);

  if (!feuille) {
    feuille = ss.insertSheet(nomFeuille);
    feuille.appendRow(entetes);

    const rangeEntete = feuille.getRange(1, 1, 1, entetes.length);
    rangeEntete.setBackground(CONFIG.COULEUR_TEAL);
    rangeEntete.setFontColor('#FFFFFF');
    rangeEntete.setFontWeight('bold');
    rangeEntete.setFontSize(11);
    feuille.setFrozenRows(1);

    const largeurs = [120,160,110,110,140,180,260,80,200,120,140,200,200,200,200,110,110,110,110,110,140,120,140];
    largeurs.forEach((l, i) => { if (i < entetes.length) feuille.setColumnWidth(i + 1, l); });
  }

  feuille.appendRow(ligne);

  const derniereLigne = feuille.getLastRow();
  if (derniereLigne % 2 === 0) {
    feuille.getRange(derniereLigne, 1, 1, entetes.length).setBackground('#F0F9FA');
  }
}


// =====================================================================
// MISE À JOUR D'UNE COLONNE dans Sheets
// =====================================================================
function mettreAJourColonne(id, nomFeuille, nomColonne, valeur) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return;
  const feuille = ss.getSheetByName(nomFeuille);
  if (!feuille) return;
  const indexCol = ENTETES_INSCRIPTION.indexOf(nomColonne) + 1;
  if (indexCol < 1) return;
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (donnees[i][0] === id) { feuille.getRange(i + 1, indexCol).setValue(valeur); return; }
  }
}


// =====================================================================
// RAPPEL J+1
// =====================================================================
function programmerRappelJ1(inscription) {
  PropertiesService.getScriptProperties().setProperty(
    'RAPPEL_' + inscription.id,
    JSON.stringify(inscription)
  );
  ScriptApp.newTrigger('envoyerRappelJ1')
    .timeBased()
    .after(24 * 60 * 60 * 1000)
    .create();
}

function envoyerRappelJ1() {
  const props = PropertiesService.getScriptProperties().getProperties();
  for (const cle in props) {
    if (!cle.startsWith('RAPPEL_')) continue;
    try {
      const inscription = JSON.parse(props[cle]);
      if (!inscription.email) {
        PropertiesService.getScriptProperties().deleteProperty(cle);
        continue;
      }
      const montants = calculerMontantsTotal(inscription.formations || []);
      GmailApp.sendEmail(
        inscription.email,
        `Rappel — votre dossier d'inscription — LQD Service`,
        `Bonjour ${inscription.prenom}, rappel de votre dossier. Réf: ${inscription.id}.`,
        {
          htmlBody:  construireEmailApprenant(inscription, montants, true),
          name:      CONFIG.EXPEDITEUR_NOM,
          replyTo:   CONFIG.ADMIN_EMAIL
        }
      );
      mettreAJourColonne(inscription.id, 'Toutes les inscriptions', 'Rappel J+1 envoyé', 'Oui');
      PropertiesService.getScriptProperties().deleteProperty(cle);
    } catch (err) {
      console.error('[Rappel J+1]', cle, err.toString());
    }
  }
  nettoyerTriggers('envoyerRappelJ1');
}


// =====================================================================
// EMAILS — Inscription
// =====================================================================
function envoyerEmailAdmin(inscription, montants) {
  GmailApp.sendEmail(
    CONFIG.ADMIN_EMAIL,
    `[Inscription] ${inscription.prenom} ${inscription.nom} — ${inscription.formationsLabel}`,
    `Nouveau dossier ${inscription.id}. Tél: ${inscription.telephone}.`,
    {
      htmlBody: construireEmailAdmin(inscription, montants),
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  inscription.email || CONFIG.ADMIN_EMAIL
    }
  );
}

function envoyerEmailApprenant(inscription, montants) {
  if (!inscription.email) return;
  GmailApp.sendEmail(
    inscription.email,
    `Dossier reçu — ${inscription.formationsLabel} — LQD Service`,
    `Bonjour ${inscription.prenom}, dossier ${inscription.id} bien reçu.`,
    {
      htmlBody: construireEmailApprenant(inscription, montants, false),
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  CONFIG.ADMIN_EMAIL
    }
  );
}

function envoyerEmailVirement(inscription, montants) {
  if (!inscription.email) return;
  GmailApp.sendEmail(
    inscription.email,
    `Coordonnées bancaires — ${inscription.formationsLabel} — LQD Service`,
    `Bonjour ${inscription.prenom}, voici vos coordonnées de virement. Réf: ${inscription.id}.`,
    {
      htmlBody: construireEmailVirement(inscription, montants),
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  CONFIG.ADMIN_EMAIL
    }
  );
}


// =====================================================================
// EMAILS — Renseignement
// =====================================================================
function envoyerEmailAdminRenseignement(renseignement) {
  GmailApp.sendEmail(
    CONFIG.ADMIN_EMAIL,
    `[Renseignement] ${renseignement.prenom} ${renseignement.nom} — ${renseignement.formations}`,
    `Nouvelle demande ${renseignement.id}. Tél: ${renseignement.telephone}.`,
    {
      htmlBody: construireEmailAdminRenseignement(renseignement),
      name:     CONFIG.EXPEDITEUR_NOM
    }
  );
}

function envoyerEmailAutoReponseRenseignement(renseignement) {
  if (!renseignement.email) return;
  GmailApp.sendEmail(
    renseignement.email,
    `Votre demande de renseignement — LQD Service`,
    `Bonjour ${renseignement.prenom}, demande ${renseignement.id} bien reçue. Réponse sous 24 h.`,
    {
      htmlBody: construireEmailAutoReponseRenseignement(renseignement),
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  CONFIG.ADMIN_EMAIL
    }
  );
}


// =====================================================================
// TEMPLATES EMAIL — Admin inscription
// =====================================================================
function construireEmailAdmin(inscription, montants) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>
  </td></tr>

  <tr><td style="background:${CONFIG.COULEUR_ORANGE};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">NOUVELLE INSCRIPTION REÇUE</p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">
      <tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_TEAL};font-size:12px;text-transform:uppercase;">Identité</td></tr>
      ${ligneInfoEmail('Référence',          inscription.id)}
      ${ligneInfoEmail('Date',               inscription.date)}
      ${ligneInfoEmail('Prénom',             inscription.prenom)}
      ${ligneInfoEmail('Nom',                inscription.nom)}
      ${ligneInfoEmail('Téléphone',          inscription.telephone)}
      ${ligneInfoEmail('Email',              inscription.email || '—')}
      ${ligneInfoEmailAccent('Formation(s)', inscription.formationsLabel)}
      ${ligneInfoEmail('Nb formations',      inscription.nbFormations)}
      ${ligneInfoEmail('Type pièce',         inscription.typePiece)}
      ${inscription.message ? ligneInfoEmail('Message', inscription.message) : ''}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">
      <tr style="background:#FFF6E5;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_ORANGE};font-size:12px;text-transform:uppercase;">Montants</td></tr>
      ${ligneInfoEmail('Frais d\'inscription',    formatFCFA(montants.fraisInscription))}
      ${ligneInfoEmail('Coût total formations',   formatFCFA(montants.coutTotal))}
      ${ligneInfoEmail('Tranche 1 — 50%',         formatFCFA(montants.tranche1))}
      ${ligneInfoEmail('Tranche 2 — 25%',         formatFCFA(montants.tranche2))}
      ${ligneInfoEmail('Tranche 3 — 25%',         formatFCFA(montants.tranche3))}
      ${ligneInfoEmailAccent('1er versement dû',  formatFCFA(montants.premierVirement))}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_TEAL};font-size:12px;text-transform:uppercase;">Pièces Drive</td></tr>
      ${ligneInfoEmail('Pièce identité',   `<a href="${inscription.pieceUrl}"  style="color:${CONFIG.COULEUR_TEAL};font-weight:600;">Ouvrir</a>`)}
      ${ligneInfoEmail('Photo identité',   `<a href="${inscription.photoUrl}"  style="color:${CONFIG.COULEUR_TEAL};font-weight:600;">Ouvrir</a>`)}
      ${inscription.preuveUrl && inscription.preuveUrl !== '—'
        ? ligneInfoEmail('Preuve paiement', `<a href="${inscription.preuveUrl}" style="color:${CONFIG.COULEUR_TEAL};font-weight:600;">Ouvrir</a>`)
        : ligneInfoEmail('Preuve paiement', '— (non fournie à l\'inscription)')}
      ${ligneInfoEmail('Dossier complet',  `<a href="${inscription.dossierUrl}" style="color:${CONFIG.COULEUR_TEAL};font-weight:600;">Ouvrir le dossier</a>`)}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="tel:${inscription.telephone.replace(/[\s+]/g,'')}"
             style="display:block;text-align:center;background:${CONFIG.COULEUR_TEAL};color:#FFF;font-size:14px;font-weight:700;padding:13px;border-radius:10px;text-decoration:none;">
            Appeler l'apprenant
          </a>
        </td>
        ${inscription.email ? `
        <td style="padding-left:8px;">
          <a href="mailto:${inscription.email}"
             style="display:block;text-align:center;background:#F3F4F6;color:#1A1A2E;font-size:14px;font-weight:700;padding:13px;border-radius:10px;text-decoration:none;border:1px solid #E5E7EB;">
            Envoyer un email
          </a>
        </td>` : ''}
      </tr>
    </table>

  </td></tr>
  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;
}


// =====================================================================
// TEMPLATES EMAIL — Apprenant (confirmation + rappel J+1)
// =====================================================================
function construireEmailApprenant(inscription, montants, estRappel) {
  const intro = estRappel
    ? `Bonjour <strong>${inscription.prenom}</strong>,<br/><br/>
       Rappel : votre dossier d'inscription à <strong>${inscription.formationsLabel}</strong>
       est en attente de votre virement bancaire.`
    : `Bonjour <strong>${inscription.prenom}</strong>,<br/><br/>
       Votre dossier d'inscription à <strong>${inscription.formationsLabel}</strong>
       a bien été reçu et enregistré. Notre équipe vous contactera dans les <strong>24 heures</strong>.`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>
  </td></tr>

  <tr><td style="background:${estRappel ? CONFIG.COULEUR_ORANGE : CONFIG.COULEUR_TEAL};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">
      ${estRappel ? 'RAPPEL — VOTRE DOSSIER VOUS ATTEND' : 'DOSSIER BIEN REÇU'}
    </p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">
    <p style="margin:0 0 24px;font-size:15px;color:#444455;line-height:1.75;">${intro}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">
      <tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_TEAL};font-size:12px;text-transform:uppercase;">Récapitulatif</td></tr>
      ${ligneInfoEmail('Numéro de dossier',  inscription.id)}
      ${ligneInfoEmail('Date',               inscription.date)}
      ${ligneInfoEmail('Prénom et nom',      inscription.prenom + ' ' + inscription.nom)}
      ${ligneInfoEmailAccent('Formation(s)', inscription.formationsLabel)}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#FFF6E5;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_ORANGE};font-size:12px;text-transform:uppercase;">Plan de paiement</td></tr>
      ${ligneInfoEmail('Frais d\'inscription (immédiat)',  formatFCFA(montants.fraisInscription))}
      ${ligneInfoEmail('Tranche 1 — 50% (immédiat)',      formatFCFA(montants.tranche1))}
      ${ligneInfoEmail('Tranche 2 — 25% (milieu)',        formatFCFA(montants.tranche2))}
      ${ligneInfoEmail('Tranche 3 — 25% (fin)',           formatFCFA(montants.tranche3))}
      ${ligneInfoEmailAccent('1er virement dû',           formatFCFA(montants.premierVirement))}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FA;border-left:4px solid ${CONFIG.COULEUR_TEAL};border-radius:0 10px 10px 0;margin-bottom:28px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 6px;font-weight:700;font-size:14px;color:${CONFIG.COULEUR_DARK};">Prochaine étape</p>
        <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.65;">
          Effectuez votre virement en mentionnant la référence
          <strong>${inscription.id}</strong> dans le motif.
          Un email séparé vous envoie les coordonnées bancaires.
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="https://wa.me/${CONFIG.WHATSAPP}?text=Bonjour,%20réf.%20${inscription.id},%20${encodeURIComponent(inscription.prenom + ' ' + inscription.nom)}."
           style="display:inline-block;background:#25D366;color:#FFF;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
          Nous contacter sur WhatsApp
        </a>
      </td></tr>
    </table>

  </td></tr>

  <tr><td style="background:#F8FAFA;border:1px solid #E5E7EB;border-top:none;padding:22px 36px;">
    <p style="font-size:13px;color:#6B7280;line-height:1.7;margin:0;">
      <strong style="color:${CONFIG.COULEUR_DARK};">LES QUALITÉS DE DIEU SERVICE SARL</strong><br/>
      Comé, Hongodé — Route à Akodéha, à côté de la Pharmacie Sainte-Croix, Bénin<br/>
      Tél / WhatsApp :
      <a href="tel:+22997951230" style="color:${CONFIG.COULEUR_TEAL};font-weight:600;text-decoration:none;">+229 01 97 95 12 30</a>
    </p>
  </td></tr>

  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;
}


// =====================================================================
// TEMPLATES EMAIL — Virement bancaire
// =====================================================================
function construireEmailVirement(inscription, montants) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>
  </td></tr>

  <tr><td style="background:${CONFIG.COULEUR_ORANGE};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">COORDONNÉES BANCAIRES POUR VIREMENT</p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">

    <p style="margin:0 0 24px;font-size:15px;color:#444455;line-height:1.75;">
      Bonjour <strong>${inscription.prenom}</strong>,<br/><br/>
      Effectuez votre virement avec les coordonnées ci-dessous.
      Mentionnez impérativement la référence <strong>${inscription.id}</strong> dans le motif.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">
      <tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_TEAL};font-size:12px;text-transform:uppercase;">Coordonnées bancaires</td></tr>
      ${ligneInfoEmailAccent('Titulaire',      CONFIG.BANQUE.TITULAIRE)}
      ${ligneInfoEmail('Banque',               CONFIG.BANQUE.NOM_BANQUE    || '— UBA Bénin')}
      ${ligneInfoEmail('N° de compte',         CONFIG.BANQUE.NUMERO_COMPTE || '— 541 4114 xxxx xxxx xxxx')}
      ${CONFIG.BANQUE.CODE_BANQUE  ? ligneInfoEmail('Code banque',  CONFIG.BANQUE.CODE_BANQUE)  : ''}
      ${CONFIG.BANQUE.CODE_AGENCE  ? ligneInfoEmail('Code agence',  CONFIG.BANQUE.CODE_AGENCE)  : ''}
      ${ligneInfoEmailAccent('Motif du virement', `${inscription.id} — ${inscription.formationsLabel}`)}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#FFF6E5;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_ORANGE};font-size:12px;text-transform:uppercase;">Montant du 1er virement</td></tr>
      ${ligneInfoEmail('Frais d\'inscription', formatFCFA(montants.fraisInscription))}
      ${ligneInfoEmail('Tranche 1 — 50%',     formatFCFA(montants.tranche1))}
      ${ligneInfoEmailAccent('TOTAL À VIRER', formatFCFA(montants.premierVirement))}
    </table>

    <p style="margin:0;font-size:13px;color:#6B7280;background:#FFF6E5;padding:16px 18px;border-radius:10px;border-left:4px solid ${CONFIG.COULEUR_ORANGE};line-height:1.65;">
      Après votre virement, envoyez la preuve de paiement par WhatsApp au
      <a href="https://wa.me/${CONFIG.WHATSAPP}" style="color:${CONFIG.COULEUR_ORANGE};font-weight:600;text-decoration:none;">+229 01 97 95 12 30</a>.
      Votre place est confirmée à réception.
    </p>

  </td></tr>
  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;
}


// =====================================================================
// TEMPLATES EMAIL — Admin renseignement
// =====================================================================
function construireEmailAdminRenseignement(renseignement) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>
  </td></tr>

  <tr><td style="background:${CONFIG.COULEUR_TEAL};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">NOUVELLE DEMANDE DE RENSEIGNEMENT</p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_TEAL};font-size:12px;text-transform:uppercase;">Contact</td></tr>
      ${ligneInfoEmail('Référence',                renseignement.id)}
      ${ligneInfoEmail('Date',                     renseignement.date)}
      ${ligneInfoEmail('Prénom',                   renseignement.prenom)}
      ${ligneInfoEmail('Nom',                      renseignement.nom)}
      ${ligneInfoEmail('Téléphone',                renseignement.telephone)}
      ${ligneInfoEmail('Email',                    renseignement.email || '—')}
      ${ligneInfoEmailAccent('Formation(s) d\'intérêt', renseignement.formations)}
      ${renseignement.question ? ligneInfoEmail('Question / Message', renseignement.question) : ''}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="tel:${renseignement.telephone.replace(/[\s+]/g,'')}"
             style="display:block;text-align:center;background:${CONFIG.COULEUR_TEAL};color:#FFF;font-size:14px;font-weight:700;padding:13px;border-radius:10px;text-decoration:none;">
            Appeler
          </a>
        </td>
        ${renseignement.email ? `
        <td style="padding-left:8px;">
          <a href="mailto:${renseignement.email}"
             style="display:block;text-align:center;background:#F3F4F6;color:#1A1A2E;font-size:14px;font-weight:700;padding:13px;border-radius:10px;text-decoration:none;border:1px solid #E5E7EB;">
            Envoyer un email
          </a>
        </td>` : ''}
      </tr>
    </table>

  </td></tr>
  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;
}


// =====================================================================
// TEMPLATES EMAIL — Auto-réponse renseignement
// =====================================================================
function construireEmailAutoReponseRenseignement(renseignement) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>
  </td></tr>

  <tr><td style="background:${CONFIG.COULEUR_TEAL};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">VOTRE DEMANDE A ÉTÉ REÇUE</p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">

    <p style="margin:0 0 24px;font-size:15px;color:#444455;line-height:1.75;">
      Bonjour <strong>${renseignement.prenom}</strong>,<br/><br/>
      Nous avons bien reçu votre demande de renseignement concernant
      <strong>${renseignement.formations}</strong>.
      Notre équipe vous répondra dans les <strong>24 heures</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FA;border-left:4px solid ${CONFIG.COULEUR_TEAL};border-radius:0 10px 10px 0;margin-bottom:28px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:${CONFIG.COULEUR_DARK};">Référence : ${renseignement.id}</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Conservez cette référence pour tout suivi.</p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="https://wa.me/${CONFIG.WHATSAPP}"
           style="display:inline-block;background:#25D366;color:#FFF;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
          Contacter sur WhatsApp
        </a>
      </td></tr>
    </table>

  </td></tr>

  <tr><td style="background:#F8FAFA;border:1px solid #E5E7EB;border-top:none;padding:22px 36px;">
    <p style="font-size:13px;color:#6B7280;line-height:1.7;margin:0;">
      <strong style="color:${CONFIG.COULEUR_DARK};">LES QUALITÉS DE DIEU SERVICE SARL</strong><br/>
      Comé, Hongodé — Route à Akodéha, Bénin<br/>
      Tél :
      <a href="tel:+22997951230" style="color:${CONFIG.COULEUR_TEAL};font-weight:600;text-decoration:none;">+229 01 97 95 12 30</a>
    </p>
  </td></tr>

  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;
}


// =====================================================================
// COMPOSANTS EMAIL RÉUTILISABLES
// =====================================================================
function ligneInfoEmail(label, valeur) {
  return `<tr style="border-top:1px solid #F3F4F6;">
    <td style="padding:11px 18px;color:#6B7280;font-size:13px;width:40%;vertical-align:top;">${label}</td>
    <td style="padding:11px 18px;color:#1A1A2E;font-size:13px;font-weight:500;vertical-align:top;">${valeur || '—'}</td>
  </tr>`;
}

function ligneInfoEmailAccent(label, valeur) {
  return `<tr style="border-top:1px solid #F3F4F6;background:#FFF6E5;">
    <td style="padding:11px 18px;color:#6B7280;font-size:13px;width:40%;vertical-align:top;">${label}</td>
    <td style="padding:11px 18px;font-size:13px;font-weight:700;color:${CONFIG.COULEUR_ORANGE};vertical-align:top;">${valeur || '—'}</td>
  </tr>`;
}

function piedDePageEmail() {
  return `<tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.7;">
      © ${new Date().getFullYear()} Les Qualités de Dieu Service SARL — Tous droits réservés<br/>
      Email automatique. Ne pas répondre directement.<br/>
      <a href="${CONFIG.SITE_URL}" style="color:${CONFIG.COULEUR_ORANGE};text-decoration:none;">Visiter notre site</a>
    </p>
  </td></tr>`;
}

function formatFCFA(n) {
  return Number(n || 0).toLocaleString('fr-BJ') + ' F CFA';
}


// =====================================================================
// UTILITAIRES
// =====================================================================
function trouverSpreadsheet(nom) {
  const f = DriveApp.getFilesByName(nom);
  return f.hasNext() ? SpreadsheetApp.openById(f.next().getId()) : null;
}

function trouverDossierDrive(nom) {
  const d = DriveApp.getFoldersByName(nom);
  return d.hasNext() ? d.next() : null;
}

function trouverSousDossier(parent, nom) {
  const s = parent.getFoldersByName(nom);
  return s.hasNext() ? s.next() : null;
}

function genererID(prefix) {
  prefix    = prefix || 'LQD';
  const now = new Date();
  const aa  = now.getFullYear().toString().slice(-2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const jj  = String(now.getDate()).padStart(2, '0');
  const rand= Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${aa}${mm}${jj}-${rand}`;
}

function nettoyer(str) {
  return String(str).trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 500);
}

function reponseJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nettoyerTriggers(nomFonction) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === nomFonction) ScriptApp.deleteTrigger(t);
  });
}

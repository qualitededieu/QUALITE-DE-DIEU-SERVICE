/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Initialisation GAS
   Fichier  : init.gs
   Version  : 1.0.0
   Auteur   : LQD Web Studio / PHANOS KOSMOS

   USAGE :
     Exécuter une seule fois depuis l'éditeur GAS AVANT le déploiement.
     Sélectionner la fonction dans le menu déroulant → Exécuter.

     Ordre recommandé :
       1. initDrive()   → Crée la structure de dossiers Google Drive
       2. initSheets()  → Crée le Spreadsheet avec tous les onglets
       3. verifierInit()→ Vérifie que tout est en place (optionnel)
   ===================================================================== */


// =====================================================================
// INIT DRIVE — Crée la structure complète de dossiers
// =====================================================================
function initDrive() {
  Logger.log('=== INIT DRIVE — Démarrage ===');

  // ---- Dossier racine ----
  let racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (racine) {
    Logger.log('[DRIVE] Dossier racine déjà existant : ' + CONFIG.DRIVE_DOSSIER_NOM);
  } else {
    racine = DriveApp.createFolder(CONFIG.DRIVE_DOSSIER_NOM);
    Logger.log('[DRIVE] Dossier racine créé : ' + CONFIG.DRIVE_DOSSIER_NOM);
  }

  // ---- Sous-dossiers par formation ----
  const categories = CONFIG.FORMATIONS_VALIDES.concat(['Multi-formations']);

  categories.forEach(function(nom) {
    let dossier = trouverSousDossier(racine, nom);
    if (dossier) {
      Logger.log('[DRIVE] Dossier déjà existant : ' + nom);
    } else {
      racine.createFolder(nom);
      Logger.log('[DRIVE] Dossier créé : ' + nom);
    }
  });

  Logger.log('');
  Logger.log('=== INIT DRIVE — Terminé ===');
  Logger.log('URL Drive racine : ' + racine.getUrl());
  Logger.log('Ouvrir dans Drive : https://drive.google.com/drive/folders/' + racine.getId());
}


// =====================================================================
// INIT SHEETS — Crée le Spreadsheet avec tous les onglets
// =====================================================================
function initSheets() {
  Logger.log('=== INIT SHEETS — Démarrage ===');

  // ---- Récupérer ou créer le Spreadsheet ----
  let ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);

  if (ss) {
    Logger.log('[SHEETS] Spreadsheet déjà existant : ' + CONFIG.SPREADSHEET_NAME);
  } else {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    Logger.log('[SHEETS] Spreadsheet créé : ' + CONFIG.SPREADSHEET_NAME);

    // Supprimer la feuille vide créée par défaut
    const feuilleDefaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (feuilleDefaut) {
      ss.deleteSheet(feuilleDefaut);
      Logger.log('[SHEETS] Feuille par défaut supprimée.');
    }
  }

  // ---- Créer l'onglet "Toutes les inscriptions" (feuille maître) ----
  creerOngletInscription(ss, 'Toutes les inscriptions', true);

  // ---- Créer un onglet par formation ----
  CONFIG.FORMATIONS_VALIDES.forEach(function(formation) {
    creerOngletInscription(ss, formation, false);
  });

  // ---- Créer l'onglet "Multi-formations" ----
  creerOngletInscription(ss, 'Multi-formations', false);

  // ---- Créer l'onglet "Renseignements" ----
  creerOngletRenseignement(ss);

  // ---- Créer l'onglet "Tableau de bord" ----
  creerOngletDashboard(ss);

  // ---- Réordonner les feuilles ----
  const ordreOnglets = [
    'Tableau de bord',
    'Toutes les inscriptions',
    'Informatique & Bureautique',
    'Graphisme & PAO',
    'Sérigraphie',
    'Création de sites web',
    'Multi-formations',
    'Renseignements'
  ];

  ordreOnglets.forEach(function(nom, index) {
    const feuille = ss.getSheetByName(nom);
    if (feuille) ss.setActiveSheet(feuille);
    if (feuille) ss.moveActiveSheet(index + 1);
  });

  // Activer la première feuille (dashboard)
  const dashboard = ss.getSheetByName('Tableau de bord');
  if (dashboard) ss.setActiveSheet(dashboard);

  Logger.log('');
  Logger.log('=== INIT SHEETS — Terminé ===');
  Logger.log('URL Spreadsheet : ' + ss.getUrl());
  Logger.log('Ouvrir le Spreadsheet : ' + ss.getUrl());
}


// =====================================================================
// HELPER — Créer un onglet Inscription avec entêtes et style
// =====================================================================
function creerOngletInscription(ss, nomFeuille, estMaitre) {

  let feuille = ss.getSheetByName(nomFeuille);

  if (feuille) {
    Logger.log('[SHEETS] Onglet déjà existant : ' + nomFeuille);
    return feuille;
  }

  feuille = ss.insertSheet(nomFeuille);
  Logger.log('[SHEETS] Onglet créé : ' + nomFeuille);

  // ---- En-têtes ----
  feuille.appendRow(ENTETES_INSCRIPTION);

  // ---- Style en-têtes ----
  const couleurEntete = estMaitre ? '#04342C' : CONFIG.COULEUR_TEAL;
  const rangeEntete   = feuille.getRange(1, 1, 1, ENTETES_INSCRIPTION.length);
  rangeEntete.setBackground(couleurEntete);
  rangeEntete.setFontColor('#FFFFFF');
  rangeEntete.setFontWeight('bold');
  rangeEntete.setFontSize(11);
  rangeEntete.setVerticalAlignment('middle');
  feuille.setFrozenRows(1);

  // ---- Hauteur ligne entête ----
  feuille.setRowHeight(1, 36);

  // ---- Largeurs des colonnes (ordre = ENTETES_INSCRIPTION) ----
  const largeurs = [
    120,  // ID
    160,  // Date
    110,  // Prénom
    110,  // Nom
    150,  // Téléphone
    180,  // Email
    260,  // Formations
    80,   // Nombre formations
    200,  // Message
    120,  // Statut dossier
    160,  // Type pièce
    200,  // Pièce identité URL
    200,  // Photo identité URL
    200,  // Preuve paiement URL
    200,  // Dossier Drive URL
    120,  // Frais inscription
    120,  // Coût total
    120,  // Tranche 1
    120,  // Tranche 2
    120,  // Tranche 3
    140,  // 1er versement
    120,  // Statut paiement
    140   // Rappel J+1
  ];
  largeurs.forEach(function(l, i) {
    if (i < ENTETES_INSCRIPTION.length) feuille.setColumnWidth(i + 1, l);
  });

  // ---- Validation statut dossier (colonne 10) ----
  const regleStatut = SpreadsheetApp.newDataValidation()
    .requireValueInList(['En attente', 'Confirmé', 'Annulé'], true)
    .setAllowInvalid(false)
    .build();
  feuille.getRange('J2:J1000').setDataValidation(regleStatut);

  // ---- Validation statut paiement (colonne 22) ----
  const reglePaiement = SpreadsheetApp.newDataValidation()
    .requireValueInList(['En attente', 'Reçu', 'Vérifié'], true)
    .setAllowInvalid(false)
    .build();
  feuille.getRange('V2:V1000').setDataValidation(reglePaiement);

  // ---- Mise en forme montants (colonnes 16 à 21) ----
  feuille.getRange('P2:U1000').setNumberFormat('#,##0 "F CFA"');

  // ---- Ligne exemple (grisée, à supprimer avant usage) ----
  if (estMaitre) {
    const ligneEx = [
      'LQD-EXEMPLE', 'JJ/MM/AAAA HH:MM', 'Prénom', 'Nom',
      '+229 01 XX XX XX XX', 'email@exemple.com',
      'Informatique & Bureautique', '1', 'Message exemple',
      'En attente', 'CIP', '(lien Drive)', '(lien Drive)', '—', '(lien Drive)',
      10000, 50000, 25000, 12500, 12500, 35000, 'En attente', 'Non'
    ];
    feuille.appendRow(ligneEx);
    feuille.getRange(2, 1, 1, ENTETES_INSCRIPTION.length)
           .setBackground('#F3F4F6')
           .setFontColor('#9CA3AF')
           .setFontStyle('italic');
    Logger.log('[SHEETS] Ligne exemple ajoutée dans : ' + nomFeuille + ' (à supprimer avant usage)');
  }

  return feuille;
}


// =====================================================================
// HELPER — Créer l'onglet Renseignements
// =====================================================================
function creerOngletRenseignement(ss) {

  let feuille = ss.getSheetByName('Renseignements');

  if (feuille) {
    Logger.log('[SHEETS] Onglet déjà existant : Renseignements');
    return feuille;
  }

  feuille = ss.insertSheet('Renseignements');
  Logger.log('[SHEETS] Onglet créé : Renseignements');

  // En-têtes
  feuille.appendRow(ENTETES_RENSEIGNEMENT);

  const rangeEntete = feuille.getRange(1, 1, 1, ENTETES_RENSEIGNEMENT.length);
  rangeEntete.setBackground('#7B2EFF');
  rangeEntete.setFontColor('#FFFFFF');
  rangeEntete.setFontWeight('bold');
  rangeEntete.setFontSize(11);
  rangeEntete.setVerticalAlignment('middle');
  feuille.setFrozenRows(1);
  feuille.setRowHeight(1, 36);

  const largeurs = [120, 160, 110, 110, 150, 180, 260, 300, 120];
  largeurs.forEach(function(l, i) { feuille.setColumnWidth(i + 1, l); });

  // Validation statut (colonne 9)
  const regle = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Nouveau', 'Traité', 'En cours'], true)
    .setAllowInvalid(false)
    .build();
  feuille.getRange('I2:I1000').setDataValidation(regle);

  return feuille;
}


// =====================================================================
// HELPER — Créer l'onglet Tableau de bord
// =====================================================================
function creerOngletDashboard(ss) {

  let feuille = ss.getSheetByName('Tableau de bord');

  if (feuille) {
    Logger.log('[SHEETS] Onglet déjà existant : Tableau de bord');
    return feuille;
  }

  feuille = ss.insertSheet('Tableau de bord');
  Logger.log('[SHEETS] Onglet créé : Tableau de bord');

  // Masquer la grille
  feuille.setHiddenGridlines(true);

  // ---- Titre ----
  feuille.getRange('B2').setValue('LES QUALITÉS DE DIEU SERVICE SARL')
    .setFontSize(16).setFontWeight('bold').setFontColor(CONFIG.COULEUR_DARK);
  feuille.getRange('B3').setValue('Tableau de bord — Inscriptions')
    .setFontSize(12).setFontColor(CONFIG.COULEUR_TEAL);

  // ---- Compteurs (formules dynamiques) ----
  feuille.getRange('B5').setValue('INSCRIPTIONS').setFontWeight('bold').setFontColor(CONFIG.COULEUR_TEAL).setFontSize(11);

  const compteurs = [
    ['Total inscriptions',          "=COUNTA('Toutes les inscriptions'!A:A)-1"],
    ['Informatique & Bureautique',  "=COUNTA('Informatique & Bureautique'!A:A)-1"],
    ['Graphisme & PAO',             "=COUNTA('Graphisme & PAO'!A:A)-1"],
    ['Sérigraphie',                 "=COUNTA('Sérigraphie'!A:A)-1"],
    ['Création de sites web',       "=COUNTA('Création de sites web'!A:A)-1"],
    ['Multi-formations',            "=COUNTA('Multi-formations'!A:A)-1"],
    ['Renseignements reçus',        "=COUNTA('Renseignements'!A:A)-1"]
  ];

  compteurs.forEach(function(item, index) {
    const ligne = 6 + index;
    feuille.getRange('B' + ligne).setValue(item[0]).setFontSize(11).setFontColor(CONFIG.COULEUR_DARK);
    feuille.getRange('C' + ligne).setFormula(item[1]).setFontSize(14).setFontWeight('bold').setFontColor(CONFIG.COULEUR_ORANGE);
  });

  // ---- Compteurs paiements ----
  const derniereLigne = 6 + compteurs.length + 1;
  feuille.getRange('B' + derniereLigne).setValue('PAIEMENTS').setFontWeight('bold').setFontColor(CONFIG.COULEUR_TEAL).setFontSize(11);
  feuille.getRange('B' + (derniereLigne + 1)).setValue('En attente').setFontSize(11);
  feuille.getRange('C' + (derniereLigne + 1)).setFormula("=COUNTIF('Toutes les inscriptions'!V:V,\"En attente\")").setFontSize(14).setFontWeight('bold').setFontColor('#E24B4A');
  feuille.getRange('B' + (derniereLigne + 2)).setValue('Reçus / Vérifiés').setFontSize(11);
  feuille.getRange('C' + (derniereLigne + 2)).setFormula("=COUNTIF('Toutes les inscriptions'!V:V,\"Reçu\")+COUNTIF('Toutes les inscriptions'!V:V,\"Vérifié\")").setFontSize(14).setFontWeight('bold').setFontColor(CONFIG.COULEUR_TEAL);

  // ---- Dernière mise à jour ----
  feuille.getRange('B' + (derniereLigne + 4)).setValue('Dernière mise à jour :').setFontSize(10).setFontColor(CONFIG.COULEUR_DARK);
  feuille.getRange('C' + (derniereLigne + 4)).setFormula('=NOW()').setFontSize(10).setFontColor(CONFIG.COULEUR_DARK).setNumberFormat('dd/mm/yyyy hh:mm');

  // Largeurs colonnes dashboard
  feuille.setColumnWidth(1, 30);
  feuille.setColumnWidth(2, 260);
  feuille.setColumnWidth(3, 100);

  return feuille;
}


// =====================================================================
// VERIFICATION — Vérifie que tout est en place après init
// =====================================================================
function verifierInit() {
  Logger.log('=== VÉRIFICATION INIT ===');
  Logger.log('');

  // ---- Drive ----
  Logger.log('--- DRIVE ---');
  const racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (racine) {
    Logger.log('[OK] Dossier racine : ' + CONFIG.DRIVE_DOSSIER_NOM);
    const categories = CONFIG.FORMATIONS_VALIDES.concat(['Multi-formations']);
    categories.forEach(function(nom) {
      const d = trouverSousDossier(racine, nom);
      Logger.log(d ? '[OK] Sous-dossier : ' + nom : '[MANQUANT] Sous-dossier : ' + nom);
    });
  } else {
    Logger.log('[MANQUANT] Dossier racine — exécuter initDrive()');
  }

  Logger.log('');

  // ---- Sheets ----
  Logger.log('--- SHEETS ---');
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (ss) {
    Logger.log('[OK] Spreadsheet : ' + CONFIG.SPREADSHEET_NAME);
    const onglets = [
      'Tableau de bord',
      'Toutes les inscriptions',
      'Informatique & Bureautique',
      'Graphisme & PAO',
      'Sérigraphie',
      'Création de sites web',
      'Multi-formations',
      'Renseignements'
    ];
    onglets.forEach(function(nom) {
      const f = ss.getSheetByName(nom);
      Logger.log(f ? '[OK] Onglet : ' + nom : '[MANQUANT] Onglet : ' + nom);
    });
  } else {
    Logger.log('[MANQUANT] Spreadsheet — exécuter initSheets()');
  }

  Logger.log('');
  Logger.log('=== FIN VÉRIFICATION ===');
}


// =====================================================================
// RESET — Supprime tout et recrée (ATTENTION : irréversible)
// Décommenter et exécuter uniquement en cas de besoin de repartir à zéro
// =====================================================================
/*
function resetComplet() {

  // SUPPRESSION SPREADSHEET
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (ss) {
    DriveApp.getFileById(ss.getId()).setTrashed(true);
    Logger.log('[RESET] Spreadsheet supprimé.');
  }

  // SUPPRESSION DOSSIER DRIVE RACINE (et tout son contenu)
  const racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (racine) {
    racine.setTrashed(true);
    Logger.log('[RESET] Dossier Drive supprimé.');
  }

  Logger.log('[RESET] Terminé. Relancer initDrive() puis initSheets().');
}
*/

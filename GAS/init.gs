const ENTETES_REG_INIT = [
  'ID Apprenant', 'Date soumission',
  'Prénom(s)', 'Nom', 'Sexe', 'Date de naissance', 'Lieu de naissance',
  'Nationalité', 'Téléphone', 'Email', 'Adresse',
  'Prénom mère', 'Nom mère', 'Téléphone mère', 'Profession mère',
  'Prénom père', 'Nom père', 'Téléphone père', 'Profession père',
  'Prénom tuteur', 'Nom tuteur',
  'Filière', 'Durée formation', "Date d'entrée", 'Date de fin',
  'Niveau atteint', 'Montant payé (F CFA)', 'Observations formation',
  'Type pièce identité', 'N° pièce identité',
  'Pièce identité (Drive)', 'Photo identité (Drive)',
  'Signature (Drive)', 'Dossier Drive',
  'Clause 1 acceptée', 'Clause 2 acceptée', 'Date signature',
  'Statut dossier', 'Traité par', 'Date traitement'
];

function initDrive() {
  Logger.log('=== INIT DRIVE — Démarrage ===');

  let racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (racine) {
    Logger.log('[DRIVE] Dossier racine déjà existant : ' + CONFIG.DRIVE_DOSSIER_NOM);
  } else {
    racine = DriveApp.createFolder(CONFIG.DRIVE_DOSSIER_NOM);
    Logger.log('[DRIVE] Dossier racine créé : ' + CONFIG.DRIVE_DOSSIER_NOM);
  }

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
}

function initSheets() {
  Logger.log('=== INIT SHEETS — Démarrage ===');

  let ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);

  if (ss) {
    Logger.log('[SHEETS] Spreadsheet déjà existant : ' + CONFIG.SPREADSHEET_NAME);
  } else {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    Logger.log('[SHEETS] Spreadsheet créé : ' + CONFIG.SPREADSHEET_NAME);

    const feuilleDefaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (feuilleDefaut) {
      ss.deleteSheet(feuilleDefaut);
      Logger.log('[SHEETS] Feuille par défaut supprimée.');
    }
  }

  creerOngletInscription(ss, 'Toutes les inscriptions', true);

  CONFIG.FORMATIONS_VALIDES.forEach(function(formation) {
    creerOngletInscription(ss, formation, false);
  });

  creerOngletInscription(ss, 'Multi-formations', false);
  creerOngletRenseignement(ss);
  creerOngletDashboard(ss);

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

  const dashboard = ss.getSheetByName('Tableau de bord');
  if (dashboard) ss.setActiveSheet(dashboard);

  Logger.log('');
  Logger.log('=== INIT SHEETS — Terminé ===');
  Logger.log('URL Spreadsheet : ' + ss.getUrl());
}

function repararEnTetesInscription() {
  Logger.log('=== RÉPARATION EN-TÊTES INSCRIPTION — Démarrage ===');

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) {
    Logger.log('[ERREUR] Spreadsheet introuvable : ' + CONFIG.SPREADSHEET_NAME);
    return;
  }

  const feuillesACorriger = ['Toutes les inscriptions']
    .concat(CONFIG.FORMATIONS_VALIDES)
    .concat(['Multi-formations']);

  feuillesACorriger.forEach(function(nomFeuille) {
    const feuille = ss.getSheetByName(nomFeuille);
    if (!feuille) {
      Logger.log('[IGNORÉ] Onglet introuvable (jamais créé) : ' + nomFeuille);
      return;
    }

    const estMaitre = (nomFeuille === 'Toutes les inscriptions');

    const largeurActuelle = feuille.getLastColumn();
    const enteteActuel = largeurActuelle > 0
      ? feuille.getRange(1, 1, 1, largeurActuelle).getValues()[0]
      : [];

    const correspond = enteteActuel.length === ENTETES_INSCRIPTION.length &&
      ENTETES_INSCRIPTION.every(function(titre, i) { return enteteActuel[i] === titre; });

    if (correspond) {
      Logger.log('[OK] En-tête déjà correct : ' + nomFeuille);
      return;
    }

    Logger.log('[CORRECTION] En-tête réécrit : ' + nomFeuille +
      ' (' + enteteActuel.length + ' colonne(s) trouvée(s) -> ' + ENTETES_INSCRIPTION.length + ' attendues)');

    _ecrireEnTeteInscription(feuille, estMaitre);
  });

  Logger.log('');
  Logger.log('=== RÉPARATION EN-TÊTES INSCRIPTION — Terminé ===');
}

function _ecrireEnTeteInscription(feuille, estMaitre) {
  feuille.getRange(1, 1, 1, ENTETES_INSCRIPTION.length).setValues([ENTETES_INSCRIPTION]);

  // Efface TOUTES les validations existantes sur toute la largeur/hauteur
  // de la feuille avant d'appliquer les nouvelles. Indispensable ici :
  // le schéma a été restructuré (colonnes déplacées), et Google Sheets
  // ne déplace jamais une validation existante — elle reste collée à
  // son ancienne colonne même si son contenu a changé de sens.
  feuille.getRange(1, 1, feuille.getMaxRows(), feuille.getMaxColumns()).clearDataValidations();

  const couleurEntete = estMaitre ? '#04342C' : CONFIG.COULEUR_TEAL;
  const rangeEntete    = feuille.getRange(1, 1, 1, ENTETES_INSCRIPTION.length);
  rangeEntete.setBackground(couleurEntete);
  rangeEntete.setFontColor('#FFFFFF');
  rangeEntete.setFontWeight('bold');
  rangeEntete.setFontSize(11);
  rangeEntete.setVerticalAlignment('middle');
  feuille.setFrozenRows(1);
  feuille.setRowHeight(1, 36);

  // ID, Date, Prénom, Nom, Sexe, DateNaiss, LieuNaiss, Nationalité, Adresse, Tél,
  // Email, PrénomMère, NomMère, TélMère, ProfMère, PrénomPère, NomPère, TélPère, ProfPère,
  // PrénomTuteur, NomTuteur, TélTuteur, Formations, NbFormations, DateEntrée, DateFin,
  // NiveauAtteint, Message, StatutDossier, TypePièce, NuméroPièce, PièceURL, PhotoURL,
  // SignatureURL, PreuveURL, DossierURL, Frais, CoûtTotal, Tr1, Tr2, Tr3, Versement,
  // PaiementUnique, StatutPaiement, RappelEnvoyé, Source
  const largeurs = [
    130, 150, 110, 110, 70, 110, 140, 110, 200, 140,
    180, 110, 110, 140, 130, 110, 110, 140, 130, 110,
    110, 140, 200, 90, 110, 110, 160, 220, 130, 160,
    150, 200, 200, 200, 200, 200, 110, 130, 110, 110,
    110, 130, 110, 160, 110, 160
  ];
  largeurs.forEach(function(l, i) {
    if (i < ENTETES_INSCRIPTION.length) feuille.setColumnWidth(i + 1, l);
  });

  const regleSexe = SpreadsheetApp.newDataValidation()
    .requireValueInList(['M', 'F'], true)
    .setAllowInvalid(false).build();
  feuille.getRange('E2:E1000').setDataValidation(regleSexe);

  const regleStatutDossier = SpreadsheetApp.newDataValidation()
    .requireValueInList(['En attente', 'Confirmé', 'Annulé', 'Migré'], true)
    .setAllowInvalid(false).build();
  feuille.getRange('AC2:AC1000').setDataValidation(regleStatutDossier);

  const reglePaiementUnique = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Oui', 'Non'], true)
    .setAllowInvalid(false).build();
  feuille.getRange('AQ2:AQ1000').setDataValidation(reglePaiementUnique);

  const reglePaiement = SpreadsheetApp.newDataValidation()
    .requireValueInList(['En attente', 'Reçu', 'Vérifié', 'Migré (voir montant payé)'], true)
    .setAllowInvalid(false).build();
  feuille.getRange('AR2:AR1000').setDataValidation(reglePaiement);

  // Colonnes montants (Frais inscription -> 1er versement attendu)
  feuille.getRange('AK2:AP1000').setNumberFormat('#,##0 "F CFA"');
}

function creerOngletInscription(ss, nomFeuille, estMaitre) {

  let feuille = ss.getSheetByName(nomFeuille);

  if (feuille) {
    Logger.log('[SHEETS] Onglet déjà existant : ' + nomFeuille);
    return feuille;
  }

  feuille = ss.insertSheet(nomFeuille);
  Logger.log('[SHEETS] Onglet créé : ' + nomFeuille);

  _ecrireEnTeteInscription(feuille, estMaitre);

  if (estMaitre) {
    const ligneEx = [
      'LQD-EXEMPLE', 'JJ/MM/AAAA HH:MM', 'Prénom', 'Nom', 'M',
      'JJ/MM/AAAA', 'Comé, Bénin', 'Béninoise', 'Comé, Quartier Hongodé',
      '+229 01 XX XX XX XX', 'email@exemple.com',
      'Prénom mère', 'Nom mère', '+229 01 XX XX XX XX', 'Profession',
      'Prénom père', 'Nom père', '+229 01 XX XX XX XX', 'Profession',
      '', '', '',
      'Informatique & Bureautique', 1, '', '', '',
      'Message exemple', 'En attente',
      'CIP', 'CIP0123456789', '(lien Drive)', '(lien Drive)', '(lien Drive)', '—', '(lien Drive)',
      10000, 45000, 22500, 11250, 11250, 32500, 'Non', 'En attente', 'Non', 'site'
    ];
    feuille.appendRow(ligneEx);
    feuille.getRange(2, 1, 1, ENTETES_INSCRIPTION.length)
           .setBackground('#F3F4F6')
           .setFontColor('#9CA3AF')
           .setFontStyle('italic');
    Logger.log('[SHEETS] Ligne exemple ajoutée dans : ' + nomFeuille);
  }

  return feuille;
}

function creerOngletRenseignement(ss) {

  let feuille = ss.getSheetByName('Renseignements');
  if (feuille) {
    Logger.log('[SHEETS] Onglet déjà existant : Renseignements');
    return feuille;
  }

  feuille = ss.insertSheet('Renseignements');
  Logger.log('[SHEETS] Onglet créé : Renseignements');

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

  const regle = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Nouveau', 'Traité', 'En cours'], true)
    .setAllowInvalid(false).build();
  feuille.getRange('I2:I1000').setDataValidation(regle);

  return feuille;
}

function creerOngletDashboard(ss) {

  let feuille = ss.getSheetByName('Tableau de bord');
  if (feuille) {
    Logger.log('[SHEETS] Onglet déjà existant : Tableau de bord');
    return feuille;
  }

  feuille = ss.insertSheet('Tableau de bord');
  Logger.log('[SHEETS] Onglet créé : Tableau de bord');

  feuille.setHiddenGridlines(true);

  feuille.getRange('B2').setValue('LES QUALITÉS DE DIEU SERVICE SARL')
    .setFontSize(16).setFontWeight('bold').setFontColor(CONFIG.COULEUR_DARK);
  feuille.getRange('B3').setValue('Tableau de bord — Inscriptions')
    .setFontSize(12).setFontColor(CONFIG.COULEUR_TEAL);

  feuille.getRange('B5').setValue('INSCRIPTIONS')
    .setFontWeight('bold').setFontColor(CONFIG.COULEUR_TEAL).setFontSize(11);

  const compteurs = [
    ['Total inscriptions',         "=COUNTA('Toutes les inscriptions'!A:A)-1"],
    ['Informatique & Bureautique', "=COUNTA('Informatique & Bureautique'!A:A)-1"],
    ['Graphisme & PAO',            "=COUNTA('Graphisme & PAO'!A:A)-1"],
    ['Sérigraphie',                "=COUNTA('Sérigraphie'!A:A)-1"],
    ['Création de sites web',      "=COUNTA('Création de sites web'!A:A)-1"],
    ['Initiation rapide (1 mois)', "=COUNTA('Initiation rapide (1 mois)'!A:A)-1"],
    ['Multi-formations',           "=COUNTA('Multi-formations'!A:A)-1"],
    ['Renseignements reçus',       "=COUNTA('Renseignements'!A:A)-1"]
  ];

  compteurs.forEach(function(item, index) {
    const ligne = 6 + index;
    feuille.getRange('B' + ligne).setValue(item[0]).setFontSize(11).setFontColor(CONFIG.COULEUR_DARK);
    feuille.getRange('C' + ligne).setFormula(item[1]).setFontSize(14).setFontWeight('bold').setFontColor(CONFIG.COULEUR_ORANGE);
  });

  const derniereLigne = 6 + compteurs.length + 1;
  feuille.getRange('B' + derniereLigne).setValue('PAIEMENTS')
    .setFontWeight('bold').setFontColor(CONFIG.COULEUR_TEAL).setFontSize(11);
  feuille.getRange('B' + (derniereLigne + 1)).setValue('En attente').setFontSize(11);
  feuille.getRange('C' + (derniereLigne + 1))
    .setFormula("=COUNTIF('Toutes les inscriptions'!V:V,\"En attente\")")
    .setFontSize(14).setFontWeight('bold').setFontColor('#E24B4A');
  feuille.getRange('B' + (derniereLigne + 2)).setValue('Reçus / Vérifiés').setFontSize(11);
  feuille.getRange('C' + (derniereLigne + 2))
    .setFormula("=COUNTIF('Toutes les inscriptions'!V:V,\"Reçu\")+COUNTIF('Toutes les inscriptions'!V:V,\"Vérifié\")")
    .setFontSize(14).setFontWeight('bold').setFontColor(CONFIG.COULEUR_TEAL);

  feuille.getRange('B' + (derniereLigne + 4)).setValue('Dernière mise à jour :')
    .setFontSize(10).setFontColor(CONFIG.COULEUR_DARK);
  feuille.getRange('C' + (derniereLigne + 4))
    .setFormula('=NOW()').setFontSize(10).setFontColor(CONFIG.COULEUR_DARK)
    .setNumberFormat('dd/mm/yyyy hh:mm');

  feuille.setColumnWidth(1, 30);
  feuille.setColumnWidth(2, 260);
  feuille.setColumnWidth(3, 100);

  return feuille;
}

/* ================================================================
   MIGRATION RÉGULARISATION → INSCRIPTION
   À exécuter UNE SEULE FOIS depuis l'éditeur (menu déroulant en haut
   → migrerRegularisationsVersInscriptions → Exécuter), après avoir
   déployé le nouveau code.gs avec le schéma étendu.

   Étape 1 : migrerRegularisationsVersInscriptions()
             Copie toutes les lignes de "Régularisations" vers
             "Toutes les inscriptions" (+ feuille par filière),
             en conservant le même ID apprenant (continuité des
             attestations et de l'espace apprenant).
   Étape 2 : Vérifier manuellement dans le Sheet que tout est correct.
   Étape 3 : supprimerFeuilleRegularisations()
             Supprime définitivement l'onglet "Régularisations".
             Volontairement séparée de l'étape 1 — irréversible.
================================================================ */
/* ================================================================
   RÉALIGNEMENT DES ANCIENNES INSCRIPTIONS
   Les dossiers enregistrés AVANT l'extension du schéma (24 colonnes,
   Sexe en dernière position) restent physiquement rangés à l'ancienne
   place — réécrire l'en-tête (repararEnTetesInscription) ne déplace
   jamais les données existantes. Cette fonction détecte ces lignes et
   les réécrit intégralement dans le nouvel ordre à 46 colonnes.

   À exécuter UNE SEULE FOIS, sur toutes les feuilles concernées,
   AVANT migrerRegularisationsVersInscriptions().
================================================================ */
function remapperAnciennesInscriptions() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) { console.error('[Remap] Classeur introuvable.'); return; }

  const feuilles = ['Toutes les inscriptions']
    .concat(CONFIG.FORMATIONS_VALIDES)
    .concat(['Multi-formations']);

  let total = 0;

  feuilles.forEach(nomFeuille => {
    const feuille = ss.getSheetByName(nomFeuille);
    if (!feuille) { console.log('[Remap] Onglet absent, ignoré : ' + nomFeuille); return; }

    // Sécurité : efface toute validation résiduelle avant réécriture,
    // sans quoi setValues() peut être bloqué par une ancienne règle
    // encore accrochée à une colonne repositionnée.
    feuille.getRange(1, 1, feuille.getMaxRows(), feuille.getMaxColumns()).clearDataValidations();

    const donnees = feuille.getDataRange().getValues();
    let remappees = 0;

    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0]) continue;

      // Détection ancien schéma : sous le nouvel en-tête, la colonne J
      // (position 9, "Téléphone") contient en réalité l'ancien Statut
      // dossier — donc un des 3 mots-clés, jamais un numéro.
      const valColonneJ = String(row[9] || '').trim();
      const estAncienSchema = ['En attente', 'Confirmé', 'Annulé'].includes(valColonneJ);
      if (!estAncienSchema) continue; // déjà au bon format, ou déjà migrée

      const nouvelleLigne = [
        String(row[0]  || ''),   // ID
        _formaterDateBrute(row[1]),  // Date
        String(row[2]  || ''),   // Prénom
        String(row[3]  || ''),   // Nom
        String(row[23] || ''),   // Sexe (était en position 23)
        '', '', '', '',           // Date naissance, Lieu naissance, Nationalité, Adresse — inconnus
        String(row[4]  || ''),   // Téléphone (était en position 4)
        String(row[5]  || ''),   // Email (était en position 5)
        '', '', '', '',           // Prénom/Nom/Tél/Profession mère — inconnus
        '', '', '', '',           // Prénom/Nom/Tél/Profession père — inconnus
        '', '', '',                // Prénom/Nom/Tél tuteur — inconnus
        String(row[6]  || ''),   // Formations
        row[7] || 0,               // Nombre de formations
        '', '', '',                // Date entrée, Date fin, Niveau atteint — inconnus
        String(row[8]  || ''),   // Message
        String(row[9]  || ''),   // Statut dossier
        String(row[10] || ''),   // Type pièce identité
        '',                        // Numéro pièce identité — inconnu
        String(row[11] || ''),   // Pièce identité URL
        String(row[12] || ''),   // Photo identité URL
        '',                        // Signature URL — inconnu (formulaire n'existait pas encore)
        String(row[13] || ''),   // Preuve paiement URL
        String(row[14] || ''),   // Dossier Drive URL
        row[15] || 0,               // Frais inscription
        row[16] || 0,               // Coût total
        row[17] || 0,               // Tranche 1
        row[18] || 0,               // Tranche 2
        row[19] || 0,               // Tranche 3
        row[20] || 0,               // 1er versement attendu
        'Non',                      // Paiement unique
        String(row[21] || ''),   // Statut paiement
        String(row[22] || ''),   // Rappel J+1 envoyé
        'site'                       // Source
      ];

      feuille.getRange(i + 1, 1, 1, nouvelleLigne.length).setValues([nouvelleLigne]);
      remappees++;
    }

    if (remappees > 0) console.log(`[Remap] ${nomFeuille} : ${remappees} ligne(s) réalignée(s).`);
    total += remappees;
  });

  console.log(`[Remap] Terminé : ${total} ligne(s) au total réalignée(s) vers le nouveau schéma.`);
}

// Convertit proprement une date (objet Date ou texte) en chaîne lisible.
// Nécessaire car Sheets renvoie certaines cellules déjà en objet Date —
// un simple String(dateObjet) produit un format illisible du type
// "Tue Jun 02 2026 03:49:04 GMT+0000 (Coordinated Universal Time)".
function _formaterDateBrute(valeur) {
  if (!valeur) return '';
  if (Object.prototype.toString.call(valeur) === '[object Date]' && !isNaN(valeur)) {
    return Utilities.formatDate(valeur, 'Africa/Porto-Novo', 'dd/MM/yyyy HH:mm:ss');
  }
  return String(valeur);
}

function migrerRegularisationsVersInscriptions() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) { console.error('[Migration] Classeur introuvable.'); return; }

  const feuilleReg = ss.getSheetByName('Régularisations');
  if (!feuilleReg) { console.log('[Migration] Aucune feuille "Régularisations" — rien à migrer.'); return; }

  const donnees = feuilleReg.getDataRange().getValues();
  if (donnees.length <= 1) { console.log('[Migration] Feuille "Régularisations" vide — rien à migrer.'); return; }

  let migres = 0;
  let erreurs = 0;

  for (let i = 1; i < donnees.length; i++) {
    const r = donnees[i];
    if (!r[0]) continue; // ligne vide

    try {
      const filiereDeclaree = String(r[21] || '').trim();
      const filiereFinale   = CONFIG.FORMATIONS_VALIDES.includes(filiereDeclaree)
        ? filiereDeclaree
        : (filiereDeclaree || 'Non précisé');

      const dureeDeclaree = String(r[22] || '').trim();
      const observations  = String(r[27] || '').trim();
      const message = (dureeDeclaree ? `Durée déclarée à la régularisation : ${dureeDeclaree}. ` : '') + observations;

      // Normalisation du vocabulaire : Régularisation utilisait
      // 'Validé'/'Rejeté', Inscription utilise 'Confirmé'/'Annulé'.
      // Essentiel pour que les apprenants migrés déjà validés gardent
      // l'accès à leur espace apprenant (voir getCarte dans carte.gs).
      const statutOriginal = String(r[37] || '').trim();
      const statutMigre =
        statutOriginal === 'Validé' ? 'Confirmé' :
        statutOriginal === 'Rejeté' ? 'Annulé'   :
        statutOriginal === 'En attente' ? 'En attente' :
        'Migré';

      const ligne = [
        String(r[0]  || ''),                          // ID — conservé à l'identique
        _formaterDateBrute(r[1]),                     // Date soumission
        String(r[2]  || ''),                          // Prénom
        String(r[3]  || ''),                          // Nom
        String(r[4]  || ''),                          // Sexe
        _formaterDateBrute(r[5]),                     // Date de naissance
        String(r[6]  || ''),                          // Lieu de naissance
        String(r[7]  || ''),                          // Nationalité
        String(r[10] || ''),                          // Adresse
        String(r[8]  || ''),                          // Téléphone
        String(r[9]  || ''),                          // Email
        String(r[11] || ''),                          // Prénom mère
        String(r[12] || ''),                          // Nom mère
        String(r[13] || ''),                          // Téléphone mère
        String(r[14] || ''),                          // Profession mère
        String(r[15] || ''),                          // Prénom père
        String(r[16] || ''),                          // Nom père
        String(r[17] || ''),                          // Téléphone père
        String(r[18] || ''),                          // Profession père
        String(r[19] || ''),                          // Prénom tuteur
        String(r[20] || ''),                          // Nom tuteur
        '',                                            // Téléphone tuteur — non collecté en régularisation
        filiereFinale,                                 // Formations
        1,                                             // Nombre de formations
        _formaterDateBrute(r[23]),                    // Date entrée
        _formaterDateBrute(r[24]),                    // Date fin
        String(r[25] || ''),                          // Niveau atteint
        message,                                       // Message
        statutMigre,                                    // Statut dossier (normalisé)
        String(r[28] || ''),                          // Type pièce identité
        String(r[29] || ''),                          // Numéro pièce identité
        String(r[30] || ''),                          // Pièce identité (Drive URL)
        String(r[31] || ''),                          // Photo identité (Drive URL)
        String(r[32] || ''),                          // Signature (Drive URL)
        '',                                            // Preuve paiement — non collectée en régularisation
        String(r[33] || ''),                          // Dossier Drive (URL)
        0,                                             // Frais inscription — non applicable rétroactivement
        Number(r[26]) || 0,                           // Coût formations total — montant payé déclaré
        0, 0, 0, 0,                                    // Tranches — non applicables
        'Non',                                         // Paiement unique
        'Migré (voir montant payé)',                  // Statut paiement
        'Non',                                         // Rappel J+1 envoyé
        'migration-regularisation'                     // Source
      ];

      ajouterLigneFeuille(ss, 'Toutes les inscriptions', ENTETES_INSCRIPTION, ligne, [10, 14, 18, 22]);
      const nomFeuille = filiereFinale === 'Non précisé' ? 'Multi-formations' : filiereFinale;
      ajouterLigneFeuille(ss, nomFeuille, ENTETES_INSCRIPTION, ligne, [10, 14, 18, 22]);

      migres++;
    } catch (err) {
      erreurs++;
      console.error('[Migration] Ligne ' + (i + 1) + ' échouée :', err.toString());
    }
  }

  console.log(`[Migration] Terminée : ${migres} dossier(s) migré(s), ${erreurs} erreur(s).`);
  console.log('[Migration] Vérifiez "Toutes les inscriptions" avant d\'exécuter supprimerFeuilleRegularisations().');
}

// Étape 2 — à exécuter seulement après vérification manuelle des données migrées.
function supprimerFeuilleRegularisations() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) { console.error('[Migration] Classeur introuvable.'); return; }

  const feuille = ss.getSheetByName('Régularisations');
  if (!feuille) { console.log('[Migration] Aucune feuille "Régularisations" à supprimer.'); return; }

  ss.deleteSheet(feuille);
  console.log('[Migration] Feuille "Régularisations" supprimée définitivement.');
}

function verifierInit() {
  Logger.log('=== VÉRIFICATION INIT ===');
  Logger.log('');

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
      'Initiation rapide (1 mois)',
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

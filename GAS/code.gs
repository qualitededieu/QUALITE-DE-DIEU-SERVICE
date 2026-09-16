const CONFIG = {

  ADMIN_EMAIL:       'lqddssarl@gmail.com',
  EXPEDITEUR_NOM:    'Les Qualités de Dieu Service',
  SPREADSHEET_NAME:  'Inscriptions — LQD Service',
  DRIVE_DOSSIER_NOM: 'Inscriptions LQD Service',
  LOGO_URL:          'https://www.qualitededieuservice.com/icons/logoqds.jpg',
  SITE_URL:          'https://www.qualitededieuservice.com',

  COULEUR_TEAL:   '#0D7A8A',
  COULEUR_ORANGE: '#F5A623',
  COULEUR_DARK:   '#04342C',
  WHATSAPP:       '22997951230'.replace(/\s/g, ''),

  FRAIS_INSCRIPTION: 10000,

  COUTS_FORMATIONS: {
    'Informatique & Bureautique': 45000,
    'Graphisme & PAO':            65000,
    'Sérigraphie':                35000,
    'Création de sites web':      200000
  },

  // Offre autonome à paiement unique — distincte des 4 filières longues
  // ci-dessus qui restent sur le système de tranches (50/25/25%).
  FORMATION_COURTE: {
    NOM:               'Initiation rapide (1 mois)',
    COUT:              25000,
    FRAIS_INSCRIPTION: 5000
  },

  // Palier de téléchargement payant — uniquement pour FORMATION_COURTE.
  // 1er téléchargement payant, puis 5 gratuits, puis paiement à nouveau.
  TELECHARGEMENT: {
    FRAIS:               3000,
    TELECHARGEMENTS_PAR_PALIER: 6   // le payant + les 5 gratuits qui suivent
  },

  BANQUE: {
    TITULAIRE:     'LES QUALITÉS DE DIEU SERVICE SARL',
    NOM_BANQUE:    'Bank Of Africa Bénin (agence Comé)',
    NUMERO_COMPTE: '005098760007',
    CLE_RIB:       '77',
    CODE_BANQUE:   'BJ061',
    CODE_AGENCE:   '13001',
    IBAN:          'BJ66 BJ06 1130 0100 5098 7600 0777',
    BIC:           'AFRIBJBJXXX'
  },

  FORMATIONS_VALIDES: [
    'Informatique & Bureautique',
    'Graphisme & PAO',
    'Sérigraphie',
    'Création de sites web',
    'Initiation rapide (1 mois)'
  ]
};

const ENTETES_INSCRIPTION = [
  'ID',
  'Date',
  'Prénom',
  'Nom',
  'Sexe',
  'Date de naissance',
  'Lieu de naissance',
  'Nationalité',
  'Adresse',
  'Téléphone',
  'Email',
  'Prénom mère',
  'Nom mère',
  'Téléphone mère',
  'Profession mère',
  'Prénom père',
  'Nom père',
  'Téléphone père',
  'Profession père',
  'Prénom tuteur',
  'Nom tuteur',
  'Téléphone tuteur',
  'Formations',
  'Nombre de formations',
  'Date entrée',
  'Date fin',
  'Niveau atteint',
  'Message',
  'Statut dossier',
  'Type pièce identité',
  'Numéro pièce identité',
  'Pièce identité (Drive URL)',
  'Photo identité (Drive URL)',
  'Signature (Drive URL)',
  'Preuve paiement (Drive URL)',
  'Dossier Drive (URL)',
  'Frais inscription (F)',
  'Coût formations total (F)',
  'Tranche 1 (F)',
  'Tranche 2 (F)',
  'Tranche 3 (F)',
  '1er versement attendu (F)',
  'Paiement unique',
  'Statut paiement',
  'Rappel J+1 envoyé',
  'Source',
  'Téléchargements gratuits restants'
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
  'Statut'
];

function doPost(e) {

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
  if (action === 'bandeau_get_public') return bandeauGetPublic(data);
  if (action === 'annonce_get_publique') return annonceGetPublique(data);
  if (action === 'obtenir_mode_paiement') return obtenirModePaiementPublic(data);
  if (action.startsWith('admin_') || action === 'carte_get_data' || action === 'carte_verifier') return routerAdmin(data, action);
  if (action === 'verifier_document_par_id') return verifierDocumentParId(data);
  if (action === 'verifier_acces_telechargement') return verifierAccesTelechargement(data);
  if (action === 'enregistrer_telechargement')    return enregistrerTelechargement(data);
  if (action === 'confirmer_paiement_telechargement') return confirmerPaiementTelechargement(data);
  if (action === 'renseignement') return traiterRenseignement(data);
  if (action === 'chat_rdv') return enregistrerRdvChat(data);
  if (action === 'chat_lead') return enregistrerLeadChat(data);
  if (action === 'candidature') return enregistrerCandidature(data);
  if (action === 'candidature_attestation_get_data') return candidatureAttestationGetData(data);
  if (action === 'annonces_list_publiees') return annoncesListPubliees(data);
    return traiterInscription(data);

  } catch (err) {
    console.error('[doPost]', err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur interne. Veuillez réessayer.' });
  }
}

function doGet(e) {
  return reponseJSON({ status: 'ok', message: 'LQD Service API v3.1 opérationnelle.' });
}

// Jeu de test complet, synchronisé avec TOUS les champs actuellement
// exigés par validerDonneesInscription() (sexe, dateNaissance, filiation,
// pièce, signature, clauses...). Mis à jour car l'ancienne version de ce
// test datait du formulaire v3.1 (avant l'ajout des champs famille/pièce/
// clauses) et échouait donc systématiquement — un rejet ICI reflète un
// vrai bug de validerDonneesInscription, plus un simple oubli de test.
function testerDoPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action:          'inscription',
        prenom:          'Philippe',
        nom:             'Bénin',
        sexe:            'Masculin',
        dateNaissance:   '1990-01-01',
        lieuNaissance:   'Comé',
        nationalite:     'Béninoise',
        adresse:         'Comé, Mono',
        telephone:       '+2290162484491',
        email:           'phanoskosmos@gmail.com',
        prenomMere:      'Marie',
        nomMere:         'Test',
        prenomPere:      'Jean',
        nomPere:         'Test',
        typePiece:       'CIP (Carte d\'Identité Personnelle)',
        numeroPiece:     'B1234567',
        formations:      ['Informatique & Bureautique'],
        message:         'Test depuis éditeur GAS v3.1',
        piece1Base64:    'dGVzdA==',
        piece1MimeType:  'image/jpeg',
        photoBase64:     'dGVzdA==',
        photoMimeType:   'image/jpeg',
        signatureBase64: 'dGVzdA=='.repeat(20),
        clause1:         true,
        clause2:         true,
        preuveBase64:    '',
        preuveMimeType:  ''
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
        email:      'marie@yopmail.com',
        formations: ['Graphisme & PAO', 'Sérigraphie'],
        question:   'Quels sont les horaires disponibles le soir ?'
      })
    },
    parameter: { action: 'renseignement' }
  };

  const resultat = doPost(fakeEvent);
  Logger.log('[testerRenseignement] Réponse : ' + resultat.getContent());
}

// Normalise data.formations en tableau exploitable, quelle que soit sa
// forme d'arrivée (tableau réel, valeur unique, ou chaîne JSON mal
// sérialisée par un intermédiaire) — utilisé à la fois par la validation
// et par le traitement, pour ne jamais avoir deux lectures divergentes
// de la même donnée brute.
function _normaliserFormations(data) {
  let brut = data.formations;
  if (typeof brut === 'string' && brut.trim().startsWith('[')) {
    try { brut = JSON.parse(brut); } catch (e) { /* laissé tel quel */ }
  }
  return Array.isArray(brut) ? brut : [brut];
}

function traiterInscription(data) {

  const erreursChamps = validerDonneesInscription(data);
  if (erreursChamps.length > 0) {
    // Trace complète dans le Journal d'exécution (Apps Script → Exécutions)
    // à chaque rejet — sans elle, un rejet en production est invisible tant
    // que l'apprenant ne se plaint pas, et on ne sait jamais QUELLE valeur
    // exacte a été reçue (undefined ? chaîne vide ? tableau vide ? valeur
    // qui ne correspond à aucune formation valide ?).
    console.error('[Inscription] Rejetée — champs :', erreursChamps.join(', '),
      '— formations reçues :', JSON.stringify(data.formations),
      '— clause1 :', data.clause1, '(' + typeof data.clause1 + ')',
      '— clause2 :', data.clause2, '(' + typeof data.clause2 + ')');
    return reponseJSON({ status: 'error', message: 'Champs invalides : ' + erreursChamps.join(', ') });
  }

  const erreursFichiers = validerFichiersInscription(data);
  if (erreursFichiers.length > 0) {
    return reponseJSON({ status: 'error', message: erreursFichiers.join(' ') });
  }

  const formationsBrutes = _normaliserFormations(data).filter(f => CONFIG.FORMATIONS_VALIDES.includes(f));

  if (formationsBrutes.length === 0) {
    return reponseJSON({ status: 'error', message: 'Aucune formation valide sélectionnée.' });
  }

  // L'offre courte est exclusive : si elle est cochée, elle prime seule
  // sur toute autre sélection (impossible de mélanger paiement unique
  // et système de tranches dans le même dossier).
  const estFormationCourte = formationsBrutes.includes(CONFIG.FORMATION_COURTE.NOM);
  const formations = estFormationCourte ? [CONFIG.FORMATION_COURTE.NOM] : formationsBrutes;

  const montants = calculerMontantsTotal(formations);

  const inscription = {
    id:               genererID(),
    date:             new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    prenom:           nettoyer(data.prenom),
    nom:              nettoyer(data.nom),
    sexe:             nettoyer(data.sexe || ''),
    dateNaissance:    nettoyer(data.dateNaissance || ''),
    lieuNaissance:    nettoyer(data.lieuNaissance || ''),
    nationalite:      nettoyer(data.nationalite || 'Béninoise'),
    adresse:          nettoyer(data.adresse || ''),
    telephone:        nettoyer(data.telephone),
    email:            nettoyer(data.email || ''),
    prenomMere:       nettoyer(data.prenomMere || ''),
    nomMere:          nettoyer(data.nomMere || ''),
    telephoneMere:    nettoyer(data.telephoneMere || ''),
    professionMere:   nettoyer(data.professionMere || ''),
    prenomPere:       nettoyer(data.prenomPere || ''),
    nomPere:          nettoyer(data.nomPere || ''),
    telephonePere:    nettoyer(data.telephonePere || ''),
    professionPere:   nettoyer(data.professionPere || ''),
    prenomTuteur:     nettoyer(data.prenomTuteur || ''),
    nomTuteur:        nettoyer(data.nomTuteur || ''),
    telephoneTuteur:  nettoyer(data.telephoneTuteur || ''),
    formations,
    formationsLabel:  formations.join(' | '),
    nbFormations:     formations.length,
    dateEntree:       nettoyer(data.dateEntree || ''),
    dateFin:          '',
    niveauAtteint:    '',
    message:          nettoyer(data.message || ''),
    statut:           'En attente',
    typePiece:        nettoyer(data.typePiece || 'Non spécifié'),
    numeroPiece:      nettoyer(data.numeroPiece || ''),
    pieceUrl:         '',
    photoUrl:         '',
    signatureUrl:     '',
    preuveUrl:        '',
    dossierUrl:       '',
    statutPaiement:   'En attente',
    rappelEnvoye:     'Non',
    source:           'site'
  };

  try {
    const driveResult      = creerStructureDrive(inscription, data);
    inscription.pieceUrl     = driveResult.pieceUrl;
    inscription.photoUrl     = driveResult.photoUrl;
    inscription.signatureUrl = driveResult.signatureUrl;
    inscription.preuveUrl    = driveResult.preuveUrl;
    inscription.dossierUrl   = driveResult.dossierUrl;
  } catch (errDrive) {
    console.error('[Drive]', errDrive.toString());
    inscription.pieceUrl  = 'Erreur upload Drive';
    inscription.photoUrl  = 'Erreur upload Drive';
  }

  enregistrerInscription(inscription, montants, formations);

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

function calculerMontantsTotal(formations) {
  // Offre courte : 25 000 F + 5 000 F de frais = 30 000 F en un seul versement.
  // Exclusive — jamais combinée avec les filières longues (voir traiterInscription).
  if (formations.length === 1 && formations[0] === CONFIG.FORMATION_COURTE.NOM) {
    const fraisInscription = CONFIG.FORMATION_COURTE.FRAIS_INSCRIPTION;
    const coutTotal        = CONFIG.FORMATION_COURTE.COUT;
    const premierVirement  = fraisInscription + coutTotal;
    return {
      fraisInscription, coutTotal,
      tranche1: coutTotal, tranche2: 0, tranche3: 0,
      premierVirement,
      paiementUnique: true
    };
  }

  const fraisInscription = CONFIG.FRAIS_INSCRIPTION;
  const coutTotal        = formations.reduce((s, f) => s + (CONFIG.COUTS_FORMATIONS[f] || 0), 0);
  const tranche1         = Math.round(coutTotal * 0.50);
  const tranche2         = Math.round(coutTotal * 0.25);
  const tranche3         = coutTotal - tranche1 - tranche2;
  const premierVirement  = fraisInscription + tranche1;
  return { fraisInscription, coutTotal, tranche1, tranche2, tranche3, premierVirement, paiementUnique: false };
}

function validerDonneesInscription(data) {
  const erreurs = [];
  if (!data.prenom       || data.prenom.trim().length < 2)        erreurs.push('prénom');
  if (!data.nom          || data.nom.trim().length < 2)           erreurs.push('nom');
  if (!data.sexe)                                                  erreurs.push('sexe');
  if (!data.dateNaissance)                                         erreurs.push('date de naissance');
  if (!data.lieuNaissance || data.lieuNaissance.trim().length < 2) erreurs.push('lieu de naissance');
  if (!data.nationalite   || data.nationalite.trim().length < 2)  erreurs.push('nationalité');
  if (!data.adresse       || data.adresse.trim().length < 4)      erreurs.push('adresse');
  if (!data.telephone     || data.telephone.trim().length < 8)    erreurs.push('téléphone');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) erreurs.push('email');

  if (!data.prenomMere || data.prenomMere.trim().length < 2) erreurs.push('prénom de la mère');
  if (!data.nomMere    || data.nomMere.trim().length < 2)    erreurs.push('nom de la mère');
  if (!data.prenomPere || data.prenomPere.trim().length < 2) erreurs.push('prénom du père');
  if (!data.nomPere    || data.nomPere.trim().length < 2)    erreurs.push('nom du père');

  if (!data.typePiece  || data.typePiece.trim().length < 2)  erreurs.push('type de pièce');
  if (!data.numeroPiece|| data.numeroPiece.trim().length < 4) erreurs.push('numéro de pièce');

  const formations = _normaliserFormations(data);
  if (!formations || !formations.some(f => CONFIG.FORMATIONS_VALIDES.includes(f)))
    erreurs.push('formation(s)');

  if (!data.signatureBase64 || data.signatureBase64.length < 100) erreurs.push('signature');

  // Blindage : accepte aussi bool "true"/"false" envoyé en chaîne (au cas
  // où un ancien cache navigateur ou un intermédiaire sérialise les
  // booléens en texte) — sans jamais entériner un simple "présence de
  // champ" qui ne prouve pas un consentement explicite.
  const clause1Ok = data.clause1 === true || data.clause1 === 'true';
  const clause2Ok = data.clause2 === true || data.clause2 === 'true';
  if (!clause1Ok) erreurs.push('acceptation de la déclaration sur l\'honneur');
  if (!clause2Ok) erreurs.push('acceptation du traitement des données');

  return erreurs;
}

function validerFichiersInscription(data) {
  const erreurs = [];
  if (!data.piece1Base64 || data.piece1Base64.length < 4)
    erreurs.push('La pièce d\'identité (acte ou CIP) est obligatoire.');
  if (!data.photoBase64 || data.photoBase64.length < 4)
    erreurs.push('La photo d\'identité est obligatoire.');
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

function creerStructureDrive(inscription, data) {

  let racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (!racine) racine = DriveApp.createFolder(CONFIG.DRIVE_DOSSIER_NOM);

  const nomCategorie = inscription.formations.length === 1
    ? inscription.formations[0]
    : 'Multi-formations';

  let dossierCat = trouverSousDossier(racine, nomCategorie);
  if (!dossierCat) dossierCat = racine.createFolder(nomCategorie);

  const nomApprenant  = `${inscription.id} — ${inscription.prenom} ${inscription.nom}`;
  const dossierApprenant = dossierCat.createFolder(nomApprenant);

  const p1Mime = data.piece1MimeType || 'image/jpeg';
  const pieceUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.piece1Base64,
    `piece-identite_${inscription.id}.${extensionDepuisMime(p1Mime)}`,
    p1Mime
  );

  const phMime = data.photoMimeType || 'image/jpeg';
  const photoUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.photoBase64,
    `photo-identite_${inscription.id}.${extensionDepuisMime(phMime)}`,
    phMime
  );

  const signatureUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.signatureBase64,
    `signature_${inscription.id}.png`,
    'image/png'
  );

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

  return { pieceUrl, photoUrl, signatureUrl, preuveUrl, dossierUrl: dossierApprenant.getUrl() };
}

function sauvegarderFichierDrive(dossier, base64, nom, mimeType) {
  const octets  = Utilities.base64Decode(base64);
  const blob    = Utilities.newBlob(octets, mimeType, nom);
  const fichier = dossier.createFile(blob);
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
    inscription.sexe,
    inscription.dateNaissance,
    inscription.lieuNaissance,
    inscription.nationalite,
    inscription.adresse,
    inscription.telephone,
    inscription.email,
    inscription.prenomMere,
    inscription.nomMere,
    inscription.telephoneMere,
    inscription.professionMere,
    inscription.prenomPere,
    inscription.nomPere,
    inscription.telephonePere,
    inscription.professionPere,
    inscription.prenomTuteur,
    inscription.nomTuteur,
    inscription.telephoneTuteur,
    inscription.formationsLabel,
    inscription.nbFormations,
    inscription.dateEntree,
    inscription.dateFin,
    inscription.niveauAtteint,
    inscription.message,
    inscription.statut,
    inscription.typePiece,
    inscription.numeroPiece,
    inscription.pieceUrl,
    inscription.photoUrl,
    inscription.signatureUrl,
    inscription.preuveUrl || '—',
    inscription.dossierUrl,
    montants.fraisInscription,
    montants.coutTotal,
    montants.tranche1,
    montants.tranche2,
    montants.tranche3,
    montants.premierVirement,
    montants.paiementUnique ? 'Oui' : 'Non',
    inscription.statutPaiement,
    inscription.rappelEnvoye,
    inscription.source,
    0   // Téléchargements gratuits restants — 0 : le premier est toujours payant
  ];

  ajouterLigneFeuille(ss, 'Toutes les inscriptions', ENTETES_INSCRIPTION, ligne, [10, 14, 18, 22]);

  const nomFeuille = formations.length === 1 ? formations[0] : 'Multi-formations';
  ajouterLigneFeuille(ss, nomFeuille, ENTETES_INSCRIPTION, ligne, [10, 14, 18, 22]);
}

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

  ajouterLigneFeuille(ss, 'Renseignements', ENTETES_RENSEIGNEMENT, ligne, 5);
}

function ajouterLigneFeuille(ss, nomFeuille, entetes, ligne, colsTelephone) {

  const colonnesTel = Array.isArray(colsTelephone) ? colsTelephone : [colsTelephone];

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

    const largeurs = [120,160,110,110,90,120,160,120,220,140,200,140,140,140,140,140,140,140,140,140,140,140,220,80,120,120,180,260,120,180,140,200,200,200,200,200,120,140,120,120,120,140,120,140,120,120];
    largeurs.forEach((l, i) => { if (i < entetes.length) feuille.setColumnWidth(i + 1, l); });

    colonnesTel.forEach(col => {
      if (col) feuille.getRange(2, col, feuille.getMaxRows() - 1).setNumberFormat('@');
    });
  }

  feuille.appendRow(ligne);

  const derniereLigne = feuille.getLastRow();
  if (derniereLigne % 2 === 0) {
    feuille.getRange(derniereLigne, 1, 1, entetes.length).setBackground('#F0F9FA');
  }

  colonnesTel.forEach(col => {
    if (!col) return;
    const cellule = feuille.getRange(derniereLigne, col);
    cellule.setNumberFormat('@');
    cellule.setValue(String(ligne[col - 1] || ''));
  });
}

function forcerTelephoneTexte(feuille, colTelephone, telephone) {
  const derniereLigne = feuille.getLastRow();
  const cellule = feuille.getRange(derniereLigne, colTelephone);
  cellule.setNumberFormat('@');
  cellule.setValue(String(telephone || ''));
}

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
      ${_tableauMontantsEmail(montants)}
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
      ${_tableauMontantsEmail(montants)}
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
      ${ligneInfoEmail('Banque',               CONFIG.BANQUE.NOM_BANQUE)}
      ${ligneInfoEmailAccent('IBAN',           CONFIG.BANQUE.IBAN)}
      ${ligneInfoEmail('BIC / SWIFT',          CONFIG.BANQUE.BIC)}
      ${ligneInfoEmail('N° de compte',         CONFIG.BANQUE.NUMERO_COMPTE + (CONFIG.BANQUE.CLE_RIB ? ' (clé ' + CONFIG.BANQUE.CLE_RIB + ')' : ''))}
      ${CONFIG.BANQUE.CODE_BANQUE  ? ligneInfoEmail('Code banque',  CONFIG.BANQUE.CODE_BANQUE)  : ''}
      ${CONFIG.BANQUE.CODE_AGENCE  ? ligneInfoEmail('Code agence',  CONFIG.BANQUE.CODE_AGENCE)  : ''}
      ${ligneInfoEmailAccent('Motif du virement', `${inscription.id} — ${inscription.formationsLabel}`)}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#FFF6E5;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:${CONFIG.COULEUR_ORANGE};font-size:12px;text-transform:uppercase;">${montants.paiementUnique ? 'Montant du virement' : 'Montant du 1er virement'}</td></tr>
      ${ligneInfoEmail('Frais d\'inscription', formatFCFA(montants.fraisInscription))}
      ${ligneInfoEmail(montants.paiementUnique ? 'Coût de la formation' : 'Tranche 1 — 50%', formatFCFA(montants.tranche1))}
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

function _tableauMontantsEmail(montants) {
  if (montants.paiementUnique) {
    return `
      ${ligneInfoEmail('Frais d\'inscription',  formatFCFA(montants.fraisInscription))}
      ${ligneInfoEmail('Coût de la formation',   formatFCFA(montants.coutTotal))}
      ${ligneInfoEmailAccent('TOTAL — paiement unique', formatFCFA(montants.premierVirement))}`;
  }
  return `
      ${ligneInfoEmail('Frais d\'inscription',    formatFCFA(montants.fraisInscription))}
      ${ligneInfoEmail('Coût total formations',   formatFCFA(montants.coutTotal))}
      ${ligneInfoEmail('Tranche 1 — 50%',         formatFCFA(montants.tranche1))}
      ${ligneInfoEmail('Tranche 2 — 25%',         formatFCFA(montants.tranche2))}
      ${ligneInfoEmail('Tranche 3 — 25%',         formatFCFA(montants.tranche3))}
      ${ligneInfoEmailAccent('1er versement dû',  formatFCFA(montants.premierVirement))}`;
}

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


function reinitialiserCompteurTest() {
  const trouve = _trouverLigneInscription('LQD-260905-W9RA');
  trouve.feuille.getRange(trouve.ligneIndex, 47).setValue(0);
  Logger.log('Compteur remis à 0.');
}

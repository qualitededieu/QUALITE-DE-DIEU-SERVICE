const ENTETES_REGULARISATION = [
  'ID Apprenant',
  'Date soumission',

  'Prénom(s)',
  'Nom',
  'Sexe',
  'Date de naissance',
  'Lieu de naissance',
  'Nationalité',
  'Téléphone',
  'Email',
  'Adresse',

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

  'Filière',
  'Durée formation',
  'Date d\'entrée',
  'Date de fin',
  'Niveau atteint',
  'Montant payé (F CFA)',
  'Observations formation',

  'Type pièce identité',
  'N° pièce identité',
  'Pièce identité (Drive)',
  'Photo identité (Drive)',
  'Signature (Drive)',
  'Dossier Drive',

  'Clause 1 acceptée',
  'Clause 2 acceptée',
  'Date signature',

  'Statut dossier',
  'Traité par',
  'Date traitement'
];

function traiterRegularisation(data) {
  if (!data) {
    return reponseJSON({
      status:  'error',
      message: 'data manquant. Utilisez testerRegularisation() pour les tests éditeur.'
    });
  }
  const erreurs = validerDonneesRegularisation(data);
  if (erreurs.length > 0) {
    return reponseJSON({
      status:  'error',
      message: 'Champs invalides : ' + erreurs.join(', ')
    });
  }

  const erreursFichiers = validerFichiersRegularisation(data);
  if (erreursFichiers.length > 0) {
    return reponseJSON({
      status:  'error',
      message: erreursFichiers.join(' ')
    });
  }

  const apprenant = {
    id:            genererID('REG'),
    dateSoumission: new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),

    prenom:        nettoyer(data.prenom),
    nom:           nettoyer(data.nom),
    sexe:          nettoyer(data.sexe || ''),
    dateNaissance: nettoyer(data.dateNaissance || ''),
    lieuNaissance: nettoyer(data.lieuNaissance || ''),
    nationalite:   nettoyer(data.nationalite || ''),
    telephone:     nettoyer(data.telephone),
    email:         nettoyer(data.email || ''),
    adresse:       nettoyer(data.adresse || ''),

    prenomMere:     nettoyer(data.prenomMere || ''),
    nomMere:        nettoyer(data.nomMere || ''),
    telephoneMere:  nettoyer(data.telephoneMere || ''),
    professionMere: nettoyer(data.professionMere || ''),
    prenomPere:     nettoyer(data.prenomPere || ''),
    nomPere:        nettoyer(data.nomPere || ''),
    telephonePere:  nettoyer(data.telephonePere || ''),
    professionPere: nettoyer(data.professionPere || ''),
    prenomTuteur:   nettoyer(data.prenomTuteur || ''),
    nomTuteur:      nettoyer(data.nomTuteur || ''),

    filiere:              nettoyer(data.filiere || ''),
    dureeFormation:       nettoyer(data.dureeFormation || ''),
    dateEntree:           nettoyer(data.dateEntree || ''),
    dateFin:              nettoyer(data.dateFin || ''),
    niveauAtteint:        nettoyer(data.niveauAtteint || ''),
    montantPaye:          nettoyer(data.montantPaye || '0'),
    observationFormation: nettoyer(data.observationFormation || ''),

    typePiece:   nettoyer(data.typePiece || ''),
    numeroPiece: nettoyer(data.numeroPiece || ''),
    pieceUrl:    '',
    photoUrl:    '',
    signatureUrl:'',
    dossierUrl:  '',

    clause1: data.clause1Acceptee === true ? 'Oui' : 'Non',
    clause2: data.clause2Acceptee === true ? 'Oui' : 'Non',
    dateSignature: nettoyer(data.dateSignature || ''),

    statutDossier: 'En attente',
    traitePar:     '',
    dateTraitement:''
  };

  try {
    const driveResult      = creerDossierRegularisation(apprenant, data);
    apprenant.pieceUrl     = driveResult.pieceUrl;
    apprenant.photoUrl     = driveResult.photoUrl;
    apprenant.signatureUrl = driveResult.signatureUrl;
    apprenant.dossierUrl   = driveResult.dossierUrl;
  } catch (errDrive) {
    console.error('[Drive Régularisation]', errDrive.toString());
    apprenant.pieceUrl = 'Erreur upload Drive';
    apprenant.photoUrl = 'Erreur upload Drive';
  }

  enregistrerRegularisation(apprenant);

  envoyerEmailAdminRegularisation(apprenant);
  if (apprenant.email) {
    envoyerEmailApprenantRegularisation(apprenant);
  }

  return reponseJSON({
    status:  'success',
    id:      apprenant.id,
    message: 'Dossier de régularisation enregistré. Votre ID apprenant vous sera confirmé sous 48 heures.'
  });
}

function validerDonneesRegularisation(data) {
  const erreurs = [];

  if (!data.prenom        || data.prenom.trim().length < 2)       erreurs.push('prénom');
  if (!data.nom           || data.nom.trim().length < 2)          erreurs.push('nom');
  if (!data.sexe          || !data.sexe.trim())                   erreurs.push('sexe');
  if (!data.dateNaissance || !data.dateNaissance.trim())          erreurs.push('date de naissance');
  if (!data.lieuNaissance || data.lieuNaissance.trim().length < 2) erreurs.push('lieu de naissance');
  if (!data.nationalite   || data.nationalite.trim().length < 2)  erreurs.push('nationalité');
  if (!data.telephone     || data.telephone.trim().length < 8)    erreurs.push('téléphone');
  if (!data.adresse       || data.adresse.trim().length < 4)      erreurs.push('adresse');

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    erreurs.push('email');
  }

  if (!data.prenomMere || data.prenomMere.trim().length < 2) erreurs.push('prénom de la mère');
  if (!data.nomMere    || data.nomMere.trim().length < 2)    erreurs.push('nom de la mère');
  if (!data.prenomPere || data.prenomPere.trim().length < 2) erreurs.push('prénom du père');
  if (!data.nomPere    || data.nomPere.trim().length < 2)    erreurs.push('nom du père');

  if (!data.filiere        || !data.filiere.trim())         erreurs.push('filière');
  if (!data.dureeFormation || !data.dureeFormation.trim())  erreurs.push('durée de formation');
  if (!data.dateEntree     || !data.dateEntree.trim())      erreurs.push('date d\'entrée');
  if (!data.dateFin        || !data.dateFin.trim())         erreurs.push('date de fin');
  if (data.montantPaye === undefined || data.montantPaye === '') erreurs.push('montant payé');

  if (!data.typePiece   || !data.typePiece.trim())          erreurs.push('type de pièce');
  if (!data.numeroPiece || data.numeroPiece.trim().length < 4) erreurs.push('numéro de pièce');

  if (!data.clause1Acceptee) erreurs.push('clause 1 non acceptée');
  if (!data.clause2Acceptee) erreurs.push('clause 2 non acceptée');
  if (!data.signatureBase64 || data.signatureBase64.length < 100) erreurs.push('signature');

  return erreurs;
}

function validerFichiersRegularisation(data) {
  const erreurs = [];
  if (!data.piece1Base64 || data.piece1Base64.length < 4) {
    erreurs.push('La pièce d\'identité est obligatoire.');
  }
  if (!data.photoBase64 || data.photoBase64.length < 4) {
    erreurs.push('La photo d\'identité est obligatoire.');
  }
  return erreurs;
}

function creerDossierRegularisation(apprenant, data) {

  let racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
  if (!racine) racine = DriveApp.createFolder(CONFIG.DRIVE_DOSSIER_NOM);

  let dossierReg = trouverSousDossier(racine, 'Régularisations');
  if (!dossierReg) dossierReg = racine.createFolder('Régularisations');

  const nomApprenant    = apprenant.id + ' — ' + apprenant.prenom + ' ' + apprenant.nom;
  const dossierApprenant = dossierReg.createFolder(nomApprenant);

  const p1Mime  = data.piece1MimeType || 'image/jpeg';
  const pieceUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.piece1Base64,
    'piece-identite_' + apprenant.id + '.' + extensionDepuisMime(p1Mime),
    p1Mime
  );

  const phMime   = data.photoMimeType || 'image/jpeg';
  const photoUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.photoBase64,
    'photo-identite_' + apprenant.id + '.' + extensionDepuisMime(phMime),
    phMime
  );

  const signatureUrl = sauvegarderFichierDrive(
    dossierApprenant,
    data.signatureBase64,
    'signature_' + apprenant.id + '.png',
    'image/png'
  );

  return {
    pieceUrl,
    photoUrl,
    signatureUrl,
    dossierUrl: dossierApprenant.getUrl()
  };
}

function enregistrerRegularisation(apprenant) {

  let ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    const defaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (defaut) ss.deleteSheet(defaut);
  }

  const ligne = [
    apprenant.id,
    apprenant.dateSoumission,

    apprenant.prenom,
    apprenant.nom,
    apprenant.sexe,
    apprenant.dateNaissance,
    apprenant.lieuNaissance,
    apprenant.nationalite,
    apprenant.telephone,
    apprenant.email    || '—',
    apprenant.adresse,

    apprenant.prenomMere,
    apprenant.nomMere,
    apprenant.telephoneMere  || '—',
    apprenant.professionMere || '—',
    apprenant.prenomPere,
    apprenant.nomPere,
    apprenant.telephonePere  || '—',
    apprenant.professionPere || '—',
    apprenant.prenomTuteur   || '—',
    apprenant.nomTuteur      || '—',

    apprenant.filiere,
    apprenant.dureeFormation,
    apprenant.dateEntree,
    apprenant.dateFin,
    apprenant.niveauAtteint        || '—',
    apprenant.montantPaye          || '0',
    apprenant.observationFormation || '—',

    apprenant.typePiece,
    apprenant.numeroPiece,
    apprenant.pieceUrl     || '—',
    apprenant.photoUrl     || '—',
    apprenant.signatureUrl || '—',
    apprenant.dossierUrl   || '—',

    apprenant.clause1,
    apprenant.clause2,
    apprenant.dateSignature || '—',

    apprenant.statutDossier,
    apprenant.traitePar      || '—',
    apprenant.dateTraitement || '—'
  ];

  ajouterLigneFeuille(ss, 'Régularisations', ENTETES_REGULARISATION, ligne, 9);
}

function envoyerEmailAdminRegularisation(apprenant) {
  const sujet = '[Régularisation] ' + apprenant.prenom + ' ' + apprenant.nom
              + ' — ' + apprenant.filiere;

  GmailApp.sendEmail(
    CONFIG.ADMIN_EMAIL,
    sujet,
    'Nouveau dossier de régularisation : ' + apprenant.id
    + '. Tél : ' + apprenant.telephone + '.',
    {
      htmlBody: construireEmailAdminReg(apprenant),
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  apprenant.email || CONFIG.ADMIN_EMAIL
    }
  );
}

function construireEmailAdminReg(a) {
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>'
  + '<body style="margin:0;padding:0;background:#F3F4F6;font-family:\'Segoe UI\',Arial,sans-serif;">'
  + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">'
  + '<tr><td align="center">'
  + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">'

  + '<tr><td style="background:' + CONFIG.COULEUR_DARK + ';border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">'
  + '<img src="' + CONFIG.LOGO_URL + '" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>'
  + '<h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>'
  + '<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>'
  + '</td></tr>'

  + '<tr><td style="background:' + CONFIG.COULEUR_ORANGE + ';padding:14px 36px;text-align:center;">'
  + '<p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">NOUVEAU DOSSIER — RÉGULARISATION APPRENANT</p>'
  + '</td></tr>'

  + '<tr><td style="background:#FFF;padding:32px 36px;">'

  + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">'
  + '<tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:' + CONFIG.COULEUR_TEAL + ';font-size:12px;text-transform:uppercase;">Identité de l\'apprenant</td></tr>'
  + ligneInfoEmail('Référence',       a.id)
  + ligneInfoEmail('Date soumission', a.dateSoumission)
  + ligneInfoEmailAccent('Prénom & Nom', a.prenom + ' ' + a.nom)
  + ligneInfoEmail('Sexe',           a.sexe)
  + ligneInfoEmail('Naissance',      a.dateNaissance + ' à ' + a.lieuNaissance)
  + ligneInfoEmail('Nationalité',    a.nationalite)
  + ligneInfoEmail('Téléphone',      a.telephone)
  + ligneInfoEmail('Email',          a.email || '—')
  + ligneInfoEmail('Adresse',        a.adresse)
  + '</table>'

  + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">'
  + '<tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:' + CONFIG.COULEUR_TEAL + ';font-size:12px;text-transform:uppercase;">Filiation parentale</td></tr>'
  + ligneInfoEmail('Mère',       a.prenomMere + ' ' + a.nomMere + (a.telephoneMere ? ' — ' + a.telephoneMere : ''))
  + ligneInfoEmail('Père',       a.prenomPere + ' ' + a.nomPere + (a.telephonePere ? ' — ' + a.telephonePere : ''))
  + (a.prenomTuteur ? ligneInfoEmail('Tuteur', a.prenomTuteur + ' ' + a.nomTuteur) : '')
  + '</table>'

  + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">'
  + '<tr style="background:#FFF6E5;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:' + CONFIG.COULEUR_ORANGE + ';font-size:12px;text-transform:uppercase;">Formation suivie</td></tr>'
  + ligneInfoEmailAccent('Filière',        a.filiere)
  + ligneInfoEmail('Durée',               a.dureeFormation)
  + ligneInfoEmail('Période',             a.dateEntree + ' → ' + a.dateFin)
  + ligneInfoEmail('Niveau atteint',      a.niveauAtteint || '—')
  + ligneInfoEmail('Montant payé',        formatFCFA(a.montantPaye))
  + '</table>'

  + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">'
  + '<tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:' + CONFIG.COULEUR_TEAL + ';font-size:12px;text-transform:uppercase;">Pièces & Documents</td></tr>'
  + ligneInfoEmail('Type pièce',    a.typePiece + ' — N° ' + a.numeroPiece)
  + ligneInfoEmail('Pièce identité',  '<a href="' + a.pieceUrl + '" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;">Ouvrir</a>')
  + ligneInfoEmail('Photo identité',  '<a href="' + a.photoUrl + '" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;">Ouvrir</a>')
  + ligneInfoEmail('Signature',       '<a href="' + a.signatureUrl + '" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;">Ouvrir</a>')
  + ligneInfoEmail('Dossier complet', '<a href="' + a.dossierUrl + '" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;">Ouvrir le dossier Drive</a>')
  + '</table>'

  + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
  + '<td style="padding-right:8px;"><a href="tel:' + a.telephone.replace(/[\s+]/g,'') + '" style="display:block;text-align:center;background:' + CONFIG.COULEUR_TEAL + ';color:#FFF;font-size:14px;font-weight:700;padding:13px;border-radius:10px;text-decoration:none;">Appeler l\'apprenant</a></td>'
  + (a.email ? '<td style="padding-left:8px;"><a href="mailto:' + a.email + '" style="display:block;text-align:center;background:#F3F4F6;color:#1A1A2E;font-size:14px;font-weight:700;padding:13px;border-radius:10px;text-decoration:none;border:1px solid #E5E7EB;">Envoyer un email</a></td>' : '')
  + '</tr></table>'

  + '</td></tr>'
  + piedDePageEmail()
  + '</table></td></tr></table></body></html>';
}

function envoyerEmailApprenantRegularisation(apprenant) {
  GmailApp.sendEmail(
    apprenant.email,
    'Dossier de régularisation reçu — LQD Service — Réf. ' + apprenant.id,
    'Bonjour ' + apprenant.prenom + ', votre dossier de régularisation ' + apprenant.id + ' a bien été enregistré.',
    {
      htmlBody: construireEmailApprenantReg(apprenant),
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  CONFIG.ADMIN_EMAIL
    }
  );
}

function construireEmailApprenantReg(a) {
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>'
  + '<body style="margin:0;padding:0;background:#F3F4F6;font-family:\'Segoe UI\',Arial,sans-serif;">'
  + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">'
  + '<tr><td align="center">'
  + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">'

  + '<tr><td style="background:' + CONFIG.COULEUR_DARK + ';border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">'
  + '<img src="' + CONFIG.LOGO_URL + '" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>'
  + '<h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>'
  + '<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>'
  + '</td></tr>'

  + '<tr><td style="background:' + CONFIG.COULEUR_TEAL + ';padding:14px 36px;text-align:center;">'
  + '<p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">DOSSIER DE RÉGULARISATION REÇU</p>'
  + '</td></tr>'

  + '<tr><td style="background:#FFF;padding:32px 36px;">'
  + '<p style="margin:0 0 24px;font-size:15px;color:#444455;line-height:1.75;">'
  + 'Bonjour <strong>' + a.prenom + '</strong>,<br/><br/>'
  + 'Votre dossier de mise en conformité a bien été enregistré dans notre système. '
  + 'Notre équipe procédera à la vérification de vos informations sous <strong>48 heures</strong> '
  + 'et vous contactera pour vous communiquer votre <strong>identifiant apprenant unique</strong>.'
  + '</p>'

  + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:20px;">'
  + '<tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:' + CONFIG.COULEUR_TEAL + ';font-size:12px;text-transform:uppercase;">Récapitulatif de votre dossier</td></tr>'
  + ligneInfoEmailAccent('Référence dossier', a.id)
  + ligneInfoEmail('Date soumission',  a.dateSoumission)
  + ligneInfoEmail('Nom complet',      a.prenom + ' ' + a.nom)
  + ligneInfoEmailAccent('Filière',    a.filiere)
  + ligneInfoEmail('Période suivie',   a.dateEntree + ' → ' + a.dateFin)
  + '</table>'

  + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FA;border-left:4px solid ' + CONFIG.COULEUR_TEAL + ';border-radius:0 10px 10px 0;margin-bottom:28px;">'
  + '<tr><td style="padding:18px 20px;">'
  + '<p style="margin:0 0 6px;font-weight:700;font-size:14px;color:' + CONFIG.COULEUR_DARK + ';">Prochaine étape</p>'
  + '<p style="margin:0;font-size:13px;color:#6B7280;line-height:1.65;">'
  + 'Conservez votre référence <strong>' + a.id + '</strong>. '
  + 'En cas de besoin, contactez-nous sur WhatsApp en mentionnant cette référence.'
  + '</p>'
  + '</td></tr></table>'

  + '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
  + '<a href="https://wa.me/' + CONFIG.WHATSAPP + '?text=Bonjour%2C%20r%C3%A9f.%20' + a.id + '%20%E2%80%94%20' + encodeURIComponent(a.prenom + ' ' + a.nom) + '." '
  + 'style="display:inline-block;background:#25D366;color:#FFF;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">'
  + 'Nous contacter sur WhatsApp</a>'
  + '</td></tr></table>'

  + '</td></tr>'

  + '<tr><td style="background:#F8FAFA;border:1px solid #E5E7EB;border-top:none;padding:22px 36px;">'
  + '<p style="font-size:13px;color:#6B7280;line-height:1.7;margin:0;">'
  + '<strong style="color:' + CONFIG.COULEUR_DARK + ';">LES QUALITÉS DE DIEU SERVICE SARL</strong><br/>'
  + 'Comé, Hongodé — Route à Akodéha, à côté de la Pharmacie Sainte-Croix, Bénin<br/>'
  + 'Tél / WhatsApp : <a href="tel:+22997951230" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;text-decoration:none;">+229 01 97 95 12 30</a>'
  + '</p></td></tr>'

  + piedDePageEmail()
  + '</table></td></tr></table></body></html>';
}

function testerRegularisation() {
  const fakeData = {
    action: 'regularisation',

    prenom:        'Christelle',
    nom:           'AGOSSOU',
    sexe:          'Féminin',
    dateNaissance: '2001-03-14',
    lieuNaissance: 'Comé',
    nationalite:   'Béninoise',
    telephone:     '+22901XXXXXXXX',
    email:         'christelle@test.bj',
    adresse:       'Comé, Hongodé, Bénin',

    prenomMere:     'Aïchatou',
    nomMere:        'HOUNSOU',
    telephoneMere:  '',
    professionMere: 'Commerçante',
    prenomPere:     'Théodore',
    nomPere:        'AGOSSOU',
    telephonePere:  '',
    professionPere: 'Enseignant',
    prenomTuteur:   '',
    nomTuteur:      '',

    filiere:              'Informatique & Bureautique',
    dureeFormation:       '3 mois',
    dateEntree:           '2023-01-09',
    dateFin:              '2023-04-09',
    niveauAtteint:        'Niveau 1 complété',
    montantPaye:          '45000',
    observationFormation: 'Paiement effectué en espèces à l\'accueil.',

    typePiece:       'CIP (Certificat d\'Identification Personnelle)',
    numeroPiece:     'CIP-TEST-12345',
    piece1Base64:    'dGVzdA==',
    piece1MimeType:  'image/jpeg',
    photoBase64:     'dGVzdA==',
    photoMimeType:   'image/jpeg',
    signatureBase64: 'dGVzdA==',

    clause1Acceptee: true,
    clause2Acceptee: true,
    dateSignature:   new Date().toISOString()
  };

  const resultat = traiterRegularisation(fakeData);
  Logger.log('[testerRegularisation] Réponse : ' + resultat.getContent());
}

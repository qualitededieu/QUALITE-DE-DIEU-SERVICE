const ENTETES_CANDIDATURE = [
  'ID', 'Type',
  'Date candidature',
  'Prénom(s)', 'Nom', 'Téléphone', 'Email', 'Adresse',
  'Domaine', 'Expérience', 'Établissement', 'Niveau d\'études',
  'Durée souhaitée (stage)', 'Disponibilité', 'Motivation',
  'CV (Drive ID)', 'Lettre (Drive ID)', 'Pièce identité (Drive ID)', 'Recommandation (Drive ID)',
  'Statut',
  'Traité par', 'Date traitement',
  'Sexe', 'Date début stage', 'Date fin stage',
  'Missions stage (JSON)'
];

const STATUTS_CANDIDATURE_VALIDES = ['Nouveau', 'Vu', 'Contacté', 'Retenu', 'Terminé', 'Rejeté'];

function repararEnTeteCandidatures() {
  Logger.log('=== RÉPARATION EN-TÊTE CANDIDATURES — Démarrage ===');

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) {
    Logger.log('[ERREUR] Spreadsheet introuvable : ' + CONFIG.SPREADSHEET_NAME);
    return;
  }

  let feuille = ss.getSheetByName('Candidatures');
  if (!feuille) {
    Logger.log('[INFO] Onglet "Candidatures" inexistant pour l\'instant (aucune candidature reçue) — rien à réparer.');
    return;
  }

  const largeurActuelle = feuille.getLastColumn();
  const enteteActuel = largeurActuelle > 0
    ? feuille.getRange(1, 1, 1, largeurActuelle).getValues()[0]
    : [];

  const correspond = enteteActuel.length === ENTETES_CANDIDATURE.length &&
    ENTETES_CANDIDATURE.every(function(titre, i) { return enteteActuel[i] === titre; });

  if (correspond) {
    Logger.log('[OK] En-tête déjà correct sur "Candidatures", seule la mise en forme est réappliquée.');
  } else {
    Logger.log('[CORRECTION] En-tête réécrit sur "Candidatures" (' +
      enteteActuel.length + ' colonne(s) trouvée(s) -> ' + ENTETES_CANDIDATURE.length + ' attendues)');
    feuille.getRange(1, 1, 1, ENTETES_CANDIDATURE.length).setValues([ENTETES_CANDIDATURE]);
  }

  const rangeEntete = feuille.getRange(1, 1, 1, ENTETES_CANDIDATURE.length);
  rangeEntete.setBackground(CONFIG.COULEUR_TEAL);
  rangeEntete.setFontColor('#FFFFFF');
  rangeEntete.setFontWeight('bold');
  rangeEntete.setFontSize(11);
  rangeEntete.setVerticalAlignment('middle');
  feuille.setFrozenRows(1);
  feuille.setRowHeight(1, 36);

  const largeurs = [
    120, 110, 150, 130, 130, 150, 180, 200,
    150, 110, 180, 150, 150, 120, 250,
    160, 160, 160, 160,
    120, 130, 150,
    90, 140, 140, 260
  ];
  largeurs.forEach(function(l, i) {
    if (i < ENTETES_CANDIDATURE.length) feuille.setColumnWidth(i + 1, l);
  });

  const regleStatut = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUTS_CANDIDATURE_VALIDES, true)
    .setAllowInvalid(false).build();
  feuille.getRange('T2:T1000').setDataValidation(regleStatut);

  const regleSexe = SpreadsheetApp.newDataValidation()
    .requireValueInList(['M', 'F'], true)
    .setAllowInvalid(false).build();
  feuille.getRange('W2:W1000').setDataValidation(regleSexe);

  Logger.log('');
  Logger.log('=== RÉPARATION EN-TÊTE CANDIDATURES — Terminé ===');
}

const MISSIONS_STAGE_OPTIONS = [
  'la photocopie',
  "l'impression de documents",
  'la plastification',
  'la reliure de documents',
  'la numérisation de documents',
  'le découpage de papier',
  "l'accueil et l'orientation des clients",
  "l'entretien courant du matériel",
  'les démarches administratives (RCCM, IFU, passeport, ANIP)',
  'la conception graphique',
  'un projet de développement web',
  "l'analyse informatique",
  'la programmation',
  "la gestion en entrepreneuriat",
  "un projet de développement d'application mobile",
];

function enregistrerCandidature(data) {
  const type = String(data.type || '').trim();
  if (!['formateur', 'stage'].includes(type)) {
    return reponseJSON({ status: 'error', message: 'Type de candidature invalide.' });
  }

  const prenom    = nettoyer(data.prenom || '');
  const nom       = nettoyer(data.nom || '');
  const telephone = nettoyer(data.telephone || '');
  const email     = nettoyer(data.email || '');

  if (!prenom || !nom || !telephone) {
    return reponseJSON({ status: 'error', message: 'Prénom, nom et téléphone sont requis.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reponseJSON({ status: 'error', message: 'E-mail invalide.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  let feuille = ss.getSheetByName('Candidatures');
  if (!feuille) {
    feuille = ss.insertSheet('Candidatures');
    feuille.appendRow(ENTETES_CANDIDATURE);
    feuille.setFrozenRows(1);
  }

  const id = genererID('CAND');

  let cvId = '', lettreId = '', pieceId = '', recoId = '';
  try {
    const racine = trouverDossierDrive(CONFIG.DRIVE_DOSSIER_NOM);
    if (racine) {
      const candDossier = trouverSousDossier(racine, 'Candidatures') || racine.createFolder('Candidatures');
      const dossierPerso = candDossier.createFolder(`${id} — ${nom} ${prenom}`);

      if (data.cvBase64 && data.cvNom) {
        cvId = _sauvegarderFichierPrive(dossierPerso, data.cvBase64, 'CV_' + data.cvNom, data.cvMime);
      }
      if (data.lettreBase64 && data.lettreNom) {
        lettreId = _sauvegarderFichierPrive(dossierPerso, data.lettreBase64, 'Lettre_' + data.lettreNom, data.lettreMime);
      }
      if (data.pieceBase64 && data.pieceNom) {
        pieceId = _sauvegarderFichierPrive(dossierPerso, data.pieceBase64, 'Piece_' + data.pieceNom, data.pieceMime);
      }
      if (data.recommandationBase64 && data.recommandationNom) {
        recoId = _sauvegarderFichierPrive(dossierPerso, data.recommandationBase64, 'Recommandation_' + data.recommandationNom, data.recommandationMime);
      }
    }
  } catch (errDrive) {
    console.error('[enregistrerCandidature] upload Drive', errDrive.toString());
  }

  feuille.appendRow([
    id, type,
    new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    prenom, nom, telephone, email, nettoyer(data.adresse || ''),
    nettoyer(data.domaine || ''), nettoyer(data.experience || ''),
    nettoyer(data.etablissement || ''), nettoyer(data.niveauEtudes || ''),
    nettoyer(data.dureeStage || ''), nettoyer(data.disponibilite || ''),
    nettoyer(data.motivation || ''),
    cvId, lettreId, pieceId, recoId,
    'Nouveau', '', '',
    nettoyer(data.sexe || ''), '', ''
  ]);
  forcerTelephoneTexte(feuille, 6, telephone);

  try { _envoyerEmailConfirmationCandidature(data, id, type); } catch (e) { console.error('[enregistrerCandidature] mail candidat', e.toString()); }
  try { _envoyerEmailAdminCandidature(data, id, type); } catch (e) { console.error('[enregistrerCandidature] mail admin', e.toString()); }

  return reponseJSON({ status: 'success', id, message: 'Votre candidature a bien été reçue. Nous reviendrons vers vous si votre profil correspond à nos besoins.' });
}

function _sauvegarderFichierPrive(dossier, base64, nom, mimeType) {
  const octets  = Utilities.base64Decode(base64);
  const blob    = Utilities.newBlob(octets, mimeType || 'application/octet-stream', nom);
  const fichier = dossier.createFile(blob);
  return fichier.getId();
}

function adminGetCandidatures(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const feuille = ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'success', candidatures: [] });

  const rows = feuille.getDataRange().getValues();
  const candidatures = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    candidatures.push({
      id: r[0], type: r[1], dateCandidature: r[2],
      prenom: r[3], nom: r[4], telephone: String(r[5]), email: r[6], adresse: r[7],
      domaine: r[8], experience: r[9], etablissement: r[10], niveauEtudes: r[11],
      dureeStage: r[12], disponibilite: r[13], motivation: r[14],
      aCV: !!r[15], aLettre: !!r[16], aPiece: !!r[17], aRecommandation: !!r[18],
      statut: r[19] || 'Nouveau', traitePar: r[20] || '', dateTraitement: r[21] || '',
      sexe: String(r[22] || '').trim(), dateDebutStage: r[23] || '', dateFinStage: r[24] || '',
      missionsStage: _parseMissionsStageJSON(r[25])
    });
  }
  candidatures.sort((a, b) => new Date(b.dateCandidature) - new Date(a.dateCandidature));
  return reponseJSON({ status: 'success', candidatures });
}

function adminUpdateStatutCandidature(data, email) {
  const id     = String(data.id || '').trim();
  const statut = String(data.statut || '').trim();
  if (!id || !STATUTS_CANDIDATURE_VALIDES.includes(statut)) {
    return reponseJSON({ status: 'error', message: 'Paramètres invalides.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== id) continue;
    feuille.getRange(i + 1, 20).setValue(statut);
    feuille.getRange(i + 1, 21).setValue(email);
    feuille.getRange(i + 1, 22).setValue(new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }));
    return reponseJSON({ status: 'success', message: 'Statut mis à jour.' });
  }
  return reponseJSON({ status: 'error', message: 'Candidature introuvable.' });
}

function adminSetPeriodeStage(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const missionsRecues = Array.isArray(data.missionsStage) ? data.missionsStage : [];
  const missionsValides = missionsRecues.filter(m => MISSIONS_STAGE_OPTIONS.includes(m));

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== id) continue;
    feuille.getRange(i + 1, 24).setValue(String(data.dateDebutStage || ''));
    feuille.getRange(i + 1, 25).setValue(String(data.dateFinStage   || ''));
    feuille.getRange(i + 1, 26).setValue(JSON.stringify(missionsValides));
    return reponseJSON({ status: 'success', message: 'Période de stage enregistrée.' });
  }
  return reponseJSON({ status: 'error', message: 'Candidature introuvable.' });
}

function _parseMissionsStageJSON(valeurCellule) {
  if (!valeurCellule) return [];
  try {
    const arr = JSON.parse(valeurCellule);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function candidatureAttestationGetData(data) {
  // Même interrupteur temporaire que l'espace apprenant (voir getCarte
  // dans carte.gs) — le site étant en construction, on peut couper
  // l'accès aux deux sans toucher au code.
  const bloque = PropertiesService.getScriptProperties().getProperty('TELECHARGEMENT_BLOQUE') === 'true';
  if (bloque) {
    return reponseJSON({
      status: 'error',
      message: "L'espace candidat est temporairement indisponible — le site est en cours de finalisation. Merci de réessayer bientôt."
    });
  }

  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé.' });

  const rows = feuille.getDataRange().getValues();
  let idTrouveTelIncorrect = false;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    if (String(r[0]).trim() !== id) continue;
    if (!_telephonesEquivalents(r[5], telephone)) { idTrouveTelIncorrect = true; continue; }

    if (String(r[1]).trim() !== 'stage') {
      return reponseJSON({ status: 'error', message: 'Ce dossier n\'est pas une candidature de stage.' });
    }
    if (String(r[19]).trim() !== 'Terminé') {
      return reponseJSON({ status: 'error', message: 'Votre stage n\'est pas encore marqué comme terminé par l\'administration.' });
    }

    const candidat = {
      id:            String(r[0]),
      prenom:        String(r[3]),
      nom:           String(r[4]),
      sexe:          String(r[22] || '').trim(),
      dateNaissance: '',
      telephone:     String(r[5]),
      email:         String(r[6]),
      filiere:       String(r[8] || 'Stage professionnel'),
      dateEntree:    String(r[23] || ''),
      dateFin:       String(r[24] || ''),
      missionsStage: _parseMissionsStageJSON(r[25]),
      photoUrl:      '',
      source:        'candidature-stage'
    };

    const token = _genererTokenCarte(candidat);
    return reponseJSON({ status: 'success', apprenant: candidat, token });
  }

  if (idTrouveTelIncorrect && _telephoneSembleIncomplet(telephone)) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas. Au Bénin, les numéros commencent maintenant par 01 — vérifiez que votre numéro est bien précédé de 01 (ex : 01 97 95 12 30).' });
  }
  if (idTrouveTelIncorrect) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas.' });
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Vérifiez votre numéro et téléphone.' });
}

function adminObtenirDocumentCandidature(data, email) {
  const id   = String(data.id || '').trim();
  const type = String(data.typeDocument || '').trim();
  const COL_DOCUMENT = { cv: 15, lettre: 16, piece: 17, recommandation: 18 };

  if (!id || !COL_DOCUMENT.hasOwnProperty(type)) {
    return reponseJSON({ status: 'error', message: 'Paramètres invalides.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== id) continue;
    const fileId = String(rows[i][COL_DOCUMENT[type]] || '');
    if (!fileId) return reponseJSON({ status: 'error', message: 'Aucun document de ce type pour cette candidature.' });
    try {
      const fichier = DriveApp.getFileById(fileId);
      const blob    = fichier.getBlob();
      return reponseJSON({
        status: 'success',
        nomFichier: fichier.getName(),
        mimeType:   blob.getContentType(),
        base64:     Utilities.base64Encode(blob.getBytes())
      });
    } catch (e) {
      return reponseJSON({ status: 'error', message: 'Impossible de lire le document : ' + e.toString() });
    }
  }
  return reponseJSON({ status: 'error', message: 'Candidature introuvable.' });
}

function adminDeleteCandidature(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== id) continue;

    [15, 16, 17, 18].forEach(col => {
      const fileId = rows[i][col];
      if (fileId) {
        try { DriveApp.getFileById(fileId).setTrashed(true); }
        catch (e) { console.error('[adminDeleteCandidature] fichier', fileId, e.toString()); }
      }
    });

    feuille.deleteRow(i + 1);
    console.log(`[Admin:${email}] Candidature supprimée → ${id}`);
    return reponseJSON({ status: 'success', message: 'Candidature supprimée.' });
  }
  return reponseJSON({ status: 'error', message: 'Candidature introuvable.' });
}

function _envoyerEmailConfirmationCandidature(data, id, type) {
  if (!data.email) return;
  const labelType = type === 'formateur' ? 'Formateur / Staff' : 'Stage';
  const annee     = new Date().getFullYear();

  const htmlBody = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#04342C;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;margin:0 auto 12px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#A7C4BC;">Candidature reçue</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
      Bonjour <strong>${nettoyer(data.prenom)} ${nettoyer(data.nom)}</strong>,<br/><br/>
      Votre candidature (<strong>${labelType}</strong>) a bien été enregistrée. Merci pour votre intérêt envers LQD Service.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#F9FAFB;">
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;width:40%;">Référence</td>
        <td style="padding:10px 16px;color:#111827;font-family:monospace;">${id}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Type</td>
        <td style="padding:10px 16px;color:#111827;">${labelType}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.7;">
      Notre équipe étudie votre dossier et vous recontactera directement si votre profil correspond
      à nos besoins actuels. Conservez votre référence pour toute correspondance.
    </p>
  </td></tr>
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${annee} Les Qualités de Dieu Service SARL — Comé, Bénin</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  GmailApp.sendEmail(
    data.email,
    `Candidature reçue — LQD Service (${id})`,
    `Bonjour ${data.prenom}, votre candidature LQD Service (${labelType}) a bien été reçue. Référence : ${id}.`,
    { htmlBody, name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL }
  );
}

function _envoyerEmailAdminCandidature(data, id, type) {
  const labelType = type === 'formateur' ? 'Formateur / Staff' : 'Stage';

  const htmlBody = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#04342C;padding:22px 32px;">
    <h1 style="margin:0;font-size:16px;color:#FFF;font-weight:700;">Nouvelle candidature (${labelType})</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#A7C4BC;">Réf. ${id}</p>
  </td></tr>
  <tr><td style="padding:20px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 14px;color:#6B7280;font-weight:600;font-size:13px;width:38%;border-bottom:1px solid #F3F4F6;">Candidat</td><td style="padding:8px 14px;color:#111827;font-size:13px;border-bottom:1px solid #F3F4F6;">${nettoyer(data.prenom)} ${nettoyer(data.nom)}</td></tr>
      <tr><td style="padding:8px 14px;color:#6B7280;font-weight:600;font-size:13px;border-bottom:1px solid #F3F4F6;">Téléphone</td><td style="padding:8px 14px;color:#111827;font-size:13px;border-bottom:1px solid #F3F4F6;">${nettoyer(data.telephone)}</td></tr>
      <tr><td style="padding:8px 14px;color:#6B7280;font-weight:600;font-size:13px;border-bottom:1px solid #F3F4F6;">E-mail</td><td style="padding:8px 14px;color:#111827;font-size:13px;border-bottom:1px solid #F3F4F6;">${nettoyer(data.email) || '—'}</td></tr>
      <tr><td style="padding:8px 14px;color:#6B7280;font-weight:600;font-size:13px;border-bottom:1px solid #F3F4F6;">Domaine</td><td style="padding:8px 14px;color:#111827;font-size:13px;border-bottom:1px solid #F3F4F6;">${nettoyer(data.domaine) || '—'}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 20px 24px;text-align:center;">
    <a href="${CONFIG.SITE_URL}/admin" style="display:inline-block;background:#04342C;color:#FFF;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">Voir dans le tableau de bord</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  GmailApp.sendEmail(
    CONFIG.ADMIN_EMAIL,
    `[Candidature] ${labelType} — ${nettoyer(data.prenom)} ${nettoyer(data.nom)} (${id})`,
    `Nouvelle candidature ${labelType} de ${data.prenom} ${data.nom} — ${data.telephone}. Référence ${id}.`,
    { htmlBody, name: CONFIG.EXPEDITEUR_NOM }
  );
}

/* =====================================================================
   INTÉGRATION — À ajouter dans routerAdmin() de admin.gs :

   case 'admin_get_candidatures':          return requireAuth(data, adminGetCandidatures);
   case 'admin_update_statut_candidature': return requireAuth(data, adminUpdateStatutCandidature);
   case 'admin_obtenir_doc_candidature':   return requireAuth(data, adminObtenirDocumentCandidature);
   case 'admin_delete_candidature':        return requireAuth(data, adminDeleteCandidature);

   Et dans doPost() de code.gs, AVANT le routing admin_ (déjà fait) :
   if (action === 'candidature') return enregistrerCandidature(data);
   ===================================================================== */

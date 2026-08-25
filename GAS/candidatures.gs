/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Candidatures (page Postuler)
   Fichier  : candidatures.gs
   Version  : 1.0.0
   Rôle     : Candidatures formateur/staff et stage, totalement séparées
              du parcours d'inscription apprenant (pas de paiement, pas
              de lien avec le Sheet "Toutes les inscriptions").

   ROUTES :
     action === 'candidature'                    : enregistrerCandidature(data)         // public
     action === 'candidature_attestation_get_data': candidatureAttestationGetData(data)  // public
     case 'admin_get_candidatures'               : requireAuth(data, adminGetCandidatures)
     case 'admin_update_statut_candidature'      : requireAuth(data, adminUpdateStatutCandidature)
     case 'admin_obtenir_doc_candidature'        : requireAuth(data, adminObtenirDocumentCandidature)
     case 'admin_delete_candidature'             : requireAuth(data, adminDeleteCandidature)
     case 'admin_set_periode_stage'              : requireAuth(data, adminSetPeriodeStage)

     (À ajouter dans routerAdmin() de admin.gs — voir bloc en bas de fichier)

   ATTESTATION DE FIN DE STAGE :
     Une candidature de type 'stage' dont le statut est 'Terminé' devient
     éligible à une attestation de fin de stage, récupérable en libre-
     service (ID + téléphone) via candidatureAttestationGetData(), sur
     le même principe que la carte d'apprentissage (carte.gs) — token
     HMAC signé (réutilise _genererTokenCarte/CARTE_CONFIG), généré et
     mis en page côté client par js/attestation_generator.js (détecte
     apprenant.source === 'candidature-stage' pour adapter le texte).
   ===================================================================== */


// =====================================================================
// EN-TÊTES — Feuille "Candidatures"
// Les 3 dernières colonnes (Sexe, Date début stage, Date fin stage)
// sont ajoutées EN FIN de tableau exprès : ça préserve les index des
// colonnes déjà utilisées (documents, statut...) pour les dossiers
// déjà soumis avant cet ajout.
// =====================================================================
const ENTETES_CANDIDATURE = [
  'ID', 'Type',                 // formateur | stage
  'Date candidature',
  'Prénom(s)', 'Nom', 'Téléphone', 'Email', 'Adresse',
  'Domaine', 'Expérience', 'Établissement', 'Niveau d\'études',
  'Durée souhaitée (stage)', 'Disponibilité', 'Motivation',
  'CV (Drive ID)', 'Lettre (Drive ID)', 'Pièce identité (Drive ID)', 'Recommandation (Drive ID)',
  'Statut',                     // Nouveau | Vu | Contacté | Retenu | Terminé | Rejeté
  'Traité par', 'Date traitement',
  'Sexe', 'Date début stage', 'Date fin stage'
];

const STATUTS_CANDIDATURE_VALIDES = ['Nouveau', 'Vu', 'Contacté', 'Retenu', 'Terminé', 'Rejeté'];


// =====================================================================
// ROUTE PUBLIC — Enregistrer une candidature
// =====================================================================
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

  // Upload des pièces — dossier Drive PRIVÉ dédié (jamais de lien public,
  // contrairement aux photos d'inscription : ce sont CV/pièce d'identité).
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

  try { _envoyerEmailConfirmationCandidature(data, id, type); } catch (e) { console.error('[enregistrerCandidature] mail candidat', e.toString()); }
  try { _envoyerEmailAdminCandidature(data, id, type); } catch (e) { console.error('[enregistrerCandidature] mail admin', e.toString()); }

  return reponseJSON({ status: 'success', id, message: 'Votre candidature a bien été reçue. Nous reviendrons vers vous si votre profil correspond à nos besoins.' });
}


// =====================================================================
// HELPER — Sauvegarde un fichier dans Drive SANS le rendre public
// (à la différence de sauvegarderFichierDrive() dans code.gs, utilisée
// pour les pièces d'inscription qui doivent rester consultables via
// lien direct). Les documents de candidature ne sont lus que par
// l'admin, via obtenirDocumentCandidature() qui renvoie le contenu
// encodé en base64 après vérification de session.
// =====================================================================
function _sauvegarderFichierPrive(dossier, base64, nom, mimeType) {
  const octets  = Utilities.base64Decode(base64);
  const blob    = Utilities.newBlob(octets, mimeType || 'application/octet-stream', nom);
  const fichier = dossier.createFile(blob);
  return fichier.getId();
}


// =====================================================================
// ROUTE ADMIN — Liste des candidatures
// =====================================================================
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
      sexe: r[22] || '', dateDebutStage: r[23] || '', dateFinStage: r[24] || ''
    });
  }
  candidatures.sort((a, b) => new Date(b.dateCandidature) - new Date(a.dateCandidature));
  return reponseJSON({ status: 'success', candidatures });
}


// =====================================================================
// ROUTE ADMIN — Changer le statut d'une candidature
// =====================================================================
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
    feuille.getRange(i + 1, 20).setValue(statut);        // colonne "Statut" (20e, 1-based)
    feuille.getRange(i + 1, 21).setValue(email);          // "Traité par"
    feuille.getRange(i + 1, 22).setValue(new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' })); // "Date traitement"
    return reponseJSON({ status: 'success', message: 'Statut mis à jour.' });
  }
  return reponseJSON({ status: 'error', message: 'Candidature introuvable.' });
}


// =====================================================================
// ROUTE ADMIN — Fixer la période de stage (dates début/fin)
// Utilisé quand l'admin marque un stage comme "Terminé" : ces dates
// apparaîtront sur l'attestation de fin de stage.
// =====================================================================
function adminSetPeriodeStage(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== id) continue;
    feuille.getRange(i + 1, 24).setValue(String(data.dateDebutStage || '')); // colonne "Date début stage" (24e, 1-based)
    feuille.getRange(i + 1, 25).setValue(String(data.dateFinStage   || '')); // colonne "Date fin stage" (25e, 1-based)
    return reponseJSON({ status: 'success', message: 'Période de stage enregistrée.' });
  }
  return reponseJSON({ status: 'error', message: 'Candidature introuvable.' });
}


// =====================================================================
// ROUTE PUBLIC — Récupérer les données pour l'attestation de fin de
// stage (candidat ayant postulé via "Postuler", type stage, statut
// "Terminé"). Vérification : ID dossier (CAND-...) + téléphone,
// normalisé comme pour la carte (voir _normaliserTel dans carte.gs).
// =====================================================================
function candidatureAttestationGetData(data) {
  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Candidatures');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé.' });

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    if (String(r[0]).trim() !== id) continue;
    if (_normaliserTel(r[5]) !== _normaliserTel(telephone)) continue;

    if (String(r[1]).trim() !== 'stage') {
      return reponseJSON({ status: 'error', message: 'Ce dossier n\'est pas une candidature de stage.' });
    }
    if (String(r[19]).trim() !== 'Terminé') {
      return reponseJSON({ status: 'error', message: 'Votre stage n\'est pas encore marqué comme terminé par l\'administration.' });
    }

    // Objet compatible avec js/attestation_generator.js (mêmes clés
    // que l'apprenant carte.gs) — le générateur détecte "source" pour
    // adapter le texte au vocabulaire "stage" plutôt que "formation".
    const candidat = {
      id:            String(r[0]),
      prenom:        String(r[3]),
      nom:           String(r[4]),
      sexe:          String(r[22] || ''),
      dateNaissance: '',
      telephone:     String(r[5]),
      email:         String(r[6]),
      filiere:       String(r[8] || 'Stage professionnel'), // domaine
      dateEntree:    String(r[23] || ''), // date début stage
      dateFin:       String(r[24] || ''), // date fin stage
      photoUrl:      '',
      source:        'candidature-stage'
    };

    const token = _genererTokenCarte(candidat);
    return reponseJSON({ status: 'success', apprenant: candidat, token });
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Vérifiez votre numéro et téléphone.' });
}


// =====================================================================
// ROUTE ADMIN — Lire un document de candidature (CV, lettre, pièce...)
// =====================================================================
function adminObtenirDocumentCandidature(data, email) {
  const id   = String(data.id || '').trim();
  const type = String(data.typeDocument || '').trim();
  const COL_DOCUMENT = { cv: 15, lettre: 16, piece: 17, recommandation: 18 }; // 0-based

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


// =====================================================================
// ROUTE ADMIN — Supprimer une candidature (dossier Drive mis à la corbeille)
// =====================================================================
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


// =====================================================================
// EMAIL — Accusé de réception au candidat
// =====================================================================
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


// =====================================================================
// EMAIL — Notification admin
// =====================================================================
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

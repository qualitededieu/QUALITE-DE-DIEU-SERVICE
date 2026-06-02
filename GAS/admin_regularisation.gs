/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Admin : Module Régularisations
   Fichier  : admin_regularisation.gs
   Version  : 1.0.0

   INTÉGRATION dans admin.gs :
     Dans routerAdmin(), ajouter les cases suivantes dans le switch :

       case 'admin_get_regs':          return requireAuth(data, adminGetRegularisations);
       case 'admin_get_reg':           return requireAuth(data, adminGetRegularisation);
       case 'admin_update_reg_statut': return requireAuth(data, adminUpdateRegStatut);
       case 'admin_delete_reg':        return requireAuth(data, adminDeleteRegularisation);

   INTÉGRATION dans adminGetStats() :
     Ajouter à la fin de la fonction, avant le return, le bloc
     marqué [PATCH STATS] ci-dessous.
   ===================================================================== */


// =====================================================================
// [PATCH STATS] — Coller ce bloc dans adminGetStats(), avant le return
// =====================================================================
//
//   const feuilleRegs = ss.getSheetByName('Régularisations');
//   stats.regularisations       = 0;
//   stats.regsEnAttente         = 0;
//   stats.regsValidees          = 0;
//   if (feuilleRegs) {
//     const donneesR = feuilleRegs.getDataRange().getValues();
//     for (let i = 1; i < donneesR.length; i++) {
//       if (!donneesR[i][0]) continue;
//       stats.regularisations++;
//       const st = donneesR[i][37] || '';
//       if (st === 'En attente') stats.regsEnAttente++;
//       if (st === 'Validé')     stats.regsValidees++;
//     }
//   }
//
// =====================================================================


// =====================================================================
// LECTURE — Liste des régularisations (paginée, filtrable)
// =====================================================================
function adminGetRegularisations(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Régularisations');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille Régularisations introuvable.' });

  const donnees  = feuille.getDataRange().getValues();
  const page     = Number(data.page    || 1);
  const perPage  = Number(data.perPage || 20);
  const filtre   = data.filtre   || '';
  const recherche= (data.recherche || '').toLowerCase();

  let regs = [];

  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;

    const reg = mapperLigneRegularisation(row, i + 1);

    // Filtres statut
    if (filtre === 'reg_attente'  && reg.statutDossier !== 'En attente') continue;
    if (filtre === 'reg_valide'   && reg.statutDossier !== 'Validé')     continue;
    if (filtre === 'reg_rejete'   && reg.statutDossier !== 'Rejeté')     continue;

    // Recherche libre
    if (recherche) {
      const haystack = [reg.id, reg.prenom, reg.nom, reg.telephone, reg.email, reg.filiere].join(' ').toLowerCase();
      if (!haystack.includes(recherche)) continue;
    }

    regs.push(reg);
  }

  // Tri : plus récents en premier
  regs.sort((a, b) => b.ligneIndex - a.ligneIndex);

  const total = regs.length;
  const debut = (page - 1) * perPage;
  const slice = regs.slice(debut, debut + perPage);

  return reponseJSON({
    status:  'success',
    regs:    slice,
    total,
    page,
    perPage,
    pages:   Math.ceil(total / perPage)
  });
}


// =====================================================================
// LECTURE — Régularisation individuelle complète
// =====================================================================
function adminGetRegularisation(data, email) {
  const id = data.id || '';
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Régularisations');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (donnees[i][0] === id) {
      return reponseJSON({
        status: 'success',
        reg:    mapperLigneRegularisation(donnees[i], i + 1)
      });
    }
  }

  return reponseJSON({ status: 'error', message: `Régularisation ${id} introuvable.` });
}


// =====================================================================
// WRITE — Mettre à jour le statut d'une régularisation
// Si statut → "Validé" : envoi email à l'apprenant avec son ID
// =====================================================================
function adminUpdateRegStatut(data, email) {
  const { id, statut } = data;
  const valeursValides   = ['En attente', 'Validé', 'Rejeté'];

  if (!id || !valeursValides.includes(statut)) {
    return reponseJSON({ status: 'error', message: 'ID ou statut invalide.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Régularisations');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();

  // Colonne "Statut dossier" = index 37 (0-based) = colonne 38
  const COL_STATUT    = 38; // 1-based
  const COL_TRAITE_PAR= 39;
  const COL_DATE_TRAIT= 40;

  for (let i = 1; i < donnees.length; i++) {
    if (donnees[i][0] !== id) continue;

    const now = new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' });

    feuille.getRange(i + 1, COL_STATUT).setValue(statut);
    feuille.getRange(i + 1, COL_TRAITE_PAR).setValue(email);
    feuille.getRange(i + 1, COL_DATE_TRAIT).setValue(now);

    // Email de confirmation si statut "Validé"
    if (statut === 'Validé') {
      const reg = mapperLigneRegularisation(donnees[i], i + 1);
      if (reg.email) {
        try {
          envoyerEmailValidationReg(reg);
        } catch (errEmail) {
          console.error('[adminUpdateRegStatut email]', errEmail.toString());
        }
      }
    }

    console.log('[Admin:' + email + '] Régularisation ' + id + ' → ' + statut);
    return reponseJSON({ status: 'success', message: 'Statut mis à jour : ' + statut });
  }

  return reponseJSON({ status: 'error', message: 'Régularisation ' + id + ' non trouvée.' });
}


// =====================================================================
// WRITE — Supprimer une régularisation
// =====================================================================
function adminDeleteRegularisation(data, email) {
  const id = data.id || '';
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Régularisations');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();

  for (let i = donnees.length - 1; i >= 1; i--) {
    if (donnees[i][0] !== id) continue;

    // Corbeille dossier Drive si URL présente (colonne 33 = index 33)
    const urlDossier = String(donnees[i][33] || '');
    if (urlDossier && urlDossier.includes('drive.google.com')) {
      try {
        const match = urlDossier.match(/[-\w]{25,}/);
        if (match) DriveApp.getFolderById(match[0]).setTrashed(true);
      } catch (errDrive) {
        console.error('[adminDeleteReg Drive]', errDrive.toString());
      }
    }

    feuille.deleteRow(i + 1);
    console.log('[Admin:' + email + '] Régularisation supprimée : ' + id);
    return reponseJSON({ status: 'success', message: 'Régularisation ' + id + ' supprimée.' });
  }

  return reponseJSON({ status: 'error', message: 'Régularisation ' + id + ' non trouvée.' });
}


// =====================================================================
// EMAIL — Confirmation validation régularisation (envoi ID apprenant)
// =====================================================================
function envoyerEmailValidationReg(reg) {
  const sujet = 'Votre dossier est validé — ID Apprenant LQD Service : ' + reg.id;

  const htmlBody = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>'
  + '<body style="margin:0;padding:0;background:#F3F4F6;font-family:\'Segoe UI\',Arial,sans-serif;">'
  + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">'
  + '<tr><td align="center">'
  + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">'

  // En-tête
  + '<tr><td style="background:' + CONFIG.COULEUR_DARK + ';border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">'
  + '<img src="' + CONFIG.LOGO_URL + '" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>'
  + '<h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>'
  + '<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Centre de Formation Professionnelle — Comé, Bénin</p>'
  + '</td></tr>'

  // Bandeau validation
  + '<tr><td style="background:#1D9E75;padding:14px 36px;text-align:center;">'
  + '<p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">DOSSIER VALIDÉ — IDENTIFIANT APPRENANT ATTRIBUÉ</p>'
  + '</td></tr>'

  // Corps
  + '<tr><td style="background:#FFF;padding:32px 36px;">'
  + '<p style="margin:0 0 24px;font-size:15px;color:#444455;line-height:1.75;">'
  + 'Bonjour <strong>' + reg.prenom + '</strong>,<br/><br/>'
  + 'Votre dossier de régularisation a été examiné et <strong>validé</strong> par notre équipe. '
  + 'Vous êtes désormais officiellement enregistré(e) dans la base de données '
  + 'de <strong>LES QUALITÉS DE DIEU SERVICE SARL</strong>.'
  + '</p>'

  // Bloc ID apprenant
  + '<div style="text-align:center;margin:28px 0;">'
  + '<p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6B7280;margin-bottom:10px;">Votre identifiant apprenant unique</p>'
  + '<div style="display:inline-block;background:#E1F5EE;border:2px solid #1D9E75;border-radius:12px;padding:16px 36px;">'
  + '<span style="font-family:monospace;font-size:28px;font-weight:800;color:#04342C;letter-spacing:3px;">' + reg.id + '</span>'
  + '</div>'
  + '<p style="font-size:12px;color:#9CA3AF;margin-top:10px;">Conservez cet identifiant — il vous sera demandé pour tout suivi administratif.</p>'
  + '</div>'

  // Récapitulatif
  + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">'
  + '<tr style="background:#F0F9FA;"><td colspan="2" style="padding:12px 18px;font-weight:700;color:' + CONFIG.COULEUR_TEAL + ';font-size:12px;text-transform:uppercase;">Récapitulatif de votre dossier</td></tr>'
  + ligneInfoEmail('Nom complet',   reg.prenom + ' ' + reg.nom)
  + ligneInfoEmailAccent('Filière', reg.filiere)
  + ligneInfoEmail('Période',       reg.dateEntree + ' → ' + reg.dateFin)
  + ligneInfoEmail('Durée',         reg.dureeFormation)
  + '</table>'

  // CTA WhatsApp
  + '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
  + '<a href="https://wa.me/' + CONFIG.WHATSAPP + '?text=Bonjour%2C%20ID%20apprenant%20' + reg.id + '." '
  + 'style="display:inline-block;background:#25D366;color:#FFF;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">'
  + 'Nous contacter sur WhatsApp</a>'
  + '</td></tr></table>'

  + '</td></tr>'
  + piedDePageEmail()
  + '</table></td></tr></table></body></html>';

  GmailApp.sendEmail(
    reg.email,
    sujet,
    'Bonjour ' + reg.prenom + ', votre dossier de régularisation ' + reg.id + ' est validé. Votre identifiant apprenant vous est attribué.',
    {
      htmlBody,
      name:    CONFIG.EXPEDITEUR_NOM,
      replyTo: CONFIG.ADMIN_EMAIL
    }
  );
}


// =====================================================================
// HELPER — Mapper une ligne "Régularisations" vers objet JS
// Correspond à ENTETES_REG_INIT (40 colonnes, index 0–39)
// =====================================================================
function mapperLigneRegularisation(row, ligneIndex) {
  return {
    ligneIndex,

    // Identifiant
    id:              row[0]  || '',
    dateSoumission:  row[1]  || '',

    // Identité
    prenom:          row[2]  || '',
    nom:             row[3]  || '',
    sexe:            row[4]  || '',
    dateNaissance:   row[5]  || '',
    lieuNaissance:   row[6]  || '',
    nationalite:     row[7]  || '',
    telephone:       row[8]  || '',
    email:           row[9]  || '',
    adresse:         row[10] || '',

    // Filiation
    prenomMere:      row[11] || '',
    nomMere:         row[12] || '',
    telephoneMere:   row[13] || '',
    professionMere:  row[14] || '',
    prenomPere:      row[15] || '',
    nomPere:         row[16] || '',
    telephonePere:   row[17] || '',
    professionPere:  row[18] || '',
    prenomTuteur:    row[19] || '',
    nomTuteur:       row[20] || '',

    // Formation
    filiere:         row[21] || '',
    dureeFormation:  row[22] || '',
    dateEntree:      row[23] || '',
    dateFin:         row[24] || '',
    niveauAtteint:   row[25] || '',
    montantPaye:     row[26] || 0,
    observation:     row[27] || '',

    // Pièces Drive
    typePiece:       row[28] || '',
    numeroPiece:     row[29] || '',
    pieceUrl:        row[30] || '',
    photoUrl:        row[31] || '',
    signatureUrl:    row[32] || '',
    dossierUrl:      row[33] || '',

    // Consentement
    clause1:         row[34] || '',
    clause2:         row[35] || '',
    dateSignature:   row[36] || '',

    // Statut admin
    statutDossier:   row[37] || 'En attente',
    traitePar:       row[38] || '',
    dateTraitement:  row[39] || ''
  };
}

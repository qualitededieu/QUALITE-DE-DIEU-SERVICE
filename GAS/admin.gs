const ADMIN_CONFIG = {
  EMAILS_AUTORISES: [
    'lqddssarl@gmail.com',
    'phanoskosmos@gmail.com',
    'qualitededieuservice@gmail.com'
  ],
  MOT_DE_PASSE:     'adminqds@2026',
  TOKEN_SECRET:     'lqd-super-secret-key-2026-xK9mP3qR7wN2vL5j',
  TOKEN_EXPIRY_SEC: 8 * 60 * 60,
  OTP_EXPIRY_SEC:   10 * 60,
  GOOGLE_CLIENT_ID: '849690475047-6km7beuqu8773a9qkaj9qfole90bkcdr.apps.googleusercontent.com',
  OTP_PREFIX:       'OTP_',
  SESSION_PREFIX:   'SESSION_'
};

function routerAdmin(data, action) {
  try {
    switch (action) {

      case 'admin_login':               return adminLogin(data);
      case 'admin_verify_otp':          return adminVerifyOtp(data);
      case 'admin_verify_google':       return adminVerifyGoogle(data);
      case 'admin_logout':              return adminLogout(data);
      case 'admin_forgot_password_request': return adminForgotPasswordRequest(data);
      case 'admin_forgot_password_reset':   return adminForgotPasswordReset(data);

      case 'admin_get_stats':           return requireAuth(data, adminGetStats);
      case 'admin_get_dossiers':        return requireAuth(data, adminGetDossiers);
      case 'admin_get_rens':            return requireAuth(data, adminGetRenseignements);
      case 'admin_get_dossier':         return requireAuth(data, adminGetDossier);

      case 'admin_update_statut':       return requireAuth(data, adminUpdateStatut);
      case 'admin_update_paiement':     return requireAuth(data, adminUpdatePaiement);
      case 'admin_update_suivi':        return requireAuth(data, adminUpdateSuivi);
      case 'admin_apercu_attestation':  return requireAuth(data, adminApercuAttestation);
      case 'admin_debloquer_telechargement': return requireAuth(data, adminDebloquerTelechargement);
      case 'admin_send_relance':        return requireAuth(data, adminSendRelance);
      case 'admin_delete_dossier':      return requireAuth(data, adminDeleteDossier);
      case 'admin_export_csv':          return requireAuth(data, adminExportCSV);

      case 'carte_get_data':            return getCarte(data);
      case 'carte_verifier':            return verifierCarte(data);
      case 'admin_envoyer_carte':       return requireAuth(data, envoyerCarteAdmin);

      case 'admin_get_candidatures':          return requireAuth(data, adminGetCandidatures);
      case 'admin_update_statut_candidature': return requireAuth(data, adminUpdateStatutCandidature);
      case 'admin_obtenir_doc_candidature':   return requireAuth(data, adminObtenirDocumentCandidature);
      case 'admin_delete_candidature':        return requireAuth(data, adminDeleteCandidature);
      case 'admin_set_periode_stage':         return requireAuth(data, adminSetPeriodeStage);

      case 'admin_annonces_list':       return requireAuth(data, adminAnnoncesList);
      case 'admin_annonce_creer':       return requireAuth(data, adminAnnonceCreer);
      case 'admin_annonce_modifier':    return requireAuth(data, adminAnnonceModifier);
      case 'admin_annonce_supprimer':   return requireAuth(data, adminAnnonceSupprimer);
      case 'admin_annonce_upload_image': return requireAuth(data, adminAnnonceUploadImage);

      case 'admin_bandeau_get':         return requireAuth(data, adminBandeauGet);
      case 'admin_bandeau_set':         return requireAuth(data, adminBandeauSet);
      case 'bandeau_get_public':        return bandeauGetPublic(data);

      default:
        return reponseJSON({ status: 'error', message: 'Action admin inconnue.' });
    }
  } catch (err) {
    console.error('[routerAdmin]', err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur interne admin.' });
  }
}

function requireAuth(data, fn) {
  const token = data.token;
  if (!token) return reponseJSON({ status: 'auth_error', message: 'Token manquant.' });
  const payload = verifierToken(token);
  if (!payload) return reponseJSON({ status: 'auth_error', message: 'Token invalide ou expiré.' });
  return fn(data, payload.email);
}

function adminLogin(data) {
  const email = (data.email || '').trim().toLowerCase();
  const mdp   = data.password || '';

  if (!ADMIN_CONFIG.EMAILS_AUTORISES.map(e => e.toLowerCase()).includes(email)) {
    return reponseJSON({ status: 'error', message: 'Accès refusé.' });
  }
  if (mdp !== _getMotDePasseActuel()) {
    return reponseJSON({ status: 'error', message: 'Identifiants incorrects.' });
  }

  const otp      = genererOTP();
  const expireAt = Date.now() + ADMIN_CONFIG.OTP_EXPIRY_SEC * 1000;

  PropertiesService.getScriptProperties().setProperty(
    ADMIN_CONFIG.OTP_PREFIX + email,
    JSON.stringify({ otp, expireAt, used: false })
  );
  envoyerEmailOTP(email, otp);

  return reponseJSON({ status: 'otp_sent', message: `Code OTP envoyé à ${email}. Valide 10 minutes.` });
}

function adminVerifyOtp(data) {
  const email    = (data.email || '').trim().toLowerCase();
  const otpSaisi = String(data.otp || '').trim();
  const cle      = ADMIN_CONFIG.OTP_PREFIX + email;
  const stockeRaw= PropertiesService.getScriptProperties().getProperty(cle);

  if (!stockeRaw) return reponseJSON({ status: 'error', message: 'OTP expiré ou inexistant.' });

  let stocke;
  try { stocke = JSON.parse(stockeRaw); } catch(e) {
    return reponseJSON({ status: 'error', message: 'Erreur OTP. Recommencez.' });
  }

  if (stocke.used) return reponseJSON({ status: 'error', message: 'OTP déjà utilisé.' });
  if (Date.now() > stocke.expireAt) {
    PropertiesService.getScriptProperties().deleteProperty(cle);
    return reponseJSON({ status: 'error', message: 'OTP expiré. Reconnectez-vous.' });
  }
  if (otpSaisi !== stocke.otp) return reponseJSON({ status: 'error', message: 'Code incorrect.' });

  stocke.used = true;
  PropertiesService.getScriptProperties().setProperty(cle, JSON.stringify(stocke));

  const token = genererToken(email);
  return reponseJSON({ status: 'success', token, email });
}

function _getMotDePasseActuel() {
  const stocke = PropertiesService.getScriptProperties().getProperty('ADMIN_MOT_DE_PASSE');
  return stocke || ADMIN_CONFIG.MOT_DE_PASSE;
}

function adminForgotPasswordRequest(data) {
  const email = (data.email || '').trim().toLowerCase();

  if (!ADMIN_CONFIG.EMAILS_AUTORISES.map(e => e.toLowerCase()).includes(email)) {
    return reponseJSON({ status: 'otp_sent', message: `Si cet email est autorisé, un code a été envoyé.` });
  }

  const otp      = genererOTP();
  const expireAt = Date.now() + ADMIN_CONFIG.OTP_EXPIRY_SEC * 1000;

  PropertiesService.getScriptProperties().setProperty(
    'RESET_OTP_' + email,
    JSON.stringify({ otp, expireAt, used: false })
  );
  envoyerEmailResetOTP(email, otp);

  return reponseJSON({ status: 'otp_sent', message: `Code envoyé à ${email}. Valide 10 minutes.` });
}

function adminForgotPasswordReset(data) {
  const email        = (data.email || '').trim().toLowerCase();
  const otpSaisi      = String(data.otp || '').trim();
  const nouveauMdp    = data.nouveauMotDePasse || '';
  const cle           = 'RESET_OTP_' + email;
  const stockeRaw     = PropertiesService.getScriptProperties().getProperty(cle);

  if (nouveauMdp.length < 8) {
    return reponseJSON({ status: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  if (!stockeRaw) return reponseJSON({ status: 'error', message: 'Code expiré ou inexistant. Recommencez.' });

  let stocke;
  try { stocke = JSON.parse(stockeRaw); } catch (e) {
    return reponseJSON({ status: 'error', message: 'Erreur de code. Recommencez.' });
  }

  if (stocke.used) return reponseJSON({ status: 'error', message: 'Ce code a déjà été utilisé.' });
  if (Date.now() > stocke.expireAt) {
    PropertiesService.getScriptProperties().deleteProperty(cle);
    return reponseJSON({ status: 'error', message: 'Code expiré. Recommencez.' });
  }
  if (otpSaisi !== stocke.otp) return reponseJSON({ status: 'error', message: 'Code incorrect.' });

  PropertiesService.getScriptProperties().setProperty('ADMIN_MOT_DE_PASSE', nouveauMdp);

  stocke.used = true;
  PropertiesService.getScriptProperties().setProperty(cle, JSON.stringify(stocke));

  return reponseJSON({ status: 'success', message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
}

function adminVerifyGoogle(data) {
  const googleToken = data.googleToken || '';
  try {
    const resp = UrlFetchApp.fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleToken)}`,
      { muteHttpExceptions: true }
    );
    const info = JSON.parse(resp.getContentText());

    if (resp.getResponseCode() !== 200 || info.error) {
      return reponseJSON({ status: 'error', message: 'Token Google invalide.' });
    }
    if (info.aud !== ADMIN_CONFIG.GOOGLE_CLIENT_ID) {
      return reponseJSON({ status: 'error', message: 'Client ID non autorisé.' });
    }

    const email = (info.email || '').toLowerCase();
    if (!ADMIN_CONFIG.EMAILS_AUTORISES.map(e => e.toLowerCase()).includes(email)) {
      return reponseJSON({ status: 'error', message: 'Email non autorisé.' });
    }

    const token = genererToken(email);
    return reponseJSON({ status: 'success', token, email, nom: info.name, photo: info.picture });

  } catch (err) {
    console.error('[adminVerifyGoogle]', err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur vérification Google.' });
  }
}

function adminLogout(data) {
  return reponseJSON({ status: 'success', message: 'Déconnecté.' });
}

function adminGetStats(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  const feuilleRens   = ss.getSheetByName('Renseignements');

  const stats = {
    total: 0, enAttente: 0, confirmes: 0, annules: 0,
    paiementRecu: 0, paiementVerifie: 0, paiementAttente: 0,
    parFormation: {}, renseignements: 0, rensNouveaux: 0,
    chiffreAffaire: 0
  };

  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;
      stats.total++;
      const statutDossier  = row[9]  || '';
      const statutPaiement = row[21] || '';
      const formations     = String(row[6] || '').split(' | ');
      const premierVirement= Number(row[20]) || 0;

      if (statutDossier === 'Confirmé')       stats.confirmes++;
      else if (statutDossier === 'Annulé')    stats.annules++;
      else                                    stats.enAttente++;

      if (statutPaiement === 'Reçu')          stats.paiementRecu++;
      else if (statutPaiement === 'Vérifié') { stats.paiementVerifie++; stats.chiffreAffaire += premierVirement; }
      else                                    stats.paiementAttente++;

      formations.forEach(f => {
        const key = f.trim();
        if (key) stats.parFormation[key] = (stats.parFormation[key] || 0) + 1;
      });
    }
  }

  if (feuilleRens) {
    const donnees = feuilleRens.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      if (!donnees[i][0]) continue;
      stats.renseignements++;
      if (donnees[i][8] === 'Nouveau') stats.rensNouveaux++;
    }
  }

  return reponseJSON({ status: 'success', stats });
}

function adminGetDossiers(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees   = feuille.getDataRange().getValues();
  const page      = Number(data.page    || 1);
  const perPage   = Number(data.perPage || 20);
  const filtre    = data.filtre    || '';
  const recherche = (data.recherche || '').toLowerCase();
  let dossiers    = [];

  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;
    const dossier = mapperLigneDossier(row, i + 1);

    if (filtre === 'confirme'         && dossier.statutDossier  !== 'Confirmé')   continue;
    if (filtre === 'annule'           && dossier.statutDossier  !== 'Annulé')     continue;
    if (filtre === 'attente'          && dossier.statutDossier  !== 'En attente') continue;
    if (filtre === 'paiement_recu'    && dossier.statutPaiement !== 'Reçu')       continue;
    if (filtre === 'paiement_verifie' && dossier.statutPaiement !== 'Vérifié')    continue;
    if (filtre === 'paiement_attente' && dossier.statutPaiement !== 'En attente') continue;

    if (recherche) {
      const haystack = `${dossier.id} ${dossier.prenom} ${dossier.nom} ${dossier.telephone} ${dossier.email}`.toLowerCase();
      if (!haystack.includes(recherche)) continue;
    }
    dossiers.push(dossier);
  }

  dossiers.sort((a, b) => b.ligneIndex - a.ligneIndex);
  const total = dossiers.length;
  const debut = (page - 1) * perPage;
  const page_ = dossiers.slice(debut, debut + perPage);

  return reponseJSON({ status: 'success', dossiers: page_, total, page, perPage, pages: Math.ceil(total / perPage) });
}

function adminGetRenseignements(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Renseignements');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  const rens    = [];

  for (let i = 1; i < donnees.length; i++) {
    const row = donnees[i];
    if (!row[0]) continue;
    rens.push({
      ligneIndex: i + 1,
      id:         row[0],
      date:       row[1],
      prenom:     row[2],
      nom:        row[3],
      telephone:  String(row[4] || ''),
      email:      row[5],
      formations: row[6],
      question:   row[7],
      statut:     row[8]
    });
  }

  rens.sort((a, b) => b.ligneIndex - a.ligneIndex);
  return reponseJSON({ status: 'success', renseignements: rens });
}

function adminGetDossier(data, email) {
  const id = data.id || '';
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (donnees[i][0] === id) {
      return reponseJSON({ status: 'success', dossier: mapperLigneDossier(donnees[i], i + 1) });
    }
  }
  return reponseJSON({ status: 'error', message: `Dossier ${id} introuvable.` });
}

function adminUpdateStatut(data, email) {
  const { id, statut } = data;
  const valeursValides  = ['En attente', 'Confirmé', 'Annulé'];

  if (!id || !valeursValides.includes(statut)) {
    return reponseJSON({ status: 'error', message: 'ID ou statut invalide.' });
  }

  const res = mettreAJourColonnePrecise('Toutes les inscriptions', id, 'Statut dossier', statut);
  if (!res) return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });

  try {
    const ss      = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
    const donnees = ss.getSheetByName('Toutes les inscriptions').getDataRange().getValues();
    const row     = donnees.find(r => r[0] === id);
    if (row) {
      const formations = String(row[22]).split(' | ');
      const nomFeuille = formations.length === 1 ? formations[0] : 'Multi-formations';
      mettreAJourColonnePrecise(nomFeuille, id, 'Statut dossier', statut);
    }
  } catch(e) { console.error('[updateStatut propagation]', e); }

  console.log(`[Admin:${email}] Statut ${id} → ${statut}`);
  return reponseJSON({ status: 'success', message: `Statut mis à jour : ${statut}` });
}

// Champs renseignés a posteriori par l'admin, une fois la formation
// terminée — sans équivalent dans le formulaire public (un nouvel
// inscrit ne peut pas connaître son niveau atteint avant d'avoir suivi
// la formation). Alimente aussi l'attestation via carte.gs.
// Permet à l'admin de générer/tester une attestation directement depuis
// le panneau, quel que soit l'état du verrou TELECHARGEMENT_BLOQUE — ce
// verrou ne concerne que l'espace apprenant public (voir getCarte dans
// carte.gs). Utile pour valider le rendu pendant que le site est encore
// en construction, sans devoir l'ouvrir au public.
// Débloque manuellement 6 téléchargements (1 payant + 5 gratuits) —
// utilisé quand l'apprenant a payé par transfert Mobile Money direct
// (MTN/Moov) plutôt que via le widget FedaPay, avec preuve envoyée par
// WhatsApp et vérifiée à l'œil par l'admin. Réservé à l'offre courte.
function adminDebloquerTelechargement(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const trouve = _trouverLigneInscription(id);
  if (!trouve) return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });

  const filiere = String(trouve.row[22] || '');
  if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) {
    return reponseJSON({ status: 'error', message: "Ce déblocage ne concerne que l'offre Initiation rapide (1 mois)." });
  }

  trouve.feuille.getRange(trouve.ligneIndex, 47).setValue(CONFIG.TELECHARGEMENT.TELECHARGEMENTS_PAR_PALIER);

  console.log(`[Admin:${email}] Déblocage manuel des téléchargements pour ${id} (paiement Mobile Money direct)`);
  return reponseJSON({ status: 'success', message: '6 téléchargements débloqués.' });
}

function adminApercuAttestation(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  const row     = donnees.find(r => String(r[0]).trim() === id);
  if (!row) return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });

  const apprenant = _mapperApprenantInscription(row);
  const token     = _genererTokenCarte(apprenant);

  console.log(`[Admin:${email}] Aperçu attestation généré pour ${id}`);
  return reponseJSON({ status: 'success', apprenant, token });
}

function adminUpdateSuivi(data, email) {
  const { id, niveauAtteint, dateEntree, dateFin } = data;
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (!feuilleMaitre) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuilleMaitre.getDataRange().getValues();
  const row     = donnees.find(r => r[0] === id);
  if (!row) return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });

  const formations  = String(row[22] || '').split(' | ').map(f => f.trim()).filter(Boolean);
  const nomFeuille  = formations.length === 1 ? formations[0] : 'Multi-formations';

  const champs = [
    ['Date entrée',    dateEntree],
    ['Date fin',       dateFin],
    ['Niveau atteint', niveauAtteint],
  ];
  champs.forEach(([colonne, valeur]) => {
    if (valeur === undefined) return;
    mettreAJourColonnePrecise('Toutes les inscriptions', id, colonne, nettoyer(valeur));
    mettreAJourColonnePrecise(nomFeuille, id, colonne, nettoyer(valeur));
  });

  console.log(`[Admin:${email}] Suivi mis à jour pour ${id}`);
  return reponseJSON({ status: 'success', message: 'Suivi mis à jour.' });
}

function adminUpdatePaiement(data, email) {
  const { id, statut } = data;
  const valeursValides  = ['En attente', 'Reçu', 'Vérifié'];

  if (!id || !valeursValides.includes(statut)) {
    return reponseJSON({ status: 'error', message: 'ID ou statut paiement invalide.' });
  }

  const res = mettreAJourColonnePrecise('Toutes les inscriptions', id, 'Statut paiement', statut);
  if (!res) return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });

  try {
    const ss      = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
    const donnees = ss.getSheetByName('Toutes les inscriptions').getDataRange().getValues();
    const row     = donnees.find(r => r[0] === id);
    if (row) {
      const formations = String(row[22]).split(' | ');
      const nomFeuille = formations.length === 1 ? formations[0] : 'Multi-formations';
      mettreAJourColonnePrecise(nomFeuille, id, 'Statut paiement', statut);
    }
  } catch(e) {}

  if (statut === 'Vérifié') {
    try {
      const ss      = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
      const donnees = ss.getSheetByName('Toutes les inscriptions').getDataRange().getValues();
      const row     = donnees.find(r => r[0] === id);
      if (row && row[10]) {
        const dossier = mapperLigneDossier(row, 0);
        envoyerEmailConfirmationPaiement(dossier);
      }
    } catch(e) { console.error('[updatePaiement email]', e); }
  }

  console.log(`[Admin:${email}] Paiement ${id} → ${statut}`);
  return reponseJSON({ status: 'success', message: `Paiement mis à jour : ${statut}` });
}

function adminSendRelance(data, email) {
  const id = data.id || '';
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const donnees = ss.getSheetByName('Toutes les inscriptions').getDataRange().getValues();
  const row     = donnees.find(r => r[0] === id);

  if (!row)    return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });
  if (!row[10]) return reponseJSON({ status: 'error', message: 'Pas d\'email pour cet apprenant.' });

  const dossier  = mapperLigneDossier(row, 0);
  const montants = calculerMontantsTotal(dossier.formations);

  GmailApp.sendEmail(
    dossier.email,
    `Relance — votre dossier LQD Service (Réf. ${dossier.id})`,
    `Bonjour ${dossier.prenom}, relance manuelle pour votre dossier ${dossier.id}.`,
    { htmlBody: construireEmailApprenant(dossier, montants, true), name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL }
  );

  console.log(`[Admin:${email}] Relance envoyée → ${dossier.email} (${id})`);
  return reponseJSON({ status: 'success', message: `Relance envoyée à ${dossier.email}` });
}

function adminDeleteDossier(data, email) {
  const id = data.id || '';
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const nomsFeuilles = ['Toutes les inscriptions'].concat(CONFIG.FORMATIONS_VALIDES).concat(['Multi-formations']);
  let supprime = false;

  nomsFeuilles.forEach(nomFeuille => {
    const feuille = ss.getSheetByName(nomFeuille);
    if (!feuille) return;
    const donnees = feuille.getDataRange().getValues();
    for (let i = donnees.length - 1; i >= 1; i--) {
      if (donnees[i][0] === id) {
        if (!supprime && donnees[i][35]) {
          try {
            const idDrive = String(donnees[i][35]).match(/[-\w]{25,}/);
            if (idDrive) DriveApp.getFolderById(idDrive[0]).setTrashed(true);
          } catch(e) { console.error('[delete Drive]', e); }
        }
        feuille.deleteRow(i + 1);
        supprime = true;
      }
    }
  });

  if (!supprime) return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });
  console.log(`[Admin:${email}] Dossier supprimé : ${id}`);
  return reponseJSON({ status: 'success', message: `Dossier ${id} supprimé.` });
}

function adminExportCSV(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const donnees = feuille.getDataRange().getValues();
  const lignes  = donnees.map(row =>
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(';')
  );

  const csv = '\uFEFF' + lignes.join('\r\n');
  console.log(`[Admin:${email}] Export CSV — ${donnees.length - 1} lignes`);
  return reponseJSON({ status: 'success', csv, total: donnees.length - 1 });
}

function envoyerEmailOTP(email, otp) {
  const htmlBody = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
  style="max-width:480px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#04342C;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;margin:0 auto 10px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">LQD Service — Admin</h1>
  </td></tr>
  <tr><td style="padding:36px;">
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">Votre code de connexion :</p>
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#04342C;font-family:monospace;">${otp}</span>
    </div>
    <p style="margin:0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
      Code valide <strong>10 minutes</strong>. Usage unique.<br/>
      Ne partagez jamais ce code.
    </p>
  </td></tr>
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} Les Qualités de Dieu Service SARL</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  GmailApp.sendEmail(email, 'Code de connexion — LQD Admin', `Votre code OTP : ${otp}`, {
    htmlBody, name: CONFIG.EXPEDITEUR_NOM
  });
}

function envoyerEmailResetOTP(email, otp) {
  const htmlBody = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
  style="max-width:480px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#A6402F;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;margin:0 auto 10px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">LQD Service — Admin</h1>
  </td></tr>
  <tr><td style="padding:36px;">
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
      Une demande de <strong>réinitialisation de mot de passe</strong> a été effectuée pour ce compte.
      Voici votre code de confirmation :
    </p>
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#A6402F;font-family:monospace;">${otp}</span>
    </div>
    <p style="margin:0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
      Code valide <strong>10 minutes</strong>. Usage unique.<br/>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet email —
      votre mot de passe actuel reste inchangé.
    </p>
  </td></tr>
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} Les Qualités de Dieu Service SARL</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  GmailApp.sendEmail(email, 'Réinitialisation du mot de passe — LQD Admin', `Votre code de réinitialisation : ${otp}`, {
    htmlBody, name: CONFIG.EXPEDITEUR_NOM
  });
}

function envoyerEmailConfirmationPaiement(dossier) {
  const montants = calculerMontantsTotal(dossier.formations || []);
  GmailApp.sendEmail(
    dossier.email,
    `Paiement confirmé — ${dossier.formationsLabel} — LQD Service`,
    `Bonjour ${dossier.prenom}, votre paiement pour le dossier ${dossier.id} a été vérifié.`,
    {
      htmlBody: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;background:#FFF;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#04342C;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;margin:0 auto 10px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">Les Qualités de Dieu Service</h1>
  </td></tr>
  <tr><td style="background:#1D9E75;padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">PAIEMENT CONFIRMÉ</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="font-size:15px;color:#444;line-height:1.75;margin:0 0 20px;">
      Bonjour <strong>${dossier.prenom}</strong>,<br/><br/>
      Votre paiement pour le dossier <strong>${dossier.id}</strong> a été vérifié et validé.
      Votre inscription à <strong>${dossier.formationsLabel}</strong> est confirmée. Bienvenue !
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;">
      ${ligneInfoEmail('Dossier', dossier.id)}
      ${ligneInfoEmail('Formation(s)', dossier.formationsLabel)}
      ${ligneInfoEmailAccent('Statut', 'Inscrit — Paiement vérifié')}
    </table>
  </td></tr>
  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`,
      name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL
    }
  );
}

function genererToken(email) {
  const expireAt   = Math.floor(Date.now() / 1000) + ADMIN_CONFIG.TOKEN_EXPIRY_SEC;
  const payload    = JSON.stringify({ email, expireAt });
  const payloadB64 = Utilities.base64EncodeWebSafe(payload);
  const signature  = signerHMAC(payloadB64);
  return `${payloadB64}.${signature}`;
}

function verifierToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signatureRecue] = parts;
    if (signerHMAC(payloadB64) !== signatureRecue) return null;
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
    if (Math.floor(Date.now() / 1000) > payload.expireAt) return null;
    return payload;
  } catch(e) { return null; }
}

function signerHMAC(data) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(data, ADMIN_CONFIG.TOKEN_SECRET)
  );
}

function genererOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mapperLigneDossier(row, ligneIndex) {
  const formations = String(row[22] || '').split(' | ').map(f => f.trim()).filter(Boolean);
  const montants   = calculerMontantsTotal(formations);
  return {
    ligneIndex,
    id:               row[0],
    date:             row[1],
    prenom:           row[2],
    nom:              row[3],
    sexe:             row[4],
    dateNaissance:    row[5],
    lieuNaissance:    row[6],
    nationalite:      row[7],
    adresse:          row[8],
    telephone:        String(row[9]  || ''),
    email:            row[10],
    prenomMere:       row[11],
    nomMere:          row[12],
    telephoneMere:    String(row[13] || ''),
    professionMere:   row[14],
    prenomPere:       row[15],
    nomPere:          row[16],
    telephonePere:    String(row[17] || ''),
    professionPere:   row[18],
    prenomTuteur:     row[19],
    nomTuteur:        row[20],
    telephoneTuteur:  String(row[21] || ''),
    formationsLabel:  row[22],
    formations,
    nbFormations:     row[23],
    dateEntree:       row[24],
    dateFin:          row[25],
    niveauAtteint:    row[26],
    message:          row[27],
    statutDossier:    row[28],
    typePiece:        row[29],
    numeroPiece:      row[30],
    pieceUrl:         row[31],
    photoUrl:         row[32],
    signatureUrl:     row[33],
    preuveUrl:        row[34],
    dossierUrl:       row[35],
    fraisInscription: row[36],
    coutTotal:        row[37],
    tranche1:         row[38],
    tranche2:         row[39],
    tranche3:         row[40],
    premierVirement:  row[41],
    paiementUnique:   row[42],
    statutPaiement:   row[43],
    rappelEnvoye:     row[44],
    source:           row[45],
    telechargementsRestants: row[46],
    montants
  };
}

function mettreAJourColonnePrecise(nomFeuille, id, nomColonne, valeur) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return false;

  const feuille = ss.getSheetByName(nomFeuille);
  if (!feuille) return false;

  const indexCol = ENTETES_INSCRIPTION.indexOf(nomColonne) + 1;
  if (indexCol < 1) return false;

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (donnees[i][0] === id) {
      feuille.getRange(i + 1, indexCol).setValue(valeur);
      return true;
    }
  }
  return false;
}

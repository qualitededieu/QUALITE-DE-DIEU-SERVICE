/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Admin Backend
   Fichier  : admin.gs
   Version  : 1.2.0
   Auteur   : LQD Web Studio / PHANOS KOSMOS
   ===================================================================== */


// =====================================================================
// CONFIG ADMIN
// =====================================================================
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


// =====================================================================
// CONFIG CARTE D'APPRENTISSAGE
// =====================================================================
const CARTE_CONFIG = {
  SECRET:    'lqd-carte-secret-2026-Xm7kP9nQ2rW4vZ6j',
  VERIF_URL: 'https://qualitededieu.vercel.app/verifier.html',
  VERSION:   '1.0'
};


// =====================================================================
// ROUTAGE ADMIN
// =====================================================================
function routerAdmin(data, action) {
  try {
    switch (action) {

      // AUTH
      case 'admin_login':               return adminLogin(data);
      case 'admin_verify_otp':          return adminVerifyOtp(data);
      case 'admin_verify_google':       return adminVerifyGoogle(data);
      case 'admin_logout':              return adminLogout(data);

      // LECTURE
      case 'admin_get_stats':           return requireAuth(data, adminGetStats);
      case 'admin_get_dossiers':        return requireAuth(data, adminGetDossiers);
      case 'admin_get_rens':            return requireAuth(data, adminGetRenseignements);
      case 'admin_get_dossier':         return requireAuth(data, adminGetDossier);

      // WRITE
      case 'admin_update_statut':       return requireAuth(data, adminUpdateStatut);
      case 'admin_update_paiement':     return requireAuth(data, adminUpdatePaiement);
      case 'admin_send_relance':        return requireAuth(data, adminSendRelance);
      case 'admin_delete_dossier':      return requireAuth(data, adminDeleteDossier);
      case 'admin_export_csv':          return requireAuth(data, adminExportCSV);
      case 'admin_get_regs':            return requireAuth(data, adminGetRegularisations);
      case 'admin_get_reg':             return requireAuth(data, adminGetRegularisation);
      case 'admin_update_reg_statut':   return requireAuth(data, adminUpdateRegStatut);
      case 'admin_delete_reg':          return requireAuth(data, adminDeleteRegularisation);

      // CARTE D'APPRENTISSAGE (publique + admin)
      case 'carte_get_data':            return getCarte(data);
      case 'carte_verifier':            return verifierCarte(data);
      case 'admin_envoyer_carte':       return requireAuth(data, envoyerCarteAdmin);

      default:
        return reponseJSON({ status: 'error', message: 'Action admin inconnue.' });
    }
  } catch (err) {
    console.error('[routerAdmin]', err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur interne admin.' });
  }
}


// =====================================================================
// AUTH — Middleware
// =====================================================================
function requireAuth(data, fn) {
  const token = data.token;
  if (!token) return reponseJSON({ status: 'auth_error', message: 'Token manquant.' });
  const payload = verifierToken(token);
  if (!payload) return reponseJSON({ status: 'auth_error', message: 'Token invalide ou expiré.' });
  return fn(data, payload.email);
}


// =====================================================================
// AUTH — Login étape 1
// =====================================================================
function adminLogin(data) {
  const email = (data.email || '').trim().toLowerCase();
  const mdp   = data.password || '';

  if (!ADMIN_CONFIG.EMAILS_AUTORISES.map(e => e.toLowerCase()).includes(email)) {
    return reponseJSON({ status: 'error', message: 'Accès refusé.' });
  }
  if (mdp !== ADMIN_CONFIG.MOT_DE_PASSE) {
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


// =====================================================================
// AUTH — Login étape 2 (OTP)
// =====================================================================
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


// =====================================================================
// AUTH — OAuth Google
// =====================================================================
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


// =====================================================================
// AUTH — Logout
// =====================================================================
function adminLogout(data) {
  return reponseJSON({ status: 'success', message: 'Déconnecté.' });
}


// =====================================================================
// LECTURE — Statistiques dashboard
// =====================================================================
function adminGetStats(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  const feuilleRens   = ss.getSheetByName('Renseignements');

  const stats = {
    total: 0, enAttente: 0, confirmes: 0, annules: 0,
    paiementRecu: 0, paiementVerifie: 0, paiementAttente: 0,
    parFormation: {}, renseignements: 0, rensNouveaux: 0,
    chiffreAffaire: 0, regsEnAttente: 0
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

  // Régularisations en attente
  const feuilleRegs = ss.getSheetByName('Régularisations');
  if (feuilleRegs) {
    const donneesR = feuilleRegs.getDataRange().getValues();
    for (let i = 1; i < donneesR.length; i++) {
      if (!donneesR[i][0]) continue;
      const st = String(donneesR[i][37] || '').trim();
      if (st === 'En attente') stats.regsEnAttente++;
    }
  }

  return reponseJSON({ status: 'success', stats });
}


// =====================================================================
// LECTURE — Liste des dossiers
// =====================================================================
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


// =====================================================================
// LECTURE — Renseignements
// =====================================================================
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


// =====================================================================
// LECTURE — Dossier individuel
// =====================================================================
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


// =====================================================================
// WRITE — Statut dossier
// =====================================================================
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
      const formations = String(row[6]).split(' | ');
      const nomFeuille = formations.length === 1 ? formations[0] : 'Multi-formations';
      mettreAJourColonnePrecise(nomFeuille, id, 'Statut dossier', statut);
    }
  } catch(e) { console.error('[updateStatut propagation]', e); }

  console.log(`[Admin:${email}] Statut ${id} → ${statut}`);
  return reponseJSON({ status: 'success', message: `Statut mis à jour : ${statut}` });
}


// =====================================================================
// WRITE — Statut paiement
// =====================================================================
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
      const formations = String(row[6]).split(' | ');
      const nomFeuille = formations.length === 1 ? formations[0] : 'Multi-formations';
      mettreAJourColonnePrecise(nomFeuille, id, 'Statut paiement', statut);
    }
  } catch(e) {}

  if (statut === 'Vérifié') {
    try {
      const ss      = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
      const donnees = ss.getSheetByName('Toutes les inscriptions').getDataRange().getValues();
      const row     = donnees.find(r => r[0] === id);
      if (row && row[5]) {
        const dossier = mapperLigneDossier(row, 0);
        envoyerEmailConfirmationPaiement(dossier);
      }
    } catch(e) { console.error('[updatePaiement email]', e); }
  }

  console.log(`[Admin:${email}] Paiement ${id} → ${statut}`);
  return reponseJSON({ status: 'success', message: `Paiement mis à jour : ${statut}` });
}


// =====================================================================
// WRITE — Relance email
// =====================================================================
function adminSendRelance(data, email) {
  const id = data.id || '';
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const donnees = ss.getSheetByName('Toutes les inscriptions').getDataRange().getValues();
  const row     = donnees.find(r => r[0] === id);

  if (!row)    return reponseJSON({ status: 'error', message: `Dossier ${id} non trouvé.` });
  if (!row[5]) return reponseJSON({ status: 'error', message: 'Pas d\'email pour cet apprenant.' });

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


// =====================================================================
// WRITE — Supprimer dossier
// =====================================================================
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
        if (!supprime && donnees[i][14]) {
          try {
            const idDrive = String(donnees[i][14]).match(/[-\w]{25,}/);
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


// =====================================================================
// WRITE — Export CSV
// =====================================================================
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


// =====================================================================
// CARTE — Normalisation téléphone
// Sheets supprime le + et les espaces sur les numéros stockés comme nombres
// Cette fonction normalise avant comparaison pour éviter les faux négatifs
// =====================================================================
function _normaliserTel(tel) {
  return String(tel || '').replace(/[\s+\-().]/g, '');
}


// =====================================================================
// CARTE — Récupérer données carte (route publique)
// Vérification : ID dossier + téléphone (normalisé)
// =====================================================================
function getCarte(data) {
  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  // Priorité : Régularisations (données complètes avec période)
  const feuilleRegs = ss.getSheetByName('Régularisations');
  if (feuilleRegs) {
    const donneesR = feuilleRegs.getDataRange().getValues();
    for (let i = 1; i < donneesR.length; i++) {
      const row = donneesR[i];
      if (!row[0]) continue;
      if (String(row[0]).trim() === id && _normaliserTel(row[8]) === _normaliserTel(telephone)) {
        const statut = String(row[37] || '').trim();
        if (statut !== 'Validé') {
          return reponseJSON({ status: 'error', message: 'Votre dossier n\'est pas encore validé.' });
        }
        const apprenant = _mapperApprenantReg(row);
        return reponseJSON({ status: 'success', apprenant, token: _genererTokenCarte(apprenant) });
      }
    }
  }

  // Fallback : Toutes les inscriptions
  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;
      if (String(row[0]).trim() === id && _normaliserTel(row[4]) === _normaliserTel(telephone)) {
        const statut = String(row[9] || '').trim();
        if (statut !== 'Confirmé') {
          return reponseJSON({ status: 'error', message: 'Votre dossier n\'est pas encore confirmé.' });
        }
        const apprenant = _mapperApprenantInscription(row);
        return reponseJSON({ status: 'success', apprenant, token: _genererTokenCarte(apprenant) });
      }
    }
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Vérifiez votre numéro et téléphone.' });
}


// =====================================================================
// CARTE — Vérifier token (route publique — verifier.html)
// =====================================================================
function verifierCarte(data) {
  const token = String(data.token || '').trim();
  if (!token) return reponseJSON({ status: 'error', message: 'Token manquant.' });

  const payload = _verifierTokenCarte(token);
  if (!payload) {
    return reponseJSON({ status: 'error', message: 'Carte invalide ou falsifiée.' });
  }

  const maintenant = new Date();
  const dateFin    = new Date(payload.dateFin);

  if (!isNaN(dateFin.getTime()) && maintenant > dateFin) {
    return reponseJSON({ status: 'expired', message: 'Cette carte d\'apprentissage est expirée.', apprenant: payload });
  }

  return reponseJSON({ status: 'success', apprenant: payload, valide: true });
}


// =====================================================================
// CARTE — Générer et envoyer par email (route admin)
// =====================================================================
function envoyerCarteAdmin(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  let apprenant = null;

  const feuilleRegs = ss.getSheetByName('Régularisations');
  if (feuilleRegs) {
    const donneesR = feuilleRegs.getDataRange().getValues();
    for (let i = 1; i < donneesR.length; i++) {
      if (String(donneesR[i][0]).trim() === id) {
        apprenant = _mapperApprenantReg(donneesR[i]);
        break;
      }
    }
  }

  if (!apprenant) {
    const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
    if (feuilleMaitre) {
      const donnees = feuilleMaitre.getDataRange().getValues();
      for (let i = 1; i < donnees.length; i++) {
        if (String(donnees[i][0]).trim() === id) {
          apprenant = _mapperApprenantInscription(donnees[i]);
          break;
        }
      }
    }
  }

  if (!apprenant)       return reponseJSON({ status: 'error', message: `Dossier ${id} introuvable.` });
  if (!apprenant.email) return reponseJSON({ status: 'error', message: 'Pas d\'email pour cet apprenant.' });

  const token = _genererTokenCarte(apprenant);
  _envoyerEmailCarte(apprenant, token);

  console.log(`[Admin:${email}] Carte envoyée → ${apprenant.email} (${id})`);
  return reponseJSON({ status: 'success', message: `Carte envoyée à ${apprenant.email}`, apprenant, token });
}


// =====================================================================
// CARTE — Helpers internes
// =====================================================================
function _mapperApprenantReg(row) {
  return {
    id:            String(row[0]  || ''),
    prenom:        String(row[2]  || ''),
    nom:           String(row[3]  || ''),
    sexe:          String(row[4]  || ''),
    dateNaissance: String(row[5]  || ''),
    telephone:     String(row[8]  || ''),
    email:         String(row[9]  || ''),
    filiere:       String(row[21] || ''),
    dateEntree:    String(row[23] || ''),
    dateFin:       String(row[24] || ''),
    photoUrl:      String(row[31] || ''),
    source:        'regularisation'
  };
}

function _mapperApprenantInscription(row) {
  let dateFin = '';
  if (row[1]) {
    const d = new Date(row[1]);
    d.setFullYear(d.getFullYear() + 1);
    dateFin = d.toISOString().split('T')[0];
  }
  return {
    id:            String(row[0]  || ''),
    prenom:        String(row[2]  || ''),
    nom:           String(row[3]  || ''),
    sexe:          '',
    dateNaissance: '',
    telephone:     String(row[4]  || ''),
    email:         String(row[5]  || ''),
    filiere:       String(row[6]  || '').replace(/ \| /g, ', '),
    dateEntree:    row[1] ? new Date(row[1]).toISOString().split('T')[0] : '',
    dateFin,
    photoUrl:      String(row[12] || ''),
    source:        'inscription'
  };
}

function _genererTokenCarte(apprenant) {
  const payload = {
    id:            apprenant.id,
    prenom:        apprenant.prenom,
    nom:           apprenant.nom,
    sexe:          apprenant.sexe,
    dateNaissance: apprenant.dateNaissance,
    telephone:     apprenant.telephone,
    filiere:       apprenant.filiere,
    dateEntree:    apprenant.dateEntree,
    dateFin:       apprenant.dateFin,
    photoUrl:      apprenant.photoUrl,
    emis:          new Date().toISOString(),
    v:             CARTE_CONFIG.VERSION
  };
  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const signature  = _signerCarte(payloadB64);
  return `${payloadB64}.${signature}`;
}

function _verifierTokenCarte(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signatureRecue] = parts;
    if (_signerCarte(payloadB64) !== signatureRecue) return null;
    return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
  } catch(e) {
    console.error('[_verifierTokenCarte]', e.toString());
    return null;
  }
}

function _signerCarte(data) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(data, CARTE_CONFIG.SECRET)
  );
}

function _envoyerEmailCarte(apprenant, token) {
  const lienCarte = `${CARTE_CONFIG.VERIF_URL}?t=${encodeURIComponent(token)}`;
  const annee     = new Date().getFullYear();

  const htmlBody = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
  style="max-width:560px;background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#04342C;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;margin:0 auto 12px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#A7C4BC;">Carte d'apprentissage</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
      Bonjour <strong>${apprenant.prenom} ${apprenant.nom}</strong>,<br/><br/>
      Votre carte d'apprentissage officielle LQD Service est prête.
      Elle atteste de votre inscription en <strong>${apprenant.filiere}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#F9FAFB;">
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;width:40%;">Référence</td>
        <td style="padding:10px 16px;color:#111827;font-family:monospace;">${apprenant.id}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Filière</td>
        <td style="padding:10px 16px;color:#111827;">${apprenant.filiere}</td>
      </tr>
      <tr style="background:#F9FAFB;">
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Début</td>
        <td style="padding:10px 16px;color:#111827;">${apprenant.dateEntree || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Fin de validité</td>
        <td style="padding:10px 16px;color:#E05C2A;font-weight:700;">${apprenant.dateFin || '—'}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${lienCarte}"
        style="display:inline-block;background:#04342C;color:#FFF;padding:14px 32px;
               border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
        Voir et télécharger ma carte
      </a>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.6;">
      Ce lien contient votre carte sécurisée. Ne le partagez qu'avec des tiers de confiance.
    </p>
  </td></tr>
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">
      © ${annee} Les Qualités de Dieu Service SARL — Cotonou, Bénin
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  GmailApp.sendEmail(
    apprenant.email,
    `Votre carte d'apprentissage — LQD Service (${apprenant.id})`,
    `Bonjour ${apprenant.prenom}, votre carte d'apprentissage LQD Service : ${lienCarte}`,
    { htmlBody, name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL }
  );
}


// =====================================================================
// EMAIL — OTP
// =====================================================================
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


// =====================================================================
// EMAIL — Confirmation paiement vérifié
// =====================================================================
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


// =====================================================================
// TOKEN ADMIN — Génération et vérification HMAC
// =====================================================================
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


// =====================================================================
// OTP — Génération 6 chiffres
// =====================================================================
function genererOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}


// =====================================================================
// HELPER — Mapper ligne Sheets → objet dossier
// =====================================================================
function mapperLigneDossier(row, ligneIndex) {
  const formations = String(row[6] || '').split(' | ').map(f => f.trim()).filter(Boolean);
  const montants   = calculerMontantsTotal(formations);
  return {
    ligneIndex,
    id:              row[0],
    date:            row[1],
    prenom:          row[2],
    nom:             row[3],
    telephone:       String(row[4]  || ''),
    email:           row[5],
    formationsLabel: row[6],
    formations,
    nbFormations:    row[7],
    message:         row[8],
    statutDossier:   row[9],
    typePiece:       row[10],
    pieceUrl:        row[11],
    photoUrl:        row[12],
    preuveUrl:       row[13],
    dossierUrl:      row[14],
    fraisInscription:row[15],
    coutTotal:       row[16],
    tranche1:        row[17],
    tranche2:        row[18],
    tranche3:        row[19],
    premierVirement: row[20],
    statutPaiement:  row[21],
    rappelEnvoye:    row[22],
    montants
  };
}


// =====================================================================
// HELPER — Mise à jour colonne par ID + nom colonne
// =====================================================================
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


/* =====================================================================
   INTÉGRATION code.gs — ligne 139, remplacer par :

   if (action.startsWith('admin_') ||
       action === 'carte_get_data'  ||
       action === 'carte_verifier') {
     return routerAdmin(data, action);
   }
   ===================================================================== */

/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Carte d'apprentissage
   Fichier  : carte.gs
   Version  : 1.0.0

   ROUTES (à ajouter dans routerAdmin de admin.gs) :
     case 'carte_get_data':     return getCarte(data);          // public
     case 'carte_verifier':     return verifierCarte(data);     // public
     case 'admin_envoyer_carte':return requireAuth(data, envoyerCarteAdmin); // admin

   SÉCURITÉ :
     - Vérification ID dossier + téléphone (apprenant) ou token admin
     - Token carte signé HMAC-SHA256, non modifiable
     - Expiration liée à dateFin de formation
     - Page de vérification publique via token dans URL
   ===================================================================== */


// =====================================================================
// CONFIG CARTE
// =====================================================================
const CARTE_CONFIG = {
  // Clé HMAC dédiée aux cartes (différente du token admin)
  SECRET:      'lqd-carte-secret-2026-Xm7kP9nQ2rW4vZ6j',
  VERIF_URL:   'https://qualitededieu.vercel.app/verifier.html',
  VERSION:     '1.0'
};


// =====================================================================
// ROUTE PUBLIC — Récupérer les données carte (apprenant)
// Vérification : ID dossier + téléphone
// Cherche dans "Toutes les inscriptions" ET "Régularisations"
// =====================================================================
function getCarte(data) {
  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  // --- Recherche dans "Régularisations" (priorité : données complètes) ---
  const feuilleRegs = ss.getSheetByName('Régularisations');
  if (feuilleRegs) {
    const donneesR = feuilleRegs.getDataRange().getValues();
    for (let i = 1; i < donneesR.length; i++) {
      const row = donneesR[i];
      if (!row[0]) continue;

      const idRow  = String(row[0]).trim();
      const telRow = String(row[8] || '').trim(); // col 8 = téléphone dans Régularisations

      if (idRow === id && telRow === telephone) {
        // Vérifier que le dossier est validé
        const statut = String(row[37] || '').trim();
        if (statut !== 'Validé') {
          return reponseJSON({ status: 'error', message: 'Votre dossier n\'est pas encore validé.' });
        }

        const apprenant = _mapperApprenantReg(row);
        const token     = _genererTokenCarte(apprenant);

        return reponseJSON({ status: 'success', apprenant, token });
      }
    }
  }

  // --- Recherche dans "Toutes les inscriptions" (fallback) ---
  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;

      const idRow  = String(row[0]).trim();
      const telRow = String(row[4] || '').trim(); // col 4 = téléphone dans inscriptions

      if (idRow === id && telRow === telephone) {
        const statut = String(row[9] || '').trim();
        if (statut !== 'Confirmé') {
          return reponseJSON({ status: 'error', message: 'Votre dossier n\'est pas encore confirmé.' });
        }

        const apprenant = _mapperApprenantInscription(row);
        const token     = _genererTokenCarte(apprenant);

        return reponseJSON({ status: 'success', apprenant, token });
      }
    }
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Vérifiez votre numéro et téléphone.' });
}


// =====================================================================
// ROUTE PUBLIC — Vérifier un token de carte (page verifier.html)
// =====================================================================
function verifierCarte(data) {
  const token = String(data.token || '').trim();
  if (!token) return reponseJSON({ status: 'error', message: 'Token manquant.' });

  const payload = _verifierTokenCarte(token);
  if (!payload) {
    return reponseJSON({ status: 'error', message: 'Carte invalide ou falsifiée.' });
  }

  // Vérifier expiration (dateFin)
  const maintenant = new Date();
  const dateFin    = new Date(payload.dateFin);

  if (isNaN(dateFin.getTime())) {
    // Pas de date de fin définie → carte valide indéfiniment
  } else if (maintenant > dateFin) {
    return reponseJSON({
      status:   'expired',
      message:  'Cette carte d\'apprentissage est expirée.',
      apprenant: payload
    });
  }

  return reponseJSON({ status: 'success', apprenant: payload, valide: true });
}


// =====================================================================
// ROUTE ADMIN — Générer et envoyer la carte par email
// =====================================================================
function envoyerCarteAdmin(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  let apprenant = null;

  // Chercher dans Régularisations d'abord
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

  // Fallback : Toutes les inscriptions
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

  if (!apprenant) {
    return reponseJSON({ status: 'error', message: `Dossier ${id} introuvable.` });
  }

  if (!apprenant.email) {
    return reponseJSON({ status: 'error', message: 'Pas d\'email pour cet apprenant.' });
  }

  const token = _genererTokenCarte(apprenant);
  const lienVerif = `${CARTE_CONFIG.VERIF_URL}?t=${encodeURIComponent(token)}`;

  // Envoi email avec lien de téléchargement de la carte
  _envoyerEmailCarte(apprenant, token, lienVerif);

  console.log(`[Admin:${email}] Carte envoyée → ${apprenant.email} (${id})`);
  return reponseJSON({
    status:   'success',
    message:  `Carte envoyée à ${apprenant.email}`,
    apprenant,
    token
  });
}


// =====================================================================
// HELPER — Mapper apprenant depuis Régularisations
// =====================================================================
function _mapperApprenantReg(row) {
  return {
    id:           String(row[0]  || ''),
    prenom:       String(row[2]  || ''),
    nom:          String(row[3]  || ''),
    sexe:         String(row[4]  || ''),
    dateNaissance:String(row[5]  || ''),
    telephone:    String(row[8]  || ''),
    email:        String(row[9]  || ''),
    filiere:      String(row[21] || ''),
    dateEntree:   String(row[23] || ''),
    dateFin:      String(row[24] || ''),
    photoUrl:     String(row[31] || ''),
    source:       'regularisation'
  };
}


// =====================================================================
// HELPER — Mapper apprenant depuis Toutes les inscriptions
// =====================================================================
function _mapperApprenantInscription(row) {
  // Calcul dateFin : dateInscription + 1 an (par défaut si non renseigné)
  let dateFin = '';
  if (row[1]) {
    const d = new Date(row[1]);
    d.setFullYear(d.getFullYear() + 1);
    dateFin = d.toISOString().split('T')[0];
  }

  return {
    id:           String(row[0]  || ''),
    prenom:       String(row[2]  || ''),
    nom:          String(row[3]  || ''),
    sexe:         '',
    dateNaissance:'',
    telephone:    String(row[4]  || ''),
    email:        String(row[5]  || ''),
    filiere:      String(row[6]  || '').replace(/ \| /g, ', '),
    dateEntree:   row[1] ? new Date(row[1]).toISOString().split('T')[0] : '',
    dateFin:      dateFin,
    photoUrl:     String(row[12] || ''),
    source:       'inscription'
  };
}


// =====================================================================
// TOKEN CARTE — Génération HMAC
// =====================================================================
function _genererTokenCarte(apprenant) {
  const payload = {
    id:           apprenant.id,
    prenom:       apprenant.prenom,
    nom:          apprenant.nom,
    sexe:         apprenant.sexe,
    dateNaissance:apprenant.dateNaissance,
    telephone:    apprenant.telephone,
    filiere:      apprenant.filiere,
    dateEntree:   apprenant.dateEntree,
    dateFin:      apprenant.dateFin,
    photoUrl:     apprenant.photoUrl,
    emis:         new Date().toISOString(),
    v:            CARTE_CONFIG.VERSION
  };

  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const signature  = _signerCarte(payloadB64);

  return `${payloadB64}.${signature}`;
}


// =====================================================================
// TOKEN CARTE — Vérification HMAC
// =====================================================================
function _verifierTokenCarte(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signatureRecue] = parts;
    const signatureAttendue = _signerCarte(payloadB64);

    if (signatureAttendue !== signatureRecue) return null;

    return JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString()
    );
  } catch(e) {
    console.error('[_verifierTokenCarte]', e.toString());
    return null;
  }
}

function _signerCarte(data) {
  const sig = Utilities.computeHmacSha256Signature(data, CARTE_CONFIG.SECRET);
  return Utilities.base64EncodeWebSafe(sig);
}


// =====================================================================
// EMAIL — Envoi carte à l'apprenant
// =====================================================================
function _envoyerEmailCarte(apprenant, token, lienVerif) {
  const lienCarte = `${CONFIG.SITE_URL}/verifier.html?t=${encodeURIComponent(token)}`;
  const annee     = new Date().getFullYear();

  const htmlBody = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
  style="max-width:560px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- En-tête -->
  <tr><td style="background:#04342C;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60"
      style="border-radius:8px;margin:0 auto 12px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">
      Les Qualités de Dieu Service
    </h1>
    <p style="margin:6px 0 0;font-size:13px;color:#A7C4BC;">Carte d'apprentissage</p>
  </td></tr>

  <!-- Corps -->
  <tr><td style="padding:32px 36px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
      Bonjour <strong>${apprenant.prenom} ${apprenant.nom}</strong>,<br/><br/>
      Votre carte d'apprentissage officielle LQD Service est prête.
      Elle atteste de votre inscription en <strong>${apprenant.filiere}</strong>.
    </p>

    <!-- Infos carte -->
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

    <!-- Bouton générer la carte -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${lienCarte}"
        style="display:inline-block;background:#04342C;color:#FFF;padding:14px 32px;
               border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
        Voir et télécharger ma carte
      </a>
    </div>

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.6;">
      Ce lien contient votre carte sécurisée. Ne le partagez qu'avec des tiers de confiance.<br/>
      La carte peut être scannée pour vérifier son authenticité.
    </p>
  </td></tr>

  <!-- Pied -->
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">
      © ${annee} Les Qualités de Dieu Service SARL — Cotonou, Bénin
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  GmailApp.sendEmail(
    apprenant.email,
    `Votre carte d'apprentissage — LQD Service (${apprenant.id})`,
    `Bonjour ${apprenant.prenom}, votre carte d'apprentissage LQD Service est disponible : ${lienCarte}`,
    {
      htmlBody,
      name:    CONFIG.EXPEDITEUR_NOM,
      replyTo: CONFIG.ADMIN_EMAIL
    }
  );
}


/* =====================================================================
   INTÉGRATION — À ajouter dans routerAdmin() de admin.gs :

   case 'carte_get_data':      return getCarte(data);
   case 'carte_verifier':      return verifierCarte(data);
   case 'admin_envoyer_carte': return requireAuth(data, envoyerCarteAdmin);

   Et dans doPost de code.gs, AVANT le switch admin_ :
   if (action === 'carte_get_data' || action === 'carte_verifier') {
     return routerAdmin(data, action);
   }
   ===================================================================== */

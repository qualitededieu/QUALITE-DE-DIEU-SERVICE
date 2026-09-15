const CARTE_CONFIG = {
  SECRET:      'lqd-carte-secret-2026-Xm7kP9nQ2rW4vZ6j',
  VERIF_URL:   'https://www.qualitededieuservice.com/verifier.html',
  VERSION:     '1.0'
};

function _normaliserTel(tel) {
  let s = String(tel || '').replace(/\D/g, '');
  if (s.indexOf('00229') === 0) s = s.slice(5);
  else if (s.indexOf('229') === 0 && s.length > 10) s = s.slice(3);
  return s;
}

function _formesTelephone(tel) {
  const base   = _normaliserTel(tel);
  const formes = [base];
  if (base.length === 8) formes.push('01' + base);
  if (base.length === 10 && base.indexOf('01') === 0) formes.push(base.slice(2));
  return formes;
}

function _telephonesEquivalents(telA, telB) {
  const formesA = _formesTelephone(telA);
  const formesB = _formesTelephone(telB);
  return formesA.some(f => formesB.indexOf(f) !== -1);
}

function _telephoneSembleIncomplet(tel) {
  return _normaliserTel(tel).length === 8;
}

function getCarte(data) {
  // Interrupteur temporaire — le site étant en construction, on peut
  // couper l'accès public à l'espace apprenant sans toucher au code.
  // Activer : Propriétés du script → TELECHARGEMENT_BLOQUE = true
  // (Le bouton "Générer" côté admin n'est PAS concerné par ce verrou —
  // voir adminApercuAttestation dans admin.gs.)
  const bloque = PropertiesService.getScriptProperties().getProperty('TELECHARGEMENT_BLOQUE') === 'true';
  if (bloque) {
    return reponseJSON({
      status: 'error',
      message: "L'espace apprenant est temporairement indisponible — le site est en cours de finalisation. Merci de réessayer bientôt."
    });
  }

  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  let idTrouveTelIncorrect = false;

  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;

      const idRow  = String(row[0]).trim();
      if (idRow !== id) continue;

      const telRow = String(row[9] || '').trim();
      if (!_telephonesEquivalents(telRow, telephone)) { idTrouveTelIncorrect = true; continue; }

      const statut = String(row[28] || '').trim();
      if (statut !== 'Confirmé' && statut !== 'Migré' && statut !== 'Terminé') continue;

      const apprenant = _mapperApprenantInscription(row);
      const token     = _genererTokenCarte(apprenant);

      return reponseJSON({ status: 'success', apprenant, token });
    }
  }

  if (idTrouveTelIncorrect && _telephoneSembleIncomplet(telephone)) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas. Au Bénin, les numéros commencent maintenant par 01 — vérifiez que votre numéro est bien précédé de 01 (ex : 01 97 95 12 30).' });
  }
  if (idTrouveTelIncorrect) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas.' });
  }

  if (_telephoneSembleIncomplet(telephone)) {
    return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Au Bénin, les numéros commencent maintenant par 01 — vérifiez que votre numéro est bien précédé de 01 (ex : 01 97 95 12 30).' });
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Vérifiez votre numéro et téléphone.' });
}

function verifierCarte(data) {
  const token = String(data.token || '').trim();
  if (!token) return reponseJSON({ status: 'error', message: 'Token manquant.' });

  const payload = _verifierTokenCarte(token);
  if (!payload) {
    return reponseJSON({ status: 'error', message: 'Carte invalide ou falsifiée.' });
  }

  const maintenant = new Date();
  const dateFin    = new Date(payload.dateFin);

  if (isNaN(dateFin.getTime())) {
  } else if (maintenant > dateFin) {
    return reponseJSON({
      status:   'expired',
      message:  'Cette carte d\'apprentissage est expirée.',
      apprenant: payload
    });
  }

  return reponseJSON({ status: 'success', apprenant: payload, valide: true });
}

function envoyerCarteAdmin(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const apprenant = _trouverApprenantParId(ss, id);
  if (!apprenant) {
    return reponseJSON({ status: 'error', message: `Dossier ${id} introuvable.` });
  }

  if (!apprenant.email) {
    return reponseJSON({ status: 'error', message: 'Pas d\'email pour cet apprenant.' });
  }

  const token = _genererTokenCarte(apprenant);

  _envoyerEmailCarte(apprenant, token);

  console.log(`[Admin:${email}] Carte envoyée → ${apprenant.email} (${id})`);
  return reponseJSON({
    status:   'success',
    message:  `Carte envoyée à ${apprenant.email}`,
    apprenant,
    token
  });
}

function _trouverApprenantParId(ss, id) {
  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      if (String(donnees[i][0]).trim() === id) {
        return _mapperApprenantInscription(donnees[i]);
      }
    }
  }

  return null;
}

function _mapperApprenantInscription(row) {
  // Dates réelles si présentes (nouveau schéma + dossiers migrés depuis
  // Régularisation) ; à défaut, estimation depuis la soumission — la durée
  // de repli dépend de la formation choisie (1 mois pour l'offre courte,
  // 1 an pour les 4 filières longues, comportement historique conservé).
  const filiereLigne = String(row[22] || '');
  const estFormationCourte = filiereLigne.includes('Initiation rapide (1 mois)');

  let dateEntree = String(row[24] || '');
  let dateFin    = String(row[25] || '');

  if (!dateEntree) dateEntree = row[1] ? new Date(row[1]).toISOString().split('T')[0] : '';
  if (!dateFin && row[1]) {
    const d = new Date(row[1]);
    if (estFormationCourte) d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    dateFin = d.toISOString().split('T')[0];
  }

  return {
    id:            String(row[0]  || ''),
    prenom:        String(row[2]  || ''),
    nom:           String(row[3]  || ''),
    sexe:          String(row[4]  || '').trim(),
    dateNaissance: String(row[5]  || ''),
    lieuNaissance: String(row[6]  || ''),
    telephone:     String(row[9]  || ''),
    email:         String(row[10] || ''),
    filiere:       String(row[22] || '').replace(/ \| /g, ', '),
    dateEntree:    dateEntree,
    dateFin:       dateFin,
    niveauAtteint: String(row[26] || ''),
    photoUrl:      _urlImageDriveDirecte(String(row[32] || '')),
    source:        String(row[45] || 'inscription')
  };
}

function _urlImageDriveDirecte(url) {
  if (!url) return '';
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{20,})/,
    /[?&]id=([a-zA-Z0-9_-]{20,})/
  ];
  for (const re of patterns) {
    const m = String(url).match(re);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w800`;
  }
  return url;
}

// ================================================================
// PALIER DE TÉLÉCHARGEMENT PAYANT — uniquement pour l'offre
// "Initiation rapide (1 mois)". 1er téléchargement payant (3000 F),
// puis 5 gratuits, puis paiement à nouveau (cycle de 6).
// ================================================================

// Retrouve la ligne + la feuille d'un apprenant par ID. Renvoyé une
// seule fois ici pour éviter de dupliquer la recherche dans les 3
// fonctions ci-dessous.
function _trouverLigneInscription(id) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return null;

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      return { feuille, ligneIndex: i + 1, row: donnees[i] };
    }
  }
  return null;
}

function verifierAccesTelechargement(data) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const trouve = _trouverLigneInscription(id);
  if (!trouve) return reponseJSON({ status: 'error', message: 'Dossier introuvable.' });

  // L'attestation ne se télécharge qu'après la fin réelle de la formation
  // — pas avant, même si le dossier est déjà marqué "Confirmé" (ce qui
  // n'atteste que l'inscription/le paiement initial, pas l'assiduité).
  const dateFinBrute = String(trouve.row[25] || '').trim();
  if (dateFinBrute) {
    const dateFin = new Date(dateFinBrute);
    if (!isNaN(dateFin.getTime())) {
      const aujourdHui = new Date();
      aujourdHui.setHours(0, 0, 0, 0);
      dateFin.setHours(0, 0, 0, 0);
      if (aujourdHui < dateFin) {
        return reponseJSON({
          status: 'success',
          accesAutorise: false,
          formationEnCours: true,
          dateFin: dateFinBrute
        });
      }
    }
  }

  const filiere = String(trouve.row[22] || '');
  if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) {
    // Filières longues : accès illimité, non concernées par ce palier.
    return reponseJSON({ status: 'success', accesAutorise: true });
  }

  const restants = Number(trouve.row[46]) || 0;
  if (restants > 0) {
    return reponseJSON({ status: 'success', accesAutorise: true, restants });
  }

  return reponseJSON({
    status: 'success',
    accesAutorise: false,
    montant: CONFIG.TELECHARGEMENT.FRAIS
  });
}

// Décrémente le compteur d'un téléchargement — à appeler UNE FOIS,
// juste après avoir effectivement affiché/servi le document à
// l'apprenant. Ne bloque jamais l'affichage en cas d'échec d'écriture
// (mieux vaut un compteur légèrement optimiste qu'un document promis
// mais jamais délivré après un paiement réel).
function enregistrerTelechargement(data) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  try {
    const trouve = _trouverLigneInscription(id);
    if (!trouve) return reponseJSON({ status: 'success' });

    const filiere = String(trouve.row[22] || '');
    if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) {
      return reponseJSON({ status: 'success' }); // Illimité, rien à décrémenter
    }

    const restants = Math.max(0, (Number(trouve.row[46]) || 0) - 1);
    trouve.feuille.getRange(trouve.ligneIndex, 47).setValue(restants);
    return reponseJSON({ status: 'success', restants });
  } catch (err) {
    console.error('[Téléchargement] Erreur décrément :', err);
    return reponseJSON({ status: 'success' });
  }
}

// Appelée par le webhook FedaPay (Vercel) après paiement confirmé —
// authentifiée par secret partagé, pas par session utilisateur.
function confirmerPaiementTelechargement(data) {
  const secretAttendu = PropertiesService.getScriptProperties().getProperty('SECRET_PARTAGE');

  // Distinction volontaire des deux cas d'échec — un secret absent ici
  // (jamais configuré dans Propriétés du script) est une erreur de
  // déploiement à corriger côté GAS, alors qu'un secret présent mais
  // qui ne correspond pas signale plutôt une désynchro avec la valeur
  // GAS_SHARED_SECRET côté Vercel. Sans cette distinction, les deux
  // ressemblent au même "Non autorisé" générique dans les logs, ce qui
  // rend le diagnostic d'un blocage de paiement bien plus long.
  if (!secretAttendu) {
    console.error('[Téléchargement] SECRET_PARTAGE non configuré dans les Propriétés du script (Extensions > Propriétés du projet > Propriétés du script). Toute confirmation de paiement est rejetée tant que ce n\'est pas fait.');
    return reponseJSON({ status: 'error', erreur: 'Non autorisé (secret serveur non configuré).' }, 403);
  }
  if (data.secretPartage !== secretAttendu) {
    console.warn('[Téléchargement] Tentative de confirmation avec un secret partagé qui ne correspond pas à SECRET_PARTAGE — vérifier GAS_SHARED_SECRET côté Vercel.');
    return reponseJSON({ status: 'error', erreur: 'Non autorisé (secret invalide).' }, 403);
  }

  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', erreur: 'ID manquant.' }, 400);

  const trouve = _trouverLigneInscription(id);
  if (!trouve) {
    console.error('[Téléchargement] Confirmation de paiement reçue pour un dossier introuvable :', id, '— référence FedaPay :', data.referenceFedapay || '—');
    return reponseJSON({ status: 'error', erreur: 'Dossier introuvable.' }, 404);
  }

  trouve.feuille.getRange(trouve.ligneIndex, 47).setValue(CONFIG.TELECHARGEMENT.TELECHARGEMENTS_PAR_PALIER);

  console.log('[Téléchargement] Paiement confirmé pour', id, '— référence FedaPay :', data.referenceFedapay || '—');
  return reponseJSON({ status: 'success' });
}

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

function _envoyerEmailCarte(apprenant, token) {
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

    <p style="margin:20px 0 0;font-size:13px;color:#6B7280;text-align:center;line-height:1.7;">
      Votre attestation de fin de formation, votre fiche apprenant et votre badge de
      certification sont aussi disponibles depuis l'espace apprenant du site, avec les
      mêmes identifiants (numéro de dossier + téléphone).
    </p>
  </td></tr>

  <!-- Pied -->
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">
      © ${annee} Les Qualités de Dieu Service SARL — Comé, Bénin
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

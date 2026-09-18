/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Newsletter
   Fichier  : newsletter.gs
   Version  : 1.0.0

   RÈGLES RETENUES (à valider avec le PDG si besoin d'évoluer) :
   - Consentement explicite obligatoire à l'inscription (case à cocher,
     jamais pré-cochée) — pas de collecte d'email sans ce consentement.
   - Simple opt-in (pas de double opt-in par email de confirmation) :
     plus simple à opérer pour un centre de cette taille, mais CHAQUE
     newsletter envoyée contient un lien de désinscription en un clic,
     ce qui est le vrai minimum légal/déontologique à respecter.
   - La désinscription ne nécessite ni mot de passe ni connexion : un
     jeton aléatoire propre à chaque abonné (colonne "Token") suffit à
     identifier la demande sans exposer les emails des autres abonnés.
   - Un email déjà désinscrit qui se réinscrit réactive la même ligne
     (nouveau jeton) plutôt que de dupliquer une entrée.
   - ATTENTION QUOTA : l'envoi passe par GmailApp, donc par le quota
     d'envoi quotidien Gmail du compte lié au script (100/j pour un
     compte Gmail grand public, ~1500/j pour un compte Workspace). Au
     -delà de ce quota en une seule campagne, il faudra soit répartir
     l'envoi sur plusieurs jours, soit passer sur un compte Workspace.
     adminEnvoyerNewsletter() s'arrête proprement dès que le quota est
     épuisé et rapporte precisement qui a été touché ou non.

   ROUTES :
     newsletter_inscrire  (public, routé depuis doPost)
     admin_get_abonnes           : adminGetAbonnes(data, email)
     admin_envoyer_newsletter    : adminEnvoyerNewsletter(data, email)
     admin_get_campagnes_newsletter : adminGetCampagnesNewsletter(data)
   ===================================================================== */

const ENTETES_ABONNE = [
  'ID', 'Date inscription', 'Email', 'Statut',
  'Token', 'Date désinscription', 'Source'
];
const STATUTS_ABONNE_VALIDES = ['Actif', 'Désinscrit'];

const ENTETES_CAMPAGNE_NEWSLETTER = [
  'ID', 'Date envoi', 'Sujet', 'Envoyée par',
  'Abonnés ciblés', 'Envois réussis', 'Échecs'
];

function _genererTokenAbonne() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 24);
}

function _feuilleAbonnes(ss) {
  let feuille = ss.getSheetByName('Abonnés Newsletter');
  if (!feuille) {
    feuille = ss.insertSheet('Abonnés Newsletter');
    feuille.appendRow(ENTETES_ABONNE);
    feuille.setFrozenRows(1);
  }
  return feuille;
}

// =====================================================================
// PUBLIC — Inscription à la newsletter (formulaire pied de page du site)
// =====================================================================
function inscrireAbonneNewsletter(data) {
  const emailBrut  = nettoyer(data.email || '');
  const consentement = data.consentement === true || data.consentement === 'true';

  if (!emailBrut || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBrut)) {
    return reponseJSON({ status: 'error', message: 'Adresse email invalide.' });
  }
  if (!consentement) {
    return reponseJSON({ status: 'error', message: 'Vous devez accepter de recevoir la newsletter pour vous inscrire.' });
  }

  const emailNorm = emailBrut.toLowerCase();
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const feuille = _feuilleAbonnes(ss);
  const rows = feuille.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2] || '').trim().toLowerCase() !== emailNorm) continue;

    if (String(rows[i][3]).trim() === 'Actif') {
      // Pas une erreur technique, mais PAS un succès nouveau non plus —
      // dejaAbonne permet au front d'afficher ce cas en rouge (différent
      // visuellement d'une inscription qui vient d'aboutir), sans pour
      // autant le traiter comme une panne.
      return reponseJSON({ status: 'success', dejaAbonne: true, message: 'Vous êtes déjà abonné à notre newsletter.' });
    }

    // Réactivation d'un ancien désabonné — nouveau jeton par prudence.
    const nouveauToken = _genererTokenAbonne();
    feuille.getRange(i + 1, 4).setValue('Actif');
    feuille.getRange(i + 1, 5).setValue(nouveauToken);
    feuille.getRange(i + 1, 6).setValue('');
    try { _envoyerEmailConfirmationAbonnement(emailNorm, nouveauToken); } catch (e) { console.error('[inscrireAbonneNewsletter] mail', e.toString()); }
    try { _notifierAdminNouvelAbonne(emailNorm, data.source || 'site', true); } catch (e) { console.error('[inscrireAbonneNewsletter] mail admin', e.toString()); }
    return reponseJSON({ status: 'success', message: 'Bienvenue à nouveau ! Votre réinscription est confirmée.' });
  }

  const id    = genererID('ABO');
  const token = _genererTokenAbonne();
  feuille.appendRow([
    id,
    new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    emailNorm, 'Actif', token, '',
    nettoyer(data.source || 'site')
  ]);

  try { _envoyerEmailConfirmationAbonnement(emailNorm, token); } catch (e) { console.error('[inscrireAbonneNewsletter] mail', e.toString()); }
  try { _notifierAdminNouvelAbonne(emailNorm, data.source || 'site', false); } catch (e) { console.error('[inscrireAbonneNewsletter] mail admin', e.toString()); }

  return reponseJSON({ status: 'success', message: 'Merci ! Votre inscription à la newsletter est confirmée.' });
}

// Notifie l'administration à chaque nouvel abonné — pour rester cohérent
// avec toutes les autres entrées du site (renseignement, candidature,
// chat) qui préviennent déjà l'admin de toute nouvelle activité.
function _notifierAdminNouvelAbonne(email, source, estReactivation) {
  const titre = estReactivation ? 'Réabonnement à la newsletter' : 'Nouvel abonné à la newsletter';
  const htmlBody = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:${CONFIG.COULEUR_DARK};padding:20px 28px;">
    <h1 style="margin:0;font-size:15px;color:#FFF;font-weight:700;">${titre}</h1>
  </td></tr>
  <tr><td style="padding:20px 24px;">
    ${ligneInfoEmail('Email', email)}
    ${ligneInfoEmail('Source', source)}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, `[Newsletter] ${titre}`, `${titre} : ${email}`,
    { htmlBody: htmlBody, name: CONFIG.EXPEDITEUR_NOM });
}

// =====================================================================
// PUBLIC — Désinscription en un clic (lien dans chaque email envoyé),
// gérée en GET pour fonctionner comme un simple lien cliquable dans
// un client mail, sans JavaScript ni requête POST.
// =====================================================================
function traiterDesinscriptionNewsletter(params) {
  const email = String(params.email || '').trim().toLowerCase();
  const token = String(params.token || '').trim();

  const pageHtml = function(titre, message, succes) {
    return HtmlService.createHtmlOutput(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${titre} — LQD Service</title></head>
<body style="margin:0;padding:60px 20px;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;text-align:center;">
  <div style="max-width:480px;margin:0 auto;background:#FFF;border-radius:16px;padding:40px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <img src="${CONFIG.LOGO_URL}" width="64" style="border-radius:8px;margin-bottom:20px;"/>
    <h1 style="font-size:18px;color:${succes ? CONFIG.COULEUR_TEAL : '#C0392B'};margin:0 0 12px;">${titre}</h1>
    <p style="font-size:14px;color:#444455;line-height:1.7;margin:0;">${message}</p>
  </div>
</body></html>`).setTitle(titre);
  };

  if (!email || !token) {
    return pageHtml('Lien invalide', 'Ce lien de désinscription est incomplet ou invalide.', false);
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return pageHtml('Erreur', 'Une erreur serveur est survenue. Réessayez plus tard.', false);

  const feuille = _feuilleAbonnes(ss);
  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2] || '').trim().toLowerCase() !== email) continue;
    if (String(rows[i][4] || '').trim() !== token) continue;

    feuille.getRange(i + 1, 4).setValue('Désinscrit');
    feuille.getRange(i + 1, 6).setValue(new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }));
    return pageHtml('Désinscription confirmée', `L'adresse <strong>${email}</strong> ne recevra plus notre newsletter. Vous pouvez vous réinscrire à tout moment depuis notre site.`, true);
  }

  return pageHtml('Lien invalide', 'Nous n\'avons pas trouvé cet abonnement, ou le lien a déjà été utilisé.', false);
}

// =====================================================================
// ADMIN — Liste des abonnés
// =====================================================================
function adminGetAbonnes(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const feuille = _feuilleAbonnes(ss);
  const rows = feuille.getDataRange().getValues();
  const abonnes = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    abonnes.push({
      id: r[0], dateInscription: r[1], email: r[2], statut: r[3] || 'Actif',
      dateDesinscription: r[5] || '', source: r[6] || ''
    });
  }
  abonnes.sort(function(a, b) { return new Date(b.dateInscription) - new Date(a.dateInscription); });

  return reponseJSON({
    status: 'success',
    abonnes: abonnes,
    total: abonnes.length,
    actifs: abonnes.filter(function(a) { return a.statut === 'Actif'; }).length
  });
}

// =====================================================================
// ADMIN — Historique des campagnes envoyées
// =====================================================================
function adminGetCampagnesNewsletter(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const feuille = ss.getSheetByName('Campagnes Newsletter');
  if (!feuille) return reponseJSON({ status: 'success', campagnes: [] });

  const rows = feuille.getDataRange().getValues();
  const campagnes = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    campagnes.push({
      id: r[0], dateEnvoi: r[1], sujet: r[2], envoyeePar: r[3],
      cibles: r[4], reussis: r[5], echecs: r[6]
    });
  }
  campagnes.sort(function(a, b) { return new Date(b.dateEnvoi) - new Date(a.dateEnvoi); });

  return reponseJSON({ status: 'success', campagnes: campagnes });
}

// =====================================================================
// ADMIN — Envoyer une campagne à tous les abonnés actifs
// S'arrête proprement dès que le quota Gmail restant est épuisé —
// rapporte le nombre exact de succès/échecs, jamais une exception qui
// laisserait l'administration sans savoir qui a reçu l'email.
// =====================================================================
function adminEnvoyerNewsletter(data, email) {
  const sujet       = nettoyer(data.sujet || '');
  const contenuHtml = String(data.contenuHtml || '').trim();

  if (!sujet || !contenuHtml) {
    return reponseJSON({ status: 'error', message: 'Sujet et contenu requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const feuille = _feuilleAbonnes(ss);
  const rows = feuille.getDataRange().getValues();
  const actifs = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3]).trim() === 'Actif' && rows[i][2]) {
      actifs.push({ email: String(rows[i][2]).trim(), token: String(rows[i][4] || '').trim() });
    }
  }

  if (!actifs.length) {
    return reponseJSON({ status: 'error', message: 'Aucun abonné actif à contacter.' });
  }

  let reussis = 0, echecs = 0, quotaAtteint = false;

  for (let i = 0; i < actifs.length; i++) {
    if (MailApp.getRemainingDailyQuota() < 1) { quotaAtteint = true; break; }

    const abonne = actifs[i];
    const lienDesinscription = ScriptApp.getService().getUrl() +
      '?action=desinscription&email=' + encodeURIComponent(abonne.email) +
      '&token=' + encodeURIComponent(abonne.token);

    try {
      const htmlBody = construireEmailNewsletter(sujet, contenuHtml, lienDesinscription);
      const texteBrut = contenuHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      GmailApp.sendEmail(abonne.email, sujet, texteBrut, {
        htmlBody: htmlBody,
        name:     CONFIG.EXPEDITEUR_NOM,
        replyTo:  CONFIG.ADMIN_EMAIL
      });
      reussis++;
    } catch (errEnvoi) {
      console.error('[adminEnvoyerNewsletter]', abonne.email, errEnvoi.toString());
      echecs++;
    }
  }

  try {
    let feuilleCampagnes = ss.getSheetByName('Campagnes Newsletter');
    if (!feuilleCampagnes) {
      feuilleCampagnes = ss.insertSheet('Campagnes Newsletter');
      feuilleCampagnes.appendRow(ENTETES_CAMPAGNE_NEWSLETTER);
      feuilleCampagnes.setFrozenRows(1);
    }
    feuilleCampagnes.appendRow([
      genererID('CAMP'),
      new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
      sujet, email, actifs.length, reussis, echecs
    ]);
  } catch (errJournal) {
    console.error('[adminEnvoyerNewsletter] journal', errJournal.toString());
  }

  const restants = actifs.length - reussis - echecs;
  let message = `Newsletter envoyée à ${reussis} abonné(s) sur ${actifs.length}.`;
  if (echecs)  message += ` ${echecs} échec(s) (adresse invalide ou rejetée).`;
  if (quotaAtteint && restants > 0) {
    message += ` Quota d'envoi Gmail atteint pour aujourd'hui — ${restants} abonné(s) n'ont pas encore été contactés. Relancez l'envoi demain pour les toucher (les abonnés déjà reçus ne seront pas comptés deux fois si vous adaptez la liste).`;
  }

  return reponseJSON({
    status: 'success',
    message: message,
    reussis: reussis,
    echecs: echecs,
    cibles: actifs.length,
    quotaAtteint: quotaAtteint
  });
}

// =====================================================================
// TEMPLATES EMAIL
// =====================================================================
function _envoyerEmailConfirmationAbonnement(emailDestinataire, token) {
  const lienDesinscription = ScriptApp.getService().getUrl() +
    '?action=desinscription&email=' + encodeURIComponent(emailDestinataire) +
    '&token=' + encodeURIComponent(token);

  const htmlBody = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
  </td></tr>
  <tr><td style="background:${CONFIG.COULEUR_TEAL};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">INSCRIPTION NEWSLETTER CONFIRMÉE</p>
  </td></tr>
  <tr><td style="background:#FFF;padding:32px 36px;">
    <p style="margin:0 0 20px;font-size:15px;color:#444455;line-height:1.75;">
      Merci de vous être inscrit(e) à la newsletter de <strong>LES QUALITÉS DE DIEU SERVICE SARL</strong>.
      Vous recevrez nos actualités : nouvelles formations, événements, offres du centre.
    </p>
    <p style="margin:0;font-size:12px;color:#9AA0A6;line-height:1.6;">
      Vous pouvez vous désinscrire à tout moment via le lien présent dans chaque email, ou en cliquant
      <a href="${lienDesinscription}" style="color:${CONFIG.COULEUR_TEAL};">ici</a>.
    </p>
  </td></tr>
  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;

  GmailApp.sendEmail(emailDestinataire, 'Inscription confirmée — Newsletter LQD Service',
    'Merci de vous être inscrit à notre newsletter.',
    { htmlBody: htmlBody, name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL });
}

function construireEmailNewsletter(sujet, contenuHtml, lienDesinscription) {
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
    <p style="margin:0;font-size:14px;font-weight:700;color:#04342C;letter-spacing:.03em;">${sujet}</p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">
    <div style="font-size:15px;color:#444455;line-height:1.75;">${contenuHtml}</div>
  </td></tr>

  <tr><td style="background:#F8FAFA;border:1px solid #E5E7EB;border-top:none;padding:18px 36px;text-align:center;">
    <p style="font-size:12px;color:#9AA0A6;line-height:1.7;margin:0;">
      Vous recevez cet email car vous êtes inscrit(e) à la newsletter de LES QUALITÉS DE DIEU SERVICE SARL.<br/>
      <a href="${lienDesinscription}" style="color:${CONFIG.COULEUR_TEAL};text-decoration:none;font-weight:600;">Se désinscrire en un clic</a>
    </p>
  </td></tr>

  ${piedDePageEmail()}
</table>
</td></tr></table>
</body></html>`;
}

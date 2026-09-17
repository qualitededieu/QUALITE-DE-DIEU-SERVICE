/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Boîte de messages unifiée
   Fichier  : messages.gs
   Version  : 1.0.0
   Rôle     : Permettre à l'administration de VOIR et de RÉPONDRE
              directement, depuis admin.html, aux messages entrants qui
              jusqu'ici n'avaient aucune interface (RDV / Leads du chat)
              ou aucun moyen de réponse en un clic (Renseignements).

   Les candidatures gardent leur propre écran dédié (admin.html) — mais
   utilisent la MÊME fonction générique adminRepondreMessage() ci-dessous
   pour l'envoi de la réponse, avec source = 'candidature'.

   ROUTES (routées via routerAdmin, admin.gs) :
     admin_get_boite_messages    : adminGetBoiteMessages(data, email)
     admin_repondre_message      : adminRepondreMessage(data, email)
     admin_update_statut_message : adminUpdateStatutMessage(data, email)
   ===================================================================== */

// Sources affichées dans la boîte de messages unifiée (page "Messages").
// La candidature n'y figure PAS (elle a son propre écran) mais reste
// une source valide pour adminRepondreMessage / adminUpdateStatutMessage.
const MESSAGE_SOURCES_BOITE = ['renseignement', 'rdv', 'lead'];

const MESSAGE_SOURCES = {
  renseignement: {
    sheet:      'Renseignements',
    entetes:    () => ENTETES_RENSEIGNEMENT,
    label:      'Renseignement',
    nomCols:    ['Prénom', 'Nom'],
    dateCol:    'Date',
    messageCol: 'Question / Message',
    extraCols:  ['Formations intéressées']
  },
  candidature: {
    sheet:      'Candidatures',
    entetes:    () => ENTETES_CANDIDATURE,
    label:      'Candidature',
    nomCols:    ['Prénom(s)', 'Nom'],
    dateCol:    'Date candidature',
    messageCol: 'Motivation',
    extraCols:  ['Domaine']
  },
  rdv: {
    sheet:      'RDV',
    entetes:    () => ENTETES_RDV,
    label:      'Rendez-vous',
    nomCols:    ['Nom'],
    dateCol:    'Date demande',
    messageCol: 'Message',
    extraCols:  ['Type de RDV', 'Créneau souhaité']
  },
  lead: {
    sheet:      'Leads',
    entetes:    () => ENTETES_LEADS,
    label:      'Contact chat',
    nomCols:    ['Nom'],
    dateCol:    'Date',
    messageCol: 'Message',
    extraCols:  ['Formation intérêt']
  }
};

const STATUTS_MESSAGE_VALIDES = ['Nouveau', 'Vu', 'Traité'];

function _colIndexMessage(entetes, nom) {
  const i = entetes.indexOf(nom);
  if (i === -1) throw new Error('Colonne "' + nom + '" introuvable dans les en-têtes fournies.');
  return i;
}

// =====================================================================
// LECTURE — Boîte de messages unifiée (Renseignements + RDV + Leads)
// =====================================================================
function adminGetBoiteMessages(data, email) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const messages = [];

  MESSAGE_SOURCES_BOITE.forEach(function(cle) {
    const src = MESSAGE_SOURCES[cle];
    const feuille = ss.getSheetByName(src.sheet);
    if (!feuille) return;

    const entetes = src.entetes();
    const idxId      = _colIndexMessage(entetes, 'ID');
    const idxDate    = _colIndexMessage(entetes, src.dateCol);
    const idxTel     = _colIndexMessage(entetes, 'Téléphone');
    const idxEmail   = _colIndexMessage(entetes, 'Email');
    const idxStatut  = _colIndexMessage(entetes, 'Statut');
    const idxMessage = entetes.indexOf(src.messageCol);
    const idxNoms    = src.nomCols.map(function(c) { return _colIndexMessage(entetes, c); });
    const idxExtras  = src.extraCols.map(function(c) { return entetes.indexOf(c); });

    const rows = feuille.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[idxId]) continue;

      const nom = idxNoms.map(function(idx) { return String(r[idx] || '').trim(); }).join(' ').trim();
      const extras = idxExtras
        .map(function(idx, k) { return idx === -1 ? '' : (src.extraCols[k] + ' : ' + String(r[idx] || '—')); })
        .filter(Boolean)
        .join(' — ');
      const messageTxt = idxMessage === -1 ? '' : String(r[idxMessage] || '').trim();

      messages.push({
        id:        String(r[idxId]),
        source:    cle,
        sourceLabel: src.label,
        date:      String(r[idxDate] || ''),
        nom:       nom || '—',
        telephone: String(r[idxTel] || ''),
        email:     String(r[idxEmail] || ''),
        extras:    extras,
        message:   messageTxt,
        resume:    (messageTxt || extras || '—').slice(0, 140),
        statut:    String(r[idxStatut] || 'Nouveau').trim() || 'Nouveau'
      });
    }
  });

  messages.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  return reponseJSON({ status: 'success', messages: messages });
}

// =====================================================================
// ÉCRITURE — Changer le statut d'un message (boîte unifiée uniquement,
// PAS les candidatures qui ont déjà adminUpdateStatutCandidature)
// =====================================================================
function adminUpdateStatutMessage(data, email) {
  const source = String(data.source || '').trim();
  const id     = String(data.id     || '').trim();
  const statut = String(data.statut || '').trim();

  if (MESSAGE_SOURCES_BOITE.indexOf(source) === -1) {
    return reponseJSON({ status: 'error', message: 'Source de message invalide.' });
  }
  if (!id || STATUTS_MESSAGE_VALIDES.indexOf(statut) === -1) {
    return reponseJSON({ status: 'error', message: 'Paramètres invalides.' });
  }

  const src = MESSAGE_SOURCES[source];
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName(src.sheet);
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const entetes  = src.entetes();
  const idxId     = _colIndexMessage(entetes, 'ID');
  const idxStatut = _colIndexMessage(entetes, 'Statut');

  const rows = feuille.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxId]).trim() !== id) continue;
    feuille.getRange(i + 1, idxStatut + 1).setValue(statut);
    return reponseJSON({ status: 'success', message: 'Statut mis à jour.' });
  }
  return reponseJSON({ status: 'error', message: 'Message introuvable.' });
}

// =====================================================================
// ÉCRITURE — Répondre par email à un message, quelle que soit sa source
// (renseignement, rdv, lead, ou candidature depuis son propre écran).
// Jamais de confiance dans un email fourni par le client : on relit
// systématiquement la ligne source pour récupérer la vraie adresse.
// =====================================================================
function adminRepondreMessage(data, email) {
  const source      = String(data.source || '').trim();
  const id          = String(data.id || '').trim();
  const sujet       = nettoyer(data.sujet || '');
  const messageHtml = String(data.messageHtml || '').trim();
  const marquerTraite = data.marquerTraite !== false; // par défaut : oui

  if (!MESSAGE_SOURCES[source]) {
    return reponseJSON({ status: 'error', message: 'Source de message invalide.' });
  }
  if (!id || !sujet || !messageHtml) {
    return reponseJSON({ status: 'error', message: 'Sujet et message requis.' });
  }

  const src = MESSAGE_SOURCES[source];
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName(src.sheet);
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille introuvable.' });

  const entetes = src.entetes();
  const idxId     = _colIndexMessage(entetes, 'ID');
  const idxEmail  = _colIndexMessage(entetes, 'Email');
  const idxStatut = entetes.indexOf('Statut');
  const idxNoms   = src.nomCols.map(function(c) { return _colIndexMessage(entetes, c); });

  const rows = feuille.getDataRange().getValues();
  let ligneIndex = -1, destinataireEmail = '', nomDestinataire = '';
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxId]).trim() !== id) continue;
    ligneIndex = i;
    destinataireEmail = String(rows[i][idxEmail] || '').trim();
    nomDestinataire   = idxNoms.map(function(idx) { return String(rows[i][idx] || '').trim(); }).join(' ').trim();
    break;
  }

  if (ligneIndex === -1) {
    return reponseJSON({ status: 'error', message: 'Dossier introuvable.' });
  }
  if (!destinataireEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataireEmail)) {
    return reponseJSON({ status: 'error', message: 'Ce contact n\'a pas fourni d\'adresse email valide — répondez-lui par téléphone ou WhatsApp.' });
  }

  const quotaRestant = MailApp.getRemainingDailyQuota();
  if (quotaRestant < 1) {
    return reponseJSON({ status: 'error', message: 'Quota d\'envoi Gmail atteint pour aujourd\'hui. Réessayez demain.' });
  }

  try {
    const htmlBody = construireEmailReponseAdmin(src.label, nomDestinataire || 'Madame, Monsieur', sujet, messageHtml, id);
    const texteBrut = messageHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    GmailApp.sendEmail(destinataireEmail, sujet, texteBrut, {
      htmlBody: htmlBody,
      name:     CONFIG.EXPEDITEUR_NOM,
      replyTo:  CONFIG.ADMIN_EMAIL
    });
  } catch (errEnvoi) {
    console.error('[adminRepondreMessage] envoi', errEnvoi.toString());
    return reponseJSON({ status: 'error', message: 'Échec de l\'envoi de l\'email : ' + errEnvoi.message });
  }

  if (marquerTraite && idxStatut !== -1) {
    feuille.getRange(ligneIndex + 1, idxStatut + 1).setValue('Traité');
  }

  try {
    _journaliserReponseMessage(ss, source, id, destinataireEmail, sujet, email);
  } catch (errJournal) {
    console.error('[adminRepondreMessage] journal', errJournal.toString());
  }

  return reponseJSON({ status: 'success', message: 'Réponse envoyée à ' + destinataireEmail + '.' });
}

// Journal d'audit — trace qui a répondu quoi et quand, indépendamment
// du statut de la ligne source (utile en cas de litige ou de contrôle).
const ENTETES_JOURNAL_REPONSES = ['Date', 'Source', 'ID dossier', 'Destinataire', 'Sujet', 'Répondu par (admin)'];

function _journaliserReponseMessage(ss, source, id, destinataire, sujet, adminEmail) {
  let feuille = ss.getSheetByName('Journal des réponses');
  if (!feuille) {
    feuille = ss.insertSheet('Journal des réponses');
    feuille.appendRow(ENTETES_JOURNAL_REPONSES);
    feuille.setFrozenRows(1);
  }
  feuille.appendRow([
    new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    MESSAGE_SOURCES[source].label,
    id,
    destinataire,
    sujet,
    adminEmail
  ]);
}

// =====================================================================
// TEMPLATE EMAIL — Réponse manuelle de l'administration
// Reprend le même squelette que les autres emails du site (voir
// construireEmailAutoReponseRenseignement dans code.gs) pour rester
// visuellement cohérent, mais avec un pied de page qui INVITE à
// répondre (contrairement aux emails automatiques).
// =====================================================================
function construireEmailReponseAdmin(sourceLabel, nomDestinataire, sujet, messageHtml, refDossier) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="72" style="border-radius:8px;display:inline-block;margin-bottom:12px;"/>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#FFF;">Les Qualités de Dieu Service</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">Réponse à votre ${sourceLabel.toLowerCase()} — Réf. ${refDossier}</p>
  </td></tr>

  <tr><td style="background:${CONFIG.COULEUR_TEAL};padding:14px 36px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#FFF;letter-spacing:.05em;">${sujet.toUpperCase()}</p>
  </td></tr>

  <tr><td style="background:#FFF;padding:32px 36px;">
    <p style="margin:0 0 20px;font-size:15px;color:#444455;">Bonjour ${nomDestinataire},</p>
    <div style="font-size:15px;color:#444455;line-height:1.75;">${messageHtml}</div>
  </td></tr>

  <tr><td style="background:#F8FAFA;border:1px solid #E5E7EB;border-top:none;padding:22px 36px;">
    <p style="font-size:13px;color:#6B7280;line-height:1.7;margin:0;">
      Vous pouvez répondre directement à cet email, ou nous joindre au
      <a href="tel:+22997951230" style="color:${CONFIG.COULEUR_TEAL};font-weight:600;text-decoration:none;">+229 01 97 95 12 30</a>
      / <a href="https://wa.me/${CONFIG.WHATSAPP}" style="color:#25D366;font-weight:600;text-decoration:none;">WhatsApp</a>.
    </p>
  </td></tr>

  <tr><td style="background:${CONFIG.COULEUR_DARK};border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.7;">
      © ${new Date().getFullYear()} Les Qualités de Dieu Service SARL — Tous droits réservés<br/>
      <a href="${CONFIG.SITE_URL}" style="color:${CONFIG.COULEUR_ORANGE};text-decoration:none;">Visiter notre site</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

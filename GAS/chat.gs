/* =====================================================================
   LES QUALITÉS DE DIEU SERVICE SARL — Backend du chat public
   Fichier  : chat.gs
   Version  : 1.0.0
   Rôle     : Réceptionner les demandes de RDV et les leads capturés
              par le widget de chat (js/chat-widget.js). 100% GAS pur —
              pas de Supabase, pas de route Vercel intermédiaire.

   ROUTES (routées directement depuis doPost, avant le switch admin_) :
     action === 'chat_rdv'  : enregistrerRdvChat(data)   // public
     action === 'chat_lead' : enregistrerLeadChat(data)  // public
   ===================================================================== */


// =====================================================================
// EN-TÊTES — Feuille "RDV"
// =====================================================================
const ENTETES_RDV = [
  'ID', 'Date demande', 'Nom', 'Téléphone', 'Email',
  'Type de RDV', 'Créneau souhaité', 'Message', 'Statut' // Nouveau | Contacté | Honoré | Annulé
];

// =====================================================================
// EN-TÊTES — Feuille "Leads"
// =====================================================================
const ENTETES_LEADS = [
  'ID', 'Date', 'Nom', 'Téléphone', 'Email',
  'Formation intérêt', 'Message', 'Statut' // Nouveau | Contacté | Converti | Perdu
];


// =====================================================================
// ROUTE PUBLIC — Enregistrer une demande de RDV depuis le chat
// =====================================================================
function enregistrerRdvChat(data) {
  const nom       = nettoyer(data.nom || '');
  const telephone = nettoyer(data.telephone || '');

  if (!nom || !telephone) {
    return reponseJSON({ status: 'error', message: 'Nom et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  let feuille = ss.getSheetByName('RDV');
  if (!feuille) {
    feuille = ss.insertSheet('RDV');
    feuille.appendRow(ENTETES_RDV);
    feuille.setFrozenRows(1);
  }

  const id = genererID('RDV');
  feuille.appendRow([
    id,
    new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    nom,
    telephone,
    nettoyer(data.email || ''),
    nettoyer(data.typeRdv || ''),
    nettoyer(data.creneau || ''),
    nettoyer(data.message || ''),
    'Nouveau'
  ]);
  forcerTelephoneTexte(feuille, 4, telephone); // colonne 4 = Téléphone

  try {
    _notifierAdminChat('Nouvelle demande de RDV', [
      ['Référence',  id],
      ['Nom',        nom],
      ['Téléphone',  telephone],
      ['Email',      data.email || '—'],
      ['Type',       data.typeRdv || '—'],
      ['Créneau',    data.creneau || '—'],
      ['Message',    data.message || '—']
    ]);
  } catch (e) {
    console.error('[enregistrerRdvChat] email admin', e.toString());
  }

  return reponseJSON({ status: 'success', id, message: 'Votre demande de rendez-vous a bien été enregistrée. Nous vous contactons rapidement.' });
}


// =====================================================================
// ROUTE PUBLIC — Enregistrer un lead depuis le chat
// =====================================================================
function enregistrerLeadChat(data) {
  const nom       = nettoyer(data.nom || '');
  const telephone = nettoyer(data.telephone || '');

  if (!nom || !telephone) {
    return reponseJSON({ status: 'error', message: 'Nom et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  let feuille = ss.getSheetByName('Leads');
  if (!feuille) {
    feuille = ss.insertSheet('Leads');
    feuille.appendRow(ENTETES_LEADS);
    feuille.setFrozenRows(1);
  }

  const id = genererID('LEAD');
  feuille.appendRow([
    id,
    new Date().toLocaleString('fr-BJ', { timeZone: 'Africa/Porto-Novo' }),
    nom,
    telephone,
    nettoyer(data.email || ''),
    nettoyer(data.formation || ''),
    nettoyer(data.message || ''),
    'Nouveau'
  ]);
  forcerTelephoneTexte(feuille, 4, telephone); // colonne 4 = Téléphone

  try {
    _notifierAdminChat('Nouveau contact via le chat du site', [
      ['Référence',  id],
      ['Nom',        nom],
      ['Téléphone',  telephone],
      ['Email',      data.email || '—'],
      ['Formation',  data.formation || '—'],
      ['Message',    data.message || '—']
    ]);
  } catch (e) {
    console.error('[enregistrerLeadChat] email admin', e.toString());
  }

  return reponseJSON({ status: 'success', id, message: 'Merci ! Un conseiller vous recontacte très vite.' });
}


// =====================================================================
// HELPER — Notification email admin (RDV / Leads chat)
// =====================================================================
function _notifierAdminChat(titre, lignes) {
  const lignesHtml = lignes.map(([label, valeur]) => `
    <tr>
      <td style="padding:8px 14px;color:#6B7280;font-weight:600;font-size:13px;width:38%;border-bottom:1px solid #F3F4F6;">${label}</td>
      <td style="padding:8px 14px;color:#111827;font-size:13px;border-bottom:1px solid #F3F4F6;">${valeur}</td>
    </tr>`).join('');

  const htmlBody = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#04342C;padding:22px 32px;">
    <h1 style="margin:0;font-size:16px;color:#FFF;font-weight:700;">${titre}</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#A7C4BC;">Chat public — Les Qualités de Dieu Service</p>
  </td></tr>
  <tr><td style="padding:20px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0">${lignesHtml}</table>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  GmailApp.sendEmail(
    CONFIG.ADMIN_EMAIL,
    `[Chat] ${titre}`,
    lignes.map(([l, v]) => `${l}: ${v}`).join('\n'),
    { htmlBody, name: CONFIG.EXPEDITEUR_NOM }
  );
}


/* =====================================================================
   INTÉGRATION — déjà câblée dans doPost() de code.gs :

   if (action === 'chat_rdv')  return enregistrerRdvChat(data);
   if (action === 'chat_lead') return enregistrerLeadChat(data);
   ===================================================================== */

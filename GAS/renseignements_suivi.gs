/* =====================================================================
   RÉPONSES AUX DEMANDES DE RENSEIGNEMENT (octobre 2026)

   L'admin répond depuis la page Renseignements. La réponse est :
   1. enregistrée dans la feuille "Renseignements" (colonnes "Réponse" et
      "Date réponse") : la personne la lit sur le site, page
      Renseignements -> "Suivre ma demande", avec son n° de demande et
      son téléphone (rien à installer, aucun compte nécessaire) ;
   2. envoyée par email si la personne en a donné un.
   Le statut passe à "Traité" et la réponse est tracée dans le
   "Journal des réponses" (même journal que la boîte de messages).

   PIÈCE JOINTE FACULTATIVE (demande client, octobre 2026) : l'admin peut
   joindre UNE image (JPG, PNG, WEBP) ou UN PDF à sa réponse. Le fichier
   est rangé dans le dossier Drive "Réponses renseignements — LQD
   Service" (lecture avec le lien), joint à l'email, et proposé en
   téléchargement sur la page "Suivre ma demande". Modifier la réponse
   sans nouveau fichier conserve la pièce jointe actuelle.
===================================================================== */

const RENS_SUIVI = {
  REPONSE_MAX: 3000,
  CONSULTATIONS_MAX_PAR_HEURE: 10,  // par n° de demande : anti-essais au hasard sur le téléphone
  PJ_TYPES: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  PJ_MAX_OCTETS: 10 * 1024 * 1024,  // 10 Mo (Gmail accepte 25 Mo, on reste large)
  PJ_DOSSIER_DRIVE: 'Réponses renseignements — LQD Service'
};

// Colonnes ajoutées à la feuille existante (après "Statut", colonne I).
// Fonctions (et non constantes) : Apps Script exécute les fichiers dans
// un ordre qui n'est pas garanti, ENTETES_RENSEIGNEMENT (code.gs) peut ne
// pas encore exister au moment où ce fichier est lu.
function _colRensReponse()     { return ENTETES_RENSEIGNEMENT.indexOf('Réponse') + 1; }      // J
function _colRensDateReponse() { return ENTETES_RENSEIGNEMENT.indexOf('Date réponse') + 1; } // K
function _colRensPjNom()       { return ENTETES_RENSEIGNEMENT.indexOf('Pièce jointe réponse (nom)') + 1; }       // L
function _colRensPjUrl()       { return ENTETES_RENSEIGNEMENT.indexOf('Pièce jointe réponse (Drive URL)') + 1; } // M

function _idDepuisUrlDrive(url) {
  const m = String(url || '').match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : '';
}

// Contrôle de la pièce jointe envoyée par l'admin. Renvoie { blob } ou
// { erreur }. Le type est vérifié sur le MIME ET sur l'extension, et les
// premiers octets doivent correspondre (un .exe renommé en .pdf est refusé).
function _preparerPieceJointeRens(pj) {
  const mime = String(pj.mimeType || '').toLowerCase();
  if (RENS_SUIVI.PJ_TYPES.indexOf(mime) === -1) return { erreur: 'Pièce jointe : seuls les PDF et les images JPG, PNG ou WEBP sont acceptés.' };
  let octets;
  try { octets = Utilities.base64Decode(String(pj.base64 || '')); }
  catch (e) { return { erreur: 'Pièce jointe illisible (fichier corrompu).' }; }
  if (!octets.length) return { erreur: 'Pièce jointe vide.' };
  if (octets.length > RENS_SUIVI.PJ_MAX_OCTETS) return { erreur: 'Pièce jointe trop lourde (10 Mo maximum).' };

  const sig = octets.slice(0, 12).map(b => (b + 256) % 256);
  const signatures = {
    'application/pdf': sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46,     // %PDF
    'image/jpeg':      sig[0] === 0xFF && sig[1] === 0xD8,
    'image/png':       sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47,
    'image/webp':      sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50   // ....WEBP
  };
  if (!signatures[mime]) return { erreur: 'Pièce jointe : le contenu ne correspond pas à un PDF ou à une image valide.' };

  const extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  let nom = String(pj.nom || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim();
  nom = nom.replace(/\.[A-Za-z0-9]{1,5}$/, '').slice(0, 80) || 'piece-jointe';
  return { blob: Utilities.newBlob(octets, mime, nom + '.' + extensions[mime]) };
}

function _enregistrerPieceJointeRens(blob, idDemande) {
  const dossier = trouverDossierDrive(RENS_SUIVI.PJ_DOSSIER_DRIVE) || DriveApp.createFolder(RENS_SUIVI.PJ_DOSSIER_DRIVE);
  const nomAffiche = blob.getName();
  // Sur Drive, le fichier est préfixé par le n° de demande (retrouvable) ;
  // la personne voit le nom d'origine.
  const fichier = dossier.createFile(blob.setName(idDemande + ' - ' + nomAffiche));
  // Lecture avec le lien : nécessaire pour l'ouvrir depuis "Suivre ma demande".
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { nom: nomAffiche, url: 'https://drive.google.com/file/d/' + fichier.getId() + '/view' };
}

// Ajoute les en-têtes manquantes sur une feuille créée avant cette mise à jour.
function _feuilleRenseignementsAJour() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Renseignements');
  if (!feuille) return null;
  const nbCols = feuille.getLastColumn();
  if (nbCols < ENTETES_RENSEIGNEMENT.length) {
    const manquantes = ENTETES_RENSEIGNEMENT.slice(nbCols);
    feuille.getRange(1, nbCols + 1, 1, manquantes.length).setValues([manquantes])
      .setBackground(CONFIG.COULEUR_TEAL).setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return feuille;
}

function _texteVersHtml(texte) {
  return String(texte || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .split(/\n{2,}/).map(p => '<p style="margin:0 0 14px;">' + p.replace(/\n/g, '<br>') + '</p>').join('');
}

function _dateFr(d) {
  return Utilities.formatDate(d, 'Africa/Porto-Novo', "dd/MM/yyyy 'à' HH:mm");
}

/* --------------------------- ADMIN --------------------------- */

function adminRepondreRenseignement(data, email) {
  const id = String(data.id || '').trim();
  const reponse = String(data.reponse || '').replace(/\r\n/g, '\n').trim();
  const envoyerEmail = data.envoyerEmail !== false;
  if (!id) return reponseJSON({ status: 'error', message: 'Référence manquante.' });
  if (reponse.length < 5) return reponseJSON({ status: 'error', message: 'Votre réponse est vide ou trop courte.' });
  if (reponse.length > RENS_SUIVI.REPONSE_MAX) return reponseJSON({ status: 'error', message: 'Réponse trop longue (' + RENS_SUIVI.REPONSE_MAX + ' caractères maximum).' });

  const feuille = _feuilleRenseignementsAJour();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Feuille Renseignements introuvable.' });

  // Pièce jointe facultative : contrôlée AVANT toute écriture.
  let nouvellePj = null;
  if (data.pieceJointe && data.pieceJointe.base64) {
    nouvellePj = _preparerPieceJointeRens(data.pieceJointe);
    if (nouvellePj.erreur) return reponseJSON({ status: 'error', message: nouvellePj.erreur });
  }

  const lignes = feuille.getDataRange().getValues();
  let i = -1;
  for (let k = 1; k < lignes.length; k++) {
    if (String(lignes[k][0]).trim() === id) { i = k; break; }
  }
  if (i === -1) return reponseJSON({ status: 'error', message: 'Demande introuvable.' });

  const row = lignes[i];
  const maintenant = new Date();

  // Pièce jointe : nouvelle (remplace l'ancienne), retirée, ou conservée.
  let pj = { nom: String(row[_colRensPjNom() - 1] || ''), url: String(row[_colRensPjUrl() - 1] || '') };
  const ancienFichierId = _idDepuisUrlDrive(pj.url);
  let blobEmail = null;
  if (nouvellePj) {
    try {
      blobEmail = nouvellePj.blob.copyBlob();
      pj = _enregistrerPieceJointeRens(nouvellePj.blob, id);
    } catch (e) {
      console.error('[adminRepondreRenseignement] pièce jointe', e.toString());
      return reponseJSON({ status: 'error', message: 'La pièce jointe n\'a pas pu être enregistrée sur Drive : ' + e.message + '. Rien n\'a été publié, réessayez.' });
    }
    if (ancienFichierId) _supprimerFichierDrive(ancienFichierId);
  } else if (data.retirerPieceJointe === true) {
    if (ancienFichierId) _supprimerFichierDrive(ancienFichierId);
    pj = { nom: '', url: '' };
  } else if (ancienFichierId) {
    try { blobEmail = DriveApp.getFileById(ancienFichierId).getBlob().setName(pj.nom || 'piece-jointe'); }
    catch (e) { blobEmail = null; /* fichier supprimé à la main sur Drive : email sans pièce jointe */ }
  }

  // 1. Réponse visible sur le site (Suivre ma demande) — colonnes J à M
  feuille.getRange(i + 1, _colRensReponse(), 1, 4).setValues([[reponse, _dateFr(maintenant), pj.nom, pj.url]]);
  feuille.getRange(i + 1, ENTETES_RENSEIGNEMENT.indexOf('Statut') + 1).setValue('Traité');

  // 2. Email si la personne en a donné un
  const destinataire = String(row[5] || '').trim();
  let emailEnvoye = false;
  let avertissement = '';
  if (envoyerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
    if (MailApp.getRemainingDailyQuota() < 1) {
      avertissement = 'Quota d\'envoi Gmail atteint aujourd\'hui : la réponse est visible sur le site, mais l\'email n\'est pas parti.';
    } else {
      try {
        const nom = (String(row[2] || '') + ' ' + String(row[3] || '')).trim() || 'Madame, Monsieur';
        const sujet = 'Réponse à votre demande de renseignement';
        const corps = _texteVersHtml(reponse) +
          (blobEmail ? '<p style="margin:14px 0 0;font-size:14px;"><strong>Pièce jointe :</strong> ' + _texteVersHtml(pj.nom).replace(/<\/?p[^>]*>/g, '') + '</p>' : '') +
          '<p style="margin:18px 0 0;font-size:13px;color:#6B7280;">Vous pouvez aussi retrouver cette réponse sur ' +
          '<a href="' + CONFIG.SITE_URL + '/renseignements#suivi" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;">notre site</a>' +
          ' avec votre référence <strong>' + id + '</strong> et votre numéro de téléphone.</p>';
        const options = {
          htmlBody: construireEmailReponseAdmin('Renseignement', nom, sujet, corps, id),
          name: CONFIG.EXPEDITEUR_NOM,
          replyTo: CONFIG.ADMIN_EMAIL
        };
        if (blobEmail) options.attachments = [blobEmail];
        GmailApp.sendEmail(destinataire, sujet, reponse, options);
        emailEnvoye = true;
      } catch (e) {
        console.error('[adminRepondreRenseignement] email', e.toString());
        avertissement = 'La réponse est visible sur le site, mais l\'email n\'a pas pu partir : ' + e.message;
      }
    }
  }

  try {
    _journaliserReponseMessage(trouverSpreadsheet(CONFIG.SPREADSHEET_NAME), 'renseignement', id,
      emailEnvoye ? destinataire : '(site uniquement)', 'Réponse à votre demande de renseignement', email);
  } catch (e) { console.error('[adminRepondreRenseignement] journal', e.toString()); }

  return reponseJSON({
    status: 'success',
    emailEnvoye: emailEnvoye,
    avertissement: avertissement,
    dateReponse: _dateFr(maintenant),
    pieceJointe: pj.url ? pj : null,
    message: emailEnvoye
      ? 'Réponse enregistrée sur le site et envoyée à ' + destinataire + '.'
      : 'Réponse enregistrée : la personne la lira sur le site (Suivre ma demande).'
  });
}

/* --------------------------- PUBLIC --------------------------- */

function renseignementSuivre(data) {
  const id  = String(data.id || '').trim().toUpperCase();
  const tel = String(data.telephone || '').trim();
  if (!id || !tel) return reponseJSON({ status: 'error', message: 'Indiquez votre n° de demande et votre téléphone.' });

  const cache = CacheService.getScriptCache();
  const cle = 'RENS_SUIVI_' + id;
  const nb = Number(cache.get(cle) || 0);
  if (nb >= RENS_SUIVI.CONSULTATIONS_MAX_PAR_HEURE) {
    return reponseJSON({ status: 'error', message: 'Trop de tentatives pour cette demande. Réessayez dans une heure.' });
  }
  cache.put(cle, String(nb + 1), 3600);

  const feuille = _feuilleRenseignementsAJour();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const lignes = feuille.getDataRange().getValues();
  for (let i = 1; i < lignes.length; i++) {
    const r = lignes[i];
    if (String(r[0]).trim().toUpperCase() !== id) continue;
    if (!_telephonesEquivalents(String(r[4] || ''), tel)) {
      return reponseJSON({ status: 'error', message: 'Demande trouvée, mais le téléphone ne correspond pas.' });
    }
    return reponseJSON({
      status: 'success',
      demande: {
        id: String(r[0]),
        date: String(r[1] || ''),
        prenom: String(r[2] || ''),
        formations: String(r[6] || '').split(' | ').filter(Boolean).map(f => nomAffichagePublic(f.trim())).join(', '),
        question: String(r[7] || ''),
        reponse: String(r[_colRensReponse() - 1] || ''),
        dateReponse: String(r[_colRensDateReponse() - 1] || ''),
        // Pièce jointe seulement si une réponse est publiée.
        pieceJointe: (r[_colRensReponse() - 1] && r[_colRensPjUrl() - 1])
          ? { nom: String(r[_colRensPjNom() - 1] || 'Pièce jointe'), url: String(r[_colRensPjUrl() - 1]) }
          : null
      }
    });
  }
  return reponseJSON({ status: 'error', message: 'Aucune demande trouvée avec ce numéro. Il commence par RNS-.' });
}

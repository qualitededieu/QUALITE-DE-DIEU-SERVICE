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
===================================================================== */

const RENS_SUIVI = {
  REPONSE_MAX: 3000,
  CONSULTATIONS_MAX_PAR_HEURE: 10   // par n° de demande : anti-essais au hasard sur le téléphone
};

// Colonnes ajoutées à la feuille existante (après "Statut", colonne I).
// Fonctions (et non constantes) : Apps Script exécute les fichiers dans
// un ordre qui n'est pas garanti, ENTETES_RENSEIGNEMENT (code.gs) peut ne
// pas encore exister au moment où ce fichier est lu.
function _colRensReponse()     { return ENTETES_RENSEIGNEMENT.indexOf('Réponse') + 1; }      // J
function _colRensDateReponse() { return ENTETES_RENSEIGNEMENT.indexOf('Date réponse') + 1; } // K

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

  const lignes = feuille.getDataRange().getValues();
  let i = -1;
  for (let k = 1; k < lignes.length; k++) {
    if (String(lignes[k][0]).trim() === id) { i = k; break; }
  }
  if (i === -1) return reponseJSON({ status: 'error', message: 'Demande introuvable.' });

  const row = lignes[i];
  const maintenant = new Date();
  // 1. Réponse visible sur le site (Suivre ma demande)
  feuille.getRange(i + 1, _colRensReponse(), 1, 2).setValues([[reponse, _dateFr(maintenant)]]);
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
          '<p style="margin:18px 0 0;font-size:13px;color:#6B7280;">Vous pouvez aussi retrouver cette réponse sur ' +
          '<a href="' + CONFIG.SITE_URL + '/renseignements#suivi" style="color:' + CONFIG.COULEUR_TEAL + ';font-weight:600;">notre site</a>' +
          ' avec votre référence <strong>' + id + '</strong> et votre numéro de téléphone.</p>';
        GmailApp.sendEmail(destinataire, sujet, reponse, {
          htmlBody: construireEmailReponseAdmin('Renseignement', nom, sujet, corps, id),
          name: CONFIG.EXPEDITEUR_NOM,
          replyTo: CONFIG.ADMIN_EMAIL
        });
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
        dateReponse: String(r[_colRensDateReponse() - 1] || '')
      }
    });
  }
  return reponseJSON({ status: 'error', message: 'Aucune demande trouvée avec ce numéro. Il commence par RNS-.' });
}

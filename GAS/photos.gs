// ================================================================
// CHANGEMENT DE LA PHOTO D'IDENTITÉ D'UN APPRENANT (admin, octobre 2026)
//
// - Réservé à l'admin (requireAuth dans admin.gs).
// - Image contrôlée côté serveur : JPEG ou PNG (type ET premiers octets),
//   5 Mo maximum. La page réduit déjà l'image avant l'envoi.
// - Nouvelle photo rangée dans le dossier Drive de l'apprenant (drive.gs),
//   lisible par lien (carte, attestation, badge) ; l'ancienne est conservée
//   en privé dans "Anciennes photos" (traçabilité, retour arrière possible).
// - Classeur mis à jour ("Toutes les inscriptions" + feuille de la filière).
// - L'apprenant est prévenu par email ; chaque changement est journalisé
//   dans l'onglet "Historique photos".
// ================================================================

const PHOTOS = {
  MAX_OCTETS:      5 * 1024 * 1024,
  MOTIF_MAX:       200,
  FEUILLE:         'Historique photos',
  DOSSIER_ARCHIVE: 'Anciennes photos'
};
const ENTETES_HISTORIQUE_PHOTOS = ['Date', 'Dossier', 'Apprenant', 'Ancienne photo', 'Nouvelle photo', 'Motif', 'Par', 'Email apprenant'];

// Renvoie { blob, ext } ou { erreur }.
function _preparerPhotoIdentite(base64, mime) {
  const m = String(mime || '').toLowerCase();
  const ext = m === 'image/jpeg' || m === 'image/jpg' ? 'jpg' : (m === 'image/png' ? 'png' : '');
  if (!ext) return { erreur: 'Format refusé : choisissez une photo JPEG ou PNG.' };
  let octets;
  try { octets = Utilities.base64Decode(String(base64 || '')); } catch (e) { return { erreur: 'Fichier illisible.' }; }
  if (!octets.length) return { erreur: 'Fichier vide.' };
  if (octets.length > PHOTOS.MAX_OCTETS) return { erreur: 'Photo trop lourde (5 Mo maximum).' };
  const o = i => (octets[i] + 256) % 256;
  const jpeg = o(0) === 0xFF && o(1) === 0xD8 && o(2) === 0xFF;
  const png = o(0) === 0x89 && o(1) === 0x50 && o(2) === 0x4E && o(3) === 0x47;
  if ((ext === 'jpg' && !jpeg) || (ext === 'png' && !png)) return { erreur: 'Le contenu du fichier ne correspond pas à une photo.' };
  return { octets: octets, mime: ext === 'jpg' ? 'image/jpeg' : 'image/png', ext: ext };
}

function _miniatureDrive(idFichier, largeur) {
  return 'https://drive.google.com/thumbnail?id=' + idFichier + '&sz=w' + (largeur || 300);
}

function _ligneApprenant(id) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return null;
  return feuille.getDataRange().getValues().filter(r => String(r[0]).trim() === String(id).trim())[0] || null;
}

// Cœur commun (changement par l'admin OU demande de l'apprenant validée) :
// la photo (fichier Drive déjà créé) devient la photo officielle.
function _remplacerPhotoApprenant(row, fichier, ext, motif, par) {
  const id = String(row[0]).trim();
  const prenom = String(row[2] || ''), nom = String(row[3] || '');
  const ancienneUrl = String(row[32] || '');
  const horodatage = Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd_HHmm');

  // 1. Nouvelle photo dans le dossier de l'apprenant, lisible (carte, attestation, badge)
  const dossier = dossierApprenantDrive(id, prenom, nom, row[1]);
  fichier.moveTo(dossier);
  fichier.setName('photo-identite_' + id + '_' + horodatage + '.' + ext);
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const nouvelleUrl = fichier.getUrl();

  // 2. Ancienne photo : gardée en privé dans "Anciennes photos" (rien n'est supprimé)
  const ancien = _fichierValide(_idDriveDepuisLien(ancienneUrl));
  if (ancien && ancien.getId() !== fichier.getId()) {
    try {
      const archive = _sousDossierActif(dossier, PHOTOS.DOSSIER_ARCHIVE) || dossier.createFolder(PHOTOS.DOSSIER_ARCHIVE);
      ancien.moveTo(archive);
      ancien.setName('ancienne-photo_' + id + '_remplacee-le-' + horodatage + '.' + (ancien.getName().split('.').pop() || 'jpg'));
      _rendrePrive(ancien);
    } catch (e) { console.error('[_remplacerPhotoApprenant] archive', e.toString()); }
  }

  // 3. Classeur : feuille générale + feuille de la filière
  mettreAJourColonnePrecise('Toutes les inscriptions', id, 'Photo identité (Drive URL)', nouvelleUrl);
  const formations = String(row[22] || '').split(' | ');
  mettreAJourColonnePrecise(formations.length === 1 ? formations[0] : 'Multi-formations', id, 'Photo identité (Drive URL)', nouvelleUrl);

  // 4. Email à l'apprenant
  const mail = String(row[10] || '').trim().toLowerCase();
  let emailEnvoye = false;
  if (_emailValide(mail)) {
    try { _emailPhotoChangee(mail, prenom, id, fichier.getId(), motif); emailEnvoye = true; }
    catch (e) { console.error('[_remplacerPhotoApprenant] email', e.toString()); }
  }

  // 5. Journal
  try {
    const j = _feuilleFormation(PHOTOS.FEUILLE, ENTETES_HISTORIQUE_PHOTOS);
    _ajouterLignes(j, [[new Date(), id, (prenom + ' ' + nom).trim(), ancienneUrl, nouvelleUrl, motif, par, emailEnvoye ? 'Envoyé à ' + mail : 'Pas d\'email']]);
  } catch (e) { console.error('[_remplacerPhotoApprenant] journal', e.toString()); }

  return { photoUrl: nouvelleUrl, emailEnvoye: emailEnvoye, telephone: String(row[9] || '') };
}

function adminChangerPhoto(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'Dossier manquant.' });
  const photo = _preparerPhotoIdentite(data.photoBase64, data.photoMime);
  if (photo.erreur) return reponseJSON({ status: 'error', message: photo.erreur });
  const row = _ligneApprenant(id);
  if (!row) return reponseJSON({ status: 'error', message: 'Dossier ' + id + ' introuvable.' });
  const dossier = dossierApprenantDrive(id, row[2], row[3], row[1]);
  const fichier = dossier.createFile(Utilities.newBlob(photo.octets, photo.mime, 'photo.' + photo.ext));
  const r = _remplacerPhotoApprenant(row, fichier, photo.ext, _txtF(data.motif, PHOTOS.MOTIF_MAX), email);
  return reponseJSON({ status: 'success', photoUrl: r.photoUrl, emailEnvoye: r.emailEnvoye, telephone: r.telephone,
    message: r.emailEnvoye ? 'Photo mise à jour. L\'apprenant est prévenu par email.'
                           : 'Photo mise à jour. Cet apprenant n\'a pas d\'email : prévenez-le par téléphone ou WhatsApp.' });
}

function _emailPhotoChangee(destinataire, prenom, id, idFichier, motif) {
  const date = Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'dd/MM/yyyy à HH:mm');
  const corps = `<p>Bonjour ${prenom || ''},</p>
<p>L'administration de LQD Service a <strong>mis à jour votre photo d'identité</strong> le ${date} (dossier ${id}).</p>
${motif ? `<p><strong>Motif :</strong> ${motif}</p>` : ''}
<p style="text-align:center;margin:18px 0;"><img src="${_miniatureDrive(idFichier, 240)}" width="140" alt="Nouvelle photo" style="border-radius:10px;border:1px solid #E5E7EB;"/></p>
<p>Cette photo apparaît désormais sur votre carte d'apprenant, votre attestation et votre badge. Vous pouvez les télécharger à nouveau depuis votre espace apprenant.</p>
<p style="margin:18px 0 0;"><a href="${CONFIG.SITE_URL}/espace-apprenant" style="display:inline-block;background:${CONFIG.COULEUR_TEAL};color:#FFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Ouvrir mon espace apprenant</a></p>
<p style="font-size:13px;color:#6B7280;margin-top:18px;">Vous n'êtes pas à l'origine de ce changement ? Contactez-nous rapidement au +229 01 97 95 12 30 ou en répondant à cet email.</p>`;
  GmailApp.sendEmail(destinataire, 'Votre photo d\'identité a été mise à jour', corps.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), {
    htmlBody: _gabaritBesoins('Espace apprenant — LQD Service', 'Votre photo d\'identité a été mise à jour', corps),
    name: CONFIG.EXPEDITEUR_NOM,
    replyTo: CONFIG.ADMIN_EMAIL
  });
}

/* =====================================================================
   DEMANDES DE L'APPRENANT (espace apprenant, octobre 2026)
   Comme un guichet d'identité : l'apprenant prend sa photo (caméra avec
   cadre, import en secours), elle reste PRIVÉE et en attente jusqu'à la
   validation de l'administration. Une seule demande en attente à la
   fois, 3 demandes au plus sur 12 mois (refus compris).
===================================================================== */
const DEMANDES_PHOTO = {
  FEUILLE:      'Demandes photo',
  PAR_AN:       3,
  SOURCES:      ['Caméra', 'Import'],
  DOSSIER:      'Demandes de photo'
};
// 0 ID | 1 Date | 2 Dossier | 3 Apprenant | 4 Source | 5 Fichier (ID Drive) |
// 6 Contrôles (JSON) | 7 Statut | 8 Traité par | 9 Date traitement | 10 Motif
const ENTETES_DEMANDES_PHOTO = ['ID', 'Date', 'Dossier', 'Apprenant', 'Source', 'Fichier (ID Drive)', 'Contrôles',
  'Statut', 'Traité par', 'Date traitement', 'Motif'];

function _lireDemandesPhoto() {
  const f = _feuilleFormation(DEMANDES_PHOTO.FEUILLE, ENTETES_DEMANDES_PHOTO);
  if (!f) return [];
  return f.getDataRange().getValues().map((r, i) => ({
    ligne: i + 1, id: String(r[0] || ''), date: _isoDate(r[1]), dossierId: String(r[2] || ''), apprenant: String(r[3] || ''),
    source: String(r[4] || ''), fichierId: String(r[5] || ''), controles: _jsonSur(r[6]), statut: String(r[7] || ''),
    traitePar: String(r[8] || ''), dateTraitement: _isoDate(r[9]), motif: String(r[10] || '')
  })).slice(1).filter(d => d.id);
}

function _ecrireDemandePhoto(d, valeurs) {
  const f = _feuilleFormation(DEMANDES_PHOTO.FEUILLE, ENTETES_DEMANDES_PHOTO);
  Object.keys(valeurs).forEach(c => f.getRange(d.ligne, Number(c) + 1).setValue(valeurs[c]));
}

function _etatDemandesApprenant(dossierId) {
  const miennes = _lireDemandesPhoto().filter(d => d.dossierId === dossierId);
  const depuis = Date.now() - 365 * 86400000;
  const surUnAn = miennes.filter(d => d.statut !== 'Annulée' && new Date(d.date).getTime() >= depuis);
  const triees = miennes.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    enAttente: triees.filter(d => d.statut === 'En attente')[0] || null,
    derniere: triees.filter(d => d.statut === 'Validée' || d.statut === 'Refusée')[0] || null,
    restantes: Math.max(0, DEMANDES_PHOTO.PAR_AN - surUnAn.length),
    prochaineLe: surUnAn.length >= DEMANDES_PHOTO.PAR_AN
      ? _dateIso(new Date(Math.min.apply(null, surUnAn.map(d => new Date(d.date).getTime())) + 365 * 86400000)) : ''
  };
}

// Contrôles mesurés par la page (indicatifs, affichés à l'admin).
function _normaliserControles(c) {
  const o = c && typeof c === 'object' ? c : {};
  const n = (v, min, max) => { const x = Number(v); return isFinite(x) ? Math.max(min, Math.min(max, Math.round(x))) : null; };
  return { luminosite: n(o.luminosite, 0, 255), nettete: n(o.nettete, 0, 100000), fond: n(o.fond, 0, 255), fondEcart: n(o.fondEcart, 0, 255),
    avertissements: (Array.isArray(o.avertissements) ? o.avertissements : []).map(x => _txtF(x, 80)).slice(0, 5) };
}

function photoDemandeEtat(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const e = _etatDemandesApprenant(session.apprenant.id);
  return reponseJSON({ status: 'success',
    enAttente: e.enAttente ? { id: e.enAttente.id, date: e.enAttente.date, source: e.enAttente.source } : null,
    derniere: e.derniere ? { statut: e.derniere.statut, date: e.derniere.dateTraitement, motif: e.derniere.statut === 'Refusée' ? e.derniere.motif : '' } : null,
    restantes: e.restantes, prochaineLe: e.prochaineLe });
}

function photoDemandeEnvoyer(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const a = session.apprenant;
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const e = _etatDemandesApprenant(a.id);
    if (e.enAttente) return reponseJSON({ status: 'error', message: 'Une demande est déjà en cours de validation. Patientez ou annulez-la.' });
    if (e.restantes <= 0) return reponseJSON({ status: 'error', message: 'Vous avez atteint la limite de ' + DEMANDES_PHOTO.PAR_AN + ' demandes sur 12 mois. Prochaine demande possible le ' + _jjmmaaaa(e.prochaineLe) + ', ou adressez-vous à l\'administration.' });
    const source = DEMANDES_PHOTO.SOURCES.indexOf(data.source) !== -1 ? data.source : 'Import';
    const photo = _preparerPhotoIdentite(data.photoBase64, data.photoMime);
    if (photo.erreur) return reponseJSON({ status: 'error', message: photo.erreur });
    // Fichier PRIVÉ tant que l'administration n'a pas validé.
    const dossier = dossierApprenantDrive(a.id, a.prenom, a.nom);
    const sous = _sousDossierActif(dossier, DEMANDES_PHOTO.DOSSIER) || dossier.createFolder(DEMANDES_PHOTO.DOSSIER);
    const horodatage = Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd_HHmm');
    const fichier = sous.createFile(Utilities.newBlob(photo.octets, photo.mime, 'demande-photo_' + a.id + '_' + horodatage + '.' + photo.ext));
    const id = 'PH-' + Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
    _ajouterLignes(_feuilleFormation(DEMANDES_PHOTO.FEUILLE, ENTETES_DEMANDES_PHOTO),
      [[id, new Date(), a.id, (a.prenom + ' ' + a.nom).trim(), source, fichier.getId(), JSON.stringify(_normaliserControles(data.controles)), 'En attente', '', '', '']]);
    try {
      GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, 'Photo à valider : ' + a.prenom + ' ' + a.nom, 'Nouvelle demande de photo d\'identité. Admin > Demandes de photo.', {
        htmlBody: _gabaritBesoins('Administration — LQD Service', 'Nouvelle photo d\'identité à valider',
          `<p><strong>${a.prenom} ${a.nom}</strong> (dossier ${a.id}) a envoyé une nouvelle photo d'identité (${source === 'Caméra' ? 'prise avec la caméra' : '<strong>fichier importé</strong>'}).</p><p>Comparez-la avec la photo actuelle avant de valider : <strong>Admin > Demandes de photo</strong>.</p>`),
        name: CONFIG.EXPEDITEUR_NOM });
    } catch (x) { console.error('[photoDemandeEnvoyer] email admin', x.toString()); }
    return reponseJSON({ status: 'success', message: 'Photo envoyée. L\'administration va la vérifier ; vous serez prévenu(e) par email.' });
  } finally {
    verrou.releaseLock();
  }
}

function photoDemandeAnnuler(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const d = _etatDemandesApprenant(session.apprenant.id).enAttente;
  if (!d) return reponseJSON({ status: 'error', message: 'Aucune demande en cours.' });
  _ecrireDemandePhoto(d, { 7: 'Annulée', 8: 'Apprenant', 9: new Date() });
  const f = _fichierValide(d.fichierId);
  if (f) f.setTrashed(true);
  return reponseJSON({ status: 'success', message: 'Demande annulée.' });
}

/* ---------------------------- Côté admin ---------------------------- */

function adminPhotoDemandesLister(data, email) {
  const ordre = { 'En attente': 0, 'Refusée': 1, 'Validée': 1, 'Annulée': 2 };
  const liste = _lireDemandesPhoto().sort((a, b) => (ordre[a.statut] - ordre[b.statut]) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 200).map(d => ({ id: d.id, date: d.date, dossierId: d.dossierId, apprenant: d.apprenant, source: d.source,
      controles: d.controles, statut: d.statut, traitePar: d.traitePar, dateTraitement: d.dateTraitement, motif: d.motif }));
  return reponseJSON({ status: 'success', demandes: liste, enAttente: liste.filter(d => d.statut === 'En attente').length });
}

// La photo demandée est privée : on l'envoie à l'admin en données (pas de lien public).
function adminPhotoDemandeGet(data, email) {
  const d = _lireDemandesPhoto().filter(x => x.id === String(data.id || ''))[0];
  if (!d) return reponseJSON({ status: 'error', message: 'Demande introuvable.' });
  const f = _fichierValide(d.fichierId);
  const row = _ligneApprenant(d.dossierId);
  return reponseJSON({ status: 'success', demande: {
    id: d.id, date: d.date, dossierId: d.dossierId, apprenant: d.apprenant, source: d.source, controles: d.controles, statut: d.statut, motif: d.motif,
    photo: f ? 'data:' + (f.getBlob().getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes()) : '',
    photoActuelle: row && _idDriveDepuisLien(row[32]) ? _miniatureDrive(_idDriveDepuisLien(row[32]), 400) : '',
    email: row ? String(row[10] || '') : '', telephone: row ? String(row[9] || '') : '' } });
}

function adminPhotoDemandeTraiter(data, email) {
  const d = _lireDemandesPhoto().filter(x => x.id === String(data.id || ''))[0];
  if (!d) return reponseJSON({ status: 'error', message: 'Demande introuvable.' });
  if (d.statut !== 'En attente') return reponseJSON({ status: 'error', message: 'Cette demande a déjà été traitée (' + d.statut + ').' });
  const motif = _txtF(data.motif, PHOTOS.MOTIF_MAX);
  const row = _ligneApprenant(d.dossierId);
  if (!row) return reponseJSON({ status: 'error', message: 'Dossier ' + d.dossierId + ' introuvable.' });

  if (data.decision === 'Validée') {
    const f = _fichierValide(d.fichierId);
    if (!f) return reponseJSON({ status: 'error', message: 'Le fichier de la demande est introuvable sur Drive.' });
    const ext = /\.png$/i.test(f.getName()) ? 'png' : 'jpg';
    const r = _remplacerPhotoApprenant(row, f, ext, motif || 'Nouvelle photo envoyée depuis votre espace apprenant et validée par l\'administration.', email);
    _ecrireDemandePhoto(d, { 7: 'Validée', 8: email, 9: new Date(), 10: motif });
    return reponseJSON({ status: 'success', emailEnvoye: r.emailEnvoye,
      message: r.emailEnvoye ? 'Photo validée et appliquée. L\'apprenant est prévenu par email.' : 'Photo validée et appliquée. Pas d\'email : prévenez l\'apprenant par téléphone.' });
  }
  if (data.decision === 'Refusée') {
    if (motif.length < 5) return reponseJSON({ status: 'error', message: 'Indiquez le motif du refus : il est envoyé à l\'apprenant pour qu\'il refasse une bonne photo.' });
    _ecrireDemandePhoto(d, { 7: 'Refusée', 8: email, 9: new Date(), 10: motif });
    const f = _fichierValide(d.fichierId);
    if (f) f.setTrashed(true);
    const mail = String(row[10] || '').trim().toLowerCase();
    let emailEnvoye = false;
    if (_emailValide(mail)) {
      try {
        const corps = `<p>Bonjour ${row[2] || ''},</p><p>La photo d'identité que vous avez envoyée depuis votre espace apprenant <strong>n'a pas été retenue</strong>.</p><p><strong>Motif :</strong> ${motif}</p><p>Vous pouvez envoyer une nouvelle photo depuis votre espace (Mes documents > Mettre à jour ma photo) : visage de face, bien éclairé, sur fond clair, sans lunettes de soleil ni couvre-chef.</p><p style="margin:18px 0 0;"><a href="${CONFIG.SITE_URL}/espace-apprenant" style="display:inline-block;background:${CONFIG.COULEUR_TEAL};color:#FFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Ouvrir mon espace apprenant</a></p>`;
        GmailApp.sendEmail(mail, 'Votre nouvelle photo d\'identité n\'a pas été retenue', corps.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), {
          htmlBody: _gabaritBesoins('Espace apprenant — LQD Service', 'Photo d\'identité non retenue', corps), name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL });
        emailEnvoye = true;
      } catch (e) { console.error('[adminPhotoDemandeTraiter] email refus', e.toString()); }
    }
    return reponseJSON({ status: 'success', emailEnvoye: emailEnvoye,
      message: emailEnvoye ? 'Demande refusée. L\'apprenant reçoit le motif par email.' : 'Demande refusée. Pas d\'email : prévenez l\'apprenant par téléphone.' });
  }
  return reponseJSON({ status: 'error', message: 'Décision inconnue.' });
}

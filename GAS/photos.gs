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

function adminChangerPhoto(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'Dossier manquant.' });
  const photo = _preparerPhotoIdentite(data.photoBase64, data.photoMime);
  if (photo.erreur) return reponseJSON({ status: 'error', message: photo.erreur });
  const motif = _txtF(data.motif, PHOTOS.MOTIF_MAX);

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return reponseJSON({ status: 'error', message: 'Classeur introuvable.' });
  const row = feuille.getDataRange().getValues().filter(r => String(r[0]).trim() === id)[0];
  if (!row) return reponseJSON({ status: 'error', message: 'Dossier ' + id + ' introuvable.' });

  const prenom = String(row[2] || ''), nom = String(row[3] || '');
  const ancienneUrl = String(row[32] || '');
  const horodatage = Utilities.formatDate(new Date(), 'Africa/Porto-Novo', 'yyyy-MM-dd_HHmm');

  // 1. Nouvelle photo dans le dossier de l'apprenant (lisible : carte, attestation, badge)
  const dossier = dossierApprenantDrive(id, prenom, nom, row[1]);
  const fichier = dossier.createFile(Utilities.newBlob(photo.octets, photo.mime, 'photo-identite_' + id + '_' + horodatage + '.' + photo.ext));
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const nouvelleUrl = fichier.getUrl();

  // 2. Ancienne photo : gardée en privé dans "Anciennes photos" (rien n'est supprimé)
  const ancien = _fichierValide(_idDriveDepuisLien(ancienneUrl));
  if (ancien) {
    try {
      const archive = _sousDossierActif(dossier, PHOTOS.DOSSIER_ARCHIVE) || dossier.createFolder(PHOTOS.DOSSIER_ARCHIVE);
      ancien.moveTo(archive);
      ancien.setName('ancienne-photo_' + id + '_remplacee-le-' + horodatage + '.' + (ancien.getName().split('.').pop() || 'jpg'));
      _rendrePrive(ancien);
    } catch (e) { console.error('[adminChangerPhoto] archive', e.toString()); }
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
    catch (e) { console.error('[adminChangerPhoto] email', e.toString()); }
  }

  // 5. Journal
  try {
    const j = _feuilleFormation(PHOTOS.FEUILLE, ENTETES_HISTORIQUE_PHOTOS);
    _ajouterLignes(j, [[new Date(), id, (prenom + ' ' + nom).trim(), ancienneUrl, nouvelleUrl, motif, email, emailEnvoye ? 'Envoyé à ' + mail : 'Pas d\'email']]);
  } catch (e) { console.error('[adminChangerPhoto] journal', e.toString()); }

  return reponseJSON({ status: 'success', photoUrl: nouvelleUrl, emailEnvoye: emailEnvoye, telephone: String(row[9] || ''),
    message: emailEnvoye ? 'Photo mise à jour. L\'apprenant est prévenu par email.'
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

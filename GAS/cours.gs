// ================================================================
// SUPPORTS DE COURS — Espace apprenant
// Créé le 25/09/2026 (bibliothèque de liens par filière).
//
// Refonte d'octobre 2026 (audit "cours en ligne", points 2 à 7) :
//  - Lecture DANS le site : la liste envoyée à l'apprenant ne contient
//    plus aucune adresse. Le lien de lecture n'est donné qu'au clic
//    (action cours_ouvrir), après vérification de la session.
//  - Session apprenant limitée à 8 h et coupée si le dossier n'est plus
//    actif (Annulé, Rejeté...) ou si l'admin bloque l'espace apprenant.
//  - Modules + ordre d'affichage, modification d'un support.
//  - Envoi direct d'un fichier (PDF ou vidéo) depuis l'admin : rangé et
//    partagé automatiquement sur Drive.
//  - Prévenir par email les apprenants de la filière (facultatif).
//  - Suivi des consultations : qui a ouvert quoi, et quand.
//
// LIMITE ASSUMÉE : on rend la diffusion plus difficile, pas impossible
// (capture d'écran, outils développeur). Pour des vidéos réellement
// protégées, il faut un hébergeur payant (Vimeo Pro, Bunny Stream).
// ================================================================

const COURS = {
  NOM_FEUILLE:          'Cours',
  NOM_FEUILLE_VUES:     'Consultations cours',
  DOSSIER_DRIVE:        'Cours — LQD Service',
  FICHIER_MAX_OCTETS:   25 * 1024 * 1024,   // au-delà : YouTube "non répertoriée"
  TYPES_FICHIER:        { 'application/pdf': 'PDF', 'video/mp4': 'Vidéo', 'video/webm': 'Vidéo', 'video/quicktime': 'Vidéo' },
  SESSION_HEURES:       8,
  STATUTS_ACTIFS:       ['Confirmé', 'Migré', 'Terminé'],
  TITRE_MAX:            150,
  DESCRIPTION_MAX:      300,
  MODULE_MAX:           80
};

// Colonnes H à J ajoutées en octobre 2026 : les anciennes lignes restent
// valides (module vide = "Autres supports", ordre 0).
const ENTETES_COURS = [
  'ID', 'Filière', 'Titre', 'Type', 'URL', 'Description', 'Date ajout',
  'Module', 'Ordre', 'Fichier ID'
];
const ENTETES_CONSULTATIONS = ['Date', 'Dossier ID', 'Apprenant', 'Filière', 'Cours ID', 'Titre'];

function _getOrCreateFeuilleCours() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName(COURS.NOM_FEUILLE);
  if (!feuille) {
    feuille = ss.insertSheet(COURS.NOM_FEUILLE);
    feuille.appendRow(ENTETES_COURS);
    feuille.setFrozenRows(1);
    return feuille;
  }
  // Feuille créée avant la refonte : on ajoute les en-têtes manquants.
  const nbCols = feuille.getLastColumn();
  if (nbCols < ENTETES_COURS.length) {
    const manquantes = ENTETES_COURS.slice(nbCols);
    feuille.getRange(1, nbCols + 1, 1, manquantes.length).setValues([manquantes]);
  }
  return feuille;
}

function _getOrCreateFeuilleConsultations() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let feuille = ss.getSheetByName(COURS.NOM_FEUILLE_VUES);
  if (!feuille) {
    feuille = ss.insertSheet(COURS.NOM_FEUILLE_VUES);
    feuille.appendRow(ENTETES_CONSULTATIONS);
    feuille.setFrozenRows(1);
  }
  return feuille;
}

function _ligneVersCours(row) {
  return {
    id:          String(row[0] || ''),
    filiere:     String(row[1] || '').trim(),
    titre:       String(row[2] || ''),
    type:        String(row[3] || ''),
    url:         String(row[4] || ''),
    description: String(row[5] || ''),
    dateAjout:   row[6] instanceof Date ? row[6].toISOString() : String(row[6] || ''),
    module:      String(row[7] || '').trim(),
    ordre:       Number(row[8]) || 0,
    fileId:      String(row[9] || '')
  };
}

function _lireCours() {
  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return null;
  return feuille.getDataRange().getValues().slice(1).filter(r => r[0]).map(_ligneVersCours);
}

// Tri : module (ordre naturel : "Module 2" avant "Module 10"), puis ordre,
// puis le plus récent. Les supports sans module passent en dernier.
function _trierCours(liste) {
  return liste.sort((a, b) => {
    if (!a.module !== !b.module) return a.module ? -1 : 1;
    const m = a.module.localeCompare(b.module, 'fr', { numeric: true, sensitivity: 'base' });
    if (m) return m;
    if (a.ordre !== b.ordre) return a.ordre - b.ordre;
    return String(b.dateAjout).localeCompare(String(a.dateAjout));
  });
}

// Texte saisi : balises neutralisées, longueur contrôlée (jamais coupé en silence).
function _texteCours(str, max) {
  return String(str || '').replace(/\r\n/g, '\n').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, max);
}

function _filieresApprenant(filiereAffichee) {
  return String(filiereAffichee || '').split(' | ').map(f => f.trim()).filter(Boolean);
}

function _apprenantPeutVoir(cours, mesCles) {
  return cours.filiere === 'Tous' || mesCles.indexOf(cleFiliere(cours.filiere)) !== -1;
}

/* ------------------------------------------------------------------
   SESSION APPRENANT — utilisée par les cours ET le forum.
   Le jeton signé (carte.gs) prouve l'identité ; on y ajoute :
   - une durée de vie de 8 h ;
   - le contrôle du dossier EN DIRECT (un dossier Annulé perd l'accès
     immédiatement, même avec un jeton encore valide) ;
   - l'interrupteur admin "Accès espace apprenant".
   La filière est relue dans le dossier (source de vérité), pas dans le jeton.
------------------------------------------------------------------ */
function _sessionApprenant(token) {
  const expiree = { erreur: 'Votre session a expiré. Reconnectez-vous à votre espace apprenant.', sessionExpiree: true };
  const payload = _verifierTokenCarte(String(token || ''));
  if (!payload) return expiree;
  const emis = Date.parse(payload.emis || '');
  if (!emis || Date.now() - emis > COURS.SESSION_HEURES * 3600 * 1000) return expiree;

  if (PropertiesService.getScriptProperties().getProperty('TELECHARGEMENT_BLOQUE') === 'true') {
    return { erreur: 'L\'espace apprenant est momentanément fermé. Merci de réessayer plus tard.', sessionExpiree: true };
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return { erreur: 'Erreur serveur.' };
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() !== String(payload.id)) continue;
    const statut = String(donnees[i][28] || '').trim();
    if (COURS.STATUTS_ACTIFS.indexOf(statut) === -1) {
      return { erreur: 'Votre accès aux cours est suspendu. Contactez le centre au 01 97 95 12 30.', sessionExpiree: true };
    }
    const apprenant = _mapperApprenantInscription(donnees[i]);
    const dateFinIso = _dateIso(apprenant.dateFin);
    return { apprenant: apprenant, statut: statut, dateFinIso: dateFinIso,
             phase: _phaseApprenant(statut, _dateIso(apprenant.dateEntree), dateFinIso) };
  }
  return expiree;
}

// Règle d'octobre 2026 : un ANCIEN apprenant (formation terminée) garde
// les supports publiés jusqu'à sa date de fin, mais ne reçoit plus les
// supports publiés après (ni l'email de nouveau support).
function _coursAccessible(c, session, mesCles) {
  if (!_apprenantPeutVoir(c, mesCles)) return false;
  if (session.phase !== 'termine' || !session.dateFinIso) return true;
  const ajout = _dateIso(c.dateAjout);
  return !ajout || ajout <= session.dateFinIso;
}

function _reponseSession(session) {
  return reponseJSON({ status: 'error', message: session.erreur, sessionExpiree: !!session.sessionExpiree });
}

/* ------------------------------------------------------------------
   LECTURE INTÉGRÉE — calcule l'adresse à afficher dans la visionneuse
   du site. Drive : lecteur "preview" ; YouTube : youtube-nocookie ;
   autre site : simple lien (impossible à intégrer proprement).
------------------------------------------------------------------ */
function _idDriveCours(c) {
  if (c.fileId) return c.fileId;
  const m = String(c.url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
  return m ? m[1] : '';
}

function _idYoutube(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : '';
}

function _lectureCours(c) {
  const idDrive = _idDriveCours(c);
  if (idDrive) return { mode: 'integre', src: 'https://drive.google.com/file/d/' + idDrive + '/preview' };
  const idYt = _idYoutube(c.url);
  if (idYt) return { mode: 'integre', src: 'https://www.youtube-nocookie.com/embed/' + idYt + '?rel=0&modestbranding=1' };
  return { mode: 'lien', src: c.url };
}

/* ---------------- Public (apprenant) ---------------- */

// Liste SANS adresse : le lien n'est jamais visible dans la page.
function coursListerApprenant(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);

  const tous = _lireCours();
  if (!tous) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const mesCles = clesFilieres(session.apprenant.filiere);
  const cours = _trierCours(tous.filter(c => _coursAccessible(c, session, mesCles))).map(c => ({
    id:          c.id,
    titre:       c.titre,
    type:        c.type,
    description: c.description,
    module:      c.module,
    dateAjout:   c.dateAjout,
    mode:        _lectureCours(c).mode
  }));
  return reponseJSON({ status: 'success', cours: cours,
    formationTerminee: session.phase === 'termine', dateFin: session.dateFinIso });
}

// Ouverture d'un support : contrôle d'accès + enregistrement de la consultation.
function coursOuvrir(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);

  const id = String(data.id || '').trim();
  const tous = _lireCours() || [];
  const c = tous.filter(x => x.id === id)[0];
  if (!c || !_coursAccessible(c, session, clesFilieres(session.apprenant.filiere))) {
    return reponseJSON({ status: 'error', message: 'Ce support n\'est plus disponible.' });
  }

  const a = session.apprenant;
  try {
    const feuille = _getOrCreateFeuilleConsultations();
    if (feuille) feuille.appendRow([new Date(), a.id, (a.prenom + ' ' + a.nom).trim(), a.filiere, c.id, c.titre]);
  } catch (e) { console.error('[coursOuvrir] journal', e.toString()); }   // le suivi ne bloque jamais la lecture

  const lecture = _lectureCours(c);
  return reponseJSON({ status: 'success', titre: c.titre, type: c.type, mode: lecture.mode, src: lecture.src });
}

/* ---------------- Admin ---------------- */

function _statsConsultations() {
  const feuille = _getOrCreateFeuilleConsultations();
  const stats = {};
  if (!feuille) return stats;
  feuille.getDataRange().getValues().slice(1).forEach(r => {
    const id = String(r[4] || '');
    if (!id) return;
    if (!stats[id]) stats[id] = { vues: 0, apprenants: {} };
    stats[id].vues++;
    stats[id].apprenants[String(r[1])] = true;
  });
  return stats;
}

function adminCoursLister(data, email) {
  const tous = _lireCours();
  if (!tous) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const stats = _statsConsultations();
  const cours = _trierCours(tous).map(c => {
    const s = stats[c.id];
    return Object.assign({}, c, { vues: s ? s.vues : 0, apprenantsDistincts: s ? Object.keys(s.apprenants).length : 0 });
  });
  const modules = cours.map(c => c.module).filter((m, i, t) => m && t.indexOf(m) === i);
  return reponseJSON({ status: 'success', cours: cours, modules: modules });
}

// Contrôle commun ajout / modification. Renvoie { valeurs } ou { erreur }.
function _validerChampsCours(data) {
  const filiere = String(data.filiere || '').trim();
  const valides = CONFIG.FORMATIONS_VALIDES.concat(['Tous']);
  if (valides.indexOf(filiere) === -1) return { erreur: 'Filière inconnue.' };
  const titre = _texteCours(data.titre, COURS.TITRE_MAX + 1);
  if (!titre) return { erreur: 'Le titre est obligatoire.' };
  if (titre.length > COURS.TITRE_MAX) return { erreur: 'Titre trop long (' + COURS.TITRE_MAX + ' caractères maximum).' };
  const description = _texteCours(data.description, COURS.DESCRIPTION_MAX + 1);
  if (description.length > COURS.DESCRIPTION_MAX) return { erreur: 'Description trop longue (' + COURS.DESCRIPTION_MAX + ' caractères maximum).' };
  const module = _texteCours(data.module, COURS.MODULE_MAX + 1);
  if (module.length > COURS.MODULE_MAX) return { erreur: 'Nom de module trop long (' + COURS.MODULE_MAX + ' caractères maximum).' };
  const type = ['PDF', 'Vidéo', 'Lien'].indexOf(data.type) !== -1 ? data.type : 'Lien';
  const ordre = Math.max(-999, Math.min(999, Math.round(Number(data.ordre) || 0)));
  return { valeurs: { filiere: filiere, titre: titre, description: description, module: module, type: type, ordre: ordre } };
}

// Seules les adresses https sont acceptées (bloque javascript:, data:...).
function _urlCoursValide(url) {
  return /^https:\/\/[^\s<>"']{4,1990}$/i.test(String(url || '').trim());
}

// Fichier envoyé depuis l'admin : type vérifié sur le contenu réel.
function _preparerFichierCours(f) {
  const mime = String(f.mimeType || '').toLowerCase();
  if (!COURS.TYPES_FICHIER[mime]) return { erreur: 'Fichier non accepté : PDF, MP4, WEBM ou MOV uniquement.' };
  let octets;
  try { octets = Utilities.base64Decode(String(f.base64 || '')); }
  catch (e) { return { erreur: 'Fichier illisible (données corrompues).' }; }
  if (!octets.length) return { erreur: 'Fichier vide.' };
  if (octets.length > COURS.FICHIER_MAX_OCTETS) return { erreur: 'Fichier trop lourd (25 Mo maximum). Pour une vidéo plus longue : mettez-la sur YouTube en "non répertoriée" et collez le lien.' };
  const b = octets.slice(0, 12).map(x => (x + 256) % 256);
  const ftyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;     // MP4 / MOV
  const signatureOk = {
    'application/pdf': b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
    'video/mp4':       ftyp,
    'video/quicktime': ftyp || (b[4] === 0x6D && b[5] === 0x6F && b[6] === 0x6F && b[7] === 0x76),
    'video/webm':      b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3
  }[mime];
  if (!signatureOk) return { erreur: 'Le contenu du fichier ne correspond pas à son type (PDF ou vidéo attendu).' };
  const nom = String(f.nom || 'support').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').trim().slice(0, 100) || 'support';
  return { blob: Utilities.newBlob(octets, mime, nom), type: COURS.TYPES_FICHIER[mime] };
}

function _enregistrerFichierCours(blob, filiere) {
  const racine = trouverDossierDrive(COURS.DOSSIER_DRIVE) || DriveApp.createFolder(COURS.DOSSIER_DRIVE);
  const sousDossier = trouverSousDossier(racine, filiere) || racine.createFolder(filiere);
  const fichier = sousDossier.createFile(blob);
  // Lecture avec le lien : indispensable au lecteur intégré du site.
  fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // Masque Télécharger / Imprimer / Copier dans le lecteur Drive. Nécessite
  // le service avancé "Drive API" (Éditeur > Services > + > Drive API).
  // Sans lui, le support reste lisible : seule cette protection manque.
  try {
    if (typeof Drive !== 'undefined') Drive.Files.update({ copyRequiresWriterPermission: true }, fichier.getId());
  } catch (e) { console.warn('[Cours] protection téléchargement non appliquée :', e.message); }
  return fichier.getId();
}

// Email groupé (copie cachée) aux apprenants actifs de la filière.
function _notifierNouveauCours(c) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return { envoyes: 0, avertissement: 'Classeur des inscriptions introuvable.' };
  const emails = [];
  feuille.getDataRange().getValues().slice(1).forEach(r => {
    const statut = String(r[28] || '').trim();
    const mail = String(r[10] || '').trim().toLowerCase();
    if (COURS.STATUTS_ACTIFS.indexOf(statut) === -1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return;
    // Anciens apprenants : pas d'email pour un support publié après leur formation.
    const m = _mapperApprenantInscription(r);
    if (_phaseApprenant(statut, _dateIso(m.dateEntree), _dateIso(m.dateFin)) === 'termine') return;
    if (c.filiere !== 'Tous' && clesFilieres(String(r[22] || '')).indexOf(cleFiliere(c.filiere)) === -1) return;
    if (emails.indexOf(mail) === -1) emails.push(mail);
  });
  if (!emails.length) return { envoyes: 0, avertissement: 'Aucun apprenant actif avec une adresse email dans cette filière.' };
  if (MailApp.getRemainingDailyQuota() < emails.length) {
    return { envoyes: 0, avertissement: 'Quota d\'emails Gmail du jour insuffisant (' + emails.length + ' destinataires) : prévenez les apprenants par WhatsApp.' };
  }
  const sujet = 'Nouveau support de cours : ' + c.titre.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const corps = '<p style="margin:0 0 14px;">Un nouveau support vient d\'être mis en ligne pour votre formation :</p>'
    + '<p style="margin:0 0 6px;font-size:17px;font-weight:700;color:' + CONFIG.COULEUR_DARK + ';">' + c.titre + '</p>'
    + (c.module ? '<p style="margin:0 0 6px;color:#6B7280;">' + c.module + '</p>' : '')
    + (c.description ? '<p style="margin:0 0 14px;">' + c.description + '</p>' : '')
    + '<p style="margin:18px 0 0;"><a href="' + CONFIG.SITE_URL + '/espace-apprenant" style="display:inline-block;background:' + CONFIG.COULEUR_TEAL + ';color:#FFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Ouvrir mon espace apprenant</a></p>';
  GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, sujet, 'Nouveau support : ' + sujet + ' — ' + CONFIG.SITE_URL + '/espace-apprenant', {
    bcc: emails.join(','),
    htmlBody: construireEmailReponseAdmin('Formation', 'à toutes et à tous', 'Nouveau support de cours', corps, c.filiere === 'Tous' ? 'Tous' : nomAffichagePublic(c.filiere)),
    name: CONFIG.EXPEDITEUR_NOM,
    replyTo: CONFIG.ADMIN_EMAIL
  });
  return { envoyes: emails.length };
}

function adminCoursAjouter(data, email) {
  const v = _validerChampsCours(data);
  if (v.erreur) return reponseJSON({ status: 'error', message: v.erreur });
  const c = v.valeurs;

  let url = String(data.url || '').trim();
  let fileId = '';
  if (data.fichier && data.fichier.base64) {
    const f = _preparerFichierCours(data.fichier);
    if (f.erreur) return reponseJSON({ status: 'error', message: f.erreur });
    try { fileId = _enregistrerFichierCours(f.blob, c.filiere); }
    catch (e) { return reponseJSON({ status: 'error', message: 'Enregistrement sur Drive impossible : ' + e.message }); }
    url = 'https://drive.google.com/file/d/' + fileId + '/view';
    c.type = f.type;
  } else if (!_urlCoursValide(url)) {
    return reponseJSON({ status: 'error', message: 'Joignez un fichier ou collez un lien commençant par https://' });
  }

  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const id = genererID('COURS');
  feuille.appendRow([id, c.filiere, c.titre, c.type, url, c.description, new Date(), c.module, c.ordre, fileId]);
  console.log('[Cours] Ajouté par', email, ':', id, c.titre);

  let notification = null;
  if (data.notifier === true) {
    try { notification = _notifierNouveauCours(c); }
    catch (e) { notification = { envoyes: 0, avertissement: 'Emails non envoyés : ' + e.message }; }
  }
  return reponseJSON({ status: 'success', id: id, notification: notification });
}

function adminCoursModifier(data, email) {
  const id = String(data.id || '').trim();
  const v = _validerChampsCours(data);
  if (v.erreur) return reponseJSON({ status: 'error', message: v.erreur });
  const c = v.valeurs;

  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() !== id) continue;
    const actuel = _ligneVersCours(donnees[i]);
    // Support envoyé comme fichier : le lien et le type restent ceux du fichier.
    let url = actuel.url, type = c.type;
    if (actuel.fileId) type = actuel.type;
    else {
      url = String(data.url || '').trim();
      if (!_urlCoursValide(url)) return reponseJSON({ status: 'error', message: 'Le lien doit commencer par https://' });
    }
    // Colonnes B à F (filière, titre, type, URL, description) puis H-I (module, ordre).
    feuille.getRange(i + 1, 2, 1, 5).setValues([[c.filiere, c.titre, type, url, c.description]]);
    feuille.getRange(i + 1, 8, 1, 2).setValues([[c.module, c.ordre]]);
    console.log('[Cours] Modifié par', email, ':', id);
    return reponseJSON({ status: 'success' });
  }
  return reponseJSON({ status: 'error', message: 'Support introuvable.' });
}

function adminCoursSupprimer(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const feuille = _getOrCreateFeuilleCours();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      // Fichier envoyé depuis l'admin : mis à la corbeille Drive (récupérable 30 jours).
      _supprimerFichierDrive(String(donnees[i][9] || ''));
      feuille.deleteRow(i + 1);
      console.log('[Cours] Supprimé par', email, ':', id);
      return reponseJSON({ status: 'success' });
    }
  }
  return reponseJSON({ status: 'error', message: 'Support introuvable.' });
}

// Détail des consultations d'un support (plus récentes d'abord).
function adminCoursConsultations(data, email) {
  const id = String(data.id || '').trim();
  const feuille = _getOrCreateFeuilleConsultations();
  if (!feuille) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });
  const consultations = feuille.getDataRange().getValues().slice(1)
    .filter(r => String(r[4]) === id)
    .map(r => ({
      date:      r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''),
      dossierId: String(r[1] || ''),
      nom:       String(r[2] || ''),
      filiere:   String(r[3] || '')
    }))
    .reverse();
  return reponseJSON({ status: 'success', consultations: consultations });
}

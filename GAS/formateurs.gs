// ================================================================
// ESPACE FORMATEUR (octobre 2026)
//
// Principe : chaque formateur a SON compte (créé par l'admin) et ne
// voit que les filières qui lui sont attribuées. Il n'a jamais accès
// aux paiements, pièces d'identité, filiation, candidatures ni réglages.
//
// Connexion : email + mot de passe + code à 6 chiffres reçu par email.
// - Mots de passe jamais stockés en clair : empreinte HMAC-SHA256 salée
//   et itérée, rangée dans les Propriétés du script (pas dans Sheets).
// - Secret de signature des sessions généré automatiquement au premier
//   usage (Propriétés du script), jamais écrit dans le code.
// - Session 8 h ; compte relu à CHAQUE action (désactivation immédiate).
// - Anti-essais : 5 échecs par email et par 15 min.
//
// Modules : Mes apprenants, Présences, Notes & évaluations, Cours +
// Questions (réutilise cours.gs et forum.gs avec contrôle de filière).
// Côté apprenant : notes publiées + assiduité (apprenantSuivi).
// ================================================================

const FORMATEURS = {
  FEUILLE:            'Formateurs',
  FEUILLE_PRESENCES:  'Présences',
  FEUILLE_EVALS:      'Évaluations',
  FEUILLE_NOTES:      'Notes',
  SESSION_HEURES:     8,
  OTP_MINUTES:        10,
  INVITATION_HEURES:  72,
  RESET_HEURES:       1,
  MDP_MIN:            8,
  ITERATIONS:         300,
  ECHECS_MAX:         5,
  STATUTS_PRESENCE:   ['Présent', 'Absent', 'Retard', 'Excusé'],
  STATUTS_APPRENANT:  ['Confirmé', 'Migré', 'Terminé']
};

const ENTETES_FORMATEURS = ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Filières', 'Statut', 'Créé le', 'Dernière connexion'];
const ENTETES_PRESENCES  = ['Séance ID', 'Date séance', 'Filière', 'Intitulé', 'Formateur', 'Dossier ID', 'Apprenant', 'Statut', 'Remarque', 'Saisi le'];
const ENTETES_EVALS      = ['ID', 'Date', 'Filière', 'Intitulé', 'Barème', 'Coefficient', 'Formateur', 'Publiée', 'Créée le'];
const ENTETES_NOTES      = ['Évaluation ID', 'Dossier ID', 'Apprenant', 'Note', 'Appréciation'];

/* ============================ OUTILS ============================ */

function _feuilleFormation(nom, entetes) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  let f = ss.getSheetByName(nom);
  if (!f) {
    f = ss.insertSheet(nom);
    f.appendRow(entetes);
    f.getRange(1, 1, 1, entetes.length).setBackground(CONFIG.COULEUR_DARK).setFontColor('#FFFFFF').setFontWeight('bold');
    f.setFrozenRows(1);
  }
  return f;
}

// Ajoute plusieurs lignes d'un coup en agrandissant la feuille si besoin
// (setValues hors des dimensions de la feuille échoue au-delà de 1 000 lignes).
function _ajouterLignes(feuille, lignes) {
  if (!lignes.length) return;
  const debut = feuille.getLastRow() + 1;
  const manque = debut + lignes.length - 1 - feuille.getMaxRows();
  if (manque > 0) feuille.insertRowsAfter(feuille.getMaxRows(), manque);
  feuille.getRange(debut, 1, lignes.length, lignes[0].length).setValues(lignes);
}

function _txtF(str, max) {
  return String(str == null ? '' : str).replace(/\r\n/g, '\n').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, max);
}

function _emailValide(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '')); }

function _dateIso(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) {
    const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);   // jj/mm/aaaa
    return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }
  return Utilities.formatDate(d, 'Africa/Porto-Novo', 'yyyy-MM-dd');
}

function _props() { return PropertiesService.getScriptProperties(); }

function _secretFormateur() {
  let s = _props().getProperty('FORMATEUR_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); _props().setProperty('FORMATEUR_SECRET', s); }
  return s;
}

function _b64(bytes) { return Utilities.base64EncodeWebSafe(bytes); }

function _empreinteMdp(mdp, sel) {
  let h = Utilities.computeHmacSha256Signature(String(mdp), sel);
  for (let i = 0; i < FORMATEURS.ITERATIONS; i++) h = Utilities.computeHmacSha256Signature(h.concat(Utilities.newBlob(sel).getBytes()), sel);
  return _b64(h);
}

function _cleMdp(email) { return 'FORM_MDP_' + email; }

function _definirMdp(email, mdp) {
  const sel = Utilities.getUuid();
  _props().setProperty(_cleMdp(email), JSON.stringify({ sel: sel, h: _empreinteMdp(mdp, sel) }));
}

function _verifierMdp(email, mdp) {
  const brut = _props().getProperty(_cleMdp(email));
  if (!brut) return false;
  try { const o = JSON.parse(brut); return _empreinteMdp(mdp, o.sel) === o.h; } catch (e) { return false; }
}

function _mdpRobuste(mdp) {
  const m = String(mdp || '');
  if (m.length < FORMATEURS.MDP_MIN) return 'Mot de passe trop court (' + FORMATEURS.MDP_MIN + ' caractères minimum).';
  if (!/[A-Za-z]/.test(m) || !/[0-9]/.test(m)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  if (m.length > 100) return 'Mot de passe trop long.';
  return '';
}

/* ------------------------- Comptes formateurs ------------------------- */

function _ligneVersFormateur(row, i) {
  return {
    ligne:     i + 1,
    id:        String(row[0] || ''),
    prenom:    String(row[1] || ''),
    nom:       String(row[2] || ''),
    email:     String(row[3] || '').trim().toLowerCase(),
    telephone: String(row[4] || ''),
    filieres:  String(row[5] || '').split(' | ').map(f => f.trim()).filter(Boolean),
    statut:    String(row[6] || 'Actif'),
    creeLe:    row[7] instanceof Date ? row[7].toISOString() : String(row[7] || ''),
    derniereConnexion: row[8] instanceof Date ? row[8].toISOString() : String(row[8] || '')
  };
}

function _lireFormateurs() {
  const f = _feuilleFormation(FORMATEURS.FEUILLE, ENTETES_FORMATEURS);
  if (!f) return [];
  return f.getDataRange().getValues().map(_ligneVersFormateur).slice(1).filter(x => x.id);
}

function _formateurParEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return _lireFormateurs().filter(f => f.email === e)[0] || null;
}

/* ---------------------------- Sessions ---------------------------- */

function _jetonFormateur(email) {
  const payload = _b64(Utilities.newBlob(JSON.stringify({ r: 'formateur', e: email, x: Date.now() + FORMATEURS.SESSION_HEURES * 3600000 })).getBytes());
  return payload + '.' + _b64(Utilities.computeHmacSha256Signature(payload, _secretFormateur()));
}

// Vérifie le jeton ET relit le compte (désactivation / filières à jour).
function _sessionFormateur(token) {
  const expiree = { erreur: 'Votre session a expiré. Reconnectez-vous.', sessionExpiree: true };
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return expiree;
  if (_b64(Utilities.computeHmacSha256Signature(parts[0], _secretFormateur())) !== parts[1]) return expiree;
  let p;
  try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (e) { return expiree; }
  if (p.r !== 'formateur' || !p.x || Date.now() > p.x) return expiree;
  const f = _formateurParEmail(p.e);
  if (!f || f.statut !== 'Actif') return { erreur: 'Votre compte formateur est désactivé. Contactez l\'administration.', sessionExpiree: true };
  return { formateur: f };
}

function _erreurSession(s) {
  return reponseJSON({ status: 'error', message: s.erreur, sessionExpiree: !!s.sessionExpiree });
}

// La filière (clé technique) fait-elle partie de celles du formateur ?
function _filiereAutorisee(f, filiere) {
  return f.filieres.indexOf(cleFiliere(filiere)) !== -1;
}

/* ---------------------------- Emails ---------------------------- */

function _emailFormateur(destinataire, sujet, titre, contenuHtml) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;">
  <tr><td style="background:${CONFIG.COULEUR_DARK};padding:26px 32px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;display:block;margin:0 auto 10px;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;">Espace formateur — LQD Service</h1>
  </td></tr>
  <tr><td style="padding:30px 32px;font-size:15px;color:#444;line-height:1.7;">
    <h2 style="margin:0 0 14px;font-size:17px;color:${CONFIG.COULEUR_DARK};">${titre}</h2>
    ${contenuHtml}
  </td></tr>
  <tr><td style="background:#F8FAFA;padding:16px 32px;font-size:12px;color:#6B7280;text-align:center;">
    Les Qualités de Dieu Service SARL — Comé, Bénin — +229 01 97 95 12 30
  </td></tr>
</table></td></tr></table></body></html>`;
  GmailApp.sendEmail(destinataire, sujet, contenuHtml.replace(/<[^>]+>/g, ' '), { htmlBody: html, name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL });
}

// Lien à usage unique (invitation : 72 h ; mot de passe oublié : 1 h).
function _creerLienMdp(email, heures) {
  const code = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  _props().setProperty('FORM_LIEN_' + code, JSON.stringify({ e: email, x: Date.now() + heures * 3600000 }));
  return CONFIG.SITE_URL + '/espace-formateur?code=' + code;
}

function _envoyerInvitation(f, reinitialisation) {
  const lien = _creerLienMdp(f.email, reinitialisation ? FORMATEURS.RESET_HEURES : FORMATEURS.INVITATION_HEURES);
  const bouton = `<p style="margin:22px 0;"><a href="${lien}" style="display:inline-block;background:${CONFIG.COULEUR_TEAL};color:#FFF;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:700;">${reinitialisation ? 'Choisir un nouveau mot de passe' : 'Activer mon compte'}</a></p>`;
  if (reinitialisation) {
    _emailFormateur(f.email, 'Nouveau mot de passe — Espace formateur', 'Réinitialisation du mot de passe',
      `<p>Bonjour ${f.prenom},</p><p>Vous avez demandé un nouveau mot de passe. Ce lien est valable 1 heure et ne sert qu'une fois :</p>${bouton}<p style="font-size:13px;color:#6B7280;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste valable.</p>`);
  } else {
    const fil = f.filieres.map(nomAffichagePublic).join(', ');
    _emailFormateur(f.email, 'Votre accès à l\'espace formateur', 'Bienvenue dans l\'espace formateur',
      `<p>Bonjour ${f.prenom},</p><p>Un compte formateur vient d'être créé pour vous. Filière(s) : <strong>${fil}</strong>.</p><p>Cliquez ci-dessous pour choisir votre mot de passe (lien valable 72 heures, utilisable une seule fois) :</p>${bouton}<p style="font-size:13px;color:#6B7280;">Ensuite, connectez-vous sur ${CONFIG.SITE_URL}/espace-formateur avec votre email et ce mot de passe ; un code de sécurité vous sera envoyé à chaque connexion.</p>`);
  }
}

/* ======================= CONNEXION (public) ======================= */

function _compterEchec(email) {
  const c = CacheService.getScriptCache(), k = 'FORM_ECHEC_' + email;
  c.put(k, String(Number(c.get(k) || 0) + 1), 900);
}
function _tropDEchecs(email) {
  return Number(CacheService.getScriptCache().get('FORM_ECHEC_' + email) || 0) >= FORMATEURS.ECHECS_MAX;
}

function formateurLogin(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const mdp = String(data.password || '');
  const generique = 'Email ou mot de passe incorrect.';
  if (!_emailValide(email) || !mdp) return reponseJSON({ status: 'error', message: generique });
  if (_tropDEchecs(email)) return reponseJSON({ status: 'error', message: 'Trop de tentatives. Réessayez dans 15 minutes.' });

  const f = _formateurParEmail(email);
  if (!f || f.statut !== 'Actif' || !_verifierMdp(email, mdp)) {
    _compterEchec(email);
    return reponseJSON({ status: 'error', message: generique });
  }
  const otp = genererOTP();
  _props().setProperty('FORM_OTP_' + email, JSON.stringify({ o: otp, x: Date.now() + FORMATEURS.OTP_MINUTES * 60000, n: 0 }));
  _emailFormateur(email, 'Votre code de connexion : ' + otp, 'Code de connexion',
    `<p>Votre code de connexion à l'espace formateur :</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;color:${CONFIG.COULEUR_DARK};margin:16px 0;">${otp}</p><p style="font-size:13px;color:#6B7280;">Valable ${FORMATEURS.OTP_MINUTES} minutes. Ne le communiquez à personne.</p>`);
  return reponseJSON({ status: 'otp_sent', message: 'Un code à 6 chiffres vient d\'être envoyé à ' + email + '.' });
}

function formateurVerifierOtp(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const saisi = String(data.otp || '').trim();
  const cle = 'FORM_OTP_' + email;
  const brut = _props().getProperty(cle);
  if (!brut) return reponseJSON({ status: 'error', message: 'Code expiré. Recommencez la connexion.' });
  const o = JSON.parse(brut);
  if (Date.now() > o.x || o.n >= 5) { _props().deleteProperty(cle); return reponseJSON({ status: 'error', message: 'Code expiré. Recommencez la connexion.' }); }
  if (saisi !== o.o) {
    o.n++; _props().setProperty(cle, JSON.stringify(o));
    return reponseJSON({ status: 'error', message: 'Code incorrect.' });
  }
  _props().deleteProperty(cle);
  const f = _formateurParEmail(email);
  if (!f || f.statut !== 'Actif') return reponseJSON({ status: 'error', message: 'Compte désactivé.' });
  try { _feuilleFormation(FORMATEURS.FEUILLE, ENTETES_FORMATEURS).getRange(f.ligne, 9).setValue(new Date()); } catch (e) {}
  return reponseJSON({ status: 'success', token: _jetonFormateur(email), profil: _profilPublic(f) });
}

// Définir le mot de passe depuis le lien reçu (invitation ou oubli).
function formateurDefinirMdp(data) {
  const code = String(data.code || '').replace(/[^\w]/g, '');
  const cle = 'FORM_LIEN_' + code;
  const brut = code && _props().getProperty(cle);
  if (!brut) return reponseJSON({ status: 'error', message: 'Lien invalide ou déjà utilisé. Demandez un nouveau lien.' });
  const l = JSON.parse(brut);
  if (Date.now() > l.x) { _props().deleteProperty(cle); return reponseJSON({ status: 'error', message: 'Lien expiré. Demandez un nouveau lien.' }); }
  const err = _mdpRobuste(data.password);
  if (err) return reponseJSON({ status: 'error', message: err });
  const f = _formateurParEmail(l.e);
  if (!f || f.statut !== 'Actif') return reponseJSON({ status: 'error', message: 'Compte désactivé.' });
  _definirMdp(f.email, String(data.password));
  _props().deleteProperty(cle);
  return reponseJSON({ status: 'success', email: f.email, message: 'Mot de passe enregistré. Vous pouvez vous connecter.' });
}

// Réponse identique que l'email existe ou non (pas de fuite d'information).
function formateurMdpOublie(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const msg = 'Si cette adresse correspond à un compte formateur actif, un lien vient d\'être envoyé (valable 1 heure).';
  if (!_emailValide(email)) return reponseJSON({ status: 'success', message: msg });
  const c = CacheService.getScriptCache(), k = 'FORM_OUBLI_' + email;
  if (c.get(k)) return reponseJSON({ status: 'success', message: msg });     // 1 envoi / 5 min
  c.put(k, '1', 300);
  const f = _formateurParEmail(email);
  if (f && f.statut === 'Actif') { try { _envoyerInvitation(f, true); } catch (e) { console.error('[formateurMdpOublie]', e.toString()); } }
  return reponseJSON({ status: 'success', message: msg });
}

function _profilPublic(f) {
  return { prenom: f.prenom, nom: f.nom, email: f.email, filieres: f.filieres.map(k => ({ cle: k, nom: nomAffichagePublic(k) })) };
}

/* ======================= DONNÉES DU FORMATEUR ======================= */

// Apprenants des filières du formateur — sans paiements ni pièces.
function _apprenantsDuFormateur(f) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return [];
  const liste = [];
  feuille.getDataRange().getValues().slice(1).forEach(r => {
    const id = String(r[0] || '').trim();
    const statut = String(r[28] || '').trim();
    if (!id || id === 'LQD-EXEMPLE' || FORMATEURS.STATUTS_APPRENANT.indexOf(statut) === -1) return;
    const cles = clesFilieres(String(r[22] || ''));
    const communes = f.filieres.filter(k => cles.indexOf(k) !== -1);
    if (!communes.length) return;
    const a = _mapperApprenantInscription(r);
    liste.push({
      id: id, prenom: a.prenom, nom: a.nom, sexe: a.sexe, telephone: a.telephone, email: a.email,
      filiere: a.filiere, filieresCles: communes, statut: statut,
      dateEntree: _dateIso(a.dateEntree), dateFin: _dateIso(a.dateFin), photoUrl: a.photoUrl
    });
  });
  return liste.sort((x, y) => (x.nom + x.prenom).localeCompare(y.nom + y.prenom, 'fr'));
}

// En formation à une date donnée (pour l'appel et les notes).
function _enFormationLe(a, dateIso) {
  if (a.dateEntree && dateIso < a.dateEntree) return false;
  if (a.dateFin && dateIso > a.dateFin) return false;
  return true;
}

function formateurTableau(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const apprenants = _apprenantsDuFormateur(f);
  const presences = _lirePresences().filter(p => _filiereAutorisee(f, p.filiere));
  const evals = _lireEvaluations().filter(e => _filiereAutorisee(f, e.filiere));
  const forum = _getOrCreateFeuilleForum().getDataRange().getValues().slice(1).filter(r => r[0]).map(_ligneForumVersObjet)
    .filter(q => q.statut === 'en_attente' && clesFilieres(q.filiere).some(k => f.filieres.indexOf(k) !== -1));
  const seances = {};
  presences.forEach(p => { seances[p.seanceId] = true; });
  const presents = presences.filter(p => p.statut === 'Présent' || p.statut === 'Retard').length;
  return reponseJSON({
    status: 'success',
    profil: _profilPublic(f),
    stats: {
      apprenants: apprenants.length,
      enFormation: apprenants.filter(a => _enFormationLe(a, _dateIso(new Date()))).length,
      seances: Object.keys(seances).length,
      tauxPresence: presences.length ? Math.round(presents / presences.length * 100) : null,
      evaluations: evals.length,
      questionsEnAttente: forum.length
    }
  });
}

function formateurApprenants(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const apprenants = _apprenantsDuFormateur(f);
  // Assiduité et moyenne par apprenant (sur les filières du formateur).
  const pres = _lirePresences().filter(p => _filiereAutorisee(f, p.filiere));
  const evals = _lireEvaluations().filter(e => _filiereAutorisee(f, e.filiere));
  const notes = _lireNotes();
  apprenants.forEach(a => {
    const mesPres = pres.filter(p => p.dossierId === a.id);
    a.seances = mesPres.length;
    a.absences = mesPres.filter(p => p.statut === 'Absent').length;
    a.tauxPresence = mesPres.length ? Math.round(mesPres.filter(p => p.statut === 'Présent' || p.statut === 'Retard').length / mesPres.length * 100) : null;
    a.moyenne = _moyenneSur20(evals, notes.filter(n => n.dossierId === a.id));
  });
  return reponseJSON({ status: 'success', apprenants: apprenants });
}

/* ============================ PRÉSENCES ============================ */

function _lirePresences() {
  const f = _feuilleFormation(FORMATEURS.FEUILLE_PRESENCES, ENTETES_PRESENCES);
  if (!f) return [];
  return f.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({
    seanceId: String(r[0]), date: _dateIso(r[1]), filiere: String(r[2] || ''), intitule: String(r[3] || ''),
    formateur: String(r[4] || ''), dossierId: String(r[5] || ''), apprenant: String(r[6] || ''),
    statut: String(r[7] || ''), remarque: String(r[8] || '')
  }));
}

function formateurSeancesLister(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const parSeance = {};
  _lirePresences().filter(p => _filiereAutorisee(s.formateur, p.filiere)).forEach(p => {
    const x = parSeance[p.seanceId] || (parSeance[p.seanceId] = { id: p.seanceId, date: p.date, filiere: p.filiere, filiereNom: nomAffichagePublic(p.filiere), intitule: p.intitule, formateur: p.formateur, total: 0, presents: 0, absents: 0, retards: 0 });
    x.total++;
    if (p.statut === 'Présent') x.presents++;
    if (p.statut === 'Absent') x.absents++;
    if (p.statut === 'Retard') x.retards++;
  });
  const seances = Object.keys(parSeance).map(k => parSeance[k]).sort((a, b) => b.date.localeCompare(a.date));
  return reponseJSON({ status: 'success', seances: seances });
}

// Feuille d'appel : nouvelle séance (liste des apprenants en formation à
// cette date) ou séance existante (statuts déjà saisis).
function formateurSeanceGet(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const id = String(data.id || '');
  let date = _dateIso(data.date) || _dateIso(new Date());
  let filiere = cleFiliere(data.filiere), intitule = '';
  const existantes = {};
  if (id) {
    const lignes = _lirePresences().filter(p => p.seanceId === id);
    if (!lignes.length) return reponseJSON({ status: 'error', message: 'Séance introuvable.' });
    date = lignes[0].date; filiere = lignes[0].filiere; intitule = lignes[0].intitule;
    lignes.forEach(p => { existantes[p.dossierId] = { statut: p.statut, remarque: p.remarque }; });
  }
  if (!_filiereAutorisee(f, filiere)) return reponseJSON({ status: 'error', message: 'Filière non attribuée à votre compte.' });
  const liste = _apprenantsDuFormateur(f)
    .filter(a => a.filieresCles.indexOf(filiere) !== -1 && (existantes[a.id] || _enFormationLe(a, date)))
    .map(a => ({ id: a.id, prenom: a.prenom, nom: a.nom, photoUrl: a.photoUrl,
      statut: existantes[a.id] ? existantes[a.id].statut : 'Présent', remarque: existantes[a.id] ? existantes[a.id].remarque : '' }));
  return reponseJSON({ status: 'success', seance: { id: id, date: date, filiere: filiere, filiereNom: nomAffichagePublic(filiere), intitule: intitule }, apprenants: liste });
}

function formateurSeanceEnregistrer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const filiere = cleFiliere(data.filiere);
  const date = _dateIso(data.date);
  const intitule = _txtF(data.intitule, 120);
  if (!_filiereAutorisee(f, filiere)) return reponseJSON({ status: 'error', message: 'Filière non attribuée à votre compte.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reponseJSON({ status: 'error', message: 'Date de séance invalide.' });
  if (date > _dateIso(new Date(Date.now() + 86400000))) return reponseJSON({ status: 'error', message: 'Impossible de faire l\'appel d\'une séance future.' });
  const lignesIn = Array.isArray(data.presences) ? data.presences : [];
  if (!lignesIn.length) return reponseJSON({ status: 'error', message: 'Aucun apprenant dans cette feuille d\'appel.' });

  // Seuls les apprenants de la filière du formateur sont acceptés.
  const autorises = {};
  _apprenantsDuFormateur(f).filter(a => a.filieresCles.indexOf(filiere) !== -1).forEach(a => { autorises[a.id] = a; });
  const now = new Date();
  const id = String(data.id || '') || genererID('SEA');
  const nouvelles = [];
  for (const p of lignesIn) {
    const a = autorises[String(p.dossierId || '')];
    if (!a) return reponseJSON({ status: 'error', message: 'Apprenant non autorisé dans cette séance.' });
    if (FORMATEURS.STATUTS_PRESENCE.indexOf(p.statut) === -1) return reponseJSON({ status: 'error', message: 'Statut de présence invalide.' });
    nouvelles.push([id, date, filiere, intitule, f.email, a.id, (a.prenom + ' ' + a.nom).trim(), p.statut, _txtF(p.remarque, 200), now]);
  }

  const feuille = _feuilleFormation(FORMATEURS.FEUILLE_PRESENCES, ENTETES_PRESENCES);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Modification : la séance doit appartenir aux filières du formateur.
    const donnees = feuille.getDataRange().getValues();
    for (let i = donnees.length - 1; i >= 1; i--) {
      if (String(donnees[i][0]) !== id) continue;
      if (!_filiereAutorisee(f, String(donnees[i][2]))) return reponseJSON({ status: 'error', message: 'Séance non modifiable.' });
      feuille.deleteRow(i + 1);
    }
    _ajouterLignes(feuille, nouvelles);
  } finally { lock.releaseLock(); }
  return reponseJSON({ status: 'success', id: id });
}

function formateurSeanceSupprimer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const id = String(data.id || '');
  const feuille = _feuilleFormation(FORMATEURS.FEUILLE_PRESENCES, ENTETES_PRESENCES);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let n = 0;
  try {
    const d = feuille.getDataRange().getValues();
    for (let i = d.length - 1; i >= 1; i--) {
      if (String(d[i][0]) !== id) continue;
      if (!_filiereAutorisee(s.formateur, String(d[i][2]))) return reponseJSON({ status: 'error', message: 'Séance non modifiable.' });
      feuille.deleteRow(i + 1); n++;
    }
  } finally { lock.releaseLock(); }
  return n ? reponseJSON({ status: 'success' }) : reponseJSON({ status: 'error', message: 'Séance introuvable.' });
}

/* ======================== NOTES & ÉVALUATIONS ======================== */

function _lireEvaluations() {
  const f = _feuilleFormation(FORMATEURS.FEUILLE_EVALS, ENTETES_EVALS);
  if (!f) return [];
  return f.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]), date: _dateIso(r[1]), filiere: String(r[2] || ''), intitule: String(r[3] || ''),
    bareme: Number(r[4]) || 20, coefficient: Number(r[5]) || 1, formateur: String(r[6] || ''), publiee: String(r[7]) === 'Oui'
  }));
}

function _lireNotes() {
  const f = _feuilleFormation(FORMATEURS.FEUILLE_NOTES, ENTETES_NOTES);
  if (!f) return [];
  return f.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({
    evalId: String(r[0]), dossierId: String(r[1] || ''), apprenant: String(r[2] || ''),
    note: r[3] === '' || r[3] === null ? null : Number(r[3]), appreciation: String(r[4] || '')
  }));
}

// Moyenne pondérée ramenée sur 20 (les absences non notées sont ignorées).
function _moyenneSur20(evals, notesApprenant) {
  let somme = 0, poids = 0;
  notesApprenant.forEach(n => {
    const e = evals.filter(x => x.id === n.evalId)[0];
    if (!e || n.note === null || isNaN(n.note)) return;
    somme += (n.note / e.bareme * 20) * e.coefficient;
    poids += e.coefficient;
  });
  return poids ? Math.round(somme / poids * 100) / 100 : null;
}

function formateurEvalsLister(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const notes = _lireNotes();
  const evals = _lireEvaluations().filter(e => _filiereAutorisee(s.formateur, e.filiere)).map(e => {
    const n = notes.filter(x => x.evalId === e.id && x.note !== null);
    return Object.assign(e, {
      filiereNom: nomAffichagePublic(e.filiere),
      nbNotes: n.length,
      moyenneClasse: n.length ? Math.round(n.reduce((t, x) => t + x.note, 0) / n.length * 100) / 100 : null
    });
  }).sort((a, b) => b.date.localeCompare(a.date));
  return reponseJSON({ status: 'success', evaluations: evals });
}

function formateurEvalGet(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const id = String(data.id || '');
  let ev = { id: '', date: _dateIso(data.date) || _dateIso(new Date()), filiere: cleFiliere(data.filiere), intitule: '', bareme: 20, coefficient: 1, publiee: false };
  const existantes = {};
  if (id) {
    ev = _lireEvaluations().filter(e => e.id === id)[0];
    if (!ev) return reponseJSON({ status: 'error', message: 'Évaluation introuvable.' });
    _lireNotes().filter(n => n.evalId === id).forEach(n => { existantes[n.dossierId] = n; });
  }
  if (!_filiereAutorisee(f, ev.filiere)) return reponseJSON({ status: 'error', message: 'Filière non attribuée à votre compte.' });
  const liste = _apprenantsDuFormateur(f)
    .filter(a => a.filieresCles.indexOf(ev.filiere) !== -1 && (existantes[a.id] || _enFormationLe(a, ev.date)))
    .map(a => ({ id: a.id, prenom: a.prenom, nom: a.nom,
      note: existantes[a.id] ? existantes[a.id].note : null, appreciation: existantes[a.id] ? existantes[a.id].appreciation : '' }));
  ev.filiereNom = nomAffichagePublic(ev.filiere);
  return reponseJSON({ status: 'success', evaluation: ev, apprenants: liste });
}

function formateurEvalEnregistrer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const filiere = cleFiliere(data.filiere);
  const date = _dateIso(data.date);
  const intitule = _txtF(data.intitule, 120);
  const bareme = Number(data.bareme);
  const coefficient = Number(data.coefficient);
  if (!_filiereAutorisee(f, filiere)) return reponseJSON({ status: 'error', message: 'Filière non attribuée à votre compte.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reponseJSON({ status: 'error', message: 'Date invalide.' });
  if (!intitule) return reponseJSON({ status: 'error', message: 'Donnez un intitulé à l\'évaluation (ex. Devoir 1 — Photoshop).' });
  if ([10, 20, 100].indexOf(bareme) === -1) return reponseJSON({ status: 'error', message: 'Barème invalide (10, 20 ou 100).' });
  if (!(coefficient >= 0.5 && coefficient <= 10)) return reponseJSON({ status: 'error', message: 'Coefficient entre 0,5 et 10.' });

  const autorises = {};
  _apprenantsDuFormateur(f).filter(a => a.filieresCles.indexOf(filiere) !== -1).forEach(a => { autorises[a.id] = a; });
  const id = String(data.id || '') || genererID('EVA');
  const lignesNotes = [];
  for (const n of (Array.isArray(data.notes) ? data.notes : [])) {
    const a = autorises[String(n.dossierId || '')];
    if (!a) return reponseJSON({ status: 'error', message: 'Apprenant non autorisé dans cette évaluation.' });
    let note = n.note === '' || n.note === null || n.note === undefined ? '' : Number(String(n.note).replace(',', '.'));
    if (note !== '' && (isNaN(note) || note < 0 || note > bareme)) return reponseJSON({ status: 'error', message: 'Note invalide pour ' + a.prenom + ' ' + a.nom + ' (entre 0 et ' + bareme + ').' });
    if (note !== '') note = Math.round(note * 100) / 100;
    lignesNotes.push([id, a.id, (a.prenom + ' ' + a.nom).trim(), note, _txtF(n.appreciation, 200)]);
  }

  const fe = _feuilleFormation(FORMATEURS.FEUILLE_EVALS, ENTETES_EVALS);
  const fn = _feuilleFormation(FORMATEURS.FEUILLE_NOTES, ENTETES_NOTES);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const de = fe.getDataRange().getValues();
    let ligneEval = -1, creeLe = new Date();
    for (let i = 1; i < de.length; i++) {
      if (String(de[i][0]) !== id) continue;
      if (!_filiereAutorisee(f, String(de[i][2]))) return reponseJSON({ status: 'error', message: 'Évaluation non modifiable.' });
      ligneEval = i + 1; creeLe = de[i][8] || creeLe;
    }
    const ligne = [id, date, filiere, intitule, bareme, coefficient, f.email, data.publiee === true ? 'Oui' : 'Non', creeLe];
    if (ligneEval > 0) fe.getRange(ligneEval, 1, 1, ligne.length).setValues([ligne]);
    else fe.appendRow(ligne);
    const dn = fn.getDataRange().getValues();
    for (let i = dn.length - 1; i >= 1; i--) if (String(dn[i][0]) === id) fn.deleteRow(i + 1);
    _ajouterLignes(fn, lignesNotes);
  } finally { lock.releaseLock(); }
  return reponseJSON({ status: 'success', id: id });
}

function formateurEvalSupprimer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const id = String(data.id || '');
  const fe = _feuilleFormation(FORMATEURS.FEUILLE_EVALS, ENTETES_EVALS);
  const fn = _feuilleFormation(FORMATEURS.FEUILLE_NOTES, ENTETES_NOTES);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const de = fe.getDataRange().getValues();
    let trouve = false;
    for (let i = de.length - 1; i >= 1; i--) {
      if (String(de[i][0]) !== id) continue;
      if (!_filiereAutorisee(s.formateur, String(de[i][2]))) return reponseJSON({ status: 'error', message: 'Évaluation non modifiable.' });
      fe.deleteRow(i + 1); trouve = true;
    }
    if (!trouve) return reponseJSON({ status: 'error', message: 'Évaluation introuvable.' });
    const dn = fn.getDataRange().getValues();
    for (let i = dn.length - 1; i >= 1; i--) if (String(dn[i][0]) === id) fn.deleteRow(i + 1);
  } finally { lock.releaseLock(); }
  return reponseJSON({ status: 'success' });
}

/* ==================== COURS & FORUM (filières limitées) ==================== */

function formateurCoursLister(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const stats = _statsConsultations();
  const cours = _trierCours((_lireCours() || []).filter(c => _filiereAutorisee(s.formateur, c.filiere))).map(c => {
    const st = stats[c.id];
    return Object.assign({}, c, { filiereNom: nomAffichagePublic(c.filiere), vues: st ? st.vues : 0, apprenantsDistincts: st ? Object.keys(st.apprenants).length : 0 });
  });
  return reponseJSON({ status: 'success', cours: cours, modules: cours.map(c => c.module).filter((m, i, t) => m && t.indexOf(m) === i) });
}

function _coursDuFormateur(f, id) {
  const c = (_lireCours() || []).filter(x => x.id === String(id || ''))[0];
  return c && _filiereAutorisee(f, c.filiere) ? c : null;
}

function formateurCoursAjouter(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  if (!_filiereAutorisee(s.formateur, data.filiere)) return reponseJSON({ status: 'error', message: 'Filière non attribuée à votre compte.' });
  return adminCoursAjouter(data, s.formateur.email);
}

function formateurCoursModifier(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  if (!_coursDuFormateur(s.formateur, data.id) || !_filiereAutorisee(s.formateur, data.filiere)) return reponseJSON({ status: 'error', message: 'Support non modifiable avec votre compte.' });
  return adminCoursModifier(data, s.formateur.email);
}

function formateurCoursSupprimer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  if (!_coursDuFormateur(s.formateur, data.id)) return reponseJSON({ status: 'error', message: 'Support non modifiable avec votre compte.' });
  return adminCoursSupprimer(data, s.formateur.email);
}

function formateurCoursConsultations(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  if (!_coursDuFormateur(s.formateur, data.id)) return reponseJSON({ status: 'error', message: 'Support introuvable.' });
  return adminCoursConsultations(data, s.formateur.email);
}

function _questionDuFormateur(f, q) {
  return clesFilieres(q.filiere).some(k => f.filieres.indexOf(k) !== -1);
}

function formateurForumLister(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const contacts = _contactsApprenants();
  const questions = _getOrCreateFeuilleForum().getDataRange().getValues().slice(1).filter(r => r[0]).map(_ligneForumVersObjet)
    .filter(q => _questionDuFormateur(s.formateur, q))
    .map(q => Object.assign(q, { telephone: (contacts[q.dossierId] || {}).telephone || '' }))
    .sort((a, b) => (a.statut !== b.statut) ? (a.statut === 'en_attente' ? -1 : 1) : String(b.dateQuestion).localeCompare(String(a.dateQuestion)));
  return reponseJSON({ status: 'success', questions: questions });
}

function formateurForumRepondre(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const q = _getOrCreateFeuilleForum().getDataRange().getValues().slice(1).map(_ligneForumVersObjet).filter(x => x.id === String(data.id || ''))[0];
  if (!q || !_questionDuFormateur(s.formateur, q)) return reponseJSON({ status: 'error', message: 'Question introuvable.' });
  return adminForumRepondre(data, s.formateur.prenom + ' ' + s.formateur.nom + ' (formateur)');
}

/* ================= CÔTÉ APPRENANT : notes publiées + assiduité ================= */

function apprenantSuivi(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const id = session.apprenant.id;
  const evals = _lireEvaluations().filter(e => e.publiee);
  const mesNotes = _lireNotes().filter(n => n.dossierId === id && evals.some(e => e.id === n.evalId));
  const notes = mesNotes.map(n => {
    const e = evals.filter(x => x.id === n.evalId)[0];
    return { intitule: e.intitule, date: e.date, filiere: nomAffichagePublic(e.filiere), note: n.note, bareme: e.bareme, coefficient: e.coefficient, appreciation: n.appreciation };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const pres = _lirePresences().filter(p => p.dossierId === id);
  const presents = pres.filter(p => p.statut === 'Présent').length, retards = pres.filter(p => p.statut === 'Retard').length;
  return reponseJSON({
    status: 'success',
    notes: notes,
    moyenne: _moyenneSur20(evals, mesNotes),
    presences: {
      seances: pres.length, presents: presents, retards: retards,
      absents: pres.filter(p => p.statut === 'Absent').length, excuses: pres.filter(p => p.statut === 'Excusé').length,
      taux: pres.length ? Math.round((presents + retards) / pres.length * 100) : null,
      dernieres: pres.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(p => ({ date: p.date, intitule: p.intitule, statut: p.statut }))
    }
  });
}

/* ========================= ADMIN : gestion des comptes ========================= */

function _validerFilieresFormateur(liste) {
  const cles = (Array.isArray(liste) ? liste : []).map(cleFiliere).filter((k, i, t) => k && t.indexOf(k) === i);
  if (!cles.length) return { erreur: 'Attribuez au moins une filière.' };
  if (cles.some(k => CONFIG.FORMATIONS_VALIDES.indexOf(k) === -1)) return { erreur: 'Filière inconnue.' };
  return { cles: cles };
}

function adminFormateursLister(data, email) {
  const liste = _lireFormateurs().map(f => Object.assign(_profilPublic(f), {
    id: f.id, telephone: f.telephone, statut: f.statut, creeLe: f.creeLe, derniereConnexion: f.derniereConnexion,
    filieresCles: f.filieres, motDePasseDefini: !!_props().getProperty(_cleMdp(f.email))
  }));
  return reponseJSON({ status: 'success', formateurs: liste });
}

// Candidature "Formateur / Staff" passée en "Retenu" et sans compte :
// seule source autorisée pour un compte créé depuis la page Candidatures.
function _candidaturePourCompte(candidatureId) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const f = ss && ss.getSheetByName('Candidatures');
  if (!f) return { erreur: 'Candidature introuvable.' };
  const d = f.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() !== candidatureId) continue;
    if (String(d[i][1]) !== 'formateur') return { erreur: 'Cette candidature n\'est pas de type Formateur / Staff.' };
    if (String(d[i][19]) !== 'Retenu') return { erreur: 'Passez d\'abord la candidature en « Retenu ».' };
    if (String(d[i][28] || '').trim()) return { erreur: 'Un compte formateur a déjà été créé pour cette candidature (' + d[i][28] + ').' };
    return { feuille: f, ligne: i + 1 };
  }
  return { erreur: 'Candidature introuvable.' };
}

function adminFormateurCreer(data, email) {
  const prenom = _txtF(data.prenom, 60), nom = _txtF(data.nom, 60);
  const mail = String(data.email || '').trim().toLowerCase();
  const tel = String(data.telephone || '').replace(/[^\d+ ]/g, '').trim().slice(0, 20);
  if (!prenom || !nom) return reponseJSON({ status: 'error', message: 'Prénom et nom obligatoires.' });
  if (!_emailValide(mail)) return reponseJSON({ status: 'error', message: 'Adresse email invalide.' });
  const fil = _validerFilieresFormateur(data.filieres);
  if (fil.erreur) return reponseJSON({ status: 'error', message: fil.erreur });
  if (_formateurParEmail(mail)) return reponseJSON({ status: 'error', message: 'Un formateur existe déjà avec cet email.' });
  if (ADMIN_CONFIG.EMAILS_AUTORISES.map(e => e.toLowerCase()).indexOf(mail) !== -1) return reponseJSON({ status: 'error', message: 'Cet email est un compte administrateur : utilisez une autre adresse pour le compte formateur.' });
  const candidatureId = String(data.candidatureId || '').trim();
  let cand = null;
  if (candidatureId) {
    cand = _candidaturePourCompte(candidatureId);
    if (cand.erreur) return reponseJSON({ status: 'error', message: cand.erreur });
  }

  const feuille = _feuilleFormation(FORMATEURS.FEUILLE, ENTETES_FORMATEURS);
  const id = genererID('FOR');
  feuille.appendRow([id, prenom, nom, mail, tel, fil.cles.join(' | '), 'Actif', new Date(), '']);
  // Trace dans la candidature (colonne AC) : évite un deuxième compte.
  if (cand) {
    if (String(cand.feuille.getRange(1, 29).getValue()) !== 'Compte formateur (ID)') cand.feuille.getRange(1, 29).setValue('Compte formateur (ID)');
    cand.feuille.getRange(cand.ligne, 29).setValue(id);
  }
  const f = _formateurParEmail(mail);
  let invitation = true;
  try { _envoyerInvitation(f, false); } catch (e) { invitation = false; console.error('[adminFormateurCreer] invitation', e.toString()); }
  console.log('[Admin:' + email + '] Formateur créé', mail);
  return reponseJSON({ status: 'success', id: id, invitationEnvoyee: invitation,
    message: invitation ? 'Compte créé. Invitation envoyée à ' + mail + ' (lien valable 72 h).' : 'Compte créé, mais l\'email d\'invitation n\'est pas parti : utilisez « Renvoyer l\'invitation ».' });
}

function adminFormateurModifier(data, email) {
  const f = _lireFormateurs().filter(x => x.id === String(data.id || ''))[0];
  if (!f) return reponseJSON({ status: 'error', message: 'Formateur introuvable.' });
  const prenom = _txtF(data.prenom, 60), nom = _txtF(data.nom, 60);
  const tel = String(data.telephone || '').replace(/[^\d+ ]/g, '').trim().slice(0, 20);
  if (!prenom || !nom) return reponseJSON({ status: 'error', message: 'Prénom et nom obligatoires.' });
  const fil = _validerFilieresFormateur(data.filieres);
  if (fil.erreur) return reponseJSON({ status: 'error', message: fil.erreur });
  const statut = data.statut === 'Désactivé' ? 'Désactivé' : 'Actif';
  const feuille = _feuilleFormation(FORMATEURS.FEUILLE, ENTETES_FORMATEURS);
  feuille.getRange(f.ligne, 2, 1, 2).setValues([[prenom, nom]]);
  feuille.getRange(f.ligne, 5, 1, 3).setValues([[tel, fil.cles.join(' | '), statut]]);
  console.log('[Admin:' + email + '] Formateur modifié', f.email, statut);
  return reponseJSON({ status: 'success' });
}

function adminFormateurInviter(data, email) {
  const f = _lireFormateurs().filter(x => x.id === String(data.id || ''))[0];
  if (!f) return reponseJSON({ status: 'error', message: 'Formateur introuvable.' });
  if (f.statut !== 'Actif') return reponseJSON({ status: 'error', message: 'Réactivez d\'abord le compte.' });
  _envoyerInvitation(f, false);
  return reponseJSON({ status: 'success', message: 'Invitation renvoyée à ' + f.email + '.' });
}

/* ============================ AIGUILLAGE ============================ */

function routerFormateur(data, action) {
  try {
    switch (action) {
      case 'formateur_login':            return formateurLogin(data);
      case 'formateur_verify_otp':       return formateurVerifierOtp(data);
      case 'formateur_definir_mdp':      return formateurDefinirMdp(data);
      case 'formateur_mdp_oublie':       return formateurMdpOublie(data);
      case 'formateur_tableau':          return formateurTableau(data);
      case 'formateur_apprenants':       return formateurApprenants(data);
      case 'formateur_seances_lister':   return formateurSeancesLister(data);
      case 'formateur_seance_get':       return formateurSeanceGet(data);
      case 'formateur_seance_enregistrer': return formateurSeanceEnregistrer(data);
      case 'formateur_seance_supprimer': return formateurSeanceSupprimer(data);
      case 'formateur_evals_lister':     return formateurEvalsLister(data);
      case 'formateur_eval_get':         return formateurEvalGet(data);
      case 'formateur_eval_enregistrer': return formateurEvalEnregistrer(data);
      case 'formateur_eval_supprimer':   return formateurEvalSupprimer(data);
      case 'formateur_cours_lister':     return formateurCoursLister(data);
      case 'formateur_cours_ajouter':    return formateurCoursAjouter(data);
      case 'formateur_cours_modifier':   return formateurCoursModifier(data);
      case 'formateur_cours_supprimer':  return formateurCoursSupprimer(data);
      case 'formateur_cours_consultations': return formateurCoursConsultations(data);
      case 'formateur_forum_lister':     return formateurForumLister(data);
      case 'formateur_forum_repondre':   return formateurForumRepondre(data);
      default: return reponseJSON({ status: 'error', message: 'Action formateur inconnue.' });
    }
  } catch (err) {
    console.error('[routerFormateur] ' + action, err.toString());
    return reponseJSON({ status: 'error', message: 'Erreur interne. Réessayez dans un instant.' });
  }
}

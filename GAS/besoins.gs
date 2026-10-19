// ================================================================
// FICHE INDIVIDUELLE DE RECUEIL DES BESOINS DE L'APPRENANT (octobre 2026)
//
// Circuit :
// 1. La fiche est créée automatiquement quand un dossier passe en
//    "Confirmé" (admin.gs) ; le formateur (ou l'admin) peut aussi
//    l'envoyer aux apprenants en formation qui n'en ont pas encore.
// 2. L'apprenant la remplit dans son espace (brouillon possible), puis
//    l'envoie avec une confirmation horodatée (remplace la signature).
// 3. Le formateur voit les réponses PÉDAGOGIQUES et remplit le cadre VIII
//    (synthèse, difficultés, mesures, date de suivi).
//
// Confidentialité (choix de la Direction) : santé, accessibilité,
// finances, contraintes familiales, corrections d'identité et le
// message libre à l'établissement sont rangés à part et ne sont
// renvoyés QU'À l'admin et à l'apprenant lui-même. Le formateur reçoit
// seulement le signal "Besoin particulier signalé — voir l'administration".
// Cette séparation est faite côté serveur : le détail ne quitte jamais
// Apps Script vers l'espace formateur.
//
// Les questions sont décrites UNE seule fois ici (BESOINS_SCHEMA) et
// envoyées aux pages : formulaire, vues et PDF restent cohérents.
// ================================================================

const BESOINS = {
  FEUILLE:        'Fiches besoins',
  RELANCE_HEURES: 24,      // une relance au plus par fiche et par 24 h
  TEXTE_MAX:      1500,
  AUTRE_MAX:      200,
  STATUTS:        ['À remplir', 'Brouillon', 'Soumise', 'Traitée'],
  MESURES:        ['Suivi pédagogique individuel', 'Renforcement des compétences', 'Séance de rattrapage',
                   'Orientation vers un service adapté', 'Mise à disposition de ressources']
};

// Colonnes : 0 ID | 1 Dossier | 2 Apprenant | 3 Filières (clés) | 4 Année |
// 5 Statut | 6 Envoyée le | 7 Envoyée par | 8 Relances | 9 Dernière relance |
// 10 Soumise le | 11 Réponses pédagogie | 12 Réponses confidentielles |
// 13 Besoin particulier | 14 Corrections identité | 15 Confirmation |
// 16 Suivi (cadre VIII) | 17 Suivi par | 18 Suivi le | 19 Mis à jour le
const ENTETES_BESOINS = ['ID', 'Dossier ID', 'Apprenant', 'Filière', 'Année de formation', 'Statut',
  'Envoyée le', 'Envoyée par', 'Relances', 'Dernière relance', 'Soumise le',
  'Réponses (pédagogie)', 'Réponses (confidentiel)', 'Besoin particulier', 'Corrections identité',
  'Confirmation apprenant', 'Suivi (cadre VIII)', 'Suivi par', 'Suivi le', 'Mis à jour le'];

const BESOINS_SCHEMA = [
  { id: 'II', titre: 'Parcours scolaire ou de formation', questions: [
    { id: 'q1', num: 1, type: 'unique', requis: true, autre: true, label: 'Quel est votre dernier niveau d’études atteint ?',
      options: ['Primaire', 'Collège', 'Lycée', 'Baccalauréat', 'Études supérieures', 'Formation professionnelle'] },
    { id: 'q2', num: 2, type: 'unique', requis: true, label: 'Avez-vous déjà suivi une formation similaire ?', options: ['Oui', 'Non'] },
    { id: 'q2b', type: 'texte', max: 300, si: { q: 'q2', vaut: 'Oui' }, label: 'Si oui, laquelle ?' },
    { id: 'q3', num: 3, type: 'unique', requis: true, label: 'Avez-vous déjà rencontré des difficultés pendant vos études ou vos formations ?', options: ['Oui', 'Non'] },
    { id: 'q3b', type: 'multiple', autre: true, si: { q: 'q3', vaut: 'Oui' }, label: 'Si oui, lesquelles ?',
      options: ['Compréhension des cours', 'Lecture et rédaction', 'Calcul et raisonnement', 'Utilisation de l’ordinateur',
                'Concentration et mémorisation', 'Organisation du temps de travail', 'Manque de matériel ou de ressources'] }
  ]},
  { id: 'III', titre: 'Besoins et difficultés d’apprentissage', questions: [
    { id: 'q4', num: 4, type: 'multiple', requis: true, autre: true, label: 'Dans quels domaines avez-vous le plus besoin d’aide ?',
      options: ['Comprendre les explications du formateur', 'Faire les exercices pratiques', 'Réviser et mémoriser les leçons',
                'Lire et comprendre les consignes', 'Utiliser les outils et logiciels', 'Réaliser les travaux personnels',
                'Préparer les évaluations', 'Prendre la parole devant les autres'] },
    { id: 'q5', num: 5, type: 'multiple', autre: true, autreSensible: true, label: 'Qu’est-ce qui vous empêche parfois de bien apprendre ?',
      options: ['Le manque de confiance en moi', 'Les difficultés de compréhension', 'Le manque de temps pour réviser',
                'Les absences ou retards', 'Le manque d’équipement ou de connexion',
                'Les difficultés financières liées à la formation', 'Les difficultés de santé ou d’accessibilité'],
      sensibles: ['Les difficultés financières liées à la formation', 'Les difficultés de santé ou d’accessibilité'] },
    { id: 'q6', num: 6, type: 'multiple', requis: true, label: 'Comment préférez-vous apprendre ?',
      options: ['En écoutant les explications', 'En observant des démonstrations', 'En pratiquant directement',
                'Avec des images, schémas ou vidéos', 'En travaillant en groupe', 'Avec des exercices individuels', 'Avec des documents écrits'] },
    { id: 'q7', num: 7, type: 'multiple', requis: true, autre: true, label: 'Quel type d’accompagnement vous aiderait le plus ?',
      options: ['Des explications supplémentaires', 'Des exercices de renforcement', 'Des séances de rattrapage', 'Un suivi individuel',
                'Des fiches de révision', 'Un accompagnement en orientation'] }
  ]},
  { id: 'IV', titre: 'Motivation et projet personnel', questions: [
    { id: 'q8', num: 8, type: 'texte', requis: true, label: 'Pourquoi avez-vous choisi cette formation ou cette filière ?' },
    { id: 'q9', num: 9, type: 'unique', requis: true, autre: true, label: 'Quel est votre principal objectif ?',
      options: ['Réussir mes études ou ma formation', 'Obtenir un diplôme ou une attestation', 'Acquérir de nouvelles compétences',
                'Trouver un emploi', 'Créer mon entreprise', 'Améliorer mes performances professionnelles', 'Préparer la poursuite de mes études'] },
    { id: 'q10', num: 10, type: 'texte', label: 'Quelles sont vos attentes envers l’établissement et les formateurs ?' },
    { id: 'q11', num: 11, type: 'texte', label: 'Quelles compétences souhaitez-vous particulièrement développer ?' }
  ]},
  { id: 'V', titre: 'Conditions d’étude et besoins matériels', questions: [
    { id: 'q12', num: 12, type: 'unique', requis: true, label: 'Disposez-vous du matériel nécessaire pour apprendre ?',
      options: ['Oui, entièrement', 'Oui, mais partiellement', 'Non'] },
    { id: 'q13', num: 13, type: 'multiple', autre: true, label: 'De quels équipements ou ressources avez-vous besoin ?',
      options: ['Ordinateur', 'Connexion Internet', 'Documents ou supports de cours', 'Livres et fournitures',
                'Logiciels ou applications', 'Matériel technique ou professionnel'] },
    { id: 'q14', num: 14, type: 'multiple', autre: true, autreSensible: true, exclusif: 'Aucune difficulté particulière',
      label: 'Avez-vous des contraintes susceptibles d’affecter votre participation aux cours ?',
      options: ['Horaires de travail ou responsabilités familiales', 'Difficultés de transport', 'Accès limité au matériel',
                'Besoin d’aménagement pédagogique ou d’accessibilité', 'Aucune difficulté particulière'],
      sensibles: ['Horaires de travail ou responsabilités familiales', 'Besoin d’aménagement pédagogique ou d’accessibilité'] },
    { id: 'q14p', type: 'texte', max: 800, sensible: true,
      label: 'Vous pouvez préciser uniquement les informations que vous souhaitez communiquer' }
  ]},
  { id: 'VI', titre: 'Autoévaluation de l’apprenant', questions: [
    { id: 'q15', num: 15, type: 'unique', requis: true, label: 'Comment évaluez-vous votre niveau actuel dans la formation ?',
      options: ['Débutant', 'Moyen', 'Bon', 'Très bon'] },
    { id: 'q16', num: 16, type: 'unique', requis: true, label: 'Comment évaluez-vous votre motivation ?',
      options: ['Faible', 'Moyenne', 'Bonne', 'Très bonne'] },
    { id: 'q17', num: 17, type: 'unique', requis: true, label: 'Pensez-vous pouvoir atteindre vos objectifs avec un accompagnement adapté ?',
      options: ['Oui', 'Non', 'Je ne sais pas encore'] },
    { id: 'q18', num: 18, type: 'texte', label: 'Quelle est la principale amélioration que vous souhaitez constater dans votre parcours ?' }
  ]},
  { id: 'VII', titre: 'Autres besoins ou suggestions', questions: [
    { id: 'q19', type: 'texte', sensible: true,
      label: 'Avez-vous d’autres besoins, préoccupations ou suggestions à communiquer à l’établissement ?' }
  ]}
];

/* ============================ OUTILS ============================ */

function _questionsBesoins() {
  const toutes = [];
  BESOINS_SCHEMA.forEach(s => s.questions.forEach(q => toutes.push(q)));
  return toutes;
}

function _feuilleBesoins() {
  return _feuilleFormation(BESOINS.FEUILLE, ENTETES_BESOINS);
}

function _jsonSur(v) {
  try { const o = JSON.parse(String(v || '')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}

function _isoDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function _ligneVersFiche(r, i) {
  return {
    ligne: i + 1,
    id: String(r[0] || ''), dossierId: String(r[1] || ''), apprenant: String(r[2] || ''),
    filieres: String(r[3] || '').split(' | ').map(s => s.trim()).filter(Boolean),
    annee: String(r[4] || ''), statut: String(r[5] || 'À remplir'),
    envoyeeLe: _isoDate(r[6]), envoyeePar: String(r[7] || ''),
    relances: Number(r[8]) || 0, derniereRelance: _isoDate(r[9]), soumiseLe: _isoDate(r[10]),
    pedago: _jsonSur(r[11]), sensible: _jsonSur(r[12]), besoinParticulier: String(r[13] || '') === 'Oui',
    corrections: String(r[14] || ''), confirmation: String(r[15] || ''),
    suivi: _jsonSur(r[16]), suiviPar: String(r[17] || ''), suiviLe: _isoDate(r[18]), majLe: _isoDate(r[19])
  };
}

function _lireFiches() {
  const f = _feuilleBesoins();
  if (!f) return [];
  return f.getDataRange().getValues().map(_ligneVersFiche).slice(1).filter(x => x.id);
}

// Année de formation au format "2026 / 2027" (rentrée en septembre).
function _anneeFormation(dateIso) {
  const m = String(dateIso || '').match(/^(\d{4})-(\d{2})/);
  const d = m ? { y: Number(m[1]), mo: Number(m[2]) } : { y: new Date().getFullYear(), mo: new Date().getMonth() + 1 };
  const debut = d.mo >= 9 ? d.y : d.y - 1;
  return debut + ' / ' + (debut + 1);
}

function _lignesInscriptions() {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  const feuille = ss && ss.getSheetByName('Toutes les inscriptions');
  return feuille ? feuille.getDataRange().getValues().slice(1) : [];
}

function _ligneDossier(id) {
  return _lignesInscriptions().filter(r => String(r[0] || '').trim() === String(id))[0] || null;
}

function _jjmmaaaa(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

// Données du dossier d'inscription, pré-remplies dans la partie I
// (l'apprenant ne ressaisit rien ; il signale seulement une correction).
function _identificationDossier(row) {
  const a = _mapperApprenantInscription(row);
  const naissance = _dateIso(row[5]);
  let age = '';
  if (naissance) {
    const n = new Date(naissance + 'T12:00:00'), auj = new Date();
    age = auj.getFullYear() - n.getFullYear() - ((auj.getMonth() < n.getMonth() || (auj.getMonth() === n.getMonth() && auj.getDate() < n.getDate())) ? 1 : 0);
  }
  const contacts = [[19, 20, 21, 'Tuteur'], [11, 12, 13, 'Mère'], [15, 16, 17, 'Père']]
    .map(c => ({ nom: (String(row[c[0]] || '') + ' ' + String(row[c[1]] || '')).trim(), tel: String(row[c[2]] || '').trim(), lien: c[3] }))
    .filter(c => c.nom || c.tel);
  const contact = contacts[0] || { nom: '', tel: '', lien: '' };
  return {
    code: a.id, nom: (a.prenom + ' ' + a.nom).trim(), sexe: a.sexe,
    dateNaissance: _jjmmaaaa(naissance), age: age === '' ? '' : String(age),
    telephone: a.telephone, adresse: String(row[8] || ''), formation: a.filiere,
    dateInscription: _jjmmaaaa(_dateIso(row[1])), dateEntree: _jjmmaaaa(_dateIso(a.dateEntree)),
    contactNom: contact.nom + (contact.lien ? ' (' + contact.lien + ')' : ''), contactTel: contact.tel
  };
}

// Vue réduite pour le formateur (pas d'adresse, de naissance ni de contacts).
function _identificationFormateur(row) {
  const a = _mapperApprenantInscription(row);
  return { code: a.id, nom: (a.prenom + ' ' + a.nom).trim(), formation: a.filiere, dateEntree: _jjmmaaaa(_dateIso(a.dateEntree)) };
}

/* ==================== VALIDATION DES RÉPONSES ==================== */

// Nettoie les réponses envoyées par la page : seules les options prévues
// sont gardées, les questions masquées (condition "si") sont vidées.
// Renvoie aussi la liste des questions obligatoires sans réponse.
function _normaliserReponses(brut) {
  const src = brut && typeof brut === 'object' ? brut : {};
  const rep = {}, manquants = [];
  _questionsBesoins().forEach(q => {
    if (q.si) {
      const parent = rep[q.si.q];
      if (!parent || parent.choix !== q.si.vaut) return;
    }
    const v = src[q.id] && typeof src[q.id] === 'object' ? src[q.id] : {};
    const intitule = q.num ? 'question ' + q.num : '« ' + q.label + ' »';
    if (q.type === 'texte') {
      const t = _txtF(v.texte, q.max || BESOINS.TEXTE_MAX);
      if (t) rep[q.id] = { texte: t };
      else if (q.requis) manquants.push(intitule);
      return;
    }
    const permis = q.options.slice();
    if (q.autre) permis.push('Autre');
    const autre = q.autre ? _txtF(v.autre, BESOINS.AUTRE_MAX) : '';
    if (q.type === 'unique') {
      const c = String(v.choix || '');
      if (permis.indexOf(c) === -1) { if (q.requis) manquants.push(intitule); return; }
      if (c === 'Autre' && !autre) { manquants.push(intitule + ' (précisez « Autre »)'); }
      rep[q.id] = c === 'Autre' ? { choix: c, autre: autre } : { choix: c };
      return;
    }
    // multiple
    let choix = (Array.isArray(v.choix) ? v.choix : []).map(String).filter((c, i, t) => permis.indexOf(c) !== -1 && t.indexOf(c) === i);
    if (q.exclusif && choix.indexOf(q.exclusif) !== -1 && choix.length > 1) choix = choix.filter(c => c !== q.exclusif);
    choix.sort((x, y) => permis.indexOf(x) - permis.indexOf(y));
    if (!choix.length) { if (q.requis) manquants.push(intitule); return; }
    if (choix.indexOf('Autre') !== -1 && !autre) manquants.push(intitule + ' (précisez « Autre »)');
    rep[q.id] = choix.indexOf('Autre') !== -1 ? { choix: choix, autre: autre } : { choix: choix };
  });
  return { reponses: rep, manquants: manquants };
}

// Sépare les réponses pédagogiques (formateur) des réponses confidentielles (admin).
function _separerReponses(rep) {
  const pedago = {}, sensible = {};
  _questionsBesoins().forEach(q => {
    const v = rep[q.id];
    if (!v) return;
    if (q.sensible) { sensible[q.id] = v; return; }
    if (q.type !== 'multiple' || (!q.sensibles && !q.autreSensible)) { pedago[q.id] = v; return; }
    const estSensible = c => (q.sensibles || []).indexOf(c) !== -1 || (c === 'Autre' && q.autreSensible);
    const p = v.choix.filter(c => !estSensible(c)), s = v.choix.filter(estSensible);
    if (p.length) pedago[q.id] = { choix: p };
    if (s.length) sensible[q.id] = s.indexOf('Autre') !== -1 ? { choix: s, autre: v.autre || '' } : { choix: s };
    if (pedago[q.id] && p.indexOf('Autre') !== -1) pedago[q.id].autre = v.autre || '';
  });
  return { pedago: pedago, sensible: sensible, signal: Object.keys(sensible).length > 0 };
}

// Réponses complètes (apprenant lui-même et admin).
function _fusionnerReponses(pedago, sensible) {
  const tout = {};
  _questionsBesoins().forEach(q => {
    const p = pedago[q.id], s = sensible[q.id];
    if (!p && !s) return;
    if (q.type !== 'multiple' || !p || !s) { tout[q.id] = p || s; return; }
    const permis = q.options.concat(['Autre']);
    const choix = p.choix.concat(s.choix).sort((x, y) => permis.indexOf(x) - permis.indexOf(y));
    tout[q.id] = { choix: choix };
    if (p.autre || s.autre) tout[q.id].autre = p.autre || s.autre;
  });
  return tout;
}

function _normaliserSuivi(brut) {
  const s = brut && typeof brut === 'object' ? brut : {};
  const permis = BESOINS.MESURES.concat(['Autre']);
  const mesures = (Array.isArray(s.mesures) ? s.mesures : []).map(String).filter((m, i, t) => permis.indexOf(m) !== -1 && t.indexOf(m) === i);
  const date = String(s.dateSuivi || '');
  return {
    synthese: _txtF(s.synthese, 2000),
    difficultes: _txtF(s.difficultes, 2000),
    mesures: mesures,
    mesureAutre: mesures.indexOf('Autre') !== -1 ? _txtF(s.mesureAutre, BESOINS.AUTRE_MAX) : '',
    dateSuivi: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    observations: _txtF(s.observations, 3000)
  };
}

/* ============================ EMAILS ============================ */

function _gabaritBesoins(bandeau, titre, contenuHtml) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;">
  <tr><td style="background:${CONFIG.COULEUR_DARK};padding:26px 32px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60" style="border-radius:8px;display:block;margin:0 auto 10px;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;">${bandeau}</h1>
  </td></tr>
  <tr><td style="padding:30px 32px;font-size:15px;color:#444;line-height:1.7;">
    <h2 style="margin:0 0 14px;font-size:17px;color:${CONFIG.COULEUR_DARK};">${titre}</h2>
    ${contenuHtml}
  </td></tr>
  <tr><td style="background:#F8FAFA;padding:16px 32px;font-size:12px;color:#6B7280;text-align:center;">
    Les Qualités de Dieu Service SARL — Comé, Bénin — +229 01 97 95 12 30
  </td></tr>
</table></td></tr></table></body></html>`;
}

// Invitation (ou relance) à remplir la fiche. Plusieurs destinataires :
// un seul email en copie cachée, pour ne pas épuiser le quota Gmail.
function _emailFicheApprenants(emails, relance) {
  const liste = emails.filter(_emailValide).filter((e, i, t) => t.indexOf(e) === i);
  if (!liste.length) return 0;
  if (MailApp.getRemainingDailyQuota() < 1) return 0;
  const titre = relance ? 'Rappel : votre fiche de besoins attend vos réponses' : 'Votre fiche de recueil des besoins';
  const corps = `<p>Bonjour,</p>
<p>Pour adapter votre accompagnement, votre formateur vous invite à remplir la <strong>fiche individuelle de recueil des besoins</strong>.</p>
<p>Comptez une dizaine de minutes. Vous pouvez enregistrer un brouillon et revenir plus tard. Vos réponses sont traitées avec discrétion.</p>
<p style="margin:18px 0 0;"><a href="${CONFIG.SITE_URL}/espace-apprenant" style="display:inline-block;background:${CONFIG.COULEUR_TEAL};color:#FFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Remplir ma fiche</a></p>
<p style="font-size:13px;color:#6B7280;">Espace apprenant > onglet « Ma fiche ».</p>`;
  const opts = { htmlBody: _gabaritBesoins('Espace apprenant — LQD Service', titre, corps), name: CONFIG.EXPEDITEUR_NOM, replyTo: CONFIG.ADMIN_EMAIL };
  if (liste.length === 1) GmailApp.sendEmail(liste[0], titre, corps.replace(/<[^>]+>/g, ' '), opts);
  else GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, titre, corps.replace(/<[^>]+>/g, ' '), Object.assign({ bcc: liste.join(',') }, opts));
  return liste.length;
}

/* ===================== CRÉATION / ENVOI DES FICHES ===================== */

// Crée les fiches manquantes (une par dossier et par année de formation).
// rows : lignes de "Toutes les inscriptions". Renvoie {crees, emails, sansEmail}.
function _creerFiches(rows, par) {
  const feuille = _feuilleBesoins();
  if (!feuille) return { crees: 0, emails: 0, sansEmail: 0 };
  const existantes = {};
  _lireFiches().forEach(f => { existantes[f.dossierId + '|' + f.annee] = true; });
  const maintenant = new Date(), lignes = [], emails = [];
  let sansEmail = 0;
  rows.forEach(r => {
    const a = _mapperApprenantInscription(r);
    const annee = _anneeFormation(_dateIso(a.dateEntree));
    const cle = a.id + '|' + annee;
    if (!a.id || existantes[cle]) return;
    existantes[cle] = true;
    lignes.push(['FB-' + Utilities.formatDate(maintenant, 'Africa/Porto-Novo', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase(),
      a.id, (a.prenom + ' ' + a.nom).trim(), clesFilieres(String(r[22] || '')).join(' | '), annee, 'À remplir',
      maintenant, par, 0, '', '', '', '', '', '', '', '', '', '', maintenant]);
    const mail = String(r[10] || '').trim().toLowerCase();
    if (_emailValide(mail)) emails.push(mail); else sansEmail++;
  });
  _ajouterLignes(feuille, lignes);
  let envoyes = 0;
  try { envoyes = _emailFicheApprenants(emails, false); } catch (e) { console.error('[_creerFiches email]', e.toString()); }
  return { crees: lignes.length, emails: envoyes, sansEmail: sansEmail };
}

// Appelée par adminUpdateStatut (admin.gs) au passage à "Confirmé".
function besoinsEnvoiAutomatique(row) {
  try { return _creerFiches([row], 'Automatique (confirmation)'); }
  catch (e) { console.error('[besoinsEnvoiAutomatique]', e.toString()); return { crees: 0 }; }
}

function _ecrireFiche(fiche, valeurs) {
  const feuille = _feuilleBesoins();
  Object.keys(valeurs).forEach(col => feuille.getRange(fiche.ligne, Number(col) + 1).setValue(valeurs[col]));
  feuille.getRange(fiche.ligne, 20).setValue(new Date());
}

function _resumeFiche(f) {
  return { id: f.id, dossierId: f.dossierId, apprenant: f.apprenant, annee: f.annee, statut: f.statut,
    filieres: f.filieres.map(k => nomAffichagePublic(k)).join(' | '),
    envoyeeLe: f.envoyeeLe, envoyeePar: f.envoyeePar, relances: f.relances, derniereRelance: f.derniereRelance,
    soumiseLe: f.soumiseLe, besoinParticulier: f.besoinParticulier, suiviLe: f.suiviLe, suiviPar: f.suiviPar,
    dateSuivi: f.suivi.dateSuivi || '' };
}

// Fiche la plus récente d'un dossier.
function _ficheDuDossier(id) {
  return _lireFiches().filter(f => f.dossierId === String(id)).sort((a, b) => String(b.envoyeeLe).localeCompare(String(a.envoyeeLe)))[0] || null;
}

/* ========================= CÔTÉ APPRENANT ========================= */

function besoinsMaFiche(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const fiche = _ficheDuDossier(session.apprenant.id);
  if (!fiche) return reponseJSON({ status: 'success', fiche: null, schema: BESOINS_SCHEMA });
  const row = _ligneDossier(session.apprenant.id);
  return reponseJSON({ status: 'success', schema: BESOINS_SCHEMA,
    fiche: { id: fiche.id, annee: fiche.annee, statut: fiche.statut, soumiseLe: fiche.soumiseLe,
      reponses: _fusionnerReponses(fiche.pedago, fiche.sensible), corrections: fiche.corrections,
      modifiable: fiche.statut === 'À remplir' || fiche.statut === 'Brouillon',
      identification: row ? _identificationDossier(row) : {} } });
}

function besoinsEnregistrer(data) {
  const session = _sessionApprenant(data.token);
  if (session.erreur) return _reponseSession(session);
  const fiche = _ficheDuDossier(session.apprenant.id);
  if (!fiche || String(data.ficheId || '') !== fiche.id) return reponseJSON({ status: 'error', message: 'Fiche introuvable. Actualisez la page.' });
  if (fiche.statut !== 'À remplir' && fiche.statut !== 'Brouillon') {
    return reponseJSON({ status: 'error', message: 'Cette fiche a déjà été envoyée. Pour la corriger, contactez votre formateur ou l\'administration.' });
  }
  const n = _normaliserReponses(data.reponses);
  const soumettre = data.soumettre === true;
  if (soumettre && n.manquants.length) {
    return reponseJSON({ status: 'error', message: 'Il manque des réponses : ' + n.manquants.join(', ') + '.', manquants: n.manquants });
  }
  if (soumettre && data.confirmation !== true) {
    return reponseJSON({ status: 'error', message: 'Cochez la case de confirmation avant d\'envoyer votre fiche.' });
  }
  const sep = _separerReponses(n.reponses);
  const corrections = _txtF(data.corrections, 800);
  const maintenant = new Date();
  const valeurs = { 5: soumettre ? 'Soumise' : 'Brouillon', 11: JSON.stringify(sep.pedago), 12: JSON.stringify(sep.sensible),
    13: sep.signal ? 'Oui' : '', 14: corrections };
  if (soumettre) {
    valeurs[10] = maintenant;
    valeurs[15] = 'Confirmé par l\'apprenant le ' + Utilities.formatDate(maintenant, 'Africa/Porto-Novo', 'dd/MM/yyyy à HH:mm');
  }
  _ecrireFiche(fiche, valeurs);
  if (soumettre) {
    try { _notifierFicheSoumise(fiche, session.apprenant, sep.signal || !!corrections); }
    catch (e) { console.error('[besoinsEnregistrer notif]', e.toString()); }
  }
  return reponseJSON({ status: 'success', statut: valeurs[5],
    message: soumettre ? 'Merci ! Votre fiche a bien été envoyée.' : 'Brouillon enregistré.' });
}

function _notifierFicheSoumise(fiche, apprenant, pourAdmin) {
  const nom = (apprenant.prenom + ' ' + apprenant.nom).trim();
  _lireFormateurs().filter(f => f.statut === 'Actif' && f.filieres.some(k => fiche.filieres.indexOf(k) !== -1)).forEach(f => {
    try {
      _emailFormateur(f.email, 'Fiche de besoins reçue : ' + nom, 'Une fiche de besoins vient d\'être remplie',
        `<p>Bonjour ${f.prenom},</p><p><strong>${nom}</strong> (${apprenant.filiere}) a envoyé sa fiche de recueil des besoins.</p><p>Consultez-la et complétez le cadre de suivi dans votre espace, onglet « Fiches besoins ».</p><p><a href="${CONFIG.SITE_URL}/espace-formateur" style="color:${CONFIG.COULEUR_TEAL};font-weight:700;">Ouvrir mon espace formateur</a></p>`);
    } catch (e) { console.error('[_notifierFicheSoumise]', f.email, e.toString()); }
  });
  if (pourAdmin) {
    GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, 'Fiche de besoins : information confidentielle — ' + nom,
      nom + ' a signalé un besoin particulier ou une correction de ses données. Admin > Fiches besoins.', {
        htmlBody: _gabaritBesoins('Administration — LQD Service', 'Information confidentielle à consulter',
          `<p><strong>${nom}</strong> (dossier ${fiche.dossierId}) a envoyé sa fiche de besoins avec un besoin particulier (santé, accessibilité, finances, contraintes) ou une correction de ses données.</p><p>Le formateur ne voit pas ce détail. Consultez la fiche dans <strong>Admin > Fiches besoins</strong>.</p>`),
        name: CONFIG.EXPEDITEUR_NOM });
  }
}

/* ========================= CÔTÉ FORMATEUR ========================= */

function _ficheVisiblePourFormateur(f, fiche) {
  return fiche && fiche.filieres.some(k => f.filieres.indexOf(k) !== -1);
}

// Statistiques de groupe (réponses pédagogiques des fiches envoyées).
function _statsGroupe(fiches) {
  const recues = fiches.filter(x => x.statut === 'Soumise' || x.statut === 'Traitée');
  const stats = { fichesRecues: recues.length, besoinsParticuliers: recues.filter(x => x.besoinParticulier).length, questions: [] };
  _questionsBesoins().filter(q => q.type !== 'texte' && !q.sensible).forEach(q => {
    const comptes = {};
    recues.forEach(x => {
      const v = x.pedago[q.id];
      if (!v) return;
      (Array.isArray(v.choix) ? v.choix : [v.choix]).forEach(c => { comptes[c] = (comptes[c] || 0) + 1; });
    });
    const options = q.options.concat(q.autre ? ['Autre'] : []).filter(o => (q.sensibles || []).indexOf(o) === -1 && !(o === 'Autre' && q.autreSensible));
    stats.questions.push({ id: q.id, num: q.num || null, label: q.label, options: options.map(o => ({ libelle: o, nombre: comptes[o] || 0 })) });
  });
  return stats;
}

function formateurBesoinsLister(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const fiches = _lireFiches().filter(x => _ficheVisiblePourFormateur(f, x));
  const parDossier = {};
  fiches.forEach(x => { if (!parDossier[x.dossierId] || String(x.envoyeeLe) > String(parDossier[x.dossierId].envoyeeLe)) parDossier[x.dossierId] = x; });
  const apprenants = _apprenantsDuFormateur(f).filter(a => a.phase !== 'termine').map(a => ({
    dossierId: a.id, nom: (a.prenom + ' ' + a.nom).trim(), filiere: a.filiere, phase: a.phase, nouveau: a.nouveau,
    email: !!a.email, fiche: parDossier[a.id] ? _resumeFiche(parDossier[a.id]) : null
  }));
  const ids = apprenants.map(a => a.dossierId);
  return reponseJSON({ status: 'success', apprenants: apprenants, schema: BESOINS_SCHEMA,
    stats: _statsGroupe(fiches.filter(x => ids.indexOf(x.dossierId) !== -1)) });
}

function formateurBesoinsEnvoyer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const f = s.formateur;
  const voulus = (Array.isArray(data.dossierIds) ? data.dossierIds : []).map(String).slice(0, 300);
  if (!voulus.length) return reponseJSON({ status: 'error', message: 'Sélectionnez au moins un apprenant.' });
  const autorises = {};
  _apprenantsDuFormateur(f).filter(a => a.phase !== 'termine').forEach(a => { autorises[a.id] = true; });
  const rows = _lignesInscriptions().filter(r => voulus.indexOf(String(r[0]).trim()) !== -1 && autorises[String(r[0]).trim()]);
  if (!rows.length) return reponseJSON({ status: 'error', message: 'Aucun de ces apprenants n\'est en formation dans vos filières.' });
  const r = _creerFiches(rows, 'Formateur : ' + f.prenom + ' ' + f.nom);
  return reponseJSON({ status: 'success', crees: r.crees, emails: r.emails, sansEmail: r.sansEmail,
    message: r.crees ? r.crees + ' fiche(s) envoyée(s)' + (r.sansEmail ? ' — ' + r.sansEmail + ' apprenant(s) sans email : prévenez-les en classe ou par WhatsApp.' : '.')
                     : 'Ces apprenants ont déjà une fiche pour cette année.' });
}

function _relancerFiche(fiche) {
  if (fiche.statut !== 'À remplir' && fiche.statut !== 'Brouillon') return { erreur: 'Cette fiche a déjà été envoyée par l\'apprenant.' };
  if (fiche.derniereRelance && Date.now() - new Date(fiche.derniereRelance).getTime() < BESOINS.RELANCE_HEURES * 3600000) {
    return { erreur: 'Une relance a déjà été envoyée il y a moins de 24 h.' };
  }
  const row = _ligneDossier(fiche.dossierId);
  const mail = row ? String(row[10] || '').trim().toLowerCase() : '';
  if (!_emailValide(mail)) return { erreur: 'Cet apprenant n\'a pas d\'email : prévenez-le en classe ou par WhatsApp.' };
  _emailFicheApprenants([mail], true);
  _ecrireFiche(fiche, { 8: fiche.relances + 1, 9: new Date() });
  return { ok: true };
}

function formateurBesoinsRelancer(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!_ficheVisiblePourFormateur(s.formateur, fiche)) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  const r = _relancerFiche(fiche);
  if (r.erreur) return reponseJSON({ status: 'error', message: r.erreur });
  return reponseJSON({ status: 'success', message: 'Relance envoyée.' });
}

function formateurBesoinsGet(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!_ficheVisiblePourFormateur(s.formateur, fiche)) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  const row = _ligneDossier(fiche.dossierId);
  // Réponses PÉDAGOGIQUES uniquement : jamais fiche.sensible ni fiche.corrections.
  return reponseJSON({ status: 'success', schema: BESOINS_SCHEMA,
    fiche: Object.assign(_resumeFiche(fiche), { reponses: fiche.pedago, suivi: fiche.suivi, confirmation: fiche.confirmation,
      identification: row ? _identificationFormateur(row) : { code: fiche.dossierId, nom: fiche.apprenant }, vueFormateur: true }) });
}

function _enregistrerSuivi(fiche, suiviBrut, auteur) {
  if (fiche.statut !== 'Soumise' && fiche.statut !== 'Traitée') return { erreur: 'L\'apprenant n\'a pas encore envoyé sa fiche.' };
  const suivi = _normaliserSuivi(suiviBrut);
  if (!suivi.synthese && !suivi.difficultes && !suivi.mesures.length && !suivi.observations) {
    return { erreur: 'Renseignez au moins la synthèse, les difficultés, une mesure ou une observation.' };
  }
  if (suivi.mesures.indexOf('Autre') !== -1 && !suivi.mesureAutre) return { erreur: 'Précisez la mesure « Autre ».' };
  _ecrireFiche(fiche, { 5: 'Traitée', 16: JSON.stringify(suivi), 17: auteur, 18: new Date() });
  return { ok: true };
}

function formateurBesoinsSuivi(data) {
  const s = _sessionFormateur(data.token);
  if (s.erreur) return _erreurSession(s);
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!_ficheVisiblePourFormateur(s.formateur, fiche)) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  const r = _enregistrerSuivi(fiche, data.suivi, 'Formateur : ' + s.formateur.prenom + ' ' + s.formateur.nom);
  if (r.erreur) return reponseJSON({ status: 'error', message: r.erreur });
  return reponseJSON({ status: 'success', message: 'Suivi enregistré.' });
}

/* =========================== CÔTÉ ADMIN =========================== */

function adminBesoinsLister(data, email) {
  const filiere = data.filiere ? cleFiliere(data.filiere) : '';
  const fiches = _lireFiches().filter(x => !filiere || x.filieres.indexOf(filiere) !== -1);
  // Apprenants en formation sans fiche (pour l'envoi groupé).
  const avecFiche = {};
  fiches.forEach(x => { avecFiche[x.dossierId] = true; });
  let sansFiche = 0;
  _lignesInscriptions().forEach(r => {
    const id = String(r[0] || '').trim(), statut = String(r[28] || '').trim();
    if (!id || id === 'LQD-EXEMPLE' || FORMATEURS.STATUTS_APPRENANT.indexOf(statut) === -1 || avecFiche[id]) return;
    if (filiere && clesFilieres(String(r[22] || '')).indexOf(filiere) === -1) return;
    const a = _mapperApprenantInscription(r);
    if (_phaseApprenant(statut, _dateIso(a.dateEntree), _dateIso(a.dateFin)) !== 'termine') sansFiche++;
  });
  return reponseJSON({ status: 'success', fiches: fiches.map(_resumeFiche).sort((a, b) => String(b.envoyeeLe).localeCompare(String(a.envoyeeLe))),
    sansFiche: sansFiche, stats: _statsGroupe(fiches), schema: BESOINS_SCHEMA });
}

function adminBesoinsGet(data, email) {
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!fiche) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  const row = _ligneDossier(fiche.dossierId);
  return reponseJSON({ status: 'success', schema: BESOINS_SCHEMA,
    fiche: Object.assign(_resumeFiche(fiche), { reponses: _fusionnerReponses(fiche.pedago, fiche.sensible),
      sensibles: Object.keys(fiche.sensible), corrections: fiche.corrections, suivi: fiche.suivi, confirmation: fiche.confirmation,
      identification: row ? _identificationDossier(row) : { code: fiche.dossierId, nom: fiche.apprenant } }) });
}

function adminBesoinsSuivi(data, email) {
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!fiche) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  const r = _enregistrerSuivi(fiche, data.suivi, 'Administration : ' + email);
  if (r.erreur) return reponseJSON({ status: 'error', message: r.erreur });
  return reponseJSON({ status: 'success', message: 'Suivi enregistré.' });
}

// Rouvre une fiche envoyée pour que l'apprenant la corrige (le cadre VIII est conservé).
function adminBesoinsRouvrir(data, email) {
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!fiche) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  if (fiche.statut !== 'Soumise' && fiche.statut !== 'Traitée') return reponseJSON({ status: 'error', message: 'La fiche est déjà modifiable par l\'apprenant.' });
  _ecrireFiche(fiche, { 5: 'Brouillon', 15: '' });
  return reponseJSON({ status: 'success', message: 'Fiche rouverte : l\'apprenant peut la corriger puis la renvoyer.' });
}

function adminBesoinsRelancer(data, email) {
  const fiche = _lireFiches().filter(x => x.id === String(data.ficheId || ''))[0];
  if (!fiche) return reponseJSON({ status: 'error', message: 'Fiche introuvable.' });
  const r = _relancerFiche(fiche);
  if (r.erreur) return reponseJSON({ status: 'error', message: r.erreur });
  return reponseJSON({ status: 'success', message: 'Relance envoyée.' });
}

// Envoi groupé aux apprenants en formation qui n'ont pas encore de fiche.
function adminBesoinsEnvoyer(data, email) {
  const filiere = data.filiere ? cleFiliere(data.filiere) : '';
  const rows = _lignesInscriptions().filter(r => {
    const id = String(r[0] || '').trim(), statut = String(r[28] || '').trim();
    if (!id || id === 'LQD-EXEMPLE' || FORMATEURS.STATUTS_APPRENANT.indexOf(statut) === -1) return false;
    if (filiere && clesFilieres(String(r[22] || '')).indexOf(filiere) === -1) return false;
    const a = _mapperApprenantInscription(r);
    return _phaseApprenant(statut, _dateIso(a.dateEntree), _dateIso(a.dateFin)) !== 'termine';
  });
  const r = _creerFiches(rows, 'Administration : ' + email);
  return reponseJSON({ status: 'success', crees: r.crees,
    message: r.crees ? r.crees + ' fiche(s) envoyée(s)' + (r.sansEmail ? ' — ' + r.sansEmail + ' apprenant(s) sans email.' : '.') : 'Tous les apprenants en formation ont déjà leur fiche.' });
}

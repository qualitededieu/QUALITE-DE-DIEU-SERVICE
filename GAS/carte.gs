const CARTE_CONFIG = {
  SECRET:      'lqd-carte-secret-2026-Xm7kP9nQ2rW4vZ6j',
  VERIF_URL:   'https://www.qualitededieuservice.com/verifier.html',
  VERSION:     '1.0'
};

function _normaliserTel(tel) {
  let s = String(tel || '').replace(/\D/g, '');
  if (s.indexOf('00229') === 0) s = s.slice(5);
  else if (s.indexOf('229') === 0 && s.length > 10) s = s.slice(3);
  return s;
}

function _formesTelephone(tel) {
  const base   = _normaliserTel(tel);
  const formes = [base];
  if (base.length === 8) formes.push('01' + base);
  if (base.length === 10 && base.indexOf('01') === 0) formes.push(base.slice(2));
  return formes;
}

function _telephonesEquivalents(telA, telB) {
  const formesA = _formesTelephone(telA);
  const formesB = _formesTelephone(telB);
  return formesA.some(f => formesB.indexOf(f) !== -1);
}

function _telephoneSembleIncomplet(tel) {
  return _normaliserTel(tel).length === 8;
}

// Dossier retrouvé par son ID, mais AUCUN téléphone n'est enregistré sur
// la ligne — cas différent d'un téléphone simplement mal saisi (aucune
// nouvelle tentative de saisie ne pourra jamais correspondre). Ne peut
// venir que d'une inscription prise en présentiel et retranscrite dans
// le tableur sans ce champ — à corriger en présentiel, pas en ligne.
function _messageDossierSansTelephone() {
  return "Aucun numéro de téléphone n'est enregistré pour ce dossier. Veuillez vous rendre au centre de formation Les Qualités de Dieu Service Sarl ou contacter le service au 01 97 95 12 30 pour le mettre à jour.";
}

function getCarte(data) {
  // Interrupteur temporaire — le site étant en construction, on peut
  // couper l'accès public à l'espace apprenant sans toucher au code.
  // Activer : Propriétés du script → TELECHARGEMENT_BLOQUE = true
  // (Le bouton "Générer" côté admin n'est PAS concerné par ce verrou —
  // voir adminApercuAttestation dans admin.gs.)
  const bloque = PropertiesService.getScriptProperties().getProperty('TELECHARGEMENT_BLOQUE') === 'true';
  if (bloque) {
    return reponseJSON({
      status: 'error',
      message: "L'espace apprenant est temporairement indisponible — le site est en cours de finalisation. Merci de réessayer bientôt."
    });
  }

  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  let idTrouveTelIncorrect  = false;
  let idTrouveSansTelephone = false;

  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;

      const idRow  = String(row[0]).trim();
      if (idRow !== id) continue;

      const telRow = String(row[9] || '').trim();
      if (!telRow) { idTrouveSansTelephone = true; continue; }
      if (!_telephonesEquivalents(telRow, telephone)) { idTrouveTelIncorrect = true; continue; }

      const statut = String(row[28] || '').trim();
      if (statut !== 'Confirmé' && statut !== 'Migré' && statut !== 'Terminé') continue;

      const apprenant = _mapperApprenantInscription(row);
      const token     = _genererTokenCarte(apprenant);

      return reponseJSON({ status: 'success', apprenant, token });
    }
  }

  if (idTrouveSansTelephone) {
    return reponseJSON({ status: 'error', message: _messageDossierSansTelephone() });
  }
  if (idTrouveTelIncorrect && _telephoneSembleIncomplet(telephone)) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas. Au Bénin, les numéros commencent maintenant par 01 — vérifiez que votre numéro est bien précédé de 01 (ex : 01 97 95 12 30).' });
  }
  if (idTrouveTelIncorrect) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas.' });
  }

  if (_telephoneSembleIncomplet(telephone)) {
    return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Au Bénin, les numéros commencent maintenant par 01 — vérifiez que votre numéro est bien précédé de 01 (ex : 01 97 95 12 30).' });
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier trouvé. Vérifiez votre numéro et téléphone.' });
}

// ================================================================
// ANCIEN APPRENANT — CANDIDATURE DE STAGE
// Vérifie qu'un dossier ID + téléphone correspond bien à un apprenant
// du centre dont la formation est réellement TERMINÉE (date de fin
// dépassée), avant de lui ouvrir le parcours de candidature "stage"
// allégé sur postuler.html. Volontairement plus stricte que getCarte
// (qui accepte aussi 'Confirmé' en cours) : ici on exige que la
// formation soit effectivement achevée, sans quoi le formulaire
// laisserait passer quelqu'un qui n'a pas fini son cursus.
// ================================================================
function verifierAncienApprenant(data) {
  const id        = String(data.id        || '').trim();
  const telephone = String(data.telephone || '').trim();

  if (!id || !telephone) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier et téléphone requis.' });
  }

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Erreur serveur.' });

  let idTrouveTelIncorrect  = false;
  let idTrouveSansTelephone = false;
  let idTrouveNonTermine    = false;
  let idTrouveStatutInvalide = false;
  let idTrouveDateIllisible  = false;

  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      const row = donnees[i];
      if (!row[0] || row[0] === 'LQD-EXEMPLE') continue;

      const idRow = String(row[0]).trim();
      if (idRow !== id) continue;

      const telRow = String(row[9] || '').trim();
      if (!telRow) { idTrouveSansTelephone = true; continue; }
      if (!_telephonesEquivalents(telRow, telephone)) { idTrouveTelIncorrect = true; continue; }

      const statut = String(row[28] || '').trim();
      if (statut !== 'Confirmé' && statut !== 'Migré' && statut !== 'Terminé') { idTrouveStatutInvalide = true; continue; }

      const apprenant = _mapperApprenantInscription(row);

      const finFormation = apprenant.dateFin ? new Date(apprenant.dateFin) : null;
      if (!finFormation || isNaN(finFormation.getTime())) { idTrouveDateIllisible = true; continue; }
      const aujourdHui = new Date();
      aujourdHui.setHours(0, 0, 0, 0);
      finFormation.setHours(0, 0, 0, 0);
      if (aujourdHui < finFormation) { idTrouveNonTermine = true; continue; }

      return reponseJSON({
        status:     'success',
        apprenant: {
          id:       apprenant.id,
          prenom:   apprenant.prenom,
          nom:      apprenant.nom,
          telephone: apprenant.telephone,
          filiere:  apprenant.filiere,
          dateFin:  apprenant.dateFin
        }
      });
    }
  }

  // Diagnostics rangés du plus précis au plus vague — un dossier
  // trouvé (même rejeté) doit toujours donner un message exploitable,
  // jamais se noyer dans le "aucun dossier trouvé" générique.
  if (idTrouveNonTermine) {
    return reponseJSON({ status: 'error', message: 'Ce dossier existe mais votre formation n\'est pas encore terminée. Vous pourrez utiliser cet espace dès la fin de votre formation.' });
  }
  if (idTrouveDateIllisible) {
    return reponseJSON({ status: 'error', message: 'Ce dossier existe mais sa date de fin de formation n\'est pas renseignée dans nos systèmes. Contactez le centre pour régulariser votre dossier avant de continuer.' });
  }
  if (idTrouveStatutInvalide) {
    return reponseJSON({ status: 'error', message: 'Ce dossier existe mais votre inscription n\'est pas encore confirmée par l\'administration. Contactez le centre si vous pensez qu\'il s\'agit d\'une erreur.' });
  }
  if (idTrouveSansTelephone) {
    return reponseJSON({ status: 'error', message: _messageDossierSansTelephone() });
  }
  if (idTrouveTelIncorrect && _telephoneSembleIncomplet(telephone)) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas. Au Bénin, les numéros commencent maintenant par 01 — vérifiez que votre numéro est bien précédé de 01 (ex : 01 97 95 12 30).' });
  }
  if (idTrouveTelIncorrect) {
    return reponseJSON({ status: 'error', message: 'Numéro de dossier reconnu, mais le téléphone ne correspond pas.' });
  }

  return reponseJSON({ status: 'error', message: 'Aucun dossier d\'apprenant LQD trouvé avec ces informations. Si vous n\'êtes pas un ancien apprenant du centre, décochez cette option et postulez normalement.' });
}

function verifierCarte(data) {
  const token = String(data.token || '').trim();
  if (!token) return reponseJSON({ status: 'error', message: 'Token manquant.' });

  const payload = _verifierTokenCarte(token);
  if (!payload) {
    return reponseJSON({ status: 'error', message: 'Carte invalide ou falsifiée.' });
  }

  const maintenant = new Date();
  const dateFin    = new Date(payload.dateFin);

  if (isNaN(dateFin.getTime())) {
  } else if (maintenant > dateFin) {
    return reponseJSON({
      status:   'expired',
      message:  'Cette carte d\'apprentissage est expirée.',
      apprenant: payload
    });
  }

  return reponseJSON({ status: 'success', apprenant: payload, valide: true });
}

// Vérification publique d'un document par son numéro de référence — imprimé
// en clair en bas de chaque attestation/fiche/badge, pour authentifier le
// document quand le QR code n'est pas scannable (photocopie, impression
// noir et blanc, appareil sans caméra). Contrairement à verifierCarte
// (token signé HMAC, connu uniquement du détenteur de la carte), l'ID est
// visible sur le document lui-même et donc devinable/énumérable : on ne
// renvoie ici QUE les champs déjà imprimés en clair sur le document —
// jamais le téléphone, la date de naissance ou la photo.
function verifierDocumentParId(data) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'Numéro de référence manquant.' });

  const trouve = _trouverLigneInscription(id);
  if (!trouve) return reponseJSON({ status: 'error', message: "Aucun document ne correspond à ce numéro de référence." });

  const statut = String(trouve.row[28] || '').trim();
  if (statut !== 'Confirmé' && statut !== 'Migré' && statut !== 'Terminé') {
    return reponseJSON({ status: 'error', message: "Ce dossier n'est pas encore confirmé — ce document ne peut pas être authentifié pour l'instant." });
  }

  const apprenant = _mapperApprenantInscription(trouve.row);
  return reponseJSON({
    status: 'success',
    document: {
      id:            apprenant.id,
      prenom:        apprenant.prenom,
      nom:           apprenant.nom,
      filiere:       apprenant.filiere,
      dateEntree:    apprenant.dateEntree,
      dateFin:       apprenant.dateFin,
      niveauAtteint: apprenant.niveauAtteint,
      source:        apprenant.source
    }
  });
}

function envoyerCarteAdmin(data, email) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return reponseJSON({ status: 'error', message: 'Spreadsheet introuvable.' });

  const apprenant = _trouverApprenantParId(ss, id);
  if (!apprenant) {
    return reponseJSON({ status: 'error', message: `Dossier ${id} introuvable.` });
  }

  if (!apprenant.email) {
    return reponseJSON({ status: 'error', message: 'Pas d\'email pour cet apprenant.' });
  }

  // GARDE-FOU CRITIQUE : c'est ICI que part le document final vers
  // l'apprenant par email — bien plus sensible que le simple aperçu
  // admin. On refuse par défaut d'envoyer une attestation "fin de
  // formation" tant que la date de fin réelle n'est pas atteinte, sauf
  // confirmation explicite de l'admin (data.forcerEnvoi === true), pour
  // les cas légitimes (ex. document intermédiaire demandé exceptionnellement).
  if (apprenant.dateFin && !data.forcerEnvoi) {
    const finFormation = new Date(apprenant.dateFin);
    if (!isNaN(finFormation.getTime())) {
      const aujourdHui = new Date();
      aujourdHui.setHours(0, 0, 0, 0);
      finFormation.setHours(0, 0, 0, 0);
      if (aujourdHui < finFormation) {
        return reponseJSON({
          status:  'confirmation_requise',
          message: `Attention : la formation de ce dossier se termine le ${apprenant.dateFin} — elle n'est pas encore finie. Envoyer quand même ?`,
          dateFin: apprenant.dateFin
        });
      }
    }
  }

  const token = _genererTokenCarte(apprenant);

  _envoyerEmailCarte(apprenant, token);

  console.log(`[Admin:${email}] Carte envoyée → ${apprenant.email} (${id})` + (data.forcerEnvoi ? ' [ENVOI FORCÉ — formation non terminée]' : ''));
  return reponseJSON({
    status:   'success',
    message:  `Carte envoyée à ${apprenant.email}`,
    apprenant,
    token
  });
}

function _trouverApprenantParId(ss, id) {
  const feuilleMaitre = ss.getSheetByName('Toutes les inscriptions');
  if (feuilleMaitre) {
    const donnees = feuilleMaitre.getDataRange().getValues();
    for (let i = 1; i < donnees.length; i++) {
      if (String(donnees[i][0]).trim() === id) {
        return _mapperApprenantInscription(donnees[i]);
      }
    }
  }

  return null;
}

function _mapperApprenantInscription(row) {
  // Dates réelles si présentes (nouveau schéma + dossiers migrés depuis
  // Régularisation) ; à défaut, estimation depuis la soumission — la durée
  // de repli dépend désormais de la/les formation(s) choisie(s) et non plus
  // d'un forfait uniforme "+1 an" (obsolète depuis la mise à jour tarifaire
  // de septembre 2026 : 6 mois pour les 3 filières classiques, 18 mois pour
  // le Pack Complet, 24 mois pour le web, 1 mois pour l'offre courte).
  const filiereLigne = String(row[22] || '');
  const estFormationCourte = filiereLigne.includes(CONFIG.FORMATION_COURTE.NOM);
  const estPackComplet     = filiereLigne.includes(CONFIG.PACK_COMPLET.NOM);

  let dateEntree = String(row[24] || '');
  let dateFin    = String(row[25] || '');

  if (!dateEntree) dateEntree = row[1] ? new Date(row[1]).toISOString().split('T')[0] : '';
  if (!dateFin && row[1]) {
    const d = new Date(row[1]);
    if (estFormationCourte) {
      d.setMonth(d.getMonth() + 1);
    } else if (estPackComplet) {
      d.setMonth(d.getMonth() + CONFIG.PACK_COMPLET.DUREE_MOIS);
    } else {
      // Plusieurs filières classiques peuvent être combinées (hors offre
      // courte et Pack Complet, tous deux exclusifs) — on retient la durée
      // la plus longue parmi celles sélectionnées, avec 6 mois en repli si
      // une formation n'est pas reconnue (ancien dossier, nom modifié...).
      const filieres = filiereLigne.split(' | ').map(f => f.trim()).filter(Boolean);
      const dureeMax = filieres.reduce((max, f) => {
        const duree = CONFIG.DUREES_FORMATIONS[f] || 6;
        return Math.max(max, duree);
      }, 6);
      d.setMonth(d.getMonth() + dureeMax);
    }
    dateFin = d.toISOString().split('T')[0];
  }

  return {
    id:            String(row[0]  || ''),
    prenom:        String(row[2]  || ''),
    nom:           String(row[3]  || ''),
    sexe:          String(row[4]  || '').trim(),
    dateNaissance: String(row[5]  || ''),
    lieuNaissance: String(row[6]  || ''),
    telephone:     String(row[9]  || ''),
    email:         String(row[10] || ''),
    // Nom d'AFFICHAGE (pas la clé technique) : ce champ alimente tout ce
    // qui est montré à l'apprenant (carte, badge, fiche, attestation,
    // espace apprenant, emails) — voir CONFIG.NOMS_AFFICHAGE_PUBLIC. La clé
    // technique (row[22] brut) ne sert qu'en interne (Sheets, filtres,
    // CONFIG) et ne doit jamais fuiter vers l'apprenant. Les dictionnaires
    // de js/attestation_generator.js (ATT_CATEGORIES_LONGUE, etc.) sont
    // volontairement indexés par ce même nom d'affichage pour rester
    // cohérents avec ce que reçoit ce champ.
    // Séparateur ' | ' (pas une virgule) : le nom d'affichage du Pack 3
    // Filières contient lui-même une virgule (voir CONFIG.NOMS_AFFICHAGE_
    // PUBLIC) — une virgule ici casserait le split(",") de
    // js/attestation_generator.js::_competencesLongue en cas de parcours
    // multi-filières.
    filiere:       String(row[22] || '').split(' | ').map(f => nomAffichagePublic(f.trim())).join(' | '),
    dateEntree:    dateEntree,
    dateFin:       dateFin,
    niveauAtteint: String(row[26] || ''),
    photoUrl:      _urlImageDriveDirecte(String(row[32] || '')),
    source:        String(row[45] || 'inscription')
  };
}

function _urlImageDriveDirecte(url) {
  if (!url) return '';
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{20,})/,
    /[?&]id=([a-zA-Z0-9_-]{20,})/
  ];
  for (const re of patterns) {
    const m = String(url).match(re);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w800`;
  }
  return url;
}

// ================================================================
// PALIER DE TÉLÉCHARGEMENT PAYANT — uniquement pour l'offre
// "Initiation rapide (1 mois)". 1er téléchargement payant (3000 F),
// puis 5 gratuits, puis paiement à nouveau (cycle de 6).
// ================================================================

// Retrouve la ligne + la feuille d'un apprenant par ID. Renvoyé une
// seule fois ici pour éviter de dupliquer la recherche dans les 3
// fonctions ci-dessous.
function _trouverLigneInscription(id) {
  const ss = trouverSpreadsheet(CONFIG.SPREADSHEET_NAME);
  if (!ss) return null;
  const feuille = ss.getSheetByName('Toutes les inscriptions');
  if (!feuille) return null;

  const donnees = feuille.getDataRange().getValues();
  for (let i = 1; i < donnees.length; i++) {
    if (String(donnees[i][0]).trim() === id) {
      return { feuille, ligneIndex: i + 1, row: donnees[i] };
    }
  }
  return null;
}

function verifierAccesTelechargement(data) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  // 'attestation' par défaut si le frontend n'envoie rien (anciens
  // appels) — c'est le document le plus strict, donc le repli le plus
  // sûr si jamais le type se perd en route.
  const type = String(data.type || 'attestation').trim();

  const trouve = _trouverLigneInscription(id);
  if (!trouve) return reponseJSON({ status: 'error', message: 'Dossier introuvable.' });

  // Cette barrière "formation pas encore terminée" ne concerne QUE
  // l'attestation (preuve officielle de fin de formation). La carte
  // d'apprenant, elle, doit être téléchargeable dès le premier jour
  // d'inscription — sa date de validité imprimée EST la date de fin de
  // formation, donc la carte reste auto-descriptive même téléchargée en
  // cours de cursus (l'apprenant peut la plastifier immédiatement).
  // Avant ce correctif, les deux documents partageaient le même verrou
  // par erreur — signalé par le PDG le 22/09/2026.
  if (type === 'attestation') {
    const dateFinBrute = String(trouve.row[25] || '').trim();
    if (dateFinBrute) {
      const dateFin = new Date(dateFinBrute);
      if (!isNaN(dateFin.getTime())) {
        const aujourdHui = new Date();
        aujourdHui.setHours(0, 0, 0, 0);
        dateFin.setHours(0, 0, 0, 0);
        if (aujourdHui < dateFin) {
          return reponseJSON({
            status: 'success',
            accesAutorise: false,
            formationEnCours: true,
            dateFin: dateFinBrute
          });
        }
      }
    }
  }

  const filiere = String(trouve.row[22] || '');
  if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) {
    // Filières longues : accès illimité, non concernées par ce palier.
    return reponseJSON({ status: 'success', accesAutorise: true });
  }

  const restants = Number(trouve.row[46]) || 0;
  if (restants > 0) {
    return reponseJSON({ status: 'success', accesAutorise: true, restants });
  }

  return reponseJSON({
    status: 'success',
    accesAutorise: false,
    montant: CONFIG.TELECHARGEMENT.FRAIS
  });
}

// Décrémente le compteur d'un téléchargement — à appeler UNE FOIS,
// juste après avoir effectivement affiché/servi le document à
// l'apprenant. Ne bloque jamais l'affichage en cas d'échec d'écriture
// (mieux vaut un compteur légèrement optimiste qu'un document promis
// mais jamais délivré après un paiement réel).
function enregistrerTelechargement(data) {
  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', message: 'ID manquant.' });

  try {
    const trouve = _trouverLigneInscription(id);
    if (!trouve) return reponseJSON({ status: 'success' });

    const filiere = String(trouve.row[22] || '');
    if (!filiere.includes(CONFIG.FORMATION_COURTE.NOM)) {
      return reponseJSON({ status: 'success' }); // Illimité, rien à décrémenter
    }

    const restants = Math.max(0, (Number(trouve.row[46]) || 0) - 1);
    trouve.feuille.getRange(trouve.ligneIndex, 47).setValue(restants);
    return reponseJSON({ status: 'success', restants });
  } catch (err) {
    console.error('[Téléchargement] Erreur décrément :', err);
    return reponseJSON({ status: 'success' });
  }
}

// Appelée par le webhook FedaPay (Vercel) après paiement confirmé —
// authentifiée par secret partagé, pas par session utilisateur.
// Source unique de vérité pour le mode FedaPay (sandbox / live).
// Stocké dans les Propriétés du script (modifiable UNIQUEMENT depuis
// l'onglet Paiement de l'admin — voir admin.gs adminGetModePaiement /
// adminSetModePaiement) au lieu d'être codé en dur dans index.html ou
// dans une variable d'environnement Vercel. Ainsi, après livraison du
// site, basculer entre sandbox et live se fait en un clic dans l'admin,
// sans toucher au code ni à la configuration Vercel.
//
// Sécurité : ceci ne renvoie qu'un simple mot ('sandbox' ou 'live'),
// jamais une clé secrète — cette route reste donc volontairement
// publique (pas de token requis), car index.html, verifier.html et les
// fonctions Vercel (api/paiement-webhook.js, api/paiement-verifier.js)
// en ont besoin AVANT toute authentification.
//
// Par sécurité, si la propriété n'est pas encore définie, on part du
// principe le plus prudent : 'sandbox' (jamais 'live' par défaut).
function obtenirModePaiementPublic(data) {
  const mode = PropertiesService.getScriptProperties().getProperty('FEDAPAY_MODE') || 'sandbox';
  return reponseJSON({ status: 'success', mode: mode });
}

function confirmerPaiementTelechargement(data) {
  const secretAttendu = PropertiesService.getScriptProperties().getProperty('SECRET_PARTAGE');

  // Distinction volontaire des deux cas d'échec — un secret absent ici
  // (jamais configuré dans Propriétés du script) est une erreur de
  // déploiement à corriger côté GAS, alors qu'un secret présent mais
  // qui ne correspond pas signale plutôt une désynchro avec la valeur
  // GAS_SHARED_SECRET côté Vercel. Sans cette distinction, les deux
  // ressemblent au même "Non autorisé" générique dans les logs, ce qui
  // rend le diagnostic d'un blocage de paiement bien plus long.
  if (!secretAttendu) {
    console.error('[Téléchargement] SECRET_PARTAGE non configuré dans les Propriétés du script (Extensions > Propriétés du projet > Propriétés du script). Toute confirmation de paiement est rejetée tant que ce n\'est pas fait.');
    return reponseJSON({ status: 'error', erreur: 'Non autorisé (secret serveur non configuré).' }, 403);
  }
  if (data.secretPartage !== secretAttendu) {
    console.warn('[Téléchargement] Tentative de confirmation avec un secret partagé qui ne correspond pas à SECRET_PARTAGE — vérifier GAS_SHARED_SECRET côté Vercel.');
    return reponseJSON({ status: 'error', erreur: 'Non autorisé (secret invalide).' }, 403);
  }

  const id = String(data.id || '').trim();
  if (!id) return reponseJSON({ status: 'error', erreur: 'ID manquant.' }, 400);

  const trouve = _trouverLigneInscription(id);
  if (!trouve) {
    console.error('[Téléchargement] Confirmation de paiement reçue pour un dossier introuvable :', id, '— référence FedaPay :', data.referenceFedapay || '—');
    return reponseJSON({ status: 'error', erreur: 'Dossier introuvable.' }, 404);
  }

  trouve.feuille.getRange(trouve.ligneIndex, 47).setValue(CONFIG.TELECHARGEMENT.TELECHARGEMENTS_PAR_PALIER);

  console.log('[Téléchargement] Paiement confirmé pour', id, '— référence FedaPay :', data.referenceFedapay || '—');
  return reponseJSON({ status: 'success' });
}

function _genererTokenCarte(apprenant) {
  const payload = {
    id:           apprenant.id,
    prenom:       apprenant.prenom,
    nom:          apprenant.nom,
    sexe:         apprenant.sexe,
    dateNaissance:apprenant.dateNaissance,
    telephone:    apprenant.telephone,
    filiere:      apprenant.filiere,
    dateEntree:   apprenant.dateEntree,
    dateFin:      apprenant.dateFin,
    photoUrl:     apprenant.photoUrl,
    emis:         new Date().toISOString(),
    v:            CARTE_CONFIG.VERSION
  };

  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const signature  = _signerCarte(payloadB64);

  return `${payloadB64}.${signature}`;
}

function _verifierTokenCarte(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signatureRecue] = parts;
    const signatureAttendue = _signerCarte(payloadB64);

    if (signatureAttendue !== signatureRecue) return null;

    return JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString()
    );
  } catch(e) {
    console.error('[_verifierTokenCarte]', e.toString());
    return null;
  }
}

function _signerCarte(data) {
  const sig = Utilities.computeHmacSha256Signature(data, CARTE_CONFIG.SECRET);
  return Utilities.base64EncodeWebSafe(sig);
}

function _envoyerEmailCarte(apprenant, token) {
  const lienCarte = `${CONFIG.SITE_URL}/verifier.html?t=${encodeURIComponent(token)}`;
  const annee     = new Date().getFullYear();

  const htmlBody = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
  style="max-width:560px;width:100%;background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- En-tête -->
  <tr><td style="background:#04342C;padding:28px 36px;text-align:center;">
    <img src="${CONFIG.LOGO_URL}" width="60"
      style="border-radius:8px;margin:0 auto 12px;display:block;"/>
    <h1 style="margin:0;font-size:18px;color:#FFF;font-weight:700;">
      Les Qualités de Dieu Service
    </h1>
    <p style="margin:6px 0 0;font-size:13px;color:#A7C4BC;">Carte d'apprentissage</p>
  </td></tr>

  <!-- Corps -->
  <tr><td style="padding:32px 36px;">
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.75;">
      Bonjour <strong>${apprenant.prenom} ${apprenant.nom}</strong>,<br/><br/>
      Votre carte d'apprentissage officielle LQD Service est prête.
      Elle atteste de votre inscription en <strong>${apprenant.filiere}</strong>.
    </p>

    <!-- Infos carte -->
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:14px;margin-bottom:24px;">
      <tr style="background:#F9FAFB;">
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;width:40%;">Référence</td>
        <td style="padding:10px 16px;color:#111827;font-family:monospace;">${apprenant.id}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Filière</td>
        <td style="padding:10px 16px;color:#111827;">${apprenant.filiere}</td>
      </tr>
      <tr style="background:#F9FAFB;">
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Début</td>
        <td style="padding:10px 16px;color:#111827;">${apprenant.dateEntree || '—'}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;color:#6B7280;font-weight:600;">Fin de validité</td>
        <td style="padding:10px 16px;color:#E05C2A;font-weight:700;">${apprenant.dateFin || '—'}</td>
      </tr>
    </table>

    <!-- Bouton générer la carte -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${lienCarte}"
        style="display:inline-block;background:#04342C;color:#FFF;padding:14px 32px;
               border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">
        Voir et télécharger ma carte
      </a>
    </div>

    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.6;">
      Ce lien contient votre carte sécurisée. Ne le partagez qu'avec des tiers de confiance.<br/>
      La carte peut être scannée pour vérifier son authenticité.
    </p>

    <p style="margin:20px 0 0;font-size:13px;color:#6B7280;text-align:center;line-height:1.7;">
      Votre attestation de fin de formation, votre fiche apprenant et votre badge de
      certification sont aussi disponibles depuis l'espace apprenant du site, avec les
      mêmes identifiants (numéro de dossier + téléphone).
    </p>
  </td></tr>

  <!-- Pied -->
  <tr><td style="background:#F3F4F6;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">
      © ${annee} Les Qualités de Dieu Service SARL — Comé, Bénin
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  GmailApp.sendEmail(
    apprenant.email,
    `Votre carte d'apprentissage — LQD Service (${apprenant.id})`,
    `Bonjour ${apprenant.prenom}, votre carte d'apprentissage LQD Service est disponible : ${lienCarte}`,
    {
      htmlBody,
      name:    CONFIG.EXPEDITEUR_NOM,
      replyTo: CONFIG.ADMIN_EMAIL
    }
  );
}

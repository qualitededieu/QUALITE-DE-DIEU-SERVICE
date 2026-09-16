const { Webhook } = require("fedapay");

// Deux jeux de secrets distincts dans Vercel (FEDAPAY_WEBHOOK_SECRET pour
// le live, FEDAPAY_WEBHOOK_SECRET_MODE_SANDBOX pour les tests) — on choisit
// lequel utiliser via le mode ACTUEL, lu dynamiquement depuis GAS (source
// unique de vérité, pilotée depuis l'admin — voir GAS/carte.gs
// obtenirModePaiementPublic). On ne dépend plus d'une variable
// d'environnement Vercel pour ce choix : un admin peut ainsi basculer
// sandbox/live sans jamais toucher à Vercel.
function _obtenirSecretWebhook(mode) {
  return mode === "sandbox"
    ? process.env.FEDAPAY_WEBHOOK_SECRET_MODE_SANDBOX
    : process.env.FEDAPAY_WEBHOOK_SECRET;
}

// Interroge GAS pour connaître le mode de paiement actuel (sandbox/live).
// Ne renvoie jamais de secret, juste ce mot — c'est pourquoi côté GAS
// cette route est volontairement publique (aucun token requis).
// En cas d'échec réseau, on retombe sur 'sandbox' par prudence : mieux
// vaut un webhook qui échoue proprement (visible dans les logs) qu'un
// webhook qui utiliserait par erreur les mauvais secrets.
async function _obtenirModeActuel(urlGas) {
  try {
    const reponse = await fetch(urlGas, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "obtenir_mode_paiement" })
    });
    const resultat = await reponse.json();
    if (resultat.status === "success" && (resultat.mode === "sandbox" || resultat.mode === "live")) {
      return resultat.mode;
    }
  } catch (erreur) {
    console.error("[Webhook] Impossible de récupérer le mode de paiement depuis GAS, repli sur 'sandbox' :", erreur.message);
  }
  return "sandbox";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const urlGas    = process.env.GAS_URL;
  const secretGas = process.env.GAS_SHARED_SECRET;

  if (!urlGas || !secretGas) {
    console.error("[Webhook] Configuration serveur incomplète — vérifier sur Vercel : GAS_URL, GAS_SHARED_SECRET.");
    res.status(500).end();
    return;
  }

  const mode          = await _obtenirModeActuel(urlGas);
  const secretWebhook = _obtenirSecretWebhook(mode);

  // Le mode retenu ici vient directement de l'admin (onglet Actualités →
  // Mode de paiement FedaPay). S'il ne correspond pas au secret réellement
  // configuré côté FedaPay pour ce mode, la signature du webhook échoue
  // TOUJOURS, silencieusement pour l'apprenant — d'où ce log explicite.
  console.log("[Webhook] Mode de paiement effectif (piloté depuis l'admin) :", mode);

  if (!secretWebhook || !urlGas || !secretGas) {
    console.error(`[Webhook] Configuration serveur incomplète pour le mode "${mode}" — vérifier sur Vercel : ${mode === "sandbox" ? "FEDAPAY_WEBHOOK_SECRET_MODE_SANDBOX" : "FEDAPAY_WEBHOOK_SECRET"}, GAS_URL, GAS_SHARED_SECRET.`);
    res.status(500).end();
    return;
  }

  let corpsBrut;
  try {
    corpsBrut = await lireCorpsBrut(req);
  } catch (erreur) {
    res.status(400).end();
    return;
  }

  const signature = req.headers["x-fedapay-signature"];
  let evenement;

  try {
    evenement = Webhook.constructEvent(corpsBrut, signature, secretWebhook);
  } catch (erreur) {
    console.error(`[Webhook] Signature invalide (mode "${mode}") :`, erreur.message, "— si ce mode ne correspond pas à FEDAPAY_ENVIRONNEMENT dans index.html, c'est la cause la plus probable : le secret utilisé ici ne correspond pas à celui du compte/mode ayant réellement signé l'événement.");
    res.status(400).send("Signature invalide.");
    return;
  }

  console.log("[Webhook] Événement reçu :", evenement.name, "— transaction", evenement.entity && evenement.entity.id);

  if (evenement.name === "transaction.approved") {
    try {
      await confirmerAupresDeGas(urlGas, secretGas, evenement.entity);
    } catch (erreur) {
      console.error("[Webhook] Échec de transmission à GAS :", erreur.message);
    }
  }

  res.status(200).json({ recu: true });
};

function lireCorpsBrut(req) {
  return new Promise((resolve, reject) => {
    let donnees = "";
    req.on("data", function (morceau) { donnees += morceau; });
    req.on("end", function () { resolve(donnees); });
    req.on("error", reject);
  });
}

// L'ID de l'apprenant LQD est transmis à la création de la transaction
// (voir index.html, champ custom_metadata.id) et revient tel quel dans
// le webhook — c'est ce qui relie le paiement au bon dossier, sans
// jamais faire confiance à une confirmation uniquement côté navigateur.
//
// IMPORTANT : GAS (Apps Script) renvoie TOUJOURS un code HTTP 200, même
// en cas d'erreur métier (secret invalide, dossier introuvable...) — ce
// n'est jamais visible dans le code de statut. Il faut donc lire le
// CONTENU JSON de la réponse pour savoir si GAS a réellement accepté
// la confirmation, sinon un rejet silencieux passe totalement inaperçu.
async function confirmerAupresDeGas(urlGas, secretGas, transaction) {
  const id = transaction.custom_metadata && transaction.custom_metadata.id;
  if (!id) {
    console.error("[Webhook] Transaction FedaPay approuvée sans ID apprenant dans custom_metadata :", transaction.id);
    return;
  }

  const corps = {
    action: "confirmer_paiement_telechargement",
    secretPartage: secretGas,
    id: String(id),
    referenceFedapay: String(transaction.id)
  };

  const reponseGas = await fetch(urlGas, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps)
  });

  const texteBrut = await reponseGas.text();
  let resultat;
  try {
    resultat = JSON.parse(texteBrut);
  } catch (e) {
    console.error("[Webhook] Réponse GAS illisible (pas du JSON) pour", id, ":", texteBrut.slice(0, 300));
    return;
  }

  if (resultat.status === "success") {
    console.log("[Webhook] Déblocage confirmé côté GAS pour", id);
  } else {
    console.error("[Webhook] GAS a REFUSÉ la confirmation pour", id, "— raison :", resultat.erreur || resultat.message || "inconnue");
  }
}

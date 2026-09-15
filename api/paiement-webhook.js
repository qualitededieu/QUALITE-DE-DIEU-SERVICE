const { Webhook } = require("fedapay");

// Deux jeux de secrets distincts dans Vercel (FEDAPAY_WEBHOOK_SECRET pour
// le live, FEDAPAY_WEBHOOK_SECRET_MODE_SANDBOX pour les tests) — on choisit
// lequel utiliser via FEDAPAY_MODE, sans jamais copier de valeur d'une
// variable à l'autre. Doit rester synchronisé avec FEDAPAY_ENVIRONNEMENT
// dans index.html (même bascule, deux endroits).
function _obtenirSecretWebhook() {
  const mode = (process.env.FEDAPAY_MODE || "live").toLowerCase();
  return mode === "sandbox"
    ? process.env.FEDAPAY_WEBHOOK_SECRET_MODE_SANDBOX
    : process.env.FEDAPAY_WEBHOOK_SECRET;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const mode            = (process.env.FEDAPAY_MODE || "live").toLowerCase();
  const secretWebhook = _obtenirSecretWebhook();
  const urlGas         = process.env.GAS_URL;
  const secretGas       = process.env.GAS_SHARED_SECRET;

  // Le mode retenu ici DOIT correspondre à FEDAPAY_ENVIRONNEMENT dans
  // index.html (voir commentaire là-bas). S'ils divergent, la signature
  // du webhook est vérifiée avec le mauvais secret et échoue TOUJOURS,
  // silencieusement pour l'apprenant (il voit juste "confirmation en
  // cours" qui n'aboutit jamais) — d'où ce log explicite à chaque appel.
  console.log("[Webhook] FEDAPAY_MODE effectif :", mode, "(doit correspondre à FEDAPAY_ENVIRONNEMENT dans index.html)");

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

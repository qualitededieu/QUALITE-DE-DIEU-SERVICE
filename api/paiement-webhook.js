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

  const secretWebhook = _obtenirSecretWebhook();
  const urlGas         = process.env.GAS_URL;
  const secretGas       = process.env.GAS_SHARED_SECRET;

  if (!secretWebhook || !urlGas || !secretGas) {
    console.error("Configuration serveur incomplète (secret webhook selon FEDAPAY_MODE, GAS_URL ou GAS_SHARED_SECRET absent).");
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
    res.status(400).send("Signature invalide.");
    return;
  }

  if (evenement.name === "transaction.approved") {
    try {
      await confirmerAupresDeGas(urlGas, secretGas, evenement.entity);
    } catch (erreur) {
      console.error("Échec de transmission à GAS :", erreur.message);
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
async function confirmerAupresDeGas(urlGas, secretGas, transaction) {
  const id = transaction.custom_metadata && transaction.custom_metadata.id;
  if (!id) {
    console.error("Transaction FedaPay approuvée sans ID apprenant dans custom_metadata :", transaction.id);
    return;
  }

  const corps = {
    action: "confirmer_paiement_telechargement",
    secretPartage: secretGas,
    id: String(id),
    referenceFedapay: String(transaction.id)
  };

  await fetch(urlGas, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps)
  });
}

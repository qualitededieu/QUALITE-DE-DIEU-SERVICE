const { FedaPay, Transaction } = require("fedapay");

// Vérification ACTIVE (pull) de la transaction, en complément du webhook
// passif (paiement-webhook.js). Le webhook FedaPay s'est montré
// non-fiable en pratique (0 tentative de livraison observée côté
// FedaPay malgré des paiements réellement approuvés) : on ne peut plus
// dépendre uniquement de la réception d'un événement poussé par FedaPay.
//
// Ici, c'est le NAVIGATEUR de l'apprenant qui déclenche la vérification,
// juste après la fin du widget de paiement (onComplete), en transmettant
// l'identifiant de la transaction FedaPay. Ce endpoint interroge alors
// directement l'API FedaPay avec la clé secrète (jamais exposée côté
// navigateur) pour connaître le VRAI statut de la transaction, sans
// jamais faire confiance à ce que le navigateur affirme.
//
// Sécurité :
// - La clé secrète FedaPay reste strictement côté serveur (Vercel env).
// - On vérifie que custom_metadata.id de la transaction correspond bien
//   à l'ID de dossier fourni (anti-usurpation : un apprenant ne peut pas
//   réclamer le paiement d'un autre dossier).
// - On ne débloque que si FedaPay confirme status === "approved".
// - Le déblocage réel passe par la même route GAS que le webhook
//   (confirmer_paiement_telechargement), donc aucune divergence de
//   logique métier entre les deux chemins (passif et actif).

// Le mode (sandbox/live) n'est plus lu depuis une variable Vercel : il
// vient de GAS (source unique de vérité, pilotée depuis l'admin — voir
// GAS/carte.gs obtenirModePaiementPublic). Ainsi, basculer le site en
// production réelle ne demande de toucher NI le code NI Vercel : un seul
// interrupteur dans l'admin suffit, et cette fonction s'aligne dessus
// automatiquement à chaque appel.
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
    console.error("[Vérif active] Impossible de récupérer le mode de paiement depuis GAS, repli sur 'sandbox' :", erreur.message);
  }
  return "sandbox";
}

function _obtenirCleSecrete(mode) {
  return mode === "sandbox"
    ? process.env.FEDAPAY_SECRET_KEY_MODE_SANDBOX
    : process.env.FEDAPAY_SECRET_KEY;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const urlGas    = process.env.GAS_URL;
  const secretGas = process.env.GAS_SHARED_SECRET;

  if (!urlGas || !secretGas) {
    console.error("[Vérif active] Configuration serveur incomplète — vérifier sur Vercel : GAS_URL, GAS_SHARED_SECRET.");
    res.status(500).json({ status: "error", erreur: "Configuration serveur incomplète." });
    return;
  }

  const mode       = await _obtenirModeActuel(urlGas);
  const cleSecrete = _obtenirCleSecrete(mode);

  if (!cleSecrete) {
    console.error(`[Vérif active] Configuration serveur incomplète pour le mode "${mode}" (piloté depuis l'admin) — vérifier sur Vercel : ${mode === "sandbox" ? "FEDAPAY_SECRET_KEY_MODE_SANDBOX" : "FEDAPAY_SECRET_KEY"}.`);
    res.status(500).json({ status: "error", erreur: "Configuration serveur incomplète." });
    return;
  }

  let corps;
  try {
    corps = await lireJSON(req);
  } catch (erreur) {
    res.status(400).json({ status: "error", erreur: "Corps de requête invalide." });
    return;
  }

  const id            = String(corps.id || "").trim();
  const transactionId = corps.transactionId;

  if (!id || !transactionId) {
    res.status(400).json({ status: "error", erreur: "id et transactionId requis." });
    return;
  }

  let transaction;
  try {
    FedaPay.setApiKey(cleSecrete);
    FedaPay.setEnvironment(mode);
    transaction = await Transaction.retrieve(transactionId);
  } catch (erreur) {
    console.error("[Vérif active] Échec de récupération de la transaction FedaPay", transactionId, ":", erreur.message);
    res.status(502).json({ status: "error", erreur: "Impossible de vérifier la transaction auprès de FedaPay." });
    return;
  }

  const idMetadonnee = transaction.custom_metadata && transaction.custom_metadata.id;
  if (String(idMetadonnee || "") !== id) {
    console.error("[Vérif active] ID de dossier ne correspond pas à la transaction", transactionId, "— attendu :", id, "— trouvé :", idMetadonnee);
    res.status(403).json({ status: "error", erreur: "Cette transaction ne correspond pas à ce dossier." });
    return;
  }

  if (transaction.status !== "approved") {
    // Pas encore approuvée (en attente, échouée, annulée...) — ce n'est
    // pas une erreur serveur, c'est juste "pas encore prêt" ou "refusé".
    res.status(200).json({ status: "en_attente", statutFedapay: transaction.status });
    return;
  }

  // Transaction confirmée approuvée par FedaPay lui-même (pas seulement
  // par le navigateur) : on débloque via la même route GAS que le webhook.
  try {
    const reponseGas = await fetch(urlGas, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirmer_paiement_telechargement",
        secretPartage: secretGas,
        id: id,
        referenceFedapay: String(transaction.id),
        // Montant lu côté serveur auprès de FedaPay — GAS le compare au
        // palier attendu pour ce dossier (2500 F ou 3000 F).
        montant: Number(transaction.amount) || 0
      })
    });

    const texteBrut = await reponseGas.text();
    let resultat;
    try {
      resultat = JSON.parse(texteBrut);
    } catch (e) {
      console.error("[Vérif active] Réponse GAS illisible (pas du JSON) pour", id, ":", texteBrut.slice(0, 300));
      res.status(502).json({ status: "error", erreur: "Réponse invalide du serveur GAS." });
      return;
    }

    if (resultat.status === "success") {
      console.log("[Vérif active] Déblocage confirmé côté GAS pour", id, "— transaction", transaction.id);
      res.status(200).json({ status: "success" });
    } else {
      console.error("[Vérif active] GAS a REFUSÉ la confirmation pour", id, "— raison :", resultat.erreur || resultat.message || "inconnue");
      res.status(502).json({ status: "error", erreur: resultat.erreur || "GAS a refusé la confirmation." });
    }
  } catch (erreur) {
    console.error("[Vérif active] Échec de transmission à GAS pour", id, ":", erreur.message);
    res.status(502).json({ status: "error", erreur: "Impossible de joindre le serveur GAS." });
  }
};

function lireJSON(req) {
  return new Promise((resolve, reject) => {
    let donnees = "";
    req.on("data", function (morceau) { donnees += morceau; });
    req.on("end", function () {
      try {
        resolve(donnees ? JSON.parse(donnees) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

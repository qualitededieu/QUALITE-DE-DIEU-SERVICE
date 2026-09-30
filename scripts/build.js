// ================================================================
// BUILD DE PRODUCTION — exécuté par Vercel à chaque déploiement.
//
// Le dépôt GitHub garde le code COMMENTÉ (documentation interne).
// Le site publié (dossier dist/) reçoit une version :
//   - sans aucun commentaire (HTML, CSS, JS) ;
//   - minifiée (plus légère, plus rapide en 3G) ;
//   - obfusquée pour les générateurs de documents (valeur métier).
//
// LISTE BLANCHE : seuls les fichiers publics ci-dessous sont copiés.
// GAS/, scripts/, LISEZ-MOI.txt, node_modules/ ne sont JAMAIS publiés.
// Les fonctions serveur api/ sont déployées par Vercel à part (jamais
// envoyées au navigateur).
// ================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { minify: minifierHtml } = require('html-minifier-terser');
const { minify: minifierJs } = require('terser');
const Obfuscateur = require('javascript-obfuscator');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.join(RACINE, 'dist');

const PAGES_HTML = ['index.html', 'admin.html', 'article.html', 'espace-apprenant.html',
  'postuler.html', 'regularisation.html', 'verifier.html'];
const FICHIERS_COPIES_TELS_QUELS = ['manifest.json', 'robots.txt', 'sitemap.xml'];
const DOSSIERS_COPIES_TELS_QUELS = ['icons', 'tinymce'];   // images + bibliothèque tierce déjà minifiée
const JS_A_OBFUSQUER = ['attestation_generator.js', 'carte_generator.js',
  'badge_certification_generator.js', 'fiche_apprenant_generator.js'];

// Terser : suppression des commentaires, sans renommer les fonctions
// globales (appelées depuis les attributs onclick du HTML).
const OPTIONS_TERSER = {
  compress: { passes: 2, drop_debugger: true },
  mangle: { toplevel: false },
  format: { comments: false }
};

// Obfuscation modérée : protège la logique sans alourdir fortement les
// fichiers (important pour les téléphones d'entrée de gamme). Les noms
// globaux sont conservés (renameGlobals: false), sinon le HTML ne
// trouverait plus les fonctions.
const OPTIONS_OBFUSCATION = {
  compact: true,
  renameGlobals: false,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false
};

const OPTIONS_HTML = {
  removeComments: true,
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeRedundantAttributes: false,
  removeScriptTypeAttributes: false,
  keepClosingSlash: true,
  minifyCSS: true,
  minifyJS: OPTIONS_TERSER,
  // JSON-LD (référencement Google) : conservé tel quel.
  processScripts: []
};

function viderDossier(d) {
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
}

function copierDossier(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copierDossier(s, d);
    else fs.copyFileSync(s, d);
  }
}

function taille(o) { return (o / 1024).toFixed(1) + ' Ko'; }

async function construire() {
  viderDossier(SORTIE);
  let avant = 0, apres = 0;

  for (const page of PAGES_HTML) {
    const src = fs.readFileSync(path.join(RACINE, page), 'utf8');
    const out = await minifierHtml(src, OPTIONS_HTML);
    fs.writeFileSync(path.join(SORTIE, page), out);
    avant += Buffer.byteLength(src); apres += Buffer.byteLength(out);
    console.log(`[HTML] ${page} : ${taille(Buffer.byteLength(src))} -> ${taille(Buffer.byteLength(out))}`);
  }

  fs.mkdirSync(path.join(SORTIE, 'js'), { recursive: true });
  for (const f of fs.readdirSync(path.join(RACINE, 'js')).filter(n => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(RACINE, 'js', f), 'utf8');
    const mini = (await minifierJs(src, OPTIONS_TERSER)).code;
    const out = JS_A_OBFUSQUER.includes(f)
      ? Obfuscateur.obfuscate(mini, OPTIONS_OBFUSCATION).getObfuscatedCode()
      : mini;
    fs.writeFileSync(path.join(SORTIE, 'js', f), out);
    avant += Buffer.byteLength(src); apres += Buffer.byteLength(out);
    console.log(`[JS${JS_A_OBFUSQUER.includes(f) ? '+OBF' : ''}] ${f} : ${taille(Buffer.byteLength(src))} -> ${taille(Buffer.byteLength(out))}`);
  }

  const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  fs.writeFileSync(path.join(SORTIE, 'sw.js'), (await minifierJs(sw, OPTIONS_TERSER)).code);

  FICHIERS_COPIES_TELS_QUELS.forEach(f => {
    if (fs.existsSync(path.join(RACINE, f))) fs.copyFileSync(path.join(RACINE, f), path.join(SORTIE, f));
  });
  DOSSIERS_COPIES_TELS_QUELS.forEach(d => {
    if (fs.existsSync(path.join(RACINE, d))) copierDossier(path.join(RACINE, d), path.join(SORTIE, d));
  });

  // Garde-fou : échec du déploiement si un fichier interne a fuité dans dist/.
  const interdits = [];
  (function scanner(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) scanner(p);
      else if (/\.gs$|LISEZ-MOI|\.env|build\.js$/i.test(e.name)) interdits.push(p);
    }
  })(SORTIE);
  if (interdits.length) {
    console.error('[BUILD] Fichiers internes détectés dans dist/ :', interdits);
    process.exit(1);
  }

  console.log(`[BUILD] Terminé : HTML + JS ${taille(avant)} -> ${taille(apres)}`);
}

construire().catch(err => {
  console.error('[BUILD] Échec :', err);
  process.exit(1);
});

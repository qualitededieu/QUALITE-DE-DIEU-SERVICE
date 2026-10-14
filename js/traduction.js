/* ==================================================================
   js/traduction.js — sélecteur de langue (Google Traduction)

   Fonctionnement :
   - Le sélecteur (<select class="langue-select">) est dans la barre de
     navigation. S'il n'existe pas sur la page (article, postuler,
     espace apprenant), un petit bouton flottant est créé.
   - Choisir une langue pose le cookie "googtrans" puis recharge la page :
     c'est la méthode la plus fiable, et la langue reste active sur
     toutes les pages du site.
   - Le script de Google n'est chargé QUE si une langue autre que le
     français est active : un visiteur francophone ne charge rien de
     Google (site plus rapide, aucune donnée envoyée).

   Limites à connaître : traduction automatique (qualité variable), les
   documents générés (attestation, carte...) restent en français, et
   Google ne propose plus officiellement ce module aux nouveaux sites —
   il fonctionne toujours, sans garantie dans la durée.
================================================================== */
(function () {
  const LANGUES = [
    ['fr', 'Français'],
    ['en', 'English'],
    ['es', 'Español'],
    ['pt', 'Português'],
    ['de', 'Deutsch'],
    ['ar', 'العربية'],
    ['zh-CN', '中文'],
  ];
  const CODES = LANGUES.map(l => l[0]);

  function langueActive() {
    const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]*\/([^;]+)/);
    const code = m ? decodeURIComponent(m[1]) : 'fr';
    return CODES.indexOf(code) !== -1 ? code : 'fr';
  }

  // Le cookie doit être posé (ou effacé) à la fois sur le domaine exact et
  // sur le domaine parent (.qualitededieuservice.com), sinon Google peut
  // retrouver une ancienne valeur et la langue ne change pas.
  function domaines() {
    const h = window.location.hostname;
    const liste = [''];
    const parties = h.split('.');
    if (parties.length >= 2 && !/^\d+(\.\d+){3}$/.test(h) && h !== 'localhost') {
      liste.push('; domain=.' + parties.slice(-2).join('.'));
      liste.push('; domain=' + h);
    }
    return liste;
  }

  function choisirLangue(code) {
    const expire = 'Thu, 01 Jan 1970 00:00:00 GMT';
    domaines().forEach(d => { document.cookie = 'googtrans=; expires=' + expire + '; path=/' + d; });
    if (code !== 'fr') {
      domaines().forEach(d => { document.cookie = 'googtrans=/fr/' + code + '; path=/' + d; });
    }
    window.location.reload();
  }

  function remplirSelect(select) {
    const actuelle = langueActive();
    select.innerHTML = LANGUES.map(([c, lib]) => `<option value="${c}"${c === actuelle ? ' selected' : ''}>${lib}</option>`).join('');
    select.addEventListener('change', () => choisirLangue(select.value));
  }

  function creerSelecteurFlottant() {
    const div = document.createElement('div');
    div.className = 'selecteur-langue selecteur-langue-flottant notranslate';
    div.setAttribute('translate', 'no');
    div.innerHTML = '<span class="iconify" data-icon="tabler:world" aria-hidden="true"></span><select class="langue-select" aria-label="Langue du site"></select>';
    document.body.appendChild(div);
    return div.querySelector('select');
  }

  function chargerGoogle() {
    const conteneur = document.createElement('div');
    conteneur.id = 'google_translate_element';
    conteneur.style.display = 'none';
    document.body.appendChild(conteneur);
    window.googleTranslateElementInit = function () {
      /* global google */
      new google.translate.TranslateElement({
        pageLanguage: 'fr',
        includedLanguages: CODES.filter(c => c !== 'fr').join(','),
        autoDisplay: false
      }, 'google_translate_element');
    };
    // Deux adresses officielles du même module : si la première est
    // bloquée (réseau, pare-feu opérateur), on tente la seconde.
    const SOURCES = [
      'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit',
      'https://translate.googleapis.com/translate_a/element.js?cb=googleTranslateElementInit'
    ];
    function essayer(i) {
      if (i >= SOURCES.length) return echecTraduction();
      const s = document.createElement('script');
      s.src = SOURCES[i];
      s.async = true;
      s.onerror = () => { s.remove(); essayer(i + 1); };
      document.head.appendChild(s);
    }
    essayer(0);
  }

  // Google injoignable (bloqueur de publicité, navigateur Brave, réseau
  // filtré...) : on revient au français et on prévient le visiteur au lieu
  // de laisser un sélecteur qui affiche une langue sans rien traduire.
  function echecTraduction() {
    console.warn('[traduction] Google Traduction injoignable (bloqueur ou réseau). Retour au français.');
    const expire = 'Thu, 01 Jan 1970 00:00:00 GMT';
    domaines().forEach(d => { document.cookie = 'googtrans=; expires=' + expire + '; path=/' + d; });
    document.documentElement.classList.remove('site-traduit');
    document.querySelectorAll('.langue-select').forEach(s => { s.value = 'fr'; });
    const msg = document.createElement('div');
    msg.className = 'traduction-alerte notranslate';
    msg.setAttribute('role', 'status');
    msg.textContent = 'Translation unavailable: please disable your ad blocker or check your connection, then try again. / Traduction indisponible : désactivez votre bloqueur de publicité ou vérifiez votre connexion, puis réessayez.';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 9000);
  }

  // Styles minimum injectés ici : les pages qui ne chargent pas
  // css/site.css (article, postuler, espace apprenant) en ont besoin pour
  // le bouton flottant et pour masquer la barre ajoutée par Google.
  const style = document.createElement('style');
  style.textContent = [
    '.selecteur-langue-flottant{position:fixed;left:20px;bottom:84px;z-index:998;display:inline-flex;align-items:center;gap:4px;',
    'border:1.5px solid #D1D5DB;border-radius:50px;padding:5px 8px 5px 10px;background:#fff;color:#0F6E56;font-size:13px;',
    'box-shadow:0 6px 18px rgba(4,52,44,0.18)}',
    '.selecteur-langue-flottant select{border:none;background:transparent;font-family:inherit;font-weight:600;font-size:13px;color:#2C2C3E;cursor:pointer;outline:none}',
    '@media(max-width:640px){.selecteur-langue-flottant{left:14px;bottom:72px}}',
    'iframe.skiptranslate,.goog-te-banner-frame,#goog-gt-tt,.goog-te-balloon-frame,.goog-tooltip,',
    '.VIpgJd-ZVi9od-ORHb-OEVmcd,.VIpgJd-ZVi9od-aZ2wEe-wOHMyf{display:none!important}',
    'html.site-traduit body{top:0!important;position:static!important}',
    '.goog-text-highlight{background:none!important;box-shadow:none!important}',
    '.traduction-alerte{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000;max-width:min(92vw,520px);',
    'background:#2C2C3E;color:#fff;font-size:13px;line-height:1.45;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25)}'
  ].join('');
  document.head.appendChild(style);

  let selects = Array.from(document.querySelectorAll('.langue-select'));
  if (!selects.length) selects = [creerSelecteurFlottant()];
  selects.forEach(remplirSelect);

  const langue = langueActive();
  document.documentElement.classList.toggle('site-traduit', langue !== 'fr');
  if (langue !== 'fr') chargerGoogle();
})();

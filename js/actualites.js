/* js/actualites.js — page Actualités : charge les annonces publiées
   depuis l'admin (voir GAS/annonces.gs). Dépend de js/site.js
   (GAS_WEBAPP_URL, _escapeHtml). */
/* ================================================================
   ACTUALITÉS — remplace les 3 cartes statiques par les vraies
   annonces publiées, gérées depuis l'admin (voir GAS/annonces.gs)
================================================================ */
const ANNONCE_CATEGORIES_STYLE = {
  'Informatique & Bureautique': { icone: 'tabler:device-laptop', couleur: '#0F6E56', fond: 'linear-gradient(135deg,#E6F5F1,#CDEBE3)' },
  'Graphisme & PAO':            { icone: 'tabler:vector-bezier', couleur: '#7B2EFF', fond: 'linear-gradient(135deg,#F0E8FF,#E2D0FF)' },
  'Sérigraphie':                { icone: 'tabler:shirt',         couleur: '#C97A1A', fond: 'linear-gradient(135deg,#FDF0E0,#FBE1C2)' },
  'Création de sites web':      { icone: 'tabler:code',          couleur: '#0D7A8A', fond: 'linear-gradient(135deg,#E0F4F7,#C2E9EF)' },
  'Général':                    { icone: 'tabler:speakerphone',  couleur: '#04342C', fond: 'linear-gradient(135deg,#E7EEEC,#CFDFDA)' },
};

function _formatDateAnnonce(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function chargerActualites() {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;
  try {
    const resp = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'annonces_list_publiees' })
    });
    const result = await resp.json();
    const annonces = (result.status === 'success' && Array.isArray(result.annonces)) ? result.annonces : [];

    if (annonces.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--gray-500);padding:40px 0;">
        Aucune actualité publiée pour le moment. Revenez bientôt !
      </p>`;
      return;
    }

    grid.innerHTML = annonces.map(a => {
      const style = ANNONCE_CATEGORIES_STYLE[a.categorie] || ANNONCE_CATEGORIES_STYLE['Général'];
      const imageStyle = a.imageCouverture
        ? `background-image:url('${a.imageCouverture}');background-size:cover;background-position:center;`
        : `background:${style.fond};`;
      return `
        <a class="blog-card" href="article.html?id=${encodeURIComponent(a.id)}" style="display:block;color:inherit;">
          <div class="blog-card-img" style="${imageStyle}">
            ${!a.imageCouverture ? `<span class="iconify" data-icon="${style.icone}" style="color:${style.couleur};"></span>` : ''}
            <span class="blog-cat" style="background:${style.couleur};">${_escapeHtml(a.categorie)}</span>
          </div>
          <div class="blog-card-body">
            <div class="blog-meta"><span class="iconify" data-icon="tabler:calendar"></span>${_formatDateAnnonce(a.datePublication)}</div>
            <h4>${_escapeHtml(a.titre)}</h4>
            <p>${_escapeHtml(a.extrait || '')}</p>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:var(--teal-600);margin-top:10px;">
              Lire la suite <span class="iconify" data-icon="tabler:arrow-right"></span>
            </span>
          </div>
        </a>`;
    }).join('');
  } catch (e) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--gray-500);padding:40px 0;">
      Impossible de charger les actualités pour le moment.
    </p>`;
    console.warn('[actualites] chargement impossible :', e.message);
  }
}
chargerActualites();

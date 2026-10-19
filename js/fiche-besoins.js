/* ==================================================================
   js/fiche-besoins.js — Fiche individuelle de recueil des besoins
   Partagé par l'espace apprenant (formulaire), l'espace formateur et
   l'admin (lecture, cadre VIII, vue de groupe) + export PDF (jsPDF).

   Les questions viennent du serveur (BESOINS_SCHEMA, GAS/besoins.gs) :
   une seule définition pour le formulaire, les vues et le PDF.
   Aucune réponse n'est gardée dans le navigateur (ordinateurs partagés,
   cybercafés) : le brouillon est enregistré sur le serveur.
================================================================== */
(function () {
  'use strict';

  const MESURES = ['Suivi pédagogique individuel', 'Renforcement des compétences', 'Séance de rattrapage',
    'Orientation vers un service adapté', 'Mise à disposition de ressources'];
  const TITRE = 'FICHE INDIVIDUELLE DE RECUEIL DES BESOINS DE L’APPRENANT';
  const INTRO = 'Les informations recueillies servent à mieux comprendre les besoins de l’apprenant et à adapter son accompagnement pédagogique. Elles sont traitées avec discrétion.';
  const MERCI = 'Merci pour votre participation. Vos réponses contribueront à améliorer votre apprentissage et votre accompagnement.';
  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  /* ============================ Outils ============================ */

  // Les textes du serveur ont < et > neutralisés (&lt; &gt;) : on les remet
  // en clair puis on échappe tout pour l'affichage.
  function clair(t) { return String(t == null ? '' : t).replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
  function esc(t) { const d = document.createElement('div'); d.textContent = clair(t); return d.innerHTML; }
  function attr(t) { return esc(t).replace(/"/g, '&quot;'); }
  function questions(schema) { const l = []; schema.forEach(s => s.questions.forEach(q => l.push(q))); return l; }
  function estSensible(q, o) { return !!q.sensible || (q.sensibles || []).indexOf(o) !== -1 || (o === 'Autre' && !!q.autreSensible); }
  function intitule(q) { return (q.num ? q.num + '. ' : '') + q.label; }
  function choixDe(v) { return v ? (Array.isArray(v.choix) ? v.choix : (v.choix ? [v.choix] : [])) : []; }
  function dateFr(iso) {
    if (!iso) return '';
    const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const ICONE = (nom) => `<span class="iconify" data-icon="tabler:${nom}"></span>`;
  const cadenas = () => `<span class="fb-cadenas" title="Lu uniquement par l'administration">${ICONE('lock')} Administration</span>`;

  let stylesPoses = false;
  function styles() {
    if (stylesPoses) return;
    stylesPoses = true;
    const s = document.createElement('style');
    // Couleurs neutres (héritées) : le même module sert sur fond clair
    // (espaces apprenant / formateur) et sur fond sombre (admin).
    s.textContent = `
.fb{--fb-accent:#0D7A8A;--fb-bord:rgba(127,127,127,.3);--fb-fond:rgba(127,127,127,.08);color:inherit;font-size:14.5px;line-height:1.5}
.fb [hidden]{display:none!important}
.fb-entete{text-align:center;margin-bottom:14px}
.fb-entete .fb-marque{font-weight:800;letter-spacing:.06em;color:var(--fb-accent);font-size:13px}
.fb-entete h3{font-size:15px;margin:4px 0 8px;line-height:1.35}
.fb-entete p{margin:2px 0;font-size:13px;opacity:.8}
.fb-discret{font-size:12.5px;opacity:.7;margin:6px 0 0}
.fb-barre{height:8px;border-radius:8px;background:var(--fb-fond);overflow:hidden;margin:6px 0 2px}
.fb-barre span{display:block;height:100%;background:var(--fb-accent);transition:width .3s}
.fb-progression{margin-bottom:12px}
.fb-section{border:1px solid var(--fb-bord);border-radius:12px;margin-bottom:10px;overflow:hidden}
.fb-section>summary{cursor:pointer;list-style:none;padding:12px 14px;font-weight:700;display:flex;justify-content:space-between;gap:10px;align-items:center;background:var(--fb-fond)}
.fb-section>summary::-webkit-details-marker{display:none}
.fb-section>summary .fb-compte{font-weight:600;font-size:12px;opacity:.75;white-space:nowrap}
.fb-section-corps{padding:12px 14px}
.fb-q{margin-bottom:16px}
.fb-q-label{font-weight:600;margin-bottom:6px;display:block}
.fb-q.fb-manque .fb-q-label{color:#C0392B}
.fb-q.fb-manque{border-left:3px solid #C0392B;padding-left:10px}
.fb-req{color:#C0392B}
.fb-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}
.fb-opt{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid var(--fb-bord);border-radius:10px;cursor:pointer;font-size:14px;line-height:1.35}
.fb-opt input{margin:1px 0 0;accent-color:var(--fb-accent);width:17px;height:17px;flex-shrink:0}
.fb-opt.fb-coche{border-color:var(--fb-accent);background:rgba(13,122,138,.1)}
.fb input[type=text],.fb input[type=date],.fb textarea{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--fb-bord);border-radius:10px;background:transparent;color:inherit;font:inherit}
.fb textarea{min-height:84px;resize:vertical}
.fb-autre{margin-top:6px}
.fb-compteur{font-size:11.5px;opacity:.6;text-align:right}
.fb-cadenas{font-size:11px;opacity:.8;display:inline-flex;gap:3px;align-items:center;font-weight:600;white-space:nowrap;color:#B7791F}
.fb-ident{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px 14px}
.fb-ident div span{display:block;font-size:11px;opacity:.65;text-transform:uppercase;letter-spacing:.03em}
.fb-ident div strong{font-weight:600}
.fb-pied{border-top:1px solid var(--fb-bord);padding-top:14px;margin-top:6px}
.fb-confirm{display:flex;gap:8px;align-items:flex-start;font-weight:600;margin-bottom:12px;cursor:pointer}
.fb-confirm input{width:18px;height:18px;flex-shrink:0;accent-color:var(--fb-accent);margin-top:1px}
.fb-boutons{display:flex;gap:8px;flex-wrap:wrap}
.fb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:50px;padding:10px 18px;font:inherit;font-weight:700;font-size:14px;border:1.5px solid var(--fb-accent);cursor:pointer}
.fb-btn:disabled{opacity:.6;cursor:wait}
.fb-btn-plein{background:var(--fb-accent);color:#FFF}
.fb-btn-contour{background:transparent;color:var(--fb-accent)}
.fb-alerte{padding:10px 12px;border-radius:10px;background:rgba(245,166,35,.14);border:1px solid rgba(245,166,35,.5);font-size:13.5px;margin-bottom:12px}
.fb-ok{padding:10px 12px;border-radius:10px;background:rgba(29,158,117,.12);border:1px solid rgba(29,158,117,.45);font-size:13.5px;margin-bottom:12px}
.fb-erreur{padding:10px 12px;border-radius:10px;background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.4);color:#C0392B;font-size:13.5px;margin-bottom:12px}
.fb-rep{margin:2px 0 0;padding:0;list-style:none}
.fb-rep li{padding:2px 0}
.fb-rep li::before{content:'';display:inline-block;width:7px;height:7px;border-radius:2px;background:var(--fb-accent);margin-right:8px;vertical-align:1px}
.fb-texte{white-space:pre-wrap;margin:0}
.fb-vide{opacity:.55;font-style:italic}
.fb-conf{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:50px;background:rgba(192,57,43,.14);color:#C0392B;margin-left:6px;vertical-align:1px}
.fb-titre-viii{font-size:14px;margin:18px 0 10px;padding-top:12px;border-top:2px solid var(--fb-accent)}
.fb-champ{margin-bottom:12px}
.fb-champ label{display:block;font-weight:600;margin-bottom:5px}
.fb-stat-q{margin-bottom:16px}
.fb-stat-q h4{font-size:13.5px;margin:0 0 6px}
.fb-stat-l{font-size:13px;margin:5px 0}
.fb-stat-l div{display:flex;justify-content:space-between;gap:10px}
.fb-stat-b{height:6px;border-radius:6px;background:var(--fb-fond);margin-top:2px}
.fb-stat-b span{display:block;height:100%;background:var(--fb-accent);border-radius:6px}
@media(max-width:560px){.fb-options{grid-template-columns:1fr}.fb-btn{width:100%}}`;
    document.head.appendChild(s);
  }

  function entete(fiche) {
    const f = fiche || {};
    const code = (f.identification && f.identification.code) || f.dossierId || '';
    return `<div class="fb-entete">
      <div class="fb-marque">LQD SERVICE — LES QUALITÉS DE DIEU SERVICE</div>
      <h3>${esc(TITRE)}</h3>
      <p>Année de formation : <strong>${esc(f.annee || '20__ / 20__')}</strong> — Code de l’apprenant : <strong>${esc(code || '—')}</strong></p>
      <p class="fb-discret">${esc(INTRO)}</p>
    </div>`;
  }

  function identHtml(id) {
    const champs = [
      ['Nom et prénoms', id.nom], ['Sexe', id.sexe],
      ['Date de naissance', id.dateNaissance ? id.dateNaissance + (id.age ? ' (' + id.age + ' ans)' : '') : undefined],
      ['Téléphone', id.telephone], ['Adresse ou quartier', id.adresse], ['Formation / Classe', id.formation],
      ['Date d’inscription', id.dateInscription], ['Date d’entrée', id.dateEntree],
      ['Personne à contacter', id.contactNom], ['Téléphone du contact', id.contactTel]
    ].filter(c => c[1] !== undefined);
    return `<div class="fb-ident">${champs.map(c => `<div><span>${esc(c[0])}</span><strong>${esc(c[1] || '—')}</strong></div>`).join('')}</div>`;
  }

  /* ======================= Formulaire (apprenant) ======================= */

  function questionHtml(q, v) {
    v = v || {};
    const nom = 'fb-' + q.id;
    let corps;
    if (q.type === 'texte') {
      const max = q.max || 1500;
      corps = `<textarea name="${nom}" maxlength="${max}" data-max="${max}">${esc(v.texte || '')}</textarea>
        <div class="fb-compteur">${clair(v.texte || '').length} / ${max}</div>`;
    } else {
      const type = q.type === 'unique' ? 'radio' : 'checkbox';
      const choix = choixDe(v);
      const opts = q.options.concat(q.autre ? ['Autre'] : []);
      corps = `<div class="fb-options">${opts.map(o => `<label class="fb-opt${choix.indexOf(o) !== -1 ? ' fb-coche' : ''}">
          <input type="${type}" name="${nom}" value="${attr(o)}"${choix.indexOf(o) !== -1 ? ' checked' : ''}>
          <span>${esc(o === 'Autre' ? 'Autre (précisez)' : o)}${!q.sensible && estSensible(q, o) ? ' ' + cadenas() : ''}</span></label>`).join('')}</div>`
        + (q.autre ? `<input type="text" class="fb-autre" name="${nom}-autre" maxlength="200" placeholder="Précisez..." value="${attr(v.autre || '')}"${choix.indexOf('Autre') !== -1 ? '' : ' hidden'}>` : '');
    }
    return `<div class="fb-q" data-q="${q.id}"${q.si ? ` data-si="${q.si.q}" data-vaut="${attr(q.si.vaut)}"` : ''}>
      <span class="fb-q-label">${esc(intitule(q))}${q.requis ? ' <span class="fb-req">*</span>' : ''}${q.sensible ? ' ' + cadenas() : ''}</span>${corps}</div>`;
  }

  function collecter(zone, schema) {
    const r = {};
    questions(schema).forEach(q => {
      const bloc = zone.querySelector(`[data-q="${q.id}"]`);
      if (!bloc || bloc.hidden) return;
      const nom = 'fb-' + q.id;
      if (q.type === 'texte') {
        const t = bloc.querySelector('textarea').value.trim();
        if (t) r[q.id] = { texte: t };
        return;
      }
      const coches = Array.from(bloc.querySelectorAll(`input[name="${nom}"]:checked`)).map(i => i.value);
      if (!coches.length) return;
      const val = q.type === 'unique' ? { choix: coches[0] } : { choix: coches };
      const autre = bloc.querySelector(`input[name="${nom}-autre"]`);
      if (coches.indexOf('Autre') !== -1 && autre) val.autre = autre.value.trim();
      r[q.id] = val;
    });
    return r;
  }

  // Questions obligatoires sans réponse (ou "Autre" non précisé).
  function manquants(schema, rep, zone) {
    return questions(schema).filter(q => {
      const bloc = zone.querySelector(`[data-q="${q.id}"]`);
      if (!bloc || bloc.hidden) return false;
      const v = rep[q.id];
      if (v && choixDe(v).indexOf('Autre') !== -1 && !v.autre) return true;
      return q.requis && !v;
    }).map(q => q.id);
  }

  function formulaire(cible, schema, fiche, opts) {
    styles();
    const rep = fiche.reponses || {};
    // Conteneur neuf à chaque affichage : pas d'écouteurs empilés si on recharge.
    cible.innerHTML = '';
    const zone = document.createElement('div');
    cible.appendChild(zone);
    zone.innerHTML = `<div class="fb fb-form">
      ${entete(fiche)}
      <div class="fb-progression">
        <div style="display:flex;justify-content:space-between;font-size:13px;"><strong>Progression</strong><span data-fb="pct">0 %</span></div>
        <div class="fb-barre"><span data-fb="barre" style="width:0"></span></div>
        <p class="fb-discret">* question obligatoire. Les mentions ${cadenas()} sont lues uniquement par l’administration, pas par le formateur. Vous pouvez enregistrer un brouillon et revenir plus tard.</p>
      </div>
      <details class="fb-section" open><summary>I. Identification de l’apprenant <span class="fb-compte">depuis votre dossier</span></summary>
        <div class="fb-section-corps">
          ${identHtml(fiche.identification || {})}
          <label class="fb-opt" style="margin-top:12px;"><input type="checkbox" data-fb="corr-ok"${fiche.corrections ? ' checked' : ''}> <span>Une information est inexacte ou a changé</span></label>
          <div data-fb="corr-zone" style="margin-top:8px;"${fiche.corrections ? '' : ' hidden'}>
            <textarea data-fb="corrections" maxlength="800" placeholder="Ex. : nouveau numéro, nouveau quartier, autre personne à contacter...">${esc(fiche.corrections || '')}</textarea>
            <p class="fb-discret">${cadenas()} Transmis à l’administration, qui met votre dossier à jour.</p>
          </div>
        </div>
      </details>
      ${schema.map((s, i) => `<details class="fb-section" data-section="${s.id}"${i === 0 ? ' open' : ''}>
        <summary>${esc(s.id + '. ' + s.titre)} <span class="fb-compte" data-compte="${s.id}"></span></summary>
        <div class="fb-section-corps">${s.questions.map(q => questionHtml(q, rep[q.id])).join('')}</div>
      </details>`).join('')}
      <div class="fb-pied">
        <div data-fb="msg" hidden></div>
        <label class="fb-confirm"><input type="checkbox" data-fb="confirm"> <span>Je confirme l’exactitude de mes réponses. Cette confirmation, datée, remplace ma signature.</span></label>
        <div class="fb-boutons">
          <button type="button" class="fb-btn fb-btn-contour" data-fb="brouillon">${ICONE('device-floppy')} Enregistrer le brouillon</button>
          <button type="button" class="fb-btn fb-btn-plein" data-fb="envoyer">${ICONE('send')} Envoyer ma fiche</button>
        </div>
        <p class="fb-discret" style="margin-top:12px;">${esc(MERCI)}</p>
      </div>
    </div>`;

    const $f = sel => zone.querySelector(`[data-fb="${sel}"]`);

    function majEtat() {
      // Conditions ("Si oui, ...")
      zone.querySelectorAll('[data-si]').forEach(b => {
        const coche = zone.querySelector(`input[name="fb-${b.dataset.si}"]:checked`);
        b.hidden = !coche || coche.value !== b.dataset.vaut;
      });
      // Champs "Autre" et cases cochées
      zone.querySelectorAll('.fb-opt input').forEach(i => i.closest('.fb-opt').classList.toggle('fb-coche', i.checked));
      zone.querySelectorAll('.fb-autre').forEach(a => {
        const nom = a.name.replace(/-autre$/, '');
        const autre = zone.querySelector(`input[name="${nom}"][value="Autre"]`);
        a.hidden = !(autre && autre.checked);
      });
      // Progression (questions visibles ayant une réponse)
      const r = collecter(zone, schema);
      let total = 0, faits = 0;
      schema.forEach(s => {
        let t = 0, f = 0;
        s.questions.forEach(q => {
          const b = zone.querySelector(`[data-q="${q.id}"]`);
          if (b.hidden) return;
          t++; if (r[q.id]) f++;
        });
        total += t; faits += f;
        zone.querySelector(`[data-compte="${s.id}"]`).textContent = f + ' / ' + t;
      });
      const pct = total ? Math.round(faits / total * 100) : 0;
      $f('pct').textContent = pct + ' %';
      $f('barre').style.width = pct + '%';
    }

    zone.addEventListener('change', e => {
      const i = e.target;
      if (i.matches('input[type=checkbox][name^="fb-"]')) {
        const q = questions(schema).filter(x => 'fb-' + x.id === i.name)[0];
        if (q && q.exclusif && i.checked) {
          zone.querySelectorAll(`input[name="${i.name}"]`).forEach(x => {
            if (i.value === q.exclusif ? x !== i : x.value === q.exclusif) x.checked = false;
          });
        }
      }
      if (i === $f('corr-ok')) $f('corr-zone').hidden = !i.checked;
      const bloc = i.closest('.fb-q');
      if (bloc) bloc.classList.remove('fb-manque');
      majEtat();
    });
    zone.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('textarea[data-max]')) t.nextElementSibling.textContent = t.value.length + ' / ' + t.dataset.max;
      const bloc = t.closest('.fb-q');
      if (bloc) bloc.classList.remove('fb-manque');
    });
    majEtat();
    // Reprise d'un brouillon : ouvrir la première section incomplète.
    if (Object.keys(rep).length) {
      const r0 = collecter(zone, schema);
      const incomplete = schema.filter(s => s.questions.some(q => q.requis && !zone.querySelector(`[data-q="${q.id}"]`).hidden && !r0[q.id]))[0];
      if (incomplete) {
        zone.querySelectorAll('details[data-section]').forEach(d => { d.open = d.dataset.section === incomplete.id; });
      }
    }

    function message(texte, type) {
      const m = $f('msg');
      m.className = type === 'ok' ? 'fb-ok' : 'fb-erreur';
      m.textContent = texte;
      m.hidden = !texte;
    }

    async function enregistrer(soumettre) {
      const reponses = collecter(zone, schema);
      const corrections = $f('corr-ok').checked ? $f('corrections').value.trim() : '';
      if (soumettre) {
        zone.querySelectorAll('.fb-manque').forEach(b => b.classList.remove('fb-manque'));
        const manque = manquants(schema, reponses, zone);
        if (manque.length) {
          manque.forEach(id => {
            const b = zone.querySelector(`[data-q="${id}"]`);
            b.classList.add('fb-manque');
            b.closest('details').open = true;
          });
          zone.querySelector(`[data-q="${manque[0]}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
          message(manque.length + ' réponse(s) manquante(s), signalée(s) en rouge.', 'erreur');
          return;
        }
        if (!$f('confirm').checked) { message('Cochez la case de confirmation avant d’envoyer votre fiche.', 'erreur'); return; }
      }
      const boutons = [$f('brouillon'), $f('envoyer')];
      boutons.forEach(b => { b.disabled = true; });
      try {
        const r = await opts.enregistrer({ reponses: reponses, corrections: corrections, soumettre: soumettre, confirmation: $f('confirm').checked });
        if (!r) return;
        if (r.status !== 'success') { message(r.message || 'Enregistrement impossible.', 'erreur'); return; }
        message(r.message || 'Enregistré.', 'ok');
      } catch (e) {
        message('Connexion interrompue : vos réponses ne sont pas enregistrées. Réessayez.', 'erreur');
      } finally {
        boutons.forEach(b => { b.disabled = false; });
      }
    }
    $f('brouillon').addEventListener('click', () => enregistrer(false));
    $f('envoyer').addEventListener('click', () => enregistrer(true));
  }

  /* ========================= Lecture (tous) ========================= */

  // mode : 'apprenant' | 'formateur' | 'admin'
  function lecture(schema, fiche, mode) {
    styles();
    const rep = fiche.reponses || {};
    const sensibles = fiche.sensibles || [];
    let html = '<div class="fb fb-lecture">' + entete(fiche);
    if (mode === 'formateur' && fiche.besoinParticulier) {
      html += `<div class="fb-alerte">${ICONE('lock')} <strong>Besoin particulier signalé</strong> (santé, accessibilité, finances ou contraintes personnelles). Le détail est réservé à l’administration : rapprochez-vous d’elle si un aménagement est nécessaire.</div>`;
    }
    if (mode === 'admin' && fiche.besoinParticulier) {
      html += `<div class="fb-alerte">${ICONE('lock')} Cette fiche contient des réponses <strong>confidentielles</strong> (marquées en rouge) : elles ne sont pas visibles par le formateur.</div>`;
    }
    if (mode === 'admin' && fiche.corrections) {
      html += `<div class="fb-alerte">${ICONE('user-edit')} <strong>Correction de dossier demandée :</strong> ${esc(fiche.corrections)}</div>`;
    }
    html += `<details class="fb-section" open><summary>I. Identification de l’apprenant</summary><div class="fb-section-corps">${identHtml(fiche.identification || {})}
      ${mode === 'formateur' ? '<p class="fb-discret">Adresse, date de naissance et contacts : réservés à l’administration.</p>' : ''}</div></details>`;
    schema.forEach(s => {
      html += `<details class="fb-section" open><summary>${esc(s.id + '. ' + s.titre)}</summary><div class="fb-section-corps">`;
      s.questions.forEach(q => {
        const v = rep[q.id];
        if (q.si && !v) {
          const parent = rep[q.si.q];
          if (!parent || parent.choix !== q.si.vaut) return;
        }
        html += `<div class="fb-q"><span class="fb-q-label">${esc(intitule(q))}</span>`;
        if (mode === 'formateur' && q.sensible) {
          html += '<p class="fb-vide">Réservé à l’administration.</p></div>';
          return;
        }
        if (!v) { html += '<p class="fb-vide">Sans réponse</p></div>'; return; }
        const conf = o => mode === 'admin' && sensibles.indexOf(q.id) !== -1 && estSensible(q, o) ? '<span class="fb-conf">Confidentiel</span>' : '';
        if (q.type === 'texte') {
          html += `<p class="fb-texte">${esc(v.texte)}${mode === 'admin' && q.sensible ? '<span class="fb-conf">Confidentiel</span>' : ''}</p>`;
        } else {
          html += '<ul class="fb-rep">' + choixDe(v).map(o => `<li>${esc(o === 'Autre' ? 'Autre : ' + (v.autre || '') : o)}${conf(o)}</li>`).join('') + '</ul>';
        }
        html += '</div>';
      });
      html += '</div></details>';
    });
    if (fiche.confirmation) html += `<p class="fb-discret">${ICONE('circle-check')} ${esc(fiche.confirmation)}</p>`;
    return html + '</div>';
  }

  /* ===================== Cadre VIII (formateur / admin) ===================== */

  function suiviFormulaire(suivi, fiche) {
    styles();
    const s = suivi || {};
    const m = s.mesures || [];
    return `<div class="fb fb-suivi" data-fb-suivi>
      <h3 class="fb-titre-viii">VIII. Cadre réservé à l’administration ou au formateur</h3>
      ${fiche && fiche.suiviPar ? `<p class="fb-discret" style="margin:-4px 0 10px;">Dernière mise à jour : ${esc(fiche.suiviPar)}${fiche.suiviLe ? ' — ' + esc(dateFr(fiche.suiviLe)) : ''}</p>` : ''}
      <div class="fb-champ"><label>Synthèse des besoins identifiés</label><textarea data-s="synthese" maxlength="2000">${esc(s.synthese || '')}</textarea></div>
      <div class="fb-champ"><label>Difficultés prioritaires</label><textarea data-s="difficultes" maxlength="2000">${esc(s.difficultes || '')}</textarea></div>
      <div class="fb-champ"><label>Mesures d’accompagnement proposées</label>
        <div class="fb-options">${MESURES.concat(['Autre']).map(o => `<label class="fb-opt${m.indexOf(o) !== -1 ? ' fb-coche' : ''}"><input type="checkbox" data-s="mesure" value="${attr(o)}"${m.indexOf(o) !== -1 ? ' checked' : ''}> <span>${esc(o === 'Autre' ? 'Autre (précisez)' : o)}</span></label>`).join('')}</div>
        <input type="text" class="fb-autre" data-s="mesureAutre" maxlength="200" placeholder="Précisez la mesure..." value="${attr(s.mesureAutre || '')}"${m.indexOf('Autre') !== -1 ? '' : ' hidden'}>
      </div>
      <div class="fb-champ"><label>Date du suivi prévu</label><input type="date" data-s="dateSuivi" value="${attr(s.dateSuivi || '')}" style="max-width:220px;"></div>
      <div class="fb-champ"><label>Observations du formateur ou de l’administration</label><textarea data-s="observations" maxlength="3000">${esc(s.observations || '')}</textarea></div>
      <p class="fb-discret">Le nom du responsable et la date sont enregistrés automatiquement. Ce cadre n’est jamais visible par l’apprenant.</p>
    </div>`;
  }

  // À appeler après insertion de suiviFormulaire() dans la page.
  function activerSuivi(zone) {
    const bloc = zone.querySelector('[data-fb-suivi]');
    if (!bloc) return;
    bloc.addEventListener('change', e => {
      if (e.target.dataset.s !== 'mesure') return;
      e.target.closest('.fb-opt').classList.toggle('fb-coche', e.target.checked);
      const autre = bloc.querySelector('[data-s="mesure"][value="Autre"]');
      bloc.querySelector('[data-s="mesureAutre"]').hidden = !autre.checked;
    });
  }

  function collecterSuivi(zone) {
    const b = zone.querySelector('[data-fb-suivi]');
    const v = n => b.querySelector(`[data-s="${n}"]`).value.trim();
    return {
      synthese: v('synthese'), difficultes: v('difficultes'), dateSuivi: v('dateSuivi'), observations: v('observations'),
      mesures: Array.from(b.querySelectorAll('[data-s="mesure"]:checked')).map(i => i.value), mesureAutre: v('mesureAutre')
    };
  }

  /* ========================= Vue de groupe ========================= */

  function statsHtml(stats, totalApprenants) {
    styles();
    if (!stats || !stats.fichesRecues) return '<div class="fb"><p class="fb-vide">Aucune fiche reçue pour le moment : les statistiques apparaîtront dès les premières réponses.</p></div>';
    const n = stats.fichesRecues;
    let html = `<div class="fb fb-stats"><p><strong>${n}</strong> fiche(s) reçue(s)${totalApprenants ? ' sur ' + totalApprenants + ' apprenant(s)' : ''}.
      ${stats.besoinsParticuliers ? ` <strong>${stats.besoinsParticuliers}</strong> besoin(s) particulier(s) signalé(s) — détail à l’administration.` : ''}</p>
      <p class="fb-discret" style="margin-bottom:14px;">Nombre d’apprenants par réponse (plusieurs réponses possibles selon la question). Options confidentielles exclues.</p>`;
    stats.questions.forEach(q => {
      const lignes = q.options.filter(o => o.nombre > 0).sort((a, b) => b.nombre - a.nombre);
      if (!lignes.length) return;
      html += `<div class="fb-stat-q"><h4>${esc((q.num ? q.num + '. ' : '') + q.label)}</h4>` + lignes.map(o => {
        const pct = Math.round(o.nombre / n * 100);
        return `<div class="fb-stat-l"><div><span>${esc(o.libelle)}</span><strong>${o.nombre} (${pct} %)</strong></div><div class="fb-stat-b"><span style="width:${pct}%"></span></div></div>`;
      }).join('') + '</div>';
    });
    return html + '</div>';
  }

  /* ============================== PDF ============================== */

  function chargerJsPDF() {
    if (window.jspdf) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = JSPDF_URL;
      s.onload = res;
      s.onerror = () => rej(new Error('Module PDF indisponible. Vérifiez votre connexion.'));
      document.head.appendChild(s);
    });
  }

  async function logo() {
    try {
      const b = await (await fetch('/icons/logo-lqd-v2.jpg')).blob();
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(b); });
    } catch (e) { return ''; }
  }

  // Polices standard du PDF : jeu Latin-1 (accents français inclus).
  function txtPdf(t) {
    return clair(t).replace(/[’‘]/g, '\'').replace(/[“”]/g, '"').replace(/[—–]/g, '-').replace(/…/g, '...')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/[^\x09\x0A\x20-\xFF]/g, '');
  }

  // fiche = null -> fiche vierge à imprimer. mode : 'apprenant' | 'formateur' | 'admin'.
  async function pdf(schema, fiche, mode) {
    await chargerJsPDF();
    const image = await logo();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 14, L = W - 2 * M;
    const SOMBRE = [4, 52, 44], TEAL = [13, 122, 138], GRIS = [107, 114, 128], NOIR = [31, 41, 55];
    const vierge = !fiche;
    const f = fiche || { reponses: {}, identification: {} };
    const rep = f.reponses || {};
    const id = f.identification || {};
    const avecSuivi = mode !== 'apprenant';
    let y = M;

    const place = h => { if (y + h > H - 16) { doc.addPage(); y = M; } };
    const police = (taille, style, couleur) => { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(taille); doc.setTextColor.apply(doc, couleur || NOIR); };
    function para(t, taille, style, couleur, x, largeur) {
      police(taille, style, couleur);
      const lignes = doc.splitTextToSize(txtPdf(t), largeur || L);
      const h = taille * 0.42;
      lignes.forEach(l => { place(h); police(taille, style, couleur); doc.text(l, x || M, y + h * 0.82); y += h; });
    }
    function pointilles(n) {
      for (let i = 0; i < n; i++) {
        place(7);
        doc.setDrawColor(170); doc.setLineWidth(0.2); doc.setLineDashPattern([0.6, 1], 0);
        doc.line(M, y + 5, W - M, y + 5);
        doc.setLineDashPattern([], 0);
        y += 7;
      }
    }
    function caseCoche(x, yy, coche) {
      doc.setDrawColor(60); doc.setLineWidth(0.3); doc.rect(x, yy, 3.2, 3.2);
      if (coche) { doc.setLineWidth(0.5); doc.line(x + 0.6, yy + 0.6, x + 2.6, yy + 2.6); doc.line(x + 2.6, yy + 0.6, x + 0.6, yy + 2.6); }
    }
    function titreSection(t) {
      place(14); y += 2;
      doc.setFillColor.apply(doc, SOMBRE); doc.rect(M, y, L, 7, 'F');
      police(9.5, 'bold', [255, 255, 255]); doc.text(txtPdf(t), M + 3, y + 4.9);
      y += 10;
    }
    function options(liste, choix, autreTexte) {
      const col = L / 2 - 2;
      for (let i = 0; i < liste.length; i += 2) {
        const paire = liste.slice(i, i + 2);
        police(9);
        const lignes = paire.map(o => doc.splitTextToSize(txtPdf(o === 'Autre' ? 'Autre : ' + (choix.indexOf('Autre') !== -1 && autreTexte ? autreTexte : '..............................') : o), col - 6));
        const h = Math.max.apply(null, lignes.map(l => l.length)) * 3.8 + 1.8;
        place(h);
        paire.forEach((o, j) => {
          const x = M + j * (col + 4);
          caseCoche(x, y + 0.5, choix.indexOf(o) !== -1);
          police(9); doc.text(lignes[j], x + 5, y + 3.1);
        });
        y += h;
      }
    }
    function champ(label, valeur) {
      place(6.5);
      police(9, 'bold'); doc.text(txtPdf(label + ' :'), M, y + 4);
      const x = M + doc.getTextWidth(txtPdf(label + ' :')) + 2;
      if (valeur) { police(9.5); doc.text(doc.splitTextToSize(txtPdf(valeur), W - M - x)[0], x, y + 4); }
      else { doc.setDrawColor(170); doc.setLineDashPattern([0.6, 1], 0); doc.line(x, y + 4.6, W - M, y + 4.6); doc.setLineDashPattern([], 0); }
      y += 6.5;
    }

    // En-tête
    if (image) { try { doc.addImage(image, 'JPEG', M, y, 16, 16); } catch (e) { /* logo facultatif */ } }
    police(13, 'bold', TEAL); doc.text('LQD SERVICE', M + 20, y + 6);
    police(8.5, 'normal', GRIS); doc.text(txtPdf('Les Qualités de Dieu Service SARL — Centre de formation professionnelle, Comé (Bénin)'), M + 20, y + 11);
    doc.text('+229 01 97 95 12 30', M + 20, y + 15);
    y += 21;
    para(TITRE, 11.5, 'bold', SOMBRE);
    y += 2;
    champ('Année de formation', vierge ? '' : f.annee);
    champ('Code de l\'apprenant', vierge ? '' : (id.code || f.dossierId));
    para(INTRO, 8.5, 'italic', GRIS);
    y += 1;

    // I. Identification
    titreSection('I. IDENTIFICATION DE L\'APPRENANT');
    if (mode === 'formateur' && !vierge) {
      champ('Nom et prénoms', id.nom); champ('Formation / Classe', id.formation); champ('Date d\'entrée', id.dateEntree);
      para('Sexe, naissance, adresse et contacts : réservés à l\'administration.', 8.5, 'italic', GRIS);
    } else {
      champ('Nom et prénoms', id.nom); champ('Sexe', id.sexe);
      champ('Date de naissance', id.dateNaissance ? id.dateNaissance + (id.age ? '  -  Âge : ' + id.age + ' ans' : '') : '');
      champ('Téléphone', id.telephone); champ('Adresse ou quartier', id.adresse); champ('Formation / Classe', id.formation);
      champ('Date d\'inscription', id.dateInscription); champ('Personne à contacter en cas de besoin', id.contactNom);
      champ('Téléphone du contact', id.contactTel);
      if (f.corrections && mode !== 'formateur') para('Correction signalée par l\'apprenant : ' + f.corrections, 9, 'italic', [183, 121, 31]);
    }

    // II à VII
    schema.forEach(s => {
      titreSection(s.id + '. ' + s.titre.toUpperCase());
      s.questions.forEach(q => {
        const v = rep[q.id];
        if (!vierge && q.si && !v) {
          const parent = rep[q.si.q];
          if (!parent || parent.choix !== q.si.vaut) return;
        }
        y += 1;
        para(intitule(q), 9.5, 'bold');
        y += 1;
        if (mode === 'formateur' && q.sensible && !vierge) { para('Réservé à l\'administration.', 8.5, 'italic', GRIS); y += 1.5; return; }
        if (q.type === 'texte') {
          if (v && v.texte) para(v.texte, 9.5); else pointilles(vierge ? (q.max && q.max <= 300 ? 1 : 2) : 1);
        } else {
          const masquer = mode === 'formateur' && !vierge;
          const liste = q.options.concat(q.autre ? ['Autre'] : []).filter(o => !masquer || !estSensible(q, o));
          options(liste, choixDe(v), v && v.autre);
          if (masquer && (q.sensibles || q.autreSensible)) para('Autres options : réservées à l\'administration.', 8, 'italic', GRIS);
        }
        y += 1.5;
      });
    });

    // VIII. Cadre réservé
    if (avecSuivi) {
      const sv = f.suivi || {};
      titreSection('VIII. CADRE RÉSERVÉ À L\'ADMINISTRATION OU AU FORMATEUR');
      [['Synthèse des besoins identifiés', sv.synthese], ['Difficultés prioritaires', sv.difficultes]].forEach(c => {
        para(c[0] + ' :', 9.5, 'bold'); y += 1;
        if (c[1]) para(c[1], 9.5); else pointilles(2);
        y += 1.5;
      });
      para('Mesures d\'accompagnement proposées :', 9.5, 'bold'); y += 1;
      options(MESURES.concat(['Autre']), sv.mesures || [], sv.mesureAutre);
      y += 1.5;
      champ('Date du suivi prévu', sv.dateSuivi ? dateFr(sv.dateSuivi) : '');
      para('Observations du formateur ou de l\'administration :', 9.5, 'bold'); y += 1;
      if (sv.observations) para(sv.observations, 9.5); else pointilles(2);
      y += 2;
      champ('Nom et signature du responsable', f.suiviPar ? f.suiviPar.replace(/^(Formateur|Administration) : /, '') : '');
      champ('Date', f.suiviLe ? dateFr(f.suiviLe) : '');
    }
    y += 2;
    champ('Signature de l\'apprenant', vierge ? '' : (f.confirmation || ''));
    y += 2;
    para(MERCI, 8.5, 'italic', GRIS);

    // Pied de page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      police(7.5, 'normal', GRIS);
      doc.text(txtPdf('LQD Service — Fiche de recueil des besoins' + (vierge ? '' : ' — ' + (id.code || f.dossierId || ''))), M, H - 8);
      doc.text(mode === 'admin' && !vierge ? 'Document confidentiel' : 'Document interne', W / 2, H - 8, { align: 'center' });
      doc.text('Page ' + p + ' / ' + pages, W - M, H - 8, { align: 'right' });
    }
    doc.save('Fiche-besoins-' + (vierge ? 'vierge' : String(id.code || f.dossierId || 'apprenant').replace(/[^\w-]/g, '')) + '.pdf');
  }

  window.FicheBesoins = {
    formulaire: formulaire, lecture: lecture, suiviFormulaire: suiviFormulaire, activerSuivi: activerSuivi,
    collecterSuivi: collecterSuivi, statsHtml: statsHtml, pdf: pdf
  };
})();

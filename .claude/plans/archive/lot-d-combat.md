# Lot D-combat — décisions de design combat/faction/sort (D1,D2,D5,D7,D10)

Remédiation code↔docs §4. Sous-lot combat/faction. Reste du Lot D (ville
D3/D4/D9, données/doc D8/D12, divers D6/D11) en PR suivantes.

## Décisions appliquées (recommandation par défaut)

- **D5** (code) — `consumeMarks` restreint aux frappes VOLONTAIRES : une riposte
  ne consomme plus les Marques (doc 05 §3.1 « à l'attaque »). Préviz de riposte
  alignée (le burst `consumeMarks` retiré de `estimateDamage`, cohérent avec A5).
- **D10** (code) — la Marque amplifie aussi les dégâts de SORT contre une cible
  marquée (`markBonusPerStack × charges`, générique, comme la frappe physique) ;
  préviz `estimateSpell` alignée.
- **D1** (code) — l'XP de combat va au héros du camp VAINQUEUR (attaquant OU
  défenseur), pas seulement l'attaquant. No-op aujourd'hui (aucun combat n'a de
  héros défenseur : `defenderHeroId` toujours null) mais correct et prêt pour la
  boucle « héros en défense ».
- **D2** (doc) — les effets de faction post-victoire (Nécromancie, Essence) sont
  crédités « en tant qu'attaquant » : noté docs 04 §2 / 05 §3.3 (l'extension au
  défenseur vainqueur suivra le flux héros-en-défense, inexistant).
- **D7** (doc) — cap de Nécromancie sur l'effectif **restant** (pas initial) :
  doc 04 corrigée (« effectif restant »), conforme au code.

## Vérif

- typecheck 5/5 · lint · moteur 346 (+2 D5/D10) · contenu 82 · golden INCHANGÉ ·
  content:check · guards faction/couleur · budget < 800 Ko · smoke.

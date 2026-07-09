# P2 / C7 — Sorts de zone (multi-cible)

> Backlog `gap-audit.md` C7 : tous les sorts `damage` étaient mono-cible. Débloque
> un vrai ciblage de zone (et, plus tard, C2/H1). Choisi par l'utilisateur.

## Design

- Nouveau champ `SpellDef.area?: 'splash'` (optionnel ⇒ mono-cible par défaut).
  `splash` = la pile ciblée **+ les piles du même camp adjacentes** sur la grille
  hex (`hexDistance === 1`) — modèle Boule de feu.
- `handleCastSpell` refactoré : calcule la liste des piles affectées
  (`spellTargets`) puis applique l'effet à CHACUNE. Dégâts : chance tirée **une
  fois** pour le sort, résistance/Marque évaluées par pile. `SpellCast` agrège
  `amount`/`kills`.
- `estimateSpell` agrège la zone (dégâts + tués des piles touchées) → la
  prévisualisation obligatoire reflète le total.
- Donnée : `boule-de-feu` (cercle 3, existante) devient `area: 'splash'`.
- Client : marqueur « (zone) » sur les sorts splash dans le grimoire ; le flux de
  ciblage existant (choisir la pile centrale) est réutilisé tel quel.

**Aucun état persistant nouveau** ⇒ save/golden inchangés (`area` est de la donnée
de sort, le journal golden ne lance pas Boule de feu).

## Étapes & vérif

- [x] `SpellDef.area` (types.ts) + schéma contenu.
- [x] `hero/index.ts` : `spellTargets` + `damageOneStack` ; boucle multi-cible
      dans `handleCastSpell` (damage/heal/marks/buff) ; agrégation `estimateSpell`.
- [x] Donnée : `boule-de-feu` → `area: 'splash'`.
- [x] Client : badge « (zone) » (SpellBook) + locales FR/EN + CSS.
- [x] Tests moteur : splash touche cible + adjacent, épargne l'éloignée ; preview
      agrégée. Golden inchangé. Smoke : non-régression (mono-cible existant).

## Invariants
- Moteur faction-agnostique, déterministe (chance tirée une fois). Aucun état
  nouveau ⇒ save/golden inchangés.

## Journal
- 2026-07-09 — **C7 livré** : `area: 'splash'` + refactor multi-cible du cast et
  de la préviz ; Boule de feu en zone ; badge grimoire. Vérif : typecheck 5/5,
  lint, 388 tests moteur (dont combat-spell-area) + 92 contenu, content:check,
  garde-fous, build, smoke. Golden + save version INCHANGÉS.

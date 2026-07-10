# Lot A2g — capacité `firstStrike` (priorité d'initiative)

Backlog `game-feature-gaps.md` (CAP-ATK) : le **Chevalier du Griffon** (T6 Haven,
doc 03 §3) « frappe en premier ». Interprétation **cadrée par l'utilisateur
(2026-07-10)** : *strike-first in initiative* — la pile agit **avant les ennemis
de même vitesse** dans l'ordre d'initiative (départage / priorité de vague).
Point d'extension moteur **générique**, data-driven, zéro nom de faction.

## Règle retenue

Dans l'ordre de jeu par vagues (`pickNext`, doc 02 §5.2), à **vitesse
d'initiative égale**, une pile `firstStrike` passe **avant** une pile sans
`firstStrike` — priorité indépendante du camp et du slot. Deux piles
`firstStrike` (ou deux sans) ⇒ départage habituel (camp puis slot). S'applique
à la vague principale comme à la vague d'attente (départage uniforme).

Capacité **sans état** (lue depuis le def à chaque comparaison) ⇒ **pas de bump
`CURRENT_SAVE_VERSION`**. Golden **inchangé** : aucune unité `firstStrike` dans
le catalogue golden ⇒ le comparateur retombe sur le départage existant.

## Étapes

1. **Données** — `"firstStrike"` dans `abilities.json` (→ 26) ; ajouté au
   Chevalier du Griffon (`t6-chevalier-griffon.json`, à côté de `charge`).
2. **Moteur** — départage `firstStrike` dans `pickNext` (`turns.ts`), avant le
   départage camp/slot ; import `hasAbility`.
3. **Docs** — doc 02 §5.4 (→ 26 + ligne) ; doc 03 (bloc « État » Haven :
   `firstStrike` interprété).
4. **Test** — `combat-first-strike.test.ts` : à vitesse égale, la pile
   `firstStrike` (ennemie) est choisie avant une pile ordinaire ; deux sans
   firstStrike ⇒ ordre inchangé (non-régression).
5. **Vérif complète** — `pnpm test`, typecheck, lint, `content:check`, garde-fou,
   build, smoke. Golden **inchangé**, **pas de bump save**.

## Journal

- branche `claude/a2g-first-strike` créée depuis `main` @ 0a8b7cc (incl. #211).
- Interprétation cadrée par l'utilisateur : *strike-first in initiative*.
- Données : `firstStrike` dans `abilities.json` (→ 26) ; ajouté au Chevalier du
  Griffon (à côté de `charge`). L'élite (Champion) ne l'a pas (doc 03 §80).
- Moteur : **extraction** d'un comparateur partagé `compareInitiative`
  (`state-helpers.ts`) — `pickNext` (turns.ts) ET `roundActionOrder` (projection
  UI) l'utilisent désormais, source unique. `firstStrike` départage à vitesse
  égale, avant camp/slot. `initiativeSpeed` retiré des imports de turns.ts.
- Docs : doc 02 §5.4 (→ 26 + ligne) ; doc 03 (bloc « État » Haven).
- Test : `combat-first-strike.test.ts` (4 cas : firstStrike ennemi devant /
  non-régression 2 ordinaires / la vitesse prime à écart / advanceTurn honore).
- Vérif : `pnpm test` = 472 (engine, +4) + 101 (content) ; typecheck 5/5 ; lint ;
  `content:check` ; garde-fou faction vert ; build 275 Ko < 800. Golden
  **inchangé** (aucune unité firstStrike au catalogue golden), **pas de bump
  save**. Smoke en cours.

# Lot 3b (P1) — Feedback : raisons des boutons de combat désactivés (E2)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 3, item 3 (E2 🟠). Les boutons
> de combat (Prière, Sort d'unité, Fuir, Se rendre, Attaque héros, Sort héros) sont
> grisés **sans explication** — la ville, elle, affiche ses prérequis. **Client +
> locales — zéro moteur, pas de bump save.**

## Changement (client)
- Helper `disabledReason(button)` (dans `CombatUi`) : à partir des mêmes
  sous-conditions que les gates (`isPlayerTurn`, `autoActive`, `heroCanAct`,
  héros présent, sorts connus, pile lanceuse/charges/silence, or vs coût), renvoie
  une **clé de raison** courte (ou `null` si activé).
- Chaque bouton concerné affiche, quand désactivé, un **sous-libellé** court
  (`.combat-btn-reason`) et porte l'explication complète en `title` + `aria-label`
  (survol desktop, appui long mobile, lecteur d'écran).
- Raisons (i18n `combat.reason.*`) : adversaire, auto en cours, déjà agi ce round,
  aucun sort, pas de héros (arène), prière indisponible, pas une lanceuse, plus de
  charges, silenciée, or insuffisant.

## Vérification
- Smoke @core : en arène (aucun héros), le bouton « Attaque héros » porte une raison
  visible ; ou tour de l'IA ⇒ raison « adversaire ». Cibles ≥ 44 px inchangées.
- typecheck · lint · content (i18n parité) · build · bundle · smoke @core · gardes.

## Journal
- [x] Bloc `reason` (par bouton) dérivé des mêmes sous-conditions que les gates +
      helpers `reasonNode`/`reasonTitle`. 10 raisons i18n (short + `.hint`).
- [x] Sous-libellé `.combat-btn-reason` + `title` sur 6 boutons (Attaque/Sort héros,
      Prière, Sort d'unité, Fuir, Se rendre). Vérifié en arène : « No hero », « N/A »,
      « Not caster »… lisibles (laiton) + explication en title.
- [x] CSS `.combat-btn-reason` (laiton, 0.65rem) ; grisé bouton 0.45→0.55 pour la
      lisibilité de la raison.
- [x] Smoke @core (bouton désactivé ⇒ sous-libellé visible + title non vide).
- [x] Recette : typecheck · lint · engine 890 (golden inchangé) · content 152 ·
      client 13 · build · bundle 333 693 ≤ 819 200 · smoke @core 30 + mobile 13 ·
      gardes faction/couleurs.

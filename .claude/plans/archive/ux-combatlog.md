# UX-COMBATLOG — journal de combat (doc 08 §2.4)

> « go next » autonome. Backlog `game-feature-gaps.md` UX-COMBATLOG : log
> déroulant des actions du combat courant, alimenté par les événements moteur
> déjà émis. **Client pur** — zéro moteur, zéro save, zéro golden.

## Conception
- Listener **global** `app/combat-log.ts` (`installCombatLog()` au bootstrap,
  comme audio/autosave) : accumule les événements de combat en lignes lisibles
  dans `store.combatLog` (nouveau champ). Résout id de pile → nom d'unité via une
  carte semée à `CombatStarted` (toutes les piles présentes ; `setState` précède
  `emit`, cf. dispatch.ts) et complétée au fil (relèves) ; une pile morte garde
  son nom. Remis à zéro à chaque `CombatStarted`, borné à 80 lignes.
- Composant `CombatLog` (lit `store.combatLog`) : panneau déroulant avec
  auto-scroll, basculé par un bouton « Journal » dans la barre d'actions de
  combat. Monté en combat ; l'accumulation est globale (capte aussi les events
  d'ouverture, avant le montage de l'UI de combat).
- Événements traduits : round, attaque/riposte, esquive, mort, soin, poison,
  sort (héros/unité), frappe du héros, moral +/−, peur, immobilisation, fin.
- Locales `combatLog.*` + `combat.log` FR/EN. CSS `.combat-log` (tokens only).

## Vérif
- Typecheck/lint/build (bundle < 800 Ko), garde-fou couleurs (var() only),
  garde-fou faction. Content 105 (parité locale FR/EN). Smoke : le combat de
  gardien ouvre le journal ⇒ « Round 1 » présent dès l'ouverture (146 passed).
- doc 08 §2.4 + backlog.

## Différés
- Filtrage par type, copie/export du log, log persistant hors combat.

## Journal
- Livré. `store.combatLog` + `app/combat-log.ts` (listener global) + `CombatLog`
  (panneau, bouton « Journal ») + locales FR/EN + CSS. Client pur (aucun moteur/
  save/golden). Vérif : typecheck/lint/build, content 105, smoke 146 (assertion
  journal « Round » au combat de gardien). doc 08 §2.4 + backlog UX-COMBATLOG ✅.

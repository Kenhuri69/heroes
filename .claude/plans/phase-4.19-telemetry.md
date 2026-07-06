# Plan — Alpha 4.19 : télémétrie locale opt-in

> Dernier item **implémentable** de la Phase 2 Alpha (doc 09 ligne 50 ; la partie
> « playtests hebdomadaires » est une activité ops, la ligne 51 est le jalon).
> Collecteur de télémétrie **100 % local, opt-in**, pour outiller l'équilibrage.

## Conception (client seul ; privacy-first)
- **`app/telemetry.ts`** : état dans `localStorage` (`heroes:telemetry:enabled` +
  `:data`), fonctions `isTelemetryEnabled`/`setTelemetryEnabled`/`getTelemetry`/
  `resetTelemetry`/`recordCombatAuto` + `initTelemetry` (abonnement au store).
  **Désactivé par défaut** ; aucun enregistrement sans opt-in ; rien n'est envoyé.
- **Métriques** : durée des tours humains (chrono du début du tour à `EndTurn` ;
  un combat NE fractionne PAS le tour) ; combats vus + combats délégués à
  l'auto-combat (« abandon » de la conduite manuelle).
- **Options** : section Télémétrie (toggle On/Off + hint), stats (tours + durée
  moyenne, combats + taux auto), boutons Export (JSON local) et Réinitialiser.
- Hooks : `initTelemetry` (durée de tour + apparition de combat) ; bouton « Auto »
  du combat → `recordCombatAuto`.

## Lots
- [x] `app/telemetry.ts` + `app/store.ts` (`telemetryEnabled`, `telemetryTick`).
- [x] `main.ts` : `initTelemetry()`.
- [x] `ui/combat.tsx` : `recordCombatAuto()` au clic « Auto ».
- [x] `ui/OptionsPanel.tsx` (+ `options.css`) : section Télémétrie.
- [x] Locales FR/EN : `options.telemetry*`, `telemetry.turns/combats`.
- [x] Smoke : activer, combat auto + fin de tour ⇒ stats non nulles (1 tour, 1
  combat), export + reset ⇒ 0. Desktop + mobile.
- [x] Docs 08 §2.5/§3 + roadmap 09. Plan à jour.

## Écarts / décisions constatés
- **Un combat ne fractionne pas le tour** : le chrono ne change de tour qu'au
  passage à un nouveau tour humain (jour/joueur), sinon un combat scinderait la
  mesure.
- **`telemetryTick`** : les stats sont lues hors store (localStorage) ; un
  compteur force le re-render des Options après reset.
- **« Abandon » = auto-combat** : le client n'a ni reddition ni fuite ; déléguer à
  l'auto-combat est l'unique « abandon » de conduite manuelle disponible.

## Journal
- **2026-07-06** — Après merge #75 (éditeur 4.18). Base = `origin/main` (1fbb753).
  Télémétrie locale opt-in livrée ; tout vert. **Fin des items implémentables de
  l'Alpha.**

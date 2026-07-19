# Lot E-save — doc sync architecture/sauvegarde (E1)

Premier sous-lot du Lot E (doc sync). Remet `docs/07-architecture.md` en
cohérence avec le code livré. Vérifié contre les sources : la doc suit le
code, pas l'inverse.

## Corrections (toutes vérifiées contre le code)

- **Save version** : `CURRENT_SAVE_VERSION` 4 → **8** (source de vérité
  `engine/core/state.ts:130`) + historique v2→v8 (mirroir du commentaire
  moteur : factionResources, townlessDays/triggers, huntContract,
  warMachines, quests, objets de carte/pendingTreasure/visitLuck).
- **§2 structure** : diagramme réel — 4 packages (`engine`, `content`,
  `client`, `tools`) + `server/` racine ; `ai/` **interne** au moteur ;
  pas d'`engine-api`, pas de dossier `schemas/` racine (schémas Zod dans
  `@heroes/content`). Encadré « le découpage a évolué ».
- **§3 boucle** : `dispatch.ts` = interface **async** mais exécution
  **synchrone** sur le thread principal (anti-gel = throttling ×4 CI) ;
  Web Worker **différé** (interface prête).
- **§4 sauvegarde** : suivi de **version** par paquet différé (migrations).
- **§6 PWA** : service worker **hand-rolled** `data/sw.js` (pas Workbox),
  lot 8.1.

## Vérification

Changement purement documentaire (aucun code). Suite complète tout de même
(garde-fou §7) : typecheck, lint, engine+content, content:check, guards,
build < 800 Ko, smoke desktop + mobile — inchangée par rapport à main.

## État : livré.

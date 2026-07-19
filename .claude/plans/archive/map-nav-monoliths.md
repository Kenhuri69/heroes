# M-NAV (a) — monolithes appariés (doc 02 §2.1)

> « go next » autonome. Sous-lot (a) de M-NAV : téléporteurs appariés. (b) naval
> et (c) souterrain restent différés.

## Conception (additive, sans bump save)
- Objet `MonolithObjectDef { id, type:'monolith', pos, pairId }` (`map.ts`) +
  union. Exactement 2 monolithes partagent un `pairId` (validé au load).
- `movement.ts` : fouler un monolithe ⇒ téléport sur la tuile du jumeau + reveal +
  event `HeroTeleported` + **break** (interrompt le chemin). Le héros arrive sur
  la sortie sans « y entrer » ⇒ pas de re-téléport (pas de boucle).
- Contenu : schéma + résolution (`loader.ts`, `ResolvedMapObject`) + validation
  d'appariement 2-à-2. Validation StartGame moteur : branche `monolith` (rien à
  vérifier, appariement fait au contenu) — corrige aussi le narrowing guardian.
- Client : rendu `buildMonolith` (portail de pierres arcane) ; `MapObjectCard`
  (titre/ligne) ; toast `HeroTeleported` ; MapEditor (tool + glyphe ⛩) ; locales.
- Data : proto-01 `monolith-a` (20,3) / `monolith-b` (6,26), `pairId: gate-1`.

## Vérif
- Tests moteur : `map-objects.test.ts` — téléport vers le jumeau + interruption ;
  arriver sur le jumeau ne re-téléporte pas (1 seul téléport). Golden inchangé.
- Content 101 ; typecheck/lint/build ; smoke (non-régression).
- doc 02 §2.1 + backlog.

## Journal
- Livré. Additif ⇒ pas de bump, golden inchangé. 471 tests moteur (dont 2 M-NAV),
  content 101. Fix : branche `monolith` dans la validation StartGame (narrowing) +
  ResolvedMapObject + MapEditor ObjectKind. Différés : naval (b), souterrain (c).

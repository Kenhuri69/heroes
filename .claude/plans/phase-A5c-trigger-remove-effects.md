# A5c — Effets de trigger `removeArtifact` / `removeArmy` (doc 18 A5, reste P3)

## Contexte

A5 (triggers de carte riches) est livré : `TriggerEffect` couvre déjà
`grantResource`/`message`/`grantArtifact`/`grantArmy`/`ambush`/`teleport`/`choice`.
Le « Reste (P3) » de la fiche A5 (doc 18, ligne 103) note deux effets **miroir des
octrois** : **retrait** d'artefact et **retrait** d'armée au héros visiteur — chacun
= « une variante d'union `TriggerEffect` + un cas dans `triggers.ts` ». C'est le
pattern exact déjà établi. `onFlagCaptured` (3ᵉ item cité) est en réalité une
nouvelle *condition* de trigger (`on.kind`), pas un effet — forme différente, hook
au site de capture ⇒ **hors périmètre** de ce lot, reste noté P3.

## Design

Deux variantes `SimpleTriggerEffect` (donc utilisables aussi comme option d'un
`choice`, et appliquées directement — pas d'interruption) :

- `removeArtifact { artifactId }` — retire l'artefact nommé du héros visiteur :
  d'abord un slot équipé (→ `null`), sinon le sac (`backpack`, splice). Absent ⇒
  no-op silencieux. Miroir de `grantArtifact`. Requiert un héros (no-op trigger `day`).
- `removeArmy { unitId, count }` — retire `count` unités de la pile `unitId` :
  réduit l'effectif ; si ≤ 0, retire le slot. Absent ⇒ no-op. Miroir de `grantArmy`.
  Requiert un héros. `count` positif (schéma).

Usage : péages / gardes-frontière / malédictions scriptées (« la sentinelle exige
un tribut »), y compris comme branche d'un `choice`.

## Invariants

Générique (aucun nom de faction/scénario). Effets **optionnels par données** :
aucune carte existante ne les utilise ⇒ **golden inchangé**, **pas de bump save**
(pas de champ d'état neuf ; `SimpleTriggerEffect` n'est pas sous la garde de
sauvegarde). Garde-fou faction vert.

## Étapes

1. `map.ts` : ajouter les 2 variantes à `SimpleTriggerEffect` → verify: typecheck.
2. `triggers.ts` : 2 cas dans `applyTriggerEffect` (application + clone switch) → verify: typecheck (switch exhaustif).
3. `content/schemas.ts` : 2 variantes dans l'union trigger + l'union options de `choice` → verify: content:check.
4. `content/loader.ts` : `ResolvedTriggerEffect` + `ResolvedSimpleTriggerEffect` → verify: typecheck.
5. Tests `triggers.test.ts` : removeArtifact (équipé + sac + absent) & removeArmy (réduction + suppression de slot + absent) → verify: engine test.
6. Docs 18 (A5 « Reste ») + 02 §2.1 → verify: relecture.
7. Vérif complète : typecheck, lint, engine test, content:check, garde-fou, build, budget, golden inchangé.

## Statut

- [x] **LIVRÉ.** 2 variantes `SimpleTriggerEffect` (`removeArtifact`/`removeArmy`)
      dans `map.ts` ; application + clone switch exhaustif dans `triggers.ts` ;
      schéma content (union trigger + union options de `choice`) ; loader
      (`ResolvedTriggerEffect` + `ResolvedSimpleTriggerEffect`). Tests
      `triggers.test.ts` : removeArtifact (grant→remove, absent no-op) & removeArmy
      (réduction, wipe→slot supprimé). Docs 18 A5 + 02 §2.1 alignées. `onFlagCaptured`
      laissé P3 (condition, pas effet).
- **Vérif** : typecheck ✓ · lint ✓ · **926 engine** (+5) ✓ · **golden inchangé** ·
  content:check ✓ · garde-fou faction ✓ · build ✓ · bundle **335.8 Ko** < 800 ✓ ·
  smoke `@core` desktop **35/35** ✓. Zéro moteur-faction, **pas de bump save**.
- **Couverture** : chemin exercé par 5 unitaires moteur. Non smoke-couvert (aucune
  carte de jeu n'emploie ces effets ⇒ pas de surface UI ; le lot est data/moteur).

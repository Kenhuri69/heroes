# Lot CAP-CAST (données) — Bibliothécaire AH lanceur (Entraves)

> Backlog §2.2 CAP-CAST « Reste (données) : lanceurs Bibliothécaire/Maître/Avatar
> à câbler (moteur prêt) ». Doc 05 §4 : le **Bibliothécaire Errant** porte
> `spellcaster(Entrave/Silence, ×2)` — absent des données. Ce lot le câble en
> **données pures** (moteur `spellcaster` + UI CAP-CAST livrés). Un lanceur / lot.

## Choix : Entraves plutôt que Silence

L'IA de combat lance un sort d'unité ennemi sur la meilleure cible **quelle
qu'elle soit** : un `silence` posé sur une pile NON-lanceuse serait inutile
(tour gâché) et pénaliserait AH en simulation. **`entraves-runiques`** (−3
vitesse, kind `debuff`) est universellement utile ⇒ pas de tour gâché, pas de
régression d'IA. `power 3` (convention Prêtresse) ⇒ durée 3 rounds.

## Changements (données pures)

- `data/factions/arcane-hunters/units/t4-bibliothecaire.json` : `abilities +=
  { spellcaster: { spellId: 'entraves-runiques', charges: 2, power: 3 } }`
  (conserve `mark` + `magicResistance`).
- Doc 05 §4 (État CAP-CAST données) : noter le câblage + le choix Entraves.

## Vérification

- content:check + content/engine tests (zéro moteur) · typecheck 5/5 · lint
- garde-fous · build + bundle · smoke non régressé.
- **`faction:sim`** ciblé AH : vérifier que les matchups restent dans la bande
  20–80 % (pas de blowout introduit par le nouveau debuff). Si dérive, ajuster
  le coût de recrutement (ou reculer) — noté au journal.

## Journal

- 2026-07-12 — Plan créé, branche `claude/cap-cast-bibliothecaire` depuis main (@8da0039).
- 2026-07-12 — **Livré**. `t4-bibliothecaire` : `spellcaster(entraves-runiques,
  ×2, power 3)` ajouté (conserve mark + magicResistance). **Balance** : baseline
  AH-vs-necro à 79,6 % (proche du bord) ⇒ vérif `faction:sim` après changement :
  **numéros AH byte-identiques** (0 blowout) — le Bibliothécaire n'est pas décisif
  en sim, donc zéro régression. Doc 05 §4 + backlog. **Vérifs** : typecheck 5/5 ✅,
  lint ✅, content 123 + content:check ✅, golden inchangé ✅, garde-fous ✅, build +
  bundle 306 Ko gzip ✅, `faction:sim` 0 blowout ✅. Zéro moteur/save/golden. Smoke
  en cours.

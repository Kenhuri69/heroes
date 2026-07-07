# Plan — Lot N3b : campagne Necropolis (test de modularité narratif)

Sur le moteur de campagne N3a (générique), livrer la **campagne Necropolis** en
**données pures** — la preuve que la promesse de modularité (doc 13 §8) tient
aussi pour la narration : ajouter la campagne d'une maison = ajouter des
données dans son paquet, **zéro diff moteur/client**.

## Portée

- `manifest.story` sur Necropolis + `data/factions/necropolis/story/campaign.json`
  (2 chapitres).
- 2 scénarios de chapitre (`necropolis-ch1`, `necropolis-ch2`) — proto-01
  réutilisé, joueur Necropolis + IA Haven, dialogues + quêtes, personnages
  Vhalen / Mère Corbeau (doc 13 §3.3).
- Locales FR/EN (campagne, chapitres, dialogues, quêtes, personnages).
- `content:check` (2ᵉ campagne résolue) ; smoke : la campagne Necropolis apparaît
  au menu et son chapitre 1 démarre (le mécanisme complet gagner→débloquer→
  reporter est déjà couvert par le smoke Haven N3a — pas de duplication).

## Différé (N3c)

3ᵉ chapitres, cartes dédiées, cutscenes caméra, arcs personnels des héros
nommés (quêtes `personal` : Vhalen/le sceau, Mère Corbeau/l'enfant).

## Vérification par lot

- [x] typecheck 4/4 (aucun changement de code hors data + 1 test)
- [x] tests moteur 321 (golden **inchangé** — zéro diff moteur)
- [x] tests content 77
- [x] `content:check` (2ᵉ campagne + 2 scénarios résolus, parité fr/en)
- [x] garde-fou faction (grep CI local : propre)
- [x] build client (< 800 Ko gzip)
- [x] smoke desktop + mobile (campagne Necropolis au menu + ch1 démarre)

## Décisions / écarts

- **Test de modularité narratif réussi** : la campagne Necropolis = **données
  pures** (`manifest.story` + `story/campaign.json` + 2 scénarios + locales),
  **zéro diff moteur/client**. Le pipeline de campagne N3a est bien générique.
- Le mécanisme complet gagner→débloquer→reporter est prouvé par le smoke Haven
  (N3a) ; le smoke Necropolis vérifie l'apparition + le démarrage (héros
  `necropolis`, dialogue, quête) — pas de duplication.
- Cartes dédiées / 3ᵉ chapitre / cutscenes / arcs de héros nommés → N3c.

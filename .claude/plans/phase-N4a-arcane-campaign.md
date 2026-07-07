# Plan — Lot N4a : campagne Arcane Hunters (3ᵉ test de modularité narratif)

Premier increment de **N4 — La Chasse & le vivant** (doc 13 §4.1, table N4).
Sur le moteur de campagne N3 (générique, prouvé 2×), livrer la **campagne Arcane
Hunters** en **données pures** — la 3ᵉ maison à recevoir sa campagne : ajouter
une campagne = ajouter des données dans le paquet de faction, **zéro diff moteur/
client** (même preuve que N3b Necropolis).

## Portée

- `manifest.story` sur arcane-hunters + `data/factions/arcane-hunters/story/
  campaign.json` (2 chapitres).
- 2 scénarios de chapitre :
  - `arcane-ch1` (proto-01) — joueur Arcane Hunters vs IA Necropolis, dialogue
    d'ouverture (Evadne Corvel + Professeur Marchmont, doc 05 §7), quête primaire.
  - `arcane-ch2` (proto-02, carte dédiée réutilisée de N3c.3) — la rencontre
    **Evadne ↔ Aldric** (doc 13 §9.3) : dialogue à **choix binaire** posant le
    drapeau `aldric-pacte` (réutilise les choix/drapeaux N3c.2, continuité inter-
    campagnes) + quête primaire.
- Locales FR/EN (campagne, chapitres, scénarios, dialogues, quêtes, personnages
  evadne / marchmont ; aldric déjà présent).
- `content:check` (3ᵉ campagne + 2 scénarios résolus) ; smoke : la campagne
  Arcane Hunters apparaît au menu et son chapitre 1 démarre (héros arcane-hunters,
  dialogue, quête). Le mécanisme gagner→débloquer→reporter est déjà couvert par le
  smoke Haven (N3a) — pas de duplication.

## Différé (N4b→N4d)

Barks de combat (N4b), quêtes journalières en mode libre (N4c), événements
temporaires datés (N4d).

## Vérification par lot

typecheck 4/4 · moteur (golden **inchangé** — données pures) · content +
`content:check` · garde-fou faction + garde-fou couleurs · build < 800 Ko ·
smoke desktop + mobile (campagne Arcane au menu + ch1 démarre).

## Vérification par lot

- [x] typecheck 4/4 (aucun changement de code hors data + 1 test smoke)
- [x] tests moteur 321 (golden **inchangé** — zéro diff moteur)
- [x] tests content 77 + `content:check` (3ᵉ campagne + 2 scénarios, 10 scénarios, parité fr/en)
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (253 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (campagne Arcane au menu + ch1 démarre)

## Décisions / écarts

- **Test de modularité narratif #3 réussi** : la campagne Arcane Hunters =
  **données pures** (`manifest.story` + `story/campaign.json` + 2 scénarios +
  locales), **zéro diff moteur/client** — le pipeline de campagne N3 est bien
  générique pour une 3ᵉ maison.
- **Victoire de scénario ≠ condition de quête** : `buildStructure` n'est PAS une
  condition de victoire de scénario (seules eliminate/capture/defeat/survive le
  sont) — arcane-ch1 utilise `surviveDays: 2` en victoire, la quête gardant
  `buildStructure: fort`.
- **Continuité inter-campagnes** : ch2 rejoue la rencontre Evadne↔Aldric (doc 13
  §9.3) avec un choix binaire posant `aldric-pacte` — réutilise les choix/
  drapeaux N3c.2, sans nouveau mécanisme. Le smoke du choix reste couvert par
  N3c.2 (pas de duplication) ; le smoke N4a vérifie l'apparition + le démarrage.
- Barks de combat (N4b), quêtes journalières (N4c), événements datés (N4d) : à
  suivre.

# 01 — Game Design Document : Vue d'ensemble

## 1. Vision

**Titre de travail** : *Heroes* (codename `heroes`)

Un jeu de stratégie navigateur au tour par tour, héritier direct de **Might & Magic: Heroes Online** et de la série HoMM classique : le joueur incarne des héros qui explorent une carte d'aventure, collectent des ressources, développent des villes, recrutent des armées et livrent des combats tactiques sur grille hexagonale.

**Pitch** : « HoMM III/Heroes Online, jouable en 30 secondes dans n'importe quel navigateur, aussi agréable au pouce qu'à la souris, et conçu pour accueillir une nouvelle faction tous les trimestres. »

### Piliers de design

| Pilier | Ce que ça implique |
|--------|--------------------|
| **Fidélité au core loop HoMM** | Exploration → Ville → Armée → Combat. Pas de réinvention du genre, une exécution moderne. |
| **Sessions courtes possibles** | Un tour de jeu se joue en 1–3 min ; sauvegarde automatique **à chaque fin de tour** (autosave `TurnEnded`) ; reprise instantanée. |
| **Touch-first** | Toutes les interactions au doigt (cibles ≥ 44 px, pas de hover obligatoire, confirmation en 2 taps). |
| **Modularité des factions** | Une faction = un paquet de données + assets. Zéro code moteur spécifique à une faction. |
| **Lisibilité tactique** | À tout moment, le joueur comprend qui peut faire quoi (portées, zones, initiative visibles). |

## 2. Core loop

```
        ┌─────────────────────────────────────────────────┐
        │                 TOUR DE JEU (jour)              │
        │                                                 │
        │  1. EXPLORER ──── héros se déplacent (points    │
        │     │             de mouvement), ramassent      │
        │     │             ressources/artefacts,         │
        │     │             capturent mines & lieux       │
        │     ▼                                           │
        │  2. DÉVELOPPER ── dépenser ressources en ville :│
        │     │             1 bâtiment/ville/jour,        │
        │     │             recruter les créatures        │
        │     ▼                                           │
        │  3. COMBATTRE ─── combats tactiques hex contre  │
        │     │             gardiens neutres / ennemis    │
        │     ▼                                           │
        │  4. PROGRESSER ── XP héros → niveaux →          │
        │                   compétences & sorts →         │
        │                   débloque exploration + risquée│
        └───────────────┬─────────────────────────────────┘
                        │  fin de semaine (7 jours) :
                        ▼  croissance des créatures
              Boucle méta : nouvelles cartes/scénarios,
              factions, héros de collection, classements
```

**Micro-loop (minute)** : déplacer le héros → événement (ressource, combat, coffre) → récompense visible immédiatement.
**Mid-loop (session, 15–30 min)** : finir une semaine de jeu, un palier de ville, un boss de zone.
**Macro-loop (semaines)** : terminer un scénario, débloquer une faction, monter un héros au niveau max, saisons PvP.

## 3. Modes de jeu

| Mode | Description | Phase |
|------|-------------|-------|
| **Scénario solo** | Cartes scriptées avec objectifs (vaincre, capturer, survivre N jours). | MVP |
| **Escarmouche** | Carte générée/fixe vs IA, 1v1 à 2v2. | Alpha |
| **Hot-seat** | 2 joueurs sur le même appareil. | Alpha (quasi gratuit à faire avec un moteur déterministe) |
| **PvP asynchrone** | Tours joués en différé, notifications. Adapté au mobile. | Beta |
| **PvP temps réel** | Tours simultanés avec timer (modèle Heroes Online). | Post-Beta |

## 4. Monétisation (éventuelle)

Le MVP est **sans monétisation**. Si le jeu passe en live-service, le modèle est **free-to-play cosmétique + contenu**, jamais pay-to-win :

| Levier | Contenu | Garde-fou |
|--------|---------|-----------|
| **Factions premium** | Nouvelles maisons vendues à l'unité (les 3 de base restent gratuites) | Équilibrées, jouables contre vous même sans achat |
| **Cosmétiques** | Skins de héros/unités/villes, effets de sorts, portraits | Zéro impact gameplay |
| **Campagnes DLC** | Packs de scénarios narratifs | Le multi reste sur contenu commun |
| **Battle pass saisonnier** | Récompenses cosmétiques + monnaie douce | Progression uniquement par le jeu |
| **Confort** | Slots de sauvegarde cloud supplémentaires, thèmes UI | Jamais de vitesse/ressources achetables |

**Interdits explicites** (leçons de Heroes Online) : pas d'énergie/stamina, pas de timers payables, pas d'achat de ressources ou d'unités, pas de gacha sur du gameplay.

## 5. Scope MVP

### Inclus (MVP = « vertical slice complète »)

- **2 factions** : Haven, Necropolis (7 tiers chacune).
- **1 carte d'aventure** faite main (**32×32** tuiles, `proto-01`) + scénarios courts. *Livré : bien au-delà des 3 prévus — prologue + chapitres de campagne (3 maisons) + tutorial/survie/conquête + 2 scénarios d'événement (`data/scenarios/index.json`).*
- Héros : mouvement, inventaire, 4 attributs, ~12 compétences, ~20 sorts (2 écoles + neutres).
- **Ville** : arbre de construction complet, 1 bâtiment/jour, recrutement, croissance hebdomadaire.
- **Combat hex** : grille 15×10, initiative, riposte, moral/chance, sorts, capacités d'unités, IA de combat basique, auto-combat.
- **7 ressources**, mines capturables, objets de carte (~25 types).
- IA d'aventure minimale (héros neutres statiques + 1 IA joueur simple).
- Sauvegarde locale (IndexedDB), export/import de fichier de sauvegarde.
- UI responsive desktop + mobile portrait/paysage.
- *Livré post-MVP (Alpha 4.15) : **hot-seat** — deux joueurs humains sur le même appareil, avec passage d'appareil (overlay de transition). Le multijoueur en **ligne** reste différé (cf. Exclus + doc 07).*

### Exclus du MVP (mais architecturé pour)

- Multijoueur en ligne (le moteur est déjà déterministe et commandé par messages — voir doc 07).
- Faction Arcane Hunters (spécifiée dès maintenant, produite en Alpha — c'est le test grandeur nature du système de modularité).
- Générateur de cartes aléatoires, éditeur de cartes.
- Monétisation, comptes, cloud saves.
- Caravanes, système de siège avancé (murs/catapulte), semaine des créatures.

### Critères de succès du MVP

1. Une partie complète (victoire par élimination) jouable de bout en bout sur Chrome desktop **et** Safari iOS.
2. Ajouter une 3ᵉ faction de test ne demande **aucune modification** du code moteur (uniquement données + assets).
3. 60 fps sur carte d'aventure et en combat sur un mobile milieu de gamme (test : throttling CPU ×4).
4. Temps de chargement initial < 5 s sur 4G (budget bundle : cf. doc 07).

> ✅ **État (fin Phase 3.6)** : jalon MVP atteint. (1) partie complète jouable
> desktop + mobile (émulation Pixel 7 en CI ; Safari iOS réel = vérification
> manuelle hors CI headless). (2) prouvé : Haven (data-only, 3.3) et Necropolis
> (3.4, via **un** point d'extension générique) + `test-faction` chargées sans
> `if (faction === …)` dans le moteur — garde-fou CI actif. (3) smoke anti-gel
> sous throttling ×4 sur arène **et** carte d'aventure (≥ 5 fps en rendu logiciel
> CI ; cible 60 fps sur matériel réel). (4) budget bundle < 800 Ko gzip tenu en
> CI. Assets peints, `faction:sim` d'équilibrage fin et PvP = Alpha/Beta.

## 6. Références & différenciation

| Référence | Ce qu'on garde | Ce qu'on change |
|-----------|----------------|-----------------|
| HoMM III | Économie, structure de ville, tiers de créatures | UI modernisée, lisibilité mobile |
| Heroes Online (Flash) | Combat hex compact, jouabilité navigateur, quêtes | Pas de F2P agressif, pas de serveur obligatoire au MVP |
| HoMM V/VI | Barre d'initiative dynamique (ATB) — option évaluée, cf. doc 02 §5 | On reste sur tours par vague (plus lisible mobile) |
| Songs of Conquest | Direction pixel-art HD lisible en petit | Notre DA : « gouache stylisée », cf. doc 08 |

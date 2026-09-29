# L10.5 — souterrain généré (et l'IA qui y descend)

Dernier sous-lot du souterrain (cadrage `.claude/plans/l10-underground.md`).
L10.1 a mis la couche dans le modèle, L10.2 dans le format de contenu, L10.3
dans le client : le souterrain est jouable **sur carte éditée**. Il manque les
deux choses qui le rendent réel en partie normale — `generateMap` ne produit
qu'une couche, et l'IA ne prendrait pas un escalier même s'il en existait un.

## 1. Ce qu'on livre

1. **Génération d'une seconde couche** dans `generateMap`, sous option
   `underground` (défaut **désactivé**).
2. **Escaliers** : N paires de monolithes inter-couches, posés sur des tuiles
   atteignables des deux côtés — sinon un héros descendu reste piégé (la règle
   de validation de L10.2 le refuserait de toute façon).
3. **Contenu souterrain** : ressources, coffres, mines et gardiens, à la densité
   des curseurs existants — une caverne vide ne vaut pas le voyage.
4. **L'IA emprunte les escaliers** : point générique (un monolithe dont la
   sortie mène à de l'inexploré devient une cible d'exploration), jamais
   « si souterrain ».
5. **Réglage « Souterrain »** à « Nouvelle partie » (Oui / Non / Aléatoire).

## 2. Arbitrages

- **Défaut désactivé.** Le dépôt tient à ce qu'une graine donne toujours la même
  carte ; activer le souterrain par défaut changerait toutes les cartes
  générées existantes. Le réglage est en façade de « Nouvelle partie », donc
  visible, et le scénario « Les Profondeurs » reste la démo clés en main.
- **Tout le code souterrain s'exécute APRÈS la surface** et ne consomme du RNG
  qu'ensuite : à graine égale, `underground: false` rend une carte identique à
  l'octet près à celle d'avant le lot.
- **Zéro nouvelle règle moteur** : l'escalier reste une paire de monolithes.
  L'IA ne gagne qu'une *cible* d'exploration de plus, pas une notion de couche.

## 3. Étapes

1. **Générateur** — grille souterraine (bruit dédié → sol/roche), composante
   principale isolée par flood-fill, paires d'escaliers, objets.
   → vérif : `content:check`, test de propriété sur N graines (carte valide via
   `loadMap`, ≥ 1 paire d'escalier, sol souterrain atteignable), et **carte
   inchangée à graine égale sans l'option**.
2. **IA** — un monolithe menant à de l'inexploré devient une cible.
   → vérif : test unitaire (l'IA descend), property « IA vs IA se termine » sur
   une carte à deux couches.
3. **Client** — réglage « Souterrain » (Oui / Non / Aléatoire seedé), câblé
   jusqu'à `resolveGeneratedMap`.
   → vérif : test unitaire de `resolveNewGameConfig`, smoke inchangé.
4. **Docs** — doc 02 §2.1 (génération) + doc 09 (réglage), journal de plan.
   → vérif : suite complète + garde-fous + budget + smoke `@core`.

## 4. Journal

- **2026-09-01** — plan écrit, branche `claude/l10-5-underground-generation`.

- **2026-09-01 — livré.**
  - **Générateur** : bloc souterrain en fin de `generateMap`, sous option
    `underground` (défaut off). Caverne = champ de bruit dédié (`seed ^ …`) →
    sol/roche ; les bouches d'escalier sont tirées dans la composante
    ATTEIGNABLE de la surface (`inMain`), la sortie est une petite salle creusée
    à la même case, reliée aux autres bouches en creusant — la caverne est donc
    parcourable d'un escalier à l'autre. Peuplement : ressources, coffres, mine,
    gardiens « profonds » (`pickUnitForDepth(0.85)`), aux curseurs existants.
  - **Écart au plan** : pas de flood-fill « on rebouche les poches isolées ».
    Elles sont sans conséquence (comme en surface) et les reboucher coûterait un
    balayage complet pour un gain nul — objets et escaliers sont, eux, garantis
    dans la composante atteignable.
  - **IA** : `unexploredThroughTeleport` — une bouche de monolithe DÉJÀ EXPLORÉE
    dont la couche d'arrivée garde des tuiles sous le brouillard devient la cible
    d'exploration, en second choix seulement (la couche courante d'abord). Rien
    de « souterrain » dans le code : une paire de téléporteurs, point. Le
    ping-pong redouté n'existe pas — en arrivant dans la caverne, la même règle
    donne d'abord la priorité à l'inexploré local.
  - **Client** : réglage « Souterrain » (Oui / Non / Aléatoire seedé), résolu
    APRÈS les densités ⇒ un réglage explicite ne consomme aucun RNG et laisse la
    séquence de tirages (factions/carte/héros) intacte.
  - **Bug de L10.2 débusqué par la génération** : la validation « position de
    départ occupée par un objet » ignorait la COUCHE — un objet posé dans la
    caverne sous un départ faisait rejeter toute la carte. Corrigé au loader
    (l'occupation ne compte qu'en surface) + test des deux sens.
  - **Calibrage de la caverne** : au seuil naïf (`fbm > 0.5`) le « souterrain »
    n'était qu'une plaine tachetée de rochers (54 % de sol). Mesuré puis réglé à
    `> 0.58` en fréquence 9 ⇒ ~⅓ de sol, des salles et des galeries.
  - Tests : contenu **175** (+3 : validité sur 20 graines avec escaliers appariés
    inter-couches ; « sans l'option, la surface est identique à l'octet près » ;
    objet sous un départ accepté / objet SUR un départ toujours refusé) ;
    moteur **988** (+4 : l'IA descend, ignore l'escalier tant qu'il lui reste de
    l'inexploré local, n'y va pas si la caverne est déjà connue, et property
    « IA vs IA sur deux couches se termine ET visite le souterrain ») ; client
    **87** (+2 : propagation du réglage, tirage aléatoire reproductible).

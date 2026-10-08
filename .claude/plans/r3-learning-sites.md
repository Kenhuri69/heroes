# R3 — Des lieux d'apprentissage sur toutes les cartes

> Lot R3 du plan `game-experience-enrichment.md` (§5bis.2), amendé par l'expert
> (§5bis.4) et tranché par l'utilisateur le 2026-10-08 (§5bis.5, D-R3 **oui** :
> la cabane enseigne aussi Sagesse et les écoles de magie, sur proposition
> Apprendre/Refuser, plafond de 6 compétences, jamais une compétence de faction).

## 1. Constat

- `learnSpell` (sanctuaire) enseigne n'importe quel cercle, Sagesse ou pas.
- `grantSkill` (cabane) ignore le plafond de 6 compétences et s'applique **en
  passant** : la cabane impose une compétence non voulue.
- Le générateur ne pose ni sanctuaire, ni cabane, ni fabrique de machines : ces
  lieux n'existent que sur les cartes faites main.
- L'IA ignore tous les lieux de bonus sauf la fontaine de mana.

## 2. Décisions

- **Sanctuaire** : un sort de cercle > `heroLearnableCircle` n'est pas appris et
  la visite **n'est pas consommée** (le héros reviendra avec Sagesse).
- **Cabane** :
  - la fouler arrête le héros et pose une **proposition** (`pendingSkillOffer?`,
    optionnelle ⇒ pas de bump) ;
  - `ResolveSkillOffer { accept }` : accepter apprend la compétence (rang 1) et
    consomme la visite, refuser ne consomme rien ;
  - `MoveHero`/`EndTurn` sont refusés tant qu'elle est posée (comme l'offre de
    gardien neutre) ;
  - à 6 compétences, ou pour une compétence d'une autre faction, il n'y a pas de
    proposition : la visite est refusée et non consommée ;
  - compétence déjà connue : comportement inchangé (visite consommée sans gain).
- **Refus expliqué** : événement `BonusRefused { reason: 'wisdomRequired' |
  'skillsFull' }` ⇒ toast côté client.
- **Générateur v3** (`generatorVersion: 3` par défaut ; v1 et v2 identiques à
  l'octet) :
  - sanctuaires de cercle 1, 2 et 3, dont le sort est tiré parmi les écoles
    **communes** (jamais l'école d'un manifeste de faction) ;
  - cabanes dont la compétence est tirée parmi les compétences **communes**
    (Sagesse et écoles comprises) ;
  - fabrique de machines de guerre ;
  - comptés sur `eventBuildingDensity`, le cercle 3 posé en profondeur.
  Les listes arrivent par `standardMapOptions` (client et CLI identiques).
- **IA** : `levelXp`, `permanentStat`, `learnSpell` (apprenable et inconnu) et
  `grantSkill` (inconnue, acceptée) deviennent des cibles collectables. À la
  cabane, l'IA accepte s'il lui reste au moins 2 emplacements libres.
- **Client** :
  - modale « Apprendre / Refuser » (compétence et description) ;
  - toasts de refus ;
  - infobulle du lieu montrant le sort ou la compétence avant le pas, avec
    « Sagesse requise » si le cercle n'est pas apprenable.

## 3. Étapes

1. [x] Moteur : gate du sanctuaire, plafond et proposition de la cabane, commande, événement, tests
2. [x] IA : lieux collectables, acceptation de la cabane, tests
3. [x] Générateur v3 + `standardMapOptions` ; tests (v1/v2 à l'octet, présence sur 20 graines)
4. [x] Client : modale, toasts, infobulle, locales FR/EN
5. [x] Docs 02 §2.2 (et 08), CLAUDE.md, plan d'enrichissement
6. [ ] Vérifications

## 4. Vérifications

- [ ] typecheck (sans `-s`), lint, build ; budget ; garde-fous faction et couleurs
- [ ] tests moteur / contenu / client / serveur ; golden inchangé
- [ ] Playwright comme en CI

## 5. Journal

- 2026-10-08 : plan ouvert. Empreintes v2 relevées avant le lot (36², options du
  test LE3, `generatorVersion: 2`) : graine 42 → `cf75fbf94e66bf90`, graine 7 →
  `54d805d5b87c06e1`.
- 2026-10-08 : moteur, IA, générateur, client et docs livrés. Écarts et décisions :
  - l'offre de cabane suit le modèle de l'offre de gardien neutre (LE5) plutôt
    que le message à choix des triggers : celui-ci n'applique que des effets
    simples et consomme le trigger, alors qu'un refus doit laisser la visite ;
  - compétence d'une autre faction posée à la main sur une carte : non filtrée par
    le moteur (le générateur n'en pose jamais ; une carte écrite reste la
    responsabilité de son auteur) ;
  - l'IA n'a pas de liste de compétences prioritaires : la règle se réduit à « au
    moins 2 emplacements libres » ;
  - nombre de lieux : base 0,25 par sorte sur 24², mis à l'échelle de l'aire
    (~2 sur 64², ~4 sur 96²) ; ids `spell-shrine-*`, `witch-hut-*`, `war-factory-*` ;
  - l'infobulle montrait déjà le sort et la compétence ; elle ajoute « Sagesse
    requise » pour le héros sélectionné ;
  - doc 08 non touchée : elle ne décrit pas les modales forcées (offre neutre comprise) ;
  - smoke `@core` : la cabane de proto-01 (8,7), « Apprendre » ⇒ Repérage appris.
  - Bench IA « niveau moyen au j28 » du critère : non fait (pas de harnais de
    partie IA contre IA sur carte générée) ; couvert par les tests unitaires de
    ciblage et d'acceptation.

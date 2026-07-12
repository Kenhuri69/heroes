# 13 — Plan de Polishing Narratif & Storytelling

Plan d'exécution du chantier « campagne narrative » listé en Phase 4 de la
roadmap (doc 09) — à lancer **après** les mécaniques core (post-Alpha 4.x).
Objectif : redonner une âme narrative au jeu, ce qui manque à la plupart des
remakes purement mécaniques, en restant fidèle à l'esprit de *Might & Magic:
Heroes Online* (navigateur, accessible, chapitré) et aux invariants du projet.

**Invariants non négociables appliqués à la narration** (guidelines §8) :

1. **Le moteur ne connaît aucune quête ni aucun dialogue**, comme il ne
   connaît aucune faction : la narration est du **contenu déclaratif**
   (JSON validé par schéma) interprété par des systèmes génériques.
2. **Déterminisme préservé** : la couche narrative lit les événements du
   moteur, elle n'injecte jamais d'aléa dans la simulation. Un replay d'une
   partie avec ou sans dialogues affichés produit le même état.
3. **Touch-first** : toute interaction narrative (avancer un dialogue, ouvrir
   le journal) se fait au doigt, cibles ≥ 44 px, jamais de hover obligatoire.
4. **i18n complète** : zéro chaîne en dur — tout texte narratif passe par les
   clés `@loc:` FR/EN, parité vérifiée en CI (audit 3.6 étendu au narratif).
5. **Budget bundle** : le texte narratif est chargé **à la demande** par
   chapitre (fetch JSON hors bundle JS, comme les assets doc 12 §10).

---

## 1. Vue d'ensemble narrative

### 1.1 Ton

**« Conte sombre raconté à voix claire. »** Ashan est un monde d'éclipses,
de moissons de morts et de pactes — mais Heroes Online le racontait avec une
légèreté accessible : des dialogues courts, des PNJ à caractère, une pointe
d'humour sec, jamais de cynisme gratuit ni de grimdark opaque. On garde ce
registre :

- **Phrases courtes, lisibles sur mobile.** Une réplique = 1 à 3 lignes de
  boîte de dialogue. Pas de pavés.
- **Humour de caractère, pas de blagues méta.** Le squelette porte-bannière
  qui a le mal de mer est drôle ; la référence pop-culture qui casse le monde
  ne l'est pas. Les **titres de quêtes** sont un emplacement d'humour légitime
  (tradition HO : « Unghoul Ye Here… ») — le corps du texte reste sobre.
- **La gravité passe par les situations**, pas par l'emphase : une prêtresse
  qui bénit des conscrits qu'elle sait condamnés en dit plus qu'un monologue.

### 1.2 Thèmes principaux

| Thème | Où il se joue |
|-------|----------------|
| **Ce qu'on est prêt à sacrifier pour protéger** | Haven : la foi qui exige tout ; le devoir contre la personne |
| **La mort comme point de vue, pas comme camp du mal** | Necropolis : la non-vie est une *doctrine* (Asha aspect Mort), pas une caricature — ses héros croient sincèrement purifier |
| **Connaître le monstre, c'est lui ressembler** | Arcane Hunters : chaque Marque rapproche le chasseur de sa proie ; le T8 Pénitent est la fin logique de l'Académie |
| **La frontière** | Cadre commun : une marche frontalière que trois puissances lisent différemment — bastion sacré, moisson, terrain de chasse |

### 1.3 Arc global (les trois campagnes racontent la même guerre)

Cadre : **les Marches de Cendregarde**, une province frontalière du
Saint-Empire du Griffon, bâtie — personne ne l'a su pendant des siècles — sur
un **verrou de Sombreveille** : l'un des sceaux posés jadis sur une déchirure
vers Sheogh. Le sceau s'effrite. Les morts y reposent mal (aubaine pour
Heresh), la lumière d'Elrath y vacille (croisade pour le Havre), et l'Académie
de Sombreveille y reconnaît sa raison d'être et son plus vieux mensonge.

- **Acte I — Les signes** : chaque faction découvre l'anomalie par son prisme
  (miracles inversés / marées d'âmes / relevés de l'Académie).
- **Acte II — La guerre des lectures** : les trois puissances s'affrontent
  pour le contrôle des sites du sceau, chacune convaincue que les deux autres
  aggravent la fissure. C'est le cœur PvE : mêmes lieux, camps différents.
- **Acte III — Le verrou** : la vérité (le sceau ne peut être *réparé*, il
  doit être *porté* — par un lieu, une lignée ou un ordre) force un
  dénouement différent par campagne, cohérent avec le fantasme de la faction.

L'arc est conçu pour être **extensible** : toute nouvelle maison (doc 06 §6)
arrive dans les Marches avec *sa* lecture du sceau (la Symbiose sylvaine y
verrait une plaie du monde-forêt, la Combine une source d'énergie…). Le
gabarit `docs/templates/faction-template.md` gagnera une section « Lecture du
sceau + arc de campagne » (cf. §8).

---

## 2. Fidélité à Heroes Online (2014) — ce qu'on garde, ce qu'on change

**Rappel factuel de l'original** (sources : wiki Might & Magic Fandom — pages
*Heroes Online*, *Albin*, *Duncan (HO)*, *Yorath*, *Belketh*, *Sandro (Ashan)* ;
mmos.com) : le jeu se situe vers **800 YSD** sous le Saint Empire du Faucon de
Duncan Falcon. Deux fils d'ouverture symétriques — Haven enquête sur la
disparition de l'ambassadeur Albin von Helwald, Necropolis remonte, pour
Belketh, la piste d'une évasion de la prison des Griffes de Namtaru — dans des
**chapitres propres à chaque faction** (Blackbough / Falcon's Reach côté
Haven ; Namtaru's Claws / Nar-Heresh côté Necropolis) qui **convergent**
ensuite vers des chapitres communs (Whispering Plains, Lightlands) contre un
saboteur tiers : **Sandro et l'Ordre du Vide**, qui torpille une paix
improbable entre l'Empire et Heresh. Les quêtes d'histoire déverrouillaient
des provinces ; des journalières répétables parsemaient la carte ; l'humour
passait par les titres de quêtes (« Unghoul Ye Here… »). La presse de l'époque
a toutefois jugé l'histoire « terne » et le F2P envahissant : notre polish
reprend la **structure** (qui était bonne) et investit là où l'original était
faible — caractérisation, point de vue, économie de mots.

Notre arc global (§1.3) transpose directement ce patron : campagnes de faction
qui racontent la même guerre et convergent (l'antagoniste tiers de l'original —
le Vide — devient ici ce qui suinte du sceau), diplomatie improbable
Lumière/Ténèbres incluse (l'arc de Mère Corbeau).

Ce que la version Flash faisait bien, et qu'on reprend :

| Heroes Online (Flash) | Ici |
|---|---|
| Progression **chapitrée par zones** scénarisées, quêtes qui guident l'exploration | Campagne = suite de scénarios-chapitres sur cartes dédiées, quêtes principales comme fil d'Ariane |
| Conflit **Haven vs Necropolis** au lancement, chapitres de faction **convergeant** vers un arc commun | Trois campagnes (Haven, Necropolis au lancement narratif ; Arcane Hunters ensuite), même guerre vue de trois camps, actes III convergents |
| **Quêtes personnelles** liées aux personnages nommés (Albin, Yorath…) | Arcs personnels des héros nommés (§5.4), 3 étapes chacun |
| Quêtes journalières répétables et **événements** qui redonnent une raison de revenir | Quêtes journalières en mode libre + scénarios d'événement datés (§4.3) |
| Narration **légère à consommer** : dialogues textuels avec PNJ, jamais de cinématique lourde | Dialogues portrait + texte dans PixiJS (le format portrait est notre choix, dans l'esprit HoMM), cutscenes = caméra de carte scriptée (§6.3), tout skippable |
| Jouable en 30 s dans un navigateur | Le narratif ne pèse ni au chargement ni au doigt |

Ce qu'on **refuse** de reprendre (leçons doc 01 §4) : les murs d'énergie et
timers F2P qui hachaient le rythme des chapitres, les quêtes « reviens dans
4 h », la narration au service de la boutique. Les événements temporaires
sont du **contenu**, jamais de la pression.

Écart assumé : Heroes Online était un MMO à serveur ; au stade présent le jeu
est solo-local (backend = Beta, doc 07 §5). Les « événements serveur »
deviennent des **événements locaux datés** (§4.3), architecturés pour devenir
serveur plus tard sans changer le format de contenu.

---

## 3. Lore & background

### 3.1 Cadre : Ashan, et ce qu'on s'autorise

On situe le jeu dans **Ashan** (monde du reboot Ubisoft : dragons-dieux,
Elrath la Lumière, Asha la mère primordiale, Sheogh et ses éclipses) — c'est
déjà le cas des résumés de lore des docs 03/04 (Saint-Empire du Griffon,
Nécromanciens d'Heresh). Règles d'écriture :

- **Ashan est un décor, pas une bible juridique.** On respecte la cosmologie
  (dragons-dieux, éclipses, Heresh, l'Empire) mais les Marches de Cendregarde,
  Sombreveille et tous les personnages nommés sont **originaux** — aucun
  personnage canon d'Ubisoft n'apparaît (liberté créative + prudence PI pour
  un projet fan).
- Chronologie volontairement floue : « des générations après la dernière
  Éclipse ». On ne se cheville pas au calendrier YSD des jeux canon.

### 3.2 Haven — le Havre (doc 03)

**Résumé existant conservé** : le Saint-Empire du Griffon garde la frontière
contre les ténèbres depuis la Première Éclipse.

**Développement campagne** : dans les Marches, l'Empire a bâti Cendregarde
— forteresse, cathédrale, cimetières bénis — sans savoir ce qu'elle scellait.
Quand les miracles s'inversent (l'eau bénite gèle en plein été, les vitraux
saignent), le trône y voit une épreuve de foi et envoie une croisade. L'arc
Haven interroge : *que protège-t-on — le lieu, le dogme, ou les gens ?*

**Héros nommés** (doc 03 §5) : **Aldric** (chevalier, foi simple et droite —
son arc : découvrir que Cendregarde repose sur un mensonge de l'Église et
choisir entre vérité et unité) ; **Séraphine** (prêtresse, mystique — son
arc : ses visions viennent-elles d'Elrath ou de ce qui dort sous le sceau ?).

### 3.3 Necropolis — la Nécropole (doc 04)

**Résumé existant conservé** : les Nécromanciens d'Heresh vénèrent Asha sous
son aspect de Mort ; chaque champ de bataille est une moisson.

**Développement campagne** : dans les Marches, les morts refusent le repos —
pour Heresh c'est un appel : quelque chose *sous* la province empêche les
âmes de rejoindre la Roue. La campagne Necropolis n'est pas une invasion mais
un **pèlerinage doctrinal** qui tourne à la guerre : rendre les âmes à Asha,
même s'il faut faucher les vivants qui s'interposent. L'arc interroge : *une
foi peut-elle rester pure quand elle profite de chaque cadavre ?*

**Héros nommés** (doc 04 §5) : **Vhalen** (liche-archiviste, doctrinaire —
son arc : découvrir que le sceau nourrit Heresh en âmes depuis toujours, et
que le réparer affamerait son peuple) ; **Mère Corbeau** (nécromancienne
« sage-femme des âmes », presque douce — son arc : recueillir l'âme d'un
enfant de Cendregarde que le sceau retient, quitte à pactiser avec le Havre).

### 3.4 Arcane Hunters — intégration au lore (doc 05)

Le doc 05 pose : *« L'Académie de Sombreveille fut fondée sur les ruines d'un
portail démoniaque scellé. »* On l'intègre à Ashan ainsi :

- **Origine** : après une Éclipse ancienne, des mages dissidents des Cités
  d'Argent jugèrent leurs pairs trop contemplatifs. Ils fondèrent une académie
  *sur* le portail qu'ils venaient d'aider à sceller — pour ne jamais cesser
  de le surveiller. D'où la doctrine : « Connaître, marquer, abattre. »
  L'Académie est l'ordre de ceux qui pensent que la magie est un **permis de
  chasse**, pas un art.
- **Le mensonge fondateur** (moteur de la campagne) : le sceau des origines
  n'a jamais été complet. Les fondateurs ont dispersé des **verrous**
  secondaires à travers Ashan — dont un sous ce qui deviendrait Cendregarde —
  et ont effacé les cartes. L'Académie chasse les démons *échappés de ses
  propres fuites*. Les quatre Cercles (Vigile, Traque, Sceau, Abîme) sont
  autant de réponses internes à cette faute : surveiller, poursuivre,
  colmater, ou étudier l'ennemi jusqu'à la greffe (le Pénitent Démonique T8
  est un aveu ambulant).
- **Rapports aux autres maisons** : le Havre les tolère comme on tolère un
  exterminateur — utile, impie ; Heresh les fascine et les révulse (les
  Hunters *retiennent* les âmes démoniaques hors de la Roue) ; les Cités
  d'Argent les considèrent comme des enfants prodigues armés. « Officiellement
  neutre… mais toute armée trop puissante est un spécimen d'étude » (doc 05).
- **Héros nommés** (doc 05 §7) : **Evadne Corvel** (Maître de Chasse,
  ex-Cercle de l'Abîme, moitié de visage runique — son arc : la relique
  greffée sur son visage provient du verrou de Cendregarde ; le sceau la
  reconnaît) ; **Professeur Alwin Marchmont** (Doyen des Sceaux, sa chouette
  familière — son arc : il est le dernier à savoir lire les cartes effacées
  des fondateurs, et doit choisir entre le secret de l'Académie et sa survie).

### 3.5 Textes d'ambiance systématiques (« flavor »)

Chaque entité de contenu gagne un champ de texte court localisé (≤ 200
caractères), affiché dans les écrans existants (fiche unité, vignette de
bâtiment, infobulle d'artefact, description de sort) :

- `unit.loreKey`, `building.loreKey`, `artifact.loreKey`, `spell.loreKey`
  (clés `@loc:` optionnelles — schéma rétro-compatible, contenu existant
  valide sans modification).
- Écrit **du point de vue de la faction** (le Squelette vu par Heresh est un
  « frère simplifié », pas un monstre).
- C'est le lot narratif le moins cher (zéro système) et le plus rentable en
  immersion : il arme tout l'existant. → Lot **N1** (§7).

---

## 4. Structure de campagne et modes

### 4.1 Mode Campagne (linéaire, chapitré)

- Une **campagne = 3–4 chapitres**, un chapitre = un scénario sur carte
  dédiée (le format `*.scenario.json` existant, étendu — §6.1) avec quêtes
  principales scriptées, dialogues d'ouverture/fermeture et 2–3 quêtes
  secondaires.
- **Continuité légère entre chapitres** (esprit HO, simplicité d'abord) : le
  héros nommé conserve niveau/compétences/artefacts entre les chapitres d'une
  même campagne (armée et ville re-données par le chapitre — évite les
  impasses de difficulté). Un `campaignState` léger (chapitre atteint, choix
  binaires marquants) est sauvegardé à part des sauvegardes de partie.
- **Déblocage** : campagne Haven ouverte d'emblée (faction « tutoriel »,
  doc 03) ; Necropolis après le chapitre 1 de Haven ; Arcane Hunters après un
  chapitre de chacune des deux autres (leur campagne relit les événements des
  deux premières — récompense de la connaissance du joueur).
- Les 3 scénarios actuels (`tutorial`/`survival`/`conquest`) sont
  **ré-habillés** en prologue + chapitres du fil Haven au lot N2 : on
  raconte d'abord sur les cartes qui existent, on produit des cartes neuves
  ensuite.

> **État livré (synthèse N1→N3c — lire §4/§5/§6 contre les sections « État Nx »
> en fin de document, qui font foi du livré).** Le lot narratif a dépassé N2 :
> les modes/quêtes ci-dessous sont largement livrés, avec ces écarts vs le plan
> initial :
> - **Scénarios** : le prologue a été **ajouté** en nouveau scénario (les 3
>   existants `tutorial`/`survival`/`conquest` restent **intacts**, pas
>   ré-habillés). Le jeu compte **12 scénarios** (`data/scenarios/index.json`) :
>   prologue + 6 chapitres de campagne (Haven/Necropolis/Arcane) + tutorial/
>   survival/conquest + 2 événements.
> - **Campagnes** : système de campagne chapitrée **livré** (N3a) avec **report
>   de héros** (niveau/XP/compétences/artefacts), campagnes **Haven** et
>   **Necropolis** en données pures (N3b), cutscenes caméra + choix de dialogue
>   **câblés** `setFlag`/`next` (N3c) — `campaignFlags` relus entre campagnes.
> - **Moteur de quêtes** (`engine/quest`, N2a) : conditions **génériques et
>   riches** (`eliminateAllEnemies`/`captureTown`/`defeatHero`/`surviveDays`/
>   `buildStructure`/`ownUnits`/`defeatGuardian`/`visitTile`/`resources`/
>   `artifact`/`units`) ; récompenses `resources`/`artifact`/`units` (**pas** de
>   XP ni de sort). Les quêtes **démarrent en bloc à `StartGame`** (`GameState.
>   quests`) — pas de `trigger` par quête (différé). Prologue = **2 quêtes / 2
>   dialogues**.
> - **Client** : journal de quêtes + `DialogueBox` (choix empilés) livrés ; le
>   **recentrage caméra** existe (mini-carte `panCameraTo`, cutscenes) et les
>   **badges d'événement** au menu. Aucun champ de schéma « validé mais ignoré »
>   ne subsiste (les choix `setFlag`/`next` sont interprétés depuis N3c.2).

### 4.2 Mode Libre / Sandbox

- L'escarmouche (Alpha, doc 09) reste **sans fil narratif imposé** — mais
  héritière du polish : textes d'ambiance, barks, journal listant les
  objectifs de victoire comme des « quêtes » (une seule UI d'objectifs pour
  tout le jeu).
- **Quêtes journalières** en mode libre (§5.3) : petites missions générées
  depuis des gabarits data-driven, rejouables, qui donnent une saveur
  « Contrats » à la HO sans MMO.

### 4.3 Événements temporaires

- Un **événement = un scénario + une fenêtre de dates** (champ
  `availability { from, to }` dans l'index des scénarios) + un habillage
  narratif saisonnier. Exemples : *La Semaine des Revenants* (croissance
  morts-vivants ↑, carte spéciale), *La Grande Curée* (contrats de chasse
  généralisés à toutes les factions).
- Vérifié **à l'ouverture du menu** (horloge client — hors moteur, le
  déterminisme de la simulation n'est jamais daté) ; un événement expiré
  reste rejouable en « archive » sans ses récompenses cosmétiques. Aucune
  pression F2P : jouer un événement = y gagner du contenu, jamais rattraper
  un retard.
- Format identique aux scénarios ⇒ quand le backend arrivera (Beta), les
  événements deviennent poussés par le serveur **sans changer le contenu**.

---

## 5. Système de quêtes

### 5.1 Principes

- Une quête est un **objet déclaratif** : déclencheur → étapes (conditions
  observables sur l'état/les événements du moteur) → récompenses (commandes
  moteur existantes). Aucun script impératif dans le contenu.
- Le moteur gagne **un** système générique `engine/quest` (même philosophie
  que `engine/scenario`, qu'il généralise) : il évalue des conditions et
  émet des événements `QuestAdvanced`/`QuestCompleted`. Il ne connaît **ni
  texte, ni dialogue, ni faction** — uniquement des types de conditions.
- L'état des quêtes vit dans `GameState` (sérialisé ⇒ bump de
  `CURRENT_SAVE_VERSION`, garde 3.8 déjà en place).

### 5.2 Types de quêtes

| Type | Rôle | Exemples de conditions (mappées sur l'existant) |
|------|------|--------------------------------------------------|
| **Principale** | Fil d'Ariane du chapitre, obligatoire, ordonnée | `captureTown`, `defeatHero`, `reachTile`, `surviveDays` — sur-ensemble des objectifs de scénario actuels (`engine/scenario/types.ts`) |
| **Secondaire** | Optionnelle, récompense + éclairage de lore | `defeatGuardian(objetCarte)`, `collectResource(n)`, `buildStructure(id)`, `recruitUnits(tier, n)`, `visitTile` |
| **Journalière** (mode libre) | Rejouabilité, saveur « contrats » | Gabarits paramétrés tirés au RNG **seedé de la partie** (déterminisme conservé) : « Vaincs le gardien X », « Rapporte 10 bois » |
| **Personnelle de héros** | Arc du héros nommé (§3), 3 étapes trans-chapitres | Conditions liées au héros (`heroLevel`, `equipArtifact`, `castSpell(école)`, victoire avec le héros) |

### 5.3 Intégration aux mécaniques (la quête montre le jeu)

Règle d'or : **chaque quête enseigne ou exploite une mécanique existante**,
jamais l'inverse (pas de mécanique créée pour une quête au lancement du
chantier) :

- Exploration → quêtes `reachTile`/`visitTile` guident vers le brouillard,
  les mines, les objets de carte.
- Ville → quêtes `buildStructure`/`recruitUnits` scandent l'arbre de
  construction (le chapitre 1 Haven *est* un tutoriel de ville déguisé).
- Combat → quêtes `defeatGuardian`/`defeatHero` + conditions fines déjà
  émises par le moteur en événements (gagner sans pertes, utiliser un sort).
- Mécaniques de faction → les quêtes des campagnes tardives exploitent la
  signature (Necropolis : « relève N squelettes en une bataille » ;
  Arcane Hunters : « abats une cible portant 3 Marques » — les événements
  `MarksConsumed`, `FactionResourceGained` existent déjà).
- Récompenses = commandes existantes : ressources, artefact, troupes, XP,
  sort appris. Pas de monnaie narrative dédiée.

### 5.4 Arcs personnels des héros

Six arcs au total (2 par faction, héros nommés des docs 03/04/05), 3 étapes
chacun, entrelacés dans les chapitres de leur campagne. L'étape 3 offre un
choix binaire **sans embranchement de carte** (simplicité HO) : la
conséquence est un artefact/une troupe/une réplique finale différente, et un
drapeau dans `campaignState` que les campagnes suivantes peuvent relire
(ex. : si Aldric a révélé le mensonge de l'Église, la campagne Arcane Hunters
l'évoque dans un dialogue).

> **État livré (N-ARCS)** : arcs personnels en **données pures** (quêtes
> `kind: personal` + dialogues à `choices`/`setFlag`, patron N3c.2, zéro diff
> moteur). **Aldric** (`haven-ch2`, drapeaux `aldric-merciful`/`aldric-ruthless`)
> et **Séraphine** (`haven-ch3` — « ses visions viennent-elles d'Elrath ou de ce
> qui dort sous le sceau ? », drapeaux `seraphine-faith`/`seraphine-doubt`)
> livrés. *Restent :* Vhalen, Mère Corbeau (Necropolis), Evadne, Marchmont
> (Arcane Hunters).

---

## 6. Implémentation technique (PixiJS, data-driven)

### 6.1 Contenu : formats JSON (source de vérité : `@heroes/content`)

Nouveaux fichiers sous `data/story/`, validés par schémas Zod dans
`packages/content` (comme factions/scénarios/cartes) :

Le contenu narratif suit la règle de modularité du contenu (doc 06) : **la
campagne d'une faction vit dans son paquet de faction**, le transverse vit
dans `data/story/` :

```
data/story/                          # transverse (aucune faction)
  index.json                         événements (fenêtres de dates), déblocages croisés
  characters.json                    catalogue PUBLIC des personnages (portraits par humeur)
  daily-templates.json               gabarits de quêtes journalières du mode libre

data/factions/<id>/story/            # narratif DE la faction, dans son paquet
  campaign.json                      chapitres ordonnés, héros imposé, déblocages
  <chapter>.quests.json              quêtes (déclencheurs, étapes, récompenses)
  <chapter>.dialogs.json             nœuds de dialogue (référencés par les quêtes)
```

Les textes narratifs d'une faction vont dans les `locales/{fr,en}.json`
**du paquet** (fusion au catalogue `@loc:` déjà en place depuis 3.7) ; le
manifeste déclare sa campagne (`"story": "story/campaign.json"`, optionnel —
une faction sans campagne reste valide). Le catalogue de personnages est
« public » : une campagne peut faire *parler* les personnages d'une autre
maison (référence par id), jamais modifier ses quêtes.

Esquisse de schémas (détaillés au lot N1) :

```jsonc
// quête
{
  "id": "haven-ch1-relever-cendregarde",
  "kind": "primary",                       // primary | side | daily | personal
  "trigger": { "type": "chapterStart" },   // ou questCompleted / dialogChoice / reachTile…
  "steps": [
    { "id": "build-fort",  "condition": { "type": "buildStructure", "buildingId": "fort" },
      "dialogBefore": "dlg-seraphine-ruines" },
    { "id": "clear-mine",  "condition": { "type": "defeatGuardian", "objectId": "mine-or-01" } }
  ],
  "rewards": [{ "type": "resources", "gold": 1000 }, { "type": "artifact", "id": "sceau-terni" }],
  "titleKey": "@loc:quest.haven-ch1-relever.title",
  "descriptionKey": "@loc:quest.haven-ch1-relever.desc"
}

// nœud de dialogue (graphe plat, choix optionnels)
{
  "id": "dlg-seraphine-ruines",
  "lines": [
    { "speaker": "seraphine", "portrait": "seraphine-worried", "textKey": "@loc:dlg.ch1.ruines.1" },
    { "speaker": "aldric", "textKey": "@loc:dlg.ch1.ruines.2" }
  ],
  "choices": [                              // optionnel ; sinon, fin de nœud
    { "textKey": "@loc:dlg.ch1.ruines.c1", "next": "dlg-ruines-foi", "setFlag": "aldric-doute" }
  ]
}
```

Les `speaker`/`portrait` référencent un petit catalogue de personnages
(`data/story/characters.json` : id, nom localisé, portraits par humeur —
pipeline d'avatars du skill asset-sheet réutilisé).

### 6.2 Moteur : le strict minimum, générique

- `engine/quest` : interprète conditions/étapes/récompenses ; état dans
  `GameState.quests` ; événements `QuestAdvanced`/`QuestCompleted`. Les
  types de conditions sont un **catalogue fermé et générique** (comme les
  capacités de combat) — ajouter une campagne = données, zéro diff moteur.
- `engine/scenario` (victoire/défaite) devient un cas particulier consommé
  par le même évaluateur de conditions (dette évitée : une seule notion
  d'« objectif » dans le moteur).
- **Les dialogues n'existent pas côté moteur.** Un `dialogBefore` est une
  donnée que le *client* lit quand `QuestAdvanced` survient ; le moteur émet
  l'événement et continue. Conséquence : l'IA, l'auto-combat et les replays
  ignorent totalement la couche narrative (déterminisme garanti par
  construction).
- Drapeaux narratifs (`setFlag`) : table `campaignState.flags` côté client
  (hors `GameState`), sauvegardée avec la progression de campagne.

### 6.3 Client PixiJS : dialogues, cutscenes, journal

- **Boîte de dialogue** (`client/ui`) : composant plein-largeur bas d'écran
  (portrait 96 px, nom, texte, indicateur « tap pour continuer ») ; tap
  n'importe où = avancer, bouton **Passer** persistant (≥ 44 px) = sauter le
  nœud entier ; choix = boutons empilés. Respecte les 3 crans de police
  (`rem`) et les motifs non chromatiques (FactionBadge du locuteur).
- **Cutscenes = caméra de carte scriptée**, pas de vidéo : une séquence
  déclarative `[panTo(tile), revealFog(zone), spawnVisual(id), dialog(id)]`
  jouée par la scène d'aventure Pixi existante (pan/zoom déjà là). Letterbox
  léger pendant la séquence, skippable d'un tap. Coût rendu ≈ 0, poids ≈ 0.
- **Journal de quêtes** : nouvel onglet du tiroir héros existant (mobile) /
  panneau latéral (desktop) — liste Principales/Secondaires/Journalières,
  étape courante en gras, tap sur une quête = **centrer la caméra** sur la
  tuile cible si elle est connue (pont direct quête → carte). Badge « ! »
  sur l'icône à chaque `QuestAdvanced`.
- **Narration d'exploration** : textes courts contextuels via toasts
  existants (ramassage, capture) enrichis de variantes localisées ; les
  objets de carte notables gagnent un texte d'inspection (tap long — parité
  hover déjà requise par doc 08).
- **Narration de combat** : « barks » — 1 ligne au début du combat contre un
  gardien nommé/un héros de campagne, choisie dans un pool localisé (aléa
  **client**, hors simulation), affichée dans le bandeau existant. Jamais
  au milieu d'un round (le combat reste lisible et rapide).

### 6.4 Chargement & budget

- `data/story/**` est fetché **par chapitre** au lancement d'une campagne
  (même mécanisme hors-bundle que cartes/scénarios) ; les portraits passent
  par le registre d'assets existant (doc 12 §10, `assetsInlineLimit: 0`).
- Budget spécifique : un chapitre (quêtes + dialogues + 2 locales) doit
  rester **< 50 Ko gzip** ; contrôlé par `content:check`.

---

## 7. Roadmap de polishing & tests d'immersion

Chaque lot suit les guidelines (plan vivant, smoke dans le même lot) et
laisse le jeu livrable. Ordre pensé « MVP narratif → campagne complète » :

| Lot | Contenu | Sortie vérifiable |
|-----|---------|-------------------|
| **N1 — La voix du monde** ✅ | Champs `loreKey` sur unités/bâtiments/artefacts/sorts + textes FR/EN des 4 factions ; écrans existants les affichent | Audit i18n étendu ; chaque entité du contenu a son texte ; zéro diff moteur |
| **N2 — Systèmes** | `engine/quest` générique + `GameState.quests` (bump save) ; schémas `data/story/` ; boîte de dialogue + journal + `dialogBefore` ; ré-habillage du scénario `tutorial` en **Prologue Haven** (3 quêtes, 4 dialogues) | Golden re-fixé ; smoke Playwright « dérouler le prologue : dialogue s'affiche, se passe, journal à jour, quête récompensée » desktop + mobile |
| ↳ **N2a — moteur de quêtes** ✅ | `engine/quest` générique (catalogue de conditions fermé, `GameState.quests`, `QuestStarted/Advanced/Completed`, récompenses) ; bump save 6→7 ; câblage `apply()` ; tests unitaires | Golden re-fixé ; moteur seul, zéro UI |
| ↳ **N2b — contenu & UI** ✅ | schémas narratifs (`quest`/`dialog`/`character`) + **Prologue Haven** (scénario porteur) + boîte de dialogue + journal de quêtes + smoke narratif | Prologue jouable : dialogue s'affiche/se passe, journal à jour, quête récompensée (desktop+mobile) |
| **N3 — Campagnes fondatrices** | Campagnes Haven et Necropolis (3 chapitres chacune, cartes dédiées, cutscenes caméra, arcs Aldric/Séraphine/Vhalen/Mère Corbeau) ; `campaignState` + écran de sélection de campagne | 2 campagnes finissables en smoke long (IA assistée) ; continuité héros entre chapitres testée |
| ↳ **N3a — système de campagne** ✅ | pipeline `data/factions/<id>/story/campaign.json` + `loadCampaigns` ; report de héros (`PlayerSetup` étendu + `campaignState` localStorage) ; écran de sélection ; chaînage de chapitres ; campagne Haven à 2 chapitres | Smoke : gagner ch1 → ch2 débloqué + héros reporté (artefact conservé), desktop + mobile |
| ↳ **N3b — campagne Necropolis** ✅ | 2ᵉ campagne en **données pures** (`manifest.story` + `story/campaign.json` + 2 scénarios + Vhalen/Mère Corbeau) — test de modularité narratif, **zéro diff moteur/client** | Smoke : la campagne Necropolis apparaît au menu et son ch1 démarre (héros necropolis, dialogue, quête) |
| ↳ **N3c — finitions campagnes** ✅ | 3ᵉ chapitre Haven, carte dédiée, cutscenes caméra, arcs de héros nommés (quêtes `personal`) — livré en 3 increments | N3c.1/N3c.2/N3c.3 ✅ — **N3c complet** |
| ↳ **N3c.1 — cutscenes caméra** ✅ | schémas `cutscene`/`cutsceneStep` (`panTo`/`wait`/`dialog`) + scénario `cutscenes?`/`openingCutscene?` ; client `camera-control` (pan animé rAF/easing) + `cutscene` (séquenceur, réutilise la file de dialogues N2b) + `CutsceneOverlay` (letterbox + **Passer** ≥ 44 px) ; cinématique d'ouverture sur `haven-ch2` — **pure présentation, zéro diff moteur** | Smoke : `haven-ch2` → letterbox + Passer visibles → Passer → partie jouable (desktop + mobile) |
| ↳ **N3c.2 — choix, drapeaux & arcs** ✅ | `choices` de dialogue câblés (`setFlag`/`next`) dans `DialogueBox` (boutons empilés ≥ 44 px) ; drapeaux `campaignFlags` (localStorage `heroes.flags`, **relus entre campagnes**) ; quêtes `kind: personal` (badge journal) ; **arc personnel d'Aldric** (`haven-ch2`, 3 étapes) au choix binaire final posant un drapeau — **zéro diff moteur** (`kind`/drapeau = client) | Smoke : dérouler l'arc → nœud de choix (2 boutons, pas de « Passer ») → clic → drapeau posé & persistant (desktop + mobile) |
| ↳ **N3c.3 — 3ᵉ chapitre + carte dédiée** ✅ | campagne Haven portée à **3 chapitres** (`haven-ch3` « Les Marches de Cendre ») sur une **carte dédiée** `proto-02` (24×24, terrain/route/objets propres, validée par `mapFileSchema`) au lieu de tout rejouer sur proto-01 — **données pures, zéro diff moteur** | Smoke : le 3ᵉ chapitre apparaît au menu et démarre sur `proto-02` (24×24), héros Haven (desktop + mobile) |
| **N4 — La Chasse & le vivant** ✅ | Campagne Arcane Hunters (relit N3, arcs Evadne/Marchmont) ; quêtes journalières en mode libre ; 2 événements temporaires ; barks de combat | 3ᵉ campagne = données seules (test de modularité narratif) ; événement daté jouable/expirable — **N4 complet** |
| ↳ **N4a — campagne Arcane Hunters** ✅ | 3ᵉ campagne en **données pures** (`manifest.story` + `story/campaign.json` + 2 scénarios `arcane-ch1`/`arcane-ch2` + Evadne Corvel / Professeur Marchmont) — **3ᵉ test de modularité narratif, zéro diff moteur/client** ; ch2 rejoue la rencontre **Evadne↔Aldric** (doc 13 §9.3) avec choix binaire posant `aldric-pacte` (réutilise choix/drapeaux N3c.2) | Smoke : la campagne Arcane apparaît au menu et son ch1 démarre (héros arcane-hunters, dialogue, quête) |
| ↳ **N4b — barks de combat** ✅ | scénario `combatBarks?: locRef[]` (pool de l'antagoniste) ; client `initCombatBarks` tire UNE réplique au hasard **côté client** (`Math.random`, hors moteur) à l'apparition d'un combat, l'affiche dans le bandeau (`combat-bark`), la retire à la fin ; pools sur `arcane-ch1`/`haven-ch2` — **zéro diff moteur** | Smoke : démarrer `arcane-ch1` → déclencher un combat → bark non vide → fin du combat → bark retiré |
| ↳ **N4c — quêtes journalières** ✅ | `daily-templates.json` (gabarits `recruitTier`/`buildStructure`/`surviveDays`) chargés par `loadContent` ; `app/daily.ts` instancie N contrats **déterministes** via le RNG PCG32 seedé (`@heroes/engine`), embarqués dans le `StartGame` d'escarmouche (mode libre) ; journal `kind: daily` (badge). **Rafraîchissement par jour livré (N-DAILYREFRESH)** : commande moteur **générique** `AddQuests` (ajoute des quêtes en cours de partie, idempotente) ; à chaque fin de tour humain (`app/daily-refresh.ts`), le mode libre génère les contrats du **nouveau jour** (ids `daily-d<jour>-*`, seed `seed + jour` déterministe) et les ajoute au journal. Hors mode libre : désarmé (no-op). Pas de bump save, golden inchangé | Smoke : escarmouche → contrats `daily-*` déterministes (même seed ⇒ mêmes ids) + badge journal ; fin de tour ⇒ contrats `daily-d2-*` ajoutés |
| ↳ **N4d — événements temporaires** ✅ | scénario `availability?: { from, to }` (dates ISO) ; `app/timed-events.ts` `eventStatus` évalué via l'horloge **CLIENT** (jamais le moteur) ; `MenuScreen` section « Événements » — actif (badge « Événement »), expiré (badge « Archive », toujours jouable), à venir masqué ; 2 événements (`event-revenants` actif, `event-curee` archive) — **zéro diff moteur** | Smoke : au menu, badge « Événement » (actif) + « Archive » (passé), archive jouable |

**Tests d'immersion** (à chaque lot, protocole léger) :

- **Test du journal seul** : un playtesteur qui saute tous les dialogues
  doit pouvoir finir le chapitre en ne lisant que le journal. S'il se perd,
  le fil principal est mal balisé (c'est un bug, pas un choix du joueur).
- **Métriques locales opt-in** (télémétrie Alpha, doc 09) : taux de skip par
  nœud de dialogue (> 60 % = nœud trop long ou mal placé), temps de lecture,
  quêtes secondaires entamées/finies.
- **Test de fraîcheur** : relire chaque texte sur mobile au petit cran de
  police ; toute réplique > 3 lignes est réécrite.
- **Garde CI** : parité FR/EN sur `data/story/**` ; replays golden insensibles
  à la couche narrative ; budget chapitre < 50 Ko gzip.

---

## 8. Intégration narrative d'une faction custom : « une nouvelle maison = son lore »

La promesse de modularité s'étend au narratif : **ajouter une maison = ajouter
son lore, sa campagne et ses voix, sans toucher au moteur ni aux campagnes
existantes**. Même critère CI que le gameplay (doc 06 §5.8) : aucun diff hors
de `data/factions/<id>/` (+ registre `index.json`).

### 8.1 Les cinq blocs narratifs obligatoires d'un paquet

Remplis dans le gabarit `docs/templates/faction-template.md` §8 (section
ajoutée dans ce lot) **avant** `faction:new`, livrés dans le paquet :

| Bloc | Contenu | Où il vit |
|------|---------|-----------|
| **1. Identité narrative** | Voix de la faction (comment elle parle : registre, tics de langage), ce qu'elle croit, ce qu'elle se cache | Gabarit §8 + locales du paquet |
| **2. Lecture de l'arc global** | Sa réponse à « que voit-elle dans le sceau de Cendregarde ? » (ou l'arc courant) — c'est le crochet qui raccorde toute maison à la même guerre sans réécrire les autres | Gabarit §8 ; nourrit `campaign.json` |
| **3. Relations aux maisons existantes** | 1 phrase par maison en jeu (alliée méfiante, proie, cliente…) — matière des dialogues croisés | Gabarit §8 |
| **4. Deux héros nommés avec arc** | Arc personnel en 3 étapes chacun (§5.4), qui *incarne* le thème de la faction | `heroes/named.json` + `story/` |
| **5. Textes d'ambiance** | `loreKey` pour chaque unité/bâtiment/artefact du paquet, écrits du point de vue de la faction (§3.5) | `locales/{fr,en}.json` du paquet |

Plus la **campagne** (3 chapitres au format §6.1, dans
`data/factions/<id>/story/`) quand la maison passe au rang « campagne » —
une faction peut sortir jouable en mode libre avec les blocs 1–5 seulement,
sa campagne arrivant dans un second lot (patron Heroes Online : les factions
post-lancement ont reçu leur histoire avec elles).

### 8.2 Garde-fous (mêmes règles que le gameplay)

- **Zéro diff moteur attendu** : les conditions de quête sont un catalogue
  générique ; si une campagne custom a besoin d'un type de condition
  manquant, il s'ajoute au catalogue **comme point d'extension générique**
  (gouvernance doc 06 §6 — le cas *Tide Covenant* vaut pour le narratif).
- **Zéro réécriture des autres maisons** : une campagne custom peut faire
  apparaître les personnages publics (`data/story/characters.json`) et lire
  les drapeaux `campaignState` des campagnes finies (ex. : évoquer le choix
  d'Aldric), mais jamais modifier les quêtes/dialogues d'un autre paquet.
- **Validation** : `faction:validate` s'étend au narratif — parité FR/EN des
  locales `story`, `loreKey` présents pour chaque entité, conditions de quête
  toutes issues du catalogue, personnages référencés existants, budget
  chapitre < 50 Ko gzip.
- Les quêtes journalières de la faction ne sont **pas** un système à part :
  ce sont des gabarits `daily-templates` habillés par le paquet (cf. le
  Tableau des Contrats, §9.2).

### 8.3 Exemple filé : lore & storytelling d'une faction custom (Sylvan Court)

Démonstration sur un pré-concept de la doc 06 §6 (pressenti pour le vote de
la 4ᵉ faction en Beta) — la **Cour Sylvaine** (nature/elfes, mécanique
Symbiose). Ce qu'un contributeur livrerait dans son gabarit §8 :

- **Identité narrative** : la Cour parle au pluriel et au présent éternel
  (« nous nous souvenons », jamais « je pense ») ; elle croit que le monde
  est un seul organisme dont chaque guerre est une fièvre ; elle se cache
  qu'elle a déjà *amputé* des forêts entières pour survivre — et qu'elle
  recommencera.
- **Lecture du sceau** : le verrou de Cendregarde n'est ni une porte ni une
  serrure — c'est une **cicatrice mal suturée** sur la chair du monde. Le
  Havre la vénère, Heresh l'écoute, l'Académie la surveille ; la Cour veut la
  **faire cicatriser** en y greffant une forêt-suture… ce qui condamnerait la
  province humaine qui pousse dessus. « Nous ne haïssons pas Cendregarde.
  On ne hait pas ce qu'on taille. »
- **Relations** : Haven = un verger qui se prend pour un jardinier ;
  Necropolis = la pourriture *a aussi* sa saison (respect glacial) ;
  Arcane Hunters = des greffons instables — la Cour reconnaît dans le
  Pénitent T8 sa propre logique de greffe, et ça ne lui plaît pas.
- **Héros nommés** : *Dame Ronce-Mère* (Might, une aïeule-arbre — arc : sa
  Symbiose la lie à un esprit né *sous* le sceau, est-il encore sylvain ?) ;
  *Lióren du Dernier Verger* (Magic, diplomate — arc : négocier la
  cicatrisation avec les humains qu'elle déracinerait ; son étape 3 relit le
  drapeau `aldric-pacte` si présent).
- **Campagne (esquisse 3 chapitres)** : I. *La Fièvre* — la forêt-monde sent
  la plaie et envoie la Cour (tutoriel Symbiose : quêtes « ne bouge pas ta
  pile N rounds ») ; II. *La Taille* — conflit avec les trois lectures en
  place (mêmes lieux que les campagnes fondatrices, autre regard) ;
  III. *La Suture* — choix final : greffer la forêt (sacrifier la province)
  ou greffer *un seul* des siens (l'arc de Ronce-Mère devient le prix).
- **Flavor (extraits)** : Squelette vu par la Cour — « Du bois mort qui
  marche. Même la mort fait des boutures. » ; son propre T1 — « Il a juré
  fidélité à une graine. La graine s'en souviendra. »

L'exemple montre le critère de réussite : **rien ici ne demande un diff
moteur ni une ligne dans les campagnes existantes** — uniquement le gabarit,
le paquet, et au plus un nouveau type de condition générique (« pile immobile
N rounds », qui servirait à toute faction défensive).

---

## 9. Exemples concrets

### 9.1 Texte d'introduction de campagne (Prologue Haven — cutscene d'ouverture)

> *(Caméra : brume sur les Marches, pan lent vers les ruines fumantes d'un
> bourg fortifié. Letterbox. Musique : cordes seules.)*
>
> **Narrateur** — On dit qu'à Cendregarde, même les cloches prient. Depuis
> la Première Éclipse, l'Empire du Griffon garde cette frontière — et la
> frontière, disent les anciens, garde autre chose.
>
> *(La caméra s'arrête sur une chapelle effondrée. Un chevalier met pied à terre.)*
>
> **Aldric** — Les morts du cimetière béni ont quitté leurs tombes, Sœur.
> Des tombes *bénies*. Expliquez-moi ça sans blasphémer.
>
> **Séraphine** — Je ne peux pas. C'est bien ce qui m'inquiète.
>
> **Narrateur** — Relevez la garnison. Rallumez les cierges. Et creusez —
> pas trop profond.
>
> *(Objectif affiché : **Relever Cendregarde** — reconstruire le Fort.)*

### 9.2 Quêtes types

**Principale (chapitre 1 Haven)** — *Relever Cendregarde* : (1) construire
le Fort (dialogue Séraphine avant : les ruines « chantent faux ») ;
(2) reprendre la mine d'or au gardien squelette ; (3) recruter 20 Conscrits.
Récompense : 1000 or + artefact *Sceau terni* (indice d'arc : il vibre près
des sites du verrou). — Enseigne ville/recrutement sans un mot de tutoriel.

**Secondaire (chapitre 2 Necropolis)** — *La moisson refusée* : trouver la
tuile du charnier de bataille (`visitTile`) puis gagner un combat en relevant
au moins 15 squelettes (`raiseUndeadOnVictory` ≥ 15, événement existant).
Récompense : +2 croissance de Squelettes cette semaine. — Fait *jouer* la
doctrine d'Heresh au lieu de la raconter.

**Journalière (mode libre, gabarit)** — *Contrat : {gardien} de {lieu}* :
vaincre un gardien neutre tiré au RNG seedé parmi les gardiens vivants de la
carte. Récompense : or (+ Essence si faction Arcane Hunters — le Tableau des
Contrats du doc 05 §3.3 devient un cas de ce gabarit). — Une seule mécanique
de journalières pour tout le jeu, la faction ne change que l'habillage.

### 9.3 Dialogue entre héros (campagne Arcane Hunters, chapitre 2 — Evadne rencontre Aldric)

> **Aldric** — Encore vous. L'Église tolère vos chasses, Dame Corvel, pas
> vos fouilles sous nos cimetières.
>
> **Evadne** — Vos cimetières sont posés sur notre serrure, chevalier. J'ai
> la clé gravée sur la moitié du visage. Vous, vous avez des cierges.
>
> **Aldric** — Les cierges tiennent la nuit dehors depuis mille ans.
>
> **Evadne** — Non. *Nous* la tenons. Les cierges, c'est pour que vous
> dormiez. — *(un temps)* — Gardez vos murs, priez fort. Et si une de mes
> Marques s'allume sur un de vos morts… ne le pleurez pas deux fois.
>
> *(Choix : « Laisser passer les Chasseurs » → drapeau `aldric-pacte` ; ou
> « Leur interdire la crypte » → combat optionnel, l'arc continue dans les
> deux cas.)*

---

## 10. Résumé exécutif

- La narration est un **paquet de contenu comme un autre** : JSON validé,
  clés de locale, interprétée par UN système moteur générique (`engine/quest`)
  et une couche de présentation Pixi (dialogues, cutscenes caméra, journal).
- L'histoire : **une même guerre de frontière lue par trois doctrines**, où
  les Arcane Hunters s'intègrent comme l'ordre fondé sur sa propre faute —
  extensible à chaque future maison par le gabarit de faction.
- Le polish se livre en **4 lots testables** (voix du monde → systèmes →
  campagnes fondatrices → chasse & vivant), chacun gardé par la CI
  (i18n, golden, budget, smoke narratif) et un protocole d'immersion simple.

---

## État N1 — La voix du monde (livré)

**Textes d'ambiance sur tout le contenu existant, zéro diff moteur.**

- **Schéma** : champ optionnel `loreKey` (`@loc:`) ajouté à `unitSchema` /
  `buildingSchema` / `spellSchema` / `artifactSchema` (rétro-compatible ;
  exclu des formes résolues moteur `Resolved*` — le lore est pur affichage).
- **Contenu** : **97 textes** FR + EN écrits **du point de vue de chaque
  faction** (ton §1.1, ≤ 200 car.) — 58 unités des 4 maisons (chacune reçoit
  aussi son champ `loreKey`), 6 bâtiments communs, 23 sorts, 4 artefacts, 6
  bâtiments spéciaux (Cercles Arcanes + Bosquet du Cœur). Les textes vivent
  dans les locales (core ou paquet) selon la règle de modularité (doc 06).
  Le stub `test-faction` reste sans lore (2 unités non couvertes, attendu).
- **Client** : le lore s'affiche dans les 4 surfaces existantes — fiche d'unité
  (onglet Recruter), vignette de bâtiment (onglet Construire), infobulle
  d'artefact (inventaire), description de sort (livre de sorts) — via un
  composant discret `.content-lore` (italique, `rem` → respecte les 3 crans de
  police). Résolveurs `resolve*Lore` par convention `<prefix>.<id>.lore`.
- **Validation** : `content:check` étendu — parité fr/en obligatoire sur toute
  clé `*.lore` + résolution du `loreKey` des unités, avec rapport de couverture
  (« 58/60 unités, 97 textes »).
- **Vérif** : typecheck 4/4, moteur 289 (golden inchangé — le lore n'entre pas
  dans `GameState`), content 73, `content:check` vert, garde-fou faction vert,
  build < 800 Ko gzip, smoke desktop+mobile (lore de bâtiment affiché).

## État N2a — Moteur de quêtes générique (livré)

Cœur moteur du lot N2, livré isolément (le contenu + l'UI = N2b).

- **`engine/quest`** : catalogue de conditions **fermé et générique**
  (`buildStructure`, `ownUnits`, `defeatGuardian`, `visitTile` + réutilisation
  des `VictoryCondition` `captureTown`/`defeatHero`/`surviveDays`/
  `eliminateAllEnemies` via `conditionMet` — une seule notion d'objectif) ;
  récompenses `resources`/`artifact`/`units`. Le moteur **ignore texte,
  dialogue, faction, quête nommée** — garde-fou faction vert.
- **`GameState.quests`** embarqué par `StartGame`, `null` hors campagne.
  Événements `QuestStarted`/`QuestAdvanced`/`QuestCompleted`. Évaluation en
  **un seul point** (fin d'`apply()`) : toute commande fait avancer les quêtes.
- **Bump save 6→7** (garde de version 3.8 → rejet propre des v6). **Golden
  re-fixé** (`aba92b9f`→`05da0520`, nouveau champ sérialisé `quests: null`,
  simulation inchangée). 5 tests unitaires (avancée/complétion/récompenses/
  multi-étapes/no-op).
- **Convergence `scenario`↔`quest`** : partielle (évaluateur partagé) ; le merge
  total est différé pour ne pas déstabiliser le golden/les tests scénario.

## État N2b — Prologue Haven jouable (livré)

Moitié contenu + UI de N2, sur le moteur de quêtes N2a. **Zéro nouveau diff
moteur** (le catalogue de conditions N2a couvrait le prologue).

- **Schémas narratifs** (`@heroes/content`) : `questSchema` (kind/steps
  {condition, dialogBefore?}/rewards/titleKey/descriptionKey), `dialogNodeSchema`
  (lines{speaker, portrait?, textKey}, choices?), `characterSchema` (nameKey,
  portraits). Le scénario les embarque (`quests`/`dialogs`/`characters`/
  `openingDialog`) — la forme **dossier `data/story/`** (multi-chapitres, §6.1)
  est différée à **N3** où la continuité inter-chapitres la justifie.
- **Prologue Haven** : nouveau scénario `prologue` (proto-01) — dialogue
  d'ouverture (§9.1), 2 quêtes primaires (« Relever Cendregarde » = bâtir le
  Fort, récompense or ; « La garde de la marche » = 20 Conscrits, récompense
  artefact) avec `dialogBefore`, personnages Aldric/Séraphine, locales FR/EN.
  `tutorial` intact (zéro régression).
- **Client** : `app/narrative.ts` (contrôleur abonné aux `QuestStarted`/
  `QuestAdvanced`/`QuestCompleted` → journal + file de dialogues) ;
  `DialogueBox` (bandeau bas, tap = avancer, **Passer** ≥ 44 px, `rem`) ;
  `QuestJournal` (tiroir héros) ; `scenarioStartCommand` embarque les quêtes en
  `QuestState`.
- **Vérif** : typecheck 4/4, moteur inchangé (golden intact), content + smoke
  « dérouler le prologue » (dialogue affiché → passé → journal à jour → Fort bâti
  → récompense créditée) desktop + mobile.

## État N3a — Système de campagne (livré)

Cœur de N3 : chaîner des scénarios en **campagne chapitrée** avec **continuité
du héros**. Prouvé sur une **campagne Haven à 2 chapitres**.

- **Contenu** : `campaignSchema` + `manifest.story` (la campagne vit dans le
  paquet de faction, `data/factions/haven/story/campaign.json` — modularité
  §8) ; `loadCampaigns` (règles croisées : `factionId` connu, chaque chapitre
  référence un scénario chargé). `content:check` étendu.
- **Report de héros** (doc 13 §4.1) : `PlayerSetup` gagne
  `startingLevel/Xp/Skills/Artifacts` (optionnels → héros neuf par défaut,
  **golden inchangé**) ; `scenarioStartCommand(…, heroCarry?)` dote le joueur
  humain ; `app/campaign.ts` persiste la progression + le snapshot de héros en
  **localStorage** (méta-jeu, hors `GameState`, aucun bump de save).
- **Client** : écran de **sélection de campagne** (chapitres verrouillés
  au-delà du dernier gagné) ; démarrage de chapitre + avancement à la victoire
  (`GameEnded(won)` → snapshot + déblocage).
- **Données** : campagne Haven — chapitre 1 = le Prologue (réutilisé, victoire
  passée à `surviveDays: 2`), chapitre 2 = `haven-ch2` (dialogue + quête).
- **Vérif** : typecheck 4/4, moteur 296 (golden intact + report de héros),
  content 74 (+ campagne), `content:check`, smoke « gagner ch1 → ch2 débloqué +
  héros reporté » desktop + mobile.

## État N3b — Campagne Necropolis (livré)

**Test de modularité narratif réussi** : sur le moteur de campagne N3a
(générique), la campagne Necropolis est livrée en **données pures** — `manifest.
story` + `data/factions/necropolis/story/campaign.json` + 2 scénarios de chapitre
(proto-01, dialogues + quêtes, personnages Vhalen / Mère Corbeau au ton
« doctrine sincère » doc 13 §3.3) + locales FR/EN. **Zéro diff moteur/client** :
ajouter la campagne d'une maison n'a touché que son paquet (doc 13 §8), comme
promis. `content:check` résout 2 campagnes ; smoke : la campagne Necropolis
apparaît au menu et son chapitre 1 démarre.

Lot **N3c** (finitions campagnes) livré « in full » en 3 increments. **N3c.1
✅** : cutscenes caméra — schémas `cutscene`/`cutsceneStep` (`panTo`/`wait`/
`dialog`) et champs de scénario `cutscenes?`/`openingCutscene?` ; côté client
`app/camera-control.ts` (déplacement caméra animé, rAF/easing — présentation
pure), `app/cutscene.ts` (séquenceur réutilisant la file de dialogues N2b,
skippable) et `ui/CutsceneOverlay.tsx` (letterbox + bouton **Passer** ≥ 44 px) ;
cinématique d'ouverture sur `haven-ch2` — **zéro diff moteur**. **N3c.2 ✅** :
choix de dialogue câblés (`setFlag`/`next`) dans `DialogueBox` (boutons empilés
≥ 44 px, une décision requise au nœud de choix) ; drapeaux `campaignFlags`
(localStorage `heroes.flags`, **relus entre campagnes** — méta-jeu global) posés
par `chooseDialogueOption` ; quêtes `kind: personal` surfacées par un badge dans
le journal ; **arc personnel d'Aldric** (`haven-ch2`, 3 étapes) culminant sur un
choix binaire (clément / implacable) qui pose l'un de deux drapeaux — **zéro diff
moteur** (`kind` et drapeau sont côté client). Reste **N3c.3** (3ᵉ chapitre Haven
+ carte dédiée).

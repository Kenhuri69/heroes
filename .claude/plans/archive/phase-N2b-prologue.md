# Plan — Lot N2b : contenu & UI du prologue (doc 13 §4/§6)

Moitié contenu + client du lot N2. S'appuie sur le moteur de quêtes **N2a**
(déjà livré). Livre le **Prologue Haven** jouable : dialogue affiché, passable,
journal à jour, quête récompensée. **Aucun nouveau diff moteur attendu** (le
catalogue de conditions N2a suffit).

## Décision de portée

- Prologue livré comme **nouveau scénario `prologue`** (data/scenarios/), pas en
  modifiant `tutorial` (zéro régression des smokes existants). Le prologue
  **embarque** ses quêtes / dialogues / personnages dans le fichier de scénario.
- **Dossier `data/story/` autonome (doc 13 §6.1) différé à N3** : il sert la
  **continuité multi-chapitres** (campagnes fondatrices) ; un prologue à un seul
  chapitre est plus simple embarqué dans le scénario. Schémas `quest`/`dialog`/
  `character` créés (formes doc 13) et référencés par le scénario.

## Étapes

1. **Schémas** (`@heroes/content`) : `questSchema` (kind/steps{condition,
   dialogBefore?}/rewards/titleKey/descriptionKey), `dialogNodeSchema`
   (lines{speaker,portrait?,textKey}, choices?), `characterSchema`
   (nameKey, portraits). Extension `scenarioSchema` : `quests?`, `dialogs?`,
   `characters?`, `openingDialog?`.
   → vérif : content typecheck, `content:check`.
2. **Données** : `data/scenarios/prologue.scenario.json` (Haven, carte proto-01,
   armée de départ, ~2 quêtes primaires avec conditions du catalogue N2a +
   `dialogBefore`, récompenses ; dialogue d'ouverture ; personnages Aldric/
   Séraphine ; objectifs). Locales `data/core/locales` (dialogues/quêtes). Ajout
   à l'index.
   → vérif : `content:check`, parité fr/en.
3. **Loader/embed** : `scenarioStartCommand` (client) résout `scenario.quests` →
   `QuestState` moteur (dépouillé des champs client) et embarque via `StartGame`.
   Le contenu dialog/character/opening va au store narratif client.
   → vérif : typecheck client.
4. **Client** :
   - `app/narrative.ts` : store narratif — dialogues/personnages chargés + nœud
     de dialogue courant + journal (quêtes actives, étape, statut) ; abonné à
     `eventBus` (QuestStarted→journal, QuestAdvanced→dialogBefore+journal,
     QuestCompleted→toast+statut) + dialogue d'ouverture au démarrage.
   - `ui/DialogueBox.tsx` : nœud courant (portrait/nom/texte), tap = avancer,
     **Passer** ≥ 44 px, choix empilés. `rem` (3 crans), motifs non chromatiques.
   - `ui/Journal.tsx` : liste quêtes actives (titre + étape courante), badge.
   - Câblage `shell`.
   → vérif : typecheck client, build.
5. **Smoke** : « dérouler le prologue » — dialogue d'ouverture visible → Passer →
   journal montre la quête → bâtir le Fort → récompense créditée + journal MAJ.
   Desktop + mobile.
6. **Docs** : doc 13 (État N2b), roadmap 09.

## Vérification par lot

- [ ] typecheck 4/4
- [ ] tests moteur (golden inchangé — pas de diff moteur)
- [ ] tests content (+ scénario prologue)
- [ ] `content:check` (parité fr/en des dialogues/quêtes)
- [ ] garde-fou faction (grep CI local)
- [ ] build client (< 800 Ko gzip)
- [ ] smoke desktop + mobile (prologue déroulé)

## Décisions / écarts

- **Prologue = nouveau scénario `prologue`** portant quêtes/dialogues/personnages
  embarqués ; `tutorial` intact (zéro régression). Dossier `data/story/` autonome
  différé à N3.
- **Dialogues** : file d'attente (ouverture puis `dialogBefore` d'étape) ; tap =
  ligne suivante / nœud suivant, **Passer** = saut du nœud. Store dans `appStore`
  (`narrative`/`dialogue`/`dialogueQueue`/`questJournal`), contrôleur
  `app/narrative.ts` abonné au bus d'événements.
- **Ressources de départ** portées à 6000 or / 25 minerai pour que le Fort
  (5000 or + 20 minerai) soit constructible dès le prologue (tutoriel).
- **Zéro diff moteur** : le catalogue de conditions N2a couvrait le prologue.

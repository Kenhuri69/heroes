# Remédiation de la revue de code complète (2026-08)

> **Demande utilisateur (2026-08-25)** : revue complète du dépôt puis « ok ça me
> va lance le travail » ⇒ correction des **7** constats, dans l'ordre proposé.
> Chaque constat a été **vérifié dans le code** avant d'être retenu (sites
> d'appel recoupés ; distribution du n°7 simulée numériquement).

## Invariants (non négociables, README §1-6)

Zéro faction dans `packages/` · RNG seedé uniquement · moteur sans dépendance
rendu · touch-first · golden replay maîtrisé (tout changement de hash doit être
**justifié**, jamais subi) · pas de bump `CURRENT_SAVE_VERSION` sans nouveau
champ · docs `docs/0X-*.md` alignées dans le même lot.

## Lot 1 — `houseCatalog` absent du chemin « Nouvelle partie » (P0)

**Constat** : `newGameStartCommand` (`packages/client/src/app/game.ts:1244`) est le
seul des 3 builders `StartGame` à omettre `houseCatalog` (scénario l.661 et
escarmouche l.883 le passent). Donc `GameState.houseCatalog = {}` : « Le
Choixpeau » stampe `hero.houseId` mais résout `houseEffects` à `[]`
(`town/build.ts:147`) ⇒ **la signature Vox Arcana est morte**, et
**irréversiblement** (la garde `houseAlreadyChosen`, `build.ts:79`, refuse ensuite
tout autre choix).

- [ ] `game.ts` : passer `houseCatalog: buildHouseSetup(report)` → verify: test
      client qui compare les **clés** des 3 builders (garde-fou générique : tout
      futur champ oublié par un builder est détecté, pas seulement celui-ci).

## Lot 2 — l'allié coop perd son armée sans combattre (P0)

**Constat** : `combineCoopArmy` (`combat/setup.ts:332`) tronque à
`COOP_ARMY_CAP = 7` **lead prioritaire**, puis `engageCoopAlly` (l.352) vide
`ally.army` **inconditionnellement**. Lead à 7 piles ⇒ aucune pile de l'allié au
combat ⇒ `coopAttackerOwners` (`turns.ts:457`) ne le voit pas ⇒ armée jamais
reconstruite. Perte sèche.

- [ ] `setup.ts` : n'engager (vider) que les piles **réellement embarquées** ;
      celles écartées par le cap restent sur la carte → verify: unitaire « lead à
      7 piles + allié ⇒ l'armée de l'allié est intacte », et « cap partagé ⇒
      seules les piles retenues quittent l'allié ».

## Lot 3 — les héros IA n'ont jamais de compétence secondaire (P1)

**Constat** : `experience.ts:128` empile `pendingSkillChoices` pour **tous** les
héros, mais aucun chemin IA ne résout `ChooseSkill` (`packages/engine/src/ai/` :
zéro occurrence) — alors que la branche **attributs** juste au-dessus traite
explicitement l'IA. L'IA finit la partie sans Logistique/Sagesse/Armure ni
Nécromancie graduée.

**Décision (assumée, la plus conservatrice)** : l'IA **applique automatiquement**
la 1ʳᵉ proposition déjà tirée, par symétrie avec les attributs — *aucune nouvelle
heuristique* et surtout **aucun tirage RNG supplémentaire** (`rollSkillChoices`
consomme déjà le RNG pour l'IA aujourd'hui) ⇒ le flux RNG est inchangé.

- [ ] `experience.ts` : brancher l'application auto côté IA (helper partagé avec
      `handleChooseSkill` pour ne pas dupliquer la règle de rang) → verify:
      unitaire « héros IA monte de niveau ⇒ `skills` non vide,
      `pendingSkillChoices` vide » + golden **inchangé** (aucun tirage en plus).

## Lot 4 — la règle des slots exclusifs n'existe qu'à l'équipement manuel (P1)

**Constat** : `artifactSlotConflict` n'est consulté que par `EquipArtifact`
(`hero/equip.ts:86`). **8 sites** posent un artefact dans le 1er slot libre sans
contrôle : `adventure/movement.ts:304`, `visitable.ts:91`, `triggers.ts:39`,
`guardian-reward.ts:131`, `combat/turns.ts:399`, `hero/transfer.ts:66`,
`quest/evaluate.ts:67`, `town/artifact-merchant.ts:178`. Comme
`heroArtifactBonus` somme **tous** les slots, N artefacts d'un même slot exclusif
se cumulent.

- [ ] `hero/equip.ts` : helper pur `grantArtifact(hero, catalog, id)` — slot libre
      **sans conflit** sinon le SAC (jamais de perte) ; les 8 sites l'appellent →
      verify: unitaire par famille de site (ramassage carte, butin de gardien,
      dépouille, quête, marchand, transfert) + golden (les artefacts du replay
      sont-ils concernés ? à mesurer, re-fixer une seule fois si justifié).

## Lot 5 — le bouclier `barrier` n'absorbe pas les dégâts de zone (P2)

**Constat** : `applySplashDamage` (`combat/damage.ts:440`) n'appelle pas
`absorbShield`, alors que la frappe directe (l.623) et le sort d'unité
(`spell-effect.ts:129`) le font. Le poison (`turns.ts:42`) l'ignore aussi — **hors
périmètre** : un bouclier qui absorbe un poison persistant est un choix de design,
pas une incohérence de code (à trancher dans le doc 16 si un jour la question se
pose).

- [ ] `damage.ts` : absorption au même titre que la frappe → verify: unitaire
      « splash sur une pile protégée ⇒ dégâts réduits du bouclier » + golden
      (aucun `barrier` dans le replay ⇒ attendu inchangé).

## Lot 6 — `/join` PvP : deux gardes manquantes (P2)

**Constat** (`server/src/worker.ts:400-411`) : (a) aucun contrôle « ce profil a
déjà un siège » ⇒ un compte peut prendre **tous** les sièges et jouer tous les
camps ; (b) `UPDATE matches SET status='active' WHERE id = ?` sans filtre de
statut — contrairement à `/forfeit` juste en dessous, borné à `('open','active')`
⇒ rejoindre **ressuscite** une partie `abandoned`/`finished`.

- [ ] `worker.ts` : refus 409 si le profil occupe déjà un siège ; `UPDATE … AND
      status = 'open'` → verify: `typecheck` (le Worker n'a pas de harnais de
      test ; à dire explicitement dans la PR) + relecture du SQL contre le schéma.

## Lot 7 — RNG re-tiré dans la condition de boucle (P3, hygiène)

**Constat** : `mapgen.ts:452, 458, 475, 541, 561` — `for (let i = 0; i <
scaledCat(randBetween(a,b), d); i++)` réévalue le tirage **à chaque itération**
(l'idiome correct est juste à côté, l.514/526 : compte calculé une fois).
**Sévérité mesurée** (simulation 400 k tirages) : moyenne réelle **4,890** vs
5,0 attendu pour le pire cas, **identique** pour les plages à 2 valeurs ⇒
fragilité latente + RNG consommé pour rien, pas un défaut de génération visible.

- [ ] `mapgen.ts` : sortir les 5 comptes en `const` → verify: test contenu de
      génération déterministe (déjà là) + **la carte change à graine égale**
      (moins de tirages consommés) : c'est attendu et sans impact sauvegarde
      (options jetées après génération), à consigner.

## Vérification globale (à rejouer en entier avant push)

- [ ] typecheck / lint verts
- [ ] tests moteur / contenu / client verts (+ nouveaux unitaires)
- [ ] `content:check` vert
- [ ] garde-fous faction & couleurs verts
- [ ] build + budget bundle ≤ 800 Ko gzip ; budget images
- [ ] smoke `@core` desktop + mobile
- [ ] golden : inchangé, ou re-fixé **une fois** avec la justification écrite

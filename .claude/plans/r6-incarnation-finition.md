# Lot R6 — Détails d'incarnation et de finition (B4, U6 + bonus a11y)

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R6 » (constats B4 §1 et U6 §3), amendé par le critique de complétude
> de la vague A.
>
> **Périmètre** : client + docs uniquement. Zéro diff `packages/engine`, pas de
> bump `CURRENT_SAVE_VERSION`, golden inchangé.
>
> **Base de branche** : `origin/main` (`f9c960cd`). Le lot R1
> (`claude/r1-plateau-combat-visible`) y est **déjà mergé** (PR #517) — la branche
> R6 part donc de `main` pour ne rien défaire de R1 (marges de caméra mesurées,
> bandeau d'aide dans le bloc bas, barre compactée).

## 0. État de référence mesuré (AVANT)

Build de la branche au départ (= contenu de `origin/main`), `vite preview` sur un
port dédié (4173 était squatté par un aperçu **orphelin** d'un autre worktree —
piège de port avéré ; hash du JS servi vérifié = `index-CEi3-Wrz.js`, celui de mon
`dist/`). Arène `?seed=42#arena`, viewport **1280×800**.

| Mesure (`.combat-order`) | cran 1 | cran 3 |
|---|---|---|
| `scrollWidth` | 1205 px | 1415 px |
| `clientWidth` | 1154 px | 1137 px |
| **débordement** (`scrollWidth − clientWidth`) | **51 px** | **278 px** |
| `right` de la **dernière** vignette | **1319,0 px** | **1546,4 px** |
| `right` du conteneur | 1268,0 px | 1268,0 px |
| **dépassement de la dernière vignette** | **+51,0 px** | **+278,4 px** |
| hauteur `.combat-armies` | 60 px | 60 px |

⇒ le constat U6 est confirmé et **chiffré** : la dernière vignette est hors du
conteneur (donc tranchée au bord de l'écran), aux deux crans.

Bandeau de héros : `.combat-hero-name` **absent en arène** (aucun héros lié) ⇒ la
vérification B4 se fait sur la **partie rapide** (`?seed=42`), dont le héros de
départ porte le nom `hero.name.default` (« Aldric l'Érudit » en FR), et non
`hero.genericName` (« Le héros »).

## 1. B4 — le héros a un nom en combat et dans les toasts

**Cibles** (inchangées sur `origin/main`) :
- `packages/client/src/ui/combat.tsx:367` — `<span class="combat-hero-name">{t('hero.genericName')}</span>` ;
- `packages/client/src/app/notifications.ts:227` — `t('toast.spellCast', { hero: t('hero.genericName'), … })`.

**Décision** : extraire le patron déjà présent (`combat.tsx:455`
`resolveHeroName(h.name) || t('hero.genericName')`) en **UN** helper pur
`heroDisplayName(name)` dans `app/i18n.ts`, et le consommer aux trois endroits
(bandeau, sélecteur de héros agissant, toast de sort). Le toast résout le héros
**depuis l'état** (`game.heroes.find(h => h.id === event.heroId)`) — l'événement
`SpellCast` ne porte que `heroId` (vérifié : `ownHero(event.heroId)` juste au-dessus).

*Écart assumé* : trois autres appelants portent le même patron inline
(`HeroSwap.tsx:70`, `shell.tsx:971`, `KingdomOverview.tsx:162`). Ils ne sont pas
touchés (guidelines §3 — chirurgie) ; ils ne sont pas en défaut, seulement
redondants.

- [x] `heroDisplayName` ajouté (`app/i18n.ts`)
- [x] `combat.tsx` bandeau + sélecteur
- [x] `notifications.ts` (SpellCast)
- [x] **Vérif (a)** — test unitaire client `app/i18n.test.ts` : héros nommé ⇒ nom
      résolu (paquet **et** core) ; `name: ''` ⇒ `hero.genericName` ; clé inconnue
      ⇒ la clé brute (pas le générique).
- [x] **Vérif (b)** — smoke `@core` : dans le test **existant** « combat : victoire
      contre le gardien » (aucun démarrage de navigateur supplémentaire),
      `combat-hero-name` ≠ « Le héros » **et** = le nom du héros de la partie.

## 2. U6 — file d'initiative : la faire **tenir**, pas la masquer

**Le remède littéral du plan (§R6.2) est un no-op** — vérifié ligne à ligne :
`combat.css:65-68` pose le fondu de bord **hors** de toute media query, et
`combat.tsx:216-219` fait `scrollIntoView` **sans** condition de viewport. Les deux
sont donc déjà actifs sur desktop. La « vignette tranchée » de la capture est ce
fondu de 22 px appliqué au **débordement** de `.combat-order` (`flex: 1`,
`overflow-x: auto`) dans `.combat-armies` (`position: fixed; left:0; right:0`).

**Périmètre redéfini** (décision) : sur **viewport large**, la file **passe à la
ligne** (`flex-wrap: wrap`) au lieu de déborder ; `overflow-x` + fondu + auto-scroll
restent la solution **portrait** (≤ 640 px), où la largeur ne permet pas de tenir.
Raison du choix parmi les trois options offertes :
- *rétrécir les puces* : casserait la cible tactile ≥ 44 px et/ou réintroduirait
  l'ellipse supprimée par C18 ;
- *puce « +N »* : masque de l'information que le joueur veut voir (l'ordre complet) ;
- *retour à la ligne* : aucune information perdue, et la hauteur supplémentaire est
  **absorbée automatiquement** — depuis R1, `.combat-armies` est **mesurée**
  (`scenes/combat/insets.ts`) et réservée par la caméra ⇒ **aucune régression B2**.

- [x] `combat.css` : `flex-wrap: wrap` en base ; `nowrap` + `overflow-x` + masque
      déplacés dans `@media (max-width: 640px)`
- [x] **Vérif chiffrée** — smoke desktop 1280×800, arène : `scrollWidth − clientWidth ≤ 1`
      **et** `li.right ≤ conteneur.right + 1` pour **chaque** `li`.
- [x] **Contre-épreuve** — ces deux assertions échouent sur `origin/main`
      (mesuré : 51 px / 278 px de débordement, dernière vignette à +51 / +278 px).

## 3. Bonus R6 — réparer la régression a11y introduite par R1

`combat.css:429-433` (dans `@media (max-width: 640px)`) :
`:root:not([data-font-scale='1']) .combat-btn-reason { display: none }`.
Au-delà du cran 1 en portrait, la raison de désactivation n'existe plus qu'en
`title` (survol souris) et en `aria-label` sur un bouton **`disabled` donc non
focusable** ⇒ l'utilisateur **tactile** qui agrandit la police — exactement la
population visée — perd l'information. Contredit doc 08 §1 (« aucune information
exclusive au hover ») et §4 (« toutes les infos hover accessibles à l'appui long »).

**Décision** : les boutons **porteurs d'une raison** passent de `disabled` à
`aria-disabled` + un `onClick` qui, au lieu d'agir, **affiche la raison**. Un appui
(court **ou** long) sur un bouton grisé explique donc pourquoi il l'est.
- `aria-disabled` est reconnu par Playwright (`getAriaDisabled` →
  `isNativelyDisabled || hasExplicitAriaDisabled`, vérifié dans
  `playwright-core@1.61.1`) ⇒ les `toBeDisabled()`/`toBeEnabled()` existants tiennent.
- `useLongPress` **non utilisé** : un appui long produit de toute façon un `click`
  en fin de geste ; ajouter le hook serait du code en trop (guidelines §2).
- L'affichage est **en surimpression** (`position: absolute; bottom: 100%` dans
  `.combat-bottom`, hors flux) ⇒ **zéro octet de hauteur** ajouté au bloc bas :
  la non-régression H5 (`bottomH ≤ 25 % du viewport`, marge réelle ~6,6 px) est
  structurellement garantie, et vérifiée dans le **même run**.

- [x] `combat.tsx` : `aria-disabled` + `actOr(can, key, run)` sur les 7 boutons à raison
- [x] `combat.tsx` : état `reasonHint` + nœud `combat-reason-hint` (auto-effacé)
- [x] `combat.css` : `[aria-disabled='true']` récupère le grisé ; style du bandeau
- [x] **Vérif (a)** — smoke `@core`/`@mobile` 360×640 cran 3 : appui long sur
      `combat-hero-attack` (grisé) ⇒ `combat-reason-hint` **visible** et portant
      **exactement** le texte du `title` du bouton (`combat.reason.<key>.hint`).
- [x] **Vérif (b)** — non-régression H5 dans le **même test** : `bottomH ≤ 25 %`
      (assertion R1 déjà en place, rejouée après le geste).

## 4. Docs (même commit)

- [x] `docs/08-ui-ux.md` : bandeau de combat (nom du héros), file d'initiative
      (retour à la ligne desktop / défilement + fondu portrait), raison de
      désactivation accessible au **tap** en portrait agrandi.

## 5. Pipeline (rejoué intégralement en 2ᵉ passe — tout vert)

1. [x] `pnpm typecheck` — OK
2. [x] `pnpm lint` — OK
3. [x] `pnpm test` — moteur **935/935**, contenu **164/164**, client vitest
       **63/63** (dont les 4 cas `heroDisplayName`). *Un faux échec au 1ᵉʳ passage* :
       `combat-property.test.ts` a dépassé les 5 s de timeout vitest sous contention
       CPU (4 vCPU partagés) ; rejoué isolément ⇒ **2/2 en 1,8 s**. Aucun fichier
       moteur n'est touché par le lot.
4. [x] `pnpm content:check` — 7 paquets, 2 cartes, 16 scénarios valides
5. [x] `pnpm build` — OK
6. [x] garde-fou zéro id de faction dans `packages/` — `statut=1`
7. [x] garde-fou zéro couleur en dur hors `tokens.css` — `statut=1`
8. [x] budget bundle — **363 654 octets** gzip (cap 819 200 ; inchangé vs `main`)
9. [x] smoke Playwright — **49/49 `@core`** (`--workers=1`) + le test U6
       (`la file d'ordre s'affiche`, non tagué) **1/1**

## 5 bis. Preuves chiffrées de la 2ᵉ passe

**Contre-épreuve** (les 3 assertions rejouées contre un build **`origin/main`** —
sources client remises à `origin/main`, suite de tests gardée) : **les 3 échouent**,
donc elles mordent.

| Assertion | Sur `origin/main` (AVANT) | Sur la branche (APRÈS) |
|---|---|---|
| B4 `combat-hero-name` = nom du héros | `element(s) not found` (attendu « Aldric l'Érudit ») | vert |
| U6 `scrollWidth − clientWidth ≤ 1` (desktop 1280×800) | **111** | **0** |
| a11y `combat-reason-hint` visible après appui long | `element(s) not found` | vert |

**Mesure U6 sur le build de la branche** (arène `?seed=42`, 1280×800, 9 vignettes) :

| | cran 1 | cran 3 |
|---|---|---|
| `scrollWidth` / `clientWidth` | 1144 / 1144 | 1124 / 1124 |
| **débordement** | **0** | **0** |
| `right` de la dernière vignette / du conteneur | 302,7 / 1268,0 | 700,8 / 1268,0 |
| vignettes hors conteneur | **0** | **0** |
| hauteur `.combat-armies` (2 rangées) | 110,0 px | 118,8 px |

Non-régression R1 : la hauteur du bandeau passe de 60 à ~110 px, **absorbée par la
caméra** (marge mesurée `combatInsets`) — les assertions R1 (« bas réel ≤ marge
réservée », « bloc bas ≤ 25 % aux 3 crans ») sont dans les 49 tests `@core` verts.

**Captures** (hors dépôt, `…/scratchpad/captures/r6-{avant,apres}/`, script
`ux-audit`, 0 cible < 44 px des deux côtés) : `combat-desktop-font3.png` montre
AVANT la dernière vignette **tranchée au bord droit**, APRÈS la file **sur 2
rangées, complète**, plateau toujours entier.

## 6. Journal des écarts

- **Écart 1** — la branche devait partir de `claude/r1-plateau-combat-visible` ;
  cette branche est **déjà mergée dans `origin/main`** (`git merge-base` = HEAD de
  R1). Base prise sur `origin/main` : mêmes correctifs R1, plus R0 et R7, et un
  `git diff origin/main...HEAD` propre.
- **Écart 2** — le remède prescrit pour U6 était un **no-op** (fondu et auto-scroll
  déjà inconditionnels). Périmètre redéfini, cf. §2.
- **Écart 3** — la vérification B4 prescrite (« = le nom affiché par le sélecteur de
  héros agissant, `combat.tsx:455` ») est **inapplicable** : ce sélecteur n'est rendu
  qu'en **coop** (`actingHeroes.length > 1`), ce qui n'arrive pas dans la partie
  rapide du smoke. La cohérence des deux surfaces est prouvée **par construction**
  (même helper `heroDisplayName`) et par le test unitaire ; le smoke assert le nom
  réel du héros dans le bandeau.
- **Écart 5** (2ᵉ passe, re-vérification) — le `actOr(key, run)` de la 1ʳᵉ passe
  déduisait le blocage de la **raison** (`if (reason[key]) …`), pas du **gate**.
  Or une raison peut être `null` alors que le gate est fermé : `canHeroStrike`
  vaut `false` si `config.combat.heroAttack` est **absent** (le schéma le déclare
  `optional` — `packages/content/src/schemas.ts:825` « absent ⇒ feature
  désactivée »), et `heroReason` vaut alors `null`. Le bouton grisé aurait donc
  **ouvert la modale d'attaque du héros** sur un paquet de données sans la
  feature — régression fonctionnelle furtive introduite par le passage de
  `disabled` à `aria-disabled`. Corrigé : `actOr(can, key, run)` prend le **gate**
  en argument (source d'autorité unique, celle de `aria-disabled`) ; sans raison à
  montrer, le tap ne fait simplement rien.
- **Écart 4** — piège de port : la 1ʳᵉ série de mesures a porté sur le build d'un
  **autre agent** (`index-CBp4fZJw.js` servi alors que mon `dist/` contenait
  `index-CEi3-Wrz.js`), un aperçu orphelin d'un autre worktree squattant 4173
  depuis 2 h. Toutes les mesures ont été refaites sur un port dédié **après
  vérification du hash servi**.
- **Écart 6** (2ᵉ passe) — **le piège de port a re-mordu** : la 1ʳᵉ série de captures
  APRÈS a été servie par l'aperçu d'un **autre worktree** (`wf_…-544-17`) resté sur
  4173. Il est passé inaperçu au hash **parce que les hashs se ressemblent par
  construction** : leur build valait `origin/main`, dont le `index-*.js` est
  exactement celui de mon build AVANT (`index-CEi3-Wrz.js`, hash de contenu). Seule
  la comparaison **hash servi vs `dist/` courant** l'a révélé. Le `flock` ne protège
  pas d'un agent qui ne le prend pas. Toutes les mesures et le smoke ont donc été
  rejoués sur un **port dédié 4199** (aperçu à moi, hash servi vérifié =
  `index-Bfgv11XP.js`), via une copie hors dépôt du script de capture et une config
  Playwright identique au dépôt à la seule URL près (`CI=1` conservé : `forbidOnly`,
  `retries=2`). Corollaire : mon propre aperçu est désormais tué par **groupe de
  processus** (`setsid` + `kill -- -PGID`) — le simple `kill` de `pnpm` laissait
  l'enfant `vite` vivant, ce qui avait fait échouer bruyamment ma 1ʳᵉ contre-épreuve.
- **Écart 7** (2ᵉ passe) — l'assertion U6 vit dans le test **non tagué**
  `combat : la file d'ordre s'affiche…` : la CI de **PR** ne joue que `@core`, elle
  ne la verra donc **pas** ; elle tourne sur `main` (`deploy.yml`) et au dispatch.
  Choix assumé (skill `test-authoring` §2.3 : `@core` réservé aux parcours vitaux,
  ~15-20 max) — l'assertion est ajoutée au test qui EXISTE déjà pour cette file
  plutôt que de gonfler le noyau ; elle a été jouée localement (verte) et sa
  contre-épreuve est faite. Les deux autres assertions (B4, a11y) sont, elles, dans
  des tests `@core`.
- **Écart 8** (2ᵉ passe) — le script de captures `ux-audit` change le cran de police
  en posant `font-size` sur `<html>`, **sans** poser `data-font-scale` : ses
  `*-font3.png` **n'exercent pas** les règles R1/R6 conditionnées au cran (repli des
  actions de héros dans « ⋯ », masquage de `.combat-btn-reason`). Ces règles-là ne
  sont donc prouvées que par le smoke (qui, lui, passe par
  `localStorage.heroes.fontScale`). Les captures restent valables pour ce qu'elles
  montrent : la file d'initiative qui tient, et la mesure A1 des cibles.

# Revue complète du jeu 2026-09 (b) — ergonomie d'abord

> **Demande utilisateur (2026-09-24)** : « Effectue une revue complète du jeu et
> un plan pour corriger, améliorer et approfondir le jeu. Investigue tous les
> aspects du jeu et propose des améliorations et approfondissements. Corrige tout
> bug, et surtout ceux d'ergonomie. »
>
> Suite de `code-review-2026-09.md` (livrée, non re-signalée). Ce plan-ci est
> **jeu + ergonomie** : on a joué le build de prod (Chromium headless, captures
> `ux-audit` desktop 1280×800 + mobile 360×640 × 3 crans de police) et relu le
> client et le moteur. Chaque constat a été vérifié dans le code.

## 0. Méthode & baseline

- Build de prod + `vite preview` ; `node .claude/skills/ux-audit/capture.mjs`
  (78 captures, **0 cible < 44 px**, 0 étape en échec).
- Relecture client (shell, ville, combat, modales, scènes) et moteur (règles).
- Vérification avant push : `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm content:check`, `pnpm build`, smoke Playwright `@core`.

## 1. Constats d'ergonomie (client) — lot E, corrigés dans cette PR

Légende : ✅ corrigé · ⏸ différé (raison notée).

### 1.1 Vus en jouant (captures)

| # | Constat | Correctif |
|---|---|---|
| V1 | Aucune police de base sur `#ui-root` : pré-combat, passage d'appareil, bilan, fin de partie rendus en **Times** (police navigateur par défaut) au lieu de la police d'UI. | `#ui-root { font-family: var(--font-ui) }` |
| V2 | Toast « Guilde des mages construit (niveau **{level}**) » : paramètre `level` jamais passé (`notifications.ts`). | passer `event.level` + test |

### 1.2 Relecture du code client

| # | Sév. | Constat | Correctif |
|---|---|---|---|
| E1 | P1 | Raccourcis carte (E/T/H/N) actifs **derrière** les overlays forcés (passage d'appareil hot-seat, dialogue, cinématique, bilan, choix forcés, tour IA…) ⇒ `E` peut sauter le tour du joueur suivant. | garde commune `forcedOverlayOpen` |
| E2 | P1 | Prévisualisation de chemin conservée au changement de héros ⇒ 2ᵉ tap envoie le chemin du héros A au héros B (erreur). | `clearPreview()` au changement de héros sélectionné / position |
| E3 | P1 | Combat : sélection/préviz conservées quand la pile active change (Attendre/Défendre) ⇒ 1 seul tap **valide sans préviz** pour la nouvelle pile. | effacer la sélection au changement de `activeStackId` |
| E4 | P1 | Ville : erreur de commande affichée en haut d'un écran défilant (hors vue) et persistante entre onglets. | erreur en toast + effacée au changement d'onglet |
| E5 | P1 | `HeroSwap` sans `max-height`/défilement ⇒ en paysage / cran 3, en-tête et « Tout donner » hors écran. | `max-height` + `overflow-y: auto` |
| E6 | P2 | Combat : Espace/D déclenchés derrière les modales de combat (livre de sorts, confirmation de fuite…) et en répétition clavier. | garde modales + `e.repeat` |
| E7 | P2 | Prière gaspillable sur une cible sans effet (0 relevé / 0 soigné). | cible désactivée |
| E8 | P2 | Attaque du héros : cibles furtives listées (le moteur refuse ⇒ toast d'erreur). | filtrer `stealthed` |
| E9 | P2 | Bouton « Creuser » / héros en ville comparent x/y **sans la couche** (souterrain) ; `Dig` sans `.catch`. | `samePos` + `reportCommandError` |
| E10 | P2 | Construire : bouton actif même si le coût n'est pas couvert. | désactivé + raison |
| E11 | P2 | Recruter : « Max » et curseur montent au stock, pas à ce qui est payable ; bouton actif à 0 payable. | `min(stock, maxAffordable)` |
| E12 | P2 | Vente d'un artefact **équipé** en 1 tap. | tap-tap de confirmation |
| E13 | P2 | Erreur « Construire un bateau » non localisée (texte moteur brut). | `commandErrorMessage` |
| E14 | P2 | Bouton Ville / raccourci T actifs pendant le tour IA. | grisés pendant `aiTurn` |
| E15 | P2 | Choix de compétence à la montée : nom + rang seulement, aucun effet affiché. | effet par rang dérivé des données |
| E16 | P2 | Pré-combat : les côtés ne disent pas lequel est le joueur (défense / siège). | libellés « Vous » / « Ennemi » selon le camp |
| E17 | P2 | Aide des raccourcis ouverte depuis Options : Échap ferme **Options** entier. | ouverte via la pile de modales |
| E18 | P2 | Charger / importer / récupérer du cloud remplace la partie en cours sans confirmation. | confirmation tap-tap |
| E19 | P2 | Nouvelle partie : deux sièges peuvent prendre la même couleur. | couleurs prises désactivées |
| E20 | P3 | Boutons segmentés (langue, police, vitesse ×1/×2/×4) : état actif porté par la couleur seule (pas d'`aria-pressed`). | `aria-pressed` + onglets `role="tab"` |
| E21 | P3 | Aide des raccourcis : « Espace »/« Échap » en dur (FR en locale EN). | clés i18n |
| E22 | P3 | `aria-label` de la bande de héros = « niveau N » seulement. | nom du héros |
| E23 | P3 | Bilan de combat : ni Entrée ni Échap pour fermer. | clavier |
| E24 | P3 | Renforts : vider le champ quantité le remet à 1 (taper « 5 » donne « 15 »). | saisie libre, borne au blur |

## 2. Constats moteur (règles) — lot M

M1–M4 **reproduits** par un test jetable avant correction ; chaque correctif a
son test de non-régression (échoue sans le correctif).

| # | Sév. | Constat | Correctif | Statut |
|---|---|---|---|---|
| M1 | P1 | Attaquer un héros **sans troupes** (recrue de Taverne, rescapé de fuite) ouvrait un combat **sans fin** (aucune mort ⇒ `checkCombatEnd` jamais appelé ; `AutoCombat` levait « dépassement d'itérations », l'IA qui chasse ces proies plantait). | `openPlacementOrBattle` : `checkCombatEnd` à l'ouverture ⇒ victoire immédiate ; client : bilan affiché pour un combat ouvert+clos dans la même commande. | ✅ |
| M2 | P1 | `AbandonCombat` = dégâts gratuits : tirer au round 1 puis abandonner (armée intacte, gardien affaibli), en boucle. | refus dès qu'une pile du camp joueur a agi/attendu ou que son héros a agi. | ✅ |
| M3 | P1 | Fuir / se rendre / abandonner face à un **héros** lui rendait toute son armée. | armée du héros adverse reconstruite depuis ses survivants (`endLeftCombat`). | ✅ |
| M4 | P1 | `TradeResources` acceptait un id de ressource inconnu ⇒ **crédit d'or forgé** (PvP). | ids bornés à `RESOURCE_IDS`. | ✅ |
| M5 | P1 | Le Graal pouvait être déterré par **chaque** joueur. | `grailTaken` (validation + IA + bouton client). | ✅ |
| M6 | P1 | IA : ne vise jamais une ville non adjacente ; carte explorée ⇒ héros IA immobiles, aucune pression. | repli final `pickTownMarchTarget` : marche multi-jours vers la ville adverse prenable la plus proche, siège au contact. | ✅ |
| M7 | P2 | Capture : le 1ᵉʳ héros adjacent était pris, même sans troupes (`invalidArmy`) alors qu'un héros armé était là. | préférer un héros avec armée. | ✅ |
| M8 | P2 | Ville-portail depuis un bateau : héros à terre resté en domaine naval. | refusé tant que `naval`. | ✅ |
| M9 | P2 | Moral positif déclenché après **Défendre** (le tour bonus annulait la défense). | pas de jet de moral sur Défendre (fidélité HoMM) — **golden re-fixé** (`ae2fa0d7`), doc 02 §5 aligné. | ✅ |
| M10 | P2 | Défendre ne donne rien aux unités à Défense 1–3 (`floor(def×1,3)`). | ⏸ équilibrage : décision de design (+1 plancher ?) — mesurer au `faction:sim` d'abord. | ⏸ |
| M11 | P2 | Mana **remplie** à chaque début de combat : Puits de magie et réserve IA sans objet ; doc 02 se contredit (l.140 vs l.149/317). | ⏸ décision de design (impact équilibrage majeur). | ⏸ |
| M12 | P2 | Deux montées de niveau d'affilée écrasent le choix de compétence en attente (l'IA, elle, les reçoit toutes). | ⏸ file de choix ⇒ **bump save** — lot dédié. | ⏸ |
| M13 | P2 | Soin (cercle 1) ressuscite des créatures (rend Résurrection redondant). | ⏸ champ `revive` au schéma de sort — décision de design. | ⏸ |
| M14 | P2 | Quête `visitTile` validée à la **vue** (rayon de vision), pas à la visite ; `defeatGuardian` validée si **n'importe qui** tue le gardien. | ⏸ condition « héros sur la tuile » (nouveau type de condition). | ⏸ |
| M15 | P3 | Renforts : effectif fractionnaire accepté. | `Number.isInteger`. | ✅ |
| M16 | P3 | `ResolveTriggerChoice.optionIndex` NaN/1,5 accepté. | `Number.isInteger`. | ✅ |
| M17 | P3 | `CastAdventureSpell`/`CaptureTown` ignoraient un trésor / choix en attente. | même gate que `Dig`. | ✅ |
| M18 | P3 | `landingTileFor` pouvait poser un héros sur un gardien. | voisine gardée exclue. | ✅ |
| M19 | P3 | Récompense de quête au 1ᵉʳ héros, unités perdues si armée pleine. | ⏸ repli garnison — lot quêtes. | ⏸ |

## 3. Améliorations & approfondissements proposés (non implémentés ici)

Classés par rapport valeur de jeu / effort. Chacun s'appuie sur un point
d'extension déjà présent (zéro faction moteur).

### 3.1 Profondeur de jeu (moteur + données)

1. **Zone de contrôle des gardiens** (S–M) — passer à côté d'un gardien l'engage
   (HoMM) ; opt-in config pour garder le golden. Rend la carte plus tactique.
2. **Fuite HoMM** (M) — le héros en fuite quitte la carte et redevient recrutable
   en Taverne avec ses survivants ; supprime au passage les héros « vides » (M1).
3. **Objectifs IA multi-jours généralisés** (M) — étendre M6 aux mines, au Graal et
   aux héros ennemis (chemin complet tronqué aux PM du jour, recalculé chaque tour).
4. **Banques de créatures** (M) — `guardedBy` sur les `visitable`, paliers de
   `guardian-reward` réutilisés : butin gardé à débloquer.
5. **Neutres qui rejoignent / fuient** (M) — avant un combat de gardien, comparer
   `armyStrength` + compétence Diplomatie (nouvel effet de `skills.json`).
6. **Siège avec héros visiteur** (L) — garnison + armée du héros défenseur, murs
   compris (réutilise les conséquences H-VS-H).
7. **La mana comme ressource** (S, après décision M11) — effet `restoreManaPerDay`
   (patron `heroAura`), visite de Guilde = mana pleine ; Savoir et Puits comptent.
8. **Soin ≠ Résurrection** (S, après décision M13) — `revive?: boolean` au schéma.
9. **Première semaine offerte à la construction d'une habitation** (S) — option
   config (projection `weeklyGrowthOf`), fidélité HoMM3.
10. **Condition « atteindre la tuile avec un héros »** (S) — corrige M14 proprement.

### 3.2 Ergonomie (client)

1. **Pan clavier** (flèches/WASD) et **zoom +/−** sur la carte ; Entrée confirme le
   chemin prévisualisé ; `Ctrl+S` sauvegarde rapide.
2. **Fiche d'info à l'appui long** partout où subsiste un `title=` seul (artefacts :
   bonus + raison de conflit d'emplacement ; marché ; garnison du Royaume).
3. **Stats effectives** dans la fiche de pile de combat (bonus du héros, moral et
   chance actifs), pas seulement les stats de base.
4. **Fin de tour renseignée** : badge « N héros avec PM · N villes sans
   construction », libellé « IA en cours » pendant les tours adverses.
5. **Aperçu « Tout recruter »** (coût total + confirmation) ; **annuler** le dernier
   transfert en rencontre de héros / garnison.
6. **Format des nombres** localisé (`Intl.NumberFormat` selon la langue du jeu) :
   « 12 500 » / « 12,500 » au lieu de « 12500 ».
7. **Piège de focus** et restauration du focus dans les modales (Tab ne s'échappe
   plus dans le HUD derrière).
8. **Toasts** : ils recouvrent l'en-tête des modales ouvertes (capture guilde) —
   les descendre sous l'en-tête ou les regrouper quand une modale est ouverte.
9. **Carte mobile** : la rangée d'actions défile (fondu de bord, lot R3) et
   Royaume/Options/Son sont hors vue à 360 px — un tiroir « ⋯ » comme en combat
   les rendrait découvrables sans geste de défilement.
10. **Combat mobile** : les piles ennemies sont hors écran à l'ouverture (plateau
    plus large que le viewport) — cadrer sur les deux camps au 1ᵉʳ affichage.
11. ~~**Nouvelle partie** : libeller les deux `<select>` (faction, héros) par siège.~~
    ✅ fait dans cette PR (`aria-label` « Faction / Héros de départ du joueur N »).

## 4. Avancement

- [x] Lot V (V1–V2)
- [x] Lot E (E1–E24) — E1–E24 livrés ; smoke CL6 et helper de chargement adaptés
- [x] Lot M — M1–M9, M15–M18 livrés ; M10–M14, M19 différés (décisions de design / bump save)
- [x] Docs 02 (§2.2 Graal, §5 moral, fin de combat/abandon) et 08 (§2.2, §3, §4) alignées
- [x] Vérifs : typecheck · lint · test (1 327) · content:check · build · smoke `@core`
- [x] Smoke complet (hors `@perf`/`@e2e`) : 140/140 ; ciblés rejoués après les derniers ajustements (82/82 après correctif du test CL6)

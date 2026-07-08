# Plan — Remédiation des divergences avec *Might & Magic: Heroes Online*

> Origine : revue de 8 captures d'une vidéo de *Might & Magic: Heroes Online*
> (preview Steam/PC) confrontées au design documenté (`docs/`) et au code réel
> (`packages/`). Objectif : identifier les écarts, distinguer les **choix
> délibérés** des **manques corrigeables**, et cadrer la correction.
>
> **État** : décisions prises — **A1** (projection iso, rendu seul) et **B1**
> (file de chantier en jours, présentation seule) **LIVRÉS** (voir §4/§5 + journal
> §6). Lots combat 1–3 restent en attente d'un feu vert utilisateur.

---

## 1. Méthode & garde-fous

- Le jeu original est un **MMO free-to-play temps réel** (Flash/Unity). Notre
  projet en est une **recréation navigateur tour par tour, solo/hot-seat, sans
  F2P**, par choix documenté (doc 01 §3-4, doc 02). Beaucoup d'« écarts » sont
  donc **volontaires**, pas des bugs.
- Tout changement de design met à jour le `docs/0X-*.md` concerné **dans le même
  commit** (guidelines §8.6, docs = source de vérité).
- Invariants non négociables préservés partout : moteur pur/déterministe, zéro
  `if (faction === …)`, RNG seedé, moteur sans dépendance au rendu (guidelines §8).
- Chaque lot = une PR draft, test dans le même lot (guidelines §7), golden/lint/
  budget bundle < 800 Ko gzip verts.

---

## 2. Cartographie des divergences

### 2.1 Divergences DÉLIBÉRÉES (hors périmètre sauf arbitrage explicite)

| Capture | HoMM Online | Notre impl | Référence du choix |
|---|---|---|---|
| 2, 8 | MMO : chat, autres joueurs nommés sur la carte | Solo + hot-seat ; en ligne = Beta | doc 01 §3 |
| 6 | Ville « Townias » : construction à **timer temps réel** (`00:00:30`) | 1 bâtiment / jour, tour par tour | doc 01 §4, doc 02 §4.1 → **rouverte, cf. §5 Décision B** |
| 7 | Monnaie premium « Hero Seals », *pay-to-win* | Aucune monétisation | doc 01 §4 (interdit explicite) |
| 2, 8 | Carte peinte isométrique continue | Grille carrée 32×32 top-down | doc 02 §2.1 → **rouverte, cf. §4 Décision A** |
| 4 | Barre d'initiative ATB continue | Tours « par vagues » de vitesse | doc 01 §6, doc 02 §5.2 |

### 2.2 Divergences CORRIGEABLES (manques réels, fidèles au *feel*, compatibles moteur pur)

| # | Capture | Constat | Lot |
|---|---|---|---|
| D1 | 3 | Pas d'**écran pré-combat « Battle Power »** ni de choix Auto-Battle avant le combat. L'auto n'existe que comme bouton *pendant* la bataille. | Lot 1 |
| D2 | 4 | Le bandeau de combat est trié **par slot**, pas par **ordre d'action du round**. HO affiche la file d'initiative en bas. | Lot 2 |
| D3 | 4 | Pas de **popups flottants « X Kills / Y Damage »** après une frappe. On n'a que la prévisualisation *avant* action. | Lot 3 |

---

## 3. Lots de correction (prêts à démarrer)

### Lot 1 — Écran pré-combat & Auto-Battle *(D1, priorité haute)*

**But** : reproduire l'écran d'intro de combat de HO (portraits attaquant/
défenseur + puissance comparée + boutons « Combattre » / « Auto-Battle »),
intercalé dans la transition carte → combat.

Étapes :
1. Moteur — `packages/engine/src/combat/` : fonction **pure** `battlePower(army, catalog)`
   (somme pondérée `count × (hp + dmgMoyen + speed…)`, valeurs de départ en
   `data/core/config.json`, jamais en dur). N'altère **aucun** état → golden
   inchangé. *Vérif : test unitaire (armée connue → puissance attendue).*
2. Client — nouvel écran DOM `PreBattleScreen.tsx` (portraits via assets
   existants, deux puissances, boutons). Cibles ≥ 44 px, i18n FR/EN, pas de
   3ᵉ modale empilée (doc 08). *Vérif : rendu réactif au store.*
3. Flux — au déclenchement d'un combat (interception gardien / siège), afficher
   l'écran **avant** `CombatScene`. « Combattre » → combat manuel ; « Auto-Battle »
   → `AutoCombat` immédiat (résolution déterministe existante). *Vérif : smoke
   Playwright « l'écran s'affiche, Auto-Battle résout et applique les pertes ».*

**Critère de succès** : sur un combat de la carte proto-01, l'écran pré-combat
s'affiche avec les deux puissances ; les deux chemins (manuel / auto) mènent au
même état final déterministe qu'aujourd'hui.

### Lot 2 — File d'ordre de tour en combat *(D2, priorité moyenne)*

**But** : afficher l'ordre d'action du round courant (portraits dans l'ordre où
les piles vont jouer), comme le bandeau initiative de HO — **sans** passer à un
ATB continu (le choix « vagues » reste, doc 02 §5.2).

Étapes :
1. Moteur — exposer un helper **pur** `turnOrderThisRound(combat, catalog)`
   (réutilise la logique de `pickNext`/`speedWithStatus` de `turns.ts`, sans
   muter l'état) → liste ordonnée d'IDs de piles restant à jouer ce round.
   *Vérif : test unitaire (vitesses connues → ordre attendu, égalités = attaquant
   puis slot).*
2. Client — rendre cette file en bas du combat (portrait + count), la pile active
   en surbrillance. *Vérif : assertion smoke sur l'ordre du DOM.*

**Critère de succès** : à round donné, la file affichée = ordre réel de jeu des
piles (vérifiable en avançant les tours).

### Lot 3 — Popups dégâts / kills en combat *(D3, priorité basse, cosmétique)*

**But** : nombres flottants « −N » / « X tués » sur `CombatScene` après chaque
frappe, à partir des events de combat déjà émis par le moteur.

Étapes :
1. Client — sur réception des events de pertes (déjà produits par le moteur),
   spawn d'un texte flottant animé (fade + montée) au-dessus de la pile touchée.
   Pur rendu, aucune donnée moteur nouvelle. *Vérif : smoke visuel (le texte
   apparaît après une attaque).*

**Critère de succès** : une frappe manuelle affiche le nombre de pertes ; aucune
régression de perf sous throttling ×4 (smoke anti-gel).

---

## 4. Décision A — Rendu isométrique de la carte *(à arbitrer avant code)*

> Rouverte à la demande. Contredit doc 02 §2.1 (« grille carrée top-down »).

**Nuance technique déterminante** : le rendu actuel est une projection
**orthogonale** (`tilemap.ts` : `px = x*64, py = y*64`), coordonnées **1:1 avec
la grille moteur**. Deux ampleurs très différentes se cachent derrière « carte
iso » :

| Option | Description | Coût | Impact |
|---|---|---|---|
| **A0 — Statu quo** | Grille carrée top-down | 0 | Aucun. Recommandé si l'iso n'est pas prioritaire. |
| **A1 — Projection isométrique du *même* grid** | On garde la grille carrée moteur ; on change **uniquement la projection** de rendu (`worldToScreen` → losange iso 2:1) + tuiles/assets iso + tri par profondeur (y-sort). Le moteur, le pathfinding A*, le brouillard, les objets : **inchangés**. | **Moyen** (chantier rendu client localisé : `tilemap`, `camera`, `heroSprite`, `mapObjects`, `fog`, `pathPreview`, `townsLayer`, `worldBorder`). | Client seul. Docs 02 §2.1 + 08 à mettre à jour. Assets tuiles à re-générer en iso. Donne l'essentiel du *look* HO. |
| **A2 — Carte peinte continue, mouvement libre** | Abandon de la grille de tuiles pour une carte peinte + déplacement libre le long de chemins (vrai HO). | **Très élevé** | Touche le **moteur** (coordonnées, mouvement, A*, vision, coûts) → remet en cause déterminisme/tests/golden, format de carte, éditeur, IA. Déconseillé (contredit l'architecture data-driven à tuiles). |

**Recommandation** : si l'objectif est le *rendu* iso à la HO, viser **A1**
(render-only, moteur intact, faisable par lots). **A2** = quasi-réécriture, à
éviter.

> ✅ **A1 LIVRÉ** (décision utilisateur). Module de projection central
> `packages/client/src/render/projection.ts` (`isoTileCenter`/`isoAnchor`/
> `isoWorldToTile`/`isoDepth`/`isoDiamond`, losange 2:1). Toutes les couches
> routées : tilemap (losanges teintés — repli gouache, assets tuiles iso =
> lot ultérieur), brouillard (losanges), objets/villes (ancrage iso + tri de
> profondeur `sortableChildren`/`zIndex = x+y`), prévisualisation de chemin
> (ellipses au sol), héros (ancre + z-sort), anneau de sélection (ellipse),
> rivage (losange), centrage caméra, cinématiques, **et le hook de test
> `tileToScreen`** (même projection ⇒ picking tap→tuile juste). Moteur/A*/
> vision/sauvegarde **inchangés**. Vérif : typecheck+lint verts, smoke desktop
> 53/53 (dont tap-tap, siège par tap sur ville, anti-gel carte 10,8 fps ≥ 5).
> ✅ **A1.6 — finitions LIVRÉ** : **tri de profondeur inter-couches** — objets,
> villes et héros fusionnés dans **une couche d'entités unique** (`sortableChildren`,
> `zIndex = x+y`) → un objet de premier plan passe devant un héros plus haut
> (`MapObjectsLayer`/`TownsLayer` reçoivent la couche partagée, `AdventureScene`
> la possède, `eventMode:'none'`). **Mini-carte** : laissée **top-down** à dessein
> (convention + fidèle au minimap de HO ; la passer en iso nuirait à la lisibilité
> sans gain). Docs 02 §2.1 à jour.
>
> ✅ **A1.5 — assets de tuiles iso LIVRÉ** (suite). `gen_tiles.py` dérive de
> chaque tuile carrée un **losange texturé 64×32** (`assets/tiles/iso/`, rotation
> 45° + compression, transform PIL déterministe) + `iso/_preview.png` (contrôle
> de tessellation). `tilemap.ts` pose ces losanges texturés sur le repli gouache
> (anti-couture), tilemap statique **mise en cache** (`cacheAsTexture`, 1 draw
> call ⇒ anti-gel carte 11,2 fps). `isoTileUrl`/`isoRoadUrl` dans `assets.ts`
> (préchargés via le préfixe `tiles/`). Docs 02 §2.1 + doc 12 à jour.

---

## 5. Décision B — Temps réel / timers de ville *(à arbitrer avant code)*

> Rouverte à la demande. Contredit doc 01 §4 (« interdits : pas de timers, pas de
> timers payables ») et doc 02 §4.1 (« 1 construction/ville/jour, règle sacrée du
> rythme HoMM »).

**Enjeu structurel** : le temps réel **casse le pilier tour-par-tour** et
plusieurs invariants qui font gratuitement marcher tests, replays et anti-triche.

| Option | Description | Coût | Impact / risque |
|---|---|---|---|
| **B0 — Statu quo** | Construction tour par tour, 1/jour | 0 | Aucun. Fidèle à HoMM classique (pas au MMO HO). Recommandé. |
| **B1 — Skin « file de construction »** | Rester tour par tour, mais **présenter** la construction comme HO (file, coûts, aperçu) sans horloge réelle. Le « timer » = nombre de **jours** restants, pas des secondes. | **Faible** (UI/présentation) | Compromis : *look* HO, cœur tour-par-tour intact. Doc 02 §4.2 (écran de ville) à préciser. |
| **B2 — Vrai temps réel (secondes)** | Construction à horloge murale (`00:00:30`), comme le MMO | **Très élevé** | Casse le déterminisme (le moteur pur ne doit pas lire l'horloge — guidelines §8.2), le format de sauvegarde, les scénarios tour-par-tour, l'IA, le golden replay. Incompatible avec l'architecture actuelle et l'interdit doc 01 §4. **Fortement déconseillé.** |

**Recommandation** : **B0** (garder tel quel) ou au plus **B1** (habillage sans
horloge). **B2** est un changement de nature du jeu (de « HoMM tour par tour »
vers « MMO F2P temps réel ») qui invaliderait une large part du moteur et des
docs.

> ✅ **B1 LIVRÉ** (décision utilisateur). Écran de ville (`TownScreen.tsx`,
> onglet Construire) : bandeau **« Chantier du jour »** (libre / occupé, dérivé
> de `town.builtToday`) + **temps de chantier en jours** (« Chantier : 1 j »)
> par bâtiment disponible. **Présentation seule** : « jours » = tours, jamais de
> secondes (interdit anti-timers doc 01 §4) ; **zéro** changement moteur ou de
> forme de sauvegarde. i18n FR/EN, CSS, smoke étendu (queue libre + temps).
> Docs 02 §4.2 à jour.

---

## 6. Ordre recommandé & suivi

1. **Lot 1** (écran pré-combat + Auto-Battle) — meilleur rapport fidélité/coût.
2. **Lot 2** (file d'initiative) — cohérent avec la lisibilité tactique.
3. **Lot 3** (popups) — polish.
4. **Décision A** puis, si A1 retenu, ses sous-lots.
5. **Décision B** — probablement B0/B1 (documentaire/UI), pas de code lourd.

> Journal (à cocher à l'avancement) :
> - [ ] Lot 1 — pré-combat & Auto-Battle
> - [x] Lot 2 — file d'initiative → **LIVRÉ par le lot M1** du plan
>   `ux-revue-mmho.md` (helper `roundActionOrder`, bandeau d'ordre + fiche de
>   pile) — feu vert « lance le travail » 2026-07-08
> - [ ] Lot 3 — popups dégâts/kills
> - [x] Décision A tranchée → **A1** (projection iso) **LIVRÉ**
> - [x] Décision B tranchée → **B1** (file de chantier en jours) **LIVRÉ**

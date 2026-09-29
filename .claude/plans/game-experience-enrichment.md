# Enrichissement & approfondissement de l'expérience de jeu

> **Demande utilisateur (2026-09-29)** : « ouvre un plan d'enrichissement et
> d'approfondissement de l'expérience du jeu », dessiné par un **agent game
> designer** travaillant avec un **agent spécialisé RPG tactique à la HoMM**.
>
> Plan **vivant** (guidelines §5) et **registre unique des reliquats** (§1) depuis
> la clôture `close-open-plans-2026-09.md`. Ce document **propose** ; rien n'est
> implémenté tant qu'un lot n'est pas validé par l'utilisateur. Chaque lot validé
> ouvre son propre plan `.claude/plans/<lot>.md` + une PR atomique.

## 0. Méthode — le binôme de design

Deux agents définis dans `.claude/agents/` :

| Agent | Rôle | Écrit ? |
|---|---|---|
| `game-designer` | dessine les bases d'amélioration : intention joueur → constat prouvé → mécanique chiffrée → pilier → point d'extension → coût → critère vérifiable | oui, dans ce plan (jamais le code) |
| `tactical-rpg-expert` | relit chaque proposition : filiation (canon/adaptation/innovation, opus HoMM cité), solidité tactique (vrais choix, contre-jeu, abus, IA), lisibilité, rythme, verdict Retenir/Amender/Écarter | non (verdict seul) |

Boucle (orchestrée par la session principale — un sous-agent n'en lance pas un
autre) : **designer propose → expert relit → designer amende → l'utilisateur
tranche** les décisions marquées 🗳️ → lot ouvert. Les divergences HoMM déjà
tranchées (doc 01 §3-4, doc 18 §4 étape 5) ne se rouvrent pas.

Invariants rappelés pour chaque lot : zéro faction dans `packages/` · RNG seedé ·
un point d'extension générique opt-in par lot · pas de bump
`CURRENT_SAVE_VERSION` ni de golden re-fixé sans nécessité justifiée · doc
`docs/0X-*.md` amendé dans le même commit · vérifs §4/§7 (typecheck, lint,
tests, `content:check`, garde-fous, build + budget, smoke `@core`).

## 1. Registre des reliquats (repris des plans clôturés)

Vérifiés dans le dépôt le 2026-09-29. Source = plan archivé dans `archive/`.

### 1.1 Décisions de design en suspens 🗳️ (soumises au binôme, §3)

| ID | Reliquat | Source |
|---|---|---|
| M10 | Défendre inutile à Défense 1–3 (`floor(def×1,3)`) | `game-review-2026-09b` |
| M11 | Mana remplie à chaque combat (Puits de magie, réserve IA sans objet ; doc 02 se contredit) | idem + `code-review-2026-09` hors périmètre |
| M12 | Deux montées de niveau d'affilée écrasent le choix de compétence (file de choix ⇒ bump save) | `game-review-2026-09b` |
| M13 | Soin (cercle 1) ressuscite ⇒ Résurrection redondante | idem |
| M14 | Quête `visitTile` validée à la vue ; `defeatGuardian` par n'importe qui | idem |
| M19 | Récompense de quête au 1ᵉʳ héros, unités perdues si armée pleine | idem |
| D-POISON | Poison persistant vs bouclier | `code-review-2026-08` lot 5, `code-review-2026-09` |
| D-REINF | `CallReinforcements` hors budget « 1 action de héros par round » | `code-review-2026-09` |
| D-SIEGEAI | L'IA n'assiège pas les villes à garnison | idem |
| D-SIEGEHERO | Siège avec héros visiteur défenseur (garnison + armée du héros) | idem + `game-feature-gaps` F-BUILDEFF |

### 1.2 Contenu & données (moteur prêt, câblage à équilibrer)

- **CAP** : Maître de Sortilèges / Avatar Vox (câblage à équilibrer, factions fortes au sim).
- **combatBonus** des autres factions ; **F-SKILLS** : Chasse rituelle, Sylve.
- **École de la Scène** : effets peur / +moral (partagés avec le moral).
- **F-BUILDEFF.7+** : Cercles Traque (+vitesse recrue — bloqué : stats par instance),
  Sceau (−mana d'école — bloqué : portée mana combat↔ville), +XP/+rang, bonus
  additionnels du Sanctuaire du Honmoon.
- **H-NAMED** : signatures restantes (Nécromancie par niveau, Symbiose de départ,
  familier gratuit).
- **M-VISIT** : gating par Savoir des sanctuaires ; **mois** persistants et ciblage
  par `unitId` exact ; **Graal** : effets spécifiques par faction (données).
- **Marché** : courbe HoMM3 exacte, troc pénalisé ; **caravanes** : interception,
  annulation en route.
- **Slot d'artefact *trophée*** (+1 slot ⇒ bump save, avec un lot H-ARTEQUIP) — `l8-content-finitions`.

### 1.3 Ergonomie (client) — `game-review-2026-09b` §3.2

Pan clavier / zoom +/− / Entrée confirme / `Ctrl+S` · fiche d'info à l'appui long
là où ne reste qu'un `title=` · stats **effectives** dans la fiche de pile · fin de
tour renseignée (héros avec PM, villes sans construction) · aperçu « Tout
recruter » + annuler le dernier transfert · nombres localisés (`Intl.NumberFormat`,
absent du client) · piège de focus des modales (absent) · toasts sous l'en-tête
des modales · tiroir « ⋯ » de la carte mobile · cadrage des deux camps à
l'ouverture du combat mobile.

### 1.4 Infra, outillage, hygiène

- **Snapshot par match** (migration D1 en prod, à faire avec l'opérateur) — `post-review-followups`.
- **Icône PWA *maskable*** (absente de `data/manifest.webmanifest`) — idem.
- **`map:gen` CLI** n'envoie pas les mêmes options que le client (carte différente à graine égale) — idem.
- **Suppression des 209 branches fusionnées** : commande prête dans
  `archive/merged-branches-cleanup.md` §5, refusée à la session ⇒ à lancer par l'utilisateur.
- **Dépendances majeures** à mettre à jour (lot dédié) — `code-review-2026-09`.
- **Souterrain > 2 niveaux** (transversal + bump save) — `l10-underground`.
- **NET-FOG** : information ouverte entre participants, statu quo assumé — à
  rouvrir seulement pour une beta compétitive — `l11-online-competitive`.
- **AS-OVERLAYS** (habillage chargement/cutscenes, optionnel) — `game-feature-gaps`.

### 1.5 Écartés par arbitrage (conservés pour mémoire)

Filtre par catégorie du journal de combat · « Équilibrer » la garnison
(`reliquats-differes` §4). Ne se rouvrent que sur demande.

## 2. Bases d'amélioration — proposition du game designer

*(à remplir par le binôme)*

## 3. Relecture de l'expert RPG tactique HoMM

*(à remplir)*

## 4. Lots proposés

*(à remplir)*

## 5. Journal

- **2026-09-29** — Plan ouvert par la passe de clôture ; registre §1 constitué et
  vérifié ; agents `game-designer` et `tactical-rpg-expert` créés.

# Clôture des plans à reliquats (2026-09)

> **Demande utilisateur (2026-09-29)** : « Clôture les plans ayant des reliquats
> et ouvre un plan d'enrichissement et d'approfondissement de l'expérience du
> jeu. Ajoute un agent de game designer dessinant les bases d'amélioration
> travaillant avec un agent spécialisé en RPG tactique à la Heroes of Might and
> Magic. »
>
> Deuxième passe d'hygiène de `.claude/plans/` (la première :
> `archive/close-open-plans.md`, 2026-08-24). **Aucun code de jeu** n'est écrit :
> on vérifie ce qui est livré, on consigne les reliquats, on archive.

## Étapes

1. [x] **Inventaire** des 20 plans en racine (cases `[ ]`, ⬜, 🚧, ⏸, « différé »,
   « reste », « hors périmètre »). → verify : chaque plan classé ci-dessous.
2. [x] **Re-vérifier dans le dépôt** chaque reliquat avant de le reporter (pas de
   recopie aveugle — la passe précédente avait trouvé des reliquats périmés).
   → verify : colonne « preuve » du tableau §Constat.
3. [x] **Bannière de clôture** en tête des plans qui portaient des reliquats
   (renvoi au registre), coche de la seule case périmée (`llm-asset-generation-plants`
   étape 3, preuve = étape 4), correction du suivi `missing-features-2026-08` (L10
   📋 → ✅, sans bump save).
4. [x] **Registre unique** des reliquats dans le nouveau plan
   `game-experience-enrichment.md` §1 (remplace `reliquats-differes.md`, archivé).
5. [x] **Archiver** les 20 plans (+ `merged-branches-cleanup.branches.txt`) vers
   `archive/`. → verify : `ls .claude/plans/*.md` = ce plan + le plan
   d'enrichissement.
6. [x] **Agents** `.claude/agents/game-designer.md` et
   `.claude/agents/tactical-rpg-expert.md` créés, puis exercés une première fois
   pour dessiner les bases du plan d'enrichissement.

## Constat

| Plan | État réel | Reliquat reporté ? |
|---|---|---|
| `game-feature-gaps.md` | inventaire vivant du 2026-07, re-vérifié par `missing-features-2026-08` ; plusieurs 🚧/⬜ **périmés** : C-SIEGE2.7b (`assets/combat/siege-piece-wall-cracked*.png`, `-razed*`), N-CAMPAIGNS2 (`data/factions/{sylvan-court,vox-arcana}/story/campaign.json`), NET-SRVGUARD.2 (`server/schema.sql` table `save_backups`), NET-MATCHMAKING (L11) | oui — différés de données/design (F-BUILDEFF.7+, câblages CAP/F-SKILLS, Scène, M-VISIT, caravanes, Graal par faction, marché, NET-FOG, AS-OVERLAYS) |
| `game-review-2026-09b.md` | V/E/M livrés (PR #550) | oui — M10–M14, M19 (décisions) + idées §3.1/§3.2 |
| `code-review-2026-09.md` | R1→R10 livrés (PR #547) | oui — « hors périmètre » (CallReinforcements, poison vs bouclier, IA vs villes à garnison, héros visiteur en siège, deps majeures) |
| `code-review-2026-08.md` | 7 lots livrés | oui — poison persistant (même décision que ci-dessus) |
| `post-review-followups.md` | A/B/C livrés | oui — snapshot par match, icône PWA *maskable* (absente de `data/manifest.webmanifest`), `map:gen` CLI ≠ options client |
| `l8-content-finitions.md` | livré | oui — slot d'artefact *trophée* (bump save) |
| `reliquats-differes.md` | §1 **épuisé** (tas de ressources ×9, Sylvan, 9 fonds de combat, rempart livrés) ; §4 2 niceties écartées ; §5 roadmap | oui — §4 reporté tel quel (arbitrage conservé) |
| `merged-branches-cleanup.md` (+ `.branches.txt`) | analyse close | oui — la suppression des branches attend l'utilisateur |
| `llm-asset-generation-plants.md` | livré (étape 3 non cochée alors que l'étape 4 la prouve) | non |
| `missing-features-2026-08.md` | L1→L11 livrés (suivi L10 périmé, corrigé) | non |
| `l4`, `l5`, `l6`, `l7`, `l9`, `l10`, `l10-5`, `l11`, `underground-tiles-and-ux`, `reliquats-traitement`, `close-open-plans` | livrés, 100 % cochés | non |

## Vérification

- [x] `ls .claude/plans/*.md` ne garde que `close-open-plans-2026-09.md` et
      `game-experience-enrichment.md`
- [x] aucune référence cassée : aucun doc, skill ou `CLAUDE.md` ne pointe vers un
      plan déplacé (`grep` sur `CLAUDE.md`, `docs/`, `.claude/skills`, `.claude/prompts`)
- [x] aucune collision de nom dans `archive/`
- Pas de smoke : lot **purement documentaire** (plans + définitions d'agents),
  zéro diff de code/données (guidelines §7, dernier point).

## Décisions

- **Un seul registre vivant** : le plan d'enrichissement porte les reliquats (§1)
  *et* le chantier qui les absorbe — deux fichiers vivants plutôt que trois.
- Les décisions de design (M10–M14, M19, poison, mana) ne sont **pas** tranchées
  ici : elles sont soumises au binôme game designer / expert HoMM, puis à
  l'utilisateur.

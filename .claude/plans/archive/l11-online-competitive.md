# Lot L11 — en ligne compétitif : appariement, copie N-1, décision NET-FOG

> Lot 11 du plan `.claude/plans/missing-features-2026-08.md` (**G2.c/G2.d**).
> Serveur + SDK + panneau « En ligne » ; **zéro diff moteur**.

## 1. Constats

| # | Manque | État |
|---|---|---|
| a | **NET-MATCHMAKING** : aucun appariement — lister puis rejoindre à la main était le seul chemin | livré ici |
| b | **NET-SRVGUARD.2** : pas de copie N-1 des sauvegardes cloud (« évolution de schéma D1 » invoquée pour le report) | livré ici |
| c | **NET-FOG** : information ouverte entre participants | **décision tranchée**, cf. §3 |

## 2. Ce qui est livré

1. **`POST /matchmaking`** : prend le siège libre de la partie **ouverte la plus
   ancienne créée par quelqu'un d'autre** (jamais la sienne, jamais une où l'on
   siège déjà) ; sans candidate, répond `matched: false` — le client crée alors
   une partie, qui devient la candidate du joueur suivant. Un seul aller-retour,
   aucune file d'attente à maintenir côté serveur.
2. **Copie de sécurité N-1** : table `save_backups` (une ligne par slot). Avant
   **tout** écrasement d'un slot, la version en place y est recopiée ;
   **`POST /saves/:slot/restore`** la remet en jeu. Filet contre l'autosave
   malheureux (partie perdue, état corrompu côté client). Table **nouvelle** ⇒
   `CREATE TABLE IF NOT EXISTS` idempotent, aucune migration de données.
3. **Client** : bouton « Partie rapide » du lobby, bouton « Restaurer » par slot
   cloud, 6 clés de locale FR/EN.

## 3. Décision NET-FOG (le point qui attendait un arbitrage)

**Statu quo assumé et documenté** : en PvP **asynchrone**, l'information reste
ouverte **entre participants** — le journal de commandes est rejouable, donc
tout siège peut reconstruire l'état complet, brouillard compris.

- Ce qui a été fermé (lot L1) : la lecture du journal par un **tiers**
  (403 hors participants). L'espionnage *hors partie* n'existe plus.
- Ce qui reste ouvert : entre adversaires d'une même partie.
- Pourquoi ne pas aller plus loin : une vue filtrée exigerait de **re-simuler
  côté serveur par joueur** et de servir un état projeté au lieu du journal —
  autrement dit de renoncer au levier déterministe qui rend ce backend tenable
  à coût nul (doc 15 §1). Le rapport coût/bénéfice ne se justifie **que** pour
  une beta compétitive classée ; l'Elo actuel est amical.
- **Condition de réouverture** notée dans doc 15 : le jour où le classement
  devient enjeu (récompenses, saisons officielles).

## 4. Vérification

Pas de harness Worker (limite connue, cf. NET-SEC.1/.2 et lot L1) ⇒ vérification
par typecheck serveur + client, relecture, et pipeline complet côté jeu.

- [x] `pnpm typecheck` (5 projets) · `pnpm lint`
- [x] tests moteur / contenu / client
- [x] parité FR/EN (0 écart) · `content:check`
- [x] build + budget bundle · smoke `@core`
- [x] golden inchangé (aucun fichier moteur touché)

## 5. Journal

- **2026-08-31 — livré**. L'appariement est volontairement **sans file** : une
  file d'attente demanderait un état vivant (expiration, reprise, doublons) là
  où « prendre le siège libre le plus ancien » suffit à faire se rencontrer deux
  joueurs. La restauration ne consomme pas la copie (restaurer deux fois donne
  le même résultat) — plus prévisible qu'un échange qui alternerait les versions.

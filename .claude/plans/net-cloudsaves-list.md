# Lot — NET-CLOUDSAVES.2 : liste des sauvegardes cloud + horodatage

> Décision utilisateur « go next » → NET-CLOUDSAVES (2026-07-16). **Audit** :
> le cœur « cloud saves câblées » est **déjà livré** (backlog ⬜ périmé) —
> `pushCloudSave`/`pullCloudSave` (`app/save.ts`) appelés depuis `OptionsPanel`
> (slot `manual`, gaté `isOnline()+isLoggedIn()`, toasts, garde de version).
> **Reste du spec** (doc 15 §5.2) : « **liste de slots, upload/download,
> horodatage** ». C'est le périmètre de ce lot.

## Manque exact

- Serveur : `PUT/GET /saves/:slot` existent ; **pas** de `GET /saves` (liste).
- SDK `app/net.ts` : `putSave`/`getSave` ; **pas** de `listSaves()`.
- Client : boutons push/pull mono-slot ; **pas** de liste ni d'horodatage visible.

## Périmètre (serveur + client, ZÉRO moteur)

1. **Serveur** `server/src/worker.ts` : `GET /saves` (sans slot) → `{ saves:
   [{ slot, save_version, updated_at }] }` du profil authentifié, triés
   `updated_at DESC` (sans le blob `state` — requête légère). Miroir des helpers
   `authProfile`/`json`/`fail` existants. GET déjà autorisé CORS.
2. **SDK** `app/net.ts` : `listSaves(): Promise<{ slot; save_version; updated_at }[]>`.
3. **Client** `OnlinePanel.tsx` (section connectée) : liste « Sauvegardes cloud »
   — au montage (si connecté) `listSaves()` ; par ligne : libellé de slot i18n +
   date formatée + `v<version>` + bouton **Charger** (`pullCloudSave(slot)` →
   toast, ferme le panneau) ; bouton **Téléverser la partie en cours**
   (`pushCloudSave` → `manual`, rafraîchit la liste) ; état vide ; erreurs.
4. **i18n** core fr/en : `online.saves.*` (titre, vide, charger, téléverser,
   date, version, libellés de slot `auto`/`manual`).
5. **Backlog** `game-feature-gaps.md` : NET-CLOUDSAVES ⬜ → ✅ (cœur déjà livré +
   liste/horodatage ce lot).
6. **Doc 15 §5.2** : documenter `GET /saves` (liste) — invariant #4.

## Vérification

- typecheck (couvre `server` + `client`), lint, build, bundle < 800 Ko, smoke
  (**régression** du chemin hors-ligne : `OnlinePanel` cloud-list n'est pas monté
  en CI, `VITE_BACKEND_URL` absente ⇒ le chemin en ligne n'est pas couvert par le
  smoke — **noté explicitement**, guideline §7).
- Revue manuelle du chemin en ligne (pas de backend de test en CI ; pas de
  harnais unitaire client/serveur — aucun test auto ajouté, dit franchement).

## Garde-fous

- **Zéro moteur, zéro donnée de faction** : garde-fous faction/couleurs non
  concernés ; pas de bump `CURRENT_SAVE_VERSION` (le serveur reste
  version-agnostique) ; golden inchangé.
- Additif derrière le gate `isOnline()+isLoggedIn()` ⇒ chemin hors-ligne
  (couvert par le smoke) inchangé.
- Simplicité (guideline §2) : pas de suppression de slot, pas de renommage, pas
  de multi-upload — on livre le spec (liste + horodatage + charger/téléverser).

## Statut : LIVRÉ

Pipeline vert : typecheck (server+client), lint, garde-fou couleurs (status 1),
garde-fou faction (status 1), content:check, build, bundle 322 828 o < 819 200,
smoke @core 22/22 (chemin hors-ligne — le chemin en ligne n'est pas monté en CI,
noté). Zéro moteur, pas de bump save, golden inchangé.

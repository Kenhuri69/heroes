# E14 — Journal de combat : filtre & copie

Item **client-only** restant du plan `game-ergonomics-immersion-review.md`
(constat E14, « journal de combat sans filtres ni copie/export »). Zéro moteur,
zéro donnée, pas de bump save, golden inchangé.

## Choix de périmètre (évite la « plomberie disproportionnée »)

Le plan flaggait E14 comme *plomberie disproportionnée* : tagger chaque
événement d'une catégorie pour filtrer par type serait lourd (touche
`combat-log.ts` pour tous les types d'events). On livre à la place la version
**basse-plomberie** et réellement utile, **sans toucher `CombatLogLine`
(`{id,text}`) ni `combat-log.ts`** :

- **Filtre texte** : un champ de recherche filtre les lignes affichées par
  sous-chaîne (insensible à la casse) — retrouver « Squelette » / « catapulte »
  dans un long journal.
- **Copie/export** : un bouton copie les lignes **visibles** (filtrées) dans le
  presse-papier (`navigator.clipboard`) — utile pour un rapport de bug ou
  revoir un combat. Toast de confirmation / d'échec (contexte non sécurisé).

## Changements

- **`CombatLog.tsx`** : état local `query` ; en-tête `combat-log-tools` (input de
  filtre `role="searchbox"` + bouton Copier) ; liste filtrée ; message « aucun
  résultat » distinct de « journal vide ». Copie via `navigator.clipboard` gardée
  (try/catch → toast). → verify: filtre réduit la liste ; copier ⇒ toast.
- Locales FR/EN : `combatLog.filterPlaceholder`, `combatLog.copy`,
  `combatLog.copied`, `combatLog.copyFailed`, `combatLog.noMatch`.
- CSS `combat.css` : `.combat-log-tools` + input/bouton (tokens uniquement,
  cible ≥ 44px sur le bouton).

## Vérification

- [ ] typecheck / lint verts
- [ ] client + content vitest verts (parité locale)
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core desktop + mobile
- [ ] golden inchangé (aucun fichier moteur touché)

## Différé

Filtre **par catégorie** d'événement (attaques / sorts / morts) — nécessiterait
de tagger chaque event, plomberie disproportionnée pour la valeur ; le filtre
texte couvre le besoin courant.

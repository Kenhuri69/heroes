# Tir par-dessus les obstacles + obstacles visibles (retour de jeu)

## Contexte

Suite du retour « les arbalétriers n'avaient aucune attaque à distance possible »
(capture du champ de bataille fournie). Après vérification, la cause n'était PAS
un bug de tir mais la règle **C-LOS** : un obstacle sur la ligne tireur→cible
**bloquait le tir** (mêlée forcée). Chaque combat tirant 2–5 obstacles au centre,
un tireur à gauche visant un ennemi à droite avait souvent la ligne coupée ⇒
« aucun tir possible ». Divergence par rapport à HoMM (les tireurs tirent
par-dessus les obstacles). Aggravé par un problème d'**UX** : les obstacles
étaient rendus en brun translucide + fines hachures ⇒ **invisibles**, donc le
joueur ne comprenait pas pourquoi le tir était bloqué.

Décision utilisateur : (1) tir par-dessus les obstacles (fidélité HoMM) ; (2)
rendre les obstacles clairement visibles.

## Changements

### A — Moteur : le tir ignore les obstacles (murs de siège exceptés)
- Nouveau helper `sightBlockedKeys(combat)` = **murs de siège seuls** (vs
  `staticBlockedKeys` = obstacles + murs, gardé pour le déplacement/téléportation).
- `hasLineOfSight` consomme `sightBlockedKeys` ⇒ les obstacles ne coupent plus la
  ligne de vue ; seul un rempart de siège l'arrête (on tire par la porte).
- Doc 02 §5.2/§5.4 + commentaires (`actions.ts`, `ai.ts`, `types.ts`) alignés.
- Forme de sauvegarde inchangée ⇒ **pas de bump save**. Golden **inchangé**
  (la séquence golden n'a pas de tir bloqué par obstacle).

### B — Client : obstacles rendus comme des ROCHERS visibles
- `hexgrid.ts` : fond d'obstacle plus opaque (α 0.34 → 0.7) + `drawBoulder()`
  déterministe (ombre + corps de pierre + facette éclairée) à la place des
  hachures. Purement visuel, aucun RNG.

## Vérifications
- [x] typecheck (5 packages), lint
- [x] `combat-los.test.ts` réécrit (obstacle ⇒ tir OK ; mur de siège ⇒ tir bloqué),
      `town-siege.test.ts` vert
- [x] suite moteur complète : 802 tests verts, **golden inchangé**, property
      « combat se termine » verte
- [x] build client OK, budget bundle < 800 Ko gzip
- [x] captures arène (seeds 42/7/13) : rochers clairement visibles
- [ ] smoke Playwright complet (desktop + mobile)
- [ ] commit + push (branche repartie de main post-merge #375) + nouvelle PR draft

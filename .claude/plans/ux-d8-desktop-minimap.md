# Plan — UXD-8 : mini-map desktop

> Dernier lot du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Traite
> le constat §1.5 : « la mini-map n'existe pas du tout » ; desktop sous-exploité.
> Tranche livrée : la **mini-map** (pièce phare). Le layout complet en colonne
> droite (ressources/portraits/villes empilés) reste un raffinement noté.

## Étapes

- [x] `ui/MiniMap.tsx` : `<canvas>` 1 px/tuile (CSS `pixelated`) rendant le
      terrain **exploré** (`player.explored`, brouillard = sombre) + pastilles
      héros/villes (couleur de joueur, la présence de la pastille est le 2ᵉ
      canal A5). Redessin au changement d'état (abonné store), coût par-frame
      nul. **Clic → `panCameraTo(tx, ty, 300)`** (recentre la caméra d'aventure).
- [x] CSS `.mini-map` **desktop only** (`@media min-width: 900px`), ancrée en
      bas à droite au-dessus de la barre d'actions ; masquée en mobile (suivi :
      mini-map dans le tiroir mobile, doc 08 §2.1).
- [x] Montée dans `shell.tsx` pendant l'aventure (hors combat).
- [x] Vérif : capture desktop (mini-map + zone explorée + marqueurs) ; clic
      recentre la caméra (0 erreur) ; smokes verts ; anti-gel.

## Vérification (2026-07-07)

- Capture desktop : mini-map 180×180 en bas à droite — zone explorée verte,
  brouillard sombre, pastilles héros/ville (rouge joueur, gris neutre). Clic
  (75 %,25 %) → la caméra pane vers la zone visée (0 erreur console).
- Smokes **102 verts + 2 skipped** ; anti-gel carte 8,3 / arène 12,8 fps
  (plancher ≥ 5) ; typecheck/lint/build verts ; garde-fou couleurs intact.

## Hors périmètre (suivis notés)

- **Layout desktop en colonne droite** (ressources/portraits/villes empilés à
  droite façon doc 08 §2.1) : rework des blocs `fixed` du HUD — plus invasif,
  gain moindre que la mini-map elle-même. Suivi dédié.
- **Mini-map dans le tiroir mobile** (aujourd'hui desktop only).

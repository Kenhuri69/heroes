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

- **Mini-map dans le tiroir mobile** (aujourd'hui desktop only) : ✅ **livrée**
  (`.claude/plans/ux-minimap-mobile.md`).

## Décision de clôture (2026-07-09)

- **UXD-8 clos comme livré.** Constat en relisant le CSS : le **tiroir héros
  persistant** EST déjà le rail droit desktop (`@media min-width:900px` →
  `.hero-drawer { right:0; width:300px; transform:none }`, `.resource-bar` /
  `.bottom-hud { right:300px }`). Il porte portraits (`HeroStrip`), mini-map et
  détails héros ⇒ **doc 08 §2.1 réalisé**.
- Le « layout colonne droite complet » (déplacer **ressources** et **villes**
  DANS le rail) est **volontairement non retenu** : la barre de ressources en
  haut est un choix M5 assumé, la liste de villes en barre d'actions un choix
  U4 ; les y déplacer casserait des surfaces testées (`resource-open-*`,
  `town-open-*`) pour un gain ergonomique discutable (le plan maître le notait
  déjà « plus invasif, gain moindre »). Décision utilisateur du 2026-07-09.

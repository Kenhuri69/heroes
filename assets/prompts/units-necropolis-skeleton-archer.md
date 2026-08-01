# Planche — Squelette archer (T1 élite, image unique)

> Rédigée à la main. Reprise **DÉDIÉE** d'un seul sprite : l'élite T1 de la
> Nécropole est passée de « Squelette guerrier » (mêlée, à la lame) à
> **« Squelette archer »** (`shooter(4)`, doc 04 §3bis) — le PNG en place montre
> encore une lame et ne représente plus l'unité. Les 7 autres cellules de
> `units-necropolis-p1.md` sont déjà validées : **ne pas relancer la planche
> entière** pour un seul sujet.
> Règle **A** de `docs/12-assets-style-guide.md` (sprite 512², painterly, alpha
> strict après extraction), palette Nécropole. Image unique ≥ 1024×1024 px.

## Prompt (image unique — Gemini / Nano Banana, Copilot en repli)

```
A single tier-1 undead skeleton archer, fantasy army unit,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic, MTG illustration quality),
painterly brush strokes, 3/4 view, soft directional light from upper-left,
an animated skeleton warrior drawing a crude bow of bone and sinew, arrow nocked and aimed slightly off-camera,
a short half-empty quiver of bone arrows strapped to its back (only a few arrows left),
scraps of rusted mail and tattered grave cloth hanging from the ribcage, cracked yellowed bones,
faint necrotic green glow in the empty eye sockets, thin wisps of spectral mist at its feet,
army visual identity: bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist,
weak and expendable — NOT an armoured champion, NOT a lich or a mage, no staff, no sword, no shield,
subject centered with generous empty margin all around — the drawn bow, arrow and quiver must NOT be cropped or touch any edge,
ONE flat uniform light grey background (#c8c8c8) — NO panel, frame or rectangle behind the subject,
no ground shadow, no text, no watermark, no signature, no border frame, no ground line,
no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <image.png> \
  --cols 1 --rows 1 --side 512 \
  --ids t1-squelette-elite \
  --out assets/raster_src --qc /tmp/qc-skeleton-archer.png
```

Regarder `/tmp/qc-skeleton-archer.png` : cadre **vert = PASS** (arc et flèche
entiers, aucune extrémité rognée), **rouge = FAIL** ⇒ meilleure image ou
`--tol` / `--inset` ajustés, puis relancer.

> Repli si le fond revient chargé (dégradé, panneau) : `python3
> tools/assets/process_sprite.py --src <image.png> --id t1-squelette-elite
> --dest assets/units/necropolis --model u2net --dry-run` (sujet **opaque** ⇒
> `u2net` suffit, `birefnet` inutile ici), vérifier
> `/tmp/t1-squelette-elite_check.png` puis relancer sans `--dry-run`.

Puis copier le PNG validé :

```bash
cp assets/raster_src/t1-squelette-elite.png assets/units/necropolis/
```

Le nom de fichier est **inchangé** (l'id de l'unité est resté
`t1-squelette-elite`) ⇒ le registre d'assets du client le reprend sans aucune
modification de code (doc 12 §10.2).

## ✅ Généré et intégré

Planche source retournée par Gemini : `_incoming/units-necropolis-skeleton-archer.png`.
Deux retouches déterministes avant extraction (le générateur ne respecte jamais
tout à fait la consigne) :

1. **glint IA** en bas à droite (un « sparkle » hors sujet, malgré le
   `no star glints`) repeint à la couleur du fond — sinon il survit comme
   composant parasite ;
2. **marge de fond ajoutée** (140 px sur les 4 côtés) : le sujet était cadré à
   16 px du haut (arc) et 19 px du bas (pieds), or `sheet_extract.py` **supprime
   tout composant qui touche le bord de cellule** (porte anti-bave) ⇒ sans
   marge, le sujet entier partait à la poubelle.

QC : **PASS** (marge réelle 0,10, couverture 12 %, 1 composant gardé — les 72
« specks » retirés sont les volutes de brume détachées, sous l'aire minimale).
→ `assets/units/necropolis/t1-squelette-elite.png` (512², 120 Ko).

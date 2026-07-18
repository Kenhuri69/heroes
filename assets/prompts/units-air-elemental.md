# Planche — élémentaire d'air (image unique) (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S**. Reprise DÉDIÉE de l'élémentaire d'air
> (le seul des 4 élémentaires non détourable : corps trop translucide sur panneau
> gris, `rembg` indisponible). Objectif : corps DENSE et OPAQUE lisible sur gris.
> Règle **A/S** de `docs/12-assets-style-guide.md`. Image unique ≥ 1024×1024 px.

## Prompt (image unique — Gemini / Nano Banana)

```
A single summoned air elemental creature, fantasy conjured spirit,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic, MTG illustration quality),
a humanoid vortex of swirling wind and dense storm-cloud with crackling lightning,
SOLID READABLE SILHOUETTE — the body is dense opaque cloud (mid-grey to white), NOT faint or wispy at the edges,
strong rim light, 3/4 dynamic pose, soft directional light from upper-left, no armour and no weapons,
subject centered with generous empty margin all around, nothing cropped,
ONE flat uniform light grey background (#c8c8c8) — NO panel, frame or rectangle behind the subject,
no ground shadow, no text, no watermark, no signature, no border frame, no ground line, no lens flare
```

## Extraction au retour (fond chargé translucide → rembg birefnet)

```bash
python3 tools/assets/process_sprite.py --src <img> --id elementaire-d-air \
  --dest assets/units/core --model birefnet --dry-run
# vérifier /tmp/elementaire-d-air_check.png (voile conservé, silhouette pleine) puis sans --dry-run
```
> Repli si `rembg` indisponible (proxy) : `sheet_extract.py <img> --cols 1 --rows 1
> --side 512 --tol 50 --ids elementaire-d-air` (fond gris plat) — marche SI le corps
> reste opaque (d'où la consigne « dense » ci-dessus). → `assets/units/core/elementaire-d-air.png`.

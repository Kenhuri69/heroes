# Plan — Audit de fonctionnalités vs Might & Magic: Heroes Online

Session **purement documentaire** (demande utilisateur) : revue complète des
fonctionnalités du jeu, identification des manques par rapport à la version
navigateur d'origine (*Might & Magic: Heroes Online*, Ubisoft Blue Byte,
2014–2020) — manques moteur **et** manques de profondeur des mécaniques
présentes (exemple fondateur : gradation visuelle de la taille des gardiens,
« quelques-uns » → « horde », avec proposition côté assets) — puis plan de
comblement organisé par étapes.

## Étapes

- [x] Inventaire exhaustif de l'existant (moteur `packages/engine`, client
      `packages/client`, données `data/`, assets `assets/`) → vérif : rapport
      par système avec fichiers sources.
- [x] Recherche de référence MMHO (Wikipedia, Fandom, mmos.com, Celestial
      Heavens, Kongregate/MMORPG.com) → vérif : sources citées au §5 du doc.
- [x] Rédaction `docs/18-audit-fonctionnalites-vs-heroes-online.md` :
      synthèse de l'existant, fiches d'écart priorisées (P1/P2/P3, nature
      moteur/données/client/assets), section dédiée gardiens (§3, paliers
      d'assets 0/1/2), plan de comblement en 5 étapes (dont étape 5 =
      décisions de cadrage réservées à l'utilisateur), non-écarts explicités.
- [x] Mise à jour `CLAUDE.md` (structure des fichiers : doc 18).
- [ ] Commit + push `claude/game-features-audit-2asmdy` + PR draft.

## Décisions prises

- Les divergences délibérées (MMO temps réel, monétisation premium) restent
  hors périmètre — rappelées en §0 et §2.G du doc pour clore les questions.
- La fourchette **textuelle** de force des gardiens est déjà livrée (doc 02
  §2.2) : l'écart réel est **visuel** (jeton unique quel que soit l'effectif)
  ⇒ proposition client+assets zéro-moteur (§3).
- Créatures 1 hex et modèle de compétences HoMM : recommandés comme
  **divergences assumées** (MMHO était lui-même mono-hex), à acter en doc 02.

## Vérification (guideline §7)

Changement purement documentaire : smoke omis (justification prévue par la
règle) ; aucun code touché.

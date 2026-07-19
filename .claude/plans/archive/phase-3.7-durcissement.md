# Plan — Phase 3.7 : Durcissement du MVP

Post-jalon MVP (choix utilisateur). Pas de nouvelle feature : **corriger les
dettes connues** et **couvrir des angles morts** du vertical slice. Petit
incrément mené directement par la session principale (pas de lots Sonnet).

## Items

- [x] Item 1 — fix nom de faction (data-only + template `faction:new` + test régression contenu).
- [x] Item 2 — round-trip save/load d'un état de scénario (test moteur `serialize`).
- [x] Item 3 — polissage : root cause du bug 1 couverte jusqu'au scaffolder ; aucune autre dette UX/i18n concrète repérée à corriger (audit i18n déjà vert au lot V).

1. **Bug — résolution de nom de faction** (repéré au lot V, 3.6) : les 4
   manifestes utilisent la **même** clé `@loc:faction.name` ; `resolveLoc`
   (client) fusionne les locales de tous les paquets → `faction.name` résout
   au nom du **dernier paquet chargé**. Latent (aucun affichage aujourd'hui)
   mais à corriger avant qu'une UI n'affiche un nom de faction.
   - **Correctif data-only** : clé **unique par faction** dans chaque
     manifeste (`@loc:faction.<id>.name`) + la clé correspondante dans la
     locale du paquet (haven/necropolis/arcane-hunters/test-faction).
   - **Test de régression** (contenu) : en fusionnant toutes les locales de
     paquets (comme le client), chaque faction résout **son propre** nom ;
     aucune collision de clé de nom entre paquets.
2. **Angle mort — sauvegarde/chargement avec les nouveaux champs d'état**
   (3.4/3.5 : `factionId`, `factionCatalog`, `scenario`, `outcome`,
   `controller`, `eliminated`) : le round-trip de save n'est testé qu'en
   partie libre. Ajouter une couverture d'un **état de scénario** (2 joueurs,
   objectifs, controller ai) : `serialize → deserialize → hashState` stable,
   champs préservés.
3. **Polissage** : petits correctifs UX/i18n repérés au passage (au cas par
   cas, surgical).

## Vérification

Complète : typecheck, lint, tests moteur + contenu, `content:check`, smoke
desktop+mobile, garde-fou. Golden **inchangé** (aucune modif de forme d'état).

## Écarts

- « Chasse aux bugs » exhaustive et durcissement PvP/réseau = Alpha. Ce lot
  cible les dettes concrètes identifiées, pas une revue tous azimuts.

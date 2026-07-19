# Lot M-CALENDAR — Semaine du savoir (heroXpGrant)

## Objectif
Champ generique optionnel CalendarEventDef.heroXpGrant { amount } : au passage
de semaine, chaque heros (tous joueurs) gagne amount XP. Miroir de resourceGrant
cote progression. Reutilise grantXp.

## Cout
Champ OPTIONNEL sur CalendarEventDef ⇒ pas de bump save. Config golden inline
sans calendar ⇒ golden inchange. Zero faction, deterministe. Pas de faction:sim.

## Etapes
1. config.ts heroXpGrant. 2. schemas.ts Zod. 3. events.ts CalendarXpGranted.
4. engine.ts grantXp + event. 5. client toast. 6. locales FR/EN.
7. config.json event learning (+500 XP). 8. doc 02 §2.3. 9. calendar.test.ts.

## Journal
- branche claude/m-calendar-xp depuis origin/main. Implemente.

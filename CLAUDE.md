# Kranich Kaffee App

Static PWA for Kranich Kaffee customers. No build step, no dependencies.
Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Changing promotions (the owner asks Claude to do this)

The app reads `Aktionen.md` live on every open. Keep this exact format, or entries
may not show or not expire:

```
## Titel der Aktion

- Rabattcode: CODE           (optional, adds a "Kopieren" button)
- Gilt bis: TT.MM.JJJJ       (optional, hidden the day after)
- Datum: Wochentag, TT.MM.JJJJ, HH:MM bis HH:MM   (optional, adds "In den Kalender", hidden the day after)
- Ort: Adresse               (optional, goes into the calendar entry)
- Anmeldung: per Mail an name@example.de   (optional, adds "Per Mail anmelden")
- Text: Ein bis zwei kurze Sätze.
```

- Always write the year with 4 digits. Without a date an entry shows forever.
- Follow the Kranich styleguide (`Kranich-Styleguide.pdf`): "du", max one "!", max 20
  words per sentence, no banned words, never em dashes.
- After changing it, run `node test.mjs` and check the app shows the change.

## Saving

When the owner says "save to GitHub" (or "Speicher auf GitHub"): commit all changes
with a short, clear message and push to `kranich-kaffee-app` on GitHub.

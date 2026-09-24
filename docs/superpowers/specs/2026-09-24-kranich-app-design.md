# Kranich Kaffee App: Entwurf

Stand: 24.09.2026. Freigegeben im Gespräch, Schritt für Schritt.

## Ziel

Eine kleine App für die Kundschaft von Kranich Kaffee. Sie liegt als Icon auf dem
Handy und geht ohne Browserleiste auf. Sie zeigt die aktuellen Aktionen und Termine
(das Wichtigste) und die drei Kaffees. Die Inhaberin oder der Inhaber ändert Aktionen
später, indem sie Claude darum bittet. Claude ändert dann `Aktionen.md` und speichert
auf GitHub. Alle, die die App haben, sehen die Änderung beim nächsten Öffnen.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Sprache der App | nur Deutsch, Kundschaft wird geduzt |
| Wer ändert Aktionen | Claude, auf Bitte der Inhaberin oder des Inhabers |
| Abgelaufene Aktionen | verschwinden automatisch |
| Aussehen | Design C "kleines Wochenblatt" |
| Technik | Progressive Web App (PWA), liest `Aktionen.md` und `Sortiment.md` bei jedem Öffnen |

Nicht drin (bewusst weggelassen): Datenbank, Logins, Zweisprachigkeit, Bestellen,
Push-Nachrichten, Zusatzprogramme oder Build-Schritt.

## Was die Kundschaft sieht

1. **Kopf:** brauner Streifen (Röstbraun `#6B4A2F`), Kranich-Icon, "Kranich Kaffee ·
   Rothenburgsort", Überschrift "Diese Woche bei uns" (Fraunces, Papierweiß).
2. **Aktionen und Termine** in der Reihenfolge aus `Aktionen.md`. Jeder Eintrag hat:
   - ein kleines Etikett in Röstbraun: "Aktion · bis 11.10." (wenn ein Rabattcode da
     ist) oder "Termin · Sa, 03.10." (wenn ein Datum da ist),
   - den Titel aus der `##`-Überschrift (Fraunces),
   - den Text aus der Zeile `Text:`,
   - die passenden Knöpfe (siehe unten).
   Einträge sind durch feine Linien getrennt, nicht durch Kästen.
3. **Unser Kaffee:** alle Kaffees aus `Sortiment.md` mit Name, Art, Herkunft,
   "geröstet am TT.MM.JJJJ", Preis und dem Beschreibungstext.
4. **Fuß:** Adresse "Kranich Kaffee, Billwerder Neuer Deich 40, 20539
   Hamburg-Rothenburgsort".

Läuft keine Aktion und kein Termin: "Gerade keine Aktionen. Schau bald wieder rein."

### Knöpfe zum Antippen

- **Kopieren** (bei `Rabattcode`): kopiert den Code in die Zwischenablage. Der Knopf
  zeigt 2 Sekunden lang "Kopiert". Kranichrot, der einzige rote Akzent.
- **In den Kalender** (bei `Datum`): erzeugt eine Kalenderdatei (`.ics`) mit Titel,
  Datum, Uhrzeit von bis (sonst ganztägig), Ort und Text. Das Handy öffnet damit
  seinen eigenen Kalender. Uhrzeiten gelten als Ortszeit des Handys.
- **Per Mail anmelden** (wenn `Anmeldung` eine Mailadresse enthält): öffnet eine neue
  Mail an diese Adresse, Betreff "Anmeldung: <Titel>".

### Wann etwas verschwindet

- Mit `Gilt bis: TT.MM.JJJJ`: sichtbar bis einschließlich diesem Tag.
- Mit `Datum: ... TT.MM.JJJJ ...`: sichtbar bis einschließlich diesem Tag.
- Ohne beides: immer sichtbar.

## Dateiformat (das liest die App)

Beide Dateien bleiben, wie sie sind. Regeln:

- Jeder Eintrag beginnt mit `## Titel`.
- Felder sind Zeilen `- Name: Wert`. Eingerückte Folgezeilen gehören zum Wert davor.
- Text vor dem ersten `##` wird ignoriert (Einleitung).
- In `Sortiment.md` zählt ein Eintrag nur als Kaffee, wenn er `Preis` hat. Der freie
  Absatz nach den Feldern ist die Beschreibung. Alles ab `---` wird ignoriert.
- Datum wird aus dem ersten `TT.MM.JJJJ` im Wert gelesen, Uhrzeiten aus `HH:MM` (erste
  = Beginn, zweite = Ende).

Wenn Claude später Aktionen einträgt, hält es sich an genau dieses Format.

## Aufbau (Dateien)

| Datei | Aufgabe |
|---|---|
| `index.html` | die Seite, Aussehen (Farben, Schriften Fraunces und Inter von Google Fonts) |
| `parse.js` | liest die zwei `.md`-Dateien, erkennt Felder, Daten, Uhrzeiten, Ablauf |
| `app.js` | holt die Dateien, baut die Seite, Knöpfe, Kalenderdatei |
| `manifest.webmanifest` | Name "Kranich Kaffee", Icons `icon-192.png` / `icon-512.png`, `display: standalone`, Farben |
| `sw.js` | Service Worker: immer zuerst Internet, gespeicherte Kopie nur ohne Netz |
| `netlify.toml` | sagt allen Handys: nichts auf Vorrat speichern (`Cache-Control: no-cache`) |
| `test.mjs` | kleiner Test für `parse.js`, läuft mit `node test.mjs` |

## Updates kommen immer an

1. `app.js` holt die `.md`-Dateien mit `cache: "no-store"`.
2. `sw.js` fragt bei jeder Anfrage zuerst das Netz. Klappt das, speichert es die Antwort
   als Notfallkopie. Nur ohne Netz liefert es die Kopie.
3. `netlify.toml` setzt `Cache-Control: no-cache` für alle Dateien, auch für `sw.js`.
   So prüft das Handy jedes Mal, ob es etwas Neues gibt.
4. Kommt die App aus dem Hintergrund zurück (`visibilitychange`), lädt sie die Inhalte
   neu.

## Fehlerfälle

- Kein Internet und keine Notfallkopie: freundlicher Hinweis "Gerade keine Verbindung.
  Versuch es gleich noch mal."
- Ein Eintrag ohne erkennbares Datum: wird gezeigt, aber ohne Kalender-Knopf.
- Zwischenablage nicht erlaubt: der Code bleibt sichtbar und markierbar.

## Prüfen

1. `node test.mjs`: 3 Kaffees und 3 Aktionen erkannt, HERBST10 verschwindet nach dem
   11.10.2026, Cupping hat 03.10.2026 11:00 bis 12:30, Kalenderdatei stimmt.
2. App lokal im Browser in Handygröße: Design C, alle Inhalte, Knöpfe angetippt.
3. Update-Test: Aktion probeweise ändern, neu laden, Änderung ist sofort da, zurückändern.
4. Später auf echten Handys (Schritt 8 und 9): Icon, ohne Browserleiste, Kalender-Knopf
   auf iPhone und Android, neue Aktion kommt nach einem Push an.

## Offenes Risiko

Kalenderdateien verhalten sich in installierten Web-Apps auf dem iPhone manchmal
anders als im Browser. Das prüfen wir in Schritt 8 auf einem echten iPhone. Wenn es
dort hakt, ist der Ersatz ein Link zum Google Kalender.

## Styleguide-Regeln, die gelten

Farben Nachtblau `#1F2A44` (Text), Kranichrot `#C8412D` (nur Akzente, max. 10 %),
Papierweiß `#F6F1E7` (Hintergrund), Röstbraun `#6B4A2F` (Flächen). Nie reines Schwarz,
keine Verläufe. Überschriften nie in Großbuchstaben. Höchstens ein "!" pro Text,
Sätze höchstens 20 Wörter, keine verbotenen Wörter (Premium, Genuss pur, einzigartig,
Geheimtipp, Barista-Qualität, Kaffeeliebhaber aufgepasst).

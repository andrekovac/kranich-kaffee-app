# Kranich Kaffee: eine App fürs Handy / An app for the phone

Fiktive Demo-Daten. Kranich Kaffee ist eine fiktive Rösterei in Hamburg-Rothenburgsort.
/ Fictional demo data. Kranich Kaffee is a fictional roastery in Hamburg-Rothenburgsort.

**Die Idee / The idea:** Kranich Kaffee will eine kleine App für die Kundschaft: das
Sortiment, die aktuellen **Aktionen und Termine**, und etwas zum Antippen. Die App liegt
als **Icon auf dem Handy**, und wenn die Rösterei eine neue Aktion einträgt, sehen alle,
die die App haben, die Änderung. Ganz ohne Datenbank.
/ A small app for customers: the coffees, current promotions and events, something to
tap. It sits as an icon on the phone, and when the roastery adds a promotion, everyone
who installed it sees the change. No database.

André zeigt das einmal vor (Schritt 6), danach baust du deine eigene App im Ordner
`Eigene-Website/`. Du kannst die Kranich-App aber auch selbst nachbauen.
/ André demos this once (step 6), then you build your own in `Eigene-Website/`.

## Was drin ist / What's inside

- `Kranich-Styleguide.pdf`: Farben, Schriften, Ton und Logo-Regeln
- `Sortiment.md`: drei Kaffees mit Name, Herkunft, Röstdatum und Preis
- `Aktionen.md`: die aktuellen Aktionen und Termine, **die Datei, die du später selbst änderst**
- `icon-512.png`, `icon-192.png`: das Kranich-Icon
- dieses README

Die Prompts sind auf Englisch, du kannst sie genauso gut auf Deutsch tippen.
/ Prompts are in English, typing them in German works just as well.

---

## Vorab / Before you start

- 🐙 Ein **GitHub-Account** (kostenlos, github.com). / A GitHub account.
- 🌐 Dein **Netlify-Account** von Dienstag, **mit GitHub verknüpft** (bei Netlify mit
  GitHub anmelden). / Your Netlify account from Tuesday, linked to GitHub.
- 📱 Dein Handy in Reichweite. / Your phone nearby.

---

## Schritt 5: Superpowers installieren / Install Superpowers

**Superpowers** ist ein Plugin, also ein Paket von Skills, das jemand anderes gebaut hat.
Es bringt Claude bei, erst Fragen zu stellen, Entwürfe zu zeigen und einen Plan zu
machen, bevor es baut. / A plugin (a bundle of skills someone else built) that makes
Claude ask, show drafts and plan before it builds.

1. Öffne die Claude-Desktop-App, geh in den Bereich **Code** und starte eine **neue
   Session**. Wähle als Ordner `Kranich-Website` aus. / Open the Code area, start a new
   session, pick the `Kranich-Website` folder.
2. Erster Prompt, damit Claude prüft, ob dein Mac bereit ist: / First prompt:

   > Check whether git and Node.js are installed on this Mac. Just tell me what you
   > find, don't install anything yet.

3. Installiere das Plugin mit zwei Befehlen, die du ins Eingabefeld tippst (Anleitung:
   github.com/obra/superpowers#claude-code). / Install the plugin by typing these into
   the prompt box:

   ```
   /plugin marketplace add obra/superpowers-marketplace
   ```
   ```
   /plugin install superpowers@superpowers-marketplace
   ```

   Falls das nicht klappt: / If that fails:
   `/plugin install superpowers@claude-plugins-official`

4. Starte danach eine **neue Session** im selben Ordner, damit die Skills geladen sind.
   / Then start a new session in the same folder.

👀 **Achte darauf / Watch for:** Unter **+** → **Plugins** steht jetzt Superpowers.

---

## Schritt 6: Die App bauen / Build the app

Du musst nichts über Webentwicklung wissen. Beschreib, was du willst, und lass dich
führen. / You don't need to know web development. Describe what you want and let
Claude guide you.

> I run Kranich Kaffee, a small coffee roastery in Hamburg. Everything about us is in
> this folder. I don't know much about web development.
>
> I'd like a small app for my customers that they can put on their phone's home
> screen, like a real app with our icon. It should show our coffees and, most
> importantly, our current promotions and events, with something they can tap, for
> example copying a discount code or adding an event to their calendar.
>
> I want to change the promotions myself later without touching any code, and
> everyone who has the app should then see the change. No database, no logins.
> Build it so updates always reach people who already installed the app, don't let
> an old version get stuck on their phones.
>
> Please guide me step by step: ask me one question at a time, show me design
> options before you build anything, and explain in plain words what you're doing.

Dann: Fragen beantworten, Entwürfe anschauen, entscheiden. Wenn Claude anbietet, dir
Entwürfe im Browser zu zeigen, sag ja. / Answer the questions, look at the drafts,
decide. If Claude offers to show drafts in the browser, say yes.

👀 **Achte darauf / Watch for:**

- Liest Claude den **Styleguide** (`Kranich-Styleguide.pdf`)? Wenn nicht: „Use our
  Kranich styleguide PDF."
- Schlägt Claude von selbst eine **Progressive Web App (PWA)** vor? Das ist der
  Fachbegriff für „Website, die sich wie eine App aufs Handy legen lässt".
- **Wo landen die Aktionen?** Gut ist eine eigene Datei, die du ohne Code-Kenntnisse
  änderst, zum Beispiel `Aktionen.md` oder eine Datei, die Claude daraus macht.
- Superpowers macht nach den Fragen einen **Plan**. Lies ihn, bevor du „go" sagst.

✅ **Fertig, wenn / Done when:** du die App im Browser auf deinem Mac siehst, mit den drei
Kaffees, den Aktionen und etwas zum Antippen, in den Kranich-Farben.

---

## Schritt 7: Speichern mit Git und GitHub / Save with git and GitHub

Git ist ein Speicherpunkt-System: jeder Speicherpunkt (**Commit**) hat eine Nachricht,
was sich geändert hat. GitHub ist der Ort im Netz, wo diese Speicherpunkte liegen.
Claude macht die ganze Technik. Du klickst nur „Installieren", falls der Mac fragt, und
fügst einmal einen Code im Browser ein.
/ Git makes save points (commits). GitHub keeps them online. Claude does the plumbing;
you only click "Install" if macOS asks and paste one code into the browser.

⚠️ Claude Code fragt dabei oft „Allow this command?". Beim Einrichten ist Ja richtig.
Lies trotzdem kurz mit. / Expect many permission prompts; saying yes during setup is fine.

**7a. Einmal pro Rechner einrichten / One-time setup per computer**
(Sei vorher im Browser bei GitHub angemeldet. / Be logged into GitHub in your browser.)

```
I'm not technical and this is my first time using GitHub on this computer. Please set everything up so you can push my projects to GitHub. Go step by step and explain each step to me in one simple sentence.

1. Check if git is installed. If it isn't, tell me exactly what to click to install it (on a Mac, a popup asking to install the Command Line Tools may appear).
2. Check if the GitHub CLI (gh) is installed. If not, install it WITHOUT Homebrew and without needing an admin password: download the official release for my operating system and processor from github.com/cli/cli, put the gh program in a folder inside my home directory, and add that folder to my PATH so it keeps working in new terminal windows.
3. Log me in with: gh auth login --hostname github.com --git-protocol https --web
   Show me the one-time code clearly and tell me to paste it into the browser page that opens. Do NOT use SSH keys or personal access tokens.
4. Run: gh auth setup-git (so normal git pushes use this login).
5. If git doesn't know my name and email yet, ask me for my name and set both globally. For the email, use my private GitHub noreply address (you can build it from gh api user) so my real email stays private.
6. Finish with gh auth status and tell me in one sentence whether everything worked.

If any step needs me to type something myself in a separate Terminal window, tell me exactly what to paste.
```

**7b. Dieses Projekt auf GitHub bringen / Put this project on GitHub**

```
Turn this folder into a GitHub project. First create a sensible .gitignore so no secrets (like .env files or API keys) and no junk folders (like node_modules) get uploaded. Then make a first commit, create a new PUBLIC repository on my GitHub account called kranich-kaffee-app, and push everything. Also add a note to CLAUDE.md: when I say "save to GitHub", commit all changes with a short, clear message and push. At the end, give me the link to the repository.
```

Öffentlich, damit die anderen in Schritt 9 deine Commit-Historie sehen können. Deine App
hat keine Geheimnisse, sie ist ja sowieso gleich live im Netz.
/ Public so others can see your commit history in step 9. Your app has no secrets.

**7c. Ab jetzt / From now on**

```
Save to GitHub.
```

👀 **Achte darauf / Watch for:** Hat Claude dir den Code für den Browser deutlich
gezeigt? Hängt der Login, sagt Claude dir, was du in ein normales Terminal-Fenster
einfügen sollst.

🧯 **Falls es hakt / If it gets stuck**

- **Der Login hängt** (Claude wartet und nichts passiert): sag „The login seems stuck.
  Tell me exactly what to paste into a normal Terminal window." Dann Terminal öffnen
  (Cmd + Leertaste, „Terminal"), einfügen, Enter. / Login hangs: ask Claude what to
  paste into a normal Terminal window.
- **Der Mac will die „Command Line Tools" installieren:** auf **Installieren** klicken
  und warten, das kann ein paar Minuten dauern. / Click Install and wait a few minutes.
- **Firmen-Laptop blockt heruntergeladene Programme:** dann hilft kein Prompt. Nimm
  **GitHub Desktop** (desktop.github.com), falls du es installieren darfst, oder
  arbeite neben jemandem mit, dessen Rechner geht. / Locked-down work laptop: use
  GitHub Desktop if allowed, or pair up with someone.
- **Viele „Allow this command?"-Fragen:** beim Einrichten normal. Nur Nein sagen, wenn
  Claude etwas außerhalb von GitHub-Einrichtung oder deinem Projektordner tun will.
  / Many permission prompts are normal during setup.

✅ **Fertig, wenn / Done when:** du dein Repository auf github.com siehst, mit deinen
Dateien und mindestens einem Commit.

---

## Schritt 8: Live stellen und aufs Handy / Go live and onto your phone

Am Dienstag hast du eine Datei per Drag and Drop zu Netlify gezogen. Heute verbindest du
Netlify mit GitHub: jeder neue Speicherpunkt, den du hochlädst (**Push**), geht dann
automatisch live. Das wird dein **zweites Netlify-Projekt**.
/ Tuesday was drag and drop. Today Netlify is connected to GitHub, so every push goes
live automatically. This becomes your second Netlify project.

> Connect this GitHub repository to Netlify so every push updates the live site. My
> Netlify account is already linked to GitHub. Guide me through it; the clicks in the
> browser I'll do myself.

Wenn die Seite live ist: / Once it's live:

> I want this app as an icon on my phone. Walk me through the steps.

👀 **Achte darauf / Watch for:** Fragt Claude, ob du ein **iPhone oder Android** hast?
Die Wege sind verschieden:

- **iPhone:** die Adresse in Safari öffnen → Teilen-Symbol → **Zum Home-Bildschirm**
- **Android:** die Adresse in Chrome öffnen → Menü ⋮ → **App installieren** (oder
  **Zum Startbildschirm hinzufügen**)

✅ **Fertig, wenn / Done when:** das Kranich-Icon auf deinem Home-Bildschirm liegt und
die App ohne Browserleiste aufgeht.

---

## Schritt 9: Teilen, Gruppenübung / Sharing, group exercise

1. Eine Person teilt ihre Netlify-Adresse im Chat. Alle anderen legen sich diese App
   aufs Handy. / One person shares their Netlify address, everyone installs that app.
2. Diese Person trägt eine neue Aktion ein: / That person adds a new promotion:

   > Add a new promotion to our promotions: [deine Aktion, z. B. ein Termin oder ein
   > Rabatt]. Then save to GitHub.

3. Ein, zwei Minuten warten, dann bei allen: App schließen, neu öffnen. Ist die neue
   Aktion da? / Wait a minute or two, close and reopen the app. Is it there?
4. Zusammen auf GitHub die **Commit-Historie** anschauen: jeder Speicherpunkt mit
   Nachricht, Datum, und was sich geändert hat. / Look at the commit history on GitHub
   together.

👀 **Achte darauf / Watch for:** Zeigt die App auf dem Handy noch die **alte Version**?
Dann hat die App zu viel zwischengespeichert. Sag Claude:

> On my phone the app still shows the old version after the update. Please fix it so
> new promotions always show up, and explain what the problem was.

---

## Schritt 10: Zwei Dinge gleichzeitig, das passende Modell / Two things at once, the right model

Wie am Mittwoch in Cowork: zwei unabhängige Aufgaben, zwei **Sub-Agents**. Neu heute:
Claude wählt für jede Aufgabe das passende Modell.
/ Like Wednesday: two independent jobs, two sub-agents. New today: a model per job.

> Do two things at the same time, each in its own sub-agent, and pick the most
> suitable model for each:
>
> 1. Give the app a fresher, more modern look, a new theme that still follows our
>    styleguide.
> 2. Add a short brewing tip for each of our three coffees.
>
> Before you start, tell me which model you chose for which job and why. When both
> are done, show me the result, then save to GitHub.

👀 **Achte darauf / Watch for:** Welches Modell nimmt Claude fürs Design, welches für
den Text? Überzeugt dich die Begründung? Und: Siehst du das Update gleich auch auf
dem Handy?

---

## Was du prüfen kannst / Checklist

- [ ] Superpowers ist installiert, Claude hat Fragen gestellt und Entwürfe gezeigt
- [ ] Der Kranich-Styleguide wurde genutzt: Farben, Schriften, Ton
- [ ] Alle drei Kaffees aus `Sortiment.md`, alle Aktionen aus `Aktionen.md`
- [ ] Etwas zum Antippen funktioniert (Code kopieren, Termin in den Kalender, …)
- [ ] Die Aktionen liegen in einer Datei, die du ohne Code-Kenntnisse ändern kannst
- [ ] Das Projekt liegt auf GitHub, mit Commits, die du verstehst
- [ ] Netlify ist mit GitHub verbunden, ein Push geht automatisch live
- [ ] Das Kranich-Icon liegt auf deinem Handy
- [ ] Eine neue Aktion kam nach einem Push auf dem Handy an

## Tipps / Tips

- Wenn Claude Code um Erlaubnis fragt (Datei ändern, Befehl ausführen), lies kurz,
  was es tun will, bevor du bestätigst. / Read permission prompts before approving.
- Du verstehst eine Frage von Claude nicht? Sag das genau so: „Das verstehe ich nicht,
  erklär es mir einfacher." / Don't understand a question? Say exactly that.
- Du musst dich nicht für alles entscheiden: „Entscheide du" reicht.
  / "You decide" is a fine answer.

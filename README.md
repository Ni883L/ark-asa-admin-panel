# ARK ASA Admin Panel

Produktionsnahe Web-Adminverwaltung für **ARK: Survival Ascended Dedicated Server** auf **Windows**.

> Ausführliche Architekturentscheidung: `docs/ARCHITEKTUR_ENTSCHEIDUNG_DE.md`

## Architekturentscheidung

### Gewählter Stack
- **Backend:** Node.js 20+ mit Express
- **Frontend:** serverseitig ausgelieferte statische HTML/CSS/JS-Dateien
- **Persistenz:** JSON-Dateien im lokalen Datenverzeichnis
- **Prozess- und Systemintegration:** PowerShell-Skripte auf Windows
- **Sitzungen/Auth:** Express-Session + sichere Passwort-Hashes per Node `crypto.scrypt`
- **Backups:** PowerShell `Compress-Archive` / `Expand-Archive`
- **Updates:** Git-basiertes Self-Update für das Adminpanel, SteamCMD-basierte ASA-Updates

### Warum dieser Stack?
- **Einfach wartbar:** kein schweres Frontend-Framework nötig
- **Windows-tauglich:** PowerShell ist für Dienste, Prozesse, Reboots, Archive und Pfade ideal
- **Wenige Abhängigkeiten:** nur Express, dotenv und express-session
- **Sicherheitsfreundlich:** Eingaben können strikt validiert, Prozesse kontrolliert und sensible Daten lokal gehalten werden
- **Gut erweiterbar:** RCON, Discord-Webhook, mehrere Instanzen und HTTPS lassen sich sauber ergänzen

## Funktionsumfang

### Bereits umgesetzt
- Einrichtungsassistent / Bootstrap-Endpunkte
- Lokales Login mit Rollenmodell (`admin`, `readonly`)
- Passwort-Hashing, Session-Timeout, CSRF-Token
- Fail2Ban-ähnliche Login-Sperrlogik
- Dashboard mit Status, Ressourcen, Logs, Backups und Spielern
- Start / Stop / Restart des Servers
- Windows-Neustart
- Startprofil- und Parameterverwaltung
- Bearbeitung von `GameUserSettings.ini`, `Game.ini`, optional `Engine.ini`
- Automatische Backups vor ASA-Updates
- Backup-Liste, Restore und Import-Unterstützung
- Self-Update des Panels mit Backup/Rollback-Vorbereitung
- SteamCMD-Install/Update-Skripte für ASA
- Monitoring für CPU, RAM, Datenträger, Ports, Laufzeit, Crashes
- Discord-Webhook-Benachrichtigungen (optional)
- Geplante Tasks als vorbereitete Struktur

### Technische Grenzen / dokumentierte Alternativen
- **Spielerliste:** primär über Log-Parsing und optionale RCON-Erweiterung. Falls ASA bestimmte Live-Daten nicht direkt anbietet, wird die letzte sinnvolle Information angezeigt.
- **Live-Konsole:** aktuell als Polling-Logansicht statt echter WebSocket-Konsole, um Abhängigkeiten gering zu halten.
- **Windows-Dienstbetrieb:** vorbereitet; Start als geplanter Task oder NSSM-/Service-Wrap empfohlen.

## Projektstruktur

```text
ark-asa-admin/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── scripts/
│   ├── install.ps1
│   ├── update.ps1
│   ├── update.bat
│   ├── steamcmd-install-or-update.ps1
│   ├── start-server.ps1
│   ├── stop-server.ps1
│   ├── restart-server.ps1
│   ├── reboot-host.ps1
│   ├── status.ps1
│   ├── backup-create.ps1
│   ├── backup-restore.ps1
│   └── panel-service-install.ps1
├── src/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── util/
│   └── server.js
├── tests/
├── INSTALL_ONELINER.txt
├── package.json
└── README.md
```

## Installation

### Schnellstart lokal
```powershell
cd ark-asa-admin
copy .env.example .env
npm install
npm start
```

### One-Click-Installation
**Empfohlener Oneliner (PowerShell als Administrator):**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((iwr 'https://raw.githubusercontent.com/Ni883L/ark-asa-admin-panel/main/scripts/install.ps1' -UseBasicParsing).Content))"
```

Alternative (Script lokal speichern und mit Parametern ausfuehren):
```powershell
iwr https://raw.githubusercontent.com/Ni883L/ark-asa-admin-panel/main/scripts/install.ps1 -OutFile .\install.ps1
.\install.ps1 -InstallPath 'C:\ark-asa-admin' -Branch 'main' -CreateStartupTask
```

Der gleiche Oneliner liegt auch in `INSTALL_ONELINER.txt`.


> Falls weiterhin die Meldung `Fehlende Abhaengigkeiten: Git, Node.js, npm` erscheint, laeuft sehr wahrscheinlich noch eine alte Installer-Version. Die aktuelle Version wird beim Start als `Installer-Version: ...` ausgegeben.

Hinweis: Das Install-Skript
- fragt vor der Installation, ob statt des Standardpfads `C:\ark-asa-admin` ein anderer Installationsort verwendet werden soll,
- uebernimmt den gewaehlten Installationspfad im kompletten Installationsablauf (Clone, Abhaengigkeiten, Startup-Task, Start-/URL-Hinweise),
- prueft vor der Installation den verfuegbaren Speicherplatz (mind. 2 GB frei),
- prueft `node` und `npm`, bietet bei fehlenden Abhaengigkeiten einen kurzen Dialog zur automatischen Installation per `winget` und startet den Installer bei Bedarf automatisch in einem neuen Terminal neu (kein manueller Terminal-Neustart noetig),
- nutzt Git, wenn vorhanden (schnelleres Sync/Update), kann bei Erstinstallation aber auch ohne Git ueber ZIP-Download installieren,
- installiert nur die produktiven Node-Abhaengigkeiten (`npm install --omit=dev`),
- kann beim Setup direkt einen dauerhaften Windows-Autostart-Task für das Panel registrieren und starten und
- bietet am Ende den direkten Start des Panels an (mit Erreichbarkeitscheck auf `127.0.0.1`) und
- gibt nach der Installation den Startbefehl sowie die Konfigurations-Website basierend auf `.env` aus (Schema/Host/Port aus `HTTPS_ENABLED`, `HOST`, `PORT`; erster Start ueber `/setup`).
- enthaelt einen Guard gegen reservierte PowerShell-Variablennamen (z. B. `Host`), damit entsprechende Script-Versionen fruehzeitig mit klarer Meldung abgebrochen werden.


### Troubleshooting: "127.0.0.1 hat die Verbindung verweigert"

1. Installer-Ausgabe pruefen, ob der Panel-Prozess gestartet wurde.
2. Falls nicht gestartet oder nicht erreichbar: manuell starten mit:
   ```powershell
   cd C:\ark-asa-admin
   npm start
   ```
3. HTTP/HTTPS pruefen: `HTTPS_ENABLED=1` => `https://...`, sonst `http://...`; dazu `HOST` und `PORT` in `.env` kontrollieren.
4. Fuer Remote-Zugriff in `.env` `HOST=0.0.0.0` setzen und Firewall-Port freigeben.

## One-Click-Installer
Der Installer klont das Repo, installiert Node-Abhängigkeiten, erstellt Verzeichnisse, erzeugt eine `.env` und kann optional einen Windows-Starttask anlegen. Bei Abschluss der Ersteinrichtung wird SteamCMD geprüft und bei Bedarf automatisch installiert.


### Update-Skript

Das Update-Skript (`scripts/update.ps1`) prueft vor dem Update ebenfalls den freien Speicherplatz (mind. 1 GB), erstellt ein minimales ZIP-Backup (nur fuer Rollback relevante Dateien/Ordner) und installiert danach nur produktive Abhaengigkeiten:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update.ps1 -InstallPath 'C:\ark-asa-admin' -Branch 'main'
```

Alternativ (ohne Execution-Policy-Fehler):
```powershell
.\scripts\update.bat -InstallPath 'C:\ark-asa-admin' -Branch 'main'
```

Minimal-Backup-Inhalt: `.env`, `.env.example`, `package.json`, `package-lock.json`, `public/`, `src/`, `scripts/`, `runtime/data/`.

Hinweis: Wenn `git` oder der `.git`-Ordner fehlt, faellt `update.ps1` automatisch auf ZIP-Download vom Repository zurueck.

Wenn `update.ps1` oder `panel-service-install.ps1` aus dem Installationsordner aufgerufen werden, wird dieser Pfad standardmaessig automatisch verwendet (kein fester Hardcode auf `C:\...`).

Falls `panel-autostart.ps1 -Mode Enable` mit `Zugriff verweigert` scheitert, starte stattdessen eine Admin-PowerShell über:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\panel-autostart.ps1 -Mode ElevateEnable -InstallPath 'C:\ark-asa-admin'
```

## Update-Strategie

### Adminpanel
- Vor Update wird ein minimales Panel-Backup erstellt
- `git fetch` + `git pull` (oder ZIP-Fallback, falls Git fehlt)
- `npm install --omit=dev --no-audit --no-fund`
- nach Panel-Update wird der Webdienst/Task kontrolliert neu gestartet und der Port auf Erreichbarkeit geprüft
- bei Fehlern kann auf das letzte Backup zurückgerollt werden

### ASA-Server
- vor Update automatisch Backup
- SteamCMD-Update ausführen (SteamCMD wird bei fehlender Datei automatisch heruntergeladen)
- vor jeder ASA-Aktualisierung wird automatisch ein Backup erstellt
- Update-Check über UI (Button `ASA-Update prüfen`), optionales Auto-Update bei `autoAsaUpdate=true` in den Einstellungen
- Ergebnis protokollieren
- optional geplanter Check per Windows Task Scheduler

### Geplante Aufgaben (integriert)
- Task-Typen: `backup`, `asa-update`, `panel-update`, `reboot-host`
- Zeitformat in `cronLike`:
  - `every:30m` (alle 30 Minuten)
  - `daily:04:30` (täglich 04:30)
- Runtime-Status inkl. `lastRunAt` / `nextRunAt`: `GET /api/tasks/runtime`
- Task sofort manuell ausführen: `POST /api/tasks/:id/run`

## Backup / Restore
- Komprimierte ZIP-Backups
- Sicherung von Savegames, Configs, Clusterdaten und optional Logs
- Restore des kompletten Backups oder einzelner Bereiche
- Import externer ZIP-Backups
- Backup-Validierung vor Restore
- Restore akzeptiert nur valide ZIP-Dateinamen aus dem Backup-Ordner
- Restore und andere kritische Aktionen verlangen zusätzlich eine Passwortbestätigung im Webpanel

## Sicherheit
- Login mit Passwort-Hashing
- Rollenmodell
- Session-Timeout
- CSRF-Token für Schreibzugriffe
- Rate-Limit / Sperrlogik für fehlgeschlagene Logins
- Passwort-Re-Bestätigung für kritische Aktionen (z. B. Stop/Restart/Update/Restore/Reboot)
- optionale Whitelist für lokale/vertrauenswürdige IPs (`LOGIN_WHITELIST_LOCAL`, `LOGIN_WHITELIST_IPS`)
- Runtime-Warnungen bei unsicheren Betriebsmodi (z. B. Default-Secret, Remote-Zugriff ohne HTTPS)
- Audit-Log für sensible Aktionen
- restriktive Default-Header (CSP, X-Frame-Options, etc.)
- keine Klartextpasswörter in Logs

## Beispielkonfigurationen

### Einzelserver lokal
```env
ASA_SERVER_ROOT=C:\ARK\ASA
ASA_SERVER_EXE=C:\ARK\ASA\ShooterGame\Binaries\Win64\ArkAscendedServer.exe
ASA_LOG_PATH=C:\ARK\ASA\ShooterGame\Saved\Logs\ShooterGame.log
ASA_CONFIG_DIR=C:\ARK\ASA\ShooterGame\Saved\Config\WindowsServer
LOGIN_WHITELIST_LOCAL=true
LOGIN_WHITELIST_IPS=192.168.1.10
```

### Remote-Zugriff per Reverse Proxy
- `HOST=127.0.0.1`
- Reverse Proxy mit TLS davor
- `TRUST_PROXY=1`
- starke Passwörter und IP-Einschränkungen setzen
- `TRUST_PROXY` nur aktivieren, wenn der Reverse Proxy tatsächlich vor der App sitzt

## Zukunft / Erweiterungen
- echte RCON-Webkonsole
- Multi-Instance-Verwaltung
- 2FA
- WebSocket-Logs
- Discord-Eventfilter
- geplante Neustarts / Backups über UI

## Wichtiger Hinweis
Diese Anwendung ist bewusst Windows-first umgesetzt. Linux-only-Abhängigkeiten werden für Kernfunktionen vermieden. Falls dein ASA-Setup von Standardpfaden oder Startmustern abweicht, passe die Profile und PowerShell-Skripte an.

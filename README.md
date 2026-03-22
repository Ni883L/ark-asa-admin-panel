# ARK ASA Admin Panel

Produktionsnahe Web-Adminverwaltung für **ARK: Survival Ascended Dedicated Server** auf **Windows**.

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
Siehe `INSTALL_ONELINER.txt`.

## One-Click-Installer
Der Installer klont das Repo, installiert Node-Abhängigkeiten, erstellt Verzeichnisse, erzeugt eine `.env` und kann optional einen Windows-Starttask anlegen.

## Update-Strategie

### Adminpanel
- Vor Update wird ein Panel-Backup erstellt
- `git fetch` + `git pull`
- `npm install`
- bei Fehlern kann auf das letzte Backup zurückgerollt werden

### ASA-Server
- vor Update automatisch Backup
- SteamCMD-Update ausführen
- Ergebnis protokollieren
- optional geplanter Check per Windows Task Scheduler

## Backup / Restore
- Komprimierte ZIP-Backups
- Sicherung von Savegames, Configs, Clusterdaten und optional Logs
- Restore des kompletten Backups oder einzelner Bereiche
- Import externer ZIP-Backups
- Backup-Validierung vor Restore

## Sicherheit
- Login mit Passwort-Hashing
- Rollenmodell
- Session-Timeout
- CSRF-Token für Schreibzugriffe
- Rate-Limit / Sperrlogik für fehlgeschlagene Logins
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
```

### Remote-Zugriff per Reverse Proxy
- `HOST=127.0.0.1`
- Reverse Proxy mit TLS davor
- `TRUST_PROXY=1`
- starke Passwörter und IP-Einschränkungen setzen

## Zukunft / Erweiterungen
- echte RCON-Webkonsole
- Multi-Instance-Verwaltung
- 2FA
- WebSocket-Logs
- Discord-Eventfilter
- geplante Neustarts / Backups über UI

## Wichtiger Hinweis
Diese Anwendung ist bewusst Windows-first umgesetzt. Linux-only-Abhängigkeiten werden für Kernfunktionen vermieden. Falls dein ASA-Setup von Standardpfaden oder Startmustern abweicht, passe die Profile und PowerShell-Skripte an.

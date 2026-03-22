# ARK ASA Admin Panel

Webbasierte Admin-Verwaltung für **ARK: Survival Ascended (ASA)** auf **Windows**.

Ziel: Eine lokale Website, die **direkt auf dem Windows-System mit dem ARK-ASA-Server** läuft und typische Admin-Aufgaben über Browser + PowerShell ermöglicht.

## Features

### MVP
- Serverstatus anzeigen
- ARK-Server starten / stoppen / neu starten
- **Windows-System neu starten**
- Logdatei lesen
- Wichtige Konfiguration anzeigen
- `GameUserSettings.ini` lesen
- Platzhalter für RCON-Befehle

### Später
- Spielerliste
- Whitelist / Banlist
- Backup-Management
- Mod-Verwaltung
- Live-Konsole
- Benutzer- und Rollenmodell

## Architektur

- **Backend:** Node.js + Express
- **Frontend:** statische HTML/CSS/JS-Seite
- **Systemzugriff:** PowerShell-Skripte
- **Betrieb:** direkt lokal auf Windows

## Sicherheitsmodell

- Standardmäßig nur lokal erreichbar (`127.0.0.1`)
- Admin-Zugangsdaten nur serverseitig
- Kritische Aktionen wie Host-Reboot mit zusätzlicher Bestätigung im UI
- Für Produktion empfohlen: Reverse Proxy / Windows-Firewall / Auth-Härtung

## Voraussetzungen

- Windows Server oder Windows Desktop mit ARK ASA
- Node.js 20+
- PowerShell 5.1+ oder PowerShell 7+
- Optional: ASA als Windows-Dienst oder angepasstes Startskript

## Schnellstart

```powershell
cd ark-asa-admin
copy .env.example .env
npm install
npm run dev
```

Danach im Browser öffnen:

```text
http://127.0.0.1:3000
```

## Install-Oneliner

Sobald das GitHub-Repo existiert, kannst du einen echten Oneliner wie diesen verwenden:

```powershell
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/REPLACE_ME/ark-asa-admin-panel/main/scripts/install.ps1 -UseBasicParsing | iex"
```

Die Platzhalter müssen nach dem GitHub-Repo-Erstellen ersetzt werden.

## Update-Skript

Für spätere Updates ist enthalten:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update.ps1
```

## Konfiguration

Beispielwerte in `.env`:

```env
PORT=3000
HOST=127.0.0.1
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ARK_SERVER_NAME=ASA Server
ARK_SERVER_PATH=C:\ARK\ASA
ARK_SERVER_SERVICE_NAME=ArkAscendedServer
ARK_SERVER_EXE=C:\ARK\ASA\ShooterGame\Binaries\Win64\ArkAscendedServer.exe
ARK_START_COMMAND=powershell -ExecutionPolicy Bypass -File .\scripts\custom-start.ps1
ARK_LOG_PATH=C:\ARK\ASA\ShooterGame\Saved\Logs\ShooterGame.log
RCON_HOST=127.0.0.1
RCON_PORT=27020
RCON_PASSWORD=change-me
```

## Steuerungsmodell

Das Projekt unterstützt zwei Varianten:

1. **Windows-Dienst vorhanden**
   - Start/Stop/Restart über `Get-Service`, `Start-Service`, `Stop-Service`, `Restart-Service`

2. **Kein Dienst vorhanden**
   - Fallback über ein konfigurierbares Startkommando (`ARK_START_COMMAND`)
   - Stop/Restart müssen ggf. an dein Setup angepasst werden

## Projektstruktur

```text
ark-asa-admin/
├── public/
├── scripts/
│   └── *.ps1
├── src/
│   ├── routes/
│   └── services/
└── package.json
```

## Wichtige Hinweise

- Die PowerShell-Skripte sind absichtlich konservativ und als Basis gedacht.
- Gerade **Start/Stop** hängen stark davon ab, wie dein ASA-Server aktuell betrieben wird.
- Für echte Produktion würde ich als Nächstes ergänzen:
  - Authentifizierung mit Session-Login
  - RCON-Integration
  - Backup-Funktion
  - Konfigurationseditor
  - Windows-Service-Installer oder NSSM-Setup

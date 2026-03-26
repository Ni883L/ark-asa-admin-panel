# Architekturentscheidung (Windows-first) – ARK ASA Admin Panel

## 1) Zielbild
Eine **einfache, stabile und sichere** Webverwaltung für einen privaten/kleinen ASA-Server unter Windows.  
Der Fokus liegt auf:
- geringer Betriebs-Komplexität,
- robusten Standardwerten,
- klaren Sicherheitsgrenzen,
- guter Wartbarkeit mit wenig Abhängigkeiten.

## 2) Technologieempfehlung
- **Runtime/Backend:** Node.js LTS + Express
- **Frontend:** statische HTML/CSS/JS (ohne schweres SPA-Framework)
- **Systemintegration:** PowerShell-Skripte als klar getrennte Ausführungsschicht
- **Persistenz:** JSON-Dateien unter `runtime/data` (für private/kleine Server ausreichend)
- **Scheduling:** Windows Task Scheduler (planbare Jobs)
- **Optionale Prozessdienste:** Geplante Tasks oder NSSM/Windows-Service-Wrapper

## 3) Warum dieser Stack?
- **Windows-Kompatibilität:** PowerShell ist nativ und robust für Prozesse, Reboots, Dateisystem und SteamCMD.
- **Sicherheit & Wartbarkeit:** API-Schicht validiert, Skripte bleiben klein und auditierbar.
- **Wenig Abhängigkeiten:** reduziert Angriffsfläche und Update-Aufwand.
- **Betriebsfreundlich:** lokale Installation ohne komplexe Datenbank-/Container-Infrastruktur.

## 4) Projektstruktur
```text
src/
  config/        # Umgebungs-/Defaultkonfiguration
  middleware/    # Sicherheits- und Session-Middleware
  routes/        # API-/Auth-Endpunkte
  services/      # Fachlogik (ASA, Backup, Monitoring, Auth, Versionen, ...)
  util/          # Hilfsfunktionen/Validierung
scripts/         # Windows-Operations (Install, Update, Backup, Reboot, Start/Stop)
public/          # UI (Dashboard, Aktionen, Formulare)
tests/           # Unit-Tests für kritische Logik
runtime/         # Laufzeitdaten (logs, backups, temp, data)
docs/            # Architektur- und Betriebsdokumente
```

## 5) Umsetzungsstatus zu den Anforderungen
- **Install/Setup:** One-click-Installer + Setup-Wizard + Pfad-Erkennung vorhanden.
- **Adminpanel-Update:** Script-basiert; Backup vor Update; Rollback-Pfad über Panel-Backups.
- **ASA-Install/Update:** SteamCMD-Script, inklusive Auto-Backup vor Update.
- **Profile/Startparameter:** Profile, Validierung, Raw-Commandline, Start/Stop/Restart.
- **Config-Verwaltung:** INI lesen/schreiben + Validierung + Backup beim Überschreiben.
- **Backup/Restore:** create/list/import/restore + Restore-Modi + Validierung vor Restore.
- **Monitoring:** Status, CPU/RAM/Disk, Portchecks, Logs.
- **Spieler:** Log-basierte Spieleranzeige.
- **Sicherheit:** Login, Hashing, Rollen, Session, CSRF, Lockout/F2B-ähnlich, Audit.
- **Windows-spezifisch:** PowerShell-first, Pfadlogik und Reboot-Funktionen.

## 6) Sicherheitsentscheidungen
- Standardmäßig lokaler Betrieb (`127.0.0.1`), Remote nur bewusst aktivieren.
- Keine Klartextpasswörter in Logs.
- Kritische Aktionen (Reboot/Update/Restore) nur mit Adminrolle + Bestätigung.
- Login-Blocklisten mit optionaler Whitelist (inkl. lokale Netze).
- Eingabevalidierung für Pfade, Ports, Profilnamen und kritische Parameter.

## 7) Update- und Rollback-Strategie
### Panel
1. Backup des Panels erstellen.
2. `git fetch` + `checkout/pull` Zielbranch.
3. `npm install`.
4. Fehlerfall: Rollback auf letztes Panel-Backup.

### ASA
1. Auto-Backup vor Update.
2. SteamCMD-Update.
3. Ergebnis/Ausnahme im Audit-Log.
4. Optional geplanter Update-Check via Scheduler.

## 8) Backup-Strategie
- ZIP-Backups mit Zeitstempel + Typ.
- Inhalt: SavedArks, Config, Cluster (falls gesetzt), optional Log.
- Retention-Regeln (Anzahl).
- Restore-Varianten: full/save/config/cluster.
- Vor Restore: strukturelle Backup-Validierung.

## 9) Fail2Ban-ähnliche Sperrlogik
- Fehlversuche pro IP in Sliding Window.
- Ab Schwellwert temporäre Sperre.
- Whitelist für lokale Adressen/konfigurierbare IPs.
- Login-Auditing für Nachvollziehbarkeit.

## 10) Erweiterungen (empfohlen)
- RCON-Live-Konsole mit strikter Rollenprüfung.
- Multi-Instance-Management (mehrere ASA-Server parallel).
- TOTP-2FA.
- HTTPS-Termination via Reverse Proxy (Caddy/NGINX/Traefik).
- optionale SQLite-Persistenz für größere Installationen.

# Realtest-Checkliste für echten ASA-Server

## Vor dem ersten echten Test
- Vollständiges Backup des bestehenden ASA-Servers erstellen
- Prüfen, dass `ASA_SERVER_ROOT`, `ASA_SERVER_EXE`, `ASA_CONFIG_DIR`, `ASA_LOG_PATH`, `ASA_SAVEDARKS_PATH` korrekt gesetzt sind
- Test zuerst **lokal** im Browser durchführen
- Standardpasswort sofort ändern
- Falls möglich: zuerst auf Kopie/Testinstanz testen

## Reihenfolge für den sicheren Test
1. Login prüfen
2. Wizard / Servererkennung prüfen
3. Dashboard laden
4. Config nur lesen
5. Manuelles Backup auslösen
6. Backup-Datei kontrollieren
7. Status erneut prüfen
8. Erst dann Stop / Start / Restart testen
9. Danach Logs prüfen
10. Erst ganz am Ende Update-/Restore-Funktionen testen

## Vor Restore
- Sicherstellen, dass Server gestoppt ist
- Prüfen, welches Backup zurückgespielt wird
- Wenn möglich Kopie des aktuellen Zustands sichern

## Vor Update
- Backup vorhanden?
- SteamCMD-Pfad korrekt?
- Genug freier Speicher vorhanden?
- Kein aktiver Spieler auf dem Server?

## Nach jedem kritischen Test
- Logs prüfen
- Savegames prüfen
- Config-Dateien prüfen
- Serverstart im Spiel kontrollieren

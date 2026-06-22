# Auf der Uhlenhorst — Backend

Das Fundament der Plattform: Datenbank-Struktur, Registrierung, Login mit Rollen
(Anwohner / Geschäftsinhaber / Admin) und das Geschäftsverzeichnis mit Freigabe-Workflow.

## Was ist enthalten?

- `db/schema.sql` — die komplette Datenbank-Struktur (Nutzer, Geschäfte, Termine, Forum, Shop)
- `src/server.js` — der Hauptserver
- `src/routes.auth.js` — Registrierung & Login
- `src/routes.businesses.js` — Geschäfte eintragen, anzeigen, vom Admin freigeben
- `src/auth.js` — Passwort-Verschlüsselung & Login-Token
- `src/middleware.js` — Schutz von Routen ("nur eingeloggt", "nur Admin")
- `src/db.js` — Datenbankverbindung

## Lokal zum Testen einrichten

**1. PostgreSQL installieren** (falls noch nicht vorhanden)
Auf dem Mac z.B. mit `brew install postgresql`, unter Windows den Installer von postgresql.org.

**2. Datenbank anlegen**
```
createdb uhlenhorst
psql uhlenhorst -f db/schema.sql
```

**3. Umgebungsvariablen einrichten**
Die Datei `.env.example` zu `.env` kopieren und die Werte eintragen (Datenbank-Passwort,
geheimer Schlüssel für Logins).

**4. Abhängigkeiten installieren & Server starten**
```
npm install
node src/server.js
```
Der Server läuft dann unter `http://localhost:3000`.

## Den ersten Admin anlegen

Niemand kann sich selbst als Admin registrieren — das ist Absicht, damit niemand sich
einfach Admin-Rechte verschafft. Du legst dich selbst per Datenbank-Befehl an, nachdem
du dich einmal normal registriert hast:

```sql
UPDATE users SET role = 'admin' WHERE email = 'deine@email.de';
```

## Die wichtigsten Endpunkte zum Testen

| Methode | Pfad | Wofür |
|---|---|---|
| POST | `/api/auth/register` | Registrierung (E-Mail, Passwort, Name, Rolle) |
| POST | `/api/auth/login` | Login |
| GET | `/api/businesses` | Alle freigegebenen Geschäfte (öffentlich) |
| POST | `/api/businesses` | Geschäft eintragen (Login nötig) |
| GET | `/api/businesses/ausstehend` | Ausstehende Geschäfte (nur Admin) |
| PATCH | `/api/businesses/:id/status` | Geschäft freigeben/ablehnen (nur Admin) |

## Später live schalten

Für den richtigen Betrieb (nicht nur lokal) brauchst du einen Hosting-Anbieter, der
Node.js und PostgreSQL unterstützt — zum Beispiel Render, Railway oder ein eigener Server.
Das besprechen wir, wenn wir so weit sind.

## Nächste Schritte

Aufbauend auf diesem Fundament fehlen noch: Termine/Kalender, Forum, Shop mit
Zahlungsanbindung, und das Frontend, das mit diesem Backend spricht. Schritt für Schritt.

// Haupteinstiegspunkt des Backends — startet den Server und bindet alle Routen ein
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes.auth');
const businessRoutes = require('./routes.businesses');
const eventsRoutes = require('./routes.events');
const forumRoutes = require('./routes.forum');
const shopRoutes = require('./routes.shop');
const uploadRoutes = require('./routes.upload');
const pageRoutes = require('./routes.page');

const app = express();
const PORT = process.env.PORT || 3000;

// Entwurfstext für "Unser Uhlenhorst" – beim ersten Start als Ausgangstext eingefügt.
// Kann danach jederzeit über die Admin-Seite überschrieben werden.
const DEFAULT_UHLENHORST_TEXT = `Auf der Uhlenhorst – nicht "in", sondern "auf" – das sagt man hier so, und wer einmal hier gewohnt hat, sagt es auch so weiter. Der Name kommt von den Eulen ("Uhlen"), die sich vor Jahrhunderten in einem abgelegenen Gehöft an der Alster niedergelassen hatten. Erstmals erwähnt wurde das Gebiet schon 1256, damals noch als sumpfige Wiesenlandschaft, in der sich kaum jemand wohlfühlte außer eben den Eulen.

Das änderte sich 1837, als drei Hamburger Kaufleute – August Abendroth, Carl Heine und Adolph Jencquel – das Schwemmland an der Alster kauften und mit der Erschließung begannen. Kanäle wurden gegraben, das Gelände aufgeschüttet, und nach der Absenkung des Alsterpegels infolge des Großen Brandes von 1842 konnte endlich dauerhaft gebaut werden. Aus Sumpfland wurde eines der gefragtesten Wohnviertel Hamburgs – mit prächtigen Stadtvillen, ruhigen Straßen am Wasser und einer Lage, die bis heute ihren Reiz nicht verloren hat.

1894 wurde die Uhlenhorst offiziell als Stadtteil nach Hamburg eingemeindet. Seitdem hat sich vieles verändert: Wo früher Kähne durch die Kanäle glitten, radeln heute Pendler zur Mundsburg. Wo Wiesen waren, stehen Jugendstilfassaden. Und doch ist etwas geblieben – der Blick über die Alster auf die Kirchtürme der Stadt, die Ruhe an der Schönen Aussicht, das Gefühl, mitten in Hamburg und doch ein Stück davon entfernt zu sein.

Heute ist die Uhlenhorst ein lebendiges Miteinander aus alteingesessenen Familien, Zugezogenen, kleinen Geschäften am Hofweg und der Papenhuder Straße, Vereinen wie der Ruder-Gesellschaft Hansa und dem Norddeutschen Regatta-Verein, und nicht zuletzt aus den Menschen, die sich in der Interessengemeinschaft "Auf der Uhlenhorst" für ihren Stadtteil engagieren. Diese Seite soll ein Ort sein, an dem wir zeigen, wie sich unser Viertel über die Jahre verändert hat – und woran wir uns gerne erinnern.`;

// Stellt sicher, dass neue Spalten existieren, ohne bestehende Daten zu beeinflussen.
// Sicher bei jedem Start ausführbar: ADD COLUMN IF NOT EXISTS überspringt vorhandene Spalten.
async function ensureSchema() {
  try {
    await pool.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS business_email TEXT,
      ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
    `);
    await pool.query(`
      ALTER TABLE forum_posts
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    // "Unser Uhlenhorst" – ein einziger bearbeitbarer Textblock (eine Zeile genügt, daher feste id=1)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uhlenhorst_page (
        id INTEGER PRIMARY KEY DEFAULT 1,
        body TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT single_row CHECK (id = 1)
      );
    `);
    await pool.query(`
      INSERT INTO uhlenhorst_page (id, body)
      VALUES (1, $1)
      ON CONFLICT (id) DO NOTHING;
    `, [DEFAULT_UHLENHORST_TEXT]);
    // Bilder zur Seite, optional als Vorher/Nachher-Paar über pair_group gruppiert
   
      CREATE TABLE IF NOT EXISTS uhlenhorst_page_images (
        id SERIAL PRIMARY KEY,
        image_url TEXT NOT NULL,
        caption TEXT,
        era TEXT,
        pair_group TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('Datenbankschema geprüft: alle Tabellen/Spalten sind vorhanden (businesses, forum_posts, events, uhlenhorst_page, uhlenhorst_page_images).');
  } catch (err) {
    console.error('Fehler beim Prüfen/Erweitern des Datenbankschemas:', err);
  }
}

app.use(cors());

// Wichtig: Die Stripe-Webhook-Route braucht die unveränderten "rohen" Daten,
// deshalb wird sie VOR express.json() eingebunden.
app.use('/api/shop/webhook/stripe', express.raw({ type: 'application/json' }));

app.use(express.json());  // verarbeitet JSON-Anfragen für alle anderen Routen

// Routen einbinden
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/page', pageRoutes);

// Einfacher Gesundheitscheck, um zu sehen ob der Server läuft
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auf der Uhlenhorst – Backend läuft.' });
});

app.listen(PORT, async () => {
  await ensureSchema();
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

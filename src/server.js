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

const app = express();
const PORT = process.env.PORT || 3000;

// Stellt sicher, dass neue Spalten existieren, ohne bestehende Daten zu beeinflussen.
// Sicher bei jedem Start ausführbar: ADD COLUMN IF NOT EXISTS überspringt vorhandene Spalten.
async function ensureSchema() {
  try {
    await pool.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS business_email TEXT,
      ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
    `);
    console.log('Datenbankschema geprüft: business_email und whatsapp_number sind vorhanden.');
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

// Einfacher Gesundheitscheck, um zu sehen ob der Server läuft
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auf der Uhlenhorst – Backend läuft.' });
});

app.listen(PORT, async () => {
  await ensureSchema();
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

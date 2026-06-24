// Haupteinstiegspunkt des Backends — startet den Server und bindet alle Routen ein

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes.auth');
const businessRoutes = require('./routes.businesses');
const eventsRoutes = require('./routes.events');
const forumRoutes = require('./routes.forum');
const shopRoutes = require('./routes.shop');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Einfacher Gesundheitscheck, um zu sehen ob der Server läuft
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auf der Uhlenhorst – Backend läuft.' });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

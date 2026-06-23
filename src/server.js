// Haupteinstiegspunkt des Backends — startet den Server und bindet alle Routen ein

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes.auth');
const businessRoutes = require('./routes.businesses');
const eventsRoutes = require('./routes.events');
const forumRoutes = require('./routes.forum');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());          // erlaubt Anfragen vom Frontend (andere Domain/Port)
app.use(express.json());  // verarbeitet JSON-Anfragen

// Routen einbinden
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/forum', forumRoutes);

// Einfacher Gesundheitscheck, um zu sehen ob der Server läuft
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auf der Uhlenhorst – Backend läuft.' });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

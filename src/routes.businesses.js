// Routen für das Geschäftsverzeichnis: Eintragen, Anzeigen, Freigeben durch Admin

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireLogin, requireRole } = require('./middleware');

// ---------- Öffentlich: alle freigegebenen Geschäfte anzeigen ----------
// Wird auf der Startseite und im Verzeichnis verwendet, alphabetisch sortiert
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, description, address, latitude, longitude, phone, website
       FROM businesses
       WHERE status = 'freigegeben'
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Geschäfte:', err);
    res.status(500).json({ error: 'Geschäfte konnten nicht geladen werden.' });
  }
});

// ---------- Eingeloggte Nutzer: eigenes Geschäft eintragen ----------
// Landet zunächst im Status "ausstehend" bis ein Admin es freigibt
router.post('/', requireLogin, async (req, res) => {
  const { name, category, description, address, latitude, longitude, phone, website } = req.body;

  if (!name || !category || !address) {
    return res.status(400).json({ error: 'Name, Kategorie und Adresse sind erforderlich.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO businesses (owner_id, name, category, description, address, latitude, longitude, phone, website, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ausstehend')
       RETURNING *`,
      [req.user.userId, name, category, description, address, latitude, longitude, phone, website]
    );
    res.status(201).json({
      message: 'Dein Geschäft wurde eingereicht und wird in Kürze geprüft.',
      business: result.rows[0],
    });
  } catch (err) {
    console.error('Fehler beim Eintragen des Geschäfts:', err);
    res.status(500).json({ error: 'Eintrag konnte nicht gespeichert werden.' });
  }
});

// ---------- Admin: alle ausstehenden Geschäfte zur Prüfung sehen ----------
router.get('/ausstehend', requireLogin, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.email AS owner_email
       FROM businesses b
       LEFT JOIN users u ON u.id = b.owner_id
       WHERE b.status = 'ausstehend'
       ORDER BY b.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden ausstehender Geschäfte:', err);
    res.status(500).json({ error: 'Anfrage fehlgeschlagen.' });
  }
});

// ---------- Admin: Geschäft freigeben oder ablehnen ----------
router.patch('/:id/status', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // erwartet 'freigegeben' oder 'abgelehnt'

  if (!['freigegeben', 'abgelehnt'].includes(status)) {
    return res.status(400).json({ error: "Status muss 'freigegeben' oder 'abgelehnt' sein." });
  }

  try {
    const result = await pool.query(
      `UPDATE businesses
       SET status = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, req.user.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Geschäft nicht gefunden.' });
    }

    res.json({ message: `Geschäft wurde ${status}.`, business: result.rows[0] });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Status:', err);
    res.status(500).json({ error: 'Aktion fehlgeschlagen.' });
  }
});
// ---------- Admin: Geschäft endgültig löschen ----------
router.delete('/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM businesses WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Geschäft nicht gefunden.' });
    }

    res.json({ message: 'Geschäft gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen des Geschäfts:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
  }
});
module.exports = router;

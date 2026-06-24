// Routen für das Geschäftsverzeichnis: Eintragen, Anzeigen, Freigeben durch Admin

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireLogin, requireRole } = require('./middleware');

// ---------- Öffentlich: alle freigegebenen Geschäfte anzeigen ----------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, description, address, latitude, longitude, phone, website, image_url
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
router.post('/', requireLogin, async (req, res) => {
  const { name, category, description, address, latitude, longitude, phone, website, image_url } = req.body;

  if (!name || !category || !address) {
    return res.status(400).json({ error: 'Name, Kategorie und Adresse sind erforderlich.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO businesses (owner_id, name, category, description, address, latitude, longitude, phone, website, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ausstehend')
       RETURNING *`,
      [req.user.userId, name, category, description, address, latitude, longitude, phone, website, image_url || null]
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
  const { status } = req.body;

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

// ---------- Admin: Bild eines Geschäfts aktualisieren ----------
router.patch('/:id/image', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { image_url } = req.body;

  try {
    const result = await pool.query(
      `UPDATE businesses SET image_url = $1 WHERE id = $2 RETURNING *`,
      [image_url || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Geschäft nicht gefunden.' });
    }

    res.json({ message: 'Bild aktualisiert.', business: result.rows[0] });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Bildes:', err);
    res.status(500).json({ error: 'Aktualisierung fehlgeschlagen.' });
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

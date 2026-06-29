// Routen für "Unser Uhlenhorst" – Stadtteil-Beschreibung mit Text und Bildern (früher/heute)

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireLogin, requireRole } = require('./middleware');

// ---------- Öffentlich: Text und alle Bilder der Seite anzeigen ----------
router.get('/', async (req, res) => {
  try {
    const pageResult = await pool.query(
      `SELECT body, updated_at FROM uhlenhorst_page WHERE id = 1`
    );

    const imagesResult = await pool.query(
      `SELECT id, image_url, caption, era, pair_group, sort_order
       FROM uhlenhorst_page_images
       ORDER BY sort_order ASC, created_at ASC`
    );

    res.json({
      body: pageResult.rows[0] ? pageResult.rows[0].body : '',
      updated_at: pageResult.rows[0] ? pageResult.rows[0].updated_at : null,
      images: imagesResult.rows,
    });
  } catch (err) {
    console.error('Fehler beim Laden von "Unser Uhlenhorst":', err);
    res.status(500).json({ error: 'Inhalt konnte nicht geladen werden.' });
  }
});

// ---------- Admin: Text aktualisieren ----------
router.put('/text', requireLogin, requireRole('admin'), async (req, res) => {
  const { body } = req.body;

  if (body === undefined) {
    return res.status(400).json({ error: 'Text ist erforderlich.' });
  }

  try {
    const result = await pool.query(
      `UPDATE uhlenhorst_page SET body = $1, updated_at = now() WHERE id = 1 RETURNING *`,
      [body]
    );
    res.json({ message: 'Text aktualisiert.', page: result.rows[0] });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Textes:', err);
    res.status(500).json({ error: 'Aktualisierung fehlgeschlagen.' });
  }
});

// ---------- Admin: neues Bild hinzufügen ----------
router.post('/images', requireLogin, requireRole('admin'), async (req, res) => {
  const { image_url, caption, era, pair_group, sort_order } = req.body;

  if (!image_url) {
    return res.status(400).json({ error: 'Bild-URL ist erforderlich.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO uhlenhorst_page_images (image_url, caption, era, pair_group, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [image_url, caption || null, era || null, pair_group || null, sort_order || 0]
    );
    res.status(201).json({ message: 'Bild hinzugefügt.', image: result.rows[0] });
  } catch (err) {
    console.error('Fehler beim Hinzufügen des Bildes:', err);
    res.status(500).json({ error: 'Bild konnte nicht hinzugefügt werden.' });
  }
});

// ---------- Admin: Bild bearbeiten (Beschriftung, Ära, Paar-Gruppe) ----------
router.patch('/images/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { caption, era, pair_group, sort_order } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM uhlenhorst_page_images WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Bild nicht gefunden.' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (caption !== undefined) { updateFields.push(`caption = $${paramCount++}`); values.push(caption); }
    if (era !== undefined) { updateFields.push(`era = $${paramCount++}`); values.push(era); }
    if (pair_group !== undefined) { updateFields.push(`pair_group = $${paramCount++}`); values.push(pair_group); }
    if (sort_order !== undefined) { updateFields.push(`sort_order = $${paramCount++}`); values.push(sort_order); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren.' });
    }

    values.push(id);
    const query = `UPDATE uhlenhorst_page_images SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ message: 'Bild aktualisiert.', image: result.rows[0] });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Bildes:', err);
    res.status(500).json({ error: 'Aktualisierung fehlgeschlagen.' });
  }
});

// ---------- Admin: Bild löschen ----------
router.delete('/images/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM uhlenhorst_page_images WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bild nicht gefunden.' });
    }
    res.json({ message: 'Bild gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen des Bildes:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
  }
});

module.exports = router;

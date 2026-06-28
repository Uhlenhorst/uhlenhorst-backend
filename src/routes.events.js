// Routen für Termine und Kalender (Moin Uhlenhorst)

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireLogin, requireRole } = require('./middleware');

// ---------- Öffentlich: alle kommenden Termine anzeigen ----------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.image_url,
              u.name AS created_by_name
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.starts_at >= now()
       ORDER BY e.starts_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Termine:', err);
    res.status(500).json({ error: 'Termine konnten nicht geladen werden.' });
  }
});

// ---------- Öffentlich: Termine für einen bestimmten Monat ----------
router.get('/month', async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Jahr und Monat (1-12) sind erforderlich.' });
  }

  try {
    const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const result = await pool.query(
      `SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.image_url,
              u.name AS created_by_name
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.starts_at >= $1 AND e.starts_at <= $2
       ORDER BY e.starts_at ASC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Termine für Monat:', err);
    res.status(500).json({ error: 'Anfrage fehlgeschlagen.' });
  }
});

// ---------- Einzelnen Termin anzeigen ----------
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT e.*, u.name AS created_by_name
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fehler beim Laden des Termins:', err);
    res.status(500).json({ error: 'Termin konnte nicht geladen werden.' });
  }
});

// ---------- Admin: neuen Termin anlegen ----------
router.post('/', requireLogin, requireRole('admin'), async (req, res) => {
  const { title, description, location, starts_at, ends_at, image_url } = req.body;

  if (!title || !starts_at) {
    return res.status(400).json({ error: 'Titel und Startdatum sind erforderlich.' });
  }

  try {
    const startDate = new Date(starts_at);
    const endDate = ends_at ? new Date(ends_at) : null;

    if (endDate && endDate < startDate) {
      return res.status(400).json({ error: 'Enddatum kann nicht vor Startdatum liegen.' });
    }

    const result = await pool.query(
      `INSERT INTO events (created_by, title, description, location, starts_at, ends_at, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.userId, title, description, location, startDate.toISOString(), endDate ? endDate.toISOString() : null, image_url || null]
    );

    res.status(201).json({
      message: 'Termin angelegt.',
      event: result.rows[0],
    });
  } catch (err) {
    console.error('Fehler beim Anlegen des Termins:', err);
    res.status(500).json({ error: 'Termin konnte nicht angelegt werden.' });
  }
});

// ---------- Admin: Termin bearbeiten ----------
router.patch('/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, description, location, starts_at, ends_at, image_url } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (location !== undefined) {
      updateFields.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (starts_at !== undefined) {
      updateFields.push(`starts_at = $${paramCount++}`);
      values.push(new Date(starts_at).toISOString());
    }
    if (ends_at !== undefined) {
      updateFields.push(`ends_at = $${paramCount++}`);
      values.push(ends_at ? new Date(ends_at).toISOString() : null);
    }
    if (image_url !== undefined) {
      updateFields.push(`image_url = $${paramCount++}`);
      values.push(image_url || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren.' });
    }

    values.push(id);
    const query = `UPDATE events SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    res.json({
      message: 'Termin aktualisiert.',
      event: result.rows[0],
    });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Termins:', err);
    res.status(500).json({ error: 'Aktualisierung fehlgeschlagen.' });
  }
});

// ---------- Admin: Termin löschen ----------
router.delete('/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Termin nicht gefunden.' });
    }

    res.json({ message: 'Termin gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen des Termins:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
  }
});

module.exports = router;

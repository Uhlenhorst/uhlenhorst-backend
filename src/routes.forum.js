// Routen für das Forum: Kategorien, Threads, Beiträge

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireLogin, requireRole } = require('./middleware');

// ---------- Öffentlich: alle Kategorien anzeigen ----------
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug FROM forum_categories ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Kategorien:', err);
    res.status(500).json({ error: 'Kategorien konnten nicht geladen werden.' });
  }
});

// ---------- Admin: Kategorie anlegen ----------
router.post('/categories', requireLogin, requireRole('admin'), async (req, res) => {
  const { name, slug } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Name und Slug sind erforderlich.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO forum_categories (name, slug) VALUES ($1, $2) RETURNING *`,
      [name, slug]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Fehler beim Anlegen der Kategorie:', err);
    res.status(500).json({ error: 'Kategorie konnte nicht angelegt werden.' });
  }
});

// ---------- Öffentlich: alle Threads anzeigen (mit Antwortanzahl) ----------
router.get('/threads', async (req, res) => {
  const { category } = req.query;

  try {
    let query = `
      SELECT t.id, t.title, t.created_at, t.updated_at,
             u.name AS author_name,
             c.name AS category_name, c.slug AS category_slug,
             COUNT(p.id) AS post_count,
             MAX(p.created_at) AS last_activity
      FROM forum_threads t
      LEFT JOIN users u ON u.id = t.author_id
      LEFT JOIN forum_categories c ON c.id = t.category_id
      LEFT JOIN forum_posts p ON p.thread_id = t.id
    `;
    const params = [];

    if (category) {
      query += ` WHERE c.slug = $1`;
      params.push(category);
    }

    query += ` GROUP BY t.id, u.name, c.name, c.slug ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Threads:', err);
    res.status(500).json({ error: 'Themen konnten nicht geladen werden.' });
  }
});

// ---------- Öffentlich: einen Thread mit allen Beiträgen anzeigen ----------
router.get('/threads/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const threadResult = await pool.query(
      `SELECT t.id, t.title, t.created_at,
              u.name AS author_name,
              c.name AS category_name, c.slug AS category_slug
       FROM forum_threads t
       LEFT JOIN users u ON u.id = t.author_id
       LEFT JOIN forum_categories c ON c.id = t.category_id
       WHERE t.id = $1`,
      [id]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thema nicht gefunden.' });
    }

    const postsResult = await pool.query(
      `SELECT p.id, p.body, p.created_at, p.author_id, p.image_url,
              u.name AS author_name
       FROM forum_posts p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.thread_id = $1
       ORDER BY p.created_at ASC`,
      [id]
    );

    res.json({
      thread: threadResult.rows[0],
      posts: postsResult.rows,
    });
  } catch (err) {
    console.error('Fehler beim Laden des Themas:', err);
    res.status(500).json({ error: 'Thema konnte nicht geladen werden.' });
  }
});

// ---------- Eingeloggt: neuen Thread anlegen (mit erstem Beitrag) ----------
router.post('/threads', requireLogin, async (req, res) => {
  const { title, category_id, body, image_url } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Titel und Text sind erforderlich.' });
  }

  try {
    const threadResult = await pool.query(
      `INSERT INTO forum_threads (category_id, author_id, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [category_id || null, req.user.userId, title]
    );

    const thread = threadResult.rows[0];

    const postResult = await pool.query(
      `INSERT INTO forum_posts (thread_id, author_id, body, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [thread.id, req.user.userId, body, image_url || null]
    );

    res.status(201).json({
      message: 'Thema erstellt.',
      thread,
      firstPost: postResult.rows[0],
    });
  } catch (err) {
    console.error('Fehler beim Anlegen des Themas:', err);
    res.status(500).json({ error: 'Thema konnte nicht angelegt werden.' });
  }
});

// ---------- Eingeloggt: Antwort in einem Thread schreiben ----------
router.post('/threads/:id/posts', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { body } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Text darf nicht leer sein.' });
  }

  try {
    const threadCheck = await pool.query('SELECT id FROM forum_threads WHERE id = $1', [id]);
    if (threadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Thema nicht gefunden.' });
    }

    const result = await pool.query(
      `INSERT INTO forum_posts (thread_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, req.user.userId, body.trim()]
    );

    await pool.query(`UPDATE forum_threads SET updated_at = now() WHERE id = $1`, [id]);

    res.status(201).json({
      message: 'Antwort hinzugefügt.',
      post: result.rows[0],
    });
  } catch (err) {
    console.error('Fehler beim Hinzufügen der Antwort:', err);
    res.status(500).json({ error: 'Antwort konnte nicht hinzugefügt werden.' });
  }
});

// ---------- Admin: Beitrag löschen (Moderation) ----------
router.delete('/posts/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM forum_posts WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beitrag nicht gefunden.' });
    }
    res.json({ message: 'Beitrag gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen des Beitrags:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
  }
});

// ---------- Admin: Thread löschen (Moderation) ----------
router.delete('/threads/:id', requireLogin, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM forum_threads WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thema nicht gefunden.' });
    }
    res.json({ message: 'Thema gelöscht.' });
  } catch (err) {
    console.error('Fehler beim Löschen des Themas:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
  }
});

module.exports = router;

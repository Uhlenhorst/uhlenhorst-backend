// Routen für Registrierung und Login

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { hashPassword, verifyPassword, createToken } = require('./auth');

const VALID_ROLES = ['anwohner', 'geschaeftsinhaber'];
// 'admin' kann sich NICHT selbst registrieren — Admins werden manuell in der DB angelegt.

// ---------- Registrierung ----------
router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'E-Mail, Passwort und Name sind erforderlich.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' });
  }

  const chosenRole = VALID_ROLES.includes(role) ? role : 'anwohner';

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), passwordHash, name, chosenRole]
    );

    const user = result.rows[0];
    const token = createToken(user);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Fehler bei Registrierung:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen. Bitte später erneut versuchen.' });
  }
});

// ---------- Login ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    // Bewusst dieselbe Fehlermeldung bei "E-Mail nicht gefunden" und "falsches Passwort" —
    // so kann niemand von außen herausfinden, welche E-Mails registriert sind.
    if (!user) {
      return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
    }

    const token = createToken(user);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    console.error('Fehler beim Login:', err);
    res.status(500).json({ error: 'Login fehlgeschlagen. Bitte später erneut versuchen.' });
  }
});

module.exports = router;

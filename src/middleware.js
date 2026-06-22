// Middleware: prüft, ob ein Nutzer eingeloggt ist, und ob er die richtige Rolle hat.
// Wird vor geschützten Routen eingesetzt, z.B. "nur Admin darf Geschäfte freigeben"

const { verifyToken } = require('./auth');

// Prüft nur: ist der Nutzer überhaupt eingeloggt?
function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization; // erwartet Format: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht eingeloggt.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload; // enthält userId und role, ab jetzt in jeder Route verfügbar
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen. Bitte erneut einloggen.' });
  }
}

// Prüft zusätzlich: hat der Nutzer eine der erlaubten Rollen?
// Beispiel: requireRole('admin')  oder  requireRole('admin', 'geschaeftsinhaber')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Aktion.' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };

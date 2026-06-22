// Hilfsfunktionen für Passwort-Verschlüsselung und Login-Token (JWT)

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET; // muss in .env gesetzt sein
const JWT_EXPIRY = '7d'; // Nutzer bleibt 7 Tage eingeloggt

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET fehlt in der .env-Datei. Server kann ohne diesen Wert nicht sicher laufen.');
}

// Passwort verschlüsseln, bevor es in der Datenbank gespeichert wird
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// Eingegebenes Passwort beim Login mit dem gespeicherten Hash vergleichen
async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// Login-Token erzeugen (wird vom Frontend bei jeder Anfrage mitgeschickt)
function createToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// Token bei eingehenden Anfragen prüfen
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken };

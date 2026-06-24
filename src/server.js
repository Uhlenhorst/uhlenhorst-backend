// Routen für Bild-Uploads (Cloudinary)


const express = require('express');
const router = express.Router();
const { requireLogin } = require('./middleware');


const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;


// ---------- Eingeloggt: Signatur für direkten Browser-Upload erzeugen ----------
// Der Browser lädt das Bild direkt zu Cloudinary hoch (nicht über unseren Server),
// braucht dafür aber eine "Signatur", die nur unser Server mit dem geheimen Schlüssel erzeugen kann.
router.get('/signature', requireLogin, async (req, res) => {
  try {
    const crypto = require('crypto');
    const timestamp = Math.round(Date.now() / 1000);


    const paramsToSign = `timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');


    res.json({
      timestamp,
      signature,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error('Fehler beim Erzeugen der Upload-Signatur:', err);
    res.status(500).json({ error: 'Signatur konnte nicht erzeugt werden.' });
  }
});


module.exports = router;

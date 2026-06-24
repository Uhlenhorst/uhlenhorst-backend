// Routen für den Shop: Produkte (von Printful), Bestellungen, Stripe-Zahlung

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { requireLogin, requireRole } = require('./middleware');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRINTFUL_API = 'https://api.printful.com';
const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

// ---------- Öffentlich: alle aktiven Produkte anzeigen ----------
router.get('/products', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, price_cents, image_url
       FROM products
       WHERE active = TRUE
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fehler beim Laden der Produkte:', err);
    res.status(500).json({ error: 'Produkte konnten nicht geladen werden.' });
  }
});

// ---------- Admin: Produkte von Printful importieren ----------
router.post('/sync-printful', requireLogin, requireRole('admin'), async (req, res) => {
  try {
    const response = await fetch(`${PRINTFUL_API}/store/products`, {
      headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Printful-Fehler:', errText);
      return res.status(502).json({ error: 'Printful konnte nicht erreicht werden.' });
    }

    const data = await response.json();
    const printfulProducts = data.result || [];

    let importedCount = 0;

    for (const item of printfulProducts) {
      // Detailansicht abrufen für Preis & Bild
      const detailRes = await fetch(`${PRINTFUL_API}/store/products/${item.id}`, {
        headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
      });
      const detailData = await detailRes.json();
      const variant = detailData.result?.sync_variants?.[0];

      if (!variant) continue;

      const priceCents = Math.round(parseFloat(variant.retail_price) * 100);
      const imageUrl = variant.files?.find(f => f.type === 'preview')?.preview_url || item.thumbnail_url || '';

      const existing = await pool.query('SELECT id FROM products WHERE name = $1', [item.name]);

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE products SET price_cents = $1, image_url = $2, active = TRUE WHERE id = $3`,
          [priceCents, imageUrl, existing.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO products (name, description, price_cents, image_url, active)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [item.name, '', priceCents, imageUrl]
        );
      }
      importedCount++;
    }

    res.json({ message: `${importedCount} Produkt(e) von Printful importiert.` });
  } catch (err) {
    console.error('Fehler beim Importieren von Printful:', err);
    res.status(500).json({ error: 'Import fehlgeschlagen.' });
  }
});

// ---------- Eingeloggt: Warenkorb validieren (Preise serverseitig prüfen) ----------
router.post('/cart/validate', requireLogin, async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Warenkorb ist leer.' });
  }

  try {
    const productIds = items.map(i => i.product_id);
    const result = await pool.query(
      `SELECT id, name, price_cents FROM products WHERE id = ANY($1) AND active = TRUE`,
      [productIds]
    );

    const productMap = {};
    result.rows.forEach(p => { productMap[p.id] = p; });

    let totalCents = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = productMap[item.product_id];
      if (!product) {
        return res.status(404).json({ error: `Ein Produkt im Warenkorb ist nicht mehr verfügbar.` });
      }
      const quantity = Math.max(1, parseInt(item.quantity) || 1);
      totalCents += product.price_cents * quantity;
      validatedItems.push({
        product_id: product.id,
        name: product.name,
        quantity,
        price_cents: product.price_cents,
      });
    }

    res.json({ items: validatedItems, total_cents: totalCents });
  } catch (err) {
    console.error('Fehler bei Warenkorb-Validierung:', err);
    res.status(500).json({ error: 'Validierung fehlgeschlagen.' });
  }
});

// ---------- Eingeloggt: Bestellung erstellen + Stripe Payment Intent ----------
router.post('/checkout', requireLogin, async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Warenkorb ist leer.' });
  }

  try {
    // Preise serverseitig erneut prüfen (nie dem Frontend vertrauen)
    const productIds = items.map(i => i.product_id);
    const productResult = await pool.query(
      `SELECT id, price_cents FROM products WHERE id = ANY($1) AND active = TRUE`,
      [productIds]
    );
    const productMap = {};
    productResult.rows.forEach(p => { productMap[p.id] = p.price_cents; });

    let totalCents = 0;
    const orderItemsData = [];

    for (const item of items) {
      const priceCents = productMap[item.product_id];
      if (priceCents === undefined) {
        return res.status(404).json({ error: 'Ein Produkt ist nicht mehr verfügbar.' });
      }
      const quantity = Math.max(1, parseInt(item.quantity) || 1);
      totalCents += priceCents * quantity;
      orderItemsData.push({ product_id: item.product_id, quantity, price_cents: priceCents });
    }

    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, status, total_cents) VALUES ($1, 'offen', $2) RETURNING id`,
      [req.user.userId, totalCents]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of orderItemsData) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.price_cents]
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'eur',
      metadata: { orderId, userId: req.user.userId },
      automatic_payment_methods: { enabled: true },
    });

    await pool.query(`UPDATE orders SET stripe_payment_id = $1 WHERE id = $2`, [paymentIntent.id, orderId]);

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error('Fehler beim Checkout:', err);
    res.status(500).json({ error: 'Checkout fehlgeschlagen.' });
  }
});

// ---------- Eingeloggt: Bestellstatus abfragen (für Erfolgs-Anzeige) ----------
router.get('/orders/:id', requireLogin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object('product_id', oi.product_id, 'quantity', oi.quantity, 'price_cents', oi.price_cents)) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fehler beim Laden der Bestellung:', err);
    res.status(500).json({ error: 'Bestellung konnte nicht geladen werden.' });
  }
});

// ---------- Webhook: Stripe bestätigt Zahlung ----------
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook-Fehler:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata.orderId;

    try {
      await pool.query(`UPDATE orders SET status = 'bezahlt' WHERE id = $1`, [orderId]);
      console.log(`Bestellung ${orderId} als bezahlt markiert.`);
    } catch (err) {
      console.error('Fehler beim Aktualisieren der Bestellung:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;

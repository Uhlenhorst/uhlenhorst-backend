-- ============================================================
-- Auf der Uhlenhorst — Datenbank-Schema
-- PostgreSQL
-- ============================================================

-- Erweiterung für UUIDs (bessere IDs als simple Zahlen, schwerer zu erraten)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------
-- NUTZER
-- ----------------------------------------------------------
CREATE TYPE user_role AS ENUM ('anwohner', 'geschaeftsinhaber', 'admin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,      -- bcrypt-Hash, NIE das Klartext-Passwort
    name            VARCHAR(120) NOT NULL,
    role            user_role NOT NULL DEFAULT 'anwohner',
    email_verified  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- ----------------------------------------------------------
-- GESCHÄFTE (Verzeichnis)
-- ----------------------------------------------------------
CREATE TYPE business_status AS ENUM ('ausstehend', 'freigegeben', 'abgelehnt');

CREATE TABLE businesses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(100) NOT NULL,       -- z.B. "Café", "Friseur"
    description     TEXT,
    address         VARCHAR(255) NOT NULL,
    latitude        DECIMAL(10, 7),               -- für die Stadtplan-Anzeige
    longitude       DECIMAL(10, 7),
    phone           VARCHAR(50),
    website         VARCHAR(255),
    status          business_status NOT NULL DEFAULT 'ausstehend',
    reviewed_by     UUID REFERENCES users(id),    -- welcher Admin hat freigegeben
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_name ON businesses(name);

-- ----------------------------------------------------------
-- TERMINE / KALENDER (Moin Uhlenhorst)
-- ----------------------------------------------------------
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    location        VARCHAR(255),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_starts_at ON events(starts_at);

-- ----------------------------------------------------------
-- FORUM
-- ----------------------------------------------------------
CREATE TABLE forum_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE forum_threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID REFERENCES forum_categories(id) ON DELETE SET NULL,
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE forum_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
    author_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_forum_posts_thread ON forum_posts(thread_id);

-- ----------------------------------------------------------
-- SHOP (Merchandise)
-- ----------------------------------------------------------
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    price_cents     INTEGER NOT NULL,            -- Preis in Cent, vermeidet Rundungsfehler
    image_url       VARCHAR(500),
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE order_status AS ENUM ('offen', 'bezahlt', 'versendet', 'storniert');

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    status          order_status NOT NULL DEFAULT 'offen',
    total_cents     INTEGER NOT NULL,
    stripe_payment_id VARCHAR(255),               -- Referenz zur Zahlungsabwicklung
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    price_cents     INTEGER NOT NULL              -- Preis zum Bestellzeitpunkt (falls sich Preis später ändert)
);

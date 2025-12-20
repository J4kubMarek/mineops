-- Migration: Add Hardware System and USD Balance
-- Description: Pridava tabulky pro hardware shop a USD balance pro uzivatele
-- Created: 2025-12-20

-- =============================================================================
-- USD BALANCE - Pridani USD meny do uzivatelu
-- =============================================================================
-- USD je hlavni mena pro nakupy v obchode, ucty za elektrinu a prostor
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_usd DECIMAL(12, 2) DEFAULT 0.00;

-- Komentare k novemu sloupci
COMMENT ON COLUMN users.balance_usd IS 'Aktualni zustatek v USD - ziskava se prodejem BTC';

-- =============================================================================
-- HARDWARE TYPES - Katalog dostupneho hardwaru
-- =============================================================================
-- Obsahuje definice vsech minerru ktere lze zakoupit
CREATE TABLE hardware_types (
  id SERIAL PRIMARY KEY,

  -- Zakladni informace
  name VARCHAR(100) NOT NULL,              -- Nazev produktu (napr. "S19 Pro")
  category VARCHAR(50) NOT NULL,            -- Kategorie: btc_asic, doge_asic, xmr_asic, solo

  -- Vykon
  hashrate DECIMAL(20, 4) NOT NULL,         -- Hashrate v zakladni jednotce pro danou kategorii
  hashrate_unit VARCHAR(20) NOT NULL,       -- Jednotka: TH/s, MH/s, KH/s, GH/s
  power_consumption INTEGER NOT NULL,       -- Spotreba ve Wattech

  -- Ekonomika
  price_usd DECIMAL(12, 2) NOT NULL,        -- Cena v USD

  -- Metadata
  description TEXT,                          -- Popis produktu
  is_available BOOLEAN DEFAULT true,         -- Zda je produkt dostupny k nakupu

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_category CHECK (category IN ('btc_asic', 'doge_asic', 'xmr_asic', 'solo')),
  CONSTRAINT positive_hashrate CHECK (hashrate > 0),
  CONSTRAINT positive_power CHECK (power_consumption > 0),
  CONSTRAINT positive_price CHECK (price_usd > 0)
);

-- Index pro rychle vyhledavani podle kategorie
CREATE INDEX idx_hardware_types_category ON hardware_types(category);
CREATE INDEX idx_hardware_types_available ON hardware_types(is_available);

-- =============================================================================
-- USER HARDWARE - Inventar hardwaru uzivatelu
-- =============================================================================
-- Propojeni uzivatelu s jejich zakoupenym hardwarem
CREATE TABLE user_hardware (
  id SERIAL PRIMARY KEY,

  -- Reference
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hardware_type_id INTEGER NOT NULL REFERENCES hardware_types(id),

  -- Stav
  quantity INTEGER DEFAULT 1,                -- Pocet kusu
  is_active BOOLEAN DEFAULT true,            -- Zda hardware aktivne tezi

  -- Timestamps
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Indexy pro rychle vyhledavani
CREATE INDEX idx_user_hardware_user ON user_hardware(user_id);
CREATE INDEX idx_user_hardware_type ON user_hardware(hardware_type_id);
CREATE INDEX idx_user_hardware_active ON user_hardware(is_active);

-- =============================================================================
-- TRANSACTIONS - Historie transakci (nakupy, prodeje, poplatky)
-- =============================================================================
-- Zaznamenava vsechny financni operace
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,

  -- Reference
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Typ transakce
  type VARCHAR(50) NOT NULL,                 -- purchase, sale, electricity, space_rent, btc_sell

  -- Castky
  amount_usd DECIMAL(12, 2),                 -- Castka v USD (kladna = prijem, zaporna = vydaj)
  amount_btc DECIMAL(16, 8),                 -- Castka v BTC (pro konverze)

  -- Detaily
  description TEXT,                           -- Popis transakce
  reference_id INTEGER,                       -- Reference na hardware_type_id nebo jinou entitu

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_type CHECK (type IN ('purchase', 'sale', 'electricity', 'space_rent', 'btc_sell', 'btc_buy'))
);

-- Indexy pro vyhledavani
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- =============================================================================
-- SEED DATA - Zakladni hardware pro kazou kategorii
-- =============================================================================

-- BTC ASIC Miners
INSERT INTO hardware_types (name, category, hashrate, hashrate_unit, power_consumption, price_usd, description) VALUES
('S9 Legacy', 'btc_asic', 14.0000, 'TH/s', 1350, 150.00, 'Klasicky Antminer S9 - nizka efektivita, nizka cena'),
('S19 Pro', 'btc_asic', 110.0000, 'TH/s', 3250, 1200.00, 'Antminer S19 Pro - solidni vykon pro stredni hrace'),
('S21 Hydro', 'btc_asic', 200.0000, 'TH/s', 3350, 3500.00, 'Vodni chlazeni pro maximalni efektivitu'),
('T21 Air', 'btc_asic', 190.0000, 'TH/s', 3610, 2800.00, 'Vzduchove chlazeny high-end miner');

-- DOGE ASIC Miners (Scrypt algorithm)
INSERT INTO hardware_types (name, category, hashrate, hashrate_unit, power_consumption, price_usd, description) VALUES
('Mini-Doge II', 'doge_asic', 420.0000, 'MH/s', 400, 250.00, 'Kompaktni Scrypt miner pro zacatecniky'),
('L7 Master', 'doge_asic', 9050.0000, 'MH/s', 3260, 4500.00, 'Bitmain L7 - overena volba pro DOGE tezbu'),
('L9 X-treme', 'doge_asic', 16000.0000, 'MH/s', 3400, 9000.00, 'Nejnovejsi generace Scrypt ASIC'),
('MoonRocket 1', 'doge_asic', 5000.0000, 'MH/s', 2000, 3200.00, 'Komunitni oblibeny miner s dobrou efektivitou');

-- XMR Miners (CPU/RandomX)
INSERT INTO hardware_types (name, category, hashrate, hashrate_unit, power_consumption, price_usd, description) VALUES
('Old Workstation', 'xmr_asic', 5.0000, 'KH/s', 150, 100.00, 'Stara pracovni stanice - nizky vykon, nizka cena'),
('Ryzen Beast', 'xmr_asic', 20.0000, 'KH/s', 250, 800.00, 'AMD Ryzen 9 - solidni CPU mining'),
('Epyc Server', 'xmr_asic', 60.0000, 'KH/s', 450, 2500.00, 'Serverovy AMD EPYC - vysoky vykon'),
('Threadripper X', 'xmr_asic', 100.0000, 'KH/s', 800, 5000.00, 'AMD Threadripper - nejlepsi CPU pro XMR');

-- SOLO Miners (Bitcoin solo mining)
INSERT INTO hardware_types (name, category, hashrate, hashrate_unit, power_consumption, price_usd, description) VALUES
('Bitaxe Ultra', 'solo', 500.0000, 'GH/s', 15, 89.00, 'Open-source solo miner - nizka sance, vysoka odmena'),
('Bitaxe Gamma', 'solo', 1700.0000, 'GH/s', 25, 199.00, 'Vylepseny Bitaxe - lepsi sance na solo blok');

-- =============================================================================
-- KOMENTARE K TABULKAM
-- =============================================================================
COMMENT ON TABLE hardware_types IS 'Katalog vseho dostupneho hardware pro tezbu';
COMMENT ON TABLE user_hardware IS 'Inventar hardwaru jednotlivych hracu';
COMMENT ON TABLE transactions IS 'Historie vsech financnich operaci v hre';

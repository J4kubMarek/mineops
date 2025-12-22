-- Migration: Add Farm System
-- Description: Pridava tabulky pro spravau farem a prirazeni hardwaru k farmam
-- Created: 2025-12-22

-- =============================================================================
-- FARM SPACES - Katalog dostupnych prostoru pro farmy
-- =============================================================================
-- Definuje typy prostoru ktere si hrac muze pronajmout pro provoz farmy
-- Kazdy prostor ma ruznou kapacitu, najem a cenu elektriny
CREATE TABLE farm_spaces (
  id SERIAL PRIMARY KEY,

  -- Zakladni informace o prostoru
  name VARCHAR(100) NOT NULL,                 -- Nazev prostoru (napr. "Garaz")
  description TEXT,                            -- Popis prostoru

  -- Kapacita a limity
  max_power_watts INTEGER NOT NULL,           -- Maximalni spotreba elektricke energie ve Wattech

  -- Ekonomika
  rent_usd_per_day DECIMAL(10, 2) NOT NULL,   -- Najem v USD za den
  electricity_cost_per_kwh DECIMAL(6, 4) NOT NULL, -- Cena elektriny za kWh v USD

  -- Vizualni assets
  image_url VARCHAR(255),                      -- URL obrazku prostoru (PLACEHOLDER - bude doplneno)

  -- Razeni a dostupnost
  sort_order INTEGER DEFAULT 0,                -- Poradi pro zobrazeni (mensi = drive)
  is_available BOOLEAN DEFAULT true,           -- Zda je prostor dostupny k pronajmu

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT positive_max_power CHECK (max_power_watts > 0),
  CONSTRAINT positive_rent CHECK (rent_usd_per_day >= 0),
  CONSTRAINT positive_electricity CHECK (electricity_cost_per_kwh > 0)
);

-- Komentare ke sloupcum
COMMENT ON TABLE farm_spaces IS 'Katalog dostupnych prostoru pro tezebni farmy';
COMMENT ON COLUMN farm_spaces.max_power_watts IS 'Maximalni kapacita elektricke energie v prostoru';
COMMENT ON COLUMN farm_spaces.rent_usd_per_day IS 'Denni najem za prostor v USD';
COMMENT ON COLUMN farm_spaces.electricity_cost_per_kwh IS 'Cena elektriny za kWh - vetsi prostory maji levnejsi proud';
COMMENT ON COLUMN farm_spaces.image_url IS 'PLACEHOLDER - URL obrazku prostoru, bude doplneno';

-- =============================================================================
-- FARMS - Farmy jednotlivych hracu
-- =============================================================================
-- Kazdy hrac muze vlastnit vice farem, kazda farma je v urcitem prostoru
CREATE TABLE farms (
  id SERIAL PRIMARY KEY,

  -- Vlastnik
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Prostor
  space_id INTEGER NOT NULL REFERENCES farm_spaces(id),

  -- Identifikace
  name VARCHAR(100) NOT NULL,                  -- Uzivatelsky nazev farmy

  -- Stav
  is_active BOOLEAN DEFAULT true,              -- Zda farma aktivne tezi

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- PLACEHOLDER: Dalsi atributy budou pridany v budoucnu
  -- např. cooling_level, security_level, atd.

  -- Index pro rychle vyhledavani podle uzivatele
  CONSTRAINT farm_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Indexy
CREATE INDEX idx_farms_user ON farms(user_id);
CREATE INDEX idx_farms_space ON farms(space_id);
CREATE INDEX idx_farms_active ON farms(is_active);

-- Komentare
COMMENT ON TABLE farms IS 'Tezebni farmy jednotlivych hracu';
COMMENT ON COLUMN farms.name IS 'Uzivatelsky nazev farmy - lze prejmenovat';
COMMENT ON COLUMN farms.is_active IS 'Aktivni farma = hardware v ni aktivne tezi';

-- =============================================================================
-- FARM HARDWARE - Prirazeni hardwaru k farmam
-- =============================================================================
-- Propojuje inventar hrace (user_hardware) s jeho farmami
-- Hardware muze byt prirazen pouze k jedne farme
CREATE TABLE farm_hardware (
  id SERIAL PRIMARY KEY,

  -- Reference
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_hardware_id INTEGER NOT NULL REFERENCES user_hardware(id) ON DELETE CASCADE,

  -- Pocet kusu z inventare prirazenych k teto farme
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Stav v ramci farmy
  is_running BOOLEAN DEFAULT true,             -- Zda hardware bezi (lze vypnout pro usporu)

  -- Timestamps
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT positive_farm_hw_quantity CHECK (quantity > 0),
  -- Kazdy user_hardware zaznam muze byt prirazen pouze k jedne farme
  CONSTRAINT unique_hardware_assignment UNIQUE (user_hardware_id)
);

-- Indexy
CREATE INDEX idx_farm_hardware_farm ON farm_hardware(farm_id);
CREATE INDEX idx_farm_hardware_user_hw ON farm_hardware(user_hardware_id);
CREATE INDEX idx_farm_hardware_running ON farm_hardware(is_running);

-- Komentare
COMMENT ON TABLE farm_hardware IS 'Prirazeni hardwaru z inventare k jednotlivym farmam';
COMMENT ON COLUMN farm_hardware.quantity IS 'Pocet kusu z user_hardware prirazenych k farme';
COMMENT ON COLUMN farm_hardware.is_running IS 'Hardware lze vypnout pro usporu elektriny';

-- =============================================================================
-- AKTUALIZACE TRANSACTIONS - Pridani typu pro farm operace
-- =============================================================================
-- Musime rozsirit CHECK constraint pro typ transakce
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS valid_type;
ALTER TABLE transactions ADD CONSTRAINT valid_type
  CHECK (type IN (
    'purchase',       -- Nakup hardwaru
    'sale',           -- Prodej hardwaru
    'electricity',    -- Platba za elektrinu
    'space_rent',     -- Platba za pronajem prostoru (farmy)
    'btc_sell',       -- Prodej BTC za USD
    'btc_buy',        -- Nakup BTC za USD
    'farm_rent'       -- Denni najem farmy
  ));

-- =============================================================================
-- SEED DATA - Zakladni prostory pro farmy
-- =============================================================================
-- Tri zakladni typy prostoru s ruznou kapacitou a cenami

-- Garaz - maly prostor, drahy proud (domaci tarif)
INSERT INTO farm_spaces (name, description, max_power_watts, rent_usd_per_day, electricity_cost_per_kwh, image_url, sort_order) VALUES
(
  'Garaz',
  'Mala garaz v rodinnem dome. Omezena kapacita, ale nizke najemne. Domaci tarif za elektrinu je nejdrazsi.',
  3500,           -- Max 3.5 kW - cca 2-3 minery
  5.00,           -- $5/den najem
  0.28,           -- $0.28/kWh - drahy domaci tarif
  NULL,           -- PLACEHOLDER: Obrazek bude doplnen
  1               -- Prvni v poradi
);

-- Prumyslova mistnost - stredni prostor, stredni cena proudu
INSERT INTO farm_spaces (name, description, max_power_watts, rent_usd_per_day, electricity_cost_per_kwh, image_url, sort_order) VALUES
(
  'Prumyslova mistnost',
  'Vetsi mistnost v prumyslovem arealu. Vice mista pro hardware a lepsi cena elektriny nez doma.',
  15000,          -- Max 15 kW - cca 5-10 mineru
  25.00,          -- $25/den najem
  0.18,           -- $0.18/kWh - prumyslovy tarif
  NULL,           -- PLACEHOLDER: Obrazek bude doplnen
  2               -- Druhy v poradi
);

-- Mala hala - velky prostor, nejlevnejsi proud
INSERT INTO farm_spaces (name, description, max_power_watts, rent_usd_per_day, electricity_cost_per_kwh, image_url, sort_order) VALUES
(
  'Mala hala',
  'Mala skladova hala s profesionalnim chlazenim. Nejvice mista a nejlevnejsi proud diky velkoobchodnimu tarifu.',
  50000,          -- Max 50 kW - desitky mineru
  100.00,         -- $100/den najem
  0.12,           -- $0.12/kWh - velkoobchodni tarif
  NULL,           -- PLACEHOLDER: Obrazek bude doplnen
  3               -- Treti v poradi
);

-- =============================================================================
-- PLACEHOLDER: Budouci rozsireni prostoru
-- =============================================================================
-- V budoucnu budou pridany dalsi typy prostoru:
-- - Kontejner (mobilni, stredni kapacita)
-- - Velka hala (enterprise, velmi vysoka kapacita)
-- - Datove centrum (premium, nejnizsi cena elektriny)
-- - Solarni farma (castecne zdarma elektrina)

-- =============================================================================
-- HELPER VIEW - Prehled farem s vypoctenou spotrebou
-- =============================================================================
-- View pro snadne ziskani informaci o farmach vcetne aktualni spotreby
CREATE OR REPLACE VIEW farm_overview AS
SELECT
  f.id AS farm_id,
  f.user_id,
  f.name AS farm_name,
  f.is_active AS farm_active,
  fs.id AS space_id,
  fs.name AS space_name,
  fs.max_power_watts,
  fs.rent_usd_per_day,
  fs.electricity_cost_per_kwh,
  f.created_at,
  f.updated_at,
  -- Vypoctena aktualni spotreba (soucet spotreby vsech prirazeneych a bezicich hardwaru)
  COALESCE(
    (
      SELECT SUM(ht.power_consumption * fh.quantity)
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.farm_id = f.id AND fh.is_running = true
    ),
    0
  ) AS current_power_watts,
  -- Pocet prirazeneho hardwaru
  COALESCE(
    (
      SELECT SUM(fh.quantity)
      FROM farm_hardware fh
      WHERE fh.farm_id = f.id
    ),
    0
  ) AS hardware_count
FROM farms f
JOIN farm_spaces fs ON fs.id = f.space_id;

COMMENT ON VIEW farm_overview IS 'Prehled farem s vypoctenou spotrebou a poctem hardwaru - HELPER VIEW';

-- =============================================================================
-- HELPER VIEW - Volny hardware (neprirazeny k zadne farme)
-- =============================================================================
CREATE OR REPLACE VIEW available_hardware AS
SELECT
  uh.id AS user_hardware_id,
  uh.user_id,
  uh.hardware_type_id,
  uh.quantity AS total_quantity,
  uh.is_active,
  uh.purchased_at,
  ht.name AS hardware_name,
  ht.category,
  ht.hashrate,
  ht.hashrate_unit,
  ht.power_consumption,
  -- Kolik kusu je prirazeno k farmam
  COALESCE(
    (SELECT SUM(fh.quantity) FROM farm_hardware fh WHERE fh.user_hardware_id = uh.id),
    0
  ) AS assigned_quantity,
  -- Kolik kusu je volnych
  uh.quantity - COALESCE(
    (SELECT SUM(fh.quantity) FROM farm_hardware fh WHERE fh.user_hardware_id = uh.id),
    0
  ) AS available_quantity
FROM user_hardware uh
JOIN hardware_types ht ON ht.id = uh.hardware_type_id;

COMMENT ON VIEW available_hardware IS 'Prehled hardwaru s informaci kolik kusu je volnych k prirazeni';

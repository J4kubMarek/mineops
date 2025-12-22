/**
 * =============================================================================
 * MINEOPS - FARM API ROUTES
 * =============================================================================
 *
 * API endpointy pro spravu tezebních farem:
 *
 * PROSTORY (Spaces):
 * - GET /api/farm-spaces - Seznam dostupnych prostoru
 *
 * FARMY (Farms):
 * - GET /api/farms - Seznam farem uzivatele
 * - GET /api/farms/:id - Detail farmy
 * - POST /api/farms - Vytvoreni nove farmy
 * - PUT /api/farms/:id - Uprava farmy (prejmenování)
 * - DELETE /api/farms/:id - Zruseni farmy
 * - POST /api/farms/:id/upgrade - Upgrade prostoru farmy
 *
 * HARDWARE PRIRAZENI:
 * - GET /api/farms/:id/hardware - Hardware ve farme
 * - POST /api/farms/:id/hardware - Prirazeni hardwaru k farme
 * - DELETE /api/farms/:id/hardware/:hwId - Odebrani hardwaru z farmy
 *
 * VOLNY HARDWARE:
 * - GET /api/farms/available-hardware - Hardware neprirazeny k zadne farme
 *
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { logAdminAction } = require('../config/gameConfig');

// =============================================================================
// GET /api/farm-spaces - Seznam dostupnych prostoru
// =============================================================================
// Vraci vsechny prostory ktere si hrac muze pronajmout pro farmu
router.get('/farm-spaces', async (req, res) => {
  try {
    // Dotaz na vsechny dostupne prostory serazene podle sort_order
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        max_power_watts,
        rent_usd_per_day,
        electricity_cost_per_kwh,
        image_url,
        sort_order
      FROM farm_spaces
      WHERE is_available = true
      ORDER BY sort_order ASC
    `);

    res.json({
      success: true,
      spaces: result.rows
    });
  } catch (error) {
    console.error('Error fetching farm spaces:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani prostoru'
    });
  }
});

// =============================================================================
// GET /api/farms - Seznam farem uzivatele
// =============================================================================
// Vraci vsechny farmy uzivatele s informacemi o spotrebe a vykonu
// TODO: Pouzit session/JWT pro identifikaci uzivatele
router.get('/farms', async (req, res) => {
  try {
    // TODO: Ziskat user_id ze session - zatim pouzivame pevne ID pro testovani
    const userId = req.query.user_id || 1;

    // Pouzijeme view farm_overview pro snazsi dotaz
    // View automaticky vypocitava aktualni spotrebu a pocet hardwaru
    const result = await pool.query(`
      SELECT
        f.id,
        f.user_id,
        f.name,
        f.is_active,
        f.created_at,
        f.updated_at,
        fs.id AS space_id,
        fs.name AS space_name,
        fs.description AS space_description,
        fs.max_power_watts,
        fs.rent_usd_per_day,
        fs.electricity_cost_per_kwh,
        fs.image_url,
        -- Vypoctena aktualni spotreba
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
        -- Celkovy hashrate (soucet vseho hardwaru ve farme)
        -- PLACEHOLDER: Toto bude komplexnejsi - ruzne jednotky hashrate
        COALESCE(
          (
            SELECT SUM(ht.hashrate * fh.quantity)
            FROM farm_hardware fh
            JOIN user_hardware uh ON uh.id = fh.user_hardware_id
            JOIN hardware_types ht ON ht.id = uh.hardware_type_id
            WHERE fh.farm_id = f.id AND fh.is_running = true
          ),
          0
        ) AS total_hashrate,
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
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      farms: result.rows
    });
  } catch (error) {
    console.error('Error fetching farms:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani farem'
    });
  }
});

// =============================================================================
// GET /api/farms/:id - Detail jedne farmy
// =============================================================================
// Vraci detailni informace o farme vcetne seznamu hardwaru
router.get('/farms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Overit ze farma patri uzivateli
    const userId = req.query.user_id || 1;

    // Zakladni info o farme
    const farmResult = await pool.query(`
      SELECT
        f.id,
        f.user_id,
        f.name,
        f.is_active,
        f.created_at,
        f.updated_at,
        fs.id AS space_id,
        fs.name AS space_name,
        fs.description AS space_description,
        fs.max_power_watts,
        fs.rent_usd_per_day,
        fs.electricity_cost_per_kwh,
        fs.image_url
      FROM farms f
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.id = $1 AND f.user_id = $2
    `, [id, userId]);

    if (farmResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    // Hardware ve farme
    const hardwareResult = await pool.query(`
      SELECT
        fh.id AS farm_hardware_id,
        fh.quantity,
        fh.is_running,
        fh.assigned_at,
        uh.id AS user_hardware_id,
        ht.id AS hardware_type_id,
        ht.name,
        ht.category,
        ht.hashrate,
        ht.hashrate_unit,
        ht.power_consumption
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.farm_id = $1
      ORDER BY fh.assigned_at DESC
    `, [id]);

    // Vypocty
    const farm = farmResult.rows[0];
    const hardware = hardwareResult.rows;

    // Aktualni spotreba (jen bezici hardware)
    const currentPower = hardware
      .filter(h => h.is_running)
      .reduce((sum, h) => sum + (h.power_consumption * h.quantity), 0);

    // Celkovy hashrate (zjednoduseno - ignoruje ruzne jednotky)
    // PLACEHOLDER: V budoucnu rozdelit podle kategorii
    const totalHashrate = hardware
      .filter(h => h.is_running)
      .reduce((sum, h) => sum + (parseFloat(h.hashrate) * h.quantity), 0);

    res.json({
      success: true,
      farm: {
        ...farm,
        current_power_watts: currentPower,
        total_hashrate: totalHashrate,
        hardware: hardware
      }
    });
  } catch (error) {
    console.error('Error fetching farm detail:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani detailu farmy'
    });
  }
});

// =============================================================================
// POST /api/farms - Vytvoreni nove farmy
// =============================================================================
// Vytvori novou farmu v danem prostoru
// Vyzaduje: space_id, name
router.post('/farms', async (req, res) => {
  const client = await pool.connect();

  try {
    const { space_id, name } = req.body;
    // TODO: Ziskat user_id ze session/JWT
    const userId = req.body.user_id || 1;

    // Validace vstupu
    if (!space_id) {
      return res.status(400).json({
        success: false,
        message: 'Chybi space_id'
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nazev farmy je povinny'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Nazev farmy je prilis dlouhy (max 100 znaku)'
      });
    }

    await client.query('BEGIN');

    // 1. Over ze prostor existuje a je dostupny
    const spaceResult = await client.query(`
      SELECT id, name, rent_usd_per_day
      FROM farm_spaces
      WHERE id = $1 AND is_available = true
      FOR UPDATE
    `, [space_id]);

    if (spaceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Prostor nenalezen nebo neni dostupny'
      });
    }

    const space = spaceResult.rows[0];

    // 2. Over ze uzivatel existuje
    const userResult = await client.query(`
      SELECT id FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Uzivatel nenalezen'
      });
    }

    // 3. Vytvor farmu
    const farmResult = await client.query(`
      INSERT INTO farms (user_id, space_id, name, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, is_active, created_at
    `, [userId, space_id, name.trim()]);

    const newFarm = farmResult.rows[0];

    // 4. Zaznamenej vytvoreni farmy (informativni transakce)
    // PLACEHOLDER: V budoucnu muze byt poplatek za zalozeni
    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'space_rent', 0, $2, $3)
    `, [userId, `Zalozeni farmy: ${name.trim()} v prostoru ${space.name}`, newFarm.id]);

    await client.query('COMMIT');

    // Log akce
    logAdminAction(`User ${userId} created farm "${name}" in space ${space.name}`, 'SYSTEM');

    res.json({
      success: true,
      message: `Farma "${name}" uspesne vytvorena!`,
      farm: {
        id: newFarm.id,
        name: newFarm.name,
        is_active: newFarm.is_active,
        created_at: newFarm.created_at,
        space_id: space_id,
        space_name: space.name,
        rent_usd_per_day: space.rent_usd_per_day
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating farm:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri vytvareni farmy'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// PUT /api/farms/:id - Uprava farmy (prejmenování)
// =============================================================================
// Upravi nazev farmy nebo jeji aktivni stav
router.put('/farms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    // TODO: Overit ze farma patri uzivateli
    const userId = req.body.user_id || 1;

    // Validace nazvu
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nazev farmy nemuze byt prazdny'
        });
      }
      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Nazev farmy je prilis dlouhy (max 100 znaku)'
        });
      }
    }

    // Over ze farma patri uzivateli
    const farmCheck = await pool.query(`
      SELECT id, name FROM farms WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (farmCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    const oldName = farmCheck.rows[0].name;

    // Sestav UPDATE dotaz
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(name.trim());
    }

    if (is_active !== undefined) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Zadne zmeny k provedeni'
      });
    }

    // Pridej updated_at
    updates.push(`updated_at = NOW()`);

    // Pridej WHERE podminky
    paramCount++;
    values.push(id);
    paramCount++;
    values.push(userId);

    const result = await pool.query(`
      UPDATE farms
      SET ${updates.join(', ')}
      WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
      RETURNING id, name, is_active, updated_at
    `, values);

    // Log akce
    if (name !== undefined && name !== oldName) {
      logAdminAction(`User ${userId} renamed farm from "${oldName}" to "${name}"`, 'SYSTEM');
    }

    res.json({
      success: true,
      message: 'Farma uspesne aktualizovana',
      farm: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating farm:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri aktualizaci farmy'
    });
  }
});

// =============================================================================
// DELETE /api/farms/:id - Zruseni farmy
// =============================================================================
// Smaze farmu a uvolni vschen prirazeny hardware zpet do inventare
router.delete('/farms/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    // TODO: Overit ze farma patri uzivateli
    const userId = req.query.user_id || 1;

    await client.query('BEGIN');

    // Over ze farma existuje a patri uzivateli
    const farmResult = await client.query(`
      SELECT f.id, f.name, fs.name AS space_name
      FROM farms f
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.id = $1 AND f.user_id = $2
      FOR UPDATE
    `, [id, userId]);

    if (farmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    const farm = farmResult.rows[0];

    // Hardware z farm_hardware se automaticky smaze diky ON DELETE CASCADE
    // Zaznamy v user_hardware zustanou - hardware se vrati do inventare

    // Smaz farmu
    await client.query(`
      DELETE FROM farms WHERE id = $1
    `, [id]);

    // Zaznamenej zruseni
    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'space_rent', 0, $2, NULL)
    `, [userId, `Zruseni farmy: ${farm.name}`]);

    await client.query('COMMIT');

    // Log akce
    logAdminAction(`User ${userId} deleted farm "${farm.name}"`, 'SYSTEM');

    res.json({
      success: true,
      message: `Farma "${farm.name}" byla zrusena. Hardware byl vracen do inventare.`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting farm:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri ruseni farmy'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// POST /api/farms/:id/upgrade - Upgrade prostoru farmy
// =============================================================================
// Presune farmu do vetsiho prostoru
// POZOR: Kontroluje ze novy prostor pojme aktualni spotrebu
router.post('/farms/:id/upgrade', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { new_space_id } = req.body;
    // TODO: Overit ze farma patri uzivateli
    const userId = req.body.user_id || 1;

    if (!new_space_id) {
      return res.status(400).json({
        success: false,
        message: 'Chybi new_space_id'
      });
    }

    await client.query('BEGIN');

    // Nacti aktualni farmu
    const farmResult = await client.query(`
      SELECT
        f.id,
        f.name,
        f.space_id,
        fs.name AS current_space_name,
        fs.sort_order AS current_sort_order,
        fs.max_power_watts AS current_max_power
      FROM farms f
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.id = $1 AND f.user_id = $2
      FOR UPDATE
    `, [id, userId]);

    if (farmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    const farm = farmResult.rows[0];

    // Nacti novy prostor
    const newSpaceResult = await client.query(`
      SELECT id, name, max_power_watts, rent_usd_per_day, sort_order
      FROM farm_spaces
      WHERE id = $1 AND is_available = true
    `, [new_space_id]);

    if (newSpaceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Novy prostor nenalezen nebo neni dostupny'
      });
    }

    const newSpace = newSpaceResult.rows[0];

    // Over ze novy prostor je vetsi (nebo aspon stejny)
    if (newSpace.sort_order < farm.current_sort_order) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Nelze prejit na mensi prostor. Pro downgrade zruste farmu a vytvorte novou.'
      });
    }

    if (newSpace.id === farm.space_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Farma uz je v tomto prostoru'
      });
    }

    // Spocitej aktualni spotrebu farmy
    const powerResult = await client.query(`
      SELECT COALESCE(SUM(ht.power_consumption * fh.quantity), 0) AS current_power
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.farm_id = $1 AND fh.is_running = true
    `, [id]);

    const currentPower = parseInt(powerResult.rows[0].current_power);

    // Over ze novy prostor pojme aktualni hardware
    // (Tohle by nemelo nastat pri upgrade na vetsi prostor, ale pro jistotu)
    if (currentPower > newSpace.max_power_watts) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Novy prostor nemuze pojmout aktualni hardware (${currentPower}W > ${newSpace.max_power_watts}W)`
      });
    }

    // Proved upgrade
    await client.query(`
      UPDATE farms
      SET space_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [new_space_id, id]);

    // Zaznamenej upgrade
    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'space_rent', 0, $2, $3)
    `, [userId, `Upgrade farmy ${farm.name}: ${farm.current_space_name} -> ${newSpace.name}`, id]);

    await client.query('COMMIT');

    // Log akce
    logAdminAction(`User ${userId} upgraded farm "${farm.name}" from ${farm.current_space_name} to ${newSpace.name}`, 'SYSTEM');

    res.json({
      success: true,
      message: `Farma uspesne upgradovana na ${newSpace.name}!`,
      farm: {
        id: id,
        name: farm.name,
        new_space_id: newSpace.id,
        new_space_name: newSpace.name,
        new_max_power_watts: newSpace.max_power_watts,
        new_rent_usd_per_day: newSpace.rent_usd_per_day
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error upgrading farm:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri upgrade farmy'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/farms/available-hardware - Volny hardware k prirazeni
// =============================================================================
// Vraci hardware uzivatele ktery neni prirazen k zadne farme
router.get('/farms/available-hardware', async (req, res) => {
  try {
    // TODO: Ziskat user_id ze session
    const userId = req.query.user_id || 1;

    // Pouzijeme slozitejsi dotaz misto view - view ma UNIQUE constraint
    const result = await pool.query(`
      SELECT
        uh.id AS user_hardware_id,
        uh.hardware_type_id,
        uh.quantity AS total_quantity,
        uh.is_active,
        uh.purchased_at,
        ht.name,
        ht.category,
        ht.hashrate,
        ht.hashrate_unit,
        ht.power_consumption,
        -- Kolik kusu je prirazeno k farmam
        COALESCE(
          (SELECT SUM(fh.quantity) FROM farm_hardware fh WHERE fh.user_hardware_id = uh.id),
          0
        ) AS assigned_quantity
      FROM user_hardware uh
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE uh.user_id = $1
      ORDER BY ht.category, ht.name
    `, [userId]);

    // Vypocitej volne kusy a filtruj pouze ty s volnym hardwarem
    const availableHardware = result.rows
      .map(hw => ({
        ...hw,
        available_quantity: hw.total_quantity - parseInt(hw.assigned_quantity)
      }))
      .filter(hw => hw.available_quantity > 0);

    res.json({
      success: true,
      hardware: availableHardware
    });
  } catch (error) {
    console.error('Error fetching available hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani volneho hardwaru'
    });
  }
});

// =============================================================================
// GET /api/farms/:id/hardware - Hardware prirazeny k farme
// =============================================================================
// Vraci seznam hardwaru prirazeneho k dane farme
router.get('/farms/:id/hardware', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Overit pristup
    const userId = req.query.user_id || 1;

    // Over ze farma patri uzivateli
    const farmCheck = await pool.query(`
      SELECT id FROM farms WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (farmCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    // Nacti hardware
    const result = await pool.query(`
      SELECT
        fh.id AS farm_hardware_id,
        fh.quantity,
        fh.is_running,
        fh.assigned_at,
        uh.id AS user_hardware_id,
        ht.id AS hardware_type_id,
        ht.name,
        ht.category,
        ht.hashrate,
        ht.hashrate_unit,
        ht.power_consumption,
        (ht.power_consumption * fh.quantity) AS total_power,
        (ht.hashrate * fh.quantity) AS total_hashrate
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.farm_id = $1
      ORDER BY fh.assigned_at DESC
    `, [id]);

    res.json({
      success: true,
      hardware: result.rows
    });
  } catch (error) {
    console.error('Error fetching farm hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani hardwaru farmy'
    });
  }
});

// =============================================================================
// POST /api/farms/:id/hardware - Prirazeni hardwaru k farme
// =============================================================================
// Priradi hardware z inventare k farme
// Vyzaduje: user_hardware_id, quantity
router.post('/farms/:id/hardware', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { user_hardware_id, quantity = 1 } = req.body;
    // TODO: Overit ze farma patri uzivateli
    const userId = req.body.user_id || 1;

    // Validace vstupu
    if (!user_hardware_id) {
      return res.status(400).json({
        success: false,
        message: 'Chybi user_hardware_id'
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Pocet musi byt alespon 1'
      });
    }

    await client.query('BEGIN');

    // 1. Over ze farma existuje a patri uzivateli
    const farmResult = await client.query(`
      SELECT f.id, f.name, fs.max_power_watts
      FROM farms f
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.id = $1 AND f.user_id = $2
      FOR UPDATE
    `, [id, userId]);

    if (farmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    const farm = farmResult.rows[0];

    // 2. Over ze hardware patri uzivateli a zjisti kolik kusu ma volnych
    const hwResult = await client.query(`
      SELECT
        uh.id,
        uh.quantity AS total_quantity,
        ht.name AS hardware_name,
        ht.power_consumption,
        ht.hashrate,
        ht.hashrate_unit,
        COALESCE(
          (SELECT SUM(fh.quantity) FROM farm_hardware fh WHERE fh.user_hardware_id = uh.id),
          0
        ) AS assigned_quantity
      FROM user_hardware uh
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE uh.id = $1 AND uh.user_id = $2
      FOR UPDATE
    `, [user_hardware_id, userId]);

    if (hwResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Hardware nenalezen v inventari'
      });
    }

    const hw = hwResult.rows[0];
    const availableQuantity = hw.total_quantity - parseInt(hw.assigned_quantity);

    if (quantity > availableQuantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Nedostatek volneho hardwaru. Dostupne: ${availableQuantity} kusu`
      });
    }

    // 3. Zkontroluj ze nova spotreba neprekroci kapacitu prostoru
    const currentPowerResult = await client.query(`
      SELECT COALESCE(SUM(ht.power_consumption * fh.quantity), 0) AS current_power
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.farm_id = $1 AND fh.is_running = true
    `, [id]);

    const currentPower = parseInt(currentPowerResult.rows[0].current_power);
    const additionalPower = hw.power_consumption * quantity;
    const newTotalPower = currentPower + additionalPower;

    if (newTotalPower > farm.max_power_watts) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Prekrocena kapacita prostoru! Aktualne: ${currentPower}W, Pridavam: ${additionalPower}W, Max: ${farm.max_power_watts}W`,
        details: {
          current_power: currentPower,
          additional_power: additionalPower,
          max_power: farm.max_power_watts
        }
      });
    }

    // 4. Zkontroluj jestli uz tento hardware neni prirazen k jine farme
    // (UNIQUE constraint na user_hardware_id v farm_hardware)
    const existingAssignment = await client.query(`
      SELECT fh.id, f.name AS farm_name
      FROM farm_hardware fh
      JOIN farms f ON f.id = fh.farm_id
      WHERE fh.user_hardware_id = $1
    `, [user_hardware_id]);

    if (existingAssignment.rows.length > 0) {
      // Hardware uz je prirazen - update quantity nebo chyba
      const existing = existingAssignment.rows[0];

      if (existing.farm_name !== farm.name) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Tento hardware je uz prirazen k farme "${existing.farm_name}". Nejprve ho odeberte.`
        });
      }

      // Stejna farma - zvysime quantity
      await client.query(`
        UPDATE farm_hardware
        SET quantity = quantity + $1
        WHERE id = $2
      `, [quantity, existing.id]);
    } else {
      // Novy zaznam
      await client.query(`
        INSERT INTO farm_hardware (farm_id, user_hardware_id, quantity, is_running)
        VALUES ($1, $2, $3, true)
      `, [id, user_hardware_id, quantity]);
    }

    await client.query('COMMIT');

    // Log akce
    logAdminAction(`User ${userId} assigned ${quantity}x ${hw.hardware_name} to farm "${farm.name}"`, 'SYSTEM');

    res.json({
      success: true,
      message: `${quantity}x ${hw.hardware_name} prirazeno k farme!`,
      farm: {
        id: id,
        name: farm.name,
        new_total_power: newTotalPower,
        max_power: farm.max_power_watts
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning hardware to farm:', error);

    // Zpracuj UNIQUE constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Tento hardware je uz prirazen k farme'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Chyba pri prirazeni hardwaru'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// DELETE /api/farms/:id/hardware/:hwId - Odebrani hardwaru z farmy
// =============================================================================
// Odebere hardware z farmy zpet do inventare
router.delete('/farms/:id/hardware/:hwId', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, hwId } = req.params;
    // TODO: Overit ze farma patri uzivateli
    const userId = req.query.user_id || 1;

    await client.query('BEGIN');

    // Over ze farma patri uzivateli
    const farmResult = await client.query(`
      SELECT id, name FROM farms WHERE id = $1 AND user_id = $2
      FOR UPDATE
    `, [id, userId]);

    if (farmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    const farm = farmResult.rows[0];

    // Najdi prirazeny hardware
    const hwResult = await client.query(`
      SELECT fh.id, fh.quantity, ht.name AS hardware_name
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.id = $1 AND fh.farm_id = $2
    `, [hwId, id]);

    if (hwResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Hardware nenalezen ve farme'
      });
    }

    const hw = hwResult.rows[0];

    // Smaz prirazeni
    await client.query(`
      DELETE FROM farm_hardware WHERE id = $1
    `, [hwId]);

    await client.query('COMMIT');

    // Log akce
    logAdminAction(`User ${userId} removed ${hw.quantity}x ${hw.hardware_name} from farm "${farm.name}"`, 'SYSTEM');

    res.json({
      success: true,
      message: `${hw.quantity}x ${hw.hardware_name} odebrano z farmy a vraceno do inventare`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing hardware from farm:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri odebirani hardwaru'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// PUT /api/farms/:id/hardware/:hwId/toggle - Zapnuti/vypnuti hardwaru
// =============================================================================
// PLACEHOLDER: Prepne stav is_running pro hardware ve farme
// Vypnuty hardware nespotrebovava elektrinu ale ani netezi
router.put('/farms/:id/hardware/:hwId/toggle', async (req, res) => {
  try {
    const { id, hwId } = req.params;
    // TODO: Overit pristup
    const userId = req.body.user_id || 1;

    // Over ze farma patri uzivateli
    const farmCheck = await pool.query(`
      SELECT id FROM farms WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (farmCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farma nenalezena'
      });
    }

    // Prepni stav
    const result = await pool.query(`
      UPDATE farm_hardware
      SET is_running = NOT is_running
      WHERE id = $1 AND farm_id = $2
      RETURNING id, is_running
    `, [hwId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hardware nenalezen ve farme'
      });
    }

    const newState = result.rows[0].is_running;

    res.json({
      success: true,
      message: newState ? 'Hardware zapnut' : 'Hardware vypnut',
      is_running: newState
    });

  } catch (error) {
    console.error('Error toggling hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri prepinani stavu hardwaru'
    });
  }
});

module.exports = router;

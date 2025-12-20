/**
 * =============================================================================
 * MINEOPS - HARDWARE API ROUTES
 * =============================================================================
 *
 * API endpointy pro spravu hardwaru:
 * - GET /api/hardware - Seznam dostupneho hardwaru
 * - GET /api/hardware/:id - Detail konkretniho hardwaru
 * - POST /api/hardware/purchase - Nakup hardwaru
 * - GET /api/user/wallet - Zustatek uzivatele
 * - GET /api/user/hardware - Hardware uzivatele
 *
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { logAdminAction } = require('../config/gameConfig');

// =============================================================================
// GET /api/hardware - Seznam vseho dostupneho hardwaru
// =============================================================================
// Vraci vsechny dostupne polozky hardware shopu
router.get('/hardware', async (req, res) => {
  try {
    // Dotaz na vsechny dostupne polozky serazene podle kategorie a ceny
    const result = await pool.query(`
      SELECT
        id,
        name,
        category,
        hashrate,
        hashrate_unit,
        power_consumption,
        price_usd,
        description,
        is_available
      FROM hardware_types
      WHERE is_available = true
      ORDER BY
        CASE category
          WHEN 'btc_asic' THEN 1
          WHEN 'doge_asic' THEN 2
          WHEN 'xmr_asic' THEN 3
          WHEN 'solo' THEN 4
        END,
        price_usd ASC
    `);

    res.json({
      success: true,
      hardware: result.rows
    });
  } catch (error) {
    console.error('Error fetching hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani hardwaru'
    });
  }
});

// =============================================================================
// GET /api/hardware/:id - Detail jednoho hardwaru
// =============================================================================
// Vraci detailni informace o konkretnim hardware
router.get('/hardware/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM hardware_types
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hardware nenalezen'
      });
    }

    res.json({
      success: true,
      hardware: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching hardware detail:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani detailu hardwaru'
    });
  }
});

// =============================================================================
// POST /api/hardware/purchase - Nakup hardwaru
// =============================================================================
// Zpracuje nakup hardwaru pro uzivatele
// Vyzaduje: hardware_id v body
// TODO: Pouzit session/JWT pro identifikaci uzivatele
router.post('/hardware/purchase', async (req, res) => {
  // Zacatek transakce pro atomicitu operace
  const client = await pool.connect();

  try {
    const { hardware_id } = req.body;

    // TODO: Ziskat user_id ze session/JWT - zatim pouzivame pevne ID pro testovani
    const userId = req.body.user_id || 1;

    // Validace vstupu
    if (!hardware_id) {
      return res.status(400).json({
        success: false,
        message: 'Chybi hardware_id'
      });
    }

    await client.query('BEGIN');

    // 1. Nacti hardware a over dostupnost
    const hardwareResult = await client.query(`
      SELECT id, name, price_usd, is_available
      FROM hardware_types
      WHERE id = $1
      FOR UPDATE
    `, [hardware_id]);

    if (hardwareResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Hardware nenalezen'
      });
    }

    const hardware = hardwareResult.rows[0];

    if (!hardware.is_available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Hardware neni momentalne dostupny'
      });
    }

    // 2. Nacti zustatek uzivatele a over dostatek penez
    const userResult = await client.query(`
      SELECT id, balance_usd
      FROM users
      WHERE id = $1
      FOR UPDATE
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Uzivatel nenalezen'
      });
    }

    const user = userResult.rows[0];
    const price = parseFloat(hardware.price_usd);
    const balance = parseFloat(user.balance_usd);

    if (balance < price) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Nedostatek USD. Potrebujes $${price.toFixed(2)}, mas $${balance.toFixed(2)}`
      });
    }

    // 3. Odecti cenu z uzivatele
    const newBalance = balance - price;
    await client.query(`
      UPDATE users
      SET balance_usd = $1, updated_at = NOW()
      WHERE id = $2
    `, [newBalance, userId]);

    // 4. Pridej hardware do inventare uzivatele
    // Zkontroluj jestli uz ma tento typ - pokud ano, zvys quantity
    const existingResult = await client.query(`
      SELECT id, quantity
      FROM user_hardware
      WHERE user_id = $1 AND hardware_type_id = $2
    `, [userId, hardware_id]);

    if (existingResult.rows.length > 0) {
      // Uzivatel uz ma tento hardware - zvys pocet
      await client.query(`
        UPDATE user_hardware
        SET quantity = quantity + 1
        WHERE id = $1
      `, [existingResult.rows[0].id]);
    } else {
      // Novy hardware v inventari
      await client.query(`
        INSERT INTO user_hardware (user_id, hardware_type_id, quantity, is_active)
        VALUES ($1, $2, 1, true)
      `, [userId, hardware_id]);
    }

    // 5. Zaznamenej transakci
    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'purchase', $2, $3, $4)
    `, [userId, -price, `Nakup: ${hardware.name}`, hardware_id]);

    // Commit transakce
    await client.query('COMMIT');

    // Log akce pro admin panel
    logAdminAction(`User ${userId} purchased ${hardware.name} for $${price}`, 'SYSTEM');

    res.json({
      success: true,
      message: `${hardware.name} uspesne zakoupe!`,
      new_balance_usd: newBalance,
      purchased_hardware: hardware.name
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error purchasing hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nakupu hardwaru'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/user/wallet - Zustatek uzivatele
// =============================================================================
// Vraci aktualni zustatky uzivatele (USD a BTC)
// TODO: Pouzit session/JWT pro identifikaci uzivatele
router.get('/user/wallet', async (req, res) => {
  try {
    // TODO: Ziskat user_id ze session - zatim pouzivame pevne ID
    const userId = req.query.user_id || 1;

    const result = await pool.query(`
      SELECT balance_usd, balance
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Pro testovani - kdyz uzivatel neexistuje, vrat default hodnoty
      return res.json({
        success: true,
        wallet: {
          usd: 10000.00,  // Testovaci zustatek
          btc: 0.00000000
        }
      });
    }

    res.json({
      success: true,
      wallet: {
        usd: parseFloat(result.rows[0].balance_usd) || 0,
        btc: parseFloat(result.rows[0].balance) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    // V pripade chyby vrat testovaci hodnoty pro development
    res.json({
      success: true,
      wallet: {
        usd: 10000.00,
        btc: 0.00000000
      }
    });
  }
});

// =============================================================================
// GET /api/user/hardware - Hardware uzivatele
// =============================================================================
// Vraci seznam hardwaru vlastneneho uzivatelem
// TODO: Pouzit session/JWT pro identifikaci uzivatele
router.get('/user/hardware', async (req, res) => {
  try {
    // TODO: Ziskat user_id ze session
    const userId = req.query.user_id || 1;

    const result = await pool.query(`
      SELECT
        uh.id,
        uh.quantity,
        uh.is_active,
        uh.purchased_at,
        ht.name,
        ht.category,
        ht.hashrate,
        ht.hashrate_unit,
        ht.power_consumption,
        ht.price_usd
      FROM user_hardware uh
      JOIN hardware_types ht ON uh.hardware_type_id = ht.id
      WHERE uh.user_id = $1
      ORDER BY uh.purchased_at DESC
    `, [userId]);

    res.json({
      success: true,
      hardware: result.rows
    });
  } catch (error) {
    console.error('Error fetching user hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani inventare'
    });
  }
});

// =============================================================================
// GET /api/hardware/categories - Seznam kategorii
// =============================================================================
// Vraci dostupne kategorie hardwaru
router.get('/hardware/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM hardware_types
      WHERE is_available = true
      GROUP BY category
      ORDER BY
        CASE category
          WHEN 'btc_asic' THEN 1
          WHEN 'doge_asic' THEN 2
          WHEN 'xmr_asic' THEN 3
          WHEN 'solo' THEN 4
        END
    `);

    res.json({
      success: true,
      categories: result.rows.map(row => ({
        id: row.category,
        name: getCategoryName(row.category),
        count: parseInt(row.count)
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Chyba pri nacitani kategorii'
    });
  }
});

// =============================================================================
// POMOCNE FUNKCE
// =============================================================================

/**
 * Prevede ID kategorie na citelny nazev
 * @param {string} category - ID kategorie
 * @returns {string} Citelny nazev
 */
function getCategoryName(category) {
  const names = {
    'btc_asic': 'Bitcoin ASIC',
    'doge_asic': 'Dogecoin ASIC',
    'xmr_asic': 'Monero Mining',
    'solo': 'Solo Mining'
  };
  return names[category] || category;
}

module.exports = router;

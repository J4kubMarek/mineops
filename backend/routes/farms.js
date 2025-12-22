/**
 * =============================================================================
 * MINEOPS - FARM API ROUTES
 * =============================================================================
 *
 * API endpoints for managing mining farms:
 *
 * SPACES:
 * - GET /api/farm-spaces - List available spaces
 *
 * FARMS:
 * - GET /api/farms - List user's farms
 * - GET /api/farms/available-hardware - Hardware not assigned to any farm
 * - GET /api/farms/:id - Farm details
 * - POST /api/farms - Create new farm
 * - PUT /api/farms/:id - Update farm (rename)
 * - DELETE /api/farms/:id - Delete farm
 * - POST /api/farms/:id/upgrade - Upgrade farm space
 *
 * HARDWARE ASSIGNMENT:
 * - GET /api/farms/:id/hardware - Hardware in farm
 * - POST /api/farms/:id/hardware - Assign hardware to farm
 * - DELETE /api/farms/:id/hardware/:hwId - Remove hardware from farm
 *
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { logAdminAction } = require('../config/gameConfig');

// =============================================================================
// GET /api/farm-spaces - List available spaces
// =============================================================================
router.get('/farm-spaces', async (req, res) => {
  try {
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
      message: 'Error loading spaces'
    });
  }
});

// =============================================================================
// GET /api/farms/available-hardware - Available hardware for assignment
// =============================================================================
// IMPORTANT: This route MUST be before /farms/:id to avoid matching as ID
router.get('/farms/available-hardware', async (req, res) => {
  try {
    const userId = req.query.user_id || 1;

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
        COALESCE(
          (SELECT SUM(fh.quantity) FROM farm_hardware fh WHERE fh.user_hardware_id = uh.id),
          0
        ) AS assigned_quantity
      FROM user_hardware uh
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE uh.user_id = $1
      ORDER BY ht.category, ht.name
    `, [userId]);

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
      message: 'Error loading available hardware'
    });
  }
});

// =============================================================================
// GET /api/farms - List user's farms
// =============================================================================
router.get('/farms', async (req, res) => {
  try {
    const userId = req.query.user_id || 1;

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
      message: 'Error loading farms'
    });
  }
});

// =============================================================================
// GET /api/farms/:id - Farm details
// =============================================================================
router.get('/farms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.user_id || 1;

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
        message: 'Farm not found'
      });
    }

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

    const farm = farmResult.rows[0];
    const hardware = hardwareResult.rows;

    const currentPower = hardware
      .filter(h => h.is_running)
      .reduce((sum, h) => sum + (h.power_consumption * h.quantity), 0);

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
      message: 'Error loading farm details'
    });
  }
});

// =============================================================================
// POST /api/farms - Create new farm
// =============================================================================
router.post('/farms', async (req, res) => {
  const client = await pool.connect();

  try {
    const { space_id, name } = req.body;
    const userId = req.body.user_id || 1;

    if (!space_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing space_id'
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Farm name is required'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Farm name is too long (max 100 characters)'
      });
    }

    await client.query('BEGIN');

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
        message: 'Space not found or not available'
      });
    }

    const space = spaceResult.rows[0];

    const userResult = await client.query(`
      SELECT id FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const farmResult = await client.query(`
      INSERT INTO farms (user_id, space_id, name, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, is_active, created_at
    `, [userId, space_id, name.trim()]);

    const newFarm = farmResult.rows[0];

    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'space_rent', 0, $2, $3)
    `, [userId, `Created farm: ${name.trim()} in ${space.name}`, newFarm.id]);

    await client.query('COMMIT');

    logAdminAction(`User ${userId} created farm "${name}" in space ${space.name}`, 'SYSTEM');

    res.json({
      success: true,
      message: `Farm "${name}" created successfully!`,
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
      message: 'Error creating farm'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// PUT /api/farms/:id - Update farm (rename)
// =============================================================================
router.put('/farms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    const userId = req.body.user_id || 1;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Farm name cannot be empty'
        });
      }
      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Farm name is too long (max 100 characters)'
        });
      }
    }

    const farmCheck = await pool.query(`
      SELECT id, name FROM farms WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (farmCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found'
      });
    }

    const oldName = farmCheck.rows[0].name;

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
        message: 'No changes to apply'
      });
    }

    updates.push(`updated_at = NOW()`);

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

    if (name !== undefined && name !== oldName) {
      logAdminAction(`User ${userId} renamed farm from "${oldName}" to "${name}"`, 'SYSTEM');
    }

    res.json({
      success: true,
      message: 'Farm updated successfully',
      farm: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating farm:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating farm'
    });
  }
});

// =============================================================================
// DELETE /api/farms/:id - Delete farm
// =============================================================================
router.delete('/farms/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.query.user_id || 1;

    await client.query('BEGIN');

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
        message: 'Farm not found'
      });
    }

    const farm = farmResult.rows[0];

    await client.query(`
      DELETE FROM farms WHERE id = $1
    `, [id]);

    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'space_rent', 0, $2, NULL)
    `, [userId, `Deleted farm: ${farm.name}`]);

    await client.query('COMMIT');

    logAdminAction(`User ${userId} deleted farm "${farm.name}"`, 'SYSTEM');

    res.json({
      success: true,
      message: `Farm "${farm.name}" deleted. Hardware returned to inventory.`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting farm:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting farm'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// POST /api/farms/:id/upgrade - Upgrade farm space
// =============================================================================
router.post('/farms/:id/upgrade', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { new_space_id } = req.body;
    const userId = req.body.user_id || 1;

    if (!new_space_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing new_space_id'
      });
    }

    await client.query('BEGIN');

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
        message: 'Farm not found'
      });
    }

    const farm = farmResult.rows[0];

    const newSpaceResult = await client.query(`
      SELECT id, name, max_power_watts, rent_usd_per_day, sort_order
      FROM farm_spaces
      WHERE id = $1 AND is_available = true
    `, [new_space_id]);

    if (newSpaceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'New space not found or not available'
      });
    }

    const newSpace = newSpaceResult.rows[0];

    if (newSpace.sort_order < farm.current_sort_order) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot downgrade to a smaller space. Delete the farm and create a new one.'
      });
    }

    if (newSpace.id === farm.space_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Farm is already in this space'
      });
    }

    const powerResult = await client.query(`
      SELECT COALESCE(SUM(ht.power_consumption * fh.quantity), 0) AS current_power
      FROM farm_hardware fh
      JOIN user_hardware uh ON uh.id = fh.user_hardware_id
      JOIN hardware_types ht ON ht.id = uh.hardware_type_id
      WHERE fh.farm_id = $1 AND fh.is_running = true
    `, [id]);

    const currentPower = parseInt(powerResult.rows[0].current_power);

    if (currentPower > newSpace.max_power_watts) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `New space cannot accommodate current hardware (${currentPower}W > ${newSpace.max_power_watts}W)`
      });
    }

    await client.query(`
      UPDATE farms
      SET space_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [new_space_id, id]);

    await client.query(`
      INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      VALUES ($1, 'space_rent', 0, $2, $3)
    `, [userId, `Farm upgrade ${farm.name}: ${farm.current_space_name} -> ${newSpace.name}`, id]);

    await client.query('COMMIT');

    logAdminAction(`User ${userId} upgraded farm "${farm.name}" from ${farm.current_space_name} to ${newSpace.name}`, 'SYSTEM');

    res.json({
      success: true,
      message: `Farm successfully upgraded to ${newSpace.name}!`,
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
      message: 'Error upgrading farm'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/farms/:id/hardware - Hardware assigned to farm
// =============================================================================
router.get('/farms/:id/hardware', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.user_id || 1;

    const farmCheck = await pool.query(`
      SELECT id FROM farms WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (farmCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found'
      });
    }

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
      message: 'Error loading farm hardware'
    });
  }
});

// =============================================================================
// POST /api/farms/:id/hardware - Assign hardware to farm
// =============================================================================
router.post('/farms/:id/hardware', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { user_hardware_id, quantity = 1 } = req.body;
    const userId = req.body.user_id || 1;

    if (!user_hardware_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing user_hardware_id'
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    await client.query('BEGIN');

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
        message: 'Farm not found'
      });
    }

    const farm = farmResult.rows[0];

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
        message: 'Hardware not found in inventory'
      });
    }

    const hw = hwResult.rows[0];
    const availableQuantity = hw.total_quantity - parseInt(hw.assigned_quantity);

    if (quantity > availableQuantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Not enough available hardware. Available: ${availableQuantity} units`
      });
    }

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
        message: `Space capacity exceeded! Current: ${currentPower}W, Adding: ${additionalPower}W, Max: ${farm.max_power_watts}W`,
        details: {
          current_power: currentPower,
          additional_power: additionalPower,
          max_power: farm.max_power_watts
        }
      });
    }

    const existingAssignment = await client.query(`
      SELECT fh.id, f.name AS farm_name
      FROM farm_hardware fh
      JOIN farms f ON f.id = fh.farm_id
      WHERE fh.user_hardware_id = $1
    `, [user_hardware_id]);

    if (existingAssignment.rows.length > 0) {
      const existing = existingAssignment.rows[0];

      if (existing.farm_name !== farm.name) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `This hardware is already assigned to farm "${existing.farm_name}". Remove it first.`
        });
      }

      await client.query(`
        UPDATE farm_hardware
        SET quantity = quantity + $1
        WHERE id = $2
      `, [quantity, existing.id]);
    } else {
      await client.query(`
        INSERT INTO farm_hardware (farm_id, user_hardware_id, quantity, is_running)
        VALUES ($1, $2, $3, true)
      `, [id, user_hardware_id, quantity]);
    }

    await client.query('COMMIT');

    logAdminAction(`User ${userId} assigned ${quantity}x ${hw.hardware_name} to farm "${farm.name}"`, 'SYSTEM');

    res.json({
      success: true,
      message: `${quantity}x ${hw.hardware_name} assigned to farm!`,
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

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'This hardware is already assigned to a farm'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error assigning hardware'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// DELETE /api/farms/:id/hardware/:hwId - Remove hardware from farm
// =============================================================================
router.delete('/farms/:id/hardware/:hwId', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, hwId } = req.params;
    const userId = req.query.user_id || 1;

    await client.query('BEGIN');

    const farmResult = await client.query(`
      SELECT id, name FROM farms WHERE id = $1 AND user_id = $2
      FOR UPDATE
    `, [id, userId]);

    if (farmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Farm not found'
      });
    }

    const farm = farmResult.rows[0];

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
        message: 'Hardware not found in farm'
      });
    }

    const hw = hwResult.rows[0];

    await client.query(`
      DELETE FROM farm_hardware WHERE id = $1
    `, [hwId]);

    await client.query('COMMIT');

    logAdminAction(`User ${userId} removed ${hw.quantity}x ${hw.hardware_name} from farm "${farm.name}"`, 'SYSTEM');

    res.json({
      success: true,
      message: `${hw.quantity}x ${hw.hardware_name} removed from farm and returned to inventory`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing hardware from farm:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing hardware'
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// PUT /api/farms/:id/hardware/:hwId/toggle - Toggle hardware on/off
// =============================================================================
router.put('/farms/:id/hardware/:hwId/toggle', async (req, res) => {
  try {
    const { id, hwId } = req.params;
    const userId = req.body.user_id || 1;

    const farmCheck = await pool.query(`
      SELECT id FROM farms WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (farmCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found'
      });
    }

    const result = await pool.query(`
      UPDATE farm_hardware
      SET is_running = NOT is_running
      WHERE id = $1 AND farm_id = $2
      RETURNING id, is_running
    `, [hwId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hardware not found in farm'
      });
    }

    const newState = result.rows[0].is_running;

    res.json({
      success: true,
      message: newState ? 'Hardware turned on' : 'Hardware turned off',
      is_running: newState
    });

  } catch (error) {
    console.error('Error toggling hardware:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling hardware state'
    });
  }
});

module.exports = router;

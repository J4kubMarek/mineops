/**
 * =============================================================================
 * MINEOPS - ADMIN API ROUTES
 * =============================================================================
 *
 * API endpointy pro Admin Panel.
 *
 * BEZPEČNOST: V produkci musí být chráněny autentizací!
 * PLACEHOLDER: Autentizace bude přidána po implementaci user systému.
 *
 * Endpointy:
 * - GET  /api/admin/status      - Stav serveru a enginu
 * - GET  /api/admin/config      - Aktuální konfigurace
 * - POST /api/admin/config      - Aktualizace konfigurace
 * - GET  /api/admin/logs        - Admin log
 * - POST /api/admin/prices/refresh - Vynucené obnovení cen
 * - POST /api/admin/user/kick   - Kick uživatele
 * - POST /api/admin/user/ban    - Ban uživatele
 * - POST /api/admin/user/gift   - Darování resources
 * - POST /api/admin/broadcast   - Broadcast zprávy
 * - POST /api/admin/maintenance - Přepnutí maintenance mode
 *
 * =============================================================================
 */

const express = require('express');
const router = express.Router();

const { GameConfig, updateConfig, getConfig, getAdminLog, logAdminAction } = require('../config/gameConfig');
const gameEngine = require('../engine/gameEngine');
const priceService = require('../services/priceService');

// PLACEHOLDER: Import databáze až bude implementována
// const db = require('../../config/database');

/**
 * =============================================================================
 * MIDDLEWARE
 * =============================================================================
 */

/**
 * PLACEHOLDER: Admin autentizace middleware
 *
 * V produkci by mělo kontrolovat:
 * - Validní session
 * - Admin role (is_admin = true v DB)
 * - Rate limiting
 *
 * Pro MVP je autentizace vypnutá!
 */
function adminAuthMiddleware(req, res, next) {
  // PLACEHOLDER: Autentizace vypnutá pro vývoj
  // V produkci odkomentujte následující kód:
  //
  // if (!req.session || !req.session.user) {
  //   return res.status(401).json({ error: 'Unauthorized', message: 'Login required' });
  // }
  //
  // if (!req.session.user.is_admin) {
  //   logAdminAction(`Unauthorized admin access attempt by user: ${req.session.user.username}`);
  //   return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  // }

  // Pro vývoj: Nastavíme mock admin uživatele
  req.adminUser = {
    id: 0,
    username: 'DEV_ADMIN',
    isAdmin: true,
  };

  next();
}

// Aplikovat middleware na všechny admin routes
router.use(adminAuthMiddleware);

/**
 * =============================================================================
 * STATUS & MONITORING
 * =============================================================================
 */

/**
 * GET /api/admin/status
 * Vrátí kompletní stav serveru pro Live Monitoring sekci
 */
router.get('/status', (req, res) => {
  try {
    const engineStatus = gameEngine.getEngineStatus();
    const prices = priceService.getPrices();

    res.json({
      success: true,
      data: {
        // Server info
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
        },

        // Engine status
        engine: engineStatus,

        // Aktuální ceny
        prices: prices,

        // Rychlý přehled
        summary: {
          isOnline: engineStatus.isRunning,
          tickInterval: engineStatus.tickInterval,
          lastTickDelta: engineStatus.tickDelta,
          activeConnections: engineStatus.stats.activeConnections,
          totalTicks: engineStatus.totalTicks,
          maintenanceMode: GameConfig.override.maintenanceMode,
        },
      },
    });
  } catch (error) {
    console.error('[Admin API] Error in /status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

/**
 * GET /api/admin/config
 * Vrátí aktuální herní konfiguraci
 */
router.get('/config', (req, res) => {
  try {
    const config = getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[Admin API] Error in GET /config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get config',
    });
  }
});

/**
 * POST /api/admin/config
 * Aktualizuje herní konfiguraci
 *
 * Body: { section: string, key: string, value: any }
 * Nebo: { updates: [{ section, key, value }, ...] } pro hromadné změny
 */
router.post('/config', (req, res) => {
  try {
    const { section, key, value, updates } = req.body;
    const adminUsername = req.adminUser.username;

    let results = [];

    // Hromadná aktualizace
    if (updates && Array.isArray(updates)) {
      for (const update of updates) {
        const success = updateConfig(update.section, update.key, update.value);
        results.push({
          section: update.section,
          key: update.key,
          success,
        });
      }
    }
    // Jednotlivá aktualizace
    else if (section && key !== undefined) {
      const success = updateConfig(section, key, value);
      results.push({ section, key, success });
    }
    else {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Provide { section, key, value } or { updates: [...] }',
      });
    }

    // Kontrola, zda je potřeba restartovat něco
    const needsEngineRestart = results.some(r =>
      r.section === 'system' && r.key === 'tickInterval' && r.success
    );
    const needsPriceRestart = results.some(r =>
      r.section === 'system' && r.key === 'priceUpdateInterval' && r.success
    );

    if (needsEngineRestart) {
      gameEngine.restartEngine();
    }
    if (needsPriceRestart) {
      priceService.restartWithNewInterval();
    }

    logAdminAction(`Config updated by ${adminUsername}: ${JSON.stringify(results)}`, adminUsername);

    res.json({
      success: true,
      results,
      config: getConfig(),
    });

  } catch (error) {
    console.error('[Admin API] Error in POST /config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update config',
      message: error.message,
    });
  }
});

/**
 * =============================================================================
 * ADMIN LOG
 * =============================================================================
 */

/**
 * GET /api/admin/logs
 * Vrátí admin log (historie akcí)
 *
 * Query: ?limit=50 (volitelné)
 */
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = getAdminLog(limit);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('[Admin API] Error in /logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get logs',
    });
  }
});

/**
 * =============================================================================
 * PRICE MANAGEMENT
 * =============================================================================
 */

/**
 * POST /api/admin/prices/refresh
 * Vynutí okamžité obnovení cen z API
 */
router.post('/prices/refresh', async (req, res) => {
  try {
    const adminUsername = req.adminUser.username;

    await priceService.forceUpdate();
    const prices = priceService.getPrices();
    const status = priceService.getCacheStatus();

    logAdminAction('Forced price refresh', adminUsername);

    res.json({
      success: true,
      message: 'Prices refreshed',
      prices,
      cacheStatus: status,
    });

  } catch (error) {
    console.error('[Admin API] Error in /prices/refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh prices',
      message: error.message,
    });
  }
});

/**
 * =============================================================================
 * USER MANAGEMENT
 * =============================================================================
 * PLACEHOLDER: Většina funkcí čeká na implementaci DB a user systému
 */

/**
 * POST /api/admin/user/kick
 * Odpojí uživatele (ukončí WebSocket session)
 *
 * Body: { userId: number } nebo { username: string }
 */
router.post('/user/kick', async (req, res) => {
  try {
    const { userId, username } = req.body;
    const adminUsername = req.adminUser.username;

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        error: 'Provide userId or username',
      });
    }

    // PLACEHOLDER: Implementace kicku
    // V produkci by:
    // 1. Našel WebSocket spojení pro uživatele
    // 2. Poslal disconnect zprávu
    // 3. Ukončil spojení
    //
    // const connection = findConnectionByUser(userId || username);
    // if (connection) {
    //   connection.send(JSON.stringify({ type: 'KICKED', reason: 'Admin action' }));
    //   connection.close();
    // }

    logAdminAction(`Kicked user: ${userId || username}`, adminUsername);

    res.json({
      success: true,
      message: `User ${userId || username} kicked (PLACEHOLDER - WebSocket not implemented)`,
    });

  } catch (error) {
    console.error('[Admin API] Error in /user/kick:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to kick user',
    });
  }
});

/**
 * POST /api/admin/user/ban
 * Zabanuje uživatele (nastaví is_banned = true)
 *
 * Body: { userId: number, reason?: string } nebo { username: string, reason?: string }
 */
router.post('/user/ban', async (req, res) => {
  try {
    const { userId, username, reason } = req.body;
    const adminUsername = req.adminUser.username;

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        error: 'Provide userId or username',
      });
    }

    // PLACEHOLDER: Implementace banu
    // V produkci by:
    // 1. Aktualizoval is_banned v DB
    // 2. Uložil důvod banu
    // 3. Kicknul uživatele pokud je online
    //
    // await db.query(`
    //   UPDATE users
    //   SET is_banned = true,
    //       ban_reason = $1,
    //       banned_at = NOW(),
    //       banned_by = $2
    //   WHERE id = $3 OR username = $4
    // `, [reason || 'No reason provided', adminUsername, userId, username]);

    logAdminAction(`Banned user: ${userId || username} (reason: ${reason || 'N/A'})`, adminUsername);

    res.json({
      success: true,
      message: `User ${userId || username} banned (PLACEHOLDER - DB not implemented)`,
      reason: reason || 'No reason provided',
    });

  } catch (error) {
    console.error('[Admin API] Error in /user/ban:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ban user',
    });
  }
});

/**
 * POST /api/admin/user/unban
 * Odbanuje uživatele
 *
 * Body: { userId: number } nebo { username: string }
 */
router.post('/user/unban', async (req, res) => {
  try {
    const { userId, username } = req.body;
    const adminUsername = req.adminUser.username;

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        error: 'Provide userId or username',
      });
    }

    // PLACEHOLDER: Implementace unbanu
    // await db.query(`
    //   UPDATE users
    //   SET is_banned = false, ban_reason = NULL
    //   WHERE id = $1 OR username = $2
    // `, [userId, username]);

    logAdminAction(`Unbanned user: ${userId || username}`, adminUsername);

    res.json({
      success: true,
      message: `User ${userId || username} unbanned (PLACEHOLDER)`,
    });

  } catch (error) {
    console.error('[Admin API] Error in /user/unban:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unban user',
    });
  }
});

/**
 * POST /api/admin/user/gift
 * Daruje resources uživateli (pro testování)
 *
 * Body: {
 *   userId: number | username: string,
 *   btc?: number,
 *   hashrate?: number
 * }
 */
router.post('/user/gift', async (req, res) => {
  try {
    const { userId, username, btc, hashrate } = req.body;
    const adminUsername = req.adminUser.username;

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        error: 'Provide userId or username',
      });
    }

    if (!btc && !hashrate) {
      return res.status(400).json({
        success: false,
        error: 'Provide btc or hashrate to gift',
      });
    }

    // PLACEHOLDER: Implementace giftu
    // V produkci by:
    // 1. Našel uživatele v DB
    // 2. Přidal BTC k balance
    // 3. Přidal hashrate (pokud dává smysl v herní logice)
    //
    // const updates = [];
    // const values = [];
    // let i = 1;
    //
    // if (btc) {
    //   updates.push(`balance = balance + $${i++}`);
    //   values.push(btc);
    // }
    // if (hashrate) {
    //   updates.push(`total_hashrate = total_hashrate + $${i++}`);
    //   values.push(hashrate);
    // }
    //
    // await db.query(`
    //   UPDATE users
    //   SET ${updates.join(', ')}, updated_at = NOW()
    //   WHERE id = $${i++} OR username = $${i++}
    // `, [...values, userId, username]);

    const giftDetails = [];
    if (btc) giftDetails.push(`${btc} BTC`);
    if (hashrate) giftDetails.push(`${hashrate} MH/s`);

    logAdminAction(`Gifted ${giftDetails.join(', ')} to user: ${userId || username}`, adminUsername);

    res.json({
      success: true,
      message: `Gift sent to ${userId || username} (PLACEHOLDER)`,
      gift: { btc, hashrate },
    });

  } catch (error) {
    console.error('[Admin API] Error in /user/gift:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send gift',
    });
  }
});

/**
 * GET /api/admin/users
 * Vrátí seznam uživatelů (pro User Control sekci)
 *
 * PLACEHOLDER: Čeká na implementaci DB
 *
 * Query: ?search=xxx&limit=50&offset=0
 */
router.get('/users', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    // PLACEHOLDER: Implementace vyhledávání
    // const users = await db.query(`
    //   SELECT id, username, email, balance, total_hashrate, is_active, is_banned,
    //          created_at, last_login
    //   FROM users
    //   WHERE ($1::text IS NULL OR username ILIKE '%' || $1 || '%')
    //   ORDER BY created_at DESC
    //   LIMIT $2 OFFSET $3
    // `, [search || null, limit, offset]);

    res.json({
      success: true,
      message: 'PLACEHOLDER - Database not implemented',
      data: [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: 0,
      },
    });

  } catch (error) {
    console.error('[Admin API] Error in /users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users',
    });
  }
});

/**
 * =============================================================================
 * BROADCAST / SYSTEM MESSAGES
 * =============================================================================
 */

/**
 * POST /api/admin/broadcast
 * Pošle broadcast zprávu všem hráčům
 *
 * Body: { message: string, type?: 'info' | 'warning' | 'danger' }
 */
router.post('/broadcast', (req, res) => {
  try {
    const { message, type = 'info' } = req.body;
    const adminUsername = req.adminUser.username;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // PLACEHOLDER: Implementace broadcastu
    // V produkci by poslal zprávu přes WebSocket všem připojeným klientům:
    //
    // const broadcast = {
    //   type: 'SYSTEM_MESSAGE',
    //   data: {
    //     message: message.trim(),
    //     messageType: type,
    //     timestamp: new Date().toISOString(),
    //     from: 'SYSTEM',
    //   },
    // };
    //
    // wss.clients.forEach((client) => {
    //   if (client.readyState === WebSocket.OPEN) {
    //     client.send(JSON.stringify(broadcast));
    //   }
    // });

    logAdminAction(`Broadcast (${type}): "${message.substring(0, 50)}..."`, adminUsername);

    res.json({
      success: true,
      message: 'Broadcast sent (PLACEHOLDER - WebSocket not implemented)',
      broadcast: {
        message: message.trim(),
        type,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Admin API] Error in /broadcast:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send broadcast',
    });
  }
});

/**
 * =============================================================================
 * MAINTENANCE MODE
 * =============================================================================
 */

/**
 * POST /api/admin/maintenance
 * Přepne maintenance mode
 *
 * Body: { enabled: boolean, reason?: string }
 */
router.post('/maintenance', (req, res) => {
  try {
    const { enabled, reason } = req.body;
    const adminUsername = req.adminUser.username;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }

    // Aktualizace konfigurace
    GameConfig.override.maintenanceMode = enabled;
    GameConfig.override.maintenanceReason = enabled ? (reason || 'Scheduled maintenance') : '';

    if (enabled) {
      // PLACEHOLDER: Při zapnutí maintenance:
      // 1. Broadcast zprávu všem hráčům
      // 2. Volitelně: Zastavit game engine
      // 3. Odpojit všechny hráče (s grace period)
      logAdminAction(`Maintenance mode ENABLED: ${reason || 'No reason'}`, adminUsername);
    } else {
      logAdminAction('Maintenance mode DISABLED', adminUsername);
    }

    res.json({
      success: true,
      maintenanceMode: enabled,
      reason: GameConfig.override.maintenanceReason,
    });

  } catch (error) {
    console.error('[Admin API] Error in /maintenance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle maintenance mode',
    });
  }
});

/**
 * =============================================================================
 * ENGINE CONTROL
 * =============================================================================
 */

/**
 * POST /api/admin/engine/start
 * Spustí herní engine
 */
router.post('/engine/start', (req, res) => {
  try {
    const adminUsername = req.adminUser.username;
    const success = gameEngine.startEngine();

    if (success) {
      logAdminAction('Engine started manually', adminUsername);
    }

    res.json({
      success,
      message: success ? 'Engine started' : 'Engine already running',
      status: gameEngine.getEngineStatus(),
    });

  } catch (error) {
    console.error('[Admin API] Error in /engine/start:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start engine',
    });
  }
});

/**
 * POST /api/admin/engine/stop
 * Zastaví herní engine (EMERGENCY)
 */
router.post('/engine/stop', (req, res) => {
  try {
    const adminUsername = req.adminUser.username;
    const success = gameEngine.stopEngine();

    if (success) {
      logAdminAction('Engine stopped manually (EMERGENCY)', adminUsername);
    }

    res.json({
      success,
      message: success ? 'Engine stopped' : 'Engine not running',
      status: gameEngine.getEngineStatus(),
    });

  } catch (error) {
    console.error('[Admin API] Error in /engine/stop:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop engine',
    });
  }
});

/**
 * POST /api/admin/engine/restart
 * Restartuje herní engine
 */
router.post('/engine/restart', (req, res) => {
  try {
    const adminUsername = req.adminUser.username;

    gameEngine.restartEngine();
    logAdminAction('Engine restarted manually', adminUsername);

    // Krátká pauza před vrácením statusu
    setTimeout(() => {
      res.json({
        success: true,
        message: 'Engine restarted',
        status: gameEngine.getEngineStatus(),
      });
    }, 200);

  } catch (error) {
    console.error('[Admin API] Error in /engine/restart:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart engine',
    });
  }
});

module.exports = router;

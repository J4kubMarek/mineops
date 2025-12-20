/**
 * =============================================================================
 * MINEOPS - GAME ENGINE
 * =============================================================================
 *
 * Hlavní herní smyčka (game loop) pro výpočet těžby, spotřeby a dalších
 * herních mechanik.
 *
 * TICK INTERVAL: 10s (konfigurovatelné v GameConfig)
 *
 * Co se děje každý tick:
 * 1. Výpočet vytěženého BTC pro každého aktivního hráče
 * 2. Odečtení nákladů na elektřinu
 * 3. Aktualizace statistik
 * 4. Zpracování aktivních efektů (DDoS, boosty, atd.)
 *
 * =============================================================================
 */

const { GameConfig, logAdminAction } = require('../config/gameConfig');
const priceService = require('../services/priceService');
// PLACEHOLDER: Import databáze až bude implementována
// const db = require('../../config/database');

/**
 * Stav herního enginu
 */
const engineState = {
  isRunning: false,
  tickInterval: null,
  stats: {
    totalTicks: 0,
    lastTickDuration: 0,
    averageTickDuration: 0,
    tickDurations: [],    // Posledních 100 ticků pro průměr
    errors: 0,
  },
  // Aktivní připojení (pro budoucí WebSocket implementaci)
  // PLACEHOLDER: Bude naplněno po implementaci WebSocket
  activeConnections: new Set(),
};

/**
 * =============================================================================
 * MINING CALCULATIONS
 * =============================================================================
 * PLACEHOLDER: Tyto funkce budou použity po implementaci DB tabulek
 */

/**
 * Vypočítá BTC vytěžené za jeden tick
 *
 * Vzorec: (hashrate * globalMult * poolBonus) / networkDifficulty * tickDuration
 *
 * PLACEHOLDER: Zjednodušená verze pro MVP
 * V produkci bude používat reálnou síťovou obtížnost
 *
 * @param {number} hashrate - Hashrate hráče v MH/s
 * @returns {number} - Vytěžené BTC za tick
 */
function calculateMinedBTC(hashrate) {
  const globalMult = GameConfig.economy.globalHashrateMult;
  const tickSeconds = GameConfig.system.tickInterval / 1000;

  // PLACEHOLDER: Velmi zjednodušený výpočet
  // V realitě by se použila aktuální network difficulty
  // Přibližný výpočet: 1 TH/s = ~0.00000002 BTC/s při current difficulty
  const btcPerMHPerSecond = 0.00000000002; // Placeholder hodnota

  const minedBTC = hashrate * globalMult * btcPerMHPerSecond * tickSeconds;

  return minedBTC;
}

/**
 * Vypočítá náklady na elektřinu za jeden tick
 *
 * @param {number} powerWatts - Spotřeba v Wattech
 * @returns {number} - Náklady v USD
 */
function calculateElectricityCost(powerWatts) {
  const costPerWattHour = GameConfig.economy.electricityCostUsd / 1000; // kWh -> Wh
  const tickHours = GameConfig.system.tickInterval / 1000 / 3600;

  return powerWatts * costPerWattHour * tickHours;
}

/**
 * Převede USD na BTC pomocí aktuální ceny
 *
 * @param {number} usd - Částka v USD
 * @returns {number} - Částka v BTC
 */
function usdToBtc(usd) {
  const prices = priceService.getPrices();
  const btcPrice = prices.bitcoin.usd;

  if (btcPrice <= 0) {
    console.warn('[GameEngine] BTC cena je 0, nelze převést USD na BTC');
    return 0;
  }

  return usd / btcPrice;
}

/**
 * =============================================================================
 * TICK PROCESSING
 * =============================================================================
 */

/**
 * Hlavní tick funkce - volána každých N sekund
 *
 * PLACEHOLDER: Většina logiky je připravena, ale čeká na:
 * - Implementaci DB tabulek (users, user_hardware)
 * - WebSocket pro real-time update klientů
 */
async function processTick() {
  const tickStart = Date.now();

  try {
    // Aktualizace system stats
    GameConfig.system.totalTicks++;
    GameConfig.system.lastTickTime = new Date().toISOString();

    // =========================================================================
    // PLACEHOLDER: Zpracování všech aktivních hráčů
    // =========================================================================
    // Následující kód je připraven pro budoucí implementaci:
    //
    // const activeUsers = await db.query(`
    //   SELECT u.id, u.username, u.balance, u.total_hashrate,
    //          COALESCE(SUM(h.power_consumption), 0) as total_power
    //   FROM users u
    //   LEFT JOIN user_hardware uh ON u.id = uh.user_id AND uh.is_active = true
    //   LEFT JOIN hardware_types h ON uh.hardware_id = h.id
    //   WHERE u.is_active = true
    //   GROUP BY u.id
    // `);
    //
    // for (const user of activeUsers.rows) {
    //   // Výpočet těžby
    //   const minedBTC = calculateMinedBTC(user.total_hashrate);
    //
    //   // Výpočet nákladů
    //   const electricityCostUSD = calculateElectricityCost(user.total_power);
    //   const electricityCostBTC = usdToBtc(electricityCostUSD);
    //
    //   // Čistý zisk
    //   const netProfit = minedBTC - electricityCostBTC;
    //
    //   // Aktualizace balance
    //   await db.query(`
    //     UPDATE users
    //     SET balance = balance + $1,
    //         total_earned = total_earned + $2,
    //         updated_at = NOW()
    //     WHERE id = $3
    //   `, [netProfit, minedBTC > 0 ? minedBTC : 0, user.id]);
    //
    //   // Broadcast update přes WebSocket
    //   // broadcastToUser(user.id, { type: 'TICK_UPDATE', data: { ... } });
    // }
    // =========================================================================

    // Výpočet trvání ticku
    const tickDuration = Date.now() - tickStart;
    engineState.stats.lastTickDuration = tickDuration;

    // Aktualizace průměru
    engineState.stats.tickDurations.push(tickDuration);
    if (engineState.stats.tickDurations.length > 100) {
      engineState.stats.tickDurations.shift();
    }
    engineState.stats.averageTickDuration =
      engineState.stats.tickDurations.reduce((a, b) => a + b, 0) /
      engineState.stats.tickDurations.length;

    engineState.stats.totalTicks++;

    // Log každý 10. tick (aby se nezahlcoval log)
    if (engineState.stats.totalTicks % 10 === 0) {
      console.log(`[GameEngine] Tick #${engineState.stats.totalTicks} (${tickDuration}ms)`);
    }

  } catch (error) {
    console.error('[GameEngine] Chyba při zpracování ticku:', error);
    engineState.stats.errors++;
  }
}

/**
 * =============================================================================
 * ENGINE LIFECYCLE
 * =============================================================================
 */

/**
 * Spustí herní engine
 */
function startEngine() {
  if (engineState.isRunning) {
    console.warn('[GameEngine] Engine již běží');
    return false;
  }

  // Inicializace časových hodnot
  GameConfig.system.serverStartTime = new Date().toISOString();
  GameConfig.system.totalTicks = 0;

  // Spuštění price service
  priceService.startPriceUpdates();

  // Spuštění tick smyčky
  const interval = GameConfig.system.tickInterval;
  engineState.tickInterval = setInterval(processTick, interval);
  engineState.isRunning = true;

  // Okamžitý první tick
  processTick();

  logAdminAction('Game engine started');
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              MINEOPS GAME ENGINE STARTED                  ║
╠═══════════════════════════════════════════════════════════╣
║  Tick Interval: ${interval}ms (${interval / 1000}s)                              ║
║  Price Update: ${GameConfig.system.priceUpdateInterval}ms (${GameConfig.system.priceUpdateInterval / 1000}s)                            ║
║  Status: RUNNING                                          ║
╚═══════════════════════════════════════════════════════════╝
  `);

  return true;
}

/**
 * Zastaví herní engine
 */
function stopEngine() {
  if (!engineState.isRunning) {
    console.warn('[GameEngine] Engine neběží');
    return false;
  }

  // Zastavení tick smyčky
  if (engineState.tickInterval) {
    clearInterval(engineState.tickInterval);
    engineState.tickInterval = null;
  }

  // Zastavení price service
  priceService.stopPriceUpdates();

  engineState.isRunning = false;

  logAdminAction('Game engine stopped');
  console.log('[GameEngine] Engine zastaven');

  return true;
}

/**
 * Restartuje engine s novým tick intervalem
 * Volá se po změně tickInterval v GameConfig
 */
function restartEngine() {
  console.log('[GameEngine] Restartování enginu...');
  stopEngine();

  // Krátká pauza před restartem
  setTimeout(() => {
    startEngine();
  }, 100);
}

/**
 * Vrátí aktuální stav enginu
 * @returns {Object} - Stav enginu a statistiky
 */
function getEngineStatus() {
  const now = Date.now();
  const lastTickTime = GameConfig.system.lastTickTime
    ? new Date(GameConfig.system.lastTickTime).getTime()
    : now;
  const tickDelta = now - lastTickTime;

  return {
    isRunning: engineState.isRunning,
    serverStartTime: GameConfig.system.serverStartTime,
    totalTicks: GameConfig.system.totalTicks,
    lastTickTime: GameConfig.system.lastTickTime,
    tickDelta: tickDelta, // ms od posledního ticku
    tickInterval: GameConfig.system.tickInterval,
    stats: {
      ...engineState.stats,
      activeConnections: engineState.activeConnections.size,
    },
    priceService: priceService.getCacheStatus(),
  };
}

/**
 * =============================================================================
 * CONNECTION MANAGEMENT (PLACEHOLDER)
 * =============================================================================
 * Tyto funkce budou použity po implementaci WebSocket
 */

/**
 * Registruje nové připojení
 * PLACEHOLDER: Pro budoucí WebSocket
 * @param {string} connectionId - ID připojení
 */
function registerConnection(connectionId) {
  engineState.activeConnections.add(connectionId);
  console.log(`[GameEngine] Nové připojení: ${connectionId} (celkem: ${engineState.activeConnections.size})`);
}

/**
 * Odregistruje připojení
 * PLACEHOLDER: Pro budoucí WebSocket
 * @param {string} connectionId - ID připojení
 */
function unregisterConnection(connectionId) {
  engineState.activeConnections.delete(connectionId);
  console.log(`[GameEngine] Odpojení: ${connectionId} (celkem: ${engineState.activeConnections.size})`);
}

/**
 * Vrátí počet aktivních připojení
 * @returns {number}
 */
function getActiveConnectionsCount() {
  return engineState.activeConnections.size;
}

module.exports = {
  // Lifecycle
  startEngine,
  stopEngine,
  restartEngine,
  getEngineStatus,

  // Calculations (pro testování a budoucí použití)
  calculateMinedBTC,
  calculateElectricityCost,
  usdToBtc,

  // Connection management
  registerConnection,
  unregisterConnection,
  getActiveConnectionsCount,
};

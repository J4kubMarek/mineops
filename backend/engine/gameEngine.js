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
const pool = require('../../config/database');

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
 * Používá výchozí cenu z GameConfig
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
 * Vypočítá náklady na elektřinu za jeden tick s vlastní cenou za kWh
 * Používá se pro farmy s různými cenami elektřiny
 *
 * @param {number} powerWatts - Spotřeba v Wattech
 * @param {number} costPerKwh - Cena za kWh v USD
 * @returns {number} - Náklady v USD za tick
 */
function calculateElectricityCostWithRate(powerWatts, costPerKwh) {
  const costPerWattHour = costPerKwh / 1000; // kWh -> Wh
  const tickHours = GameConfig.system.tickInterval / 1000 / 3600;

  return powerWatts * costPerWattHour * tickHours;
}

/**
 * Vypočítá denní nájem za prostor farmy (pro zobrazení)
 * PLACEHOLDER: Nájem se strhává v denních intervalech, ne každý tick
 *
 * @param {number} rentPerDay - Denní nájem v USD
 * @returns {number} - Nájem za tick (pro přibližný výpočet)
 */
function calculateRentPerTick(rentPerDay) {
  const ticksPerDay = (24 * 60 * 60 * 1000) / GameConfig.system.tickInterval;
  return rentPerDay / ticksPerDay;
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
    // ZPRACOVÁNÍ FAREM - Výpočet spotřeby a těžby pro každou farmu
    // =========================================================================
    // PLACEHOLDER: Tato logika je připravena ale zatím deaktivována
    // Aktivuje se po implementaci kompletního mining systému
    //
    // await processFarms();
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
 * FARM PROCESSING - Výpočty pro těžební farmy
 * =============================================================================
 */

/**
 * Zpracuje všechny aktivní farmy - vypočítá spotřebu a těžbu
 * PLACEHOLDER: Tato funkce bude volána z processTick po aktivaci
 *
 * Logika:
 * 1. Načte všechny aktivní farmy s jejich hardwarem
 * 2. Pro každou farmu vypočítá:
 *    - Celkovou spotřebu elektřiny
 *    - Celkový hashrate
 *    - Náklady na elektřinu (dle ceny v prostoru)
 *    - Vytěžené BTC
 * 3. Aktualizuje balance uživatele
 */
async function processFarms() {
  try {
    // Načti všechny aktivní farmy s jejich spotřebou a cenou elektřiny
    const farmsResult = await pool.query(`
      SELECT
        f.id AS farm_id,
        f.user_id,
        f.name AS farm_name,
        f.is_active,
        fs.electricity_cost_per_kwh,
        fs.rent_usd_per_day,
        -- Celková spotřeba farmy (pouze běžící hardware)
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
        -- Celkový hashrate farmy
        -- PLACEHOLDER: Zjednodušeno - ignoruje různé jednotky hashrate
        COALESCE(
          (
            SELECT SUM(ht.hashrate * fh.quantity)
            FROM farm_hardware fh
            JOIN user_hardware uh ON uh.id = fh.user_hardware_id
            JOIN hardware_types ht ON ht.id = uh.hardware_type_id
            WHERE fh.farm_id = f.id AND fh.is_running = true
          ),
          0
        ) AS total_hashrate
      FROM farms f
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.is_active = true
    `);

    // Zpracuj každou farmu
    for (const farm of farmsResult.rows) {
      if (farm.current_power_watts <= 0) {
        continue; // Farma bez běžícího hardwaru - přeskoč
      }

      // Výpočet nákladů na elektřinu s cenou specifickou pro daný prostor
      const electricityCostUSD = calculateElectricityCostWithRate(
        farm.current_power_watts,
        parseFloat(farm.electricity_cost_per_kwh)
      );

      // Výpočet vytěženého BTC (zjednodušený)
      // PLACEHOLDER: Bude rozšířeno o různé kategorie a algoritmy
      const minedBTC = calculateMinedBTC(parseFloat(farm.total_hashrate));

      // Převod nákladů na elektřinu do BTC
      const electricityCostBTC = usdToBtc(electricityCostUSD);

      // Čistý zisk (může být záporný!)
      const netProfit = minedBTC - electricityCostBTC;

      // PLACEHOLDER: Aktualizace balance uživatele
      // Toto je zatím zakomentováno - aktivuje se po testování
      //
      // await pool.query(`
      //   UPDATE users
      //   SET balance = balance + $1,
      //       total_earned = CASE WHEN $2 > 0 THEN total_earned + $2 ELSE total_earned END,
      //       updated_at = NOW()
      //   WHERE id = $3
      // `, [netProfit, minedBTC, farm.user_id]);
      //
      // // Záznam transakce za elektřinu
      // if (electricityCostUSD > 0) {
      //   await pool.query(`
      //     INSERT INTO transactions (user_id, type, amount_usd, description, reference_id)
      //     VALUES ($1, 'electricity', $2, $3, $4)
      //   `, [
      //     farm.user_id,
      //     -electricityCostUSD,
      //     `Elektřina: ${farm.farm_name} (${farm.current_power_watts}W)`,
      //     farm.farm_id
      //   ]);
      // }
    }

  } catch (error) {
    console.error('[GameEngine] Chyba při zpracování farem:', error);
  }
}

/**
 * Vypočítá statistiky pro všechny farmy uživatele
 * Používá se pro zobrazení na dashboardu
 *
 * @param {number} userId - ID uživatele
 * @returns {Object} - Statistiky farem
 */
async function getUserFarmStats(userId) {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(f.id) AS total_farms,
        COALESCE(SUM(
          (
            SELECT SUM(ht.power_consumption * fh.quantity)
            FROM farm_hardware fh
            JOIN user_hardware uh ON uh.id = fh.user_hardware_id
            JOIN hardware_types ht ON ht.id = uh.hardware_type_id
            WHERE fh.farm_id = f.id AND fh.is_running = true
          )
        ), 0) AS total_power_watts,
        COALESCE(SUM(
          (
            SELECT SUM(ht.hashrate * fh.quantity)
            FROM farm_hardware fh
            JOIN user_hardware uh ON uh.id = fh.user_hardware_id
            JOIN hardware_types ht ON ht.id = uh.hardware_type_id
            WHERE fh.farm_id = f.id AND fh.is_running = true
          )
        ), 0) AS total_hashrate,
        COALESCE(SUM(fs.rent_usd_per_day), 0) AS total_rent_per_day
      FROM farms f
      JOIN farm_spaces fs ON fs.id = f.space_id
      WHERE f.user_id = $1 AND f.is_active = true
    `, [userId]);

    return result.rows[0] || {
      total_farms: 0,
      total_power_watts: 0,
      total_hashrate: 0,
      total_rent_per_day: 0
    };

  } catch (error) {
    console.error('[GameEngine] Chyba při načítání statistik farem:', error);
    return {
      total_farms: 0,
      total_power_watts: 0,
      total_hashrate: 0,
      total_rent_per_day: 0
    };
  }
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
  calculateElectricityCostWithRate,
  calculateRentPerTick,
  usdToBtc,

  // Farm processing
  processFarms,
  getUserFarmStats,

  // Connection management
  registerConnection,
  unregisterConnection,
  getActiveConnectionsCount,
};

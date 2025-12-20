/**
 * =============================================================================
 * MINEOPS - GAME CONFIGURATION
 * =============================================================================
 *
 * Centrální konfigurace herních proměnných.
 * Tyto hodnoty mohou být editovány přes Admin Panel za běhu serveru.
 *
 * DŮLEŽITÉ: Změny se projeví okamžitě po uložení přes admin API.
 *
 * =============================================================================
 */

const GameConfig = {
  // ===========================================================================
  // SYSTEM - Základní nastavení serveru
  // ===========================================================================
  system: {
    // Interval herního ticku v milisekundách (10s = 10000ms)
    tickInterval: 10000,

    // Interval aktualizace cen kryptoměn v milisekundách (60s = 60000ms)
    priceUpdateInterval: 60000,

    // Maximální doba offline těžby v hodinách (omezení pro AFK earnings)
    maxOfflineHours: 24,

    // Server start timestamp - nastavuje se při startu
    serverStartTime: null,

    // Počítadlo ticků od startu serveru
    totalTicks: 0,

    // Timestamp posledního ticku
    lastTickTime: null,
  },

  // ===========================================================================
  // ECONOMY - Ekonomické proměnné
  // ===========================================================================
  economy: {
    // Cena elektřiny za Watt/hodinu v USD
    // PLACEHOLDER: Toto ovlivňuje provozní náklady hráčů
    electricityCostUsd: 0.12,

    // Globální násobič těžby (pro eventy, např. "Double Mining Weekend")
    // 1.0 = normální, 2.0 = dvojnásobek, 0.5 = poloviční
    globalHashrateMult: 1.00,

    // Volatilita trhu - procentuální swing cen kryptoměn
    // PLACEHOLDER: Zatím nepoužito, připraveno pro simulaci cen
    marketVolatility: 0.05,

    // Minimální výběr BTC (anti-spam)
    // PLACEHOLDER: Pro budoucí withdrawal systém
    minWithdrawal: 0.0001,

    // Poplatek za transakce v procentech
    // PLACEHOLDER: Pro budoucí marketplace
    transactionFeePercent: 2.5,
  },

  // ===========================================================================
  // GAMEPLAY - Herní mechaniky
  // ===========================================================================
  gameplay: {
    // DDoS útok - snížení výkonu v procentech
    // PLACEHOLDER: Pro PvP exploits systém
    ddosPowerPercent: 15,

    // DDoS útok - trvání v minutách
    // PLACEHOLDER: Pro PvP exploits systém
    ddosDurationMin: 60,

    // Maximální počet členů v mining poolu
    // PLACEHOLDER: Pro pool systém
    maxPoolMembers: 20,

    // Bonus za mining v poolu (procenta navíc k base hashrate)
    // PLACEHOLDER: Pro pool systém
    poolBonus: 5,

    // Cooldown mezi útoky v minutách
    // PLACEHOLDER: Pro PvP systém
    attackCooldownMin: 30,

    // Šance na úspěch útoku v procentech (base, modifikováno skill levelem)
    // PLACEHOLDER: Pro PvP systém
    attackSuccessChance: 60,
  },

  // ===========================================================================
  // HARDWARE - Nastaveni tezebnich zarizeni
  // ===========================================================================
  // Hardware je nyni ulozen v databazi (tabulka hardware_types)
  // Tato konfigurace slouzi pro referencni hodnoty a vypocty
  hardware: {
    // Kategorie hardwaru dostupne v obchode
    categories: {
      btc_asic: 'Bitcoin ASIC Miners (SHA-256)',
      doge_asic: 'Dogecoin/Litecoin ASIC Miners (Scrypt)',
      xmr_asic: 'Monero CPU Mining Rigs (RandomX)',
      solo: 'Solo Bitcoin Mining (Bitaxe)',
    },

    // Degradace hardwaru za den (procenta)
    // PLACEHOLDER: Pro system opotrebeni HW
    dailyDegradation: 0.1,

    // Maximalni pocet kusu jednoho typu hardwaru na uzivatele
    maxQuantityPerType: 100,
  },

  // ===========================================================================
  // CURRENCY - Menovy system
  // ===========================================================================
  // Hra pouziva dve meny: BTC (vytezena kryptomena) a USD (platebni mena)
  currency: {
    // USD - hlavni platebni mena
    // Ziskava se prodejem BTC, pouziva se na nakupy a poplatky
    usd: {
      // Startovaci balance pro nove hrace (pro testovani)
      startingBalance: 10000.00,

      // Minimalni vyse transakce
      minTransaction: 0.01,
    },

    // BTC - vytezena kryptomena
    // Ziskava se tezenim, prodava se za USD
    btc: {
      // Startovaci balance (0 - hrac musi tezit)
      startingBalance: 0.00000000,

      // Presnost zobrazeni (8 desetinnych mist)
      decimalPlaces: 8,
    },

    // Poplatky za konverzi BTC -> USD (procento)
    // TODO: Implementovat prodej BTC
    btcSellFeePercent: 1.5,
  },

  // ===========================================================================
  // COSTS - Provozni naklady (PLACEHOLDER)
  // ===========================================================================
  // Naklady ktere budou odecitany z USD balance uzivatele
  costs: {
    // Elektrina - cena za kWh v USD
    electricityPerKwh: 0.12,

    // Prostor/Hosting - mesicni najem za slot
    // TODO: Implementovat system slotu
    spaceRentPerSlot: 50.00,

    // Interval uctovani elektriny (v hodinach)
    electricityBillingInterval: 24,
  },

  // ===========================================================================
  // RESEARCH - Výzkumný strom
  // ===========================================================================
  research: {
    // Základní cena výzkumu v BTC
    // PLACEHOLDER: Bude dynamicky počítáno
    baseResearchCost: 0.001,

    // Násobič ceny za každý level
    // PLACEHOLDER: Pro exponenciální škálování
    costMultiplierPerLevel: 1.5,

    // Maximální level výzkumu
    maxResearchLevel: 10,
  },

  // ===========================================================================
  // MANUAL OVERRIDE - Ruční přepisy pro testování/eventy
  // ===========================================================================
  override: {
    // Vynucená cena BTC (0 = použít API, >0 = fixní cena)
    // UŽITEČNÉ: Pro testování bez závislosti na API
    forceBtcPrice: 0,

    // Vynucená cena DOGE
    forceDogePrice: 0,

    // Vynucená cena XMR
    forceXmrPrice: 0,

    // Maintenance mode - zastaví všechny herní operace
    maintenanceMode: false,

    // Důvod maintenance (zobrazí se hráčům)
    maintenanceReason: '',
  },

  // ===========================================================================
  // ADMIN LOG - Historie změn (posledních N záznamů)
  // ===========================================================================
  adminLog: [],
  maxLogEntries: 100,
};

/**
 * Přidá záznam do admin logu
 * @param {string} action - Popis akce
 * @param {string} admin - Jméno admina (zatím placeholder)
 */
function logAdminAction(action, admin = 'SYSTEM') {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    admin,
    action,
  };

  GameConfig.adminLog.unshift(entry);

  // Omezit velikost logu
  if (GameConfig.adminLog.length > GameConfig.maxLogEntries) {
    GameConfig.adminLog = GameConfig.adminLog.slice(0, GameConfig.maxLogEntries);
  }

  console.log(`[ADMIN LOG] ${timestamp} - ${admin}: ${action}`);
}

/**
 * Aktualizuje konfiguraci z objektu
 * @param {string} section - Název sekce (economy, gameplay, etc.)
 * @param {string} key - Název klíče
 * @param {any} value - Nová hodnota
 * @returns {boolean} - Úspěch operace
 */
function updateConfig(section, key, value) {
  if (!GameConfig[section]) {
    console.error(`[GameConfig] Neznámá sekce: ${section}`);
    return false;
  }

  if (!(key in GameConfig[section])) {
    console.error(`[GameConfig] Neznámý klíč: ${section}.${key}`);
    return false;
  }

  const oldValue = GameConfig[section][key];
  GameConfig[section][key] = value;

  logAdminAction(`Changed ${section}.${key} from ${oldValue} to ${value}`);

  return true;
}

/**
 * Vrati aktualni konfiguraci (pro API response)
 * @returns {Object} - Kopie konfigurace bez citlivych dat
 */
function getConfig() {
  return {
    system: { ...GameConfig.system },
    economy: { ...GameConfig.economy },
    gameplay: { ...GameConfig.gameplay },
    hardware: { ...GameConfig.hardware },
    currency: { ...GameConfig.currency },
    costs: { ...GameConfig.costs },
    research: { ...GameConfig.research },
    override: { ...GameConfig.override },
  };
}

/**
 * Vrátí admin log
 * @param {number} limit - Počet záznamů
 * @returns {Array} - Pole log záznamů
 */
function getAdminLog(limit = 50) {
  return GameConfig.adminLog.slice(0, limit);
}

module.exports = {
  GameConfig,
  updateConfig,
  getConfig,
  getAdminLog,
  logAdminAction,
};

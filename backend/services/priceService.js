/**
 * =============================================================================
 * MINEOPS - PRICE SERVICE
 * =============================================================================
 *
 * Služba pro cachování a poskytování cen kryptoměn.
 * Automaticky aktualizuje ceny v intervalu definovaném v GameConfig.
 *
 * Zdroj dat: CoinGecko API (free tier)
 * Cache interval: 60s (konfigurovatelné)
 *
 * =============================================================================
 */

const { GameConfig } = require('../config/gameConfig');

/**
 * Cache pro ceny kryptoměn
 * Struktura: { bitcoin: { usd: 45000, usd_24h_change: 2.5 }, ... }
 */
let priceCache = {
  bitcoin: { usd: 0, usd_24h_change: 0 },
  ethereum: { usd: 0, usd_24h_change: 0 },
  monero: { usd: 0, usd_24h_change: 0 },
};

/**
 * Metadata o cache
 */
let cacheMetadata = {
  lastUpdate: null,
  lastError: null,
  updateCount: 0,
  errorCount: 0,
  isUpdating: false,
};

/**
 * Interval ID pro automatické aktualizace
 */
let updateInterval = null;

/**
 * Stáhne aktuální ceny z CoinGecko API
 * @returns {Promise<Object|null>} - Cenová data nebo null při chybě
 */
async function fetchPricesFromAPI() {
  const coins = ['bitcoin', 'ethereum', 'monero'];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd&include_24hr_change=true`;

  try {
    // Použití native fetch (Node.js 18+)
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Timeout 10s
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('[PriceService] Chyba při stahování cen:', error.message);
    cacheMetadata.lastError = {
      time: new Date().toISOString(),
      message: error.message,
    };
    cacheMetadata.errorCount++;
    return null;
  }
}

/**
 * Aktualizuje cache s novými cenami
 * Respektuje force price overrides z GameConfig
 */
async function updatePriceCache() {
  // Prevence paralelních aktualizací
  if (cacheMetadata.isUpdating) {
    console.log('[PriceService] Aktualizace již probíhá, přeskakuji...');
    return;
  }

  cacheMetadata.isUpdating = true;

  try {
    const apiData = await fetchPricesFromAPI();

    if (apiData) {
      // Aktualizace cache s API daty
      priceCache = {
        bitcoin: apiData.bitcoin || priceCache.bitcoin,
        ethereum: apiData.ethereum || priceCache.ethereum,
        monero: apiData.monero || priceCache.monero,
      };

      cacheMetadata.lastUpdate = new Date().toISOString();
      cacheMetadata.updateCount++;

      console.log('[PriceService] Cache aktualizována:', {
        btc: priceCache.bitcoin.usd,
        eth: priceCache.ethereum.usd,
        xmr: priceCache.monero.usd,
      });
    }

  } finally {
    cacheMetadata.isUpdating = false;
  }
}

/**
 * Vrátí aktuální ceny (s respektováním force overrides)
 * @returns {Object} - Cenová data
 */
function getPrices() {
  const override = GameConfig.override;

  // Aplikuj force overrides pokud jsou nastaveny
  const prices = {
    bitcoin: {
      usd: override.forceBtcPrice > 0 ? override.forceBtcPrice : priceCache.bitcoin.usd,
      usd_24h_change: override.forceBtcPrice > 0 ? 0 : priceCache.bitcoin.usd_24h_change,
      isForced: override.forceBtcPrice > 0,
    },
    ethereum: {
      usd: override.forceEthPrice > 0 ? override.forceEthPrice : priceCache.ethereum.usd,
      usd_24h_change: override.forceEthPrice > 0 ? 0 : priceCache.ethereum.usd_24h_change,
      isForced: override.forceEthPrice > 0,
    },
    monero: {
      usd: override.forceXmrPrice > 0 ? override.forceXmrPrice : priceCache.monero.usd,
      usd_24h_change: override.forceXmrPrice > 0 ? 0 : priceCache.monero.usd_24h_change,
      isForced: override.forceXmrPrice > 0,
    },
  };

  return prices;
}

/**
 * Vrátí metadata o cache stavu
 * @returns {Object} - Cache metadata
 */
function getCacheStatus() {
  return {
    ...cacheMetadata,
    priceUpdateInterval: GameConfig.system.priceUpdateInterval,
    hasData: priceCache.bitcoin.usd > 0,
  };
}

/**
 * Vynutí okamžitou aktualizaci cen
 * @returns {Promise<boolean>} - Úspěch operace
 */
async function forceUpdate() {
  console.log('[PriceService] Vynucená aktualizace cen...');
  await updatePriceCache();
  return cacheMetadata.lastError === null;
}

/**
 * Spustí automatické aktualizace cen
 */
function startPriceUpdates() {
  // Zastav existující interval pokud běží
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  // Okamžitá první aktualizace
  updatePriceCache();

  // Nastavení intervalu pro pravidelné aktualizace
  const interval = GameConfig.system.priceUpdateInterval;
  updateInterval = setInterval(() => {
    updatePriceCache();
  }, interval);

  console.log(`[PriceService] Automatické aktualizace spuštěny (interval: ${interval}ms)`);
}

/**
 * Zastaví automatické aktualizace
 */
function stopPriceUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('[PriceService] Automatické aktualizace zastaveny');
  }
}

/**
 * Restartuje aktualizace s novým intervalem
 * Volá se po změně priceUpdateInterval v GameConfig
 */
function restartWithNewInterval() {
  console.log('[PriceService] Restartování s novým intervalem...');
  stopPriceUpdates();
  startPriceUpdates();
}

module.exports = {
  getPrices,
  getCacheStatus,
  forceUpdate,
  startPriceUpdates,
  stopPriceUpdates,
  restartWithNewInterval,
};

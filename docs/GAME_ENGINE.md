# MINEOPS Game Engine

## Přehled

Game Engine je serverová komponenta zodpovědná za výpočet těžby, správu herního stavu a synchronizaci s klienty.

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                      GAME ENGINE                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Tick Loop     │  │  Price Service  │                   │
│  │   (10s)         │  │   (60s)         │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              GameConfig (Runtime State)             │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  Mining Calc    │  │  WebSocket      │                   │
│  │  (placeholder)  │  │  (placeholder)  │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Tick System

### Koncept

Herní logika běží v diskrétních "tickách" - pravidelných intervalech, kdy se provádějí všechny výpočty.

```
Timeline:
|----10s----|----10s----|----10s----|----10s----|
   Tick 1      Tick 2      Tick 3      Tick 4
```

### Konfigurace

```javascript
// V gameConfig.js
system: {
  tickInterval: 10000,  // 10 sekund v ms
  priceUpdateInterval: 60000,  // 60 sekund pro ceny
}
```

### Co se děje každý tick

```javascript
async function processTick() {
  // 1. Aktualizace system stats
  GameConfig.system.totalTicks++;
  GameConfig.system.lastTickTime = new Date().toISOString();

  // 2. Pro každého aktivního hráče (PLACEHOLDER):
  //    - Vypočítat vytěžené BTC
  //    - Odečíst náklady na elektřinu
  //    - Aktualizovat balance

  // 3. Zpracování aktivních efektů (DDoS, boosty, etc.)

  // 4. Broadcast updates klientům (WebSocket - PLACEHOLDER)

  // 5. Logování statistik
}
```

## Mining Calculations

### Základní vzorec

```javascript
// BTC vytěžené za tick
minedBTC = hashrate * globalMult * btcPerMHPerSecond * tickSeconds

// Náklady na elektřinu za tick
electricityCostUSD = powerWatts * costPerWattHour * tickHours
electricityCostBTC = electricityCostUSD / btcPriceUSD

// Čistý zisk
netProfit = minedBTC - electricityCostBTC
```

### Proměnné

| Proměnná | Typ | Popis |
|----------|-----|-------|
| `hashrate` | MH/s | Celkový hashrate hráče |
| `globalMult` | float | Globální násobič (eventy) |
| `btcPerMHPerSecond` | float | BTC za MH/s za sekundu |
| `powerWatts` | W | Celková spotřeba HW |
| `costPerWattHour` | USD | Cena elektřiny |

### Placeholder hodnoty

```javascript
// Velmi zjednodušený výpočet pro MVP
const btcPerMHPerSecond = 0.00000000002;

// V realitě by se použila:
// - Aktuální network difficulty
// - Block reward (aktuálně 3.125 BTC)
// - Čas mezi bloky (~10 minut)
```

## Price Service

### Cache mechanismus

Ceny kryptoměn jsou cachovány na serveru aby:
1. Snížily zatížení externího API
2. Zajistily konzistentní ceny pro všechny hráče
3. Umožnily fallback při výpadku API

```javascript
let priceCache = {
  bitcoin: { usd: 0, usd_24h_change: 0 },
  dogecoin: { usd: 0, usd_24h_change: 0 },
  monero: { usd: 0, usd_24h_change: 0 },
};
```

### Aktualizační cyklus

```
1. Při startu serveru -> okamžitá aktualizace
2. Každých 60s -> automatická aktualizace
3. Admin může vynutit -> POST /api/admin/prices/refresh
```

### Force Override

Admin může nastavit fixní ceny:

```javascript
// V gameConfig.js
override: {
  forceBtcPrice: 0,   // 0 = použít API
  forceDogePrice: 0,  // >0 = fixní cena
  forceXmrPrice: 0,
}
```

## Engine Lifecycle

### Start

```javascript
function startEngine() {
  // 1. Inicializace timestamps
  GameConfig.system.serverStartTime = new Date().toISOString();

  // 2. Start price service
  priceService.startPriceUpdates();

  // 3. Start tick loop
  engineState.tickInterval = setInterval(processTick, tickInterval);

  // 4. První tick okamžitě
  processTick();
}
```

### Stop

```javascript
function stopEngine() {
  // 1. Zastavení tick loop
  clearInterval(engineState.tickInterval);

  // 2. Zastavení price service
  priceService.stopPriceUpdates();

  // 3. Cleanup
  engineState.isRunning = false;
}
```

### Restart

```javascript
function restartEngine() {
  stopEngine();
  setTimeout(startEngine, 100);  // Krátká pauza
}
```

## Engine State

```javascript
const engineState = {
  isRunning: false,
  tickInterval: null,
  stats: {
    totalTicks: 0,
    lastTickDuration: 0,
    averageTickDuration: 0,
    tickDurations: [],  // Posledních 100 ticků
    errors: 0,
  },
  activeConnections: new Set(),  // Pro WebSocket
};
```

## API pro monitoring

### GET /api/admin/status

```json
{
  "success": true,
  "data": {
    "engine": {
      "isRunning": true,
      "serverStartTime": "2024-01-01T12:00:00.000Z",
      "totalTicks": 1234,
      "lastTickTime": "2024-01-01T12:05:30.000Z",
      "tickDelta": 5432,
      "tickInterval": 10000,
      "stats": {
        "totalTicks": 1234,
        "lastTickDuration": 12,
        "averageTickDuration": 8,
        "activeConnections": 42,
        "errors": 0
      }
    },
    "priceService": {
      "lastUpdate": "2024-01-01T12:05:00.000Z",
      "updateCount": 21,
      "errorCount": 0,
      "hasData": true
    }
  }
}
```

## Placeholder funkce

### Mining calculation per user

```javascript
// PLACEHOLDER - Čeká na DB tabulky
const activeUsers = await db.query(`
  SELECT u.id, u.username, u.balance, u.total_hashrate,
         COALESCE(SUM(h.power_consumption), 0) as total_power
  FROM users u
  LEFT JOIN user_hardware uh ON u.id = uh.user_id AND uh.is_active = true
  LEFT JOIN hardware_types h ON uh.hardware_id = h.id
  WHERE u.is_active = true
  GROUP BY u.id
`);

for (const user of activeUsers.rows) {
  const minedBTC = calculateMinedBTC(user.total_hashrate);
  const electricityCostBTC = usdToBtc(calculateElectricityCost(user.total_power));
  const netProfit = minedBTC - electricityCostBTC;

  await db.query(`
    UPDATE users
    SET balance = balance + $1,
        total_earned = total_earned + $2
    WHERE id = $3
  `, [netProfit, minedBTC, user.id]);
}
```

### WebSocket broadcast

```javascript
// PLACEHOLDER - Čeká na WebSocket implementaci
function broadcastToUser(userId, data) {
  const connection = findConnectionByUser(userId);
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(data));
  }
}

function broadcastToAll(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
```

## Performance

### Tick duration monitoring

Engine sleduje dobu trvání každého ticku:

```javascript
const tickStart = Date.now();
// ... processing ...
const tickDuration = Date.now() - tickStart;

// Varování pokud tick trvá příliš dlouho
if (tickDuration > tickInterval * 0.5) {
  console.warn(`[GameEngine] Tick took ${tickDuration}ms (>${tickInterval * 0.5}ms threshold)`);
}
```

### Očekávané hodnoty

| Metrika | Očekávaná hodnota |
|---------|-------------------|
| Tick duration | < 100ms |
| Memory usage | < 100MB |
| CPU usage | < 5% (idle) |

## Konfigurace hardware

### Base hashrates (placeholder)

```javascript
baseHashrates: {
  cpu: 0.1,        // CPU mining - velmi pomalé
  gpu_low: 25,     // Entry-level GPU (GTX 1650)
  gpu_mid: 80,     // Mid-range GPU (RTX 3060)
  gpu_high: 120,   // High-end GPU (RTX 4090)
  asic_s9: 14000,  // Antminer S9
  asic_s19: 95000, // Antminer S19 Pro
}
```

### Power consumption (placeholder)

```javascript
powerConsumption: {
  cpu: 65,      // 65W
  gpu_low: 120, // 120W
  gpu_mid: 200, // 200W
  gpu_high: 320,// 320W
  asic_s9: 1350,// 1350W
  asic_s19: 3250,// 3250W
}
```

## Roadmap

1. **Phase 1 (Current):** Basic tick loop, price caching
2. **Phase 2:** Database integration, user mining
3. **Phase 3:** WebSocket real-time updates
4. **Phase 4:** Pool system, PvP mechanics
5. **Phase 5:** Advanced events, leaderboards

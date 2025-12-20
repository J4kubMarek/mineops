# MINEOPS Admin Panel - ROOT_TERMINAL v0.1

## Přehled

Admin panel je speciální rozhraní pro správu herního serveru. Využívá červené téma pro odlišení od hráčského prostředí (zelené) a signalizuje, že zde probíhají "nebezpečné" operace.

**URL:** `http://localhost:3000/admin`

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL STACK                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (views/admin.html)                                │
│  └── Vanilla JS, Admin CSS Theme                            │
├─────────────────────────────────────────────────────────────┤
│  API Layer (backend/routes/admin.js)                        │
│  └── Express.js REST endpoints                              │
├─────────────────────────────────────────────────────────────┤
│  Game Engine (backend/engine/gameEngine.js)                 │
│  └── 10s tick loop, mining calculations                     │
├─────────────────────────────────────────────────────────────┤
│  Price Service (backend/services/priceService.js)           │
│  └── 60s cache updates from CoinGecko                       │
├─────────────────────────────────────────────────────────────┤
│  Game Config (backend/config/gameConfig.js)                 │
│  └── Runtime editable game variables                        │
└─────────────────────────────────────────────────────────────┘
```

## Sekce Admin Panelu

### 1. HEADER - Live Monitoring

Status bar zobrazující real-time data:

| Indikátor | Popis |
|-----------|-------|
| SYSTEM | Online/Offline stav enginu |
| TICKS | Interval herního ticku (default 10s) |
| DELTA | Čas od posledního ticku (ms) |
| USERS | Počet aktivních připojení |

**Refresh interval:** 5 sekund

### 2. GLOBAL VARIABLES (Config)

Editovatelné herní proměnné rozdělené do skupin:

#### ECONOMY
| Proměnná | Default | Popis |
|----------|---------|-------|
| `electricityCostUsd` | 0.12 | Cena elektřiny za Watt/h v USD |
| `globalHashrateMult` | 1.00 | Globální násobič těžby (pro eventy) |
| `marketVolatility` | 0.05 | Volatilita trhu (placeholder) |

#### GAMEPLAY
| Proměnná | Default | Popis |
|----------|---------|-------|
| `ddosPowerPercent` | 15 | % snížení výkonu při DDoS |
| `ddosDurationMin` | 60 | Trvání DDoS útoku v minutách |
| `maxPoolMembers` | 20 | Maximální počet členů v poolu |

#### SYSTEM
| Proměnná | Default | Popis |
|----------|---------|-------|
| `tickInterval` | 10000 | Interval herního ticku v ms |
| `priceUpdateInterval` | 60000 | Interval aktualizace cen v ms |

#### MANUAL OVERRIDE
| Proměnná | Default | Popis |
|----------|---------|-------|
| `forceBtcPrice` | 0 | Vynucená cena BTC (0 = API) |
| `forceEthPrice` | 0 | Vynucená cena ETH (0 = API) |
| `forceXmrPrice` | 0 | Vynucená cena XMR (0 = API) |

**Tlačítka:**
- `[ EXECUTE CHANGES ]` - Uloží všechny změny na server
- `[ RELOAD CONFIG ]` - Načte aktuální konfiguraci ze serveru
- `[ RELOAD API PRICES ]` - Vynutí okamžitou aktualizaci cen z CoinGecko

### 3. PLAYER MANAGEMENT

Správa hráčů pomocí username nebo ID:

| Akce | Popis | Status |
|------|-------|--------|
| KICK | Odpojí hráče (ukončí socket) | PLACEHOLDER |
| BAN | Nastaví is_banned = true | PLACEHOLDER |
| UNBAN | Odstraní ban | PLACEHOLDER |
| GIFT | Přidá resources (BTC, hashrate) | PLACEHOLDER |

**Poznámka:** Většina funkcí čeká na implementaci databázových tabulek a WebSocket.

### 4. EMERGENCY

Nouzové ovládání serveru:

#### Maintenance Mode
- **ENABLE** - Aktivuje maintenance, notifikuje hráče
- **DISABLE** - Deaktivuje maintenance

#### Engine Control
- **START** - Spustí herní engine
- **STOP** - Zastaví engine (pozastaví těžbu!)
- **RESTART** - Restartuje engine s aktuální konfigurací

## API Endpoints

Všechny admin endpointy jsou pod prefixem `/api/admin/`:

### Status & Monitoring
```
GET /api/admin/status     - Kompletní stav serveru
GET /api/admin/logs       - Admin log (historie akcí)
```

### Configuration
```
GET  /api/admin/config    - Aktuální konfigurace
POST /api/admin/config    - Aktualizace konfigurace
     Body: { section, key, value } nebo { updates: [...] }
```

### Price Management
```
POST /api/admin/prices/refresh  - Vynucené obnovení cen
```

### User Management
```
GET  /api/admin/users          - Seznam uživatelů (placeholder)
POST /api/admin/user/kick      - Kick uživatele
POST /api/admin/user/ban       - Ban uživatele
POST /api/admin/user/unban     - Unban uživatele
POST /api/admin/user/gift      - Gift resources
```

### Broadcast & Emergency
```
POST /api/admin/broadcast      - Broadcast zprávy
POST /api/admin/maintenance    - Toggle maintenance mode
POST /api/admin/engine/start   - Spuštění enginu
POST /api/admin/engine/stop    - Zastavení enginu
POST /api/admin/engine/restart - Restart enginu
```

## Game Engine

### Tick Mechanism

Engine běží v nekonečné smyčce s konfigurovatelným intervalem (default 10s):

```javascript
// Každý tick provádí:
1. Inkrementace tick counteru
2. Výpočet vytěženého BTC pro každého hráče (PLACEHOLDER)
3. Odečtení nákladů na elektřinu (PLACEHOLDER)
4. Aktualizace statistik
5. Broadcast updates klientům (PLACEHOLDER)
```

### Mining Calculation (Placeholder)

```javascript
// Zjednodušený vzorec pro MVP:
minedBTC = hashrate * globalMult * btcPerMHPerSecond * tickSeconds

// Kde:
// - hashrate: MH/s hráče
// - globalMult: economy.globalHashrateMult
// - btcPerMHPerSecond: ~0.00000000002 (placeholder)
// - tickSeconds: tickInterval / 1000
```

### Electricity Cost

```javascript
// Výpočet nákladů:
costPerWattHour = electricityCostUsd / 1000  // kWh -> Wh
tickHours = tickInterval / 1000 / 3600
electricityCost = powerWatts * costPerWattHour * tickHours
```

## Price Service

### Cache Mechanism

Ceny kryptoměn jsou cachovány na serveru s automatickou aktualizací:

- **Zdroj:** CoinGecko API (free tier)
- **Interval:** 60 sekund (konfigurovatelné)
- **Coins:** Bitcoin, Ethereum, Monero

### Force Override

Admin může vynucet fixní ceny přes konfiguraci:
- Pokud `forceBtcPrice > 0`, použije se tato hodnota místo API
- Užitečné pro testování bez závislosti na externím API

## Placeholder funkce

Následující funkce jsou připraveny, ale čekají na implementaci:

| Funkce | Čeká na |
|--------|---------|
| User mining calculation | DB tabulky (users, user_hardware) |
| User kick | WebSocket implementace |
| User ban/unban | DB tabulky + session management |
| Gift resources | DB tabulky |
| Broadcast messages | WebSocket implementace |
| User list | DB tabulky |

## Bezpečnost

**VAROVÁNÍ:** V produkci je nutné implementovat:

1. **Autentizace** - Admin login s heslem
2. **Autorizace** - Kontrola admin role v DB
3. **Rate limiting** - Ochrana proti abuse
4. **HTTPS** - Šifrované spojení
5. **Audit log** - Persistentní logování do DB

Aktuálně je middleware `adminAuthMiddleware` vypnutý pro vývoj!

## Soubory

| Soubor | Účel |
|--------|------|
| `views/admin.html` | Admin panel UI |
| `public/css/style.css` | Admin CSS styly (sekce ADMIN PANEL) |
| `backend/routes/admin.js` | API endpointy |
| `backend/engine/gameEngine.js` | Herní smyčka |
| `backend/services/priceService.js` | Caching cen |
| `backend/config/gameConfig.js` | Herní konfigurace |

## Spuštění

```bash
# Development
npm run dev

# Server automaticky:
# 1. Spustí Express na portu 3000
# 2. Nastartuje Game Engine (10s ticky)
# 3. Spustí Price Service (60s updates)

# Admin panel dostupný na:
http://localhost:3000/admin
```

## Budoucí vylepšení

1. **Toast notifikace** - Nahradit console.log hezčími notifikacemi
2. **Persistentní log** - Ukládání admin logu do databáze
3. **Real-time updates** - WebSocket pro live data
4. **User search** - Vyhledávání a filtrování hráčů
5. **Grafy** - Vizualizace statistik (tick performance, users online)
6. **Keyboard shortcuts** - Klávesové zkratky pro rychlé akce

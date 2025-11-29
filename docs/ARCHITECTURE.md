# MINEOPS - Architektura projektu

## Přehled

MINEOPS je webová idle hra zaměřená na simulaci těžby kryptoměn. Hráči budují a optimalizují svou těžební farmu, vylepšují hardware, spojují se do poolů a soutěží s ostatními.

---

## Tech Stack

### Backend
- **Node.js** + **Express** - HTTP server a routing
- **PostgreSQL** - hlavní databáze (přes `pg` driver)
- **bcryptjs** - hashování hesel
- **dotenv** - správa konfigurace

### Frontend
- **Vanilla HTML/CSS/JS** - čistý frontend bez frameworku
- **Monospace retro design** - viz `docs/VISUAL_DESIGN.md`

### Development
- **nodemon** - auto-reload při vývoji
- **Custom migration system** - verzování databáze

---

## Struktura projektu

```
mineops/
├── backend/
│   ├── routes/          # API endpointy
│   ├── controllers/     # Business logika
│   └── models/          # Databázové modely
├── config/
│   └── database.js      # PostgreSQL connection pool
├── docs/
│   ├── ARCHITECTURE.md  # Tento soubor
│   └── VISUAL_DESIGN.md # Design systém
├── migrations/          # SQL migrace (číslované)
│   └── 001_create_users_table.sql
├── public/
│   ├── css/
│   │   └── style.css    # Hlavní stylesheet
│   └── js/
│       └── components.js # Component loader
├── scripts/
│   └── migrate.js       # Migrační systém
├── views/
│   ├── components/
│   │   └── menu.html    # Sdílené menu
│   ├── dashboard.html
│   ├── hardware.html
│   └── farm.html
├── .env                 # Konfigurace (gitignored)
├── .env.example         # Template konfigurace
├── package.json
└── server.js            # Entry point
```

---

## Databázová struktura

### Současné tabulky

#### `users`
Hlavní tabulka uživatelů.

```sql
- id (SERIAL PRIMARY KEY)
- username (VARCHAR 50, UNIQUE)
- email (VARCHAR 255, UNIQUE)
- password_hash (VARCHAR 255)
- balance (DECIMAL 16,8) - BTC balance
- total_hashrate (DECIMAL 12,2) - MH/s
- total_earned (DECIMAL 16,8) - celkové vytěžené BTC
- created_at, updated_at, last_login (TIMESTAMP)
- is_active, is_verified (BOOLEAN)
```

### Plánované tabulky

Následující tabulky budou potřeba pro kompletní funkcionalitu:

- **hardware_types** - katalog dostupného HW (GPU, ASIC...)
- **user_hardware** - vlastněný HW každého uživatele
- **mining_pools** - dostupné mining pooly
- **pool_memberships** - členství uživatelů v poolech
- **research_tree** - technologie k výzkumu
- **user_research** - odemčené technologie
- **transactions** - historie transakcí
- **mining_sessions** - záznamy těžebních session
- **attacks** - sabotáže mezi hráči

---

## API Endpoints (plánované)

### Authentication
```
POST /api/auth/register  - Registrace
POST /api/auth/login     - Přihlášení
POST /api/auth/logout    - Odhlášení
GET  /api/auth/me        - Získat info o aktuálním uživateli
```

### Mining
```
GET  /api/mining/status  - Aktuální stav těžby
POST /api/mining/start   - Spustit těžbu
POST /api/mining/stop    - Zastavit těžbu
GET  /api/mining/stats   - Statistiky (hashrate, earnings...)
```

### Hardware
```
GET  /api/hardware/catalog        - Katalog dostupného HW
GET  /api/hardware/inventory      - Vlastněný HW
POST /api/hardware/buy/:id        - Koupit HW
POST /api/hardware/sell/:id       - Prodat HW
POST /api/hardware/upgrade/:id    - Upgradovat HW
```

### Pool
```
GET  /api/pool/list              - Seznam poolů
POST /api/pool/join/:id          - Připojit se k poolu
POST /api/pool/leave             - Opustit pool
GET  /api/pool/stats/:id         - Statistiky poolu
POST /api/pool/create            - Vytvořit vlastní pool
```

### Research
```
GET  /api/research/tree          - Výzkumný strom
POST /api/research/unlock/:id    - Odemknout technologii
GET  /api/research/progress      - Aktuální výzkumný progress
```

### Leaderboard
```
GET  /api/leaderboard/hashrate   - Top hráči podle hashrate
GET  /api/leaderboard/earnings   - Top hráči podle výdělků
GET  /api/leaderboard/pools      - Top pooly
```

---

## Game Mechanics

### Idle Mining
- Pasivní generování BTC na základě hashrate
- Server-side výpočet (ochrana proti cheatingu)
- Offline earning (omezený čas, např. 24h)

### Hardware System
- **Tiers**: Starter → Mid-range → High-end → Extreme
- **Typy**: CPU, GPU, ASIC
- **Parametry**: Hashrate, Power, Cost, Efficiency
- **Upgrady**: Overclock, Cooling, Firmware

### Pool System
- **Solo mining**: 100% zisk, vysoká variance
- **Pool mining**: Stabilní příjem, pool fee (2-5%)
- **Own pool**: Možnost vytvořit vlastní pool, získávat fee

### Research Tree
- **Efficiency**: Lepší MH/W ratio
- **Overclocking**: Vyšší hashrate, vyšší spotřeba
- **Cooling**: Možnost delšího overlocku
- **Pool bonus**: Výhody v poolech
- **Attack/Defense**: PvP mechaniky

### PvP - Sabotage System
- **DDoS Attack**: Dočasně sníží hashrate cíle
- **Steal hashrate**: Ukradne % hashrate na omezenou dobu
- **Defense**: Research obran, pojištění
- **Cooldowns**: Prevence spamu

---

## Konfigurace

### Environment Variables (.env)

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mineops
DB_USER=postgres
DB_PASSWORD=your_password

# Security
SESSION_SECRET=change_in_production
```

---

## Skripty (npm)

```bash
npm run dev      # Spustí server s nodemon (auto-reload)
npm start        # Spustí produkční server
npm run migrate  # Spustí databázové migrace
```

---

## Databázové migrace

### Jak vytvořit novou migraci

1. Vytvoř soubor v `migrations/` s formátem: `XXX_description.sql`
   - `XXX` = číslo (001, 002, 003...)
   - Např: `002_create_hardware_types.sql`

2. Napiš SQL migrace:
```sql
-- Migration: Create Hardware Types Table
-- Description: Katalog dostupných těžebních zařízení

CREATE TABLE hardware_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  hashrate DECIMAL(12, 2) NOT NULL,
  power_consumption INTEGER NOT NULL,
  cost DECIMAL(16, 8) NOT NULL,
  tier VARCHAR(20) NOT NULL
);
```

3. Spusť migraci:
```bash
npm run migrate
```

### Poznámky k migracím
- Migrace se spouští v pořadí podle čísla
- Každá migrace běží v transakci (atomické)
- Pokud migrace selže, rollback automaticky
- Spuštěné migrace jsou zaznamenány v tabulce `migrations`

---

## Security Best Practices

### Authentication
- Hesla hashovat pomocí bcrypt (cost factor 10+)
- Session-based auth (nebo JWT pro API)
- Rate limiting na login endpoint

### Database
- Používat prepared statements (ochrana proti SQL injection)
- Nikdy nevkládat user input přímo do SQL
- Validovat všechny inputs na backendu

### Game Logic
- Všechny výpočty pouze server-side
- Validovat každou akci (má user dostatek peněz?)
- Logovat všechny transakce pro audit

---

## Roadmap

### Phase 1 - MVP (Current)
- [x] Základní struktura projektu
- [x] Design systém
- [x] User tabulka a migrace
- [ ] Autentizace (registrace, login)
- [ ] Základní mining mechanika
- [ ] Hardware shop (1-2 typy)

### Phase 2 - Core Features
- [ ] Pool system
- [ ] Research tree (základní)
- [ ] Leaderboard
- [ ] Offline earnings

### Phase 3 - Advanced Features
- [ ] PvP sabotage
- [ ] Vlastní pooly
- [ ] Achievements
- [ ] Events (např. "Bitcoin halving")

### Phase 4 - Polish
- [ ] Optimalizace výkonu
- [ ] Mobile responsive
- [ ] Animace a efekty
- [ ] Tutorial

---

## Kontakt & Poznámky

Pro dotazy k architektuře nebo návrhy nových features, viz:
- GitHub Issues
- Project documentation v `/docs/`

**POZOR**: Nikdy necommitovat `.env` soubor! Používej `.env.example` jako template.

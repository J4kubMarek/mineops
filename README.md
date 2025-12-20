# MINEOPS

> Crypto Mining Idle Game - Strategická idle hra o těžbě kryptoměn

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## O hre

MINEOPS je webova idle hra, kde hraci:
- Simulovane tezi kryptomeny (BTC, DOGE, XMR)
- Vylepsuju svuj tezebni hardware
- Seskupuji se v mining poolech
- Provadeji vyzkum technologii
- Soutezi a sabotuji ostatni hrace

### Design

Retro terminal UI inspirovane:
- Game Boy Color menu
- MS-DOS aplikace (Norton Commander)
- Bloomberg Terminal
- Hrami jako Defcon, Papers Please

Vice v: [`docs/VISUAL_DESIGN.md`](docs/VISUAL_DESIGN.md)

### Hardware Market

Hra nabizi 4 kategorie tezebnich zarizeni:

| Kategorie | Algoritmus | Mena | Priklad |
|-----------|------------|------|---------|
| BTC ASIC | SHA-256 | Bitcoin | S19 Pro, S21 Hydro |
| DOGE ASIC | Scrypt | Dogecoin | L7 Master, L9 X-treme |
| XMR ASIC | RandomX | Monero | Ryzen Beast, Threadripper X |
| SOLO | SHA-256 | Bitcoin | Bitaxe Ultra, Bitaxe Gamma |

### Menovy system

- **USD** - Hlavni platebni mena pro nakupy a poplatky
- **BTC** - Vytezena kryptomena, prodava se za USD

Hraci ziskavaji USD prodejem vytezeneho BTC a plati za:
- Nakup hardwaru
- Ucty za elektrinu (planovano)
- Najem prostoru (planovano)

---

## Rychlý start

### Prerekvizity

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **npm** nebo **yarn**

### Instalace

1. **Klonuj repository**
```bash
git clone <repository-url>
cd mineops
```

2. **Nainstaluj závislosti**
```bash
npm install
```

3. **Nakonfiguruj prostředí**
```bash
cp .env.example .env
# Uprav .env podle tvého PostgreSQL nastavení
```

4. **Vytvoř databázi**
```bash
psql -U postgres
CREATE DATABASE mineops;
\q
```

5. **Spusť migrace**
```bash
npm run migrate
```

6. **Spusť dev server**
```bash
npm run dev
```

7. **Otevři v prohlížeči**
```
http://localhost:3000
```

---

## Skripty

```bash
npm run dev      # Development server s auto-reload
npm start        # Production server
npm run migrate  # Spustit databázové migrace
```

---

## Struktura projektu

```
mineops/
├── backend/
│   ├── config/          # Herni konfigurace (gameConfig.js)
│   ├── engine/          # Herni engine (tick system)
│   ├── routes/          # API endpointy
│   │   ├── api.js       # Zakladni API (health, prices)
│   │   ├── admin.js     # Admin panel API
│   │   └── hardware.js  # Hardware market API
│   └── services/        # Externi sluzby (ceny kryptoměn)
├── config/              # Konfigurace (database connection)
├── docs/                # Dokumentace
├── migrations/          # SQL migrace
│   ├── 001_create_users_table.sql
│   └── 002_add_hardware_and_usd_balance.sql
├── public/              # Staticke soubory (CSS, JS)
├── scripts/             # Utility skripty
├── views/               # HTML stranky a komponenty
├── .env                 # Environment variables (gitignored)
├── package.json
└── server.js            # Entry point
```

Detailni popis: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Technologie

### Backend
- **Express** - Web framework
- **PostgreSQL** - Databáze
- **bcryptjs** - Hashování hesel
- **dotenv** - Environment variables

### Frontend
- **Vanilla HTML/CSS/JS** - Bez frameworků
- **Monospace design** - Retro terminal look

### Development
- **nodemon** - Auto-reload
- **Custom migration system** - Verzování DB

---

## Dokumentace

- [📐 Architektura projektu](docs/ARCHITECTURE.md)
- [🎨 Design systém](docs/VISUAL_DESIGN.md)

---

## Roadmap

- [x] Zakladni struktura projektu
- [x] Design system a UI komponenty
- [x] Databazove migrace
- [x] Hardware Market s 4 kategoriemi (BTC ASIC, DOGE ASIC, XMR ASIC, SOLO)
- [x] USD menovy system
- [x] Nakupni mechanika s tranakcemi
- [ ] User autentizace
- [ ] Zakladni mining mechanika
- [ ] Prodej BTC za USD
- [ ] Mining pools
- [ ] Elektrina a provozni naklady
- [ ] Research tree
- [ ] PvP sabotage

Vice v: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#roadmap)

---

## Vývoj

### Vytvoření nové migrace

1. Vytvoř soubor v `migrations/`:
   - Formát: `XXX_description.sql`
   - Příklad: `002_create_hardware_types.sql`

2. Napiš SQL kód migrace

3. Spusť:
```bash
npm run migrate
```

### Přidání nové stránky

1. Vytvoř HTML soubor v `views/`
2. Přidej route v `server.js`
3. Přidej odkaz do menu v `views/components/menu.html`

---

## Environment Variables

Kopie `.env.example` → `.env` a uprav:

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

**⚠️ NIKDY necommituj `.env` soubor!**

---

## Contributing

1. Fork projekt
2. Vytvoř feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit změny (`git commit -m 'Add some AmazingFeature'`)
4. Push do branch (`git push origin feature/AmazingFeature`)
5. Otevři Pull Request

---

## License

MIT License - viz `LICENSE` soubor

---

## Kontakt

Pro bugy a feature requesty použij GitHub Issues.

---

**Happy mining!**

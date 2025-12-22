# MINEOPS - Farm System Documentation

## Přehled

Farm systém umožňuje hráčům pronajímat prostory pro své těžební operace a přiřazovat do nich zakoupený hardware. Každý prostor má různé parametry jako maximální spotřebu, cenu nájmu a cenu elektřiny.

## Databázová struktura

### Tabulka: `farm_spaces`
Katalog dostupných prostorů pro pronájem.

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | SERIAL | Primární klíč |
| name | VARCHAR(100) | Název prostoru |
| description | TEXT | Popis prostoru |
| max_power_watts | INTEGER | Maximální povolená spotřeba ve Wattech |
| rent_usd_per_day | DECIMAL(10,2) | Denní nájem v USD |
| electricity_cost_per_kwh | DECIMAL(6,4) | Cena elektřiny za kWh v USD |
| image_url | VARCHAR(255) | URL obrázku (PLACEHOLDER) |
| sort_order | INTEGER | Pořadí pro zobrazení |
| is_available | BOOLEAN | Zda je prostor dostupný |

**Přednastavené prostory:**

| Prostor | Max Power | Nájem/den | Elektřina/kWh |
|---------|-----------|-----------|---------------|
| Garáž | 3,500 W | $5.00 | $0.28 |
| Průmyslová místnost | 15,000 W | $25.00 | $0.18 |
| Malá hala | 50,000 W | $100.00 | $0.12 |

### Tabulka: `farms`
Farmy jednotlivých hráčů.

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | SERIAL | Primární klíč |
| user_id | INTEGER | FK na users |
| space_id | INTEGER | FK na farm_spaces |
| name | VARCHAR(100) | Uživatelský název farmy |
| is_active | BOOLEAN | Zda farma aktivně těží |
| created_at | TIMESTAMP | Datum vytvoření |
| updated_at | TIMESTAMP | Datum poslední úpravy |

### Tabulka: `farm_hardware`
Přiřazení hardwaru k farmám.

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | SERIAL | Primární klíč |
| farm_id | INTEGER | FK na farms (CASCADE) |
| user_hardware_id | INTEGER | FK na user_hardware (UNIQUE) |
| quantity | INTEGER | Počet kusů přiřazených |
| is_running | BOOLEAN | Zda hardware běží |
| assigned_at | TIMESTAMP | Datum přiřazení |

**Důležité:** Každý `user_hardware` záznam může být přiřazen pouze k jedné farmě (UNIQUE constraint).

## API Endpointy

### Prostory

#### GET /api/farm-spaces
Vrací seznam dostupných prostorů.

**Response:**
```json
{
  "success": true,
  "spaces": [
    {
      "id": 1,
      "name": "Garáž",
      "description": "...",
      "max_power_watts": 3500,
      "rent_usd_per_day": "5.00",
      "electricity_cost_per_kwh": "0.2800",
      "image_url": null,
      "sort_order": 1
    }
  ]
}
```

### Farmy

#### GET /api/farms
Vrací seznam farem uživatele s agregovanými statistikami.

**Query params:** `user_id` (default: 1)

**Response:**
```json
{
  "success": true,
  "farms": [
    {
      "id": 1,
      "name": "Moje první farma",
      "space_name": "Garáž",
      "max_power_watts": 3500,
      "current_power_watts": 1350,
      "total_hashrate": 14,
      "hardware_count": 1,
      "rent_usd_per_day": "5.00",
      "electricity_cost_per_kwh": "0.2800"
    }
  ]
}
```

#### GET /api/farms/:id
Vrací detail farmy včetně seznamu hardwaru.

#### POST /api/farms
Vytvoří novou farmu.

**Body:**
```json
{
  "space_id": 1,
  "name": "Název farmy"
}
```

#### PUT /api/farms/:id
Aktualizuje farmu (přejmenování).

**Body:**
```json
{
  "name": "Nový název"
}
```

#### DELETE /api/farms/:id
Smaže farmu. Hardware je automaticky vrácen do inventáře.

#### POST /api/farms/:id/upgrade
Upgraduje prostor farmy na větší.

**Body:**
```json
{
  "new_space_id": 2
}
```

**Omezení:** Lze pouze upgradovat na větší prostor (vyšší sort_order).

### Hardware ve farmě

#### GET /api/farms/:id/hardware
Vrací hardware přiřazený k farmě.

#### POST /api/farms/:id/hardware
Přiřadí hardware z inventáře k farmě.

**Body:**
```json
{
  "user_hardware_id": 1,
  "quantity": 1
}
```

**Validace:**
- Kontroluje dostupné množství v inventáři
- Kontroluje kapacitu prostoru (max_power_watts)
- Hardware může být přiřazen pouze k jedné farmě

#### DELETE /api/farms/:id/hardware/:hwId
Odebere hardware z farmy zpět do inventáře.

#### PUT /api/farms/:id/hardware/:hwId/toggle
Zapne/vypne hardware ve farmě. Vypnutý hardware nespotřebovává elektřinu ale ani netěží.

### Volný hardware

#### GET /api/farms/available-hardware
Vrací hardware, který není přiřazen k žádné farmě.

**Response:**
```json
{
  "success": true,
  "hardware": [
    {
      "user_hardware_id": 1,
      "name": "S9 Legacy",
      "total_quantity": 2,
      "assigned_quantity": 1,
      "available_quantity": 1,
      "power_consumption": 1350,
      "hashrate": 14,
      "hashrate_unit": "TH/s"
    }
  ]
}
```

## Frontend (farm.html)

### Struktura stránky

1. **Header panel** - Název stránky a popis
2. **Hardware overview** - Přehled zakoupeného hardwaru s počty
3. **Farmy sekce**
   - Tlačítko "Založit novou farmu"
   - Grid s kartami farem
   - Empty state pro případ bez farem

### Farm karta obsahuje

- Název farmy a typ prostoru
- Akční tlačítka: Přejmenovat, Upgrade, Smazat
- Statistiky: Spotřeba, Hashrate, Elektřina/den
- Power bar (vizuální indikátor využití kapacity)
- Seznam přiřazeného hardwaru s možností odebrat

### Modální okna

1. **Výběr prostoru** - Zobrazí dostupné prostory s parametry
2. **Pojmenování farmy** - Input pro název nové farmy
3. **Přejmenování** - Změna názvu existující farmy
4. **Smazání** - Potvrzení s upozorněním na vrácení HW
5. **Upgrade** - Výběr většího prostoru
6. **Přiřazení HW** - Výběr hardwaru a množství k přiřazení

## Game Engine integrace

### Nové funkce v gameEngine.js

#### calculateElectricityCostWithRate(powerWatts, costPerKwh)
Vypočítá náklady na elektřinu s vlastní cenou za kWh.

#### calculateRentPerTick(rentPerDay)
Vypočítá poměrnou část nájmu za jeden tick (pro zobrazení).

#### processFarms()
Zpracuje všechny aktivní farmy v tick cyklu:
1. Načte farmy s hardwarem a cenami
2. Vypočítá spotřebu a těžbu
3. Odečte náklady z balance (PLACEHOLDER - zatím deaktivováno)

#### getUserFarmStats(userId)
Vrací agregované statistiky všech farem uživatele.

## Výpočet nákladů

### Elektřina
```
cost_per_tick = (power_watts / 1000) * cost_per_kwh * (tick_interval_ms / 3600000)
```

### Denní náklady
```
daily_electricity = (power_watts / 1000) * 24 * cost_per_kwh
daily_total = daily_electricity + rent_per_day
```

## PLACEHOLDER položky

Následující funkce jsou připraveny ale zatím neimplementovány:

1. **Obrázky prostorů** - `image_url` v `farm_spaces` je NULL
2. **Ikony kategorií** - Používají se emoji místo obrázků
3. **Tick processing** - Funkce `processFarms()` je zakomentovaná
4. **Nájem** - Strhávání denního nájmu není implementováno
5. **Hashrate jednotky** - Různé jednotky se sčítají bez konverze

## Budoucí rozšíření

1. **Nové prostory:**
   - Kontejner (mobilní, střední kapacita)
   - Velká hala (enterprise)
   - Datové centrum (premium)
   - Solární farma (částečně zdarma elektřina)

2. **Vylepšení farem:**
   - Cooling level - ovlivňuje efektivitu
   - Security level - ochrana před útoky
   - Degradace hardwaru

3. **Ekonomika:**
   - Poplatky za založení farmy
   - Slevy na nájem při dlouhodobém pronájmu
   - Variabilní ceny elektřiny

## Migrace

Spuštění migrace:
```bash
psql -U $PGUSER -d $PGDATABASE -f migrations/003_add_farm_system.sql
```

Migrace vytvoří:
- Tabulku `farm_spaces` s přednastavenými prostory
- Tabulku `farms`
- Tabulku `farm_hardware`
- Helper views: `farm_overview`, `available_hardware`
- Aktualizuje constraint pro `transactions.type`

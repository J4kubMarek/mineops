# MINEOPS - Vizuální Design Systém

## Lidský popis

Představ si, že sedíš v temné místnosti před starým CRT monitorem někdy v 90. letech. Na obrazovce běží strategická hra - něco mezi Civilization a tabulkovým procesorem. Všechno je ostré, bez zbytečností, každý pixel má svůj účel.

**Atmosféra:** Noční směna v situační místnosti. Chladné světlo monitoru, tiché bzučení elektroniky. Žádné rozptylování, jen čistá informace.

**Inspirace:**
- Game Boy Color menu systémy
- MS-DOS aplikace a Norton Commander
- Staré vojenské terminály
- Hry jako Defcon, Papers Please, Suzerain
- Bloomberg Terminal estetika

**Pocit:** Profesionální, kompetentní, trochu tajemný. Jako bys měl přístup k něčemu, co běžní lidé nevidí. UI ti nepřekáží - je to nástroj, ne dekorace.

---

## Technický popis

### Barevná paleta

```css
/* Pozadí - tři úrovně hloubky */
--bg: #0a0e1a;           /* Nejhlubší - hlavní pozadí */
--panel: #0f1424;        /* Střední - panely */
--panel-light: #151b2e;  /* Zvýrazněné oblasti */

/* Bordery */
--panel-border: #1e2740;
--panel-border-light: #2a3654;

/* Text - tři úrovně prominence */
--text: #c8d0e0;         /* Primární */
--text-muted: #8892a8;   /* Sekundární */
--text-dim: #505868;     /* Pomocný/labely */

/* Akcentové barvy - ostré, saturované */
--accent: #00d4ff;       /* Cyan - hlavní akcent, interaktivní prvky */
--accent-warn: #ff9640;  /* Oranžová - finance, náklady, varování */
--accent-good: #00ff6a;  /* Zelená - úspěch, zisk, pozitivní */
--accent-danger: #ff3848;/* Červená - nebezpečí, ztráta, kritické */
```

### Typografie

**Font:** `"JetBrains Mono", "Fira Mono", ui-monospace, Consolas, monospace`

| Použití | Velikost | Váha | Styl |
|---------|----------|------|------|
| Labely | 8-9px | 400 | uppercase, letter-spacing: 1px |
| Běžný text | 10-11px | 400-500 | normální |
| Hodnoty | 11-12px | 600 | - |
| Velká čísla (HUD) | 28px | 700 | - |
| Nadpisy | 10-13px | 600-700 | uppercase |

### Geometrie

```css
/* Žádné zaoblení */
border-radius: 0;

/* Bordery vždy 1px, solid */
border: 1px solid var(--panel-border);

/* Těsný spacing */
--space-xs: 2px;
--space-sm: 4px;
--space-md: 8px;
--space-lg: 12px;
--space-xl: 16px;
```

### Komponenty

**Panely:**
- Ploché pozadí, 1px border
- Header s tmavším pozadím (`--bg`)
- Dashed separátory mezi sekcemi

**Tlačítka:**
```css
/* Základní stav */
background: transparent;
border: 1px solid var(--panel-border);
color: var(--text-muted);

/* Hover */
border-color: [accent-color];
color: [accent-color];

/* Active/Pressed */
background: [accent-color];
color: var(--bg);
```

**Ikony:**
- Outline styl (ne filled)
- `stroke-width: 1.5`
- Obalené v boxu s 1px borderem stejné barvy
- Velikost 14-18px

**Inputy:**
```css
background: var(--panel);
border: 1px solid var(--panel-border);
font-family: var(--font-mono);
text-align: center;

/* Focus */
border-color: var(--accent);
```

### Pravidla

1. **Žádné gradienty** - vše ploché
2. **Žádné stíny** - hloubka pouze přes barvy
3. **Žádné zaoblení** - ostré rohy všude
4. **Minimum barev** - 4 akcenty + škála šedé
5. **Konzistentní spacing** - násobky 4px
6. **Monospace všude** - bez výjimky
7. **Uppercase pro labely** - vždy s letter-spacing
8. **Interaktivní = border** - hover mění border, ne pozadí

### Animace

```css
/* Rychlé, lineární přechody */
transition: 100ms linear;

/* Stepped animace pro retro pocit */
animation: pulse 2s steps(4) infinite;
```

---

## Shrnutí na jednu větu

Tmavé, ostré, monospace UI bez gradientů a zaoblení, kde informace vystupuje přes cyan/oranžovou/zelenou na téměř černém pozadí.

---

## Příklady použití barev

- **Cyan (`--accent`)**: Odkazy, aktivní prvky, hashrate
- **Zelená (`--accent-good`)**: Balance, zisky, úspěšné operace
- **Oranžová (`--accent-warn`)**: Náklady, spotřeba energie, upozornění
- **Červená (`--accent-danger`)**: Ztráty, chyby, kritické stavy

---

## Reference implementace

Veškeré CSS najdeš v: `/public/css/style.css`

Příklady použití:
- `/views/dashboard.html`
- `/views/hardware.html`
- `/views/farm.html`

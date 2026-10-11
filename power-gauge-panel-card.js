/**
 * power-gauge-panel-card.js  (v13)
 * ---------------------------------------------------------------------
 * Due layout per ogni stanza (globale o per singola stanza):
 *   layout: quad    -> 4 cerchi (energia, potenza, tensione, corrente) a quadrato 2x2
 *   layout: single  -> UN cerchio grande con i 4 valori dentro (2x2).
 *                      Il cerchio si colora in base alla POTENZA (soglie in W).
 *
 * type: custom:power-gauge-panel
 * columns: 3
 * gap: 16
 * layout: single
 *
 * # --- dimensioni (px). Se omesse, tutto scala col cerchio ---
 * circle_size: 110     # diametro di ogni cerchio nel layout "quad"
 * single_size: 220     # diametro del cerchio nel layout "single"
 * value_size: 16       # numeri
 * unit_size: 9         # unità (W, V, A...)
 * label_size: 8        # testo delle etichette (POTENZA...)
 * icon_size: 10        # simboli accanto alle etichette
 * name_size: 13.5      # titolo della stanza
 * name_color: '#eef3f4'
 *
 * # --- spostamenti e distanze (px, anche negativi dove indicato) ---
 * value_offset: 0      # sposta numero+unità in su (-) o in giù (+)
 * label_offset: 0      # sposta etichette in su (-) o in giù (+)
 * inner_gap: 4         # single: distanza tra i 4 valori
 * inner_scale: 66      # single: % del cerchio occupata dai valori (20-95)
 * quad_gap: 10         # quad: distanza tra i 4 cerchi
 *
 * # --- colori ---
 * base_color: '#00E5FF'      # single: colore del cerchio se non ci sono soglie
 * inner_colors: circle       # single: "circle" = valori dello stesso colore del cerchio
 *                            #         (omesso = ogni valore col suo colore/soglie)
 * device_border: true        # bordo della stanza colorato come la potenza
 * show_icons: true
 * show_labels: true
 *
 * # soglie globali (valgono per tutte le stanze, sovrascrivibili per stanza)
 * # "max" = il colore vale fino a quel valore. Potenza in W (kW/MW vengono convertiti).
 * # Oltre l'ultima soglia resta l'ultimo colore. Senza "max" = infinito.
 * colors:
 *   power:
 *     - { max: 100,  color: '#00E5FF' }
 *     - { max: 500,  color: '#FFD700' }
 *     - { max: 1500, color: '#FF9100' }
 *     - { color: '#FF1744' }
 *
 * devices:
 *   - name: Cucina
 *     power_entity: sensor.cucina_potenza
 *     energy_entity: sensor.cucina_energia
 *     voltage_entity: sensor.cucina_tensione
 *     current_entity: sensor.cucina_corrente
 *     layout: single          # opzionale, sovrascrive il globale
 *     single_size: 260        # ogni opzione di dimensione/spostamento si può sovrascrivere
 *     colors: {}              # soglie solo per questa stanza (opzionale)
 */

(() => {
  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const OFF_COLOR = '#7a8a8f';

  const DEFAULT_COLORS = {
    power: '#00E5FF',
    energy: '#FFD180',
    voltage: '#B388FF',
    current: '#69F0AE',
  };

  const METRIC_LABELS = {
    energy: 'ENERGIA',
    power: 'POTENZA',
    voltage: 'TENSIONE',
    current: 'CORRENTE',
  };

  const METRIC_ICONS = {
    energy: 'mdi:lightning-bolt-outline',
    power: 'mdi:flash',
    voltage: 'mdi:sine-wave',
    current: 'mdi:current-ac',
  };

  const METRIC_ORDER = ['energy', 'power', 'voltage', 'current'];

  // ----------------------------------------------------------------------
  //  helper
  // ----------------------------------------------------------------------
  function isNum(v) {
    return v !== undefined && v !== null && v !== '' && isFinite(Number(v));
  }

  function isPos(v) {
    return isNum(v) && Number(v) > 0;
  }

  // valore della stanza se definito, altrimenti quello globale
  function pick(dev, cfg, key) {
    return dev && dev[key] !== undefined && dev[key] !== null && dev[key] !== '' ? dev[key] : cfg[key];
  }

  function fmtVal(raw) {
    if (raw === undefined || raw === null || isNaN(raw)) return '--';
    const n = Number(raw);
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(Math.abs(n) >= 100 ? 0 : 1).replace(/^-0(\.0+)?$/, '0');
  }

  function toWatts(raw, unit) {
    const u = (unit || '').trim();
    if (u === 'kW') return raw * 1000;
    if (u === 'MW') return raw * 1000000;
    if (u === 'mW') return raw / 1000;
    return raw;
  }

  // Converte un colore CSS (#rgb, #rrggbb, #rrggbbaa, rgb(), nome, var(--x)) in "r, g, b"
  const _colorCache = {};
  function toRgb(c, fallback = '136, 136, 136') {
    if (!c || typeof c !== 'string') return fallback;
    const s = c.trim();
    const cached = _colorCache[s];
    if (cached && (cached.stable || Date.now() - cached.t < 3000)) return cached.rgb;

    let out = null;
    let stable = true;
    let m = s.match(/^#([0-9a-f]{3,8})$/i);
    if (m && [3, 4, 6, 8].includes(m[1].length)) {
      let h = m[1];
      if (h.length <= 4) h = h.split('').map((ch) => ch + ch).join('');
      const n = parseInt(h.slice(0, 6), 16);
      out = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    } else if ((m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i))) {
      out = `${Math.round(m[1])}, ${Math.round(m[2])}, ${Math.round(m[3])}`;
    } else {
      // nomi colore e variabili del tema: li risolve il browser
      stable = !/var\(/.test(s);
      try {
        const probe = document.createElement('span');
        probe.style.color = s;
        if (probe.style.color) {
          probe.style.display = 'none';
          document.body.appendChild(probe);
          const cc = getComputedStyle(probe).color;
          document.body.removeChild(probe);
          const mm = cc.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
          if (mm) out = `${mm[1]}, ${mm[2]}, ${mm[3]}`;
        }
      } catch (e) { /* ignora */ }
    }
    if (!out) return fallback;
    _colorCache[s] = { rgb: out, stable, t: Date.now() };
    return out;
  }

  function thresholdsFor(dev, cfg, metric) {
    const d = dev.colors && dev.colors[metric];
    if (Array.isArray(d) && d.length) return d;
    const g = cfg.colors && cfg.colors[metric];
    return Array.isArray(g) && g.length ? g : null;
  }

  function colorForThresholds(thresholds, value, fallback) {
    if (!Array.isArray(thresholds) || !thresholds.length || value === null || isNaN(value)) return fallback;
    const list = thresholds
      .filter((t) => t && t.color)
      .map((t) => ({ max: isNum(t.max) ? Number(t.max) : Infinity, color: t.color }));
    if (!list.length) return fallback;
    list.sort((a, b) => (a.max < b.max ? -1 : a.max > b.max ? 1 : 0));
    for (const t of list) {
      if (value <= t.max) return t.color;
    }
    return list[list.length - 1].color;
  }

  function setText(el, txt) {
    if (el.textContent !== txt) el.textContent = txt;
  }

  // Variabili CSS di dimensione/spostamento. Senza valori espliciti tutto scala
  // con la larghezza reale del cerchio (cqw), quindi resta proporzionato anche
  // quando il cerchio si restringe su schermi piccoli.
  function sizeVars(layout, get) {
    const single = layout === 'single';
    const px = (n) => `${Math.round(n * 10) / 10}px`;
    const cs = single ? get('single_size') : get('circle_size');
    const c = isPos(cs) ? Number(cs) : single ? 220 : 110;
    const vs = isPos(get('value_size')) ? Number(get('value_size')) : 0;
    const us = isPos(get('unit_size')) ? Number(get('unit_size')) : 0;
    const ls = isPos(get('label_size')) ? Number(get('label_size')) : 0;
    const ic = isPos(get('icon_size')) ? Number(get('icon_size')) : 0;

    const vars = {
      '--pgp-circle': px(c),
      '--pgp-value': vs ? px(vs) : single ? 'max(9px, 12cqw)' : 'max(9px, 15cqw)',
      '--pgp-unit': us
        ? px(us)
        : vs ? px(Math.max(7, vs * 0.56)) : single ? 'max(7px, 5.6cqw)' : 'max(7px, 8.4cqw)',
      '--pgp-label': ls ? px(ls) : single ? 'max(6px, 5cqw)' : 'max(6px, 6.8cqw)',
      '--pgp-icon': ic ? px(ic) : single ? 'max(8px, 6cqw)' : 'max(8px, 9cqw)',
    };

    if (isNum(get('value_offset'))) vars['--pgp-value-dy'] = px(Number(get('value_offset')));
    if (isNum(get('label_offset'))) vars['--pgp-label-dy'] = px(Number(get('label_offset')));
    if (isNum(get('inner_gap')) && Number(get('inner_gap')) >= 0) vars['--pgp-inner-gap'] = px(Number(get('inner_gap')));
    if (isPos(get('inner_scale'))) vars['--pgp-inner'] = String(Math.max(20, Math.min(95, Number(get('inner_scale')))));
    if (isNum(get('quad_gap')) && Number(get('quad_gap')) >= 0) vars['--pgp-quad-gap'] = px(Number(get('quad_gap')));
    if (isPos(get('name_size'))) vars['--pgp-name-size'] = px(Number(get('name_size')));
    if (get('name_color')) vars['--pgp-name-color'] = String(get('name_color'));
    return vars;
  }

  function buildLabel(metric, showIcons, showLabels) {
    if (!showIcons && !showLabels) return null;
    const label = document.createElement('div');
    label.className = 'pgp-label';
    if (showIcons) {
      const icon = document.createElement('ha-icon');
      icon.setAttribute('icon', METRIC_ICONS[metric]);
      label.appendChild(icon);
    }
    if (showLabels) {
      const t = document.createElement('span');
      t.textContent = METRIC_LABELS[metric];
      label.appendChild(t);
    }
    return label;
  }

  function buildValueBox(unitText) {
    const box = document.createElement('div');
    box.className = 'pgp-vbox';
    const valueEl = document.createElement('div');
    valueEl.className = 'pgp-value';
    valueEl.textContent = '--';
    const unitEl = document.createElement('div');
    unitEl.className = 'pgp-unit';
    unitEl.textContent = unitText || '';
    box.appendChild(valueEl);
    box.appendChild(unitEl);
    return { box, valueEl, unitEl };
  }

  // ======================================================================
  //  CARD PRINCIPALE
  // ======================================================================
  class PowerGaugePanel extends HTMLElement {
    setConfig(config) {
      this._config = config && Array.isArray(config.devices) ? config : { ...(config || {}), devices: [] };
      this._columns = Math.max(1, parseInt(this._config.columns, 10) || 3);
      this._gap = isNum(this._config.gap) ? Number(this._config.gap) : 16;

      if (!this.content) this._build();
      else this._renderGrid();
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    getCardSize() {
      const devs = this._config.devices;
      if (!devs.length) return 2;
      let total = 0;
      for (let i = 0; i < devs.length; i += this._columns) {
        let h = 0;
        devs.slice(i, i + this._columns).forEach((d) => {
          const dev = d || {};
          const get = (k) => pick(dev, this._config, k);
          const single = get('layout') === 'single';
          const c = Number(single ? get('single_size') : get('circle_size')) || (single ? 220 : 110);
          h = Math.max(h, (single ? c : c * 2 + 10) + 60);
        });
        total += h + this._gap;
      }
      return Math.max(2, Math.round(total / 50) + 1);
    }

    getGridOptions() {
      return { columns: 'full' };
    }

    static getConfigElement() {
      return document.createElement('power-gauge-panel-editor');
    }

    static getStubConfig() {
      return {
        columns: 3,
        layout: 'quad',
        circle_size: 110,
        colors: {
          power: [
            { max: 100, color: '#00E5FF' },
            { max: 500, color: '#FFD700' },
            { color: '#FF1744' },
          ],
        },
        devices: [
          {
            name: 'Esempio',
            power_entity: '',
            energy_entity: '',
            voltage_entity: '',
            current_entity: '',
          },
        ],
      };
    }

    _build() {
      this.innerHTML = '';
      const root = document.createElement('div');
      root.className = 'pgp-root';

      const style = document.createElement('style');
      style.textContent = `
        .pgp-root {
          background: radial-gradient(circle at 15% 0%, #10151c 0%, #05070a 55%, #000 100%);
          border-radius: var(--ha-card-border-radius, 16px);
          padding: 16px;
          box-sizing: border-box;
          font-family: ${FONT};
        }
        .pgp-empty { color: #8ea2a8; text-align: center; padding: 20px; font-size: 13px; }
        .pgp-grid { display: grid; }
        .pgp-device {
          background: linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012));
          border: 1.5px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 12px 12px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 0;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .pgp-device-name {
          font-weight: 700;
          font-size: var(--pgp-name-size, 13.5px);
          letter-spacing: 0.2px;
          color: var(--pgp-name-color, #eef3f4);
          text-align: center;
          margin-bottom: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* ---- cerchio (comune ai due layout) ---- */
        .pgp-circle {
          --c-rgb: 255,255,255;
          position: relative;
          container-type: inline-size;
          width: 100%;
          max-width: var(--pgp-circle, 110px);
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 34% 28%, rgba(var(--c-rgb), 0.30), rgba(var(--c-rgb), 0.07) 55%, rgba(var(--c-rgb), 0.03) 100%);
          border: 1.5px solid rgba(var(--c-rgb), 0.55);
          box-shadow: 0 0 14px -2px rgba(var(--c-rgb), 0.55), inset 0 0 14px rgba(var(--c-rgb), 0.10);
          box-sizing: border-box;
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .pgp-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-size: var(--pgp-label, 7.5px);
          font-weight: 700;
          letter-spacing: 0.4px;
          line-height: 1.1;
          white-space: nowrap;
          color: rgba(var(--c-rgb), 0.95);
          transform: translateY(var(--pgp-label-dy, 0px));
        }
        .pgp-label ha-icon {
          --mdc-icon-size: var(--pgp-icon, 10px);
          color: rgba(var(--c-rgb), 0.95);
          display: flex;
        }
        .pgp-vbox {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 100%;
          transform: translateY(var(--pgp-value-dy, 0px));
        }
        .pgp-value {
          font-weight: 700;
          font-size: var(--pgp-value, 16px);
          color: rgb(var(--c-rgb));
          text-shadow: 0 0 6px rgba(var(--c-rgb), 0.45);
          line-height: 1;
          white-space: nowrap;
        }
        .pgp-unit {
          font-size: var(--pgp-unit, 9px);
          color: #9fb0b5;
          margin-top: 2px;
          line-height: 1;
          white-space: nowrap;
        }

        /* ---- layout quad ---- */
        .pgp-quad {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--pgp-quad-gap, 10px);
          justify-items: center;
          width: 100%;
        }
        .pgp-quad .pgp-label { position: absolute; top: 8.2cqw; max-width: 90%; }
        .pgp-quad .pgp-vbox { margin-top: 7cqw; }

        /* ---- layout single ---- */
        .pgp-big { border-width: 2px; max-width: var(--pgp-circle, 220px); }
        .pgp-inner {
          position: absolute;
          left: 50%;
          top: 50%;
          width: calc(var(--pgp-inner, 66) * 1cqw);
          height: calc(var(--pgp-inner, 66) * 1cqw);
          transform: translate(-50%, -50%);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-content: center;
          align-items: center;
          gap: var(--pgp-inner-gap, 3cqw);
        }
        .pgp-cell {
          --c-rgb: 255,255,255;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 0;
          gap: 1px;
        }
        .pgp-cell.odd { grid-column: 1 / -1; }
      `;
      root.appendChild(style);

      this._gridHolder = document.createElement('div');
      root.appendChild(this._gridHolder);
      this.appendChild(root);
      this.content = root;

      this._renderGrid();
    }

    _renderGrid() {
      if (!this._gridHolder) return;
      this._gridHolder.innerHTML = '';
      const cfg = this._config;

      if (!cfg.devices.length) {
        const empty = document.createElement('div');
        empty.className = 'pgp-empty';
        empty.textContent = 'Nessuna stanza configurata. Modifica la card per aggiungerne una.';
        this._gridHolder.appendChild(empty);
        this._refs = [];
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'pgp-grid';
      grid.style.gridTemplateColumns = `repeat(${this._columns}, minmax(0, 1fr))`;
      grid.style.gap = `${this._gap}px`;

      const showIcons = cfg.show_icons !== false;
      const showLabels = cfg.show_labels !== false;

      this._refs = cfg.devices.map((d) => {
        const dev = d || {};
        const get = (k) => pick(dev, cfg, k);
        const layout = get('layout') === 'single' ? 'single' : 'quad';

        const wrap = document.createElement('div');
        wrap.className = 'pgp-device';
        Object.entries(sizeVars(layout, get)).forEach(([k, v]) => wrap.style.setProperty(k, v));

        const nameEl = document.createElement('div');
        nameEl.className = 'pgp-device-name';
        nameEl.textContent = dev.name || 'Dispositivo';
        wrap.appendChild(nameEl);

        const metrics = {};
        let big = null;

        if (layout === 'quad') {
          const quad = document.createElement('div');
          quad.className = 'pgp-quad';
          METRIC_ORDER.forEach((metric) => {
            const unitText = dev[`${metric}_unit`] || '';
            const circle = document.createElement('div');
            circle.className = 'pgp-circle';
            circle.style.setProperty('--c-rgb', toRgb(DEFAULT_COLORS[metric]));
            const label = buildLabel(metric, showIcons, showLabels);
            if (label) circle.appendChild(label);
            const vb = buildValueBox(unitText);
            circle.appendChild(vb.box);
            quad.appendChild(circle);
            metrics[metric] = {
              entity: dev[`${metric}_entity`], unitText, valueEl: vb.valueEl, unitEl: vb.unitEl, colorEl: circle,
            };
          });
          wrap.appendChild(quad);
        } else {
          big = document.createElement('div');
          big.className = 'pgp-circle pgp-big';
          big.style.setProperty('--c-rgb', toRgb(get('base_color') || DEFAULT_COLORS.power));
          const inner = document.createElement('div');
          inner.className = 'pgp-inner';

          let shown = METRIC_ORDER.filter((m) => dev[`${m}_entity`]);
          if (!shown.length) shown = METRIC_ORDER.slice();

          shown.forEach((metric, i) => {
            const unitText = dev[`${metric}_unit`] || '';
            const cell = document.createElement('div');
            cell.className = 'pgp-cell';
            if (shown.length % 2 === 1 && i === shown.length - 1) cell.classList.add('odd');
            cell.style.setProperty('--c-rgb', toRgb(DEFAULT_COLORS[metric]));
            const label = buildLabel(metric, showIcons, showLabels);
            if (label) cell.appendChild(label);
            const vb = buildValueBox(unitText);
            cell.appendChild(vb.box);
            inner.appendChild(cell);
            metrics[metric] = {
              entity: dev[`${metric}_entity`], unitText, valueEl: vb.valueEl, unitEl: vb.unitEl, colorEl: cell,
            };
          });
          big.appendChild(inner);
          wrap.appendChild(big);
        }

        grid.appendChild(wrap);
        return { wrap, dev, layout, metrics, big, get };
      });

      this._gridHolder.appendChild(grid);
      this._update();
    }

    _update() {
      if (!this._hass || !this._refs) return;
      const states = this._hass.states;
      const cfg = this._config;

      this._refs.forEach(({ wrap, dev, layout, metrics, big, get }) => {
        const baseColor = get('base_color') || DEFAULT_COLORS.power;
        const rgbs = {};
        let powerColor = null;

        METRIC_ORDER.forEach((metric) => {
          const c = metrics[metric];
          if (!c) return;
          if (!c.entity) {
            setText(c.valueEl, '—');
            return;
          }
          const st = states[c.entity];
          const raw = st ? parseFloat(st.state) : NaN;
          setText(c.valueEl, fmtVal(raw));

          const attrUnit = st && st.attributes && st.attributes.unit_of_measurement;
          if (!c.unitText && attrUnit) setText(c.unitEl, attrUnit);

          // la potenza si confronta sempre in W (anche se il sensore è in kW)
          const realUnit = attrUnit || c.unitText || '';
          const value = metric === 'power' ? toWatts(raw, realUnit) : raw;
          const fallback = metric === 'power' && layout === 'single' ? baseColor : DEFAULT_COLORS[metric];
          const color = isNaN(raw)
            ? OFF_COLOR
            : colorForThresholds(thresholdsFor(dev, cfg, metric), value, fallback);
          rgbs[metric] = toRgb(color);
          if (metric === 'power') powerColor = color;
        });

        const circleColor = powerColor !== null ? powerColor : baseColor;
        const circleRgb = toRgb(circleColor);

        if (layout === 'quad') {
          METRIC_ORDER.forEach((m) => {
            const c = metrics[m];
            if (c && rgbs[m]) c.colorEl.style.setProperty('--c-rgb', rgbs[m]);
          });
        } else {
          big.style.setProperty('--c-rgb', circleRgb);
          const sameAsCircle = get('inner_colors') === 'circle';
          METRIC_ORDER.forEach((m) => {
            const c = metrics[m];
            if (!c) return;
            c.colorEl.style.setProperty('--c-rgb', sameAsCircle ? circleRgb : rgbs[m] || toRgb(DEFAULT_COLORS[m]));
          });
        }

        // bordo della stanza: colore della potenza (single: anche col colore base)
        const borderColor = layout === 'single' ? circleColor : powerColor;
        if (cfg.device_border !== false && borderColor) {
          wrap.style.borderColor = `rgb(${toRgb(borderColor)})`;
          wrap.style.boxShadow = `0 0 10px -2px rgba(${toRgb(borderColor)}, 0.3)`;
        } else {
          wrap.style.borderColor = '';
          wrap.style.boxShadow = '';
        }
      });
    }
  }

  if (!customElements.get('power-gauge-panel')) {
    customElements.define('power-gauge-panel', PowerGaugePanel);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'power-gauge-panel')) {
    window.customCards.push({
      type: 'power-gauge-panel',
      name: 'Power Gauge Panel',
      description: '4 cerchi oppure un cerchio unico con i 4 valori dentro, colorato dalla potenza (W). Soglie, dimensioni e spostamenti regolabili.',
    });
  }

  // ======================================================================
  //  EDITOR VISUALE
  // ======================================================================
  const METRIC_META = [
    { key: 'energy', label: 'Energia', defMax: 10, unit: '' },
    { key: 'power', label: 'Potenza', defMax: 100, unit: 'W' },
    { key: 'voltage', label: 'Tensione', defMax: 250, unit: '' },
    { key: 'current', label: 'Corrente', defMax: 5, unit: '' },
  ];

  const SIZE_FIELDS = [
    ['circle_size', 'Cerchio px (4 cerchi)', '110', {}],
    ['single_size', 'Cerchio px (singolo)', '220', {}],
    ['value_size', 'Valori px', 'auto', {}],
    ['unit_size', 'Unità px', 'auto', {}],
    ['label_size', 'Etichette px', 'auto', {}],
    ['icon_size', 'Simboli px', 'auto', {}],
    ['name_size', 'Titolo px', '13.5', {}],
  ];

  const OFFSET_FIELDS = [
    ['value_offset', 'Sposta valori px (±)', '0', { zero: true, neg: true }],
    ['label_offset', 'Sposta etichette px (±)', '0', { zero: true, neg: true }],
    ['inner_gap', 'Distanza valori px (singolo)', '4', { zero: true }],
    ['inner_scale', 'Area valori % (singolo)', '66', {}],
    ['quad_gap', 'Distanza cerchi px (4 cerchi)', '10', { zero: true }],
  ];

  class PowerGaugePanelEditor extends HTMLElement {
    constructor() {
      super();
      this._open = new Set(['g:style']);
    }

    setConfig(config) {
      const incoming = JSON.stringify(config || {});
      // eco della nostra stessa modifica: niente rebuild (così non si perde il focus)
      if (this.shadowRoot && incoming === this._lastJson) return;
      this._config = JSON.parse(incoming);
      if (!Array.isArray(this._config.devices)) this._config.devices = [];
      this._lastJson = incoming;
      if (!this.shadowRoot) this._render();
      else this._rebuildAll();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._entityListBuilt && hass) {
        this._buildEntityDatalist();
        this._entityListBuilt = true;
      }
    }

    _clean(cfg) {
      const out = JSON.parse(JSON.stringify(cfg));
      const prune = (o) => {
        if (!o || !o.colors) return;
        Object.keys(o.colors).forEach((k) => {
          if (!Array.isArray(o.colors[k]) || !o.colors[k].length) delete o.colors[k];
        });
        if (!Object.keys(o.colors).length) delete o.colors;
      };
      prune(out);
      (out.devices || []).forEach(prune);
      return out;
    }

    _emit() {
      const out = this._clean(this._config);
      this._lastJson = JSON.stringify(out);
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: out }, bubbles: true, composed: true,
      }));
    }

    _buildEntityDatalist() {
      if (!this.shadowRoot) return;
      const holder = this.shadowRoot.querySelector('.pgpe');
      if (!holder) return;
      const old = this.shadowRoot.getElementById('pgp-entity-list');
      if (old) old.remove();
      const dl = document.createElement('datalist');
      dl.id = 'pgp-entity-list';
      Object.keys((this._hass && this._hass.states) || {})
        .filter((id) => id.startsWith('sensor.'))
        .sort()
        .forEach((id) => {
          const opt = document.createElement('option');
          opt.value = id;
          const a = this._hass.states[id].attributes;
          opt.label = a && a.friendly_name ? `${a.friendly_name} (${id})` : id;
          dl.appendChild(opt);
        });
      holder.appendChild(dl);
    }

    // ---------- campi ----------
    _text(target, key, labelText, placeholder, opts = {}) {
      const f = document.createElement('div');
      f.className = 'pgpe-field';
      if (opts.grow) f.style.flex = '1 1 150px';
      const l = document.createElement('label');
      l.textContent = labelText;
      const i = document.createElement('input');
      i.type = 'text';
      i.placeholder = placeholder || '';
      if (opts.list) i.setAttribute('list', opts.list);
      if (opts.width) i.style.width = `${opts.width}px`;
      i.value = target[key] !== undefined ? target[key] : '';
      i.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (v === '') delete target[key];
        else target[key] = v;
      });
      i.addEventListener('change', () => this._emit());
      f.appendChild(l);
      f.appendChild(i);
      return f;
    }

    // vuoto = rimuove la chiave (usa globale/auto). opts: zero (ammette 0), neg (ammette negativi)
    _num(target, key, labelText, placeholder, opts = {}) {
      const f = document.createElement('div');
      f.className = 'pgpe-field';
      const l = document.createElement('label');
      l.textContent = labelText;
      const i = document.createElement('input');
      i.type = 'number';
      i.placeholder = placeholder;
      i.style.width = `${opts.width || 78}px`;
      i.value = target[key] !== undefined ? target[key] : '';
      i.addEventListener('input', (e) => {
        const n = parseFloat(e.target.value);
        if (isNaN(n) || (!opts.neg && n < 0) || (!opts.zero && n === 0)) delete target[key];
        else target[key] = n;
      });
      i.addEventListener('change', () => this._emit());
      f.appendChild(l);
      f.appendChild(i);
      return f;
    }

    _color(target, key, labelText, def) {
      const f = document.createElement('div');
      f.className = 'pgpe-field';
      const l = document.createElement('label');
      l.textContent = labelText;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:4px;align-items:center;';
      const i = document.createElement('input');
      i.type = 'color';
      i.style.cssText = 'width:34px;height:28px;padding:0;border:none;background:none;cursor:pointer;';
      const cur = target[key];
      i.value = cur && /^#[0-9a-f]{6}$/i.test(cur) ? cur : def;
      i.addEventListener('input', (e) => { target[key] = e.target.value; });
      i.addEventListener('change', () => this._emit());
      const rst = document.createElement('button');
      rst.textContent = '↺';
      rst.title = 'Ripristina predefinito';
      rst.addEventListener('click', () => {
        delete target[key];
        i.value = def;
        this._emit();
      });
      row.appendChild(i);
      row.appendChild(rst);
      f.appendChild(l);
      f.appendChild(row);
      return f;
    }

    // options: [[valore, etichetta], ...]; valore '' = rimuove la chiave
    _select(target, key, labelText, options) {
      const f = document.createElement('div');
      f.className = 'pgpe-field';
      const l = document.createElement('label');
      l.textContent = labelText;
      const s = document.createElement('select');
      options.forEach(([v, t]) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = t;
        s.appendChild(o);
      });
      s.value = target[key] !== undefined ? target[key] : '';
      s.addEventListener('change', (e) => {
        if (e.target.value === '') delete target[key];
        else target[key] = e.target.value;
        this._emit();
      });
      f.appendChild(l);
      f.appendChild(s);
      return f;
    }

    // casella con default "attivo": se spenta salva false
    _check(target, key, labelText) {
      const lab = document.createElement('label');
      lab.className = 'chk';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = target[key] !== false;
      cb.addEventListener('change', () => {
        if (cb.checked) delete target[key];
        else target[key] = false;
        this._emit();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(labelText));
      return lab;
    }

    _btn(text, cls, fn) {
      const b = document.createElement('button');
      if (cls) b.className = cls;
      b.textContent = text;
      b.addEventListener('click', fn);
      return b;
    }

    _row() {
      const r = document.createElement('div');
      r.className = 'pgpe-row';
      return r;
    }

    _subtitle(text) {
      const t = document.createElement('div');
      t.className = 'pgpe-subtitle';
      t.textContent = text;
      return t;
    }

    // sezione richiudibile che ricorda se era aperta anche dopo un rebuild
    _details(key, title, bodyEl) {
      const d = document.createElement('details');
      d.className = 'pgpe-details';
      d.open = this._open.has(key);
      d.addEventListener('toggle', () => {
        if (d.open) this._open.add(key);
        else this._open.delete(key);
      });
      const s = document.createElement('summary');
      s.textContent = title;
      d.appendChild(s);
      d.appendChild(bodyEl);
      return d;
    }

    _swap(arr, idx, dir) {
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      this._rebuildDevicesList();
      this._emit();
    }

    // ---------- soglie colore ----------
    _colorsBox(owner, titleText, hintText) {
      const box = document.createElement('div');
      box.className = 'pgpe-colors';

      const mx = (t) => (isNum(t.max) ? Number(t.max) : Infinity);
      const sortTh = (arr) => {
        const before = arr.slice();
        arr.sort((a, b) => (mx(a) < mx(b) ? -1 : mx(a) > mx(b) ? 1 : 0));
        return before.some((t, i) => t !== arr[i]);
      };

      METRIC_META.forEach((m) => {
        const list = owner.colors && Array.isArray(owner.colors[m.key]) ? owner.colors[m.key] : [];
        const mb = document.createElement('div');
        mb.className = 'pgpe-metric';

        const head = document.createElement('div');
        head.className = 'pgpe-metric-head';
        const hl = document.createElement('span');
        hl.textContent = m.unit ? `${m.label} (${m.unit})` : m.label;
        head.appendChild(hl);
        head.appendChild(this._btn('+ soglia', 'addsm', () => {
          if (!owner.colors) owner.colors = {};
          if (!Array.isArray(owner.colors[m.key])) owner.colors[m.key] = [];
          const arr = owner.colors[m.key];
          const finite = arr.map((t) => mx(t)).filter((v) => isFinite(v));
          const next = finite.length ? Math.max(...finite) * 2 || m.defMax : m.defMax;
          arr.push({ max: next, color: DEFAULT_COLORS[m.key] });
          sortTh(arr);
          this._rebuildAll();
          this._emit();
        }));
        mb.appendChild(head);

        list.forEach((th, ti) => {
          const row = document.createElement('div');
          row.className = 'pgpe-th-row';
          const sp = document.createElement('span');
          sp.textContent = 'fino a';
          const maxIn = document.createElement('input');
          maxIn.type = 'number';
          maxIn.placeholder = '∞';
          maxIn.value = th.max !== undefined ? th.max : '';
          maxIn.addEventListener('input', (e) => {
            const n = parseFloat(e.target.value);
            if (isNaN(n)) delete th.max;
            else th.max = n;
          });
          maxIn.addEventListener('change', () => {
            const moved = sortTh(owner.colors[m.key]);
            this._emit();
            if (moved) this._rebuildAll();
          });
          const colIn = document.createElement('input');
          colIn.type = 'color';
          colIn.value = th.color && /^#[0-9a-f]{6}$/i.test(th.color) ? th.color : '#ffffff';
          colIn.addEventListener('input', (e) => { th.color = e.target.value; });
          colIn.addEventListener('change', () => this._emit());
          const del = this._btn('✕', 'del', () => {
            owner.colors[m.key].splice(ti, 1);
            this._rebuildAll();
            this._emit();
          });
          row.appendChild(sp);
          row.appendChild(maxIn);
          row.appendChild(colIn);
          row.appendChild(del);
          mb.appendChild(row);
        });
        box.appendChild(mb);
      });

      const hint = document.createElement('div');
      hint.className = 'pgpe-hint';
      hint.textContent = hintText;
      box.appendChild(hint);

      return this._details(`${titleText}`, titleText, box);
    }

    // ---------- blocchi di opzioni (globali o per stanza) ----------
    _styleBody(target, isDev) {
      const body = document.createElement('div');
      const ph = (p) => (isDev ? 'globale' : p);

      const r0 = this._row();
      if (!isDev) {
        r0.appendChild(this._select(target, 'layout', 'Layout', [
          ['', '4 cerchi (quadrato)'], ['single', 'Cerchio unico, 4 valori dentro'],
        ]));
      }
      r0.appendChild(this._select(target, 'inner_colors', 'Colore valori (cerchio unico)', isDev
        ? [['', 'Come globale'], ['metric', 'Ognuno il suo'], ['circle', 'Come il cerchio (potenza)']]
        : [['', 'Ognuno il suo'], ['circle', 'Come il cerchio (potenza)']]));
      body.appendChild(r0);

      body.appendChild(this._subtitle('Dimensioni'));
      const r1 = this._row();
      SIZE_FIELDS.forEach(([k, l, p, o]) => r1.appendChild(this._num(target, k, l, ph(p), o)));
      body.appendChild(r1);

      body.appendChild(this._subtitle('Spostamenti e distanze'));
      const r2 = this._row();
      OFFSET_FIELDS.forEach(([k, l, p, o]) => r2.appendChild(this._num(target, k, l, ph(p), o)));
      body.appendChild(r2);

      body.appendChild(this._subtitle('Colori'));
      const r3 = this._row();
      r3.appendChild(this._color(target, 'name_color', 'Colore titolo', '#eef3f4'));
      r3.appendChild(this._color(target, 'base_color', 'Colore base (senza soglie)', '#00E5FF'));
      body.appendChild(r3);

      if (!isDev) {
        const r4 = this._row();
        r4.appendChild(this._check(target, 'show_icons', 'Mostra simboli'));
        r4.appendChild(this._check(target, 'show_labels', 'Mostra testo etichette'));
        r4.appendChild(this._check(target, 'device_border', 'Bordo stanza colorato'));
        body.appendChild(r4);
      }
      return body;
    }

    // ---------- struttura ----------
    _render() {
      const root = document.createElement('div');
      root.className = 'pgpe';
      root.innerHTML = `
        <style>
          .pgpe { font-family: ${FONT}; color: var(--primary-text-color, #eee); padding: 4px; }
          .pgpe-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; align-items: flex-end; }
          .pgpe-field label { display: block; font-size: 10.5px; opacity: .65; margin-bottom: 3px; }
          .pgpe input[type=number], .pgpe input[type=text], .pgpe select {
            padding: 6px 8px; border-radius: 6px; border: 1px solid var(--divider-color, #444);
            background: var(--card-background-color, #1c1c1c); color: inherit; font-size: 12px; box-sizing: border-box;
          }
          .pgpe input[type=text] { width: 100%; }
          .pgpe-title { font-size: 12px; font-weight: 700; margin: 14px 0 6px; opacity: .85; }
          .pgpe-subtitle { font-size: 11px; font-weight: 600; opacity: .7; margin: 8px 0 6px; }
          .pgpe-device { border: 1px solid var(--divider-color, #3a3a3a); border-radius: 10px; padding: 12px; margin-bottom: 14px; }
          .pgpe-head { display: flex; gap: 6px; align-items: flex-end; margin-bottom: 10px; flex-wrap: wrap; }
          .pgpe-entities { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-bottom: 10px; }
          .pgpe-details { border-top: 1px dashed var(--divider-color, #444); padding-top: 8px; margin-top: 8px; }
          .pgpe-details > summary { cursor: pointer; font-size: 11.5px; font-weight: 600; margin-bottom: 8px; }
          .pgpe-metric { margin-bottom: 8px; }
          .pgpe-metric-head { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 600; margin-bottom: 4px; }
          .pgpe-th-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
          .pgpe-th-row input[type=number] { width: 90px; }
          .pgpe-th-row input[type=color] { width: 30px; height: 26px; border: none; background: none; padding: 0; cursor: pointer; }
          .pgpe-th-row span { font-size: 11px; opacity: .6; }
          .pgpe-hint { font-size: 11px; opacity: .55; margin: 4px 0 6px; }
          .pgpe button { cursor: pointer; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600;
            background: rgba(255,255,255,.08); color: inherit; }
          .pgpe .del { background: rgba(255,90,90,.15); color: #ff8a8a; }
          .pgpe .add { background: rgba(80,180,255,.15); color: #6cc8ff; width: 100%; padding: 9px; }
          .pgpe .addsm { background: rgba(120,220,150,.15); color: #8ee6a8; font-size: 11px; padding: 4px 9px; }
          .pgpe label.chk { display: flex; align-items: center; gap: 4px; font-size: 11.5px; opacity: .9; padding-bottom: 6px; }
        </style>
        <div class="pgpe-row" id="pgpe-top"></div>
        <div id="pgpe-global"></div>
        <div class="pgpe-title">Stanze / dispositivi</div>
        <div id="pgpe-devices"></div>
        <button class="add" id="pgpe-add-device">+ Aggiungi stanza / dispositivo</button>
      `;
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(root);

      this.shadowRoot.getElementById('pgpe-add-device').addEventListener('click', () => {
        this._config.devices.push({ name: `Stanza ${this._config.devices.length + 1}` });
        this._rebuildDevicesList();
        this._emit();
      });

      this._rebuildAll();
      if (this._hass) this._buildEntityDatalist();
    }

    _rebuildAll() {
      this._buildGlobal();
      this._rebuildDevicesList();
    }

    _buildGlobal() {
      const top = this.shadowRoot.getElementById('pgpe-top');
      top.innerHTML = '';
      top.appendChild(this._num(this._config, 'columns', 'Stanze per riga', '3', { width: 80 }));
      top.appendChild(this._num(this._config, 'gap', 'Spazio tra stanze', '16', { width: 80, zero: true }));

      const g = this.shadowRoot.getElementById('pgpe-global');
      g.innerHTML = '';
      g.appendChild(this._details('g:style', 'Layout, dimensioni e spostamenti (globali)', this._styleBody(this._config, false)));
      g.appendChild(this._colorsBox(
        this._config,
        'Soglie colore globali (per tutte le stanze)',
        'Il colore vale fino al valore indicato (dal più basso al più alto). Potenza in W: i sensori in kW vengono convertiti. Oltre l\'ultima soglia resta l\'ultimo colore; senza valore = infinito. Nel cerchio unico il colore del cerchio segue la potenza.'
      ));
    }

    _rebuildDevicesList() {
      const holder = this.shadowRoot.getElementById('pgpe-devices');
      if (!holder) return;
      holder.innerHTML = '';
      this._config.devices.forEach((dev, i) => holder.appendChild(this._deviceEditor(dev, i)));
    }

    _deviceEditor(dev, idx) {
      const box = document.createElement('div');
      box.className = 'pgpe-device';

      const head = document.createElement('div');
      head.className = 'pgpe-head';
      head.appendChild(this._text(dev, 'name', 'Nome stanza / dispositivo', 'Nome', { grow: true }));
      head.appendChild(this._select(dev, 'layout', 'Layout', [
        ['', 'Come globale'], ['quad', '4 cerchi'], ['single', 'Cerchio unico'],
      ]));
      head.appendChild(this._btn('▲', '', () => this._swap(this._config.devices, idx, -1)));
      head.appendChild(this._btn('▼', '', () => this._swap(this._config.devices, idx, 1)));
      head.appendChild(this._btn('🗑', 'del', () => {
        this._config.devices.splice(idx, 1);
        this._rebuildDevicesList();
        this._emit();
      }));
      box.appendChild(head);

      const ents = document.createElement('div');
      ents.className = 'pgpe-entities';
      METRIC_META.forEach((m) => {
        ents.appendChild(this._text(dev, `${m.key}_entity`, m.label, 'sensor. ...', { list: 'pgp-entity-list' }));
      });
      box.appendChild(ents);

      box.appendChild(this._details(`${idx}:style`, 'Dimensioni, spostamenti e colori (questa stanza)', this._styleBody(dev, true)));
      box.appendChild(this._colorsBox(
        dev,
        `Soglie colore (questa stanza) #${idx + 1}`,
        'Se vuote vengono usate le soglie globali. Stesse regole: "fino a" dal più basso al più alto, potenza in W.'
      ));
      return box;
    }
  }

  if (!customElements.get('power-gauge-panel-editor')) {
    customElements.define('power-gauge-panel-editor', PowerGaugePanelEditor);
  }
})();

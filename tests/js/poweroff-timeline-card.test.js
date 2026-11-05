import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const componentPath = resolve(__dirname, '../../custom_components/poltava_poweroff/www/poweroff-timeline-card.js');
const componentCode = readFileSync(componentPath, 'utf-8');

// The card font is embedded into the test page (data: URL), the same font the card loads in HA,
// so the snapshots are identical on macOS, Linux and CI.
const fontsDir = resolve(__dirname, '../../custom_components/poltava_poweroff/www/fonts');
const fontFace = (file) => `@font-face {
  font-family: "PoweroffInter";
  font-weight: 100 900;
  src: url(data:font/woff2;base64,${readFileSync(resolve(fontsDir, file)).toString('base64')}) format('woff2');
}`;
const CARD_FONT_CSS = [fontFace('inter-latin-wght-normal.woff2'), fontFace('inter-cyrillic-wght-normal.woff2')].join('\n');

// Helper function to normalize SVG for snapshot testing
function normalizeSvgForSnapshot(svgHtml) {
  let normalized = svgHtml;

  // Remove dynamic dates (replace with placeholder)
  normalized = normalized.replace(/\d{2}\.\d{2}/g, 'DD.MM');

  // Remove dynamic times (replace with placeholder)
  normalized = normalized.replace(/\d{2}:\d{2}/g, 'HH:MM');

  // Normalize opacity values (round to 2 decimals)
  normalized = normalized.replace(/opacity:([\d.]+)/g, (match, value) => {
    const num = parseFloat(value);
    return `opacity:${num.toFixed(2)}`;
  });

  // Remove any dynamic IDs or timestamps
  normalized = normalized.replace(/id="[^"]*"/g, 'id="normalized"');

  // Normalize path data (keep structure but normalize precision)
  normalized = normalized.replace(/d="([^"]*)"/g, (match, pathData) => {
    // Round numbers in path data to 2 decimal places
    const normalizedPath = pathData.replace(/(\d+\.\d{3,})/g, (m) => {
      return parseFloat(m).toFixed(2);
    });
    return `d="${normalizedPath}"`;
  });

  return normalized;
}

class HtmlToPngRenderer {
  constructor() {
    this.browser = undefined;
    this.page = undefined;
  }

  async init() {
    this.browser = await puppeteer.launch({
      ...(process.env.CI ? { args: ['--no-sandbox'] } : {}),
      headless: true,
      defaultViewport: {
        width: 800,
        height: 1000,
        deviceScaleFactor: 2, // Higher resolution for better quality
      },
    });
    this.page = await this.browser.newPage();
  }

  async screenshot(htmlContent) {
    if (!this.page) {
      throw new Error('renderer is not initialized');
    }

    // A page without external resources: 'load' is enough (networkidle0 hung on repeated setContent)
    await this.page.setContent(htmlContent, { waitUntil: 'load' });
    await this.page.evaluate(() => document.fonts && document.fonts.ready);

    return this.page.screenshot({
      type: 'png',
      fullPage: true
    });
  }

  async deinit() {
    await this.browser?.close();
  }
}

const render = new HtmlToPngRenderer();

describe('PowerOffTimelineCard', () => {
  let dom;
  let card;
  let mockHass;

  beforeAll(async () => {
    // Create DOM once for all tests
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      runScripts: 'dangerously',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.customElements = dom.window.customElements;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;

    // Mock Home Assistant elements
    class MockHaCard extends dom.window.HTMLElement {}
    class MockHaIcon extends dom.window.HTMLElement {}

    if (!dom.window.customElements.get('ha-card')) {
      dom.window.customElements.define('ha-card', MockHaCard);
    }
    if (!dom.window.customElements.get('ha-icon')) {
      dom.window.customElements.define('ha-icon', MockHaIcon);
    }

    // Execute component code
    const script = dom.window.document.createElement('script');
    script.textContent = componentCode;
    dom.window.document.body.appendChild(script);
  });

  afterAll(async () => {
    await render.deinit();
  });

  beforeEach(async () => {
    // Wait for component to be defined if not already
    if (!dom.window.customElements.get('poweroff-timeline-card')) {
      await new Promise((resolve) => {
        dom.window.customElements.whenDefined('poweroff-timeline-card').then(resolve);
      });
    }

    // Create fresh card instance for each test
    card = dom.window.document.createElement('poweroff-timeline-card');
    dom.window.document.body.appendChild(card);

    // Mock Home Assistant state
    mockHass = {
      states: {
        'sensor.power_state': {
          entity_id: 'sensor.power_state',
          state: 'on',
          attributes: {
            poweroff_periods_today: [
              { start: 6.5, end: 9.0, today: true },
              { start: 12.5, end: 15.0, today: true },
              { start: 18.5, end: 20.0, today: true },
            ],
            poweroff_periods_tomorrow: [
              { start: 0.0, end: 2.0, today: false },
              { start: 5.5, end: 10.0, today: false },
            ],
            next_off: new Date(Date.now() + 3600000).toISOString(),
            next_on: new Date(Date.now() + 7200000).toISOString(),
            queue: '1.1',
            group: '1.1',
          },
        },
      },
    };
  });

  describe('Component Initialization', () => {
    it('should throw error if entity is not defined', () => {
      expect(() => {
        card.setConfig({});
      }).toThrow('Please define an entity');
    });

    it('should accept valid config with entity', () => {
      expect(() => {
        card.setConfig({ entity: 'sensor.power_state' });
      }).not.toThrow();
      expect(card.config.entity).toBe('sensor.power_state');
      expect(card.selectedTab).toBe('today');
    });
  });

  describe('UI Rendering', () => {
    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = mockHass;
    });

    it('should render card structure', () => {
      expect(card.card).toBeDefined();
      expect(card.headerContainer).toBeDefined();
      expect(card.content).toBeDefined();
    });

    it('should render header with title', () => {
      // After today's last outage the card switches to tomorrow by itself; pin today here
      card._userPickedTab = true;
      card.selectedTab = 'today';
      card.updateTimeline();
      expect(card.headerText).toBeDefined();
      expect(card.headerText.textContent).toBe('Сьогодні');
      expect(card.headerText.title).toBe('Відключення сьогодні');
    });

    it('should render day switcher buttons', () => {
      expect(card.todayButton).toBeDefined();
      expect(card.tomorrowButton).toBeDefined();
      expect(card.todayButton.getAttribute('data-tab')).toBe('today');
      expect(card.tomorrowButton.getAttribute('data-tab')).toBe('tomorrow');
    });

    it('should render spiral chart SVG', () => {
      const svg = card.content.querySelector('svg.spiral-chart');
      expect(svg).toBeDefined();
      expect(svg.getAttribute('viewBox')).toBe('0 0 470 470');
    });

    it('should render legend', () => {
      const legend = card.content.querySelectorAll('.legend-item');
      expect(legend.length).toBeGreaterThan(0);

      const legendTexts = Array.from(legend).map(item => item.textContent);
      expect(legendTexts.some(text => text.includes('Відключення'))).toBe(true);
      expect(legendTexts.some(text => text.includes('Світло є'))).toBe(true);
    });

    it('should render next outage as one compact line', () => {
      const line = card.content.querySelector('.next-line');
      expect(line).not.toBeNull();
      // next_off = +1 h, next_on = +2 h -> "Наступне відключення: HH:MM – HH:MM"
      expect(line.textContent).toMatch(/Наступне відключення: (завтра )?\d{2}:\d{2} – (завтра )?\d{2}:\d{2}/);
      expect(card.content.textContent).not.toContain('Наступне увімкнення');
    });

    it('says when power returns if it is off now', () => {
      const attrs = mockHass.states['sensor.power_state'].attributes;
      attrs.next_on = new Date(Date.now() + 1800000).toISOString();
      attrs.next_off = new Date(Date.now() + 7200000).toISOString();
      card.hass = { states: { 'sensor.power_state': { ...mockHass.states['sensor.power_state'], attributes: { ...attrs } } } };
      expect(card.content.querySelector('.next-line').textContent).toMatch(/Світло з'явиться о (завтра )?\d{2}:\d{2}/);
    });

    it('says there are no upcoming outages', () => {
      const attrs = { ...mockHass.states['sensor.power_state'].attributes, next_on: null, next_off: null };
      card.hass = { states: { 'sensor.power_state': { ...mockHass.states['sensor.power_state'], attributes: attrs } } };
      expect(card.content.querySelector('.next-line').textContent).toBe('Найближчих відключень немає');
    });
  });

  describe('Spiral Pattern Building', () => {
    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
    });

    it('should build correct pattern for empty periods', () => {
      const pattern = card.buildPattern([]);
      expect(pattern).toBe('1'.repeat(48)); // All slots should be '1' (power on)
    });

    it('should build pattern for single period', () => {
      const periods = [{ start: 6.0, end: 9.0, today: true }];
      const pattern = card.buildPattern(periods);

      // 6:00 = slot 12, 9:00 = slot 18
      // Slots 12-17 should be '0' (power off)
      expect(pattern.substring(12, 18)).toBe('000000');
    });

    it('should build pattern for multiple periods', () => {
      const periods = [
        { start: 6.5, end: 9.0, today: true },
        { start: 12.5, end: 15.0, today: true },
      ];
      const pattern = card.buildPattern(periods);

      // 6.5 = slot 13, 9.0 = slot 18
      expect(pattern.substring(13, 18)).toBe('00000');

      // 12.5 = slot 25, 15.0 = slot 30
      expect(pattern.substring(25, 30)).toBe('00000');
    });

    it('should handle period ending at midnight (0.0)', () => {
      const periods = [{ start: 22.0, end: 0.0, today: true }];
      const pattern = card.buildPattern(periods);

      // 22:00 = slot 44, end=0.0 is treated as 24:00 = slot 48
      // So slots 44-48 (22:00 to 24:00) should be off
      expect(pattern.substring(44, 48)).toBe('0000');
    });

    it('should handle period with end < start (wrapping not supported)', () => {
      // Note: The current implementation doesn't support periods that wrap to next day
      // end=2.0 is treated as 2:00 of the same day, not next day
      const periods = [{ start: 22.0, end: 2.0, today: true }];
      const pattern = card.buildPattern(periods);

      // Since end=2.0 < start=22.0, the loop doesn't execute
      // This is expected behavior - wrapping periods need special handling
      expect(pattern.substring(44, 48)).toBe('1111'); // No slots marked as off
    });
  });

  describe('Tab Switching', () => {
    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
      // An outage until the end of the day, so "today" has future periods whenever the tests run
      mockHass.states['sensor.power_state'].attributes.poweroff_periods_today.push({ start: 23.5, end: 0.0 });
      card.hass = mockHass;
    });

    it('should start with today tab active', () => {
      expect(card.selectedTab).toBe('today');
      expect(card.todayButton.classList.contains('active')).toBe(true);
      expect(card.tomorrowButton.classList.contains('active')).toBe(false);
    });

    it('should switch to tomorrow tab on button click', () => {
      card.tomorrowButton.click();

      expect(card.selectedTab).toBe('tomorrow');
      expect(card.tomorrowButton.classList.contains('active')).toBe(true);
      expect(card.todayButton.classList.contains('active')).toBe(false);
    });

    it('should switch back to today tab on button click', () => {
      card.tomorrowButton.click();
      card.todayButton.click();

      expect(card.selectedTab).toBe('today');
      expect(card.todayButton.classList.contains('active')).toBe(true);
    });

    it('should update header text when switching tabs', () => {
      expect(card.headerText.textContent).toBe('Сьогодні');

      card.tomorrowButton.click();
      expect(card.headerText.textContent).toBe('Завтра');
    });

    it('should update spiral chart when switching tabs', () => {
      const svgBefore = card.content.querySelector('svg.spiral-chart');
      const textBefore = svgBefore.textContent;

      card.tomorrowButton.click();

      const svgAfter = card.content.querySelector('svg.spiral-chart');
      const textAfter = svgAfter.textContent;

      // Content should change (different date/periods)
      expect(textAfter).not.toBe(textBefore);
    });
  });

  describe('Spiral Rendering', () => {
    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = mockHass;
    });

    it('should render 48 segments for 24 hours', () => {
      const segments = card.content.querySelectorAll('path.spiral-segment');
      expect(segments.length).toBe(48);
    });

    it('should render 24 hour labels', () => {
      const labels = card.content.querySelectorAll('text.spiral-hour-label');
      expect(labels.length).toBe(24);

      // Check that labels contain hour numbers
      const labelTexts = Array.from(labels).map(label => label.textContent);
      expect(labelTexts).toContain('0');
      expect(labelTexts).toContain('12');
      expect(labelTexts).toContain('23');
    });

    it('should render center circle', () => {
      const circle = card.content.querySelector('circle');
      expect(circle).toBeDefined();
      expect(circle.getAttribute('r')).toBe('120');
    });

    it('should render queue number in center', () => {
      const centerText = card.content.textContent;
      expect(centerText).toContain('1.1 черга');
    });

    it('should render date in center', () => {
      const centerText = card.content.textContent;
      // Date should be in Ukrainian format
      expect(centerText).toMatch(/\d{2}\.\d{2}/);
    });

    it('should render statistics in center', () => {
      const centerText = card.content.textContent;
      expect(centerText).toMatch(/- \d+/); // Off count
      expect(centerText).toMatch(/\+ \d+/); // On count
    });

    it('should apply correct colors to segments', () => {
      const segments = card.content.querySelectorAll('path.spiral-segment');
      const colors = Array.from(segments).map(seg => seg.getAttribute('style'));

      // Should have both power off (pink) and power on (green) segments
      const hasPink = colors.some(style => style.includes('rgb(255 182 193)'));
      const hasGreen = colors.some(style => style.includes('rgb(144 238 144)'));

      expect(hasPink).toBe(true);
      expect(hasGreen).toBe(true);
    });
  });

  describe('Image Snapshot Tests', () => {
    const snapshotDir = resolve(__dirname, '__snapshots__');
    // Allowed share of differing pixels. The font is the same everywhere (bundled Inter)
    // and pixelmatch ignores anti-aliased pixels anyway; this leaves room for tiny rendering differences.
    const MAX_DIFF_RATIO = 0.005;
    let RealDate;

    beforeAll(async () => {
      try {
        await render.init();
      } catch (err) {
        console.warn('Puppeteer is not available, image snapshot tests are skipped:', err.message);
      }
    }, 60000);

    beforeEach((ctx) => {
      if (!render.page) ctx.skip();
      // Frozen clock: dimming of past hours and "now" don't depend on when the tests run
      RealDate = dom.window.Date;
      const fixed = new RealDate('2026-10-27T12:10:00').getTime();
      dom.window.Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) super(fixed);
          else super(...args);
        }
        static now() { return fixed; }
      };
    });

    afterEach(() => {
      if (RealDate) dom.window.Date = RealDate;
    });

    // Ensure snapshot directory exists
    if (!existsSync(snapshotDir)) {
      mkdirSync(snapshotDir, { recursive: true });
    }

    async function compareImageSnapshot(actualPng, snapshotName) {
      const snapshotPath = resolve(snapshotDir, `${snapshotName}.png`);

      if (!existsSync(snapshotPath)) {
        // First run: save snapshot
        writeFileSync(snapshotPath, actualPng);
        return { match: true, isNew: true };
      }

      // Compare with existing snapshot
      const expected = PNG.sync.read(readFileSync(snapshotPath));
      const actual = PNG.sync.read(Buffer.from(actualPng));
      if (expected.width !== actual.width || expected.height !== actual.height) {
        writeFileSync(resolve(snapshotDir, `${snapshotName}-actual-diff.png`), actualPng);
        return { match: false, isNew: false };
      }
      const diff = new PNG({ width: expected.width, height: expected.height });
      const changed = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, { threshold: 0.1 });
      const match = changed / (expected.width * expected.height) <= MAX_DIFF_RATIO;
      if (!match) {
        writeFileSync(resolve(snapshotDir, `${snapshotName}-actual-diff.png`), actualPng);
        writeFileSync(resolve(snapshotDir, `${snapshotName}-diff.png`), PNG.sync.write(diff));
      }
      return { match, isNew: false };
    }

    function createHtmlForScreenshot(cardElement) {
      // Get the entire card structure (ha-card with all children)
      let cardHtml = '';

      if (cardElement.card) {
        // Get all content from ha-card including header and content div
        cardHtml = cardElement.card.innerHTML;
      } else {
        // Fallback: get header and content separately
        if (cardElement.headerContainer) {
          cardHtml += cardElement.headerContainer.outerHTML;
        }
        if (cardElement.content) {
          cardHtml += cardElement.content.innerHTML;
        }
      }

      // Get inline styles from the card content
      const cardStyles = cardElement.content?.querySelector('style')?.textContent || '';

      // Normalize only dates/times for snapshot consistency
      // Only text between tags, not attributes (otherwise the spiral path coordinates break)
      const normalized = cardHtml.replace(/>([^<]*)</g, (m, text) =>
        '>' + text.replace(/\d{2}\.\d{2}/g, 'DD.MM').replace(/\d{2}:\d{2}/g, 'HH:MM') + '<');

      // Create HTML page with the full card structure and all styles
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${CARD_FONT_CSS}
    :root {
      --card-background-color: #1e1e1e;
      --primary-text-color: #ffffff;
      --secondary-text-color: #b5b5b5;
      --primary-color: #03a9f4;
      --divider-color: rgba(255, 255, 255, 0.1);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      margin: 0;
      padding: 20px;
      background: #1e1e1e;
      color: #ffffff;
      font-family: "PoweroffInter", sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    ha-card {
      background: var(--card-background-color, #1e1e1e);
      border-radius: 12px;
      padding: 0;
      display: block;
      overflow: hidden;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }
    ha-icon {
      display: inline-block;
      width: 24px;
      height: 24px;
    }
    ha-icon svg {
      width: 100%;
      height: 100%;
      display: block;
      fill: currentColor;
    }
    svg {
      display: block;
    }
    svg.spiral-chart {
      width: 470px;
      height: 470px;
      max-width: 520px;
    }
    svg.spiral-chart g {
      transform-origin: center;
    }
    svg.spiral-chart path {
      vector-effect: non-scaling-stroke;
    }
    svg.spiral-chart text {
      font-family: "PoweroffInter", sans-serif;
    }
    button {
      cursor: pointer;
      border: none;
      background: transparent;
    }
    ${cardStyles}
  </style>
</head>
<body>
  <ha-card>
    ${normalized}
  </ha-card>
</body>
</html>
      `.trim();
    }

    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = mockHass;
    });

    it('should match image snapshot for today tab with periods', async () => {
      card.selectedTab = 'today';
      card.updateTimeline();

      const htmlContent = createHtmlForScreenshot(card);
      const screenshot = await render.screenshot(htmlContent);

      const result = await compareImageSnapshot(screenshot, 'today-tab-with-periods');

      if (result.isNew) {
        console.log('Created new snapshot: today-tab-with-periods.png');
      }
      expect(result.match).toBe(true);
    }, 30000);

    it('should match image snapshot for tomorrow tab with periods', async () => {
      card.selectedTab = 'tomorrow';
      card._userPickedTab = true; // otherwise auto tab selection switches back to today (it has future outages)
      card.updateTimeline();
      expect(card.headerText.textContent).toBe('Завтра');

      const htmlContent = createHtmlForScreenshot(card);
      const screenshot = await render.screenshot(htmlContent);

      const result = await compareImageSnapshot(screenshot, 'tomorrow-tab-with-periods');

      if (result.isNew) {
        console.log('Created new snapshot: tomorrow-tab-with-periods.png');
      }
      expect(result.match).toBe(true);
    }, 30000);

    it('should match image snapshot for empty periods', async () => {
      const emptyHass = {
        states: {
          'sensor.power_state': {
            entity_id: 'sensor.power_state',
            state: 'on',
            attributes: {
              poweroff_periods_today: [],
              poweroff_periods_tomorrow: [],
              next_off: null,
              next_on: null,
              queue: '1.1',
              group: '1.1',
            },
          },
        },
      };

      card.hass = emptyHass;
      card.updateTimeline();

      const htmlContent = createHtmlForScreenshot(card);
      const screenshot = await render.screenshot(htmlContent);

      const result = await compareImageSnapshot(screenshot, 'empty-periods');

      if (result.isNew) {
        console.log('Created new snapshot: empty-periods.png');
      }
      expect(result.match).toBe(true);
    }, 30000);

    it('should match image snapshot for full day power off', async () => {
      const fullDayOffHass = {
        states: {
          'sensor.power_state': {
            entity_id: 'sensor.power_state',
            state: 'off',
            attributes: {
              poweroff_periods_today: [{ start: 0.0, end: 24.0, today: true }],
              poweroff_periods_tomorrow: [],
              next_off: null,
              next_on: null,
              queue: '1.1',
              group: '1.1',
            },
          },
        },
      };

      card.hass = fullDayOffHass;
      card.updateTimeline();

      const htmlContent = createHtmlForScreenshot(card);
      const screenshot = await render.screenshot(htmlContent);

      const result = await compareImageSnapshot(screenshot, 'full-day-power-off');

      if (result.isNew) {
        console.log('Created new snapshot: full-day-power-off.png');
      }
      expect(result.match).toBe(true);
    }, 30000);

    it('should match image snapshot for battery runout mark', async () => {
      // Clock is frozen at 12:10; outage 12:30–15:00; 2.5 h of battery -> empty at 14:40, before power returns
      card.setConfig({ entity: 'sensor.power_state', battery_entity: 'sensor.battery_runtime' });
      card.hass = {
        states: {
          ...mockHass.states,
          'sensor.power_state': {
            ...mockHass.states['sensor.power_state'],
            attributes: {
              ...mockHass.states['sensor.power_state'].attributes,
              next_off: '2026-10-27T12:30:00',
              next_on: '2026-10-27T15:00:00',
            },
          },
          'sensor.battery_runtime': { state: '2.5', attributes: { unit_of_measurement: 'h' } },
        },
      };
      card.selectedTab = 'today';
      card.updateTimeline();

      const screenshot = await render.screenshot(createHtmlForScreenshot(card));
      const result = await compareImageSnapshot(screenshot, 'battery-runout-mark');
      if (result.isNew) {
        console.log('Created new snapshot: battery-runout-mark.png');
      }
      expect(result.match).toBe(true);
    }, 30000);
  });

  describe('Time Formatting', () => {
    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
    });

    it('should format valid date correctly', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = card.formatTime(date.toISOString());
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('should return dash for null value', () => {
      expect(card.formatTime(null)).toBe('—');
    });

    it('should return dash for undefined value', () => {
      expect(card.formatTime(undefined)).toBe('—');
    });

    it('should return dash for invalid date', () => {
      expect(card.formatTime('invalid-date')).toBe('—');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing entity gracefully', () => {
      card.setConfig({ entity: 'sensor.nonexistent' });
      card.hass = { states: {} };

      expect(card.content.innerHTML).toContain('Entity not found');
    });

    it('should handle empty periods arrays', () => {
      const emptyHass = {
        states: {
          'sensor.power_state': {
            entity_id: 'sensor.power_state',
            state: 'on',
            attributes: {
              poweroff_periods_today: [],
              poweroff_periods_tomorrow: [],
              next_off: null,
              next_on: null,
              queue: '1.1',
            },
          },
        },
      };

      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = emptyHass;

      // Should still render the card
      expect(card.content.querySelector('svg')).toBeDefined();
    });

    it('should auto-switch to tomorrow if no today periods', () => {
      const tomorrowOnlyHass = {
        states: {
          'sensor.power_state': {
            entity_id: 'sensor.power_state',
            state: 'on',
            attributes: {
              poweroff_periods_today: [],
              poweroff_periods_tomorrow: [
                { start: 0.0, end: 2.0, today: false },
              ],
              next_off: null,
              next_on: null,
              queue: '1.1',
            },
          },
        },
      };

      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = tomorrowOnlyHass;

      // Should switch to tomorrow tab
      expect(card.selectedTab).toBe('tomorrow');
    });
  });

  describe('Spiral Path Generation', () => {
    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
    });

    it('should generate valid SVG path', () => {
      const path = card.createSpiralPath(35, 37.3, 45, 0, Math.PI / 12);
      expect(path).toContain('M');
      expect(path).toContain('L');
      expect(path).toContain('A');
    });

    it('should generate different paths for different angles', () => {
      const path1 = card.createSpiralPath(35, 37.3, 45, 0, Math.PI / 12);
      const path2 = card.createSpiralPath(35, 37.3, 45, Math.PI / 12, Math.PI / 6);

      expect(path1).not.toBe(path2);
    });
  });

  describe('Freshness & resilience UI', () => {
    const withAttrs = (extra) => ({
      states: {
        'sensor.power_state': {
          ...mockHass.states['sensor.power_state'],
          attributes: { ...mockHass.states['sensor.power_state'].attributes, ...extra },
        },
      },
    });

    beforeEach(() => {
      card.setConfig({ entity: 'sensor.power_state' });
    });

    it('shows when the schedule was last changed', () => {
      card.hass = withAttrs({ schedule_changed_at: new Date().toISOString() });
      const line = card.content.querySelector('.updated-line');
      expect(line).not.toBeNull();
      expect(line.textContent).toContain('Графік оновлено сьогодні о');
    });

    it('hides updated line when attribute is missing (old integration version)', () => {
      card.hass = mockHass;
      expect(card.content.querySelector('.updated-line')).toBeNull();
    });

    it('shows stale banner when the site is down but keeps the spiral', () => {
      card.hass = withAttrs({
        data_stale: true,
        last_error: 'HTTP 502',
        last_success_at: new Date(Date.now() - 3600000).toISOString(),
        last_attempt_at: new Date().toISOString(),
      });
      const banner = card.content.querySelector('.stale-banner');
      expect(banner).not.toBeNull();
      expect(banner.textContent).toContain('показано збережений графік');
      expect(card.content.querySelectorAll('path.spiral-segment').length).toBe(48);
    });

    it('notes that tomorrow schedule is not published yet', () => {
      card.hass = withAttrs({ poweroff_periods_tomorrow: [], tomorrow_known: false });
      card.tomorrowButton.click();
      expect(card.content.textContent).toContain('Графік на завтра ще не опубліковано');
    });

    it('uses queue attribute from the integration', () => {
      card.hass = withAttrs({ queue: '4.1', group: undefined });
      expect(card.content.textContent).toContain('4.1 черга');
    });

    it('keeps manual tab choice after hass updates', () => {
      const lateHass = withAttrs({ poweroff_periods_today: [{ start: 0.0, end: 0.5 }] });
      card.hass = lateHass;
      card.todayButton.click();
      card.hass = withAttrs({ poweroff_periods_today: [{ start: 0.0, end: 0.5 }], next_on: null });
      expect(card.selectedTab).toBe('today');
    });

    it('skips re-render when unrelated entities change', () => {
      card.hass = mockHass;
      const before = card.content.firstElementChild;
      card.hass = { states: { ...mockHass.states, 'light.kitchen': { state: 'on' } } };
      expect(card.content.firstElementChild).toBe(before);
    });
  });

  describe('Queue switcher (select entity)', () => {
    let calls;
    const selectState = (option, extra = {}) => ({
      entity_id: 'select.poweroff_view_queue',
      state: option,
      attributes: {
        ...mockHass.states['sensor.power_state'].attributes,
        queue: option,
        home_queue: '4.1',
        loading: false,
        poweroff_periods_today: [{ start: 1.0, end: 3.0 }],
        schedule_changed_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        ...extra,
      },
    });
    const makeHass = (select) => ({
      states: {
        'sensor.power_state': {
          ...mockHass.states['sensor.power_state'],
          attributes: { ...mockHass.states['sensor.power_state'].attributes, queue: '4.1' },
        },
        'select.poweroff_view_queue': select,
      },
      callService: (...args) => calls.push(args),
    });

    beforeEach(() => {
      calls = [];
      card.setConfig({ entity: 'sensor.power_state' });
    });

    it('hides the chip when there is no select entity (old integration)', () => {
      card.hass = mockHass;
      expect(card.queueChip.hidden).toBe(true);
    });

    it('auto-discovers the select and shows the queue chip with home icon', () => {
      card.hass = makeHass(selectState('4.1'));
      expect(card.queueChip.hidden).toBe(false);
      expect(card.queueChip.textContent).toContain('4.1');
      expect(card.queueChip.querySelector('ha-icon[icon="mdi:home-outline"]')).not.toBeNull();
      expect(card.content.querySelector('.info-banner')).toBeNull();
    });

    it('reads periods from the select (view queue), not from the sensor', () => {
      card.hass = makeHass(selectState('2.1'));
      const pattern = card.buildPattern([{ start: 1.0, end: 3.0 }]);
      const fills = Array.from(card.content.querySelectorAll('path.spiral-segment')).map((p) => p.getAttribute('style'));
      expect(fills[2]).toContain('255 182 193'); // 01:00: outage from the select
      expect(pattern[2]).toBe('0');
      expect(card.content.textContent).toContain('2.1 черга');
    });

    it('opens menu and calls select.select_option, showing loading until state arrives', () => {
      card.hass = makeHass(selectState('4.1'));
      card.queueChip.click();
      expect(card.queueMenu.hidden).toBe(false);
      card.queueMenu.querySelector('[data-queue="5.2"]').click();
      expect(calls).toEqual([['select', 'select_option', { entity_id: 'select.poweroff_view_queue', option: '5.2' }]]);
      expect(card.queueMenu.hidden).toBe(true);
      expect(card.content.textContent).toContain('Завантажую графік черги 5.2');
      expect(card.content.textContent).toContain('оновлюю');

      card.hass = makeHass(selectState('5.2'));
      expect(card.content.textContent).not.toContain('Завантажую');
      expect(card.content.textContent).toContain('Перегляд черги 5.2 · ваша — 4.1');
    });

    it('"Повернутись" switches back to home queue', () => {
      card.hass = makeHass(selectState('2.1'));
      card.content.querySelector('[data-action="go-home"]').click();
      expect(calls[0][2]).toEqual({ entity_id: 'select.poweroff_view_queue', option: '4.1' });
    });

    it('closes the menu on outside click', () => {
      card.hass = makeHass(selectState('4.1'));
      card.queueChip.click();
      dom.window.document.body.click();
      expect(card.queueMenu.hidden).toBe(true);
    });

    it('shows last successful fetch in a tooltip (hover via CSS, tap toggles)', () => {
      const success = new Date(Date.now() - 5 * 60000).toISOString();
      card.hass = makeHass(selectState('4.1', { last_success_at: success, last_attempt_at: success }));
      const tooltip = card.content.querySelector('.updated-tooltip[role="tooltip"]');
      expect(tooltip.textContent).toMatch(/Дані з сайту отримано: (сьогодні|вчора) о \d{2}:\d{2}/);
      expect(tooltip.textContent).not.toContain('Остання спроба'); // same timestamp: not duplicated
      expect(card.content.querySelector('.updated-line').hasAttribute('title')).toBe(false);
      expect(card.content.querySelector('.updated-wrap').classList.contains('open')).toBe(false);
      card.content.querySelector('.updated-line').click();
      expect(card.content.querySelector('.updated-wrap').classList.contains('open')).toBe(true);
    });

    it('tooltip shows failed attempt and error when site is down', () => {
      const success = new Date(Date.now() - 3600000).toISOString();
      card.hass = makeHass(selectState('4.1', {
        last_success_at: success, last_attempt_at: new Date().toISOString(), last_error: 'HTTP 502', data_stale: true,
      }));
      const tooltip = card.content.querySelector('.updated-tooltip');
      expect(tooltip.textContent).toContain('Остання спроба');
      expect(tooltip.textContent).toContain('HTTP 502');
    });
  });

  describe('Card font', () => {
    it('uses the bundled Inter font for all text, including the spiral', () => {
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = mockHass;
      const css = card.styleEl.textContent;
      expect(css).toContain('ha-card { overflow: visible; font-family: "PoweroffInter"');
      expect(css).toContain('.spiral-chart text { font-family: "PoweroffInter"');
      expect(css).not.toContain('TT Firs Neue');
    });

    it('ships the font files next to the card', () => {
      for (const file of ['inter-latin-wght-normal.woff2', 'inter-cyrillic-wght-normal.woff2', 'OFL-Inter.txt']) {
        expect(existsSync(resolve(fontsDir, file))).toBe(true);
      }
    });
  });

  describe('Battery runout mark', () => {
    const HOUR = 3600000;
    const makeHass = (battery, nextOnInHours = 2) => ({
      states: {
        'sensor.power_state': {
          ...mockHass.states['sensor.power_state'],
          attributes: {
            ...mockHass.states['sensor.power_state'].attributes,
            next_on: new Date(Date.now() + nextOnInHours * HOUR).toISOString(),
          },
        },
        ...(battery ? { 'sensor.battery_runtime': battery } : {}),
      },
    });
    const withBattery = () => card.setConfig({ entity: 'sensor.power_state', battery_entity: 'sensor.battery_runtime' });
    const showDayOf = (date) => {
      card._userPickedTab = true;
      card.selectedTab = date.toDateString() === new Date().toDateString() ? 'today' : 'tomorrow';
      card.updateTimeline();
    };

    it('shows nothing without battery_entity', () => {
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = makeHass({ state: '3', attributes: { unit_of_measurement: 'h' } });
      expect(card.content.querySelector('.battery-mark')).toBeNull();
      expect(card.content.querySelector('.battery-line')).toBeNull();
    });

    it('draws a red line on the spiral at the moment the battery runs out', () => {
      withBattery();
      card.hass = makeHass({ state: '3', attributes: { unit_of_measurement: 'h' } });
      showDayOf(new Date(Date.now() + 3 * HOUR));
      expect(card.content.querySelector('.battery-mark line')).not.toBeNull();
      expect(card.content.querySelector('.legend-battery')).not.toBeNull();
    });

    it('glides the line to its new spot instead of jumping when the forecast changes', () => {
      const at = (h) => {
        const d = new Date(Date.now() + h * HOUR);
        return d.getHours() + d.getMinutes() / 60;
      };
      const [from, to] = [at(0.25), at(0.5)];
      if (to < from) return; // the half hour crosses midnight: the mark moves to another tab
      const frames = [];
      const { requestAnimationFrame: raf, cancelAnimationFrame: caf } = dom.window;
      dom.window.requestAnimationFrame = (cb) => frames.push(cb);
      dom.window.cancelAnimationFrame = () => {};
      const t0 = dom.window.performance.now();
      try {
        withBattery();
        card.hass = makeHass({ state: '0.25', attributes: { unit_of_measurement: 'h' } });
        showDayOf(new Date());
        expect(card._markHours).toBeCloseTo(from, 1); // first render: no animation
        card.hass = makeHass({ state: '0.5', attributes: { unit_of_measurement: 'h' } });
        expect(frames.length).toBe(1);
        expect(card._markHours).toBeCloseTo(from, 1); // still at the old spot
        frames.shift()(t0 + 600); // halfway
        expect(card._markHours).toBeGreaterThan(from + 0.01);
        expect(card._markHours).toBeLessThan(to - 0.01);
        frames.shift()(t0 + 5000); // past the end
        expect(card._markHours).toBeCloseTo(to, 1);
        const line = card.content.querySelector('.battery-mark line');
        expect(line.getAttribute('x1')).toBe(card.batteryMarkGeometry(card._markHours).x1);
      } finally {
        dom.window.requestAnimationFrame = raf;
        dom.window.cancelAnimationFrame = caf;
      }
    });

    it('puts the line only on the tab of the day the battery runs out', () => {
      withBattery();
      card.hass = makeHass({ state: '30', attributes: { unit_of_measurement: 'h' } }, 40);
      card._userPickedTab = true;
      card.selectedTab = 'today';
      card.updateTimeline();
      expect(card.content.querySelector('.battery-mark')).toBeNull(); // 30 h from now is never today
      expect(card.content.querySelector('.battery-line')).not.toBeNull();
    });

    it('says the charge is enough when it lasts until power returns', () => {
      withBattery();
      card.hass = makeHass({ state: '3', attributes: { unit_of_measurement: 'h' } }, 2);
      const line = card.content.querySelector('.battery-line');
      expect(line.classList.contains('ok')).toBe(true);
      expect(line.textContent).toContain('Заряду вистачить до');
    });

    it('warns when the battery runs out before power returns', () => {
      withBattery();
      card.hass = makeHass({ state: '0.5', attributes: { unit_of_measurement: 'h' } }, 2);
      const line = card.content.querySelector('.battery-line');
      expect(line.classList.contains('ok')).toBe(false);
      expect(line.textContent).toContain('Заряду не вистачить');
    });

    it('converts minutes, seconds and H:MM values to hours', () => {
      withBattery();
      card.hass = makeHass({ state: '90', attributes: { unit_of_measurement: 'min' } });
      expect(card.batteryHours()).toBeCloseTo(1.5);
      card.hass = makeHass({ state: '5400', attributes: { unit_of_measurement: 's' } });
      expect(card.batteryHours()).toBeCloseTo(1.5);
      card.hass = makeHass({ state: '1:30', attributes: {} });
      expect(card.batteryHours()).toBeCloseTo(1.5);
    });

    it('hides the battery when its entity is unavailable or missing', () => {
      withBattery();
      card.hass = makeHass({ state: 'unavailable', attributes: {} });
      expect(card.content.querySelector('.battery-line')).toBeNull();
      card.hass = makeHass(null);
      expect(card.content.querySelector('.battery-line')).toBeNull();
    });

    it('re-renders when only the battery entity changes', () => {
      withBattery();
      const hass = makeHass({ state: '3', attributes: { unit_of_measurement: 'h' } }, 2);
      card.hass = hass;
      expect(card.content.querySelector('.battery-line').classList.contains('ok')).toBe(true);
      card.hass = { states: { ...hass.states, 'sensor.battery_runtime': { state: '0.5', attributes: { unit_of_measurement: 'h' } } } };
      expect(card.content.querySelector('.battery-line').classList.contains('ok')).toBe(false);
    });
  });

  describe('Visual editor', () => {
    const Card = () => dom.window.customElements.get('poweroff-timeline-card');
    const withSelect = () => ({
      states: {
        ...mockHass.states,
        'select.poweroff_view_queue': {
          entity_id: 'select.poweroff_view_queue',
          state: '1.1',
          attributes: { ...mockHass.states['sensor.power_state'].attributes, home_queue: '1.1' },
        },
      },
    });

    it('describes the options for the built-in form editor', () => {
      const form = Card().getConfigForm();
      expect(form.schema.map((f) => f.name)).toEqual([
        'entity', 'show_queue_switcher', 'queue_entity', 'battery_entity', 'auto_tomorrow',
      ]);
      expect(form.schema[0].required).toBe(true);
      expect(form.schema[0].selector.entity.filter).toEqual({ integration: 'poltava_poweroff', domain: 'sensor' });
      expect(form.computeLabel({ name: 'battery_entity' })).toBe('Час роботи акумулятора');
      expect(form.computeHelper({ name: 'battery_entity' })).toContain('червону лінію');
    });

    it('refuses the visual editor for the old queue_entity: false', () => {
      const { assertConfig } = Card().getConfigForm();
      expect(() => assertConfig({ entity: 'sensor.power_state', queue_entity: false })).toThrow('show_queue_switcher');
      expect(() => assertConfig({ entity: 'sensor.power_state' })).not.toThrow();
    });

    it('suggests the integration sensor in the card picker', () => {
      expect(Card().getStubConfig(mockHass)).toEqual({ entity: 'sensor.power_state' });
      expect(Card().getStubConfig({ states: {} })).toEqual({ entity: 'sensor.power_state' });
    });

    it('hides the queue switcher with show_queue_switcher: false', () => {
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = withSelect();
      expect(card.queueChip.hidden).toBe(false);
      card.setConfig({ entity: 'sensor.power_state', show_queue_switcher: false });
      expect(card.queueChip.hidden).toBe(true); // redrawn right away, as in the editor preview
    });

    it('keeps the switcher when queue_entity is set explicitly', () => {
      card.setConfig({ entity: 'sensor.power_state', queue_entity: 'select.poweroff_view_queue' });
      card.hass = withSelect();
      expect(card.queueChip.hidden).toBe(false);
    });

    it('does not switch to tomorrow by itself with auto_tomorrow: false', () => {
      const hass = {
        states: {
          'sensor.power_state': {
            ...mockHass.states['sensor.power_state'],
            attributes: { ...mockHass.states['sensor.power_state'].attributes, poweroff_periods_today: [] },
          },
        },
      };
      card.setConfig({ entity: 'sensor.power_state' });
      card.hass = hass;
      expect(card.selectedTab).toBe('tomorrow');
      card.setConfig({ entity: 'sensor.power_state', auto_tomorrow: false });
      card.hass = hass;
      expect(card.selectedTab).toBe('today');
    });
  });
});

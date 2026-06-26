import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = 'https://www.benzin-price.ru';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface BenzinFetcherOptions {
  headless?: boolean;
  delayMs?: number;
  timeoutMs?: number;
}

export class BenzinPriceFetcher {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly headless: boolean;
  private readonly delayMs: number;
  private readonly timeoutMs: number;

  constructor(options: BenzinFetcherOptions = {}) {
    this.headless = options.headless ?? true;
    this.delayMs = options.delayMs ?? 1200;
    this.timeoutMs = options.timeoutMs ?? 45_000;
  }

  async init(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({ headless: this.headless });
    const context = await this.browser.newContext({
      userAgent: USER_AGENT,
      locale: 'ru-RU',
      viewport: { width: 1280, height: 800 },
    });
    this.page = await context.newPage();
    this.page.setDefaultTimeout(this.timeoutMs);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  async fetchHtml(path: string): Promise<string> {
    if (!this.page) throw new Error('Fetcher not initialized');

    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    await this.sleep(this.delayMs);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    return this.page.content();
  }

  /** Full price matrix for region (all fuel columns in one table). */
  async fetchRegionPrices(regionId: number): Promise<string> {
    return this.fetchHtml(`/price.php?region_id=${regionId}&sort=2`);
  }

  async fetchStationPage(benzinStationId: number): Promise<string> {
    return this.fetchHtml(`/zapravka.php?azk_id=${benzinStationId}`);
  }

  async fetchRegionListPage(): Promise<string> {
    return this.fetchHtml('/zapravka.php?page=region');
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }
}

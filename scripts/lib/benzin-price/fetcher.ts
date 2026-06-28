import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';
import { loadBenzinCookies } from './cookies.js';

const BASE_URL = 'https://www.benzin-price.ru';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface BenzinFetcherOptions {
  headless?: boolean;
  delayMs?: number;
  timeoutMs?: number;
  cookiesFile?: string;
  debugDir?: string;
}

export interface FetchDiagnostics {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number | null;
  htmlLength: number;
  hasPriceTable: boolean;
  hasStationLinks: boolean;
  isGatePage: boolean;
  isEmptyBody: boolean;
}

export class BenzinPriceFetcher {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private bootstrapped = false;
  private readonly headless: boolean;
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly cookiesFile?: string;
  private readonly debugDir?: string;
  lastDiagnostics: FetchDiagnostics | null = null;

  constructor(options: BenzinFetcherOptions = {}) {
    this.headless = options.headless ?? true;
    this.delayMs = options.delayMs ?? 1200;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.cookiesFile = options.cookiesFile ?? process.env.BENZIN_COOKIES_FILE;
    this.debugDir = options.debugDir ?? process.env.BENZIN_DEBUG_DIR;
  }

  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    this.context = await this.browser.newContext({
      userAgent: USER_AGENT,
      locale: 'ru-RU',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const { cookies, source } = loadBenzinCookies(this.cookiesFile);
    if (cookies.length > 0) {
      try {
        await this.context.addCookies(cookies);
        console.log(`[benzin] loaded ${cookies.length} cookies from ${source}`);
      } catch (err) {
        console.warn(`[benzin] cookie load failed (${source}), continuing without cookies:`, err);
      }
    } else {
      console.warn('[benzin] no cookie file found — site may block datacenter IPs without session cookies');
    }

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.timeoutMs);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private ensureDebugDir(): string | null {
    if (!this.debugDir) return null;
    mkdirSync(this.debugDir, { recursive: true });
    return this.debugDir;
  }

  private buildDiagnostics(requestedUrl: string, finalUrl: string, response: Response | null, html: string): FetchDiagnostics {
    const isGatePage = html.includes("$('#testdiv').load('check_s.php") || html.includes("load('check_s.php");
    const isEmptyBody =
      html.length < 200 ||
      /^<html><head><\/head><body><\/body><\/html>$/i.test(html.trim());
    return {
      requestedUrl,
      finalUrl,
      httpStatus: response?.status() ?? null,
      htmlLength: html.length,
      hasPriceTable: html.includes('td.price'),
      hasStationLinks: /zapravka\.php/i.test(html),
      isGatePage,
      isEmptyBody,
    };
  }

  private logDiagnostics(label: string, diag: FetchDiagnostics): void {
    console.log(
      `[benzin] ${label}: status=${diag.httpStatus} len=${diag.htmlLength} ` +
        `priceTable=${diag.hasPriceTable} stations=${diag.hasStationLinks} ` +
        `gate=${diag.isGatePage} empty=${diag.isEmptyBody}`
    );
    console.log(`[benzin]   requested: ${diag.requestedUrl}`);
    console.log(`[benzin]   final URL: ${diag.finalUrl}`);
  }

  private async saveDebugArtifacts(label: string, html: string): Promise<void> {
    const dir = this.ensureDebugDir();
    if (!dir) return;
    const safe = label.replace(/[^\w.-]+/g, '_');
    writeFileSync(join(dir, `${safe}.html`), html, 'utf8');
    if (this.page) {
      await this.page.screenshot({ path: join(dir, `${safe}.png`), fullPage: true }).catch(() => {});
    }
    console.warn(`[benzin] debug artifacts saved to ${dir}/${safe}.*`);
  }

  /** Visit homepage and pass JS anti-bot gate when present. */
  private async bootstrapSession(): Promise<void> {
    if (!this.page || this.bootstrapped) return;

    const homeUrl = `${BASE_URL}/`;
    console.log('[benzin] bootstrapping session via homepage...');
    const response = await this.page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    let html = await this.page.content();
    let diag = this.buildDiagnostics(homeUrl, this.page.url(), response, html);
    this.logDiagnostics('homepage', diag);

    if (diag.isGatePage) {
      console.log('[benzin] anti-bot gate detected, waiting for check_s.php...');
      await this.page.waitForFunction(
        () => {
          const body = document.body?.innerHTML ?? '';
          return body.length > 500 && !body.includes("load('check_s.php");
        },
        { timeout: this.timeoutMs }
      ).catch(() => this.sleep(8000));
      html = await this.page.content();
      diag = this.buildDiagnostics(homeUrl, this.page.url(), response, html);
      this.logDiagnostics('homepage-after-gate', diag);
    }

    if (diag.isEmptyBody) {
      await this.saveDebugArtifacts('homepage-blocked', html);
      console.warn('[benzin] homepage returned empty body — likely datacenter IP block');
    }

    this.bootstrapped = true;
    await this.sleep(this.delayMs);
  }

  async fetchHtml(path: string, label?: string): Promise<string> {
    if (!this.page) throw new Error('Fetcher not initialized');

    await this.bootstrapSession();

    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    await this.sleep(this.delayMs);

    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.sleep(500);

    // price.php → price2.php redirect; wait for table if expected
    if (path.includes('price')) {
      await this.page
        .waitForSelector('td.price, table', { timeout: 10_000 })
        .catch(() => undefined);
    }

    const html = await this.page.content();
    const diag = this.buildDiagnostics(url, this.page.url(), response, html);
    this.lastDiagnostics = diag;
    this.logDiagnostics(label ?? path, diag);

    if (diag.isEmptyBody || (path.includes('price') && !diag.hasPriceTable && !diag.isGatePage)) {
      await this.saveDebugArtifacts(label ?? path, html);
    }

    return html;
  }

  /** Full price matrix for region (price2.php since 2025 redirect from price.php). */
  async fetchRegionPrices(regionId: number): Promise<string> {
    return this.fetchHtml(`/price2.php?region_id=${regionId}&sort=2`, `region-${regionId}`);
  }

  async fetchStationPage(benzinStationId: number): Promise<string> {
    return this.fetchHtml(`/zapravka.php?azk_id=${benzinStationId}`, `station-${benzinStationId}`);
  }

  async fetchRegionListPage(): Promise<string> {
    return this.fetchHtml('/zapravka.php?page=region', 'regions');
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.bootstrapped = false;
  }
}

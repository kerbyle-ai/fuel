import './env.js';
import { Bot, Keyboard } from 'grammy';
import type { Context } from 'grammy';
import {
  ApiError,
  buildMapUrl,
  fetchNearbyStations,
  formatStationStatus,
} from './api.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required (set in fuel-map/.env)');
  process.exit(1);
}

const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:8090';
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/toplivo99';
const WEB_APP_LINK = buildMapUrl(WEB_APP_URL, { campaign: 'fuel_federal' });

const BTN_NEARBY = 'Посмотреть рядом';
const BTN_RESTART = 'Перезапустить бот';
const BTN_MAP = 'Открыть карту';

const bot = new Bot(token);

/** Always-visible bottom keyboard (ReplyKeyboardMarkup). */
function persistentKeyboard(): Keyboard {
  return new Keyboard()
    .text(BTN_NEARBY)
    .text(BTN_RESTART)
    .row()
    .text(BTN_MAP)
    .resized()
    .persistent();
}

/** Nearby flow: one-tap location + persistent actions. */
function nearbyPromptKeyboard(): Keyboard {
  return new Keyboard()
    .requestLocation('📍 Отправить геолокацию')
    .row()
    .text(BTN_NEARBY)
    .text(BTN_RESTART)
    .row()
    .text(BTN_MAP)
    .resized()
    .persistent();
}

function withPersistentKeyboard(extra?: Record<string, unknown>) {
  return { ...extra, reply_markup: persistentKeyboard() };
}

async function sendStart(ctx: Context) {
  await ctx.reply(
    '⛽ *Карта топлива*\n\n' +
      'Бесплатная карта АЗС по России — где сейчас *есть* или *нет* топлива.\n\n' +
      'Статусы обновляют водители на дороге: один клик после заправки — и коллеги видят актуальную картину.\n\n' +
      '*Как пользоваться:*\n' +
      '• «Посмотреть рядом» — 5 ближайших АЗС (нужна 📍 геолокация)\n' +
      '• «Открыть карту» — карта в браузере\n' +
      '• /report — отметить наличие на карте\n' +
      '• /help — список команд\n\n' +
      `Канал с обновлениями: [${CHANNEL_URL}](${CHANNEL_URL})`,
    withPersistentKeyboard({ parse_mode: 'Markdown', link_preview_options: { is_disabled: true } })
  );
}

async function sendNearbyPrompt(ctx: Context) {
  await ctx.reply(
    'Покажу до 5 ближайших АЗС со статусом топлива в радиусе 10 км.\n\n' +
      'Нажмите «📍 Отправить геолокацию» ниже — можно с пассажирского места, не за рулём 🙂',
    { reply_markup: nearbyPromptKeyboard() }
  );
}

bot.command('start', sendStart);
bot.hears(BTN_RESTART, sendStart);

bot.command('help', async (ctx) => {
  await ctx.reply(
    '*Команды бота*\n\n' +
      '/start — приветствие и кнопки\n' +
      '/nearby — 5 ближайших АЗС (отправьте 📍 геолокацию)\n' +
      '/report — открыть карту для отчёта о топливе\n' +
      '/help — этот список\n\n' +
      'Можно просто отправить 📍 геолокацию — бот покажет АЗС рядом.\n\n' +
      'Внизу всегда доступны кнопки: «Посмотреть рядом», «Перезапустить бот», «Открыть карту».',
    withPersistentKeyboard({ parse_mode: 'Markdown' })
  );
});

bot.command('nearby', sendNearbyPrompt);
bot.hears(BTN_NEARBY, sendNearbyPrompt);

async function sendMapLink(ctx: Context) {
  await ctx.reply(
    `🗺 Карта топлива:\n${WEB_APP_LINK}\n\n` +
      `[Открыть в браузере](${WEB_APP_LINK})`,
    withPersistentKeyboard({ parse_mode: 'Markdown', link_preview_options: { is_disabled: true } })
  );
}

bot.hears(BTN_MAP, sendMapLink);

bot.command('report', async (ctx) => {
  await ctx.reply(
    'Помогите другим водителям — отметьте, есть ли топливо на вашей АЗС.\n\n' +
      '1. Нажмите «Открыть карту» внизу\n' +
      '2. Найдите заправку\n' +
      '3. Нажмите 🟢 «Есть» или 🔴 «Нет»\n\n' +
      'Занимает около 10 секунд. Спасибо, что участвуете! 🙌',
    withPersistentKeyboard({ link_preview_options: { is_disabled: true } })
  );
});

bot.on('message:location', async (ctx) => {
  const { latitude, longitude } = ctx.message.location;

  const waiting = await ctx.reply('Ищу АЗС рядом…', withPersistentKeyboard());

  try {
    const stations = await fetchNearbyStations(latitude, longitude, 5);

    if (stations.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        waiting.message_id,
        'Рядом не найдено АЗС в радиусе 10 км.\n\nПопробуйте другую точку или откройте карту целиком.',
        { link_preview_options: { is_disabled: true } }
      );
      return;
    }

    const lines = stations.map((s) => formatStationStatus(s, WEB_APP_URL)).join('\n\n');
    await ctx.api.editMessageText(
      ctx.chat!.id,
      waiting.message_id,
      `*Ближайшие АЗС:*\n\n${lines}`,
      {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      }
    );
  } catch (err) {
    console.error('nearby error:', err);
    const message =
      err instanceof ApiError
        ? err.message
        : 'Не удалось получить данные. Попробуйте позже.';
    await ctx.api.editMessageText(ctx.chat!.id, waiting.message_id, message);
  }

  await ctx
    .reply('Чтобы обновить список — снова «Посмотреть рядом» или отправьте 📍.', withPersistentKeyboard())
    .catch(() => undefined);
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 6
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) throw err;
      const delay = Math.min(30_000, 3000 * i);
      console.warn(`${label} failed (attempt ${i}/${attempts}), retry in ${delay / 1000}s…`);
      await sleep(delay);
    }
  }
  throw new Error(`${label}: retries exhausted`);
}

async function main() {
  const apiUrl = process.env.API_URL || 'http://localhost:3001/api';
  console.log(`API_URL=${apiUrl}`);
  console.log(`WEB_APP_URL=${WEB_APP_URL}`);

  const me = await withRetry('getMe', () => bot.api.getMe());
  console.log(`Fuel Map Telegram bot @${me.username} (id ${me.id}) starting…`);

  try {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Открыть карту', web_app: { url: WEB_APP_LINK } },
    });
    console.log(`Menu button → ${WEB_APP_LINK}`);
  } catch (err) {
    console.warn('setChatMenuButton failed (BotFather domain?):', err);
    try {
      await bot.api.setChatMenuButton({
        menu_button: { type: 'default' },
      });
    } catch {
      /* ignore */
    }
  }

  await withRetry('bot.start', () =>
    bot.start({
      onStart: () => console.log('Bot is polling for updates'),
    })
  );
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

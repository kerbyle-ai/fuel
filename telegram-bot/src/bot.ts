import './env.js';
import { Bot, InlineKeyboard, Keyboard } from 'grammy';
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

const bot = new Bot(token);

function mainKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url('🗺 Открыть карту', WEB_APP_LINK)
    .row()
    .url('📢 Канал', CHANNEL_URL);
}

function reportKeyboard(lat?: number, lng?: number): InlineKeyboard {
  const link = buildMapUrl(WEB_APP_URL, {
    lat,
    lng,
    campaign: 'report',
  });
  return new InlineKeyboard().url('📍 Открыть карту для отчёта', link);
}

bot.command('start', async (ctx) => {
  await ctx.reply(
    '⛽ *Карта топлива*\n\n' +
      'Бесплатная карта АЗС по России — где сейчас *есть* или *нет* топлива.\n\n' +
      'Статусы обновляют водители на дороге: один клик после заправки — и коллеги видят актуальную картину.\n\n' +
      '*Как пользоваться:*\n' +
      '• /nearby — 5 ближайших АЗС (нужна 📍 геолокация)\n' +
      '• /report — отметить наличие на карте\n' +
      '• /help — список команд\n\n' +
      'Откройте карту в браузере или перейдите в канал 👇',
    { parse_mode: 'Markdown', reply_markup: mainKeyboard() }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '*Команды бота*\n\n' +
      '/start — приветствие и кнопки\n' +
      '/nearby — 5 ближайших АЗС (отправьте 📍 геолокацию)\n' +
      '/report — открыть карту для отчёта о топливе\n' +
      '/help — этот список\n\n' +
      'Можно просто отправить 📍 геолокацию — бот покажет АЗС рядом.',
    { parse_mode: 'Markdown', reply_markup: mainKeyboard() }
  );
});

bot.command('nearby', async (ctx) => {
  const keyboard = new Keyboard()
    .requestLocation('📍 Отправить геолокацию')
    .resized();
  await ctx.reply(
    'Покажу до 5 ближайших АЗС со статусом топлива в радиусе 10 км.\n\n' +
      'Нажмите кнопку и отправьте геолокацию — можно с пассажирского места, не за рулём 🙂',
    { reply_markup: keyboard }
  );
});

bot.command('report', async (ctx) => {
  await ctx.reply(
    'Помогите другим водителям — отметьте, есть ли топливо на вашей АЗС.\n\n' +
      '1. Откройте карту\n' +
      '2. Найдите заправку\n' +
      '3. Нажмите 🟢 «Есть» или 🔴 «Нет»\n\n' +
      'Занимает около 10 секунд. Спасибо, что участвуете! 🙌',
    {
      reply_markup: reportKeyboard(),
      link_preview_options: { is_disabled: true },
    }
  );
});

bot.on('message:location', async (ctx) => {
  const { latitude, longitude } = ctx.message.location;

  const waiting = await ctx.reply('Ищу АЗС рядом…');

  try {
    const stations = await fetchNearbyStations(latitude, longitude, 5);

    if (stations.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        waiting.message_id,
        'Рядом не найдено АЗС в радиусе 10 км.\n\nПопробуйте другую точку или откройте карту целиком.',
        { reply_markup: mainKeyboard() }
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
        reply_markup: mainKeyboard(),
      }
    );
  } catch (err) {
    console.error('nearby error:', err);
    const message =
      err instanceof ApiError
        ? err.message
        : 'Не удалось получить данные. Попробуйте позже.';
    await ctx.api.editMessageText(ctx.chat!.id, waiting.message_id, message, {
      reply_markup: mainKeyboard(),
    });
  }

  // Скрыть клавиатуру «Отправить геолокацию»
  await ctx
    .reply('Чтобы обновить список — снова /nearby или отправьте 📍.', {
      reply_markup: { remove_keyboard: true },
    })
    .catch(() => undefined);
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

async function main() {
  const me = await bot.api.getMe();
  console.log(`Fuel Map Telegram bot @${me.username} (id ${me.id}) starting…`);

  const apiUrl = process.env.API_URL || 'http://localhost:3001/api';
  console.log(`API_URL=${apiUrl}`);
  console.log(`WEB_APP_URL=${WEB_APP_URL}`);

  await bot.start({
    onStart: () => console.log('Bot is polling for updates'),
  });
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

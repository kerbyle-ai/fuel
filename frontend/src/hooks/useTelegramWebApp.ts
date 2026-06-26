import WebApp from '@twa-dev/sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';

const CHANNEL_URL = 'https://t.me/toplivo99';

function applyThemeParams(): void {
  const tp = WebApp.themeParams;
  const root = document.documentElement;

  if (tp.bg_color) root.style.setProperty('--tg-bg', tp.bg_color);
  if (tp.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', tp.secondary_bg_color);
  if (tp.text_color) root.style.setProperty('--tg-text', tp.text_color);
  if (tp.hint_color) root.style.setProperty('--tg-hint', tp.hint_color);
  if (tp.link_color) root.style.setProperty('--tg-link', tp.link_color);
  if (tp.button_color) root.style.setProperty('--tg-button', tp.button_color);
  if (tp.button_text_color) root.style.setProperty('--tg-button-text', tp.button_text_color);
  if (tp.header_bg_color) root.style.setProperty('--tg-header-bg', tp.header_bg_color);

  const scheme = WebApp.colorScheme;
  root.dataset.tgScheme = scheme;
  document.body.classList.toggle('tg-dark', scheme === 'dark');
}

export function useTelegramWebApp() {
  const [isTelegram] = useState(() => {
    try {
      return WebApp.platform !== 'unknown' && Boolean(WebApp.initData);
    } catch {
      return false;
    }
  });

  const user = useMemo(() => {
    if (!isTelegram) return null;
    return WebApp.initDataUnsafe.user ?? null;
  }, [isTelegram]);

  useEffect(() => {
    if (!isTelegram) return;

    WebApp.ready();
    WebApp.expand();
    applyThemeParams();

    const onTheme = () => applyThemeParams();
    WebApp.onEvent('themeChanged', onTheme);

    return () => {
      WebApp.offEvent('themeChanged', onTheme);
    };
  }, [isTelegram]);

  const openChannel = useCallback(() => {
    if (isTelegram) {
      WebApp.openTelegramLink(CHANNEL_URL);
    } else {
      window.open(CHANNEL_URL, '_blank', 'noopener');
    }
  }, [isTelegram]);

  const showMainButton = useCallback(
    (text: string, onClick: () => void) => {
      if (!isTelegram) return () => undefined;

      const btn = WebApp.MainButton;
      btn.setText(text);
      btn.color = WebApp.themeParams.button_color ?? '#1a5f2a';
      btn.textColor = WebApp.themeParams.button_text_color ?? '#ffffff';
      btn.onClick(onClick);
      btn.show();

      return () => {
        btn.offClick(onClick);
        btn.hide();
      };
    },
    [isTelegram]
  );

  const showBackButton = useCallback(
    (onClick: () => void) => {
      if (!isTelegram) return () => undefined;

      const btn = WebApp.BackButton;
      btn.onClick(onClick);
      btn.show();

      return () => {
        btn.offClick(onClick);
        btn.hide();
      };
    },
    [isTelegram]
  );

  const haptic = useCallback(
    (type: 'light' | 'medium' | 'heavy' = 'light') => {
      if (!isTelegram) return;
      WebApp.HapticFeedback.impactOccurred(type);
    },
    [isTelegram]
  );

  return {
    isTelegram,
    user,
    channelUrl: CHANNEL_URL,
    openChannel,
    showMainButton,
    showBackButton,
    haptic,
  };
}

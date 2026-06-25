import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'fuelmap_welcome_seen';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  if (!open) return null;

  const showAndroidHint = isAndroid() && !installPrompt;
  const showIOSHint = isIOS();

  return (
    <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-modal__backdrop" onClick={dismiss} />
      <div className="welcome-modal__panel">
        <div className="welcome-modal__handle" />

        <div className="welcome-modal__content">
          <h2 id="welcome-title" className="welcome-modal__title">
            Добро пожаловать!
          </h2>
          <p className="welcome-modal__lead">
            Карта топлива — бесплатный краудсорсинговый проект. Данные о наличии бензина и дизеля
            добавляют пользователи.
          </p>

          <section className="welcome-modal__section">
            <h3>📱 Установить как приложение</h3>
            {installPrompt && (
              <button type="button" className="welcome-modal__install-btn" onClick={handleInstall}>
                Установить приложение
              </button>
            )}
            {showAndroidHint && (
              <p>
                <strong>Android:</strong> Chrome → меню (⋮) → «Установить приложение» или «На главный
                экран»
              </p>
            )}
            {showIOSHint && (
              <p>
                <strong>iPhone:</strong> Safari → «Поделиться» (□↑) → «На экран «Домой»»
              </p>
            )}
            {!showAndroidHint && !showIOSHint && !installPrompt && (
              <ul className="welcome-modal__list">
                <li>
                  <strong>Android:</strong> Chrome → «Установить» / «На главный экран»
                </li>
                <li>
                  <strong>iPhone:</strong> Safari → «Поделиться» → «На экран «Домой»»
                </li>
              </ul>
            )}
          </section>

          <section className="welcome-modal__section">
            <h3>🗺️ Как пользоваться</h3>
            <ol className="welcome-modal__list welcome-modal__list--ordered">
              <li>Откройте карту и найдите нужную АЗС</li>
              <li>Нажмите на заправку и отметьте «Есть» или «Нет»</li>
              <li>При желании укажите очередь и лимит на заправку</li>
            </ol>
          </section>

          <p className="welcome-modal__note">
            Спасибо, что помогаете другим водителям! Проект полностью бесплатный.
          </p>

          <button type="button" className="welcome-modal__cta" onClick={dismiss}>
            Понятно, начать
          </button>
        </div>
      </div>
    </div>
  );
}

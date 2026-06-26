interface TelegramHeaderProps {
  stationCount: number;
  loading: boolean;
  onOpenChannel: () => void;
}

export function TelegramHeader({ stationCount, loading, onOpenChannel }: TelegramHeaderProps) {
  return (
    <header className="tg-header">
      <div className="tg-header__brand">
        <span className="tg-header__icon" aria-hidden>
          ⛽
        </span>
        <div>
          <h1 className="tg-header__title">Топливо России</h1>
          <p className="tg-header__tagline">
            {loading ? 'Загрузка…' : `${stationCount} АЗС в области`}
          </p>
        </div>
      </div>
      <button type="button" className="tg-header__channel" onClick={onOpenChannel}>
        @toplivo99
      </button>
    </header>
  );
}

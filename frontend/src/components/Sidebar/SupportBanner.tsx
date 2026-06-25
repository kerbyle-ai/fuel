import { DONATION_URL } from '../../constants';

export function SupportBanner() {
  if (!DONATION_URL) return null;

  return (
    <div className="support-banner">
      <p className="support-banner__text">
        Проект бесплатный. Данные добавляют пользователи.
      </p>
      <a
        href={DONATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="support-banner__link"
      >
        Поддержать проект
      </a>
    </div>
  );
}

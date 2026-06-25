interface LocationButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function LocationButton({ onClick, loading }: LocationButtonProps) {
  return (
    <button
      type="button"
      className="location-btn"
      onClick={onClick}
      disabled={loading}
      title="Моё местоположение"
      aria-label="Моё местоположение"
    >
      {loading ? '…' : '📍'}
      <span className="location-btn__label">Моё местоположение</span>
    </button>
  );
}

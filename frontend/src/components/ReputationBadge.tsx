import { useEffect, useState } from 'react';
import { fetchUserStats, type UserStats } from '../api/client';

const RANK_CLASS: Record<UserStats['rank'], string> = {
  Новичок: 'reputation-badge--novice',
  Активист: 'reputation-badge--activist',
  Эксперт: 'reputation-badge--expert',
};

export default function ReputationBadge({ refreshKey = 0 }: { refreshKey?: number }) {
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    fetchUserStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshKey]);

  if (!stats || stats.reports_count === 0) return null;

  return (
    <div className={`reputation-badge ${RANK_CLASS[stats.rank]}`} title={`Репутация: ${stats.reputation}`}>
      <span className="reputation-badge__rank">{stats.rank}</span>
      <span className="reputation-badge__meta">
        {stats.reports_count} отч. · {Math.round(stats.reputation)} очк.
      </span>
    </div>
  );
}

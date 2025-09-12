import React, { useState, useEffect } from 'react';
import { apiCache } from '@/lib/cache';

interface PerformanceStatsProps {
  isVisible: boolean;
}

const PerformanceStats: React.FC<PerformanceStatsProps> = ({ isVisible }) => {
  const [stats, setStats] = useState(apiCache.getStats());

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setStats(apiCache.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible || process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 border border-gray-600 z-50">
      <div className="font-semibold text-green-400 mb-2">Performance Stats</div>
      <div className="space-y-1">
        <div>Cache Entries: <span className="text-blue-400">{stats.totalEntries}</span></div>
        <div>Expired: <span className="text-red-400">{stats.expiredEntries}</span></div>
        <div>Memory: <span className="text-yellow-400">{stats.memoryUsage} bytes</span></div>
      </div>
    </div>
  );
};

export default PerformanceStats;

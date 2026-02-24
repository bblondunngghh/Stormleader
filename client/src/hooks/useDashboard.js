import { useState, useEffect } from 'react';
import * as dashboardApi from '../api/dashboard';
import { stats as mockStats, funnelData as mockFunnel, activityFeed as mockActivity } from '../data/mockData';

export function useDashboard() {
  const [stats, setStats] = useState(mockStats);
  const [funnel, setFunnel] = useState(mockFunnel);
  const [activity, setActivity] = useState(mockActivity);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const [statsRes, funnelRes, activityRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getFunnel(),
          dashboardApi.getActivity(),
        ]);

        if (cancelled) return;

        if (statsRes.data?.stats) setStats(statsRes.data.stats);
        if (funnelRes.data?.funnel) setFunnel(funnelRes.data.funnel);
        if (activityRes.data?.activity) setActivity(activityRes.data.activity);
      } catch (err) {
        if (cancelled) return;
        setError(err);
        // Keep mock data as fallback — already set as initial state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { stats, funnel, activity, loading, error };
}

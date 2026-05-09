import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useSocket } from '../../hooks/useSocket';
import './Analytics.css';
import temperatureIcon from '../../assets/icons/thermometer.png';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

const PIE_COLORS: Record<string, string> = {
  PASSIVE: '#94A3B8',
  CODING: '#10B981',
  FOCUS: '#3B82F6',
  RELAX: '#F59E0B',
  MEETING: '#EF4444',
};

const MODE_LABELS: Record<string, string> = {
  PASSIVE: 'Serbest',
  CODING: 'Kodlama',
  FOCUS: 'Odak',
  RELAX: 'Relax',
  MEETING: 'Toplanti',
};

function AnalyticsSkeleton() {
  return (
    <div className="analytics__grid analytics__grid--skeleton" aria-hidden="true">
      <div className="analytics__card glass-card">
        <div className="analytics__skeleton-title analytics__skeleton-shimmer" />
        <div className="analytics__skeleton-chart">
          <div className="analytics__skeleton-bars">
            {[42, 68, 54, 82, 58, 74, 46].map((height, index) => (
              <span
                key={index}
                className="analytics__skeleton-bar analytics__skeleton-shimmer"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="analytics__skeleton-axis">
            {[0, 1, 2, 3, 4].map((tick) => (
              <span key={tick} className="analytics__skeleton-tick analytics__skeleton-shimmer" />
            ))}
          </div>
        </div>
      </div>

      <div className="analytics__card glass-card">
        <div className="analytics__skeleton-title analytics__skeleton-shimmer" />
        <div className="analytics__skeleton-line-chart">
          {[28, 62, 35, 70, 40, 76, 52].map((top, index) => (
            <span
              key={index}
              className="analytics__skeleton-node analytics__skeleton-shimmer"
              style={{ top: `${top}%`, left: `${8 + index * 13}%` }}
            />
          ))}
          <div className="analytics__skeleton-axis analytics__skeleton-axis--bottom">
            {[0, 1, 2, 3, 4].map((tick) => (
              <span key={tick} className="analytics__skeleton-tick analytics__skeleton-shimmer" />
            ))}
          </div>
        </div>
      </div>

      <div className="analytics__card analytics__card--small glass-card">
        <div className="analytics__skeleton-title analytics__skeleton-shimmer" />
        <div className="analytics__skeleton-stats">
          <div className="analytics__skeleton-circle analytics__skeleton-shimmer" />
          <div className="analytics__skeleton-label analytics__skeleton-shimmer" />
          <div className="analytics__skeleton-sub analytics__skeleton-shimmer" />
        </div>
      </div>

      <div className="analytics__card analytics__card--small glass-card">
        <div className="analytics__skeleton-title analytics__skeleton-shimmer" />
        <div className="analytics__skeleton-pie-wrap">
          <div className="analytics__skeleton-pie analytics__skeleton-shimmer" />
          <div className="analytics__skeleton-legend">
            {[0, 1, 2].map((item) => (
              <div key={item} className="analytics__skeleton-legend-row">
                <span className="analytics__skeleton-legend-dot analytics__skeleton-shimmer" />
                <span className="analytics__skeleton-legend-text analytics__skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const parseSqliteDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.replace(' ', 'T');
  return new Date(cleanStr.endsWith('Z') ? cleanStr : cleanStr + 'Z');
};

export function Analytics() {
  const navigate = useNavigate();
  const socket = useSocket();
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);
  const [postureHistory, setPostureHistory] = useState<any[]>([]);
  const [postureStats, setPostureStats] = useState<any>(null);
  const [modeStats, setModeStats] = useState<any>(null);
  const [hours, setHours] = useState(24);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [sRes, pRes, psRes, mRes] = await Promise.all([
          fetch(`${API_URL}/sensors/history?hours=${hours}`),
          fetch(`${API_URL}/posture/history?hours=${hours}`),
          fetch(`${API_URL}/posture/stats?hours=${hours}`),
          fetch(`${API_URL}/modes/stats?hours=${hours}`),
        ]);

        const sensorData = await sRes.json();
        const postureData = await pRes.json();
        const postureStatsData = await psRes.json();
        const modeStatsData = await mRes.json();

        setSensorHistory(
          sensorData.map((d: any) => ({
            time: parseSqliteDate(d.createdAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            sicaklik: d.temperature,
            nem: d.humidity,
            hava: d.airQuality,
          })),
        );

        setPostureHistory(
          postureData.map((d: any) => ({
            time: parseSqliteDate(d.createdAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            durum: d.isSlouching ? 1 : 0,
            slouchPercentage: d.slouchPercentage ?? (d.isSlouching ? 100 : 0),
          })),
        );

        setPostureStats(postureStatsData);

        const pieData = Object.entries(modeStatsData)
          .filter(([_, value]) => (value as number) > 0)
          .map(([key, value]) => ({
            name: MODE_LABELS[key] || key,
            value: value as number,
            color: PIE_COLORS[key] || '#666',
          }));

        setModeStats(pieData.length > 0 ? pieData : null);
      } catch (err) {
        console.error('Analiz verileri alinamadi:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [hours]);

  useEffect(() => {
    const handlePostureUpdate = (payload: any) => {
      if (!payload.isActive) return;
      
      const nowStr = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      
      setPostureHistory((prev) => {
        const newPoint = {
          time: nowStr,
          durum: payload.isSlouching ? 1 : 0,
          slouchPercentage: payload.isSlouching ? 100 : 0,
        };
        if (prev.length > 0 && prev[prev.length - 1].time === nowStr) {
          const updated = [...prev];
          updated[updated.length - 1] = newPoint;
          return updated;
        }
        return [...prev, newPoint].slice(-100);
      });

      setPostureStats((prevStats: any) => {
        if (!prevStats) return null;
        const total = prevStats.totalEvents + 1;
        const currentSlouchCount = Math.round((prevStats.slouchPercentage / 100) * prevStats.totalEvents);
        const newSlouchCount = payload.isSlouching ? currentSlouchCount + 1 : currentSlouchCount;
        const slouchPercentage = Math.round((newSlouchCount / total) * 100);
        return {
          totalEvents: total,
          slouchPercentage,
          goodPercentage: 100 - slouchPercentage,
        };
      });
    };

    socket.on('posture_update', handlePostureUpdate);
    return () => {
      socket.off('posture_update', handlePostureUpdate);
    };
  }, [socket]);

  if (isLoading) {
    return (
      <div className="analytics analytics--loading">
        <header className="analytics__header">
          <button className="analytics__back" onClick={() => navigate('/')} id="back-btn">
            {'<'} Dashboard
          </button>
          <h1 className="analytics__title">Istatistikler</h1>
          <div className="analytics__filter">
            {[6, 12, 24, 48].map((h) => (
              <button
                key={h}
                className={`analytics__filter-btn ${hours === h ? 'analytics__filter-btn--active' : ''}`}
                disabled
                type="button"
              >
                {h}s
              </button>
            ))}
          </div>
        </header>
        <AnalyticsSkeleton />
      </div>
    );
  }

  return (
    <div className="analytics">
      <header className="analytics__header">
        <button className="analytics__back" onClick={() => navigate('/')} id="back-btn">
          {'<'} Dashboard
        </button>
        <h1 className="analytics__title">Istatistikler</h1>
        <div className="analytics__filter">
          {[6, 12, 24, 48].map((h) => (
            <button
              key={h}
              className={`analytics__filter-btn ${hours === h ? 'analytics__filter-btn--active' : ''}`}
              onClick={() => setHours(h)}
              type="button"
            >
              {h}s
            </button>
          ))}
        </div>
      </header>

      <div className="analytics__grid">
        <div className="analytics__card glass-card">
          <h2 className="analytics__card-title">
            <img src={temperatureIcon} alt="Sicaklik" className="dashboard__sensor-icon" />
            {' '}
            Sicaklik & Nem
          </h2>
          {sensorHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sensorHistory}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="airGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: '#1a1f36',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Area type="monotone" dataKey="sicaklik" stroke="#F97316" fill="url(#tempGrad)" strokeWidth={2} name="Sıcaklık (°C)" />
                <Area type="monotone" dataKey="nem" stroke="#06B6D4" fill="url(#humGrad)" strokeWidth={2} name="Nem (%)" />
                <Area type="monotone" dataKey="hava" stroke="#10B981" fill="url(#airGrad)" strokeWidth={2} name="Hava Kalitesi (%)" />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics__empty">Henuz veri yok</div>
          )}
        </div>

        <div className="analytics__card glass-card">
          <h2 className="analytics__card-title">Durus Zaman Cizelgesi</h2>
          {postureHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={postureHistory}>
                <defs>
                  <linearGradient id="postureGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} />
                <YAxis
                  stroke="rgba(255,255,255,0.2)"
                  fontSize={10}
                  ticks={[0, 1]}
                  tickFormatter={(value) => (value === 1 ? 'Kambur' : 'Duzgun')}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1f36',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, _name: any, props: any) => {
                    const pct = props?.payload?.slouchPercentage ?? (value === 1 ? 100 : 0);
                    return [`%${pct}`, 'Kambur Oranı'];
                  }}
                />
                <Area type="stepAfter" dataKey="durum" stroke="#EF4444" fill="url(#postureGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics__empty">Henuz veri yok</div>
          )}
        </div>

        <div className="analytics__card analytics__card--small glass-card">
          <h2 className="analytics__card-title">Durus Skoru</h2>
          {postureStats ? (
            <div className="analytics__stats">
              <div
                className="analytics__stat-circle"
                style={{
                  background: `conic-gradient(#10B981 ${postureStats.goodPercentage * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                }}
              >
                <span className="analytics__stat-value">{postureStats.goodPercentage}%</span>
              </div>
              <p className="analytics__stat-label">Duzgun Durus</p>
              <p className="analytics__stat-sub">{postureStats.totalEvents} olay</p>
            </div>
          ) : (
            <div className="analytics__empty">Veri bekleniyor</div>
          )}
        </div>

        <div className="analytics__card analytics__card--small glass-card">
          <h2 className="analytics__card-title">Mod Kullanimi</h2>
          {modeStats ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modeStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {modeStats.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1a1f36',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', color: '#94A3B8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics__empty">Veri bekleniyor</div>
          )}
        </div>
      </div>
    </div>
  );
}

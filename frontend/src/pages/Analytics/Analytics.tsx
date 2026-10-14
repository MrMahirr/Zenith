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
import { useModeCatalog } from '../../hooks/useModeCatalog';
import { isModeName } from '../../modes/modeCatalog';
import { API_URL } from '../../config';
import './Analytics.css';
import temperatureIcon from '../../assets/icons/thermometer.png';

// ─── API yanıt tipleri ───
interface SensorHistoryItem {
  createdAt: string;
  temperature: number;
  humidity: number;
  airQuality: number | null;
}

interface PostureHistoryItem {
  createdAt: string;
  isSlouching: boolean;
  slouchPercentage?: number;
}

interface SlouchLogItem {
  id: number;
  createdAt: string;
  distance: number;
}

interface PostureStats {
  totalEvents: number;
  slouchPercentage: number;
  goodPercentage: number;
}

/** `posture_update` socket olayı */
interface PostureUpdatePayload {
  isActive: boolean;
  isSlouching: boolean;
  distance?: number;
}

// ─── Grafik veri tipleri ───
interface SensorPoint {
  time: string;
  sicaklik: number;
  nem: number;
  hava: number | null;
}

interface PosturePoint {
  time: string;
  durum: number;
  slouchPercentage: number;
}

interface SlouchLogRow {
  id: number;
  time: string;
  distance: number;
}

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

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
  const { byMode } = useModeCatalog();
  const [sensorHistory, setSensorHistory] = useState<SensorPoint[]>([]);
  const [postureHistory, setPostureHistory] = useState<PosturePoint[]>([]);
  const [slouchLogs, setSlouchLogs] = useState<SlouchLogRow[]>([]);
  const [postureView, setPostureView] = useState<'chart' | 'table'>('chart');
  const [postureStats, setPostureStats] = useState<PostureStats | null>(null);
  const [modeStats, setModeStats] = useState<PieSlice[] | null>(null);
  const [hours, setHours] = useState(24);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [sRes, pRes, psRes, mRes, slRes] = await Promise.all([
          fetch(`${API_URL}/sensors/history?hours=${hours}`),
          fetch(`${API_URL}/posture/history?hours=${hours}`),
          fetch(`${API_URL}/posture/stats?hours=${hours}`),
          fetch(`${API_URL}/modes/stats?hours=${hours}`),
          fetch(`${API_URL}/posture/slouch-logs?hours=${hours}`),
        ]);

        const sensorData: SensorHistoryItem[] = await sRes.json();
        const postureData: PostureHistoryItem[] = await pRes.json();
        const postureStatsData: PostureStats = await psRes.json();
        const modeStatsData: Record<string, number> = await mRes.json();
        const slouchLogsData: SlouchLogItem[] = await slRes.json();

        setSensorHistory(
          sensorData.map((d) => ({
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
          postureData.map((d) => ({
            time: parseSqliteDate(d.createdAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            durum: d.isSlouching ? 1 : 0,
            slouchPercentage: d.slouchPercentage ?? (d.isSlouching ? 100 : 0),
          })),
        );

        setPostureStats(postureStatsData);

        setSlouchLogs(
          slouchLogsData.map((d) => ({
            id: d.id,
            time: parseSqliteDate(d.createdAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            distance: d.distance,
          })),
        );

        const pieData: PieSlice[] = Object.entries(modeStatsData)
          .filter(([, minutes]) => minutes > 0)
          .map(([key, minutes]) => ({
            name: isModeName(key) ? byMode[key].label : key,
            value: minutes,
            color: isModeName(key) ? byMode[key].color : '#666',
          }));

        setModeStats(pieData.length > 0 ? pieData : null);
      } catch (err) {
        console.error('Analiz verileri alinamadi:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
    // Mod etiketleri/renkleri katalogdan gelir; katalog yüklenince yeniden çekmek gereksiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  useEffect(() => {
    const handlePostureUpdate = (payload: PostureUpdatePayload) => {
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

      setPostureStats((prevStats) => {
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

      if (payload.isSlouching) {
        setSlouchLogs((prev) => {
          const nowStrWithSeconds = new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const newLog = {
            id: Date.now(),
            time: nowStrWithSeconds,
            distance: payload.distance ?? 0,
          };
          return [newLog, ...prev].slice(0, 50);
        });
      }
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
          <div className="analytics__card-header">
            <h2 className="analytics__card-title">Durus Zaman Cizelgesi</h2>
            <div className="analytics__card-tabs">
              <button
                className={`analytics__card-tab ${postureView === 'chart' ? 'analytics__card-tab--active' : ''}`}
                onClick={() => setPostureView('chart')}
                type="button"
              >
                Grafik
              </button>
              <button
                className={`analytics__card-tab ${postureView === 'table' ? 'analytics__card-tab--active' : ''}`}
                onClick={() => setPostureView('table')}
                type="button"
              >
                Saniyelik Tablo
              </button>
            </div>
          </div>
          {postureView === 'chart' ? (
            postureHistory.length > 0 ? (
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
                    formatter={(value, _name, item) => {
                      const point = item?.payload as PosturePoint | undefined;
                      const pct = point?.slouchPercentage ?? (value === 1 ? 100 : 0);
                      return [`%${pct}`, 'Kambur Oranı'];
                    }}
                  />
                  <Area type="stepAfter" dataKey="durum" stroke="#EF4444" fill="url(#postureGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics__empty">Henuz veri yok</div>
            )
          ) : (
            <div className="analytics__table-container">
              {slouchLogs.length > 0 ? (
                <table className="analytics__table">
                  <thead>
                    <tr>
                      <th>Zaman (Saniyelik)</th>
                      <th>Mesafe (cm)</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slouchLogs.map((log, idx) => (
                      <tr key={log.id || idx}>
                        <td className="mono" style={{ color: '#F87171' }}>{log.time}</td>
                        <td className="mono">{log.distance ? `${(log.distance * 100).toFixed(1)} cm` : '0 cm'}</td>
                        <td>
                          <span className="analytics__badge-slouch">Kambur</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="analytics__empty">Kambur duruş tespiti bulunmuyor</div>
              )}
            </div>
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
                  {modeStats.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value} dk`}
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

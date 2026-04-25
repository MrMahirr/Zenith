import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import './Analytics.css';

const API_URL = 'http://localhost:3000/api';

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
  MEETING: 'Toplantı',
};

export function Analytics() {
  const navigate = useNavigate();
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);
  const [postureHistory, setPostureHistory] = useState<any[]>([]);
  const [postureStats, setPostureStats] = useState<any>(null);
  const [modeStats, setModeStats] = useState<any>(null);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    const fetchAll = async () => {
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

        // Sensör verilerini formatla
        setSensorHistory(
          sensorData.map((d: any) => ({
            time: new Date(d.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            sıcaklık: d.temperature,
            nem: d.humidity,
          }))
        );

        // Postür verilerini formatla
        setPostureHistory(
          postureData.map((d: any) => ({
            time: new Date(d.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            durum: d.isSlouching ? 1 : 0,
          }))
        );

        setPostureStats(postureStatsData);

        // Mod verilerini pie chart formatına çevir
        const pieData = Object.entries(modeStatsData)
          .filter(([_, v]) => (v as number) > 0)
          .map(([key, value]) => ({
            name: MODE_LABELS[key] || key,
            value: value as number,
            color: PIE_COLORS[key] || '#666',
          }));
        setModeStats(pieData.length > 0 ? pieData : null);
      } catch (err) {
        console.error('Analiz verileri alınamadı:', err);
      }
    };

    fetchAll();
  }, [hours]);

  return (
    <div className="analytics">
      {/* Header */}
      <header className="analytics__header">
        <button className="analytics__back" onClick={() => navigate('/')} id="back-btn">
          ‹ Dashboard
        </button>
        <h1 className="analytics__title">📊 İstatistikler</h1>
        <div className="analytics__filter">
          {[6, 12, 24, 48].map((h) => (
            <button
              key={h}
              className={`analytics__filter-btn ${hours === h ? 'analytics__filter-btn--active' : ''}`}
              onClick={() => setHours(h)}
            >
              {h}s
            </button>
          ))}
        </div>
      </header>

      {/* Charts Grid */}
      <div className="analytics__grid">
        {/* Sıcaklık & Nem Grafiği */}
        <div className="analytics__card glass-card">
          <h2 className="analytics__card-title">🌡️ Sıcaklık & Nem</h2>
          {sensorHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
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
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: '#1a1f36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Area type="monotone" dataKey="sıcaklık" stroke="#F97316" fill="url(#tempGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="nem" stroke="#06B6D4" fill="url(#humGrad)" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics__empty">Henüz veri yok</div>
          )}
        </div>

        {/* Duruş Analizi Zaman Çizelgesi */}
        <div className="analytics__card glass-card">
          <h2 className="analytics__card-title">🧍 Duruş Zaman Çizelgesi</h2>
          {postureHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
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
                  tickFormatter={(v) => (v === 1 ? 'Kambur' : 'Düzgün')}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1f36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: any) => [v === 1 ? 'Kambur' : 'Düzgün', 'Duruş']}
                />
                <Area type="stepAfter" dataKey="durum" stroke="#EF4444" fill="url(#postureGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="analytics__empty">Henüz veri yok</div>
          )}
        </div>

        {/* Duruş İstatistikleri */}
        <div className="analytics__card analytics__card--small glass-card">
          <h2 className="analytics__card-title">✅ Duruş Skoru</h2>
          {postureStats ? (
            <div className="analytics__stats">
              <div className="analytics__stat-circle" style={{
                background: `conic-gradient(#10B981 ${postureStats.goodPercentage * 3.6}deg, rgba(255,255,255,0.05) 0deg)`
              }}>
                <span className="analytics__stat-value">{postureStats.goodPercentage}%</span>
              </div>
              <p className="analytics__stat-label">Düzgün Duruş</p>
              <p className="analytics__stat-sub">{postureStats.totalEvents} olay</p>
            </div>
          ) : (
            <div className="analytics__empty">Veri bekleniyor</div>
          )}
        </div>

        {/* Mod Kullanımı Pie Chart */}
        <div className="analytics__card analytics__card--small glass-card">
          <h2 className="analytics__card-title">🎯 Mod Kullanımı</h2>
          {modeStats ? (
            <ResponsiveContainer width="100%" height={160}>
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
                  contentStyle={{ background: '#1a1f36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
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

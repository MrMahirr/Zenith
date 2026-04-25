import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000'); // NestJS Backend adresi

const MODES = {
  PASSIVE: { name: 'serbest', color: 'bg-slate-100 text-slate-800', accent: 'border-slate-300' },
  FOCUS: { name: 'Odak Modu', color: 'bg-blue-900 text-white', accent: 'border-blue-400' },
  RELAX: { name: 'Relax Modu', color: 'bg-amber-100 text-amber-900', accent: 'border-amber-400' },
  MEETING: { name: 'Toplantı Modu', color: 'bg-red-900 text-white', accent: 'border-red-400' },
  CODING: { name: 'Kodlama Modu', color: 'bg-emerald-950 text-emerald-400', accent: 'border-emerald-500' },
};

function App() {
  const [mode, setMode] = useState('PASSIVE');
  const [time, setTime] = useState(new Date());
  
  // Sensör verileri
  const [sensorData, setSensorData] = useState({ temp: '--', humidity: '--', airQuality: 'İyi' });

  // Duruş Analizi State'i
  const [posture, setPosture] = useState({ isSlouching: false, statusText: 'Analiz Bekleniyor...' });

  useEffect(() => {
    // Saat Güncelleme
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // NestJS'den NFC verisi geldiğinde mod değiştir
    socket.on('nfc_mode_change', (newMode: string) => {
      if (MODES[newMode as keyof typeof MODES]) setMode(newMode);
    });

    // NestJS'den gelen CANLI sensör verilerini yakala
    socket.on('dashboard_sensor_data', (data) => {
      setSensorData(prev => ({
        ...prev,
        temp: data.temp,
        humidity: data.humidity
      }));
    });

    // Kameradan gelen duruş analizi verisini yakala
    socket.on('posture_update', (data) => {
      setPosture({
        isSlouching: data.isSlouching,
        statusText: data.isSlouching ? 'Kambur Duruş' : 'Düzgün Duruş'
      });
    });

    return () => {
      clearInterval(timer);
      socket.off('nfc_mode_change');
      socket.off('dashboard_sensor_data');
      socket.off('posture_update');
    };
  }, []);

  const currentTheme = MODES[mode as keyof typeof MODES];

  return (
    <div className={`h-screen w-full transition-colors duration-700 p-8 flex flex-col justify-between ${currentTheme.color}`}>
      
      {/* Üst Kısım: Saat (Sol), Duruş Barı (Orta), Hava Durumu (Sağ) */}
      <div className="flex justify-between items-start w-full">
        
        {/* Sol: Saat */}
        <div className="flex-1">
          <h1 className="text-6xl font-bold tracking-tighter">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </h1>
          <p className="text-xl opacity-80">{time.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* Orta: Duruş Analizi Barı (Merkezlenmiş ve Kompakt) */}
        <div className="flex-1 flex justify-center">
          <div className={`backdrop-blur-md bg-white/10 p-4 rounded-2xl border-t-4 transition-all duration-500 min-w-[320px] ${posture.isSlouching ? 'border-red-500 shadow-[0_10px_20px_rgba(239,68,68,0.15)]' : 'border-emerald-500'}`}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-[11px] uppercase opacity-70 font-bold tracking-widest flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${posture.isSlouching ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${posture.isSlouching ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                </span>
                Kamera Postür
              </p>
              <p className={`text-sm font-black transition-colors duration-500 ${posture.isSlouching ? 'text-red-500' : 'text-emerald-500'}`}>
                {posture.statusText}
              </p>
            </div>
            {/* Yatay Durum Çizgisi */}
            <div className="w-full bg-black/5 rounded-full h-1 overflow-hidden">
              <div className={`h-full transition-all duration-500 ${posture.isSlouching ? 'w-full bg-red-500' : 'w-full bg-emerald-500'}`}></div>
            </div>
          </div>
        </div>

        {/* Sağ: Hava Durumu */}
        <div className="flex-1 text-right">
          <p className="text-2xl font-medium">İzmir, 22°C</p>
          <p className="opacity-70">Güneşli</p>
        </div>

      </div>

      {/* Orta Kısım: Mevcut Mod Görünümü */}
      <div className="flex flex-col items-center">
        <div className={`border-l-8 pl-6 py-4 ${currentTheme.accent}`}>
          <p className="text-sm uppercase tracking-[0.3em] opacity-60">Aktif Mod</p>
          <h2 className="text-8xl font-black italic uppercase tracking-tight">{currentTheme.name}</h2>
        </div>
      </div>

      {/* Alt Kısım: Orijinal Sensör Kartları (3'lü Grid) */}
      <div className="grid grid-cols-3 gap-8 max-w-4xl">
        <div className="backdrop-blur-md bg-white/10 p-6 rounded-2xl">
          <p className="text-xs uppercase opacity-50 mb-1">Oda Sıcaklığı</p>
          <p className="text-3xl font-bold">{sensorData.temp}°C</p>
        </div>
        
        <div className="backdrop-blur-md bg-white/10 p-6 rounded-2xl">
          <p className="text-xs uppercase opacity-50 mb-1">Nem Oranı</p>
          <p className="text-3xl font-bold">%{sensorData.humidity}</p>
        </div>

        <div className="backdrop-blur-md bg-white/10 p-6 rounded-2xl">
          <p className="text-xs uppercase opacity-50 mb-1">Hava Kalitesi</p>
          <p className="text-3xl font-bold">{sensorData.airQuality}</p>
        </div>
      </div>

    </div>
  );
}

export default App;
import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export interface SensorData {
  temp: number | null;
  humidity: number | null;
  pressure: number | null;
  airQuality: number | null;
  gasVoltage: number | null;
}

/** BME280 sensör verilerini WebSocket üzerinden dinleyen hook */
export function useSensorData() {
  const socket = useSocket();
  const [data, setData] = useState<SensorData>({
    temp: null,
    humidity: null,
    pressure: null,
    airQuality: null,
    gasVoltage: null,
  });

  useEffect(() => {
    const handler = (payload: {
      temp: number;
      humidity: number;
      pressure: number;
      air_quality: number;
      gas_voltage: number;
    }) => {
      setData({
        temp: payload.temp,
        humidity: payload.humidity,
        pressure: payload.pressure,
        airQuality: payload.air_quality,
        gasVoltage: payload.gas_voltage,
      });
    };

    socket.on('dashboard_sensor_data', handler);
    return () => { socket.off('dashboard_sensor_data', handler); };
  }, [socket]);

  return data;
}

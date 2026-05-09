import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

export interface LedState {
  color: string;
  brightness: number;
  isOn: boolean;
  mode: 'manual' | 'auto';
}

export function useLed() {
  const socket = useSocket();
  const [state, setState] = useState<LedState>({
    color: '#000000',
    brightness: 128,
    isOn: false,
    mode: 'auto',
  });

  useEffect(() => {
    // Component mount olduğunda backend'den son durumu iste
    socket.emit('led_get_state');

    const handleStateSync = (newState: LedState) => {
      setState(newState);
    };

    socket.on('led_state_sync', handleStateSync);

    return () => {
      socket.off('led_state_sync', handleStateSync);
    };
  }, [socket]);

  const setManual = (color: string, brightness: number) => {
    socket.emit('led_manual', { color, brightness });
  };

  const setAuto = () => {
    socket.emit('led_auto');
  };

  const turnOff = () => {
    socket.emit('led_off');
  };

  const setBrightness = (brightness: number) => {
    socket.emit('led_set_brightness', { brightness });
  };

  return {
    state,
    setManual,
    setAuto,
    turnOff,
    setBrightness,
  };
}

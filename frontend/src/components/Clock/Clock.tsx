import { useClock } from '../../hooks/useClock';
import './Clock.css';

export function Clock() {
  const { formattedTime, formattedSeconds, formattedDate } = useClock();

  return (
    <div className="clock">
      <div className="clock__time">
        <span className="clock__digits">{formattedTime}</span>
        <span className="clock__seconds">{formattedSeconds}</span>
      </div>
      <p className="clock__date">{formattedDate}</p>
    </div>
  );
}

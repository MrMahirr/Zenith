import type { PostureData } from '../../hooks/usePosture';
import { useNavigate } from 'react-router-dom';
import './PostureAlert.css';

interface Props {
  posture: PostureData;
}

export function PostureAlert({ posture }: Props) {
  const navigate = useNavigate();
  const stateClass = !posture.isActive
    ? 'posture-alert--inactive'
    : posture.isSlouching
      ? 'posture-alert--danger'
      : 'posture-alert--good';

  return (
    <div
      className={`posture-alert glass-card ${stateClass}`}
      onClick={() => navigate('/camera')}
      role="button"
      tabIndex={0}
      id="posture-alert-btn"
    >
      <div className="posture-alert__indicator">
        <div className="posture-alert__dot" />
      </div>
      <div className="posture-alert__info">
        <span className="posture-alert__label">Durus Analizi</span>
        <span className="posture-alert__status">{posture.statusText}</span>
      </div>
      <div className="posture-alert__chevron">{'>'}</div>
    </div>
  );
}

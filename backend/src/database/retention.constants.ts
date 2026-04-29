const DEFAULT_RAW_RETENTION_HOURS = 24;
const DEFAULT_MAX_HISTORY_POINTS = 100;

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const RAW_RETENTION_HOURS = readPositiveNumber(
  process.env.RAW_RETENTION_HOURS,
  DEFAULT_RAW_RETENTION_HOURS,
);

export const MAX_HISTORY_POINTS = readPositiveNumber(
  process.env.MAX_HISTORY_POINTS,
  DEFAULT_MAX_HISTORY_POINTS,
);

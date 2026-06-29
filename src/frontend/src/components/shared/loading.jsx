const WAVE_PATH = "M0 30 Q 25 5, 50 30 Q 75 55, 100 30 Q 125 5, 150 30 Q 175 55, 200 30";
const GRADIENT_ID_PREFIX = "waveGrad";

export default function WaveLoader({
  width = 50,
  height = 50,
  strokeWidth = 4,
  duration = "2s",
  color1 = "#12b5e0",
  color2 = "#5b2d8e",
  trackColor = "rgba(255,255,255,0.05)",
  className = "",
  style = {},
}) {
  // unique gradient id to avoid collisions when used multiple times on same page
  const gradId = `${GRADIENT_ID_PREFIX}-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 60"
      fill="none"
      className={className}
      style={style}
      aria-label="Loading…"
      role="status"
    >
      {/* Ghost track */}
      <path
        d={WAVE_PATH}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />

      {/* Animated gradient stroke */}
      <path
        d={WAVE_PATH}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="320"
        strokeDashoffset="320"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="320"
          to="-320"
          dur={duration}
          repeatCount="indefinite"
        />
      </path>

      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
    </svg>
  );
}

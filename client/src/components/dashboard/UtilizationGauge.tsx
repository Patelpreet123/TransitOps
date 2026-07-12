interface UtilizationGaugeProps {
  value: number;
}

export function UtilizationGauge({ value }: UtilizationGaugeProps) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (value / 100) * circumference;

  let status = "Balanced";
  if (value >= 85) status = "High load";
  else if (value <= 55) status = "Underused";

  return (
    <section className="utilization-panel">
      <div className="panel-heading">
        <h3>Fleet Utilization</h3>
        <p>Capacity vs. demand across filtered fleet</p>
      </div>

      <div className="gauge-wrap">
        <svg className="gauge-svg" viewBox="0 0 128 128" role="img" aria-label={`Fleet utilization ${value}%`}>
          <circle className="gauge-track" cx="64" cy="64" r="54" />
          <circle
            className="gauge-progress"
            cx="64"
            cy="64"
            r="54"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-value">{value}%</span>
          <span className="gauge-status">{status}</span>
        </div>
      </div>

      <div className="gauge-legend">
        <div>
          <span className="legend-swatch low" />
          Under 55%
        </div>
        <div>
          <span className="legend-swatch mid" />
          55–84%
        </div>
        <div>
          <span className="legend-swatch high" />
          85%+
        </div>
      </div>
    </section>
  );
}

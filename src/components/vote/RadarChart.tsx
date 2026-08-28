import { CATEGORIES, type CategoryId } from "./types";

interface Props {
  counts: Record<CategoryId, number>;
  /** Field average per category — drawn as a dashed ghost behind the shape. */
  average: Record<CategoryId, number>;
  /** Highest single-category score in the field; the outer ring. */
  max: number;
  drinkName: string;
}

const CX = 120;
const CY = 96;
const R = 58;
const LABEL_R = 86;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function polygon(values: Record<CategoryId, number>, max: number): string {
  return CATEGORIES.map((c) => {
    const frac = max > 0 ? Math.min(values[c.id] / max, 1) : 0;
    const [x, y] = point(c.angle, R * frac);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function ring(frac: number): string {
  return CATEGORIES.map((c) => {
    const [x, y] = point(c.angle, R * frac);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function RadarChart({ counts, average, max, drinkName }: Props) {
  // A zero scale would collapse every shape onto the centre; floor it at 1.
  const scale = Math.max(max, 1);

  const summary = CATEGORIES.map((c) => `${c.label}: ${counts[c.id]}`).join(", ");

  return (
    <svg
      viewBox="0 0 240 200"
      width="100%"
      role="img"
      aria-label={`${drinkName} — ${summary}. Outer ring is ${scale} votes.`}
      style={{ display: "block", maxWidth: 320, margin: "0 auto" }}
    >
      {/* grid */}
      {RINGS.map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke="#201e1d"
          strokeOpacity={f === 1 ? 0.28 : 0.13}
          strokeWidth="1"
        />
      ))}

      {/* spokes, inked per category */}
      {CATEGORIES.map((c) => {
        const [x, y] = point(c.angle, R);
        return (
          <line
            key={c.id}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke={c.ink}
            strokeOpacity={0.55}
            strokeWidth="1"
          />
        );
      })}

      {/* field average — the pack */}
      <polygon
        points={polygon(average, scale)}
        fill="none"
        stroke="#9b9797"
        strokeWidth="1.25"
        strokeDasharray="3 3"
      />

      {/* this drink */}
      <polygon
        points={polygon(counts, scale)}
        fill="#201e1d"
        fillOpacity={0.09}
        stroke="#201e1d"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {/* vertex marks — dark hairline so the yellow plate stays visible on paper */}
      {CATEGORIES.map((c) => {
        const frac = scale > 0 ? Math.min(counts[c.id] / scale, 1) : 0;
        const [x, y] = point(c.angle, R * frac);
        return (
          <circle
            key={c.id}
            cx={x}
            cy={y}
            r={5}
            fill={c.ink}
            stroke="#201e1d"
            strokeWidth="1"
          />
        );
      })}

      {/* labels + counts */}
      {CATEGORIES.map((c) => {
        const [lx, ly] = point(c.angle, LABEL_R);
        const isTop = c.angle === -90;
        return (
          <g key={c.id} textAnchor="middle">
            <text
              x={lx}
              y={isTop ? ly + 2 : ly}
              fontSize="10"
              letterSpacing="0.1em"
              fill={c.inkText}
              fontFamily="var(--font-heading), Georgia, serif"
            >
              {c.label.replace("Best ", "").toUpperCase()}
            </text>
            <text
              x={lx}
              y={isTop ? ly + 19 : ly + 17}
              fontSize="17"
              fontWeight="600"
              fill="#201e1d"
              fontFamily="var(--font-heading), Georgia, serif"
            >
              {counts[c.id]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

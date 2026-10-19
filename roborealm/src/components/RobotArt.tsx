import { CHASSIS, MOUNTS, SENSORS } from "@/robots/components";
import { accessoryOf, paintColor, type RobotDesign } from "@/robots/design";

/** Friendly front-facing portrait of a robot design. */
export function RobotPortrait({ d, size = 120, title }: { d: RobotDesign; size?: number; title?: string }) {
  const color = paintColor(d);
  const acc = accessoryOf(d)?.id;
  const chassis = CHASSIS.find((c) => c.id === d.chassis);
  const w = chassis?.id === "hauler" ? 70 : chassis?.id === "scout" ? 50 : 60;
  const tracks = d.drive === "tracks";
  const big = d.drive === "wheels-large";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title ?? `${d.name}, your robot`}>
      <ellipse cx="60" cy="108" rx={w / 1.6} ry="5" fill="#000" opacity="0.25" />
      {tracks ? (
        <rect x={60 - w / 2 - 6} y="84" width={w + 12} height="20" rx="10" fill="#334155" stroke="#1e293b" strokeWidth="3" />
      ) : (
        <>
          <circle cx={60 - w / 2} cy="94" r={big ? 13 : 10} fill="#334155" stroke="#1e293b" strokeWidth="3" />
          <circle cx={60 + w / 2} cy="94" r={big ? 13 : 10} fill="#334155" stroke="#1e293b" strokeWidth="3" />
        </>
      )}
      <rect x={60 - w / 2} y="40" width={w} height="52" rx="18" fill={color} stroke="#0b1437" strokeOpacity="0.25" strokeWidth="3" />
      <rect x={60 - w / 2 + 8} y="50" width={w - 16} height="24" rx="10" fill="#0b1437" />
      <circle cx="50" cy="62" r="4" fill="#6EE7B7" />
      <circle cx="70" cy="62" r="4" fill="#6EE7B7" />
      <path d="M53 69 Q60 73 67 69" stroke="#6EE7B7" strokeWidth="2" fill="none" strokeLinecap="round" />
      {d.sensors.some((s) => SENSORS.find((p) => p.id === s.part)?.kind === "distance" && MOUNTS[s.mount].angleDeg === 0) && (
        <g>
          <circle cx="52" cy="83" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
          <circle cx="68" cy="83" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        </g>
      )}
      {d.gripper && (
        <g stroke="#475569" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d={`M${60 - w / 2} 70 L${60 - w / 2 - 12} 76 L${60 - w / 2 - 8} 86`} />
          <path d={`M${60 + w / 2} 70 L${60 + w / 2 + 12} 76 L${60 + w / 2 + 8} 86`} />
        </g>
      )}
      {acc === "acc-antenna" && (
        <g>
          <line x1="60" y1="40" x2="60" y2="22" stroke="#475569" strokeWidth="3" />
          <circle cx="60" cy="19" r="5" fill="#FDE68A" />
        </g>
      )}
      {acc === "acc-visor" && <rect x={60 - w / 2 + 4} y="48" width={w - 8} height="10" rx="5" fill="#7DD3FC" opacity="0.8" />}
      {acc === "acc-crown" && <path d="M44 40 L48 26 L54 36 L60 22 L66 36 L72 26 L76 40 Z" fill="#FDE68A" stroke="#b45309" strokeWidth="1.5" />}
    </svg>
  );
}

/** Top-down engineering view used in the workshop: shows sensor mounts, beams and wheel layout. */
export function RobotTopDown({ d, rotation = 0, size = 260 }: { d: RobotDesign; rotation?: number; size?: number }) {
  const chassis = CHASSIS.find((c) => c.id === d.chassis);
  const r = (chassis?.radius ?? 0.15) * 400; // px per metre in this view
  const wb = (chassis?.wheelBase ?? 0.24) * 400;
  const color = paintColor(d);
  const tracks = d.drive === "tracks";
  return (
    <svg viewBox="-150 -150 300 300" width={size} height={size} role="img" aria-label={`Top-down view of ${d.name}, rotated ${rotation} degrees`}>
      <circle r="140" fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
      <g transform={`rotate(${-rotation})`}>
        {d.sensors.map((s, i) => {
          const part = SENSORS.find((p) => p.id === s.part);
          if (part?.kind !== "distance") return null;
          const a = (MOUNTS[s.mount].angleDeg * Math.PI) / 180;
          const len = Math.min(135, r + part.range * 30);
          const spread = 0.18;
          const p = (ang: number, l: number) => `${Math.cos(ang) * l},${-Math.sin(ang) * l}`;
          return (
            <polygon key={i} points={`${p(a, r)} ${p(a - spread, len)} ${p(a + spread, len)}`} fill={part.id === "lidar-point" ? "#F472B6" : "#7DD3FC"} opacity="0.22" />
          );
        })}
        <circle r={r} fill={color} stroke="#0b1437" strokeOpacity="0.4" strokeWidth="3" />
        {[-1, 1].map((side) => (
          <rect
            key={side}
            x={tracks ? -r * 0.9 : -r * 0.45}
            y={side * (wb / 2) - (tracks ? 14 : 10)}
            width={tracks ? r * 1.8 : r * 0.9}
            height={tracks ? 28 : 20}
            rx="6"
            fill="#334155" opacity="0.9"
            stroke="#0f172a"
            strokeWidth="2"
          />
        ))}
        <circle r={r * 0.45} fill="#0b1437" opacity="0.85" />
        <text textAnchor="middle" y="5" fontSize="14" fill="#6EE7B7" fontWeight="700">
          CPU
        </text>
        <polygon points={`${r - 4},0 ${r - 22},-10 ${r - 22},10`} fill="#0b1437" opacity="0.6" />
        {d.sensors.map((s, i) => {
          const a = (MOUNTS[s.mount].angleDeg * Math.PI) / 180;
          const part = SENSORS.find((p) => p.id === s.part);
          const x = Math.cos(a) * (r - 6);
          const y = -Math.sin(a) * (r - 6);
          return (
            <g key={i}>
              <rect x={x - 8} y={y - 8} width="16" height="16" rx="4" fill={part?.kind === "touch" ? "#FDBA9A" : part?.kind === "floor" ? "#FDE68A" : "#e2e8f0"} stroke="#0b1437" strokeWidth="2" />
            </g>
          );
        })}
        {d.gripper && (
          <g stroke="#94a3b8" strokeWidth="6" strokeLinecap="round">
            <line x1={r} y1={-14} x2={r + 26} y2={-10} />
            <line x1={r} y1={14} x2={r + 26} y2={10} />
          </g>
        )}
      </g>
    </svg>
  );
}

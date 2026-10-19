import type { AvatarConfig } from "@/progress/types";

export const SKINS = ["#F9D7C3", "#EDB98A", "#D08B5B", "#AE5D29", "#7A4321", "#4A2A16"];
export const HAIR_COLORS = ["#1F1A17", "#5B3A29", "#B5651D", "#E6BE8A", "#A78BFA", "#7DD3FC", "#F472B6"];
export const OUTFITS = ["#A78BFA", "#7DD3FC", "#6EE7B7", "#FDBA9A", "#FDE68A", "#F472B6"];
export const HAIRS: AvatarConfig["hair"][] = ["short", "curly", "long", "buns", "shaved"];
export const AVATAR_ACCESSORIES: AvatarConfig["accessory"][] = ["none", "goggles", "headset", "cap"];

export const defaultAvatar = (): AvatarConfig => ({
  skin: SKINS[2],
  hair: "curly",
  hairColor: HAIR_COLORS[0],
  outfit: OUTFITS[0],
  accessory: "goggles",
});

/** Stylised, non-photographic player avatar (no real photos are ever collected). */
export function Avatar({ a, size = 96, title }: { a: AvatarConfig; size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? "Player avatar"}>
      <circle cx="50" cy="50" r="48" fill="#1e2a5e" />
      <path d="M18 100 C20 74 34 66 50 66 C66 66 80 74 82 100 Z" fill={a.outfit} />
      <path d="M42 66 L50 76 L58 66" fill="none" stroke="#0b1437" strokeWidth="2" opacity="0.4" />
      <rect x="44" y="56" width="12" height="12" rx="4" fill={a.skin} />
      {a.hair === "long" && <path d="M26 44 C26 20 74 20 74 44 L76 72 L24 72 Z" fill={a.hairColor} />}
      <circle cx="50" cy="42" r="20" fill={a.skin} />
      {a.hair === "short" && <path d="M30 40 C30 20 70 18 70 40 C64 30 40 28 30 40 Z" fill={a.hairColor} />}
      {a.hair === "curly" &&
        [32, 40, 48, 56, 64, 36, 60, 68, 30].map((x, i) => (
          <circle key={i} cx={x} cy={i > 4 ? 30 : 25 + (i % 2) * 2} r="7" fill={a.hairColor} />
        ))}
      {a.hair === "long" && <path d="M30 40 C30 18 70 18 70 40 C62 28 38 28 30 40 Z" fill={a.hairColor} />}
      {a.hair === "buns" && (
        <>
          <circle cx="32" cy="22" r="8" fill={a.hairColor} />
          <circle cx="68" cy="22" r="8" fill={a.hairColor} />
          <path d="M30 40 C30 20 70 20 70 40 C62 30 38 30 30 40 Z" fill={a.hairColor} />
        </>
      )}
      {a.hair === "shaved" && <path d="M31 36 C33 22 67 22 69 36 C60 30 40 30 31 36 Z" fill={a.hairColor} opacity="0.55" />}
      <circle cx="43" cy="44" r="2.6" fill="#0b1437" />
      <circle cx="57" cy="44" r="2.6" fill="#0b1437" />
      <path d="M44 51 Q50 56 56 51" stroke="#0b1437" strokeWidth="2" fill="none" strokeLinecap="round" />
      {a.accessory === "goggles" && (
        <g>
          <rect x="31" y="31" width="38" height="6" rx="3" fill="#334155" />
          <circle cx="42" cy="34" r="5" fill="#7DD3FC" stroke="#334155" strokeWidth="2" />
          <circle cx="58" cy="34" r="5" fill="#7DD3FC" stroke="#334155" strokeWidth="2" />
        </g>
      )}
      {a.accessory === "headset" && (
        <g fill="none" stroke="#334155" strokeWidth="3">
          <path d="M29 44 C29 18 71 18 71 44" />
          <rect x="25" y="40" width="7" height="12" rx="3" fill="#6EE7B7" />
          <rect x="68" y="40" width="7" height="12" rx="3" fill="#6EE7B7" />
        </g>
      )}
      {a.accessory === "cap" && <path d="M29 34 C30 18 70 18 71 34 L82 36 C82 38 70 38 29 36 Z" fill="#FDBA9A" />}
    </svg>
  );
}

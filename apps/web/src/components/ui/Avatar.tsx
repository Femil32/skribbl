import { cn } from "@/lib/utils";

type AvatarMood = "smile" | "wink" | "sleepy";

const AVATAR_COLORS = [
  "#ff6b6b",
  "#ffd93d",
  "#6bcb77",
  "#4d96ff",
  "#c084fc",
  "#fb923c",
  "#f472b6",
  "#22d3ee",
  "#a3e635",
  "#facc15",
  "#fb7185",
  "#34d399",
] as const;

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function MoodPath({ mood }: { mood: AvatarMood }) {
  switch (mood) {
    case "smile":
      return (
        <>
          <circle cx="14" cy="18" r="2" fill="#1a1714" />
          <circle cx="26" cy="18" r="2" fill="#1a1714" />
          <path d="M13 25 q7 7 14 0" stroke="#1a1714" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    case "wink":
      return (
        <>
          <circle cx="14" cy="18" r="2" fill="#1a1714" />
          <path d="M22 18 l5 0" stroke="#1a1714" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13 25 q7 7 14 0" stroke="#1a1714" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M12 18 l5 0 M22 18 l5 0" stroke="#1a1714" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 28 q6 -2 12 0" stroke="#1a1714" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

interface AvatarProps {
  /** Player name used to deterministically pick color */
  name: string;
  mood?: AvatarMood;
  isHost?: boolean;
  size?: number;
  className?: string;
  /** Override auto-picked color */
  color?: string;
}

export function Avatar({
  name,
  mood = "smile",
  isHost = false,
  size = 40,
  className,
  color,
}: AvatarProps) {
  const fill = color ?? getAvatarColor(name);
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-label={name}>
        <circle cx="20" cy="20" r="18" fill={fill} stroke="#1a1714" strokeWidth="2" />
        <MoodPath mood={mood} />
      </svg>
      {isHost && (
        <span
          className="absolute -top-2 -right-1.5 text-sm leading-none"
          style={{ transform: "rotate(15deg)" }}
          aria-label="host"
        >
          👑
        </span>
      )}
    </span>
  );
}

export { AVATAR_COLORS, getAvatarColor };

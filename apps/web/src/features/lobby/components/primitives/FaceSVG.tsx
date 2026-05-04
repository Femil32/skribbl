type Mood = "smile" | "wink" | "sleepy";

type FaceSVGProps = {
  color?: string;
  size?: number;
  mood?: Mood;
  stroke?: string;
};

export function FaceSVG({
  color = "#ffd93d",
  size = 40,
  mood = "smile",
  stroke = "#1a1714",
}: FaceSVGProps) {
  const eyes =
    mood === "wink" ? (
      <>
        <circle cx="14" cy="18" r="2" fill={stroke} />
        <path d="M22 18 l5 0" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      </>
    ) : mood === "sleepy" ? (
      <path d="M12 18 l5 0 M22 18 l5 0" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
    ) : (
      <>
        <circle cx="14" cy="18" r="2" fill={stroke} />
        <circle cx="26" cy="18" r="2" fill={stroke} />
      </>
    );

  const mouth =
    mood === "sleepy" ? (
      <path d="M14 28 q6 -2 12 0" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M13 25 q7 7 14 0" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
    );

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" fill={color} stroke={stroke} strokeWidth="2" />
      {eyes}
      {mouth}
    </svg>
  );
}

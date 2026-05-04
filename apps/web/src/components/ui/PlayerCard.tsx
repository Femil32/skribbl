import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

type PlayerStatus = "ready" | "idle" | "drawing" | "offline";

const statusColor: Record<PlayerStatus, string> = {
  ready: "#2a8f4a",
  idle: "#d97a3a",
  drawing: "#5b8def",
  offline: "#aaa",
};

interface PlayerCardProps {
  name: string;
  status?: PlayerStatus;
  ping?: number;
  isYou?: boolean;
  isHost?: boolean;
  score?: number;
  onKick?: () => void;
  className?: string;
  tilt?: number;
}

export function PlayerCard({
  name,
  status = "idle",
  ping,
  isYou = false,
  isHost = false,
  onKick,
  className,
  tilt = 0,
}: PlayerCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-[14px] border-[2.5px] border-[#1a1714] shadow-skribbl-sm w-40",
        isYou ? "bg-tomato" : "bg-sk-panel2",
        className
      )}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <Avatar name={name} isHost={isHost} size={36} />
      <div className="min-w-0 flex-1">
        <div className="font-extrabold text-[13px] truncate">
          {name}
          {isYou && (
            <span className="font-semibold opacity-70 ml-1">· you</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] opacity-70">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: statusColor[status] }}
          />
          {status}
          {ping != null && ` · ${ping}ms`}
        </div>
      </div>
      {onKick && (
        <button
          onClick={onKick}
          className="w-[22px] h-[22px] rounded-[6px] border-[1.5px] border-[#1a1714] bg-transparent text-xs font-extrabold flex items-center justify-center shrink-0 cursor-pointer hover:bg-black/10"
          aria-label={`Kick ${name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function EmptyPlayerSlot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-40 h-[62px] rounded-[14px] border-2 border-dashed border-[#1a1714]/35 flex items-center justify-center text-label text-[#1a1714]/35",
        className
      )}
    >
      empty
    </div>
  );
}

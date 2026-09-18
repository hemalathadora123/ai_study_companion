export default function ProgressBar({
  value,
  max = 100,
  showLabel = true,
  size = "md",
  color,
}: {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: string;
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  // Determine color theme based on score or explicit color prop
  let barColor = "bg-rose-500";
  let textColor = "text-rose-600";
  if (color) {
    if (color.startsWith("bg-")) {
      barColor = color;
    } else if (color === "amber") {
      barColor = "bg-amber-500";
      textColor = "text-amber-600";
    } else if (color === "indigo") {
      barColor = "bg-indigo-600";
      textColor = "text-indigo-600";
    } else if (color === "emerald") {
      barColor = "bg-emerald-500";
      textColor = "text-emerald-600";
    } else {
      barColor = `bg-${color}-500`;
    }
  } else {
    if (percentage >= 75) {
      barColor = "bg-emerald-500";
      textColor = "text-emerald-600";
    } else if (percentage >= 50) {
      barColor = "bg-indigo-600";
      textColor = "text-indigo-600";
    } else if (percentage >= 30) {
      barColor = "bg-amber-500";
      textColor = "text-amber-600";
    }
  }

  const heightClass = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        {showLabel && (
          <span className={`text-xs font-semibold ${textColor}`}>
            {percentage}%
          </span>
        )}
      </div>
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${heightClass} rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

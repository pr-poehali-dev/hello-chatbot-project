import { useState } from "react";
import Icon from "@/components/ui/icon";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Achievement = {
  id: string;
  unlocked: boolean;
  medal: string;       // emoji или символ внутри медали
  medalNum?: number;   // номер на медали (для цикловых)
  title: string;
  subtitle: string;
  description: string;
  cta: { icon: string; label: string }[];
  color: string;       // accent color
  glow: string;        // glow rgba
  unlockedAt?: string; // дата получения (строка)
};

// ─────────────────────────────────────────────────────────────
// MEDAL SVG
// ─────────────────────────────────────────────────────────────

function Medal({
  num, color, glow, unlocked, size = 96,
}: {
  num?: number; color: string; glow: string; unlocked: boolean; size?: number;
}) {
  const r = size / 2;
  const innerR = r * 0.72;
  const ribbonH = size * 0.28;

  return (
    <div style={{ width: size, height: size + ribbonH, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size + ribbonH} style={{ filter: unlocked ? `drop-shadow(0 0 12px ${glow})` : "none" }}>
        {/* Ribbon left */}
        <rect x={r - 10} y={0} width={8} height={ribbonH + 4} rx={3}
          fill={unlocked ? color : "#6b728040"} opacity={0.85} />
        {/* Ribbon right */}
        <rect x={r + 2} y={0} width={8} height={ribbonH + 4} rx={3}
          fill={unlocked ? color : "#6b728040"} opacity={0.65} />

        {/* Medal body — outer ring */}
        <circle cx={r} cy={r + ribbonH} r={r - 2}
          fill={unlocked ? color + "22" : "hsl(var(--muted))"}
          stroke={unlocked ? color : "#6b728050"}
          strokeWidth={size * 0.045}
        />
        {/* Medal body — inner circle */}
        <circle cx={r} cy={r + ribbonH} r={innerR}
          fill={unlocked ? color + "18" : "transparent"}
        />
        {/* Star burst lines */}
        {unlocked && [0, 45, 90, 135].map(angle => {
          const rad = (angle * Math.PI) / 180;
          const x1 = r + Math.cos(rad) * (innerR - 4);
          const y1 = r + ribbonH + Math.sin(rad) * (innerR - 4);
          const x2 = r + Math.cos(rad) * (innerR + 4);
          const y2 = r + ribbonH + Math.sin(rad) * (innerR + 4);
          const x3 = r + Math.cos(rad + Math.PI) * (innerR - 4);
          const y3 = r + ribbonH + Math.sin(rad + Math.PI) * (innerR - 4);
          const x4 = r + Math.cos(rad + Math.PI) * (innerR + 4);
          const y4 = r + ribbonH + Math.sin(rad + Math.PI) * (innerR + 4);
          return (
            <g key={angle}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} strokeOpacity={0.4} />
              <line x1={x3} y1={y3} x2={x4} y2={y4} stroke={color} strokeWidth={1.5} strokeOpacity={0.4} />
            </g>
          );
        })}

        {/* Number or lock */}
        {unlocked && num !== undefined ? (
          <text x={r} y={r + ribbonH + 3} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.38} fontWeight="900" fill={color}
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}>
            {num}
          </text>
        ) : unlocked ? (
          <text x={r} y={r + ribbonH + 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.32}>
            ✦
          </text>
        ) : (
          <text x={r} y={r + ribbonH + 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.28} fill="#6b7280" opacity={0.5}>
            🔒
          </text>
        )}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ACHIEVEMENT CARD
// ─────────────────────────────────────────────────────────────

function AchievementCard({ a, onOpen }: { a: Achievement; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-3xl border transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
      style={{
        borderColor: a.unlocked ? a.color + "40" : "hsl(var(--border))",
        backgroundColor: a.unlocked ? a.color + "08" : "hsl(var(--card))",
        padding: "24px 24px 24px 20px",
      }}
    >
      {/* Top glow line */}
      {a.unlocked && (
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${a.color}80, transparent)` }} />
      )}

      <div className="flex items-center gap-5">
        {/* Medal */}
        <Medal num={a.medalNum} color={a.color} glow={a.glow} unlocked={a.unlocked} size={72} />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {a.unlocked && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: a.color + "25", color: a.color }}>
                Получено
              </span>
            )}
            {!a.unlocked && (
              <span className="text-xs text-muted-foreground opacity-50">Заблокировано</span>
            )}
            {a.unlockedAt && <span className="text-xs text-muted-foreground">{a.unlockedAt}</span>}
          </div>
          <p className="font-display text-lg font-bold leading-tight mb-1"
            style={{ color: a.unlocked ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
            {a.title}
          </p>
          <p className="text-sm text-muted-foreground leading-snug">{a.subtitle}</p>
        </div>

        <Icon name="ChevronRight" size={18} className="text-muted-foreground flex-shrink-0 opacity-40" />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────

function AchievementModal({ a, onClose }: { a: Achievement; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-3xl border overflow-hidden animate-fade-in"
        style={{
          backgroundColor: "hsl(var(--card))",
          borderColor: a.color + "50",
          boxShadow: `0 32px 80px ${a.glow}, 0 0 0 1px ${a.color}30`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient top */}
        <div className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${a.color}25 0%, transparent 70%)` }} />

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors z-10">
          <Icon name="X" size={16} className="text-muted-foreground" />
        </button>

        <div className="flex flex-col items-center pt-10 pb-8 px-7">
          {/* Big medal */}
          <div className="mb-2">
            <Medal num={a.medalNum} color={a.color} glow={a.glow} unlocked={a.unlocked} size={110} />
          </div>

          {/* Badge */}
          {a.unlocked && (
            <span className="text-xs font-bold px-3 py-1 rounded-full mb-4"
              style={{ backgroundColor: a.color + "25", color: a.color }}>
              ✦ Достижение разблокировано
            </span>
          )}

          {/* Title */}
          <h3 className="font-display text-2xl font-bold text-foreground text-center mb-2">{a.title}</h3>
          <p className="text-sm text-muted-foreground text-center mb-1 font-medium">{a.subtitle}</p>
          <p className="text-sm text-muted-foreground text-center leading-relaxed mb-6">{a.description}</p>

          {/* CTA buttons */}
          {a.unlocked && a.cta.length > 0 && (
            <div className="w-full space-y-2">
              {a.cta.map(btn => (
                <button key={btn.label}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-85"
                  style={{ backgroundColor: a.color + "20", color: a.color, border: `1px solid ${a.color}40` }}>
                  <Icon name={btn.icon as "BookOpen"} size={15} />
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SECTION
// ─────────────────────────────────────────────────────────────

export default function AchievementsSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  // Демо: первый цикл разблокирован
  const achievements: Achievement[] = [
    {
      id: "cycle-1",
      unlocked: true,
      medalNum: 1,
      title: "Первый цикл позади",
      subtitle: "Вы прошли первый цикл химиотерапии",
      description:
        "Это непросто — и вы справились. Первый цикл позади, а впереди — путь к выздоровлению. Расскажите о своих ощущениях в дневнике, это поможет врачу видеть вашу динамику.",
      cta: [
        { icon: "NotebookPen", label: "Записать ощущения в дневник" },
        { icon: "CalendarDays", label: "Запланировать ТМК с врачом" },
      ],
      color: "#a78bfa",
      glow: "rgba(167,139,250,0.35)",
      unlockedAt: "15 мая 2025",
    },
    {
      id: "cycle-3",
      unlocked: false,
      medalNum: 3,
      title: "Половина пути",
      subtitle: "Три цикла из шести — уже 50%",
      description: "Разблокируется после завершения третьего цикла и сдачи контрольного ПСА.",
      cta: [],
      color: "#60a5fa",
      glow: "rgba(96,165,250,0.35)",
    },
    {
      id: "cycle-6",
      unlocked: false,
      medalNum: 6,
      title: "Курс завершён",
      subtitle: "Все шесть циклов пройдены",
      description: "Разблокируется после прохождения последнего цикла и полного контроля.",
      cta: [],
      color: "#34d399",
      glow: "rgba(52,211,153,0.35)",
    },
  ];

  const openAchievement = achievements.find(a => a.id === openId);

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Ваши победы</p>
        <h2 className="font-display text-4xl text-foreground mb-2">Достижения</h2>
        <p className="text-muted-foreground text-sm">Каждый пройденный этап — это победа. Здесь хранится ваш путь.</p>
      </div>

      {/* Unlocked counter */}
      <div className="flex items-center gap-3 mb-8 px-5 py-4 rounded-2xl border"
        style={{ borderColor: "#a78bfa40", backgroundColor: "#a78bfa08" }}>
        <Medal medalNum={undefined} color="#a78bfa" glow="rgba(167,139,250,0.35)" unlocked={true} size={44} />
        <div>
          <p className="font-bold text-foreground text-lg leading-tight">
            {achievements.filter(a => a.unlocked).length} из {achievements.length}
          </p>
          <p className="text-xs text-muted-foreground">достижений разблокировано</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {achievements.map(a => (
          <AchievementCard key={a.id} a={a} onOpen={() => setOpenId(a.id)} />
        ))}
      </div>

      {/* Modal */}
      {openAchievement && (
        <AchievementModal a={openAchievement} onClose={() => setOpenId(null)} />
      )}
    </main>
  );
}

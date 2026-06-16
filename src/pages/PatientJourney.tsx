import { useState } from "react";
import Icon from "@/components/ui/icon";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type TreatmentType = "chemo" | "surgery" | "radiation" | "diagnostics" | null;

type Scheme = {
  id: string;
  name: string;
  drug: string;
  dose: string;
  cycleOptions: number[];
  cycleDays: number;
};

// ─────────────────────────────────────────────────────────────
// SCHEMES
// ─────────────────────────────────────────────────────────────

const SCHEMES: Scheme[] = [
  { id: "docetaxel", name: "Доцетаксел", drug: "Доцетаксел", dose: "75 мг/м²", cycleOptions: [6, 9], cycleDays: 21 },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ─────────────────────────────────────────────────────────────
// CYCLE DATA MODEL
// ─────────────────────────────────────────────────────────────

type CycleBlock = {
  num: number;
  bloodDate: Date;    // анализы за 3–5 дней до цикла
  infusionDate: Date; // день введения
  psaControl: boolean;
  fullControl: boolean;
  psaDate?: Date;
  imagingDates?: Date[];
};

function buildCycles(start: Date, scheme: Scheme, totalCycles: number): CycleBlock[] {
  const blocks: CycleBlock[] = [];
  let cursor = new Date(start);

  const imagingList = ["МРТ малого таза", "КТ органов грудной клетки", "УЗИ брюшной полости"];

  for (let n = 1; n <= totalCycles; n++) {
    const infusion = new Date(cursor);
    // ОАК за 3–5 дней до каждого цикла (стандарт клинической практики)
    const blood = addDays(cursor, -4);

    // После 3-го цикла — контроль ПСА
    const psaControl = n === 3 || (totalCycles === 9 && n === 6) || n === totalCycles;
    // После 6-го цикла (и при 9 после 6) — полный контроль
    const fullControl = n === 6 || (n === totalCycles && n !== 6);

    const psaDate = psaControl ? addDays(infusion, 7) : undefined;
    const imagingDates = fullControl
      ? imagingList.map((_, i) => addDays(infusion, 21 + i))
      : undefined;

    blocks.push({ num: n, bloodDate: blood, infusionDate: infusion, psaControl, fullControl, psaDate, imagingDates });
    cursor = addDays(cursor, scheme.cycleDays);
  }
  return blocks;
}

// ─────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────

const C = {
  blood:   { bg: "#1d4ed820", border: "#3b82f660", dot: "#60a5fa", text: "#93c5fd" },
  cycle:   { bg: "#6d28d920", border: "#7c3aed60", dot: "#a78bfa", text: "#c4b5fd" },
  psa:     { bg: "#92400e20", border: "#d9770660", dot: "#fbbf24", text: "#fcd34d" },
  imaging: { bg: "#065f4620", border: "#05966960", dot: "#34d399", text: "#6ee7b7" },
};

// ─────────────────────────────────────────────────────────────
// TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SVG TIMELINE CONSTANTS
// ─────────────────────────────────────────────────────────────

const COL_W = 170;       // px per cycle column
const PAD_L = 40;        // left padding
const PAD_R = 80;        // right padding (for council dot)
const AXIS_Y = 220;      // Y of main axis
const BLOOD_Y = 60;      // Y of blood labels (above)
const BLOOD_DOT_Y = 140; // Y of blood dots on axis-branch
const PSA_Y = 340;       // Y of PSA/control labels (below)
const PSA_DOT_Y = 300;   // Y of PSA dots on axis-branch
const DOT_R = 22;        // cycle dot radius
const SMALL_R = 7;       // small event dot radius
const COUNCIL_R = 14;    // council dot radius

// council — особый цвет (amber/gold)
const COUNCIL_COLOR = "#f59e0b";

function ChemoTimeline({
  scheme, cycles, startDate, onReset,
}: {
  scheme: Scheme; cycles: number; startDate: Date; onReset: () => void;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);

  const blocks = buildCycles(startDate, scheme, cycles);
  const totalTasks = blocks.length * 2 + blocks.filter(b => b.psaControl).length + blocks.filter(b => b.fullControl).length * 3;
  const donePct = totalTasks > 0 ? Math.round((done.size / totalTasks) * 100) : 0;

  const toggle = (id: string) => {
    setDone(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  };

  const tap = (id: string) => setActive(p => p === id ? null : id);

  const endDate = addDays(blocks[blocks.length - 1].infusionDate, scheme.cycleDays);

  // SVG geometry
  const svgW = PAD_L + blocks.length * COL_W + PAD_R;
  const svgH = 480;
  const cycleX = (num: number) => PAD_L + (num - 0.5) * COL_W;
  const councilX = svgW - PAD_R / 2;

  return (
    <div className="w-full px-6 py-8 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap max-w-6xl mx-auto">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Химиотерапия</p>
          <h2 className="font-display text-3xl text-foreground">{scheme.name} {scheme.dose} · {cycles} циклов</h2>
          <p className="text-sm text-muted-foreground mt-1">{fmt(startDate)} — {fmt(endDate)} · каждые {scheme.cycleDays} дней</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14">
            <svg width="56" height="56" className="-rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#a78bfa" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - donePct / 100)}`}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s" }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{donePct}%</span>
          </div>
          <button onClick={onReset} className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Новый план
          </button>
        </div>
      </div>

      {/* ── LEGEND ── */}
      <div className="flex flex-wrap gap-5 mb-6 max-w-6xl mx-auto">
        {[
          { color: C.blood.dot,    label: "Анализы крови" },
          { color: C.cycle.dot,    label: "Цикл ХТ" },
          { color: C.psa.dot,      label: "Контроль ПСА" },
          { color: C.imaging.dot,  label: "МРТ / КТ" },
          { color: COUNCIL_COLOR,  label: "Консилиум" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* ── SVG TIMELINE ── */}
      <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <svg
          width={svgW} height={svgH}
          style={{ display: "block", fontFamily: "inherit", overflow: "visible" }}
        >
          {/* ══ MAIN HORIZONTAL AXIS ══ */}
          <line
            x1={PAD_L - 16} y1={AXIS_Y} x2={svgW - 16} y2={AXIS_Y}
            stroke="hsl(var(--border))" strokeWidth={3} strokeLinecap="round"
          />

          {/* ══ PER-CYCLE ELEMENTS ══ */}
          {blocks.map(b => {
            const cx = cycleX(b.num);
            const isLast = b.num === cycles;
            const cycleId = `cycle-${b.num}`;
            const bloodId = `blood-${b.num}`;
            const psaId = `psa-${b.num}`;
            const cycleDone = done.has(cycleId);
            const bloodDone = done.has(bloodId);
            const psaDone = done.has(psaId);
            const cycleActive = active === cycleId;
            const bloodActive = active === bloodId;
            const psaActive = active === psaId;
            const hasPsa = b.psaControl || b.fullControl;
            const controlColor = b.fullControl ? C.imaging : C.psa;

            return (
              <g key={b.num}>

                {/* ── BLOOD: vertical line axis → blood dot ── */}
                <line
                  x1={cx} y1={AXIS_Y - DOT_R}
                  x2={cx} y2={BLOOD_DOT_Y + SMALL_R}
                  stroke={C.blood.dot} strokeWidth={1.5}
                  strokeDasharray="4 3" strokeOpacity={bloodDone ? 0.25 : 0.5}
                />
                {/* Blood dot on branch */}
                <circle cx={cx} cy={BLOOD_DOT_Y} r={SMALL_R}
                  fill={bloodDone ? "hsl(var(--muted))" : C.blood.dot}
                  opacity={bloodDone ? 0.4 : 1}
                />
                {/* Blood: clickable label area */}
                <g style={{ cursor: "pointer" }} onClick={() => tap(bloodId)}>
                  <rect
                    x={cx - 52} y={BLOOD_Y - 26}
                    width={104} height={48} rx={10}
                    fill={bloodDone ? "hsl(var(--muted))" : C.blood.bg}
                    stroke={bloodActive ? C.blood.dot : C.blood.border}
                    strokeWidth={bloodActive ? 2 : 1}
                    opacity={bloodDone ? 0.5 : 1}
                  />
                  <text x={cx} y={BLOOD_Y - 8} textAnchor="middle" fontSize={11} fontWeight="600"
                    fill={bloodDone ? "hsl(var(--muted-foreground))" : C.blood.text}>
                    ОАК + биохимия
                  </text>
                  <text x={cx} y={BLOOD_Y + 10} textAnchor="middle" fontSize={10}
                    fill={C.blood.dot} opacity={bloodDone ? 0.4 : 0.85}>
                    {fmt(b.bloodDate)}
                  </text>
                </g>

                {/* ── PSA / CONTROL ── */}
                {hasPsa && (
                  <>
                    {/* vertical line axis → psa dot */}
                    <line
                      x1={cx} y1={AXIS_Y + DOT_R}
                      x2={cx} y2={PSA_DOT_Y - SMALL_R}
                      stroke={controlColor.dot} strokeWidth={1.5}
                      strokeDasharray="4 3" strokeOpacity={psaDone ? 0.25 : 0.5}
                    />
                    {/* PSA dot on branch */}
                    <circle cx={cx} cy={PSA_DOT_Y} r={SMALL_R + 1}
                      fill={psaDone ? "hsl(var(--muted))" : controlColor.dot}
                      opacity={psaDone ? 0.4 : 1}
                    />
                    {/* PSA clickable label */}
                    <g style={{ cursor: "pointer" }} onClick={() => tap(psaId)}>
                      <rect
                        x={cx - 58} y={PSA_Y - 2}
                        width={116} height={b.fullControl ? 54 : 44} rx={10}
                        fill={psaDone ? "hsl(var(--muted))" : controlColor.bg}
                        stroke={psaActive ? controlColor.dot : controlColor.border}
                        strokeWidth={psaActive ? 2 : 1}
                        opacity={psaDone ? 0.5 : 1}
                      />
                      <text x={cx} y={PSA_Y + 15} textAnchor="middle" fontSize={11} fontWeight="700"
                        fill={psaDone ? "hsl(var(--muted-foreground))" : controlColor.text}>
                        {b.fullControl ? "Полный контроль" : "Контроль ПСА"}
                      </text>
                      {b.psaDate && (
                        <text x={cx} y={PSA_Y + 31} textAnchor="middle" fontSize={10}
                          fill={controlColor.dot} opacity={psaDone ? 0.4 : 0.85}>
                          {fmt(b.psaDate)}
                        </text>
                      )}
                      {b.fullControl && (
                        <text x={cx} y={PSA_Y + 46} textAnchor="middle" fontSize={9}
                          fill={controlColor.text} opacity={psaDone ? 0.3 : 0.65}>
                          ПСА · МРТ · КТ
                        </text>
                      )}
                    </g>
                  </>
                )}

                {/* ── CYCLE DOT on axis ── */}
                {/* glow ring when active */}
                <circle cx={cx} cy={AXIS_Y} r={DOT_R + 8}
                  fill={C.cycle.dot} opacity={cycleActive ? 0.15 : 0}
                  style={{ transition: "opacity 0.2s" }}
                />
                <g style={{ cursor: "pointer" }} onClick={() => tap(cycleId)}>
                  {/* White/card base so dot fully covers the axis line */}
                  <circle cx={cx} cy={AXIS_Y} r={DOT_R + 1} fill="hsl(var(--card))" />
                  <circle cx={cx} cy={AXIS_Y} r={DOT_R}
                    fill={cycleDone ? "hsl(var(--muted))" : "#3b0764"}
                    stroke={cycleDone ? "hsl(var(--muted-foreground))" : C.cycle.dot}
                    strokeWidth={2.5}
                  />
                  {cycleDone
                    ? <text x={cx} y={AXIS_Y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={16} fill={C.cycle.dot}>✓</text>
                    : <text x={cx} y={AXIS_Y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight="800" fill={C.cycle.text}>{b.num}</text>
                  }
                </g>

                {/* ── CYCLE LABEL below dot ── */}
                <text x={cx} y={AXIS_Y + DOT_R + 16} textAnchor="middle" fontSize={10} fontWeight="600"
                  fill="hsl(var(--foreground))" opacity={0.6}>
                  {isLast ? `Цикл ${b.num} (посл.)` : `Цикл ${b.num}`}
                </text>
                <text x={cx} y={AXIS_Y + DOT_R + 30} textAnchor="middle" fontSize={9}
                  fill={C.cycle.dot} opacity={0.6} fontFamily="monospace">
                  {fmt(b.infusionDate)}
                </text>

              </g>
            );
          })}

          {/* ══ COUNCIL DOT (последняя контрольная точка) ══ */}
          {(() => {
            const cx = councilX;
            const councilId = "council";
            const isDone = done.has(councilId);
            const isActive = active === councilId;
            return (
              <g>
                {/* axis extension to council */}
                <line
                  x1={cycleX(cycles) + DOT_R} y1={AXIS_Y}
                  x2={cx - COUNCIL_R - 4} y2={AXIS_Y}
                  stroke={COUNCIL_COLOR} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.5}
                />
                {/* glow */}
                <circle cx={cx} cy={AXIS_Y} r={COUNCIL_R + 8}
                  fill={COUNCIL_COLOR} opacity={isActive ? 0.15 : 0}
                  style={{ transition: "opacity 0.2s" }}
                />
                {/* outer pulse ring */}
                <circle cx={cx} cy={AXIS_Y} r={COUNCIL_R + 3}
                  fill="none" stroke={COUNCIL_COLOR} strokeWidth={1.5} strokeOpacity={0.35}
                />
                <g style={{ cursor: "pointer" }} onClick={() => tap(councilId)}>
                  <circle cx={cx} cy={AXIS_Y} r={COUNCIL_R}
                    fill={isDone ? "hsl(var(--muted))" : COUNCIL_COLOR + "22"}
                    stroke={COUNCIL_COLOR} strokeWidth={2.5}
                    opacity={isDone ? 0.5 : 1}
                  />
                  {isDone
                    ? <text x={cx} y={AXIS_Y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill={COUNCIL_COLOR}>✓</text>
                    : <Icon name="Stethoscope" size={16} style={{ color: COUNCIL_COLOR }} />
                  }
                  {/* SVG doesn't support React components inline, draw icon as text symbol */}
                  {!isDone && (
                    <text x={cx} y={AXIS_Y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill={COUNCIL_COLOR}>⊕</text>
                  )}
                </g>
                <text x={cx} y={AXIS_Y + COUNCIL_R + 16} textAnchor="middle" fontSize={11} fontWeight="700"
                  fill={COUNCIL_COLOR}>
                  Консилиум
                </text>
                <text x={cx} y={AXIS_Y + COUNCIL_R + 30} textAnchor="middle" fontSize={9}
                  fill={COUNCIL_COLOR} opacity={0.7} fontFamily="monospace">
                  {fmt(endDate)}
                </text>

                {/* Active popup — rendered as foreignObject */}
                {isActive && (
                  <foreignObject x={cx - 110} y={AXIS_Y - 170} width={220} height={160}>
                    <div style={{
                      background: "hsl(var(--card))",
                      border: `2px solid ${COUNCIL_COLOR}60`,
                      borderRadius: 16,
                      padding: "14px 16px",
                      boxShadow: `0 8px 32px ${COUNCIL_COLOR}25`,
                    }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: COUNCIL_COLOR, marginBottom: 4 }}>Консилиум</p>
                      <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 8, lineHeight: 1.5 }}>
                        Оценка результатов лечения. Решение о дальнейшей тактике на основании ПСА и данных визуализации.
                      </p>
                      <button
                        onClick={e => { e.stopPropagation(); toggle(councilId); }}
                        style={{
                          width: "100%", padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: isDone ? COUNCIL_COLOR + "30" : COUNCIL_COLOR + "15",
                          color: COUNCIL_COLOR, border: `1px solid ${COUNCIL_COLOR}60`, cursor: "pointer",
                        }}>
                        {isDone ? "✓ Консилиум проведён" : "Отметить проведённым"}
                      </button>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })()}

        </svg>
      </div>

      {/* ── ACTIVE POPUPS for cycle / blood / psa (HTML, positioned) ── */}
      {blocks.map(b => {
        const cx = cycleX(b.num);
        const cycleId = `cycle-${b.num}`;
        const bloodId = `blood-${b.num}`;
        const psaId = `psa-${b.num}`;
        const controlColor = b.fullControl ? C.imaging : C.psa;

        return (
          <div key={b.num}>
            {/* Cycle popup */}
            {active === cycleId && (
              <div className="fixed z-50 rounded-2xl border p-4 shadow-2xl w-60"
                style={{
                  backgroundColor: "hsl(var(--card))", borderColor: C.cycle.border,
                  top: "50%", left: `calc(${cx}px + 48px)`, transform: "translateY(-50%)",
                }}>
                <p className="font-bold text-foreground mb-1">Цикл {b.num}</p>
                <p className="text-xs text-muted-foreground mb-1">{scheme.drug} {scheme.dose}</p>
                <p className="text-xs text-muted-foreground mb-3">В/в капельно, 1 ч · Дата: {fmt(b.infusionDate)}<br />Премедикация: дексаметазон</p>
                <button onClick={() => toggle(cycleId)}
                  className="w-full py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: done.has(cycleId) ? C.cycle.dot + "30" : C.cycle.bg, color: C.cycle.dot, border: `1px solid ${C.cycle.border}` }}>
                  {done.has(cycleId) ? "✓ Введение выполнено" : "Отметить введение"}
                </button>
              </div>
            )}

            {/* Blood popup */}
            {active === bloodId && (
              <div className="fixed z-50 rounded-2xl border p-4 shadow-2xl w-56"
                style={{
                  backgroundColor: "hsl(var(--card))", borderColor: C.blood.border,
                  top: "30%", left: `calc(${cx}px + 36px)`, transform: "translateY(-50%)",
                }}>
                <p className="font-bold text-foreground mb-1">Анализы перед циклом {b.num}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  ОАК с лейкоформулой<br />АЛТ, АСТ, билирубин, креатинин, глюкоза<br />
                  Дата: {fmt(b.bloodDate)}
                </p>
                <button onClick={() => toggle(bloodId)}
                  className="w-full py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: done.has(bloodId) ? C.blood.dot + "30" : C.blood.bg, color: C.blood.dot, border: `1px solid ${C.blood.border}` }}>
                  {done.has(bloodId) ? "✓ Выполнено" : "Отметить выполненным"}
                </button>
              </div>
            )}

            {/* PSA / Control popup */}
            {active === psaId && (b.psaControl || b.fullControl) && (
              <div className="fixed z-50 rounded-2xl border p-4 shadow-2xl w-64"
                style={{
                  backgroundColor: "hsl(var(--card))", borderColor: controlColor.border,
                  top: "65%", left: `calc(${cx}px + 36px)`, transform: "translateY(-50%)",
                }}>
                <p className="font-bold text-foreground mb-2">
                  {b.fullControl ? `Полный контроль после цикла ${b.num}` : `Контроль ПСА после цикла ${b.num}`}
                </p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: C.psa.dot }} />
                    <p className="text-xs text-muted-foreground">ПСА{b.psaDate ? ` · ${fmt(b.psaDate)}` : ""}</p>
                  </div>
                  {b.fullControl && b.imagingDates && (
                    ["МРТ малого таза", "КТ органов гр. клетки", "УЗИ брюшной полости"].map((exam, i) => (
                      <div key={exam} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: C.imaging.dot }} />
                        <p className="text-xs text-muted-foreground">{exam}{b.imagingDates ? ` · ${fmt(b.imagingDates[i])}` : ""}</p>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground italic mb-3">Снижение ПСА ≥ 50% — биохимический ответ</p>
                <button onClick={() => toggle(psaId)}
                  className="w-full py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: done.has(psaId) ? controlColor.dot + "30" : controlColor.bg, color: controlColor.dot, border: `1px solid ${controlColor.border}` }}>
                  {done.has(psaId) ? "✓ Контроль выполнен" : "Отметить выполненным"}
                </button>
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function PatientJourney() {
  const [step, setStep] = useState<"setup" | "treatment" | "timeline">("setup");
  const [councilDate, setCouncilDate] = useState("");
  const [decision, setDecision] = useState<TreatmentType>(null);
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [cycles, setCycles] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const reset = () => { setStep("setup"); setScheme(null); setCycles(null); setStartDate(""); setCouncilDate(""); setDecision(null); };

  // ── SETUP ──
  if (step === "setup") return (
    <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Путь пациента</p>
        <h2 className="font-display text-4xl text-foreground mb-3">Решение консилиума</h2>
        <p className="text-muted-foreground">Дата и тактика лечения</p>
      </div>
      <div className="space-y-5">
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-sm font-medium text-foreground mb-3">Дата консилиума</p>
          <input type="date" value={councilDate} onChange={e => setCouncilDate(e.target.value)} max={today}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-sm font-medium text-foreground mb-4">Решение консилиума</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "chemo", icon: "Syringe", label: "Химиотерапия" },
              { key: "surgery", icon: "Stethoscope", label: "Хирургия" },
              { key: "radiation", icon: "Zap", label: "Лучевая терапия" },
              { key: "diagnostics", icon: "Scan", label: "Дообследование" },
            ] as { key: TreatmentType; icon: string; label: string }[]).map(({ key, icon, label }) => (
              <button key={key as string} onClick={() => setDecision(key)}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${decision === key ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30"}`}>
                <Icon name={icon as "Syringe"} size={18} className="text-foreground" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <button disabled={!councilDate || !decision} onClick={() => setStep("treatment")}
          className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity disabled:opacity-40">
          Далее
        </button>
      </div>
    </main>
  );

  // ── TREATMENT ──
  if (step === "treatment") return (
    <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
      <button onClick={() => setStep("setup")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <Icon name="ChevronLeft" size={16} /> Назад
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Параметры лечения</p>
        <h2 className="font-display text-4xl text-foreground mb-2">Схема и сроки</h2>
      </div>

      {decision === "chemo" ? (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-sm font-medium text-foreground mb-4">Схема химиотерапии</p>
            {SCHEMES.map(s => (
              <button key={s.id} onClick={() => { setScheme(s); setCycles(null); }}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${scheme?.id === s.id ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{s.name} <span className="font-normal text-muted-foreground">{s.dose}</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Каждые {s.cycleDays} дней · в/в капельно</p>
                  </div>
                  {scheme?.id === s.id && <Icon name="CheckCircle" size={18} className="text-foreground" />}
                </div>
              </button>
            ))}
          </div>

          {scheme && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-sm font-medium text-foreground mb-4">Количество циклов</p>
              <div className="flex gap-3">
                {scheme.cycleOptions.map(n => (
                  <button key={n} onClick={() => setCycles(n)}
                    className={`flex-1 py-4 rounded-xl border-2 text-center transition-all ${cycles === n ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground/40"}`}>
                    <p className="text-2xl font-display font-bold">{n}</p>
                    <p className="text-xs mt-1 opacity-70">≈ {Math.round(n * scheme.cycleDays / 30)} мес.</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cycles && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-sm font-medium text-foreground mb-3">Дата начала (цикл 1)</p>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
          )}

          <button disabled={!scheme || !cycles || !startDate}
            onClick={() => setStep("timeline")}
            className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity disabled:opacity-40">
            Построить план
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <Icon name="Construction" size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground mb-2">Раздел в разработке</p>
          <p className="text-sm text-muted-foreground">Шаблоны для хирургии, лучевой терапии и дообследования появятся в следующих версиях.</p>
        </div>
      )}
    </main>
  );

  // ── TIMELINE ──
  if (step === "timeline" && scheme && cycles && startDate) {
    return (
      <ChemoTimeline
        scheme={scheme}
        cycles={cycles}
        startDate={new Date(startDate)}
        onReset={reset}
      />
    );
  }

  return null;
}
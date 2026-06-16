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
  bloodDate: Date;    // анализы за 2 дня до цикла (цикл 1 — в день цикла)
  infusionDate: Date; // день введения
  psaControl: boolean;      // контроль ПСА после этого цикла
  fullControl: boolean;     // полный контроль (ПСА + визуализация)
  psaDate?: Date;
  imagingDates?: Date[];
};

function buildCycles(start: Date, scheme: Scheme, totalCycles: number): CycleBlock[] {
  const blocks: CycleBlock[] = [];
  let cursor = new Date(start);

  const imagingList = ["МРТ малого таза", "КТ органов грудной клетки", "УЗИ брюшной полости"];

  for (let n = 1; n <= totalCycles; n++) {
    const infusion = new Date(cursor);
    const blood = n === 1 ? new Date(cursor) : addDays(cursor, -2);

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

  return (
    <div className="w-full px-6 py-8 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap max-w-6xl mx-auto">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Химиотерапия</p>
          <h2 className="font-display text-3xl text-foreground">{scheme.name} {scheme.dose} · {cycles} циклов</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {fmt(startDate)} — {fmt(endDate)} · каждые {scheme.cycleDays} дней
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
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
      <div className="flex flex-wrap gap-5 mb-8 max-w-6xl mx-auto">
        {[
          { color: C.blood.dot,   label: "Анализы крови" },
          { color: C.cycle.dot,   label: "Введение препарата" },
          { color: C.psa.dot,     label: "Контроль ПСА" },
          { color: C.imaging.dot, label: "Визуализация (МРТ/КТ)" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* ── TIMELINE SCROLL AREA ── */}
      <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
        <div className="relative" style={{ minWidth: blocks.length * 160 + 80, paddingBottom: 8 }}>

          {/* ────── ROW: АНАЛИЗЫ КРОВИ (над осью, уровень 1) ────── */}
          <div className="flex items-end mb-0" style={{ height: 90 }}>
            <div style={{ width: 24 }} />
            {blocks.map(b => {
              const id = `blood-${b.num}`;
              const isDone = done.has(id);
              const isActive = active === id;
              return (
                <div key={id} style={{ width: 160 }} className="flex flex-col items-center">
                  <button
                    onClick={() => tap(id)}
                    className="group flex flex-col items-center gap-1 w-full px-2"
                  >
                    <div className={`rounded-xl px-3 py-2 text-center transition-all border ${isActive ? "scale-105 shadow-lg" : "hover:scale-102"}`}
                      style={{
                        backgroundColor: isDone ? "hsl(var(--muted))" : C.blood.bg,
                        borderColor: isDone ? "hsl(var(--border))" : C.blood.border,
                        opacity: isDone ? 0.5 : 1,
                      }}>
                      <p className="text-xs font-semibold" style={{ color: isDone ? "hsl(var(--muted-foreground))" : C.blood.text }}>
                        ОАК + биохимия
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: C.blood.dot, opacity: 0.8 }}>{fmt(b.bloodDate)}</p>
                    </div>
                  </button>
                  {isActive && (
                    <div className="absolute z-20 mt-1 rounded-xl border p-3 text-xs shadow-xl w-52"
                      style={{ backgroundColor: "hsl(var(--card))", borderColor: C.blood.border, top: 0, marginLeft: 0 }}>
                      <p className="font-semibold text-foreground mb-1">Анализы перед циклом {b.num}</p>
                      <p className="text-muted-foreground mb-2">ОАК, лейкоформула, АЛТ/АСТ, билирубин, креатинин, глюкоза</p>
                      <button onClick={() => toggle(id)}
                        className="w-full py-1 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: isDone ? C.blood.dot + "30" : C.blood.bg, color: C.blood.dot, border: `1px solid ${C.blood.border}` }}>
                        {isDone ? "✓ Выполнено" : "Отметить выполненным"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ────── CONNECTOR DOTS (верхний) ────── */}
          <div className="flex items-center">
            <div style={{ width: 24 }} />
            {blocks.map(b => (
              <div key={b.num} style={{ width: 160 }} className="flex justify-center">
                <div className="w-0.5 h-5" style={{ backgroundColor: C.blood.dot, opacity: 0.4 }} />
              </div>
            ))}
          </div>

          {/* ────── MAIN AXIS ROW ────── */}
          <div className="flex items-center">
            {/* Start cap */}
            <div className="flex items-center" style={{ width: 24 }}>
              <div className="w-6 h-1 rounded-full" style={{ backgroundColor: "hsl(var(--border))" }} />
            </div>

            {blocks.map((b, i) => {
              const id = `cycle-${b.num}`;
              const isDone = done.has(id);
              const isActive = active === id;
              const isLast = i === blocks.length - 1;

              return (
                <div key={id} className="flex items-center" style={{ width: 160 }}>
                  {/* Segment line before dot */}
                  <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: isDone ? C.cycle.dot + "40" : "hsl(var(--border))" }} />

                  {/* Cycle dot + label */}
                  <div className="relative flex flex-col items-center" style={{ zIndex: isActive ? 20 : 1 }}>
                    <button
                      onClick={() => tap(id)}
                      className="flex flex-col items-center transition-transform hover:scale-110"
                    >
                      {/* Outer ring */}
                      <div className="rounded-full flex items-center justify-center"
                        style={{
                          width: 48, height: 48,
                          backgroundColor: isDone ? "hsl(var(--muted))" : C.cycle.bg,
                          border: `2px solid ${isDone ? "hsl(var(--border))" : C.cycle.border}`,
                          boxShadow: isActive ? `0 0 0 4px ${C.cycle.dot}30` : "none",
                          opacity: isDone ? 0.5 : 1,
                        }}>
                        {isDone
                          ? <Icon name="CheckCircle" size={20} style={{ color: C.cycle.dot }} />
                          : <span className="font-display text-lg font-bold" style={{ color: C.cycle.text }}>{b.num}</span>
                        }
                      </div>
                    </button>

                    {/* Active popup */}
                    {isActive && (
                      <div className="absolute top-14 z-30 rounded-2xl border p-4 shadow-2xl w-56"
                        style={{ backgroundColor: "hsl(var(--card))", borderColor: C.cycle.border }}>
                        <p className="font-semibold text-foreground mb-1">Цикл {b.num} · {fmt(b.infusionDate)}</p>
                        <p className="text-xs text-muted-foreground mb-1">{scheme.drug} {scheme.dose}</p>
                        <p className="text-xs text-muted-foreground mb-3">В/в капельно, 1 ч · Премедикация: дексаметазон</p>
                        <button onClick={() => toggle(id)}
                          className="w-full py-1.5 rounded-xl text-xs font-semibold transition-colors"
                          style={{ background: isDone ? C.cycle.dot + "30" : C.cycle.bg, color: C.cycle.dot, border: `1px solid ${C.cycle.border}` }}>
                          {isDone ? "✓ Введение выполнено" : "Отметить введение"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Segment line after last dot */}
                  {isLast && (
                    <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: "hsl(var(--border))" }} />
                  )}
                </div>
              );
            })}

            {/* End cap */}
            <div style={{ width: 24 }} className="flex items-center">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: "#6366f1", backgroundColor: "#6366f115" }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#6366f1" }} />
              </div>
            </div>
          </div>

          {/* Cycle date labels */}
          <div className="flex items-start mt-1">
            <div style={{ width: 24 }} />
            {blocks.map(b => (
              <div key={b.num} style={{ width: 160 }} className="flex justify-center">
                <p className="text-xs font-mono text-center" style={{ color: C.cycle.dot, opacity: 0.7 }}>{fmt(b.infusionDate)}</p>
              </div>
            ))}
          </div>

          {/* ────── CONNECTOR DOTS (нижний) для ПСА ────── */}
          <div className="flex items-center mt-1">
            <div style={{ width: 24 }} />
            {blocks.map(b => (
              <div key={b.num} style={{ width: 160 }} className="flex justify-center">
                {(b.psaControl || b.fullControl) && (
                  <div className="w-0.5 h-5" style={{ backgroundColor: b.fullControl ? C.imaging.dot : C.psa.dot, opacity: 0.4 }} />
                )}
              </div>
            ))}
          </div>

          {/* ────── ROW: КОНТРОЛЬ ПСА ────── */}
          <div className="flex items-start mt-0">
            <div style={{ width: 24 }} />
            {blocks.map(b => {
              if (!b.psaControl && !b.fullControl) return <div key={b.num} style={{ width: 160 }} />;
              const id = `psa-${b.num}`;
              const isDone = done.has(id);
              const isActive = active === id;
              const color = b.fullControl ? C.imaging : C.psa;

              return (
                <div key={id} style={{ width: 160 }} className="flex flex-col items-center relative">
                  <button onClick={() => tap(id)} className="w-full px-2">
                    <div className="rounded-xl px-3 py-2.5 text-center border transition-all hover:scale-105"
                      style={{
                        backgroundColor: isDone ? "hsl(var(--muted))" : color.bg,
                        borderColor: isDone ? "hsl(var(--border))" : color.border,
                        opacity: isDone ? 0.5 : 1,
                      }}>
                      <p className="text-xs font-semibold" style={{ color: isDone ? "hsl(var(--muted-foreground))" : color.text }}>
                        {b.fullControl ? "Полный контроль" : "Контроль ПСА"}
                      </p>
                      {b.psaDate && <p className="text-xs mt-0.5" style={{ color: color.dot, opacity: 0.8 }}>{fmt(b.psaDate)}</p>}
                      {b.fullControl && <p className="text-xs mt-0.5 opacity-60" style={{ color: color.text }}>ПСА + МРТ + КТ</p>}
                    </div>
                  </button>

                  {isActive && (
                    <div className="absolute top-16 z-30 rounded-2xl border p-4 shadow-2xl w-60"
                      style={{ backgroundColor: "hsl(var(--card))", borderColor: color.border }}>
                      <p className="font-semibold text-foreground mb-2">
                        {b.fullControl ? `Полный контроль после цикла ${b.num}` : `Контроль ПСА после цикла ${b.num}`}
                      </p>
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.psa.dot }} />
                          <p className="text-xs text-muted-foreground">ПСА{b.psaDate ? ` · ${fmt(b.psaDate)}` : ""}</p>
                        </div>
                        {b.fullControl && b.imagingDates && ["МРТ малого таза", "КТ органов гр. клетки", "УЗИ брюшной полости"].map((exam, i) => (
                          <div key={exam} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.imaging.dot }} />
                            <p className="text-xs text-muted-foreground">{exam}{b.imagingDates ? ` · ${fmt(b.imagingDates[i])}` : ""}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 italic">Снижение ПСА ≥ 50% — биохимический ответ</p>
                      <button onClick={() => toggle(id)}
                        className="w-full py-1.5 rounded-xl text-xs font-semibold"
                        style={{ background: isDone ? color.dot + "30" : color.bg, color: color.dot, border: `1px solid ${color.border}` }}>
                        {isDone ? "✓ Контроль выполнен" : "Отметить выполненным"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
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

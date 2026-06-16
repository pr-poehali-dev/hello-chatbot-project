import { useState } from "react";
import Icon from "@/components/ui/icon";

// ── TYPES ──────────────────────────────────────────────────────────────────

type TreatmentType = "chemo" | "surgery" | "radiation" | "diagnostics" | null;

type ChemoScheme = {
  id: string;
  name: string;
  drug: string;
  dose: string;
  cycleOptions: number[];
  cycleDays: number;
  bloodBeforeCycle: boolean;
  psaAfterCycle?: number;
  imagingAfterCycle?: number;
};

type TimelineEvent = {
  id: string;
  type: "start" | "blood" | "psa" | "cycle" | "imaging" | "end";
  label: string;
  sublabel?: string;
  date: Date;
  cycleNum?: number;
  isControl?: boolean;
  side: "left" | "right" | "center";
};

// ── CHEMO SCHEMES ──────────────────────────────────────────────────────────

const CHEMO_SCHEMES: ChemoScheme[] = [
  {
    id: "docetaxel",
    name: "Доцетаксел",
    drug: "Доцетаксел",
    dose: "75 мг/м²",
    cycleOptions: [6, 9],
    cycleDays: 21,
    bloodBeforeCycle: true,
    psaAfterCycle: 3,
    imagingAfterCycle: 6,
  },
];

// ── HELPERS ────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── BUILD TIMELINE ─────────────────────────────────────────────────────────
// left  = обследования / анализы
// right = лечение (циклы)
// center = старт / финиш / ключевые точки контроля

function buildChemoTimeline(
  startDate: Date,
  scheme: ChemoScheme,
  cycles: number,
  priorExams: string[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let cursor = new Date(startDate);

  const imagingList = priorExams.length > 0 ? priorExams : ["МРТ малого таза", "Рентген грудной клетки", "УЗИ брюшной полости"];

  // Start
  events.push({ id: "start", type: "start", label: "Начало лечения", sublabel: `Консилиум · ${scheme.name} ${scheme.dose}`, date: new Date(cursor), side: "center" });

  for (let c = 1; c <= cycles; c++) {
    // Blood before cycle
    if (scheme.bloodBeforeCycle) {
      const bd = c === 1 ? new Date(cursor) : addDays(cursor, -2);
      events.push({ id: `blood-${c}`, type: "blood", label: "ОАК + биохимия", sublabel: `Перед циклом ${c}`, date: bd, cycleNum: c, side: "left" });
    }

    // Cycle
    events.push({ id: `cycle-${c}`, type: "cycle", label: `Цикл ${c}`, sublabel: `${scheme.drug} ${scheme.dose}`, date: new Date(cursor), cycleNum: c, side: "right" });

    // PSA control
    const addPSA = (id: string, afterCycle: number, label: string) => {
      events.push({ id, type: "psa", label: "Контроль ПСА", sublabel: label, date: addDays(cursor, 5), cycleNum: afterCycle, isControl: true, side: "left" });
    };

    const addImaging = (suffix: string, afterCycle: number, label: string) => {
      imagingList.forEach((exam, idx) => {
        events.push({ id: `img-${suffix}-${idx}`, type: "imaging", label: exam, sublabel: label, date: addDays(cursor, 7 + idx), cycleNum: afterCycle, isControl: true, side: "left" });
      });
    };

    if (scheme.psaAfterCycle && c === scheme.psaAfterCycle) {
      addPSA(`psa-${c}`, c, `После цикла ${c}`);
    }

    if (scheme.imagingAfterCycle && c === scheme.imagingAfterCycle) {
      addImaging(`${c}`, c, `После цикла ${c} · контроль`);
    }

    // For 9-cycle: mid-point at cycle 6
    if (cycles === 9 && c === 6 && scheme.psaAfterCycle !== 6) {
      addPSA("psa-mid", 6, "После цикла 6 · промежуточный");
      addImaging("mid", 6, "После цикла 6 · промежуточный");
    }

    cursor = addDays(cursor, scheme.cycleDays);
  }

  // Final PSA
  if (scheme.psaAfterCycle !== cycles) {
    events.push({ id: "psa-final", type: "psa", label: "Контроль ПСА", sublabel: `После цикла ${cycles} · итог`, date: addDays(cursor, 5), isControl: true, side: "left" });
  }

  // End
  events.push({ id: "end", type: "end", label: "Завершение курса", sublabel: `${cycles} циклов · оценка ответа`, date: new Date(cursor), side: "center" });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

// ── EVENT STYLE CONFIG ─────────────────────────────────────────────────────

type EvStyle = { color: string; dotSize: number; label: string };

function getStyle(type: TimelineEvent["type"], isControl?: boolean): EvStyle {
  switch (type) {
    case "start":   return { color: "#6366f1", dotSize: 14, label: "" };
    case "end":     return { color: "#6366f1", dotSize: 14, label: "" };
    case "blood":   return { color: "#60a5fa", dotSize: 8,  label: "" };
    case "psa":     return { color: isControl ? "#fbbf24" : "#60a5fa", dotSize: 10, label: "" };
    case "cycle":   return { color: "#a78bfa", dotSize: 12, label: "" };
    case "imaging": return { color: "#34d399", dotSize: 8,  label: "" };
    default:        return { color: "#6b7280", dotSize: 8,  label: "" };
  }
}

// ── COMPONENT ──────────────────────────────────────────────────────────────

export default function PatientJourney() {
  const [step, setStep] = useState<"setup" | "exams" | "treatment" | "timeline">("setup");

  const [councilDate, setCouncilDate] = useState("");
  const [councilDecision, setCouncilDecision] = useState<TreatmentType>(null);

  const [priorExams, setPriorExams] = useState<string[]>([]);
  const [newExam, setNewExam] = useState("");

  const [selectedScheme, setSelectedScheme] = useState<ChemoScheme | null>(null);
  const [selectedCycles, setSelectedCycles] = useState<number | null>(null);
  const [treatmentStart, setTreatmentStart] = useState("");

  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const addExam = () => {
    const t = newExam.trim();
    if (t && !priorExams.includes(t)) { setPriorExams(p => [...p, t]); setNewExam(""); }
  };

  const buildTimeline = () => {
    if (!selectedScheme || !selectedCycles || !treatmentStart) return;
    setTimeline(buildChemoTimeline(new Date(treatmentStart), selectedScheme, selectedCycles, priorExams));
    setCompletedIds(new Set());
    setActiveId(null);
    setStep("timeline");
  };

  const toggle = (id: string) => setCompletedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  const progress = timeline.length ? Math.round((completedIds.size / timeline.length) * 100) : 0;

  const resetAll = () => {
    setStep("setup"); setTimeline([]); setSelectedScheme(null); setSelectedCycles(null);
    setTreatmentStart(""); setCouncilDate(""); setCouncilDecision(null); setPriorExams([]);
  };

  // ── STEP: SETUP ────────────────────────────────────────────────────────

  if (step === "setup") return (
    <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Трекер пути пациента</p>
        <h2 className="font-display text-4xl text-foreground mb-3">Решение консилиума</h2>
        <p className="text-muted-foreground">Введите дату консилиума и выберите тактику лечения</p>
      </div>
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-sm font-medium text-foreground mb-3">Дата консилиума</p>
          <input type="date" value={councilDate} onChange={e => setCouncilDate(e.target.value)} max={today}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-sm font-medium text-foreground mb-4">Решение консилиума</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "chemo", icon: "Syringe", label: "Химиотерапия", desc: "Системное лекарственное лечение" },
              { key: "surgery", icon: "Stethoscope", label: "Хирургическое лечение", desc: "Оперативное вмешательство" },
              { key: "radiation", icon: "Zap", label: "Лучевая терапия", desc: "Дистанционная или брахитерапия" },
              { key: "diagnostics", icon: "Scan", label: "Дообследование", desc: "Уточнение диагноза" },
            ] as { key: TreatmentType; icon: string; label: string; desc: string }[]).map(({ key, icon, label, desc }) => (
              <button key={key as string} onClick={() => setCouncilDecision(key)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${councilDecision === key ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30 hover:bg-secondary"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={icon as "Syringe"} size={16} className="text-foreground" />
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
              </button>
            ))}
          </div>
        </div>
        <button disabled={!councilDate || !councilDecision} onClick={() => setStep("exams")}
          className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity disabled:opacity-40">
          Далее — обследования до начала лечения
        </button>
      </div>
    </main>
  );

  // ── STEP: EXAMS ────────────────────────────────────────────────────────

  if (step === "exams") return (
    <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
      <button onClick={() => setStep("setup")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <Icon name="ChevronLeft" size={16} /> Назад
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Шаг 2 из 3</p>
        <h2 className="font-display text-4xl text-foreground mb-3">Обследования</h2>
        <p className="text-muted-foreground">Добавьте инструментальные обследования до начала лечения — они войдут в контрольные точки плана.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <p className="text-sm font-medium text-foreground mb-4">Добавить обследование</p>
        <div className="flex gap-2 mb-4">
          <input type="text" value={newExam} onChange={e => setNewExam(e.target.value)} onKeyDown={e => e.key === "Enter" && addExam()}
            placeholder="Например: МРТ малого таза…"
            className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground" />
          <button onClick={addExam} disabled={!newExam.trim()}
            className="px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40">
            <Icon name="Plus" size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {["МРТ малого таза", "КТ органов грудной клетки", "УЗИ брюшной полости", "Рентген грудной клетки", "Остеосцинтиграфия", "ПЭТ-КТ"].map(exam =>
            !priorExams.includes(exam) && (
              <button key={exam} onClick={() => setPriorExams(p => [...p, exam])}
                className="text-xs px-3 py-1.5 border border-dashed border-border rounded-lg text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors">
                + {exam}
              </button>
            )
          )}
        </div>
        {priorExams.length > 0 ? (
          <div className="space-y-2">
            {priorExams.map(exam => (
              <div key={exam} className="flex items-center justify-between px-4 py-2.5 bg-secondary rounded-xl">
                <div className="flex items-center gap-2">
                  <Icon name="Scan" size={14} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">{exam}</span>
                </div>
                <button onClick={() => setPriorExams(p => p.filter(x => x !== exam))} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name="X" size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
            Будут использованы стандартные методы: МРТ малого таза, рентген ОГК, УЗИ брюшной полости
          </p>
        )}
      </div>
      <button onClick={() => setStep("treatment")}
        className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity">
        Далее — параметры лечения
      </button>
    </main>
  );

  // ── STEP: TREATMENT ────────────────────────────────────────────────────

  if (step === "treatment") return (
    <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
      <button onClick={() => setStep("exams")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <Icon name="ChevronLeft" size={16} /> Назад
      </button>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Шаг 3 из 3</p>
        <h2 className="font-display text-4xl text-foreground mb-3">Параметры лечения</h2>
        <p className="text-muted-foreground">Выберите схему, количество циклов и дату начала</p>
      </div>

      {councilDecision === "chemo" ? (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-sm font-medium text-foreground mb-4">Схема химиотерапии</p>
            <div className="space-y-3">
              {CHEMO_SCHEMES.map(scheme => (
                <button key={scheme.id} onClick={() => { setSelectedScheme(scheme); setSelectedCycles(null); }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedScheme?.id === scheme.id ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground">{scheme.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{scheme.drug} · {scheme.dose} · каждые {scheme.cycleDays} дней</p>
                    </div>
                    {selectedScheme?.id === scheme.id && <Icon name="CheckCircle" size={18} className="text-foreground flex-shrink-0 mt-0.5" />}
                  </div>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-border flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-xs text-muted-foreground">ОАК + биохимия перед каждым циклом</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-xs text-muted-foreground">ПСА после цикла {scheme.psaAfterCycle}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedScheme && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-sm font-medium text-foreground mb-4">Количество циклов</p>
              <div className="flex gap-3">
                {selectedScheme.cycleOptions.map(n => (
                  <button key={n} onClick={() => setSelectedCycles(n)}
                    className={`flex-1 py-4 rounded-xl border-2 font-semibold text-lg transition-all ${selectedCycles === n ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground/40"}`}>
                    {n} циклов
                    <p className="text-xs font-normal mt-0.5 opacity-70">≈ {Math.round((n * selectedScheme.cycleDays) / 30)} мес.</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedCycles && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-sm font-medium text-foreground mb-3">Дата начала лечения (цикл 1)</p>
              <input type="date" value={treatmentStart} onChange={e => setTreatmentStart(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
          )}

          <button disabled={!selectedScheme || !selectedCycles || !treatmentStart} onClick={buildTimeline}
            className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity disabled:opacity-40">
            Построить план лечения
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
          <Icon name="Construction" size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 mb-1">Раздел в разработке</p>
            <p className="text-sm text-amber-700 leading-relaxed">Шаблоны для хирургического лечения, лучевой терапии и дообследования появятся в следующих версиях.</p>
          </div>
        </div>
      )}
    </main>
  );

  // ── STEP: TIMELINE ─────────────────────────────────────────────────────
  // Horizontal SVG: time flows left → right, proportional to real days
  // Labels above axis = diagnostics/labs (left side events)
  // Labels below axis = treatment (right side events / cycles)

  const AXIS_Y = 180;            // Y of horizontal axis
  const PX_PER_DAY = 9;         // pixels per day — will be scaled to fit viewport
  const PAD_LEFT = 40;
  const PAD_RIGHT = 60;
  const WHISKER_UP = 130;       // whisker length upward (labs)
  const WHISKER_DN = 110;       // whisker length downward (cycles)

  const endEvent = timeline.find(e => e.id === "end");

  // Sort events by date
  const sorted = [...timeline].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return null;

  const t0 = sorted[0].date.getTime();
  const tEnd = sorted[sorted.length - 1].date.getTime();
  const totalDays = Math.max((tEnd - t0) / 86400000, 1);

  // Scale so timeline fills ~90vw but min 800px
  const svgW = Math.max(PAD_LEFT + totalDays * PX_PER_DAY + PAD_RIGHT, 900);
  const svgH = AXIS_Y + WHISKER_DN + 80;

  const dayX = (date: Date) => PAD_LEFT + ((date.getTime() - t0) / 86400000) * PX_PER_DAY;

  // Color map
  const COLOR: Record<string, string> = {
    start:   "#6366f1",
    end:     "#6366f1",
    cycle:   "#a78bfa",
    blood:   "#60a5fa",
    psa:     "#fbbf24",
    imaging: "#34d399",
  };
  const evColor = (ev: TimelineEvent) =>
    ev.type === "psa" && ev.isControl ? "#fbbf24" : COLOR[ev.type] ?? "#6b7280";

  // Dot radius
  const dotR = (ev: TimelineEvent) => {
    if (ev.type === "start" || ev.type === "end") return 9;
    if (ev.type === "cycle") return 7;
    return 5;
  };

  // Alternate labels: odd events above axis, even below — prevents overlap
  // left-side (labs/exams) → always ABOVE axis
  // right-side (cycles)    → always BELOW axis
  // center (start/end)     → straddling

  return (
    <main className="w-full px-4 py-6 animate-fade-in overflow-hidden">

      {/* Header */}
      <div className="max-w-5xl mx-auto flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Путь пациента</p>
          <h2 className="font-display text-2xl text-foreground">
            {selectedScheme?.name} · {selectedCycles} циклов · {selectedScheme?.dose}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(new Date(treatmentStart))}
            {endEvent && ` — ${formatDate(endEvent.date)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative w-12 h-12 flex-shrink-0">
            <svg width="48" height="48" className="-rotate-90">
              <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="#6366f1" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s" }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{progress}%</span>
          </div>
          <button onClick={resetAll}
            className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Новый план
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-5xl mx-auto flex flex-wrap gap-4 mb-4">
        {[
          { color: "#a78bfa", label: "Цикл ХТ" },
          { color: "#60a5fa", label: "Анализ крови" },
          { color: "#fbbf24", label: "Контроль ПСА" },
          { color: "#34d399", label: "Визуализация" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <svg width="10" height="10"><circle cx="5" cy="5" r="4.5" fill={color} /></svg>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <span className="text-xs text-muted-foreground italic ml-1">обследования — над осью · лечение — под осью</span>
      </div>

      {/* ── HORIZONTAL SVG TIMELINE ── */}
      <div className="overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: "thin" }}>
        <svg
          width={svgW}
          height={svgH}
          style={{ display: "block", fontFamily: "inherit", minWidth: svgW }}
        >
          {/* ── MAIN AXIS LINE ── */}
          <line
            x1={PAD_LEFT - 10} y1={AXIS_Y}
            x2={svgW - PAD_RIGHT + 10} y2={AXIS_Y}
            stroke="hsl(var(--border))"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* ── COLORED SEGMENTS between consecutive events ── */}
          {sorted.map((ev, i) => {
            if (i === 0) return null;
            const prev = sorted[i - 1];
            const x1 = dayX(prev.date) + dotR(prev);
            const x2 = dayX(ev.date) - dotR(ev);
            if (x2 <= x1) return null;
            return (
              <line key={`seg-${i}`}
                x1={x1} y1={AXIS_Y} x2={x2} y2={AXIS_Y}
                stroke={evColor(ev)}
                strokeWidth={3}
                strokeOpacity={0.3}
                strokeLinecap="round"
              />
            );
          })}

          {/* ── MONTH TICK MARKS on axis ── */}
          {(() => {
            const marks: { x: number; label: string }[] = [];
            const d = new Date(sorted[0].date.getFullYear(), sorted[0].date.getMonth(), 1);
            const last = sorted[sorted.length - 1].date;
            while (d <= last) {
              marks.push({
                x: dayX(d),
                label: d.toLocaleDateString("ru-RU", { month: "short" }),
              });
              d.setMonth(d.getMonth() + 1);
            }
            return marks.map(({ x, label }) => (
              <g key={label + x}>
                <line x1={x} y1={AXIS_Y - 8} x2={x} y2={AXIS_Y + 8}
                  stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeOpacity={0.35} />
                <text x={x} y={AXIS_Y + 20} textAnchor="middle" fontSize={9}
                  fill="hsl(var(--muted-foreground))" opacity={0.45}>{label}</text>
              </g>
            ));
          })()}

          {/* ── EVENTS ── */}
          {sorted.map((ev) => {
            const x = dayX(ev.date);
            const color = evColor(ev);
            const r = dotR(ev);
            const done = completedIds.has(ev.id);
            const isActive = activeId === ev.id;
            const isCenter = ev.side === "center";
            // left = labs/exams → above axis; right = cycles → below; center = both
            const above = ev.side === "left" || isCenter;
            const whiskerLen = above ? WHISKER_UP : WHISKER_DN;
            const labelY = above ? AXIS_Y - whiskerLen : AXIS_Y + whiskerLen;
            const lineY2 = above ? AXIS_Y - r : AXIS_Y + r;

            const fontSize = ev.type === "cycle" || isCenter ? 12 : 10;
            const fontWeight = ev.type === "cycle" || isCenter ? "700" : "400";

            return (
              <g key={ev.id} style={{ cursor: "pointer" }} onClick={() => setActiveId(isActive ? null : ev.id)}>

                {/* Whisker: vertical dashed line from axis to label */}
                <line
                  x1={x} y1={lineY2}
                  x2={x} y2={labelY}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  strokeOpacity={done ? 0.25 : 0.55}
                />

                {/* Dot glow */}
                <circle cx={x} cy={AXIS_Y} r={r + 5} fill={color} opacity={isActive ? 0.18 : 0} />

                {/* Dot */}
                <circle
                  cx={x} cy={AXIS_Y} r={r}
                  fill={done ? "hsl(var(--muted-foreground))" : color}
                  opacity={done ? 0.4 : 1}
                />
                {done && (
                  <text x={x} y={AXIS_Y + 0.5} textAnchor="middle" dominantBaseline="middle"
                    fontSize={r} fill="white" fontWeight="900">✓</text>
                )}

                {/* Label box background for active */}
                {isActive && (
                  <rect
                    x={x - 70} y={above ? labelY - 42 : labelY - 2}
                    width={140} height={44}
                    rx={8} ry={8}
                    fill={color} opacity={0.1}
                    stroke={color} strokeOpacity={0.4} strokeWidth={1}
                  />
                )}

                {/* Label: main text */}
                <text
                  x={x}
                  y={above ? labelY - 24 : labelY + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight={fontWeight}
                  fill={done ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))"}
                  opacity={done ? 0.45 : 1}
                >
                  {ev.label}
                </text>

                {/* Date */}
                <text
                  x={x}
                  y={above ? labelY - 10 : labelY + 26}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fontFamily="monospace"
                  fill={color}
                  opacity={done ? 0.3 : 0.8}
                >
                  {formatDateShort(ev.date)}
                </text>

                {/* Active tooltip below/above the label */}
                {isActive && (
                  <foreignObject
                    x={x - 100}
                    y={above ? labelY - 88 : labelY + 44}
                    width={200}
                    height={80}
                  >
                    <div style={{
                      background: "hsl(var(--card))",
                      border: `1px solid ${color}55`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 10,
                      color: "hsl(var(--muted-foreground))",
                      lineHeight: 1.5,
                      boxShadow: `0 4px 16px ${color}22`,
                    }}>
                      {ev.type === "blood" && <p>ОАК · АЛТ, АСТ · Билирубин · Креатинин</p>}
                      {ev.type === "psa" && <p>Снижение ≥ 50% — биохимический ответ</p>}
                      {ev.type === "imaging" && <p>Оценка по RECIST 1.1</p>}
                      {ev.type === "cycle" && selectedScheme && <p>{selectedScheme.drug} · в/в 1 ч · Премедикация: дексаметазон</p>}
                      <button
                        onClick={e => { e.stopPropagation(); toggle(ev.id); }}
                        style={{
                          marginTop: 5, padding: "2px 8px", borderRadius: 6,
                          border: `1px solid ${color}70`, background: done ? color + "25" : "transparent",
                          color, fontSize: 9, fontWeight: 700, cursor: "pointer",
                        }}
                      >{done ? "✓ Готово" : "Отметить"}</button>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* Arrow at end of axis */}
          <polygon
            points={`${svgW - PAD_RIGHT + 10},${AXIS_Y} ${svgW - PAD_RIGHT + 2},${AXIS_Y - 5} ${svgW - PAD_RIGHT + 2},${AXIS_Y + 5}`}
            fill="hsl(var(--muted-foreground))"
            opacity={0.4}
          />
        </svg>
      </div>

    </main>
  );
}
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

  // SVG proportional timeline constants
  const SVG_PX_PER_DAY = 28;   // pixels per day along Y axis
  const AXIS_X = 420;           // X position of the center axis
  const SVG_PADDING_TOP = 40;
  const SVG_PADDING_BOT = 60;
  const LABEL_WIDTH = 360;      // max label panel width on each side
  const WHISKER = 90;           // length of horizontal whisker line

  const endEvent = timeline.find(e => e.id === "end");

  // Sort events by date
  const sorted = [...timeline].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return null;

  const t0 = sorted[0].date.getTime();
  const tEnd = sorted[sorted.length - 1].date.getTime();
  const totalDays = Math.max((tEnd - t0) / 86400000, 1);
  const svgHeight = SVG_PADDING_TOP + totalDays * SVG_PX_PER_DAY + SVG_PADDING_BOT;
  const svgWidth = AXIS_X * 2 + 1; // symmetric

  const dayY = (date: Date) => SVG_PADDING_TOP + ((date.getTime() - t0) / 86400000) * SVG_PX_PER_DAY;

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

  return (
    <main className="w-full px-4 py-10 animate-fade-in">

      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Путь пациента</p>
          <h2 className="font-display text-3xl text-foreground">
            {selectedScheme?.name} · {selectedCycles} циклов · {selectedScheme?.dose}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(new Date(treatmentStart))}
            {endEvent && ` — ${formatDate(endEvent.date)}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-display text-3xl text-foreground">{progress}%</p>
            <p className="text-xs text-muted-foreground">выполнено</p>
          </div>
          <button onClick={resetAll}
            className="px-4 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Новый план
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto w-full h-1 bg-border rounded-full mb-6 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500 bg-indigo-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Legend */}
      <div className="max-w-4xl mx-auto flex flex-wrap gap-4 mb-8">
        {[
          { color: "#a78bfa", label: "Цикл ХТ" },
          { color: "#60a5fa", label: "Анализ крови" },
          { color: "#fbbf24", label: "Контроль ПСА" },
          { color: "#34d399", label: "Визуализация / МРТ" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <svg width="14" height="14"><circle cx="7" cy="7" r="6" fill={color} opacity="0.9" /></svg>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="text-xs text-muted-foreground ml-2 italic">← обследования · лечение →</div>
      </div>

      {/* ── SVG TIMELINE ── */}
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: "block", margin: "0 auto", fontFamily: "inherit" }}
        >
          {/* ── AXIS LINE ── */}
          <line
            x1={AXIS_X} y1={SVG_PADDING_TOP - 10}
            x2={AXIS_X} y2={svgHeight - SVG_PADDING_BOT + 10}
            stroke="hsl(var(--border))"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* ── SEGMENT COLORS between events (color = next event's type) ── */}
          {sorted.map((ev, i) => {
            if (i === 0) return null;
            const prev = sorted[i - 1];
            const y1 = dayY(prev.date);
            const y2 = dayY(ev.date);
            const segColor = evColor(ev);
            return (
              <line key={`seg-${i}`}
                x1={AXIS_X} y1={y1 + dotR(prev)}
                x2={AXIS_X} y2={y2 - dotR(ev)}
                stroke={segColor}
                strokeWidth={3}
                strokeOpacity={0.25}
                strokeLinecap="round"
              />
            );
          })}

          {/* ── EVENTS ── */}
          {sorted.map((ev) => {
            const y = dayY(ev.date);
            const color = evColor(ev);
            const r = dotR(ev);
            const done = completedIds.has(ev.id);
            const isActive = activeId === ev.id;
            const isLeft = ev.side === "left";
            const isCenter = ev.side === "center";

            // Whisker endpoint X
            const whiskerEndX = isLeft
              ? AXIS_X - WHISKER
              : AXIS_X + WHISKER;

            // Label anchor
            const labelX = isLeft ? AXIS_X - WHISKER - 10 : AXIS_X + WHISKER + 10;
            const textAnchor = isLeft ? "end" : "start";

            const labelFontSize = ev.type === "cycle" || isCenter ? 13 : 11;
            const labelFontWeight = ev.type === "cycle" || isCenter ? "600" : "400";

            return (
              <g
                key={ev.id}
                style={{ cursor: "pointer" }}
                onClick={() => setActiveId(isActive ? null : ev.id)}
              >
                {/* Whisker line — dashed */}
                {!isCenter && (
                  <line
                    x1={isLeft ? AXIS_X - r : AXIS_X + r}
                    y1={y}
                    x2={whiskerEndX}
                    y2={y}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={done ? 0.3 : 0.7}
                  />
                )}

                {/* Dot — outer glow ring */}
                <circle
                  cx={AXIS_X} cy={y} r={r + 4}
                  fill={color}
                  opacity={isActive ? 0.15 : 0}
                />
                {/* Dot */}
                <circle
                  cx={AXIS_X} cy={y} r={r}
                  fill={done ? "hsl(var(--muted))" : color}
                  stroke={done ? color : "none"}
                  strokeWidth={done ? 2 : 0}
                  opacity={done ? 0.5 : 1}
                />
                {/* Checkmark inside done dot */}
                {done && (
                  <text x={AXIS_X} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={r * 1.1} fill={color} fontWeight="700">✓</text>
                )}

                {/* Label */}
                <text
                  x={labelX} y={y - (ev.sublabel ? 7 : 1)}
                  textAnchor={textAnchor}
                  dominantBaseline="middle"
                  fontSize={labelFontSize}
                  fontWeight={labelFontWeight}
                  fill={done ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))"}
                  opacity={done ? 0.5 : 1}
                  style={{ textDecoration: done ? "line-through" : "none" }}
                >
                  {ev.label}
                </text>
                {ev.sublabel && (
                  <text
                    x={labelX} y={y + 8}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    fontSize={9}
                    fill="hsl(var(--muted-foreground))"
                    opacity={done ? 0.4 : 0.7}
                  >
                    {ev.sublabel}
                  </text>
                )}

                {/* Date badge */}
                <text
                  x={isCenter ? AXIS_X + r + 8 : (isLeft ? labelX - 4 : labelX + 4)}
                  y={y + (ev.sublabel ? 19 : 13)}
                  textAnchor={isLeft && !isCenter ? "end" : "start"}
                  dominantBaseline="middle"
                  fontSize={9}
                  fontFamily="monospace"
                  fill={color}
                  opacity={done ? 0.4 : 0.85}
                >
                  {formatDateShort(ev.date)}
                </text>

                {/* Active highlight panel (foreignObject) */}
                {isActive && (
                  <foreignObject
                    x={isLeft ? AXIS_X - WHISKER - LABEL_WIDTH - 8 : AXIS_X + WHISKER + 8}
                    y={y + 28}
                    width={LABEL_WIDTH - 20}
                    height={120}
                  >
                    <div
                      style={{
                        background: "hsl(var(--card))",
                        border: `1px solid ${color}50`,
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontSize: 11,
                        color: "hsl(var(--muted-foreground))",
                        lineHeight: 1.5,
                        boxShadow: `0 2px 12px ${color}20`,
                      }}
                    >
                      {ev.type === "blood" && (
                        <p>ОАК с лейкоформулой · АЛТ, АСТ, билирубин · Креатинин · Глюкоза</p>
                      )}
                      {ev.type === "psa" && (
                        <p>Снижение ПСА ≥ 50% от базового — биохимический ответ на лечение</p>
                      )}
                      {ev.type === "imaging" && (
                        <p>Оценка ответа по критериям RECIST 1.1</p>
                      )}
                      {ev.type === "cycle" && selectedScheme && (
                        <p>{selectedScheme.drug} {selectedScheme.dose} · в/в, 1 ч · Премедикация: дексаметазон накануне, в день и на следующий день</p>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggle(ev.id); }}
                        style={{
                          marginTop: 8,
                          padding: "3px 10px",
                          borderRadius: 8,
                          border: `1px solid ${color}60`,
                          background: done ? color + "20" : "transparent",
                          color: color,
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {done ? "✓ Выполнено" : "Отметить выполненным"}
                      </button>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* ── MONTH LABELS on axis ── */}
          {(() => {
            const labels: { y: number; label: string }[] = [];
            const start = sorted[0].date;
            const end = sorted[sorted.length - 1].date;
            const d = new Date(start.getFullYear(), start.getMonth(), 1);
            while (d <= end) {
              const y = dayY(d);
              if (y >= SVG_PADDING_TOP) {
                labels.push({
                  y,
                  label: d.toLocaleDateString("ru-RU", { month: "short", year: "numeric" }),
                });
              }
              d.setMonth(d.getMonth() + 1);
            }
            return labels.map(({ y, label }) => (
              <g key={label}>
                <line x1={AXIS_X - 6} y1={y} x2={AXIS_X + 6} y2={y}
                  stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeOpacity={0.4} />
                <text x={AXIS_X} y={y - 6} textAnchor="middle" fontSize={8}
                  fill="hsl(var(--muted-foreground))" opacity={0.4}>
                  {label}
                </text>
              </g>
            ));
          })()}

        </svg>
      </div>

    </main>
  );
}
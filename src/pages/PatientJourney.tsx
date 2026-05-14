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
  // Layout: center axis, left = diagnostics/labs, right = treatment

  const leftEvents  = timeline.filter(e => e.side === "left");
  const rightEvents = timeline.filter(e => e.side === "right");
  const centerEvents = timeline.filter(e => e.side === "center");

  // Group all events by row index — sort all by date, assign row
  const sorted = [...timeline].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build rows: each unique "date-group" is a row
  // We need to pair left/right events that occur close together
  type Row = { left?: TimelineEvent; right?: TimelineEvent; center?: TimelineEvent; rowDate: Date };
  const rows: Row[] = [];

  const used = new Set<string>();

  for (const ev of sorted) {
    if (used.has(ev.id)) continue;
    used.add(ev.id);

    if (ev.side === "center") {
      rows.push({ center: ev, rowDate: ev.date });
      continue;
    }

    // Find a matching event on opposite side within same cycle
    const row: Row = { rowDate: ev.date };

    if (ev.side === "left") {
      row.left = ev;
      // Try to pair with a right event in same cycleNum
      const pair = sorted.find(e => !used.has(e.id) && e.side === "right" && e.cycleNum === ev.cycleNum);
      if (pair) { row.right = pair; used.add(pair.id); }
    } else {
      row.right = ev;
      const pair = sorted.find(e => !used.has(e.id) && e.side === "left" && e.cycleNum === ev.cycleNum);
      if (pair) { row.left = pair; used.add(pair.id); }
    }

    rows.push(row);
  }

  // Total progress
  const endEvent = timeline.find(e => e.id === "end");

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
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
      <div className="w-full h-1 bg-border rounded-full mb-10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500 bg-indigo-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 mb-10 px-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground uppercase tracking-widest text-[10px]">Левая сторона</span>— обследования и анализы</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground uppercase tracking-widest text-[10px]">Правая сторона</span>— лечение (циклы)</div>
        {[
          { color: "#a78bfa", label: "Цикл ХТ" },
          { color: "#60a5fa", label: "Анализ крови" },
          { color: "#fbbf24", label: "Контроль ПСА" },
          { color: "#34d399", label: "Визуализация" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* ── DUAL-SIDE TIMELINE ── */}
      <div className="relative">
        {rows.map((row, idx) => {
          const isCenter = !!row.center;
          const isLast = idx === rows.length - 1;

          return (
            <div key={idx} className="flex items-stretch min-h-[72px]">

              {/* ── LEFT COLUMN ── */}
              <div className="flex-1 flex justify-end pr-6 py-2">
                {row.left && (() => {
                  const ev = row.left;
                  const st = getStyle(ev.type, ev.isControl);
                  const done = completedIds.has(ev.id);
                  const active = activeId === ev.id;
                  return (
                    <div className="max-w-[280px] w-full">
                      <button
                        onClick={() => { setActiveId(active ? null : ev.id); }}
                        className={`w-full text-right transition-all ${done ? "opacity-40" : ""}`}
                      >
                        <div className={`inline-block px-4 py-2.5 rounded-2xl border transition-all text-right ${
                          active ? "border-current shadow-sm" : "border-transparent hover:border-border hover:bg-secondary/50"
                        }`} style={active ? { borderColor: st.color + "60", backgroundColor: st.color + "08" } : {}}>
                          <p className={`text-sm font-medium text-foreground ${done ? "line-through" : ""}`}>{ev.label}</p>
                          {ev.sublabel && <p className="text-xs text-muted-foreground mt-0.5">{ev.sublabel}</p>}
                          <p className="text-xs mt-1 font-mono" style={{ color: st.color }}>{formatDateShort(ev.date)}</p>
                        </div>
                      </button>
                      {active && (
                        <div className="mt-2 px-4 py-3 rounded-2xl text-right text-xs text-muted-foreground leading-relaxed border border-border bg-card">
                          {ev.type === "blood" && <><p className="font-medium text-foreground mb-1">Состав анализа</p><p>ОАК с лейкоформулой · АЛТ, АСТ, билирубин · Креатинин · Глюкоза</p></>}
                          {ev.type === "psa" && <><p className="font-medium text-foreground mb-1">ПСА</p><p>Снижение ≥ 50% от базового — биохимический ответ</p></>}
                          {ev.type === "imaging" && <><p className="font-medium text-foreground mb-1">{ev.label}</p><p>Оценка по критериям RECIST 1.1</p></>}
                          <button onClick={() => toggle(ev.id)}
                            className={`mt-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${done ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                            {done ? "Отмечено выполненным" : "Отметить выполненным"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── CENTER AXIS ── */}
              <div className="flex flex-col items-center" style={{ width: 56 }}>
                {/* top connector */}
                {idx > 0 && (
                  <div className="flex flex-col items-center" style={{ width: 4 }}>
                    {/* dashed gap segment */}
                    <div style={{ width: 3, height: 10, background: "repeating-linear-gradient(to bottom, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 8px)" }} />
                  </div>
                )}

                {/* dot */}
                {isCenter ? (
                  <div className="flex items-center justify-center rounded-full border-2 z-10 flex-shrink-0"
                    style={{
                      width: 20, height: 20,
                      borderColor: "#6366f1",
                      backgroundColor: "hsl(var(--background))",
                      boxShadow: `0 0 0 4px #6366f115`,
                    }}>
                    <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: "#6366f1" }} />
                  </div>
                ) : (
                  (() => {
                    const ev = row.right || row.left;
                    const st = ev ? getStyle(ev.type, ev.isControl) : { color: "#6b7280", dotSize: 8 };
                    const dotSz = row.right?.type === "cycle" ? 14 : 9;
                    return (
                      <div className="rounded-full flex-shrink-0 z-10"
                        style={{
                          width: dotSz, height: dotSz,
                          backgroundColor: st.color,
                          boxShadow: `0 0 0 3px ${st.color}25`,
                          margin: "0 auto",
                        }} />
                    );
                  })()
                )}

                {/* bottom connector line (solid, thicker) */}
                {!isLast && (
                  <div style={{
                    flex: 1,
                    width: 3,
                    background: "hsl(var(--border))",
                    minHeight: 24,
                  }} />
                )}
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div className="flex-1 flex justify-start pl-6 py-2">
                {row.center ? (
                  <div className="flex items-center h-full">
                    <div className="px-4 py-2 rounded-2xl border border-indigo-200 bg-indigo-50">
                      <p className="text-sm font-semibold text-indigo-700">{row.center.label}</p>
                      {row.center.sublabel && <p className="text-xs text-indigo-500 mt-0.5">{row.center.sublabel}</p>}
                      <p className="text-xs font-mono text-indigo-400 mt-1">{formatDateShort(row.center.date)}</p>
                    </div>
                  </div>
                ) : row.right && (() => {
                  const ev = row.right;
                  const st = getStyle(ev.type, ev.isControl);
                  const done = completedIds.has(ev.id);
                  const active = activeId === ev.id;
                  const isCycle = ev.type === "cycle";
                  return (
                    <div className="max-w-[280px] w-full">
                      <button
                        onClick={() => setActiveId(active ? null : ev.id)}
                        className={`w-full text-left transition-all ${done ? "opacity-40" : ""}`}
                      >
                        <div className={`inline-block w-full px-4 py-2.5 rounded-2xl border transition-all ${
                          isCycle ? "border-current" : "border-transparent hover:border-border hover:bg-secondary/50"
                        } ${active ? "shadow-sm" : ""}`}
                          style={isCycle
                            ? { borderColor: st.color + "50", backgroundColor: st.color + "10" }
                            : active ? { borderColor: st.color + "60", backgroundColor: st.color + "08" } : {}
                          }>
                          <p className={`text-sm font-medium text-foreground ${done ? "line-through" : ""} ${isCycle ? "font-semibold" : ""}`}>{ev.label}</p>
                          {ev.sublabel && <p className="text-xs text-muted-foreground mt-0.5">{ev.sublabel}</p>}
                          <p className="text-xs mt-1 font-mono" style={{ color: st.color }}>{formatDateShort(ev.date)}</p>
                        </div>
                      </button>
                      {active && (
                        <div className="mt-2 px-4 py-3 rounded-2xl text-xs text-muted-foreground leading-relaxed border border-border bg-card">
                          {ev.type === "cycle" && selectedScheme && (
                            <><p className="font-medium text-foreground mb-1">{selectedScheme.drug} {selectedScheme.dose}</p>
                            <p>В/в капельно, 1 час · каждые {selectedScheme.cycleDays} дней</p>
                            <p className="mt-1">Премедикация: дексаметазон — накануне, в день и на следующий день</p></>
                          )}
                          <button onClick={() => toggle(ev.id)}
                            className={`mt-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${done ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                            {done ? "Отмечено выполненным" : "Отметить выполненным"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>
          );
        })}
      </div>

    </main>
  );
}
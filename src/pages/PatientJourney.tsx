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
  type: "start" | "blood" | "psa" | "cycle" | "imaging" | "surgery" | "radiation" | "consult" | "custom_exam";
  label: string;
  sublabel?: string;
  date: Date;
  cycleNum?: number;
  isControl?: boolean;
  examName?: string;
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

// ── IMAGING DEFAULTS (used when no prior exams entered) ────────────────────

const DEFAULT_IMAGING = [
  "МРТ малого таза",
  "Рентген грудной клетки",
  "УЗИ брюшной полости",
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

function buildChemoTimeline(
  startDate: Date,
  scheme: ChemoScheme,
  cycles: number,
  priorExams: string[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let cursor = new Date(startDate);

  const imagingList = priorExams.length > 0 ? priorExams : DEFAULT_IMAGING;

  // Start event
  events.push({
    id: "start",
    type: "start",
    label: "Начало лечения",
    sublabel: `${scheme.name} ${scheme.dose} · ${cycles} циклов`,
    date: new Date(cursor),
  });

  for (let c = 1; c <= cycles; c++) {
    // Blood test before each cycle (day -2 before cycle)
    if (scheme.bloodBeforeCycle) {
      const bloodDate = c === 1 ? new Date(cursor) : addDays(cursor, -2);
      events.push({
        id: `blood-${c}`,
        type: "blood",
        label: "Общий и биохимический анализ крови",
        sublabel: `Перед циклом ${c}`,
        date: bloodDate,
        cycleNum: c,
      });
    }

    // Cycle infusion
    events.push({
      id: `cycle-${c}`,
      type: "cycle",
      label: `Цикл ${c} — ${scheme.drug}`,
      sublabel: `${scheme.dose} · в/в капельно`,
      date: new Date(cursor),
      cycleNum: c,
    });

    // PSA control after specified cycle
    if (scheme.psaAfterCycle && c === scheme.psaAfterCycle) {
      const psaDate = addDays(cursor, 5);
      events.push({
        id: `psa-${c}`,
        type: "psa",
        label: "Контроль ПСА",
        sublabel: `После цикла ${c} · контрольный анализ`,
        date: psaDate,
        cycleNum: c,
        isControl: true,
      });
    }

    // Imaging after specified cycle
    if (scheme.imagingAfterCycle && c === scheme.imagingAfterCycle) {
      const imgDate = addDays(cursor, 7);
      imagingList.forEach((exam, idx) => {
        events.push({
          id: `imaging-${c}-${idx}`,
          type: "imaging",
          label: exam,
          sublabel: `После цикла ${c} · контрольное обследование`,
          date: addDays(imgDate, idx),
          cycleNum: c,
          isControl: true,
          examName: exam,
        });
      });
    }

    // Also add PSA check after cycle 6 if total cycles = 9
    if (cycles === 9 && c === 6 && scheme.psaAfterCycle !== 6) {
      const psaDate2 = addDays(cursor, 5);
      events.push({
        id: `psa-mid`,
        type: "psa",
        label: "Контроль ПСА",
        sublabel: `После цикла 6 · промежуточный контроль`,
        date: psaDate2,
        cycleNum: 6,
        isControl: true,
      });
      // Imaging after cycle 6 for 9-cycle variant
      const imgDate2 = addDays(cursor, 7);
      imagingList.forEach((exam, idx) => {
        events.push({
          id: `imaging-6-${idx}`,
          type: "imaging",
          label: exam,
          sublabel: `После цикла 6 · промежуточный контроль`,
          date: addDays(imgDate2, idx),
          cycleNum: 6,
          isControl: true,
          examName: exam,
        });
      });
    }

    // Advance cursor by cycle duration
    cursor = addDays(cursor, scheme.cycleDays);
  }

  // Final PSA after last cycle (if not already added at last cycle)
  if (scheme.psaAfterCycle !== cycles) {
    events.push({
      id: "psa-final",
      type: "psa",
      label: "Контроль ПСА",
      sublabel: `После цикла ${cycles} · итоговый контроль`,
      date: addDays(cursor, 5),
      isControl: true,
    });
  }

  // Sort by date
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return events;
}

// ── EVENT VISUAL CONFIG ────────────────────────────────────────────────────

type EventConfig = {
  color: string;
  bg: string;
  icon: string;
  size: "lg" | "sm";
};

function getEventConfig(type: TimelineEvent["type"], isControl?: boolean): EventConfig {
  switch (type) {
    case "start":
      return { color: "#6366f1", bg: "#6366f115", icon: "Flag", size: "lg" };
    case "blood":
      return { color: "#3b82f6", bg: "#3b82f615", icon: "Droplets", size: "sm" };
    case "psa":
      return { color: isControl ? "#f59e0b" : "#3b82f6", bg: isControl ? "#f59e0b15" : "#3b82f615", icon: "FlaskConical", size: "sm" };
    case "cycle":
      return { color: "#8b5cf6", bg: "#8b5cf615", icon: "Syringe", size: "lg" };
    case "imaging":
      return { color: "#10b981", bg: "#10b98115", icon: "Scan", size: "sm" };
    case "surgery":
      return { color: "#ef4444", bg: "#ef444415", icon: "Stethoscope", size: "lg" };
    case "radiation":
      return { color: "#f97316", bg: "#f9731615", icon: "Zap", size: "lg" };
    case "consult":
      return { color: "#06b6d4", bg: "#06b6d415", icon: "UserCheck", size: "sm" };
    case "custom_exam":
      return { color: "#10b981", bg: "#10b98115", icon: "FileSearch", size: "sm" };
    default:
      return { color: "#6b7280", bg: "#6b728015", icon: "Circle", size: "sm" };
  }
}

// ── COMPONENT ──────────────────────────────────────────────────────────────

export default function PatientJourney() {
  // Step: "setup" | "exams" | "treatment" | "timeline"
  const [step, setStep] = useState<"setup" | "exams" | "treatment" | "timeline">("setup");

  // Setup
  const [councilDate, setCouncilDate] = useState("");
  const [councilDecision, setCouncilDecision] = useState<TreatmentType>(null);

  // Prior exams
  const [priorExams, setPriorExams] = useState<string[]>([]);
  const [newExam, setNewExam] = useState("");

  // Treatment
  const [selectedScheme, setSelectedScheme] = useState<ChemoScheme | null>(null);
  const [selectedCycles, setSelectedCycles] = useState<number | null>(null);
  const [treatmentStart, setTreatmentStart] = useState("");

  // Timeline
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // ── HANDLERS ──

  const addExam = () => {
    const t = newExam.trim();
    if (t && !priorExams.includes(t)) {
      setPriorExams((p) => [...p, t]);
      setNewExam("");
    }
  };

  const removeExam = (e: string) => setPriorExams((p) => p.filter((x) => x !== e));

  const buildTimeline = () => {
    if (!selectedScheme || !selectedCycles || !treatmentStart) return;
    const start = new Date(treatmentStart);
    const tl = buildChemoTimeline(start, selectedScheme, selectedCycles, priorExams);
    setTimeline(tl);
    setCompletedIds(new Set());
    setStep("timeline");
  };

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = timeline.length
    ? Math.round((completedIds.size / timeline.length) * 100)
    : 0;

  // ── STEP: SETUP ──────────────────────────────────────────────────────────

  if (step === "setup") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Трекер пути пациента</p>
          <h2 className="font-display text-4xl text-foreground mb-3">Решение консилиума</h2>
          <p className="text-muted-foreground">Введите дату консилиума и выберите тактику лечения</p>
        </div>

        <div className="space-y-6">
          {/* Date */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-sm font-medium text-foreground mb-3">Дата консилиума</p>
            <input
              type="date"
              value={councilDate}
              onChange={(e) => setCouncilDate(e.target.value)}
              max={today}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Decision */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-sm font-medium text-foreground mb-4">Решение консилиума</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "chemo" as TreatmentType, icon: "Syringe", label: "Химиотерапия", desc: "Системное лекарственное лечение" },
                { key: "surgery" as TreatmentType, icon: "Stethoscope", label: "Хирургическое лечение", desc: "Оперативное вмешательство" },
                { key: "radiation" as TreatmentType, icon: "Zap", label: "Лучевая терапия", desc: "Дистанционная или брахитерапия" },
                { key: "diagnostics" as TreatmentType, icon: "Scan", label: "Дообследование", desc: "Уточнение диагноза" },
              ].map(({ key, icon, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setCouncilDecision(key)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    councilDecision === key
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/30 hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={icon as "Syringe"} size={16} className="text-foreground" />
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!councilDate || !councilDecision}
            onClick={() => setStep("exams")}
            className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity disabled:opacity-40"
          >
            Далее — обследования до начала лечения
          </button>
        </div>
      </main>
    );
  }

  // ── STEP: EXAMS ──────────────────────────────────────────────────────────

  if (step === "exams") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
        <button onClick={() => setStep("setup")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <Icon name="ChevronLeft" size={16} />
          Назад
        </button>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Шаг 2 из 3</p>
          <h2 className="font-display text-4xl text-foreground mb-3">Обследования</h2>
          <p className="text-muted-foreground">Добавьте инструментальные обследования, выполненные до начала лечения. Они войдут в план контрольных исследований.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <p className="text-sm font-medium text-foreground mb-4">Добавить обследование</p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newExam}
              onChange={(e) => setNewExam(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExam()}
              placeholder="Например: МРТ малого таза, КТ органов грудной клетки…"
              className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
            />
            <button
              onClick={addExam}
              disabled={!newExam.trim()}
              className="px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40"
            >
              <Icon name="Plus" size={16} />
            </button>
          </div>

          {/* Quick add */}
          <div className="flex flex-wrap gap-2 mb-4">
            {["МРТ малого таза", "КТ органов грудной клетки", "УЗИ брюшной полости", "Рентген грудной клетки", "Остеосцинтиграфия", "ПЭТ-КТ"].map((exam) => (
              !priorExams.includes(exam) && (
                <button
                  key={exam}
                  onClick={() => setPriorExams((p) => [...p, exam])}
                  className="text-xs px-3 py-1.5 border border-dashed border-border rounded-lg text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                >
                  + {exam}
                </button>
              )
            ))}
          </div>

          {priorExams.length > 0 ? (
            <div className="space-y-2">
              {priorExams.map((exam) => (
                <div key={exam} className="flex items-center justify-between px-4 py-2.5 bg-secondary rounded-xl">
                  <div className="flex items-center gap-2">
                    <Icon name="Scan" size={14} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{exam}</span>
                  </div>
                  <button onClick={() => removeExam(exam)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="X" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
              Ничего не добавлено — будут использованы стандартные методы визуализации
            </p>
          )}
        </div>

        <button
          onClick={() => setStep("treatment")}
          className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity"
        >
          Далее — параметры лечения
        </button>
      </main>
    );
  }

  // ── STEP: TREATMENT ──────────────────────────────────────────────────────

  if (step === "treatment") {
    const schemes = councilDecision === "chemo" ? CHEMO_SCHEMES : [];

    return (
      <main className="max-w-2xl mx-auto px-6 py-12 animate-fade-in">
        <button onClick={() => setStep("exams")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <Icon name="ChevronLeft" size={16} />
          Назад
        </button>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Шаг 3 из 3</p>
          <h2 className="font-display text-4xl text-foreground mb-3">Параметры лечения</h2>
          <p className="text-muted-foreground">Выберите схему, количество циклов и дату начала</p>
        </div>

        {councilDecision === "chemo" && (
          <div className="space-y-6">
            {/* Scheme */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-sm font-medium text-foreground mb-4">Схема химиотерапии</p>
              <div className="space-y-3">
                {schemes.map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => { setSelectedScheme(scheme); setSelectedCycles(null); }}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedScheme?.id === scheme.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{scheme.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{scheme.drug} · {scheme.dose} · каждые {scheme.cycleDays} дней</p>
                      </div>
                      {selectedScheme?.id === scheme.id && (
                        <Icon name="CheckCircle" size={18} className="text-foreground flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                    <div className="flex gap-3 mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs text-muted-foreground">ОАК + биохимия перед каждым циклом</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">ПСА после цикла {scheme.psaAfterCycle}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cycles */}
            {selectedScheme && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <p className="text-sm font-medium text-foreground mb-4">Количество циклов</p>
                <div className="flex gap-3">
                  {selectedScheme.cycleOptions.map((n) => (
                    <button
                      key={n}
                      onClick={() => setSelectedCycles(n)}
                      className={`flex-1 py-4 rounded-xl border-2 font-semibold text-lg transition-all ${
                        selectedCycles === n
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {n} циклов
                      <p className="text-xs font-normal mt-0.5 opacity-70">
                        ≈ {Math.round((n * selectedScheme.cycleDays) / 30)} мес.
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Start date */}
            {selectedCycles && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <p className="text-sm font-medium text-foreground mb-3">Дата начала лечения (цикл 1)</p>
                <input
                  type="date"
                  value={treatmentStart}
                  onChange={(e) => setTreatmentStart(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            )}

            <button
              disabled={!selectedScheme || !selectedCycles || !treatmentStart}
              onClick={buildTimeline}
              className="w-full py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity disabled:opacity-40"
            >
              Построить план лечения
            </button>
          </div>
        )}

        {(councilDecision === "surgery" || councilDecision === "radiation" || councilDecision === "diagnostics") && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
            <Icon name="Construction" size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Раздел в разработке</p>
              <p className="text-sm text-amber-700 leading-relaxed">
                Шаблоны для хирургического лечения, лучевой терапии и дообследования появятся в следующих версиях.
                Сейчас доступна химиотерапия по схеме Доцетаксел.
              </p>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ── STEP: TIMELINE ───────────────────────────────────────────────────────

  const cycleEvents = timeline.filter((e) => e.type === "cycle");
  const lastCycle = cycleEvents[cycleEvents.length - 1];
  const endDate = lastCycle ? addDays(lastCycle.date, selectedScheme?.cycleDays ?? 21) : null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Трекер пути пациента</p>
          <h2 className="font-display text-3xl text-foreground">
            {selectedScheme?.name} · {selectedCycles} циклов
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(new Date(treatmentStart))}
            {endDate && ` — ${formatDate(endDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Выполнено</p>
            <p className="font-display text-2xl text-foreground">{progress}%</p>
          </div>
          <button
            onClick={() => { setStep("setup"); setTimeline([]); setSelectedScheme(null); setSelectedCycles(null); setTreatmentStart(""); setCouncilDate(""); setCouncilDecision(null); setPriorExams([]); }}
            className="px-4 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Новый план
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-secondary rounded-full mb-10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: "#6366f1" }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-8">
        {[
          { color: "#8b5cf6", label: "Цикл ХТ" },
          { color: "#3b82f6", label: "Анализ крови" },
          { color: "#f59e0b", label: "Контроль ПСА" },
          { color: "#10b981", label: "Визуализация" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-1">
          {timeline.map((event, idx) => {
            const cfg = getEventConfig(event.type, event.isControl);
            const done = completedIds.has(event.id);
            const isExpanded = expandedId === event.id;
            const isLarge = cfg.size === "lg";

            // Insert month separator
            const prevEvent = idx > 0 ? timeline[idx - 1] : null;
            const showMonth = !prevEvent ||
              prevEvent.date.getMonth() !== event.date.getMonth() ||
              prevEvent.date.getFullYear() !== event.date.getFullYear();

            return (
              <div key={event.id}>
                {showMonth && (
                  <div className="flex items-center gap-3 py-3 pl-14">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {event.date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  {/* Node */}
                  <div className="relative flex-shrink-0 z-10" style={{ width: 44 }}>
                    <div
                      className={`flex items-center justify-center rounded-full transition-all ${isLarge ? "w-10 h-10" : "w-8 h-8"} ${done ? "opacity-50" : ""}`}
                      style={{
                        backgroundColor: done ? "#6b728020" : cfg.bg,
                        border: `2px solid ${done ? "#6b7280" : cfg.color}`,
                        marginLeft: isLarge ? 0 : 4,
                        marginTop: 2,
                      }}
                    >
                      <Icon name={cfg.icon as "Flag"} size={isLarge ? 16 : 13} style={{ color: done ? "#6b7280" : cfg.color }} />
                    </div>
                  </div>

                  {/* Card */}
                  <div
                    className={`flex-1 mb-2 rounded-2xl border transition-all cursor-pointer select-none ${
                      done ? "opacity-50" : ""
                    } ${isExpanded ? "shadow-sm" : ""} ${
                      isLarge ? "border-border bg-card" : "border-transparent bg-transparent hover:bg-secondary/60"
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  >
                    <div className={`flex items-center justify-between gap-4 ${isLarge ? "p-4" : "px-4 py-2.5"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium text-foreground ${isLarge ? "text-base" : "text-sm"} ${done ? "line-through" : ""}`}>
                            {event.label}
                          </p>
                          {event.isControl && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: cfg.color + "20", color: cfg.color }}>
                              контроль
                            </span>
                          )}
                        </div>
                        {event.sublabel && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.sublabel}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateShort(event.date)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleComplete(event.id); }}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            done
                              ? "border-green-500 bg-green-500"
                              : "border-border hover:border-foreground/40"
                          }`}
                        >
                          {done && <Icon name="Check" size={12} className="text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border mt-0">
                        <div className="pt-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon name="Calendar" size={14} />
                            <span>Плановая дата: <strong className="text-foreground">{formatDate(event.date)}</strong></span>
                          </div>
                          {event.cycleNum && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Icon name="Hash" size={14} />
                              <span>Цикл: <strong className="text-foreground">{event.cycleNum}</strong></span>
                            </div>
                          )}
                          {event.type === "cycle" && selectedScheme && (
                            <div className="mt-3 p-3 bg-secondary rounded-xl">
                              <p className="text-xs font-semibold text-foreground mb-1">{selectedScheme.drug}</p>
                              <p className="text-xs text-muted-foreground">Доза: {selectedScheme.dose} (рассчитывается по площади поверхности тела)</p>
                              <p className="text-xs text-muted-foreground">Введение: в/в капельно, 1 час</p>
                              <p className="text-xs text-muted-foreground">Премедикация: дексаметазон за день до, в день и на следующий день</p>
                            </div>
                          )}
                          {event.type === "blood" && (
                            <div className="mt-3 p-3 bg-secondary rounded-xl space-y-1">
                              <p className="text-xs font-semibold text-foreground mb-1">Состав анализа</p>
                              {["Общий анализ крови с лейкоформулой", "АЛТ, АСТ, билирубин", "Креатинин, мочевина", "Глюкоза"].map((t) => (
                                <p key={t} className="text-xs text-muted-foreground">• {t}</p>
                              ))}
                            </div>
                          )}
                          {event.type === "psa" && (
                            <div className="mt-3 p-3 bg-secondary rounded-xl">
                              <p className="text-xs font-semibold text-foreground mb-1">ПСА (простатспецифический антиген)</p>
                              <p className="text-xs text-muted-foreground">Сравнить с базовым значением до начала лечения. Снижение ≥ 50% — биохимический ответ.</p>
                            </div>
                          )}
                          {event.type === "imaging" && (
                            <div className="mt-3 p-3 bg-secondary rounded-xl">
                              <p className="text-xs font-semibold text-foreground mb-1">{event.examName}</p>
                              <p className="text-xs text-muted-foreground">Оценка ответа на лечение по критериям RECIST 1.1</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* End node */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex-shrink-0 z-10" style={{ width: 44 }}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all ${
                progress === 100 ? "border-green-500 bg-green-500" : "border-dashed border-border bg-background"
              }`}>
                <Icon name={progress === 100 ? "Trophy" : "FlagOff"} size={16} className={progress === 100 ? "text-white" : "text-muted-foreground"} />
              </div>
            </div>
            <div className="flex-1 py-2">
              <p className={`font-medium ${progress === 100 ? "text-green-600" : "text-muted-foreground"}`}>
                {progress === 100 ? "Курс лечения завершён" : "Окончание курса лечения"}
              </p>
              {endDate && <p className="text-xs text-muted-foreground">{formatDate(endDate)}</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

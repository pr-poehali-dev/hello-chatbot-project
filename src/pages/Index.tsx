import { useState } from "react";
import Icon from "@/components/ui/icon";

type Section = "home" | "tracker" | "reference";

// Симптомы с градацией интенсивности (субъективно оцениваемые / функционально значимые)
// Вес по интенсивности: 1-2 → 0 баллов, 3 → 0.5, 4 → 1.0, 5 → 2.0
const GRADED_SYMPTOMS = new Set([
  "Слабость", "Усталость", "Снижение аппетита",
  "Одышка", "Кашель", "Кашель с мокротой", "Боль в груди", "Свистящее дыхание",
  "Учащённое сердцебиение", "Отёки ног", "Головокружение",
  "Тошнота", "Рвота", "Боль в животе", "Диарея", "Запор", "Изжога", "Вздутие живота",
  "Головная боль", "Нарушение сна", "Тревожность", "Раздражительность",
  "Боль в суставах", "Боль в спине", "Боль в мышцах", "Ограничение подвижности",
]);

// Бинарные симптомы (сам факт наличия = 1 балл, без градации)
// Кровохарканье, обмороки и т.п. — клинически значимы независимо от интенсивности
const BINARY_SYMPTOMS = new Set([
  "Потеря веса", "Повышенная температура", "Ночная потливость",
  "Кровохарканье",
  "Перебои в работе сердца", "Обмороки",
  "Онемение конечностей", "Нарушение памяти",
  "Отёк суставов",
]);

// Максимально возможный балл (для нормировки)
// GRADED: каждый может дать max 2.0 | BINARY: каждый даёт 1.0
const MAX_SCORE = GRADED_SYMPTOMS.size * 2.0 + BINARY_SYMPTOMS.size * 1.0;

const SYMPTOM_GROUPS: { title: string; symptoms: string[] }[] = [
  {
    title: "Общее состояние",
    symptoms: ["Слабость", "Усталость", "Снижение аппетита", "Потеря веса", "Повышенная температура", "Ночная потливость"],
  },
  {
    title: "Дыхание",
    symptoms: ["Одышка", "Кашель", "Кашель с мокротой", "Боль в груди", "Кровохарканье", "Свистящее дыхание"],
  },
  {
    title: "Сердечно-сосудистые",
    symptoms: ["Учащённое сердцебиение", "Перебои в работе сердца", "Отёки ног", "Головокружение", "Обмороки"],
  },
  {
    title: "Пищеварение",
    symptoms: ["Тошнота", "Рвота", "Боль в животе", "Диарея", "Запор", "Изжога", "Вздутие живота"],
  },
  {
    title: "Нервная система",
    symptoms: ["Головная боль", "Нарушение сна", "Тревожность", "Онемение конечностей", "Нарушение памяти", "Раздражительность"],
  },
  {
    title: "Опорно-двигательный аппарат",
    symptoms: ["Боль в суставах", "Боль в спине", "Боль в мышцах", "Ограничение подвижности", "Отёк суставов"],
  },
];

const INTENSITY_LABELS: Record<number, string> = {
  1: "Едва заметно",
  2: "Слабо",
  3: "Умеренно",
  4: "Сильно",
  5: "Очень сильно",
};

// Вес одного симптома в баллах
function symptomWeight(name: string, intensity: number): number {
  if (BINARY_SYMPTOMS.has(name)) return 1.0;
  // GRADED: 1-2 → 0, 3 → 0.5, 4 → 1.0, 5 → 2.0
  if (intensity <= 2) return 0;
  if (intensity === 3) return 0.5;
  if (intensity === 4) return 1.0;
  return 2.0;
}

const ECOG_LEVELS = [
  { score: 0, label: "Норма", desc: "Полностью активен, без ограничений", color: "#4caf7d" },
  { score: 1, label: "Лёгкое снижение", desc: "Ограничен в тяжёлой физической работе, ходит и выполняет лёгкий труд", color: "#8bc34a" },
  { score: 2, label: "Умеренное снижение", desc: "Ходит и обслуживает себя, но не может работать. До 50% дня на ногах", color: "#ffc107" },
  { score: 3, label: "Значительное снижение", desc: "Ограниченное самообслуживание. Более 50% дня в постели или кресле", color: "#ff9800" },
  { score: 4, label: "Тяжёлое нарушение", desc: "Не способен к самообслуживанию, прикован к постели или креслу", color: "#f44336" },
];

function calcEcog(selected: Record<string, number>): { score: number; points: number; percent: number } {
  const points = Object.entries(selected).reduce(
    (acc, [name, intensity]) => acc + symptomWeight(name, intensity),
    0
  );
  const percent = Math.min((points / MAX_SCORE) * 100, 100);
  let score = 0;
  if (percent === 0) score = 0;
  else if (percent < 8) score = 0;
  else if (percent < 20) score = 1;
  else if (percent < 38) score = 2;
  else if (percent < 58) score = 3;
  else score = 4;
  return { score, points, percent };
}

const REFERENCE_SECTIONS = [
  {
    title: "Что такое рак простаты?",
    icon: "Info",
    content: "Рак предстательной железы — злокачественная опухоль, развивающаяся из железистых клеток простаты. Занимает второе место по распространённости среди онкологических заболеваний у мужчин. Чаще всего диагностируется у мужчин старше 50 лет.",
  },
  {
    title: "Симптомы и признаки",
    icon: "AlertCircle",
    content: "На ранних стадиях рак простаты протекает бессимптомно. При прогрессировании возникают: затруднённое мочеиспускание, учащённые позывы (особенно ночью), слабая струя мочи, примесь крови в моче или сперме, дискомфорт в промежности.",
  },
  {
    title: "Диагностика",
    icon: "Microscope",
    content: "Основные методы диагностики: анализ крови на ПСА (простат-специфический антиген), пальцевое ректальное исследование, МРТ малого таза, трансректальное УЗИ с биопсией. Стадирование проводится по системе TNM и шкале Глисона.",
  },
  {
    title: "Стадии заболевания",
    icon: "Layers",
    content: "I–II стадии: опухоль в пределах железы. III стадия: прорастание за пределы капсулы, возможное поражение семенных пузырьков. IV стадия: метастазы в лимфоузлы, кости (таз, позвоночник), лёгкие, печень.",
  },
  {
    title: "Методы лечения",
    icon: "Zap",
    content: "Радикальная простатэктомия (хирургическое удаление), лучевая терапия (дистанционная, брахитерапия), гормональная терапия (андрогенная депривация), химиотерапия при кастрационно-резистентном раке, таргетная терапия (олапариб при мутациях BRCA).",
  },
  {
    title: "Шкала ECOG в онкологии",
    icon: "BarChart2",
    content: "Шкала ECOG/ВОЗ оценивает функциональный статус пациента от 0 (норма) до 4 (полная нетрудоспособность). Определяет переносимость лечения, выбор схемы химиотерапии и прогноз. Пациенты с ECOG ≥ 3 требуют особого подхода при назначении системного лечения.",
  },
];

export default function Index() {
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [openRef, setOpenRef] = useState<number | null>(null);

  const toggleSymptom = (symptom: string) => {
    setSelected((prev) => {
      if (prev[symptom]) {
        const next = { ...prev };
        delete next[symptom];
        return next;
      }
      return { ...prev, [symptom]: 3 };
    });
    setSaved(false);
  };

  const setIntensity = (symptom: string, value: number) => {
    setSelected((prev) => ({ ...prev, [symptom]: value }));
    setSaved(false);
  };

  const selectedCount = Object.keys(selected).length;
  const { score: ecogScore, points: ecogPoints, percent: ecogPercent } = calcEcog(selected);
  const ecogInfo = ECOG_LEVELS[ecogScore];

  const handleSave = () => setSaved(true);
  const handleReset = () => { setSelected({}); setSaved(false); };

  const navItems: { key: Section; label: string }[] = [
    { key: "home", label: "Главная" },
    { key: "tracker", label: "Трекер симптомов" },
    { key: "reference", label: "Справочник" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSection("home")}>
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">О</span>
            </div>
            <span className="font-semibold text-foreground tracking-tight text-lg">
              Онкопроводник
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  section === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── HOME ── */}
      {section === "home" && (
        <main className="max-w-5xl mx-auto px-6">
          <section className="pt-20 pb-16 animate-fade-in">
            <p className="text-sm font-medium uppercase tracking-widest mb-6" style={{ color: "hsl(var(--accent))" }}>
              Цифровая онкология
            </p>
            <h1 className="font-display text-6xl md:text-7xl text-foreground leading-tight mb-6">
              Онкопроводник —<br />
              <em>ваш надёжный гид</em>
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl leading-relaxed mb-10">
              Инструмент для структурированного сбора жалоб, оценки функционального
              статуса по шкале ECOG и информирования пациентов об онкологических заболеваниях.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => setSection("tracker")}
                className="px-7 py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity"
              >
                Открыть трекер
              </button>
              <button
                onClick={() => setSection("reference")}
                className="px-7 py-3.5 border border-border rounded-xl font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Справочник
              </button>
            </div>
          </section>

          <div className="border-t border-border" />

          <section className="py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "ClipboardList",
                title: "Трекер симптомов",
                desc: "Выбирайте симптомы из готового списка и указывайте интенсивность. Никакого ввода вручную.",
              },
              {
                icon: "BarChart2",
                title: "Оценка ECOG",
                desc: "Каждый отмеченный симптом учитывается в расчёте функционального статуса пациента по шкале ECOG.",
              },
              {
                icon: "BookOpen",
                title: "Справочник",
                desc: "Структурированная информация по нозологиям: симптомы, диагностика, стадии и методы лечения.",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 0.15}s`, opacity: 0 }}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <Icon name={f.icon} size={22} className="text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </section>

          <div className="border-t border-border" />

          {/* ECOG preview */}
          <section className="py-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
              Шкала ECOG / ВОЗ
            </p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {ECOG_LEVELS.map((lvl) => (
                <div key={lvl.score} className="bg-card border border-border rounded-xl p-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
                    style={{ backgroundColor: lvl.color }}
                  >
                    {lvl.score}
                  </div>
                  <p className="font-semibold text-foreground text-sm mb-1">{lvl.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{lvl.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-border" />

          <section className="py-16 grid grid-cols-3 gap-8 text-center">
            {[
              { value: "35+", label: "симптомов в трекере" },
              { value: "ECOG 0–4", label: "функциональный статус" },
              { value: "МКБ-10", label: "кодировка нозологий" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-5xl text-foreground mb-2">{stat.value}</div>
                <div className="text-muted-foreground text-sm">{stat.label}</div>
              </div>
            ))}
          </section>

          <section className="pb-16">
            <div className="bg-foreground rounded-2xl px-10 py-12 text-center">
              <h2 className="font-display text-4xl text-background mb-4">Попробуйте прямо сейчас</h2>
              <p className="text-background/60 mb-8 max-w-md mx-auto">
                Отметьте симптомы пациента и получите автоматическую оценку ECOG — без регистрации.
              </p>
              <button
                onClick={() => setSection("tracker")}
                className="px-8 py-3.5 bg-background text-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Открыть трекер
              </button>
            </div>
          </section>
        </main>
      )}

      {/* ── TRACKER ── */}
      {section === "tracker" && (
        <main className="max-w-4xl mx-auto px-6 py-12 animate-fade-in">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="font-display text-4xl text-foreground mb-2">Трекер симптомов</h2>
              <p className="text-muted-foreground">Отметьте всё, что беспокоит пациента сегодня</p>
            </div>
            {selectedCount > 0 && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-muted-foreground">
                  Отмечено: <strong className="text-foreground">{selectedCount}</strong>
                </span>
                <button
                  onClick={handleReset}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Сбросить
                </button>
              </div>
            )}
          </div>

          {/* ECOG Panel */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Функциональный статус ECOG
                </p>
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-display text-5xl font-bold"
                    style={{ color: ecogInfo.color }}
                  >
                    {ecogScore}
                  </span>
                  <span className="font-semibold text-foreground text-lg">{ecogInfo.label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">{ecogInfo.desc}</p>
              </div>
              <div className="hidden md:flex flex-col items-end gap-1.5">
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{ecogPoints.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">баллов из {MAX_SCORE.toFixed(0)}</p>
                </div>
                <span className="text-xs text-muted-foreground">{selectedCount} симптомов отмечено</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(ecogPercent, selectedCount > 0 ? 2 : 0)}%`,
                  backgroundColor: ecogInfo.color,
                }}
              />
            </div>

            {/* ECOG dots */}
            <div className="flex gap-2 mt-3">
              {ECOG_LEVELS.map((lvl) => (
                <div
                  key={lvl.score}
                  className="flex items-center gap-1.5"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full transition-all"
                    style={{
                      backgroundColor: lvl.color,
                      opacity: ecogScore >= lvl.score ? 1 : 0.25,
                      transform: ecogScore === lvl.score ? "scale(1.4)" : "scale(1)",
                    }}
                  />
                  <span
                    className="text-xs"
                    style={{
                      color: ecogScore === lvl.score ? lvl.color : undefined,
                      fontWeight: ecogScore === lvl.score ? 600 : 400,
                    }}
                  >
                    {lvl.score}
                  </span>
                </div>
              ))}
              <span className="text-xs text-muted-foreground ml-2 self-center">ECOG</span>
            </div>
          </div>

          {/* Symptom groups */}
          <div className="space-y-10">
            {SYMPTOM_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  {group.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.symptoms.map((symptom) => {
                    const isSelected = !!selected[symptom];
                    const isBinary = BINARY_SYMPTOMS.has(symptom);
                    const currentWeight = isSelected ? symptomWeight(symptom, selected[symptom]) : 0;
                    return (
                      <div key={symptom} className="flex flex-col">
                        <button
                          onClick={() => toggleSymptom(symptom)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                            isSelected
                              ? "bg-foreground text-background border-foreground"
                              : "bg-card text-foreground border-border hover:border-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <Icon name="Check" size={12} className="inline mr-1.5 -mt-0.5" />
                          )}
                          {symptom}
                          {!isSelected && isBinary && (
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">·1</span>
                          )}
                        </button>
                        {isSelected && isBinary && (
                          <p className="text-xs text-muted-foreground mt-1.5 px-1">
                            +1.0 балл (факт наличия)
                          </p>
                        )}
                        {isSelected && !isBinary && (
                          <div className="mt-2 px-1 animate-fade-in">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <button
                                  key={v}
                                  onClick={() => setIntensity(symptom, v)}
                                  className={`w-6 h-6 rounded-full text-xs font-semibold transition-all ${
                                    selected[symptom] >= v
                                      ? "bg-foreground text-background"
                                      : "bg-secondary text-muted-foreground hover:bg-border"
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 pl-0.5">
                              {INTENSITY_LABELS[selected[symptom]]}
                              {" · "}
                              <span className="font-medium text-foreground">
                                {currentWeight === 0 ? "0 баллов" : `+${currentWeight} балл${currentWeight === 2 ? "а" : ""}`}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Save panel */}
          {selectedCount > 0 && (
            <div className="sticky bottom-6 mt-12">
              <div className="bg-card border border-border rounded-2xl px-6 py-4 flex items-center justify-between shadow-lg shadow-foreground/5">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedCount}&nbsp;
                    {selectedCount === 1 ? "симптом" : selectedCount < 5 ? "симптома" : "симптомов"} · {ecogPoints.toFixed(1)} балл. · ECOG&nbsp;
                    <span style={{ color: ecogInfo.color, fontWeight: 600 }}>{ecogScore}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {saved ? "Запись сохранена ✓" : "Готово к сохранению"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saved && (
                    <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "hsl(var(--accent))" }}>
                      <Icon name="CheckCircle" size={16} />
                      Сохранено
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saved}
                    className="px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40"
                  >
                    Сохранить запись
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── REFERENCE ── */}
      {section === "reference" && (
        <main className="max-w-4xl mx-auto px-6 py-12 animate-fade-in">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Нозология · МКБ-10: C61
            </p>
            <h2 className="font-display text-4xl text-foreground mb-3">Рак предстательной железы</h2>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Структурированная справочная информация для медицинских специалистов и пациентов.
              Данные основаны на актуальных клинических рекомендациях.
            </p>
          </div>

          <div className="space-y-3">
            {REFERENCE_SECTIONS.map((item, i) => (
              <div
                key={item.title}
                className="bg-card border border-border rounded-2xl overflow-hidden transition-all"
              >
                <button
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                  onClick={() => setOpenRef(openRef === i ? null : i)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <Icon name={item.icon} size={18} className="text-foreground" />
                    </div>
                    <span className="font-semibold text-foreground">{item.title}</span>
                  </div>
                  <Icon
                    name="ChevronDown"
                    size={18}
                    className="text-muted-foreground transition-transform flex-shrink-0"
                    style={{ transform: openRef === i ? "rotate(180deg)" : "rotate(0deg)" } as React.CSSProperties}
                  />
                </button>
                {openRef === i && (
                  <div className="px-6 pb-6 animate-fade-in">
                    <div className="border-t border-border pt-4">
                      <p className="text-foreground leading-relaxed">{item.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 bg-secondary rounded-2xl px-6 py-5 flex items-start gap-4">
            <Icon name="Info" size={18} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Информация носит справочный характер и не заменяет консультацию онколога.
              Для постановки диагноза и назначения лечения обратитесь к специалисту.
            </p>
          </div>
        </main>
      )}

      <footer className="border-t border-border mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">© 2026 Онкопроводник — демо-версия</span>
          <span className="text-sm text-muted-foreground">Для медицинских специалистов</span>
        </div>
      </footer>
    </div>
  );
}
import { useState } from "react";
import Icon from "@/components/ui/icon";

type Section = "home" | "tracker";

const SYMPTOM_GROUPS = [
  {
    title: "Общее состояние",
    symptoms: [
      "Слабость",
      "Усталость",
      "Снижение аппетита",
      "Потеря веса",
      "Повышенная температура",
      "Ночная потливость",
    ],
  },
  {
    title: "Дыхание",
    symptoms: [
      "Одышка",
      "Кашель",
      "Кашель с мокротой",
      "Боль в груди",
      "Кровохарканье",
      "Свистящее дыхание",
    ],
  },
  {
    title: "Сердечно-сосудистые",
    symptoms: [
      "Учащённое сердцебиение",
      "Перебои в работе сердца",
      "Отёки ног",
      "Головокружение",
      "Обмороки",
    ],
  },
  {
    title: "Пищеварение",
    symptoms: [
      "Тошнота",
      "Рвота",
      "Боль в животе",
      "Диарея",
      "Запор",
      "Изжога",
      "Вздутие живота",
    ],
  },
  {
    title: "Нервная система",
    symptoms: [
      "Головная боль",
      "Нарушение сна",
      "Тревожность",
      "Онемение конечностей",
      "Нарушение памяти",
      "Раздражительность",
    ],
  },
  {
    title: "Опорно-двигательный аппарат",
    symptoms: [
      "Боль в суставах",
      "Боль в спине",
      "Боль в мышцах",
      "Ограничение подвижности",
      "Отёк суставов",
    ],
  },
];

const INTENSITY_LABELS: Record<number, string> = {
  1: "Едва заметно",
  2: "Слабо",
  3: "Умеренно",
  4: "Сильно",
  5: "Очень сильно",
};

export default function Index() {
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

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

  const handleSave = () => {
    setSaved(true);
  };

  const handleReset = () => {
    setSelected({});
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">М</span>
            </div>
            <span className="font-semibold text-foreground tracking-tight text-lg">
              МедАссистент
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setSection("home")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                section === "home"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              Главная
            </button>
            <button
              onClick={() => setSection("tracker")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                section === "tracker"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              Трекер симптомов
            </button>
          </nav>
        </div>
      </header>

      {/* Home Section */}
      {section === "home" && (
        <main className="max-w-5xl mx-auto px-6">
          {/* Hero */}
          <section className="pt-20 pb-16 animate-fade-in">
            <p className="text-sm font-medium text-accent uppercase tracking-widest mb-6">
              Цифровое здоровье
            </p>
            <h1 className="font-display text-6xl md:text-7xl text-foreground leading-tight mb-6">
              Ваше здоровье —<br />
              <em>в ваших руках</em>
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl leading-relaxed mb-10">
              Умный помощник для отслеживания симптомов, понимания своего состояния
              и своевременного обращения к врачу.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSection("tracker")}
                className="px-7 py-3.5 bg-foreground text-background rounded-xl font-medium hover:opacity-85 transition-opacity"
              >
                Начать отслеживание
              </button>
              <button className="px-7 py-3.5 border border-border rounded-xl font-medium text-foreground hover:bg-secondary transition-colors">
                Узнать больше
              </button>
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Features */}
          <section className="py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "ClipboardList",
                title: "Трекер симптомов",
                desc: "Выбирайте симптомы из готового списка — быстро и без ошибок. Укажите интенсивность одним касанием.",
              },
              {
                icon: "TrendingUp",
                title: "Динамика состояния",
                desc: "Наблюдайте за изменениями симптомов во времени. Графики помогают увидеть прогресс лечения.",
              },
              {
                icon: "Stethoscope",
                title: "Консультация врача",
                desc: "Передавайте данные врачу в структурированном виде. Экономьте время приёма на действительно важное.",
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

          {/* Stats */}
          <section className="py-16 grid grid-cols-3 gap-8 text-center">
            {[
              { value: "200+", label: "симптомов в базе" },
              { value: "15 МКБ", label: "нозологических классов" },
              { value: "3 мин", label: "на первичный опрос" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-5xl text-foreground mb-2">
                  {stat.value}
                </div>
                <div className="text-muted-foreground text-sm">{stat.label}</div>
              </div>
            ))}
          </section>

          {/* CTA */}
          <section className="pb-16">
            <div className="bg-foreground rounded-2xl px-10 py-12 text-center">
              <h2 className="font-display text-4xl text-background mb-4">
                Готовы попробовать?
              </h2>
              <p className="text-background/60 mb-8 max-w-md mx-auto">
                Запустите демо-версию трекера прямо сейчас — без регистрации.
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

      {/* Tracker Section */}
      {section === "tracker" && (
        <main className="max-w-4xl mx-auto px-6 py-12 animate-fade-in">
          <div className="flex items-start justify-between mb-10">
            <div>
              <h2 className="font-display text-4xl text-foreground mb-2">
                Трекер симптомов
              </h2>
              <p className="text-muted-foreground">
                Отметьте всё, что беспокоит вас сегодня
              </p>
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

          <div className="space-y-10">
            {SYMPTOM_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  {group.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.symptoms.map((symptom) => {
                    const isSelected = !!selected[symptom];
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
                            <Icon
                              name="Check"
                              size={12}
                              className="inline mr-1.5 -mt-0.5"
                            />
                          )}
                          {symptom}
                        </button>

                        {isSelected && (
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

          {selectedCount > 0 && (
            <div className="sticky bottom-6 mt-12">
              <div className="bg-card border border-border rounded-2xl px-6 py-4 flex items-center justify-between shadow-lg shadow-foreground/5">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedCount}&nbsp;
                    {selectedCount === 1
                      ? "симптом отмечен"
                      : selectedCount < 5
                      ? "симптома отмечено"
                      : "симптомов отмечено"}
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

      <footer className="border-t border-border mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">© 2026 МедАссистент — демо-версия</span>
          <span className="text-sm text-muted-foreground">Для медицинских специалистов</span>
        </div>
      </footer>
    </div>
  );
}

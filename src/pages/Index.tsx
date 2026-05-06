import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";

type Section = "home" | "tracker" | "calendar" | "reference";

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

// Шкала нормирована на 10 баллов для удобства восприятия
const MAX_SCORE = 10;

const SYMPTOM_GROUPS: { title: string; symptoms: string[] }[] = [
  {
    title: "Общее состояние",
    // лёгкие → тяжёлые: усталость → слабость → аппетит → температура → ночная потливость → потеря веса
    symptoms: ["Усталость", "Слабость", "Снижение аппетита", "Повышенная температура", "Ночная потливость", "Потеря веса"],
  },
  {
    title: "Дыхание",
    // лёгкие → тяжёлые: кашель → с мокротой → свистящее → одышка → боль в груди → кровохарканье
    symptoms: ["Кашель", "Кашель с мокротой", "Свистящее дыхание", "Одышка", "Боль в груди", "Кровохарканье"],
  },
  {
    title: "Сердечно-сосудистые",
    // лёгкие → тяжёлые: сердцебиение → отёки → головокружение → перебои → обмороки
    symptoms: ["Учащённое сердцебиение", "Отёки ног", "Головокружение", "Перебои в работе сердца", "Обмороки"],
  },
  {
    title: "Пищеварение",
    // лёгкие → тяжёлые: изжога → вздутие → запор → диарея → тошнота → рвота → боль в животе
    symptoms: ["Изжога", "Вздутие живота", "Запор", "Диарея", "Тошнота", "Рвота", "Боль в животе"],
  },
  {
    title: "Нервная система",
    // лёгкие → тяжёлые: раздражительность → тревожность → нарушение сна → головная боль → нарушение памяти → онемение
    symptoms: ["Раздражительность", "Тревожность", "Нарушение сна", "Головная боль", "Нарушение памяти", "Онемение конечностей"],
  },
  {
    title: "Опорно-двигательный аппарат",
    // лёгкие → тяжёлые: боль в мышцах → боль в суставах → отёк суставов → боль в спине → ограничение подвижности
    symptoms: ["Боль в мышцах", "Боль в суставах", "Отёк суставов", "Боль в спине", "Ограничение подвижности"],
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
  const points = Math.min(
    Object.entries(selected).reduce(
      (acc, [name, intensity]) => acc + symptomWeight(name, intensity),
      0
    ),
    MAX_SCORE
  );
  const percent = (points / MAX_SCORE) * 100;
  // Пороги на 10-балльной шкале: 0→<0.5, 1→<2, 2→<4, 3→<7, 4→≥7
  let score = 0;
  if (points < 0.5) score = 0;
  else if (points < 2) score = 1;
  else if (points < 4) score = 2;
  else if (points < 7) score = 3;
  else score = 4;
  return { score, points, percent };
}

// ── CALENDAR TYPES ──
type EventType = "cycle" | "exam" | "lab";

interface CalEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: EventType;
  title: string;
  note?: string;
}

const EVENT_META: Record<EventType, { label: string; color: string; icon: string; bg: string }> = {
  cycle: { label: "Начало цикла", color: "#4caf7d", icon: "RefreshCw", bg: "#4caf7d18" },
  exam:  { label: "Обследование", color: "#3b82f6", icon: "Stethoscope", bg: "#3b82f618" },
  lab:   { label: "Анализы (до госп.)", color: "#f59e0b", icon: "FlaskConical", bg: "#f59e0b18" },
};

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DOW_RU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toKey(y: number, m: number, d: number) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function today() {
  const d = new Date();
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── TRACKER SCALES DATA ──

const VAS_STEPS = [
  { value: 0,  emoji: "😊", label: "Нет боли",         color: "#22c55e" },
  { value: 1,  emoji: "🙂", label: "Почти незаметна",  color: "#4ade80" },
  { value: 2,  emoji: "😐", label: "Очень лёгкая",     color: "#86efac" },
  { value: 3,  emoji: "😕", label: "Лёгкая",           color: "#fbbf24" },
  { value: 4,  emoji: "😟", label: "Умеренная",        color: "#f59e0b" },
  { value: 5,  emoji: "😣", label: "Средняя",          color: "#f97316" },
  { value: 6,  emoji: "😖", label: "Сильная",          color: "#ef4444" },
  { value: 7,  emoji: "😫", label: "Очень сильная",    color: "#dc2626" },
  { value: 8,  emoji: "😭", label: "Мучительная",      color: "#b91c1c" },
  { value: 9,  emoji: "😱", label: "Невыносимая",      color: "#991b1b" },
  { value: 10, emoji: "🤯", label: "Максимальная",     color: "#7f1d1d" },
];

// GAD-7 (Generalized Anxiety Disorder 7-item scale)
const GAD7_QUESTIONS = [
  "Ощущение нервозности, тревоги или нахождения «на взводе»",
  "Невозможность остановить беспокойство или взять его под контроль",
  "Чрезмерное беспокойство по разным поводам",
  "Трудность расслабиться",
  "Такое беспокойство, что трудно усидеть на месте",
  "Лёгкая раздражимость или вспыльчивость",
  "Ощущение страха, как будто может случиться что-то ужасное",
];

const GAD7_OPTIONS = [
  { value: 0, label: "Вообще нет" },
  { value: 1, label: "Несколько дней" },
  { value: 2, label: "Больше половины дней" },
  { value: 3, label: "Почти каждый день" },
];

function calcGad7Level(total: number): { label: string; color: string; desc: string } {
  if (total <= 4)  return { label: "Минимальная тревога",   color: "#22c55e", desc: "Клинически незначимый уровень тревожности" };
  if (total <= 9)  return { label: "Лёгкая тревога",        color: "#f59e0b", desc: "Рекомендуется наблюдение и самопомощь" };
  if (total <= 14) return { label: "Умеренная тревога",     color: "#f97316", desc: "Показана консультация психолога/психиатра" };
  return              { label: "Тяжёлая тревога",          color: "#ef4444", desc: "Необходима срочная психиатрическая помощь" };
}

interface PainMed {
  id: string;
  name: string;
  dose: string;
  freq: string;
}

interface ScaleRecord {
  date: string;
  ecog: number;
  vas: number | null;
  gad7: number | null;
}

interface NosologySection {
  title: string;
  icon: string;
  items: { label: string; text: string }[];
}

interface Nosology {
  id: string;
  name: string;
  shortName: string;
  mkb: string;
  tagline: string;
  accentColor: string;
  organ: React.ReactNode;
  sections: NosologySection[];
}

// SVG-иллюстрации органов (минималистичные)
const ORGAN_PROSTATE = (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <ellipse cx="40" cy="42" rx="22" ry="18" fill="currentColor" opacity="0.12"/>
    <ellipse cx="40" cy="42" rx="22" ry="18" stroke="currentColor" strokeWidth="2" fill="none"/>
    <ellipse cx="40" cy="41" rx="11" ry="9" fill="currentColor" opacity="0.18"/>
    <path d="M40 24 C40 24 40 18 40 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M30 28 C24 24 20 26 18 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M50 28 C56 24 60 26 62 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M33 58 L33 66" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M47 58 L47 66" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ORGAN_BLADDER = (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <path d="M40 14 C40 14 28 16 22 26 C16 36 18 50 26 56 C32 60 48 60 54 56 C62 50 64 36 58 26 C52 16 40 14 40 14Z" fill="currentColor" opacity="0.12"/>
    <path d="M40 14 C40 14 28 16 22 26 C16 36 18 50 26 56 C32 60 48 60 54 56 C62 50 64 36 58 26 C52 16 40 14 40 14Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M35 14 L35 9 M45 14 L45 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M38 60 L38 68 M42 60 L42 68" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="32" cy="36" r="4" fill="currentColor" opacity="0.25"/>
    <circle cx="48" cy="42" r="3" fill="currentColor" opacity="0.2"/>
  </svg>
);

const ORGAN_KIDNEY = (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <path d="M28 18 C18 20 12 30 12 40 C12 54 20 64 30 64 C36 64 40 58 40 52 C40 46 36 42 36 40 C36 38 40 34 40 28 C40 22 34 16 28 18Z" fill="currentColor" opacity="0.12"/>
    <path d="M28 18 C18 20 12 30 12 40 C12 54 20 64 30 64 C36 64 40 58 40 52 C40 46 36 42 36 40 C36 38 40 34 40 28 C40 22 34 16 28 18Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M52 18 C62 20 68 30 68 40 C68 54 60 64 50 64 C44 64 40 58 40 52 C40 46 44 42 44 40 C44 38 40 34 40 28 C40 22 46 16 52 18Z" fill="currentColor" opacity="0.10"/>
    <path d="M52 18 C62 20 68 30 68 40 C68 54 60 64 50 64 C44 64 40 58 40 52 C40 46 44 42 44 40 C44 38 40 34 40 28 C40 22 46 16 52 18Z" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" fill="none"/>
    <path d="M28 32 C24 36 24 44 28 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
    <path d="M40 20 L40 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const NOSOLOGIES: Nosology[] = [
  {
    id: "prostate",
    name: "Рак предстательной железы",
    shortName: "Рак простаты",
    mkb: "C61",
    tagline: "Наиболее распространённый онкоурологический диагноз у мужчин",
    accentColor: "#4caf7d",
    organ: ORGAN_PROSTATE,
    sections: [
      {
        title: "Общее описание",
        icon: "Info",
        items: [
          { label: "Определение", text: "Злокачественная опухоль, развивающаяся из железистых клеток предстательной железы. В 95% случаев — аденокарцинома." },
          { label: "Эпидемиология", text: "Занимает 2-е место по частоте среди онкологических заболеваний у мужчин. Риск резко возрастает после 50 лет: у мужчин 50–59 лет — 1:24, у мужчин 70–79 лет — 1:8." },
          { label: "Факторы риска", text: "Возраст старше 50 лет, отягощённая наследственность (мутации BRCA1/2, гена MSH2), афроамериканская этническая принадлежность, ожирение, высококалорийная диета с преобладанием красного мяса." },
        ],
      },
      {
        title: "Симптомы и признаки",
        icon: "AlertCircle",
        items: [
          { label: "Ранняя стадия", text: "Как правило протекает полностью бессимптомно — именно поэтому скрининг ПСА так важен. Случайные находки при ПРИ или по данным ПСА составляют большинство диагнозов." },
          { label: "Нарушения мочеиспускания", text: "Затруднённое начало мочеиспускания, ослабление струи, учащённые позывы (особенно ночью — никтурия), ощущение неполного опорожнения мочевого пузыря, прерывистость струи." },
          { label: "Тревожные симптомы", text: "Примесь крови в моче (гематурия) или сперме (гемоспермия), боль в промежности или нижней части живота, боли в костях таза и позвоночника (при метастазировании), отёки ног (компрессия лимфатических путей)." },
        ],
      },
      {
        title: "Диагностика",
        icon: "Microscope",
        items: [
          { label: "ПСА-скрининг", text: "Простат-специфический антиген — гликопротеин, вырабатываемый клетками простаты. Норма: до 4 нг/мл. При ПСА 4–10 нг/мл риск рака — 25%, при ПСА >10 нг/мл — более 50%. Важно оценивать динамику (скорость прироста ПСА)." },
          { label: "Пальцевое ректальное исследование (ПРИ)", text: "Позволяет обнаружить уплотнение или асимметрию железы. Зоны рака, не повышающего ПСА, выявляются именно при ПРИ. Проводится вместе с ПСА-тестом." },
          { label: "МРТ малого таза (mpMRI)", text: "Мультипараметрическая МРТ — основной метод визуализации перед биопсией. Позволяет оценить распространение опухоли, поражение капсулы, семенных пузырьков. Стратификация по шкале PI-RADS (1–5)." },
          { label: "Трансректальная биопсия", text: "«Золотой стандарт» верификации диагноза. Рекомендуется fusion-биопсия под контролем МРТ/УЗИ. Оцениваются минимум 12 столбиков ткани с оценкой по шкале Глисона (от 6 до 10)." },
          { label: "Стадирование", text: "Система TNM: T — размер и распространение первичной опухоли, N — лимфоузлы, M — отдалённые метастазы. При местно-распространённом и метастатическом раке — ПСМА ПЭТ/КТ для выявления отдалённых метастазов." },
        ],
      },
      {
        title: "Стадии заболевания",
        icon: "Layers",
        items: [
          { label: "I–II стадии (локализованный рак)", text: "Опухоль ограничена капсулой железы. T1: непальпируемая, случайная находка. T2: пальпируемая, ограниченная простатой. Прогноз благоприятный — 10-летняя выживаемость >90%." },
          { label: "III стадия (местно-распространённый)", text: "T3a: прорастание за пределы капсулы. T3b: инвазия семенных пузырьков. T4: распространение на мочевой пузырь, прямую кишку. Показано мультимодальное лечение." },
          { label: "IV стадия (метастатический)", text: "N1: поражение тазовых лимфоузлов. M1: отдалённые метастазы — чаще всего в кости (позвоночник, таз, рёбра), реже в лёгкие и печень. Цель лечения — контроль заболевания и качество жизни." },
        ],
      },
      {
        title: "Методы лечения",
        icon: "Zap",
        items: [
          { label: "Активное наблюдение", text: "При низком риске (ПСА <10, Глисон 6, cT1–T2a): регулярный мониторинг ПСА, ПРИ, повторные биопсии. Позволяет избежать избыточного лечения и его побочных эффектов." },
          { label: "Хирургическое лечение", text: "Радикальная простатэктомия (РПЭ) — удаление простаты с семенными пузырьками и тазовыми лимфоузлами. Проводится лапароскопически, роботассистированно (da Vinci) или открытым доступом. Осложнения: эректильная дисфункция, стрессовое недержание мочи." },
          { label: "Лучевая терапия", text: "Дистанционная лучевая терапия (ДГРТ, ИМЛТ) — высокоточное облучение с учётом дыхания и движений тела. Брахитерапия — имплантация радиоактивных зёрен йода-125 непосредственно в ткань простаты. Эффективность сопоставима с РПЭ при локализованном раке." },
          { label: "Гормональная терапия (АДТ)", text: "Андрогенная депривационная терапия: агонисты/антагонисты ЛГРГ (лейпрорелин, дегареликс), антиандрогены (бикалутамид, энзалутамид, апалутамид). При кастрационно-резистентном раке — абиратерон (ингибитор CYP17)." },
          { label: "Химиотерапия", text: "Доцетаксел + преднизолон — стандарт 1-й линии при кастрационно-резистентном раке и при метастатическом гормоночувствительном раке высокого риска. Кабазитаксел — 2-я линия после доцетаксела." },
          { label: "Таргетная и радионуклидная терапия", text: "Олапариб и рукапариб — PARP-ингибиторы при мутациях BRCA1/2 и других генов репарации ДНК. Лютеций-177-ПСМА — радионуклидная терапия при ПСМА-позитивном метастатическом кастрационно-резистентном раке." },
        ],
      },
      {
        title: "Шкала ECOG и прогноз",
        icon: "BarChart2",
        items: [
          { label: "Значение ECOG при раке простаты", text: "ECOG 0–1: возможна любая системная терапия. ECOG 2: ограниченный выбор схем, требуется оценка соотношения пользы/риска. ECOG ≥3: паллиативное направление, симптоматическая терапия." },
          { label: "Прогностические факторы", text: "Уровень ПСА, степень дифференцировки (шкала Глисона/ISUP Grade Group), стадия TNM, время удвоения ПСА, наличие висцеральных метастазов. При M0 5-летняя выживаемость >95%, при M1 — около 30%." },
        ],
      },
    ],
  },
  {
    id: "bladder",
    name: "Рак мочевого пузыря",
    shortName: "Рак мочевого пузыря",
    mkb: "C67",
    tagline: "Наиболее частый онкоурологический диагноз у пожилых курильщиков",
    accentColor: "#3b82f6",
    organ: ORGAN_BLADDER,
    sections: [
      {
        title: "Общее описание",
        icon: "Info",
        items: [
          { label: "Определение", text: "Злокачественная опухоль, развивающаяся из уротелия (переходного эпителия) слизистой оболочки мочевого пузыря. В 90% случаев — уротелиальная (переходно-клеточная) карцинома." },
          { label: "Эпидемиология", text: "4-е место среди онкологических заболеваний у мужчин. Соотношение мужчин и женщин — 4:1. Пик заболеваемости — 65–74 года. Ежегодно в России диагностируется около 15 000 новых случаев." },
          { label: "Факторы риска", text: "Курение — главный фактор (относительный риск ×4), ароматические амины (профессиональный контакт в красильной, резиновой, кожевенной промышленности), хроническое воспаление (шистосомоз при плоскоклеточном раке), длительный приём циклофосфамида, пиелонефриты в анамнезе." },
        ],
      },
      {
        title: "Симптомы и признаки",
        icon: "AlertCircle",
        items: [
          { label: "Ключевой симптом — гематурия", text: "Безболевая макрогематурия (видимая кровь в моче) — самый частый и важный симптом, встречается у 80–85% пациентов. Важно: однократный эпизод требует обязательного урологического обследования!" },
          { label: "Ирритативные симптомы", text: "Учащённое мочеиспускание, императивные (неудержимые) позывы, болезненное мочеиспускание (дизурия) — характерны для карциномы in situ (CIS) и мышечно-инвазивного рака." },
          { label: "Симптомы распространённого процесса", text: "Боли в малом тазу, пояснице (при обструкции мочеточников), отёки нижних конечностей (лимфостаз), общая слабость, потеря веса — при местно-распространённом и метастатическом раке." },
        ],
      },
      {
        title: "Диагностика",
        icon: "Microscope",
        items: [
          { label: "Цистоскопия", text: "«Золотой стандарт» диагностики. Эндоскопический осмотр слизистой мочевого пузыря позволяет визуализировать опухоль, оценить её размер, количество и локализацию. При подозрении сразу выполняется биопсия." },
          { label: "Цитология мочи", text: "Исследование осадка мочи на наличие опухолевых клеток. Высокая специфичность при высокозлокачественных опухолях и CIS, но низкая чувствительность при папиллярных опухолях низкой степени злокачественности." },
          { label: "УЗИ мочевыводящих путей", text: "Скрининговый метод: позволяет выявить образования >0.5 см, оценить состояние верхних мочевыводящих путей, гидронефроз. Не заменяет цистоскопию, но применяется как первичный диагностический инструмент." },
          { label: "КТ-урография", text: "Обязательна при гематурии для оценки всех отделов уротелия (лоханки, мочеточники, пузырь). Позволяет выявить множественные очаги уротелиальной карциномы, инвазию соседних структур и лимфоузлов." },
          { label: "ТУР и стадирование", text: "Трансуретральная резекция (ТУР) — и диагностическая и лечебная процедура. Гистологическая оценка: степень злокачественности (low grade / high grade), наличие инвазии в мышечный слой (критически важно для выбора тактики)." },
        ],
      },
      {
        title: "Стадии заболевания",
        icon: "Layers",
        items: [
          { label: "Ta / T1 — немышечно-инвазивный рак (НМИРМП)", text: "Ta: опухоль ограничена уротелием (не прорастает в собственную пластинку). T1: инвазия в собственную пластинку слизистой, но не в мышцу. CIS (Tis): плоская высокозлокачественная карцинома in situ — высокий риск прогрессии." },
          { label: "T2–T4 — мышечно-инвазивный рак (МИРМП)", text: "T2: инвазия в мышечный слой. T3: прорастание в паравезикальную клетчатку. T4a: инвазия в простату/матку/влагалище. T4b: прорастание в тазовую/брюшную стенку." },
          { label: "IV стадия (метастатический)", text: "N1–3: поражение тазовых лимфоузлов. M1: гематогенные метастазы — лёгкие, печень, кости, надпочечники. 5-летняя выживаемость при M1 — менее 5% на традиционных схемах химиотерапии." },
        ],
      },
      {
        title: "Методы лечения",
        icon: "Zap",
        items: [
          { label: "ТУР + внутрипузырная терапия (при НМИРМП)", text: "Трансуретральная резекция — основной метод лечения НМИРМП. После ТУР: инстилляции митомицина С (при low grade) или БЦЖ-терапия (иммунотерапия бактерией Calmette–Guérin) при high grade / CIS — для снижения риска рецидива и прогрессии." },
          { label: "Радикальная цистэктомия (при МИРМП)", text: "Удаление мочевого пузыря с тазовой лимфаденэктомией. У мужчин — с простатой и семенными пузырьками, у женщин — с маткой и передней стенкой влагалища. Деривация мочи: ортотопический неопузырь (Штудера), кондуит Бриккера, уретерокутанеостомия." },
          { label: "Химиотерапия", text: "Неоадъювантная ХТ до цистэктомии — цисплатин-содержащие режимы (MVAC, GC) улучшают выживаемость на 5–8%. При метастатическом раке: GC (гемцитабин + цисплатин) или MVAC — 1-я линия." },
          { label: "Иммунотерапия", text: "Пембролизумаб и атезолизумаб (анти-PD-1/PD-L1) — при платинорефрактерном метастатическом раке. Энфортумаб ведотин (антитело-конъюгат против Nectin-4) — высокоактивен при рефрактерном уротелиальном раке." },
          { label: "Органосохраняющее лечение", text: "Радикальная ТУР + химиолучевая терапия — альтернатива цистэктомии для тщательно отобранных пациентов (T2, единственный очаг, без CIS, полная ТУР). 5-летняя выживаемость сопоставима с цистэктомией у отвечающих на лечение." },
        ],
      },
      {
        title: "Мониторинг и наблюдение",
        icon: "BarChart2",
        items: [
          { label: "Наблюдение при НМИРМП", text: "Цистоскопия каждые 3 месяца в 1-й год, каждые 6 месяцев на 2–3-м году, далее ежегодно. Частота зависит от группы риска (низкий, промежуточный, высокий по классификации EAU)." },
          { label: "Наблюдение после цистэктомии", text: "КТ органов брюшной полости/грудной клетки каждые 6 месяцев в течение 2 лет, затем ежегодно. Оценка функции верхних мочевыводящих путей, метаболических нарушений при ортотопическом неопузыре." },
        ],
      },
    ],
  },
  {
    id: "kidney",
    name: "Рак почки",
    shortName: "Рак почки",
    mkb: "C64",
    tagline: "«Немой» рак — часто выявляется случайно при УЗИ и КТ",
    accentColor: "#a855f7",
    organ: ORGAN_KIDNEY,
    sections: [
      {
        title: "Общее описание",
        icon: "Info",
        items: [
          { label: "Определение", text: "Злокачественная опухоль паренхимы почки. Около 80–85% случаев — светлоклеточная почечно-клеточная карцинома (ПКК), остальные — папиллярная (10–15%), хромофобная (5%) и другие гистологические типы." },
          { label: "Эпидемиология", text: "3-е место среди онкоурологических заболеваний. Мужчины болеют в 1.5–2 раза чаще женщин. Пик заболеваемости — 60–70 лет. Характерна случайная выявляемость: до 50% опухолей обнаруживаются при плановом УЗИ." },
          { label: "Факторы риска", text: "Курение (относительный риск ×2), ожирение (особенно у женщин), артериальная гипертензия, хроническая почечная недостаточность и длительный гемодиализ, синдром фон Хиппеля–Линдау (VHL), наследственные формы ПКК." },
        ],
      },
      {
        title: "Симптомы и признаки",
        icon: "AlertCircle",
        items: [
          { label: "Классическая триада", text: "Гематурия + боль в пояснице + пальпируемая опухоль — встречается лишь у 10% пациентов и свидетельствует о запущенном процессе. В эпоху УЗИ большинство опухолей выявляются до появления симптомов." },
          { label: "Паранеопластические синдромы", text: "Встречаются у 30% пациентов: полицитемия (из-за выработки эритропоэтина опухолью), гиперкальциемия, артериальная гипертензия, синдром Штауффера (нарушение функции печени без метастазов), лихорадка." },
          { label: "Симптомы распространённого рака", text: "Кашель, одышка, боли в костях (метастазы), увеличение надключичных лимфоузлов, варикоцеле (тромбоз почечной вены), нарастающая слабость и потеря веса." },
        ],
      },
      {
        title: "Диагностика",
        icon: "Microscope",
        items: [
          { label: "УЗИ почек", text: "Первичный метод выявления. Позволяет дифференцировать солидное образование от кисты, оценить размер и локализацию. Для характеристики новообразования всегда требуется КТ или МРТ с контрастом." },
          { label: "КТ с контрастированием", text: "Стандарт диагностики: трёхфазная КТ (нативная, артериальная, венозная и отсроченная фазы). Накопление контраста — ключевой признак злокачественности. Оценивается состояние почечных вен, НПВ, лимфоузлов, надпочечников." },
          { label: "МРТ с контрастом", text: "Применяется при аллергии на йодный контраст, для оценки тромбоза почечной вены и НПВ, для характеристики сложных кист (классификация Босняка I–IV). Превосходит КТ в дифференциации гистологических типов." },
          { label: "Биопсия опухоли", text: "Показана при образованиях <4 см перед аблационными методами лечения, при подозрении на метастаз из другого органа, при нерезектабельном процессе для подбора системной терапии. В остальных случаях диагноз устанавливается по данным КТ." },
          { label: "Стадирование", text: "Система TNM: T1 (<7 см, в пределах почки) — T4 (за пределы фасции Героты). Обязательна КТ грудной клетки, при симптомах — сцинтиграфия костей. ЭКЗГ ПЭТ/КТ не является стандартом при ПКК." },
        ],
      },
      {
        title: "Стадии заболевания",
        icon: "Layers",
        items: [
          { label: "I стадия (T1N0M0)", text: "Опухоль ≤7 см, ограничена почкой. T1a: ≤4 см, T1b: 4–7 см. 5-летняя выживаемость после нефрэктомии — >95%. Предпочтительна частичная нефрэктомия (нефронсберегающая операция)." },
          { label: "II стадия (T2N0M0)", text: "Опухоль >7 см, ограничена почкой. T2a: 7–10 см, T2b: >10 см. 5-летняя выживаемость — 70–80%. Показана радикальная или нефронсберегающая нефрэктомия при технической возможности." },
          { label: "III стадия (T3 или N1)", text: "T3: прорастание в почечную вену, НПВ или перинефральную клетчатку (в пределах фасции Героты). N1: поражение регионарных лимфоузлов. 5-летняя выживаемость — 40–60%. Хирургия + возможна адъювантная терапия." },
          { label: "IV стадия (T4 или M1)", text: "T4: инвазия за пределы фасции Героты, поражение надпочечника. M1: отдалённые метастазы (лёгкие — 50%, кости — 30%, печень — 30%, мозг — 5%). 5-летняя выживаемость — 10–15%." },
        ],
      },
      {
        title: "Методы лечения",
        icon: "Zap",
        items: [
          { label: "Нефронсберегающая нефрэктомия (НСН)", text: "Стандарт при T1a (<4 см): частичная резекция почки открытым, лапароскопическим или роботассистированным доступом. Сохраняет почечную функцию при онкологических результатах, сопоставимых с радикальной нефрэктомией." },
          { label: "Радикальная нефрэктомия", text: "Удаление почки с клетчаткой в пределах фасции Героты, при показаниях — надпочечника и регионарных лимфоузлов. Лапароскопический/роботассистированный доступ — стандарт при T1–T2. Открытый доступ — при крупных опухолях, тромбозе НПВ." },
          { label: "Термоаблация", text: "Радиочастотная аблация (РЧА) или криоаблация — для пациентов с T1a (<3 см), высоким операционным риском, единственной почкой или двусторонним процессом. Под контролем КТ или УЗИ. Частота рецидивов выше, чем при НСН." },
          { label: "Таргетная терапия (метастатический ПКК)", text: "Первая линия: комбинации анти-PD-1/PD-L1 с анти-CTLA-4 (ниволумаб + ипилимумаб) или ИКТ с ингибитором TKI (пембролизумаб + акситиниб, авелумаб + акситиниб). Монотерапия TKI (сунитиниб, пазопаниб) — при противопоказаниях к ИКТ." },
          { label: "Вторая и последующие линии", text: "Кабозантиниб — ингибитор МЕТ/AXL/VEGFR, эффективен при прогрессии на ИКТ. Эверолимус — ингибитор mTOR, применяется при рефрактерном ПКК. При папиллярном ПКК — савитиниб (ингибитор MET)." },
          { label: "Метастазэктомия", text: "При солитарных метастазах (лёгкие, надпочечник) после длительного периода ремиссии — резекция метастаза улучшает выживаемость. Лучевая терапия (SBRT) — при метастазах в кости и головной мозг." },
        ],
      },
      {
        title: "Прогноз и наблюдение",
        icon: "BarChart2",
        items: [
          { label: "Прогностические шкалы", text: "Шкала IMDC (International Metastatic RCC Database Consortium): оценивает 6 факторов (ECOG, гемоглобин, кальций, нейтрофилы, тромбоциты, время от диагноза до начала терапии). Группы: благоприятный (0 факторов), промежуточный (1–2), неблагоприятный (≥3)." },
          { label: "Наблюдение после нефрэктомии", text: "КТ грудной клетки и брюшной полости: каждые 6 месяцев в течение 3 лет, затем ежегодно до 5 лет. При T1a low risk — возможно УЗИ вместо КТ. Контроль функции оставшейся почки (креатинин, СКФ)." },
        ],
      },
    ],
  },
];

export default function Index() {
  const [section, setSection] = useState<Section>("home");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [openRef, setOpenRef] = useState<number | null>(null);
  const [selectedNosology, setSelectedNosology] = useState<string | null>(null);

  // ── Calendar state ──
  const [events, setEvents] = useState<CalEvent[]>([]);
  const nowDate = new Date();
  const [calYear, setCalYear] = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth());
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addType, setAddType] = useState<EventType>("cycle");
  const [addTitle, setAddTitle] = useState("");
  const [addNote, setAddNote] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const openAdd = (dateKey: string) => {
    setAddDate(dateKey);
    setAddType("cycle");
    setAddTitle("");
    setAddNote("");
    setShowAddModal(true);
  };

  const saveEvent = () => {
    if (!addTitle.trim()) return;
    const ev: CalEvent = {
      id: Date.now().toString(),
      date: addDate,
      type: addType,
      title: addTitle.trim(),
      note: addNote.trim() || undefined,
    };
    setEvents((prev) => [...prev, ev]);
    setShowAddModal(false);
  };

  const removeEvent = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id));

  // Build calendar grid for current month
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const firstMon = (firstDay + 6) % 7; // shift to Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calCells.length % 7 !== 0) calCells.push(null);

  const eventsByDate = events.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  const todayKey = today();

  // Upcoming events (next 30 days)
  const upcoming = [...events]
    .filter((e) => e.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

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

  // ── Tracker pages state ──
  const [trackerPage, setTrackerPage] = useState(0);
  const trackerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);

  const [vasScore, setVasScore] = useState<number | null>(null);
  const [gad7Answers, setGad7Answers] = useState<(number | null)[]>(Array(7).fill(null));
  const [painMeds, setPainMeds] = useState<PainMed[]>([]);
  const [addMedName, setAddMedName] = useState("");
  const [addMedDose, setAddMedDose] = useState("");
  const [addMedFreq, setAddMedFreq] = useState("");
  const [scaleRecords, setScaleRecords] = useState<ScaleRecord[]>([]);

  const gad7Total = gad7Answers.every(a => a !== null) ? gad7Answers.reduce((s, v) => s + (v ?? 0), 0) : null;
  const gad7Level = gad7Total !== null ? calcGad7Level(gad7Total) : null;

  const setGad7Answer = (qi: number, val: number) => {
    setGad7Answers(prev => { const next = [...prev]; next[qi] = val; return next; });
  };

  const addPainMed = () => {
    if (!addMedName.trim()) return;
    setPainMeds(prev => [...prev, { id: Date.now().toString(), name: addMedName.trim(), dose: addMedDose.trim(), freq: addMedFreq.trim() }]);
    setAddMedName(""); setAddMedDose(""); setAddMedFreq("");
  };

  const removePainMed = (id: string) => setPainMeds(prev => prev.filter(m => m.id !== id));

  const TRACKER_PAGES = ["ECOG / Симптомы", "Боль (ВАШ)", "Тревога (GAD-7)", "Графики"];

  const goToPage = (idx: number) => {
    setTrackerPage(Math.max(0, Math.min(TRACKER_PAGES.length - 1, idx)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goToPage(trackerPage + (diff > 0 ? 1 : -1));
  };

  const handleSaveAll = () => {
    const rec: ScaleRecord = {
      date: todayKey,
      ecog: ecogScore,
      vas: vasScore,
      gad7: gad7Total,
    };
    setScaleRecords((prev) => {
      const filtered = prev.filter((r) => r.date !== todayKey);
      return [...filtered, rec].sort((a, b) => a.date.localeCompare(b.date));
    });
    setSaved(true);
  };

  const handleSave = () => setSaved(true);
  const handleReset = () => { setSelected({}); setSaved(false); };

  const navItems: { key: Section; label: string }[] = [
    { key: "home", label: "Главная" },
    { key: "tracker", label: "Трекер симптомов" },
    { key: "calendar", label: "Календарь" },
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

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-display text-4xl text-foreground mb-1">Трекер шкал</h2>
              <p className="text-muted-foreground text-sm">Свайп влево/вправо для переключения шкал</p>
            </div>
            <button
              onClick={() => { setSaved(false); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <Icon name="RotateCcw" size={14} />
              Сбросить
            </button>
          </div>

          {/* Page tabs */}
          <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6">
            {TRACKER_PAGES.map((name, i) => (
              <button
                key={name}
                onClick={() => goToPage(i)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  trackerPage === i
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Swipeable area */}
          <div
            ref={trackerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="overflow-hidden"
          >
            {/* ── PAGE 1: ECOG + Симптомы ── */}
            {trackerPage === 0 && (
              <div className="animate-fade-in">
                {/* ECOG Panel */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                        Функциональный статус ECOG
                      </p>
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-5xl font-bold" style={{ color: ecogInfo.color }}>{ecogScore}</span>
                        <span className="font-semibold text-foreground text-lg">{ecogInfo.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{ecogInfo.desc}</p>
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-1.5">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{ecogPoints.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">баллов из {MAX_SCORE.toFixed(0)}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{selectedCount} симптомов</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(ecogPercent, selectedCount > 0 ? 2 : 0)}%`, backgroundColor: ecogInfo.color }} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    {ECOG_LEVELS.map((lvl) => (
                      <div key={lvl.score} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full transition-all" style={{ backgroundColor: lvl.color, opacity: ecogScore >= lvl.score ? 1 : 0.25, transform: ecogScore === lvl.score ? "scale(1.4)" : "scale(1)" }} />
                        <span className="text-xs" style={{ color: ecogScore === lvl.score ? lvl.color : undefined, fontWeight: ecogScore === lvl.score ? 600 : 400 }}>{lvl.score}</span>
                      </div>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2 self-center">ECOG</span>
                  </div>
                </div>

                {/* Symptom groups */}
                <div className="space-y-10">
                  {SYMPTOM_GROUPS.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{group.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {group.symptoms.map((symptom) => {
                          const isSelected = !!selected[symptom];
                          const isBinary = BINARY_SYMPTOMS.has(symptom);
                          const currentWeight = isSelected ? symptomWeight(symptom, selected[symptom]) : 0;
                          return (
                            <div key={symptom} className="flex flex-col">
                              <button
                                onClick={() => toggleSymptom(symptom)}
                                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${isSelected ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-foreground/40"}`}
                              >
                                {isSelected && <Icon name="Check" size={12} className="inline mr-1.5 -mt-0.5" />}
                                {symptom}
                                {!isSelected && isBinary && <span className="ml-1.5 text-xs text-muted-foreground font-normal">·1</span>}
                              </button>
                              {isSelected && isBinary && <p className="text-xs text-muted-foreground mt-1.5 px-1">+1.0 балл (факт наличия)</p>}
                              {isSelected && !isBinary && (
                                <div className="mt-2 px-1 animate-fade-in">
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((v) => (
                                      <button key={v} onClick={() => setIntensity(symptom, v)} className={`w-6 h-6 rounded-full text-xs font-semibold transition-all ${selected[symptom] >= v ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-border"}`}>{v}</button>
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 pl-0.5">
                                    {INTENSITY_LABELS[selected[symptom]]} · <span className="font-medium text-foreground">{currentWeight === 0 ? "0 баллов" : `+${currentWeight} балл${currentWeight === 2 ? "а" : ""}`}</span>
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
              </div>
            )}

            {/* ── PAGE 2: ВАШ Боль ── */}
            {trackerPage === 1 && (
              <div className="animate-fade-in">
                <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Визуальная аналоговая шкала боли</p>
                  <p className="text-sm text-muted-foreground mb-6">Выберите число, соответствующее вашей боли прямо сейчас</p>

                  {/* Selected display */}
                  {vasScore !== null ? (
                    <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ backgroundColor: VAS_STEPS[vasScore].color + "15" }}>
                      <span className="text-5xl">{VAS_STEPS[vasScore].emoji}</span>
                      <div>
                        <p className="font-display text-4xl font-bold" style={{ color: VAS_STEPS[vasScore].color }}>{vasScore}</p>
                        <p className="font-semibold text-foreground">{VAS_STEPS[vasScore].label}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-secondary">
                      <span className="text-3xl opacity-40">🤔</span>
                      <p className="text-muted-foreground text-sm">Нажмите на цифру ниже, чтобы отметить интенсивность боли</p>
                    </div>
                  )}

                  {/* VAS scale buttons */}
                  <div className="grid grid-cols-11 gap-1.5">
                    {VAS_STEPS.map((step) => (
                      <button
                        key={step.value}
                        onClick={() => setVasScore(step.value)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border-2 ${
                          vasScore === step.value ? "border-current scale-110 shadow-md" : "border-transparent hover:scale-105"
                        }`}
                        style={{
                          backgroundColor: step.color + (vasScore === step.value ? "30" : "15"),
                          borderColor: vasScore === step.value ? step.color : "transparent",
                        }}
                      >
                        <span className="text-lg leading-none">{step.emoji}</span>
                        <span className="text-xs font-bold" style={{ color: step.color }}>{step.value}</span>
                      </button>
                    ))}
                  </div>

                  {/* Labels */}
                  <div className="flex justify-between mt-3 px-1">
                    <span className="text-xs text-muted-foreground">Нет боли</span>
                    <span className="text-xs text-muted-foreground">Невыносимая</span>
                  </div>
                </div>

                {/* Pain medications list */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Противоболевая терапия</p>
                  <p className="text-sm text-muted-foreground mb-4">Препараты, которые вы принимаете для контроля боли</p>

                  {/* Add form */}
                  <div className="flex flex-col gap-2 mb-4">
                    <input
                      type="text"
                      value={addMedName}
                      onChange={e => setAddMedName(e.target.value)}
                      placeholder="Название препарата (напр. Трамадол)"
                      className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addMedDose}
                        onChange={e => setAddMedDose(e.target.value)}
                        placeholder="Доза (напр. 50 мг)"
                        className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                      />
                      <input
                        type="text"
                        value={addMedFreq}
                        onChange={e => setAddMedFreq(e.target.value)}
                        placeholder="Кратность (напр. 2×/день)"
                        className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={addPainMed}
                        disabled={!addMedName.trim()}
                        className="px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40 flex-shrink-0"
                      >
                        <Icon name="Plus" size={16} />
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  {painMeds.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Препараты не добавлены</p>
                  ) : (
                    <div className="space-y-2">
                      {painMeds.map(med => (
                        <div key={med.id} className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-card flex items-center justify-center flex-shrink-0">
                            <Icon name="Pill" size={14} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{med.name}</p>
                            {(med.dose || med.freq) && (
                              <p className="text-xs text-muted-foreground">{[med.dose, med.freq].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                          <button onClick={() => removePainMed(med.id)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                            <Icon name="X" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PAGE 3: GAD-7 ── */}
            {trackerPage === 2 && (
              <div className="animate-fade-in">
                {/* Result banner */}
                {gad7Level !== null ? (
                  <div className="flex items-center gap-4 p-5 rounded-2xl mb-6 border-2" style={{ backgroundColor: gad7Level.color + "12", borderColor: gad7Level.color + "40" }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: gad7Level.color + "20" }}>
                      <span className="font-display text-2xl font-bold" style={{ color: gad7Level.color }}>{gad7Total}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{gad7Level.label}</p>
                      <p className="text-sm text-muted-foreground">{gad7Level.desc}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary mb-6">
                    <Icon name="Brain" size={20} className="text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">Ответьте на все 7 вопросов, чтобы получить оценку уровня тревожности</p>
                  </div>
                )}

                <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GAD-7 · Шкала генерализованного тревожного расстройства</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Как часто за последние 2 недели вас беспокоило следующее?</p>
                  </div>

                  <div className="divide-y divide-border">
                    {GAD7_QUESTIONS.map((q, qi) => (
                      <div key={qi} className="px-5 py-4">
                        <p className="text-sm text-foreground mb-3 leading-relaxed">
                          <span className="text-xs font-bold text-muted-foreground mr-2">{qi + 1}.</span>
                          {q}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {GAD7_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setGad7Answer(qi, opt.value)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all text-center ${
                                gad7Answers[qi] === opt.value
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border hover:border-foreground/30 text-foreground"
                              }`}
                            >
                              <span className="block font-bold text-sm">{opt.value}</span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interpretation */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Интерпретация GAD-7</p>
                  <div className="space-y-2">
                    {[
                      { range: "0–4",  label: "Минимальная тревога", color: "#22c55e" },
                      { range: "5–9",  label: "Лёгкая тревога",       color: "#f59e0b" },
                      { range: "10–14",label: "Умеренная тревога",    color: "#f97316" },
                      { range: "15–21",label: "Тяжёлая тревога",      color: "#ef4444" },
                    ].map(row => (
                      <div key={row.range} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                        <span className="text-xs font-bold text-foreground w-12 flex-shrink-0">{row.range}</span>
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PAGE 4: Графики ── */}
            {trackerPage === 3 && (
              <div className="animate-fade-in">
                {scaleRecords.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Icon name="BarChart2" size={24} className="text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-foreground mb-2">Нет данных для графиков</p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Заполните шкалы на страницах 1–3 и нажмите «Сохранить запись» — точка появится на графике
                    </p>
                    <button onClick={() => goToPage(0)} className="mt-6 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity">
                      Перейти к шкалам
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* ECOG chart */}
                    {(() => {
                      const maxVal = 4;
                      return (
                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Динамика ECOG</p>
                          <div className="flex gap-2 items-end h-32">
                            {/* Y axis */}
                            <div className="flex flex-col justify-between h-full text-right pr-2">
                              {[4,3,2,1,0].map(v => (
                                <span key={v} className="text-xs text-muted-foreground leading-none">{v}</span>
                              ))}
                            </div>
                            {/* Bars */}
                            <div className="flex-1 flex items-end gap-2 border-l border-b border-border h-full pl-2 pb-0 relative">
                              {scaleRecords.map((rec) => {
                                const pct = ((maxVal - rec.ecog) / maxVal) * 100;
                                const color = ECOG_LEVELS[rec.ecog]?.color ?? "#94a3b8";
                                const [,m,d] = rec.date.split("-");
                                return (
                                  <div key={rec.date} className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end">
                                    <span className="text-xs font-bold" style={{ color }}>{rec.ecog}</span>
                                    <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(pct, 5)}%`, backgroundColor: color + "80", border: `1.5px solid ${color}` }} />
                                    <span className="text-xs text-muted-foreground truncate w-full text-center">{d}.{m}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* VAS chart */}
                    {scaleRecords.some(r => r.vas !== null) && (() => {
                      const maxVal = 10;
                      return (
                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Динамика боли (ВАШ)</p>
                          <div className="flex gap-2 items-end h-32">
                            <div className="flex flex-col justify-between h-full text-right pr-2">
                              {[10,8,6,4,2,0].map(v => <span key={v} className="text-xs text-muted-foreground leading-none">{v}</span>)}
                            </div>
                            <div className="flex-1 flex items-end gap-2 border-l border-b border-border h-full pl-2 relative">
                              {scaleRecords.filter(r => r.vas !== null).map((rec) => {
                                const v = rec.vas!;
                                const pct = (v / maxVal) * 100;
                                const color = VAS_STEPS[v].color;
                                const [,m,d] = rec.date.split("-");
                                return (
                                  <div key={rec.date} className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end">
                                    <span className="text-xs font-bold" style={{ color }}>{v}</span>
                                    <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(pct, 5)}%`, backgroundColor: color + "80", border: `1.5px solid ${color}` }} />
                                    <span className="text-xs text-muted-foreground truncate w-full text-center">{d}.{m}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* GAD-7 chart */}
                    {scaleRecords.some(r => r.gad7 !== null) && (() => {
                      const maxVal = 21;
                      return (
                        <div className="bg-card border border-border rounded-2xl p-5">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Динамика тревоги (GAD-7)</p>
                          <div className="flex gap-2 items-end h-32">
                            <div className="flex flex-col justify-between h-full text-right pr-2">
                              {[21,15,10,5,0].map(v => <span key={v} className="text-xs text-muted-foreground leading-none">{v}</span>)}
                            </div>
                            <div className="flex-1 flex items-end gap-2 border-l border-b border-border h-full pl-2 relative">
                              {scaleRecords.filter(r => r.gad7 !== null).map((rec) => {
                                const v = rec.gad7!;
                                const pct = (v / maxVal) * 100;
                                const color = calcGad7Level(v).color;
                                const [,m,d] = rec.date.split("-");
                                return (
                                  <div key={rec.date} className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end">
                                    <span className="text-xs font-bold" style={{ color }}>{v}</span>
                                    <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(pct, 5)}%`, backgroundColor: color + "80", border: `1.5px solid ${color}` }} />
                                    <span className="text-xs text-muted-foreground truncate w-full text-center">{d}.{m}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save panel */}
          {trackerPage < 3 && (
            <div className="sticky bottom-6 mt-10">
              <div className="bg-card border border-border rounded-2xl px-6 py-4 flex items-center justify-between shadow-lg shadow-foreground/5">
                <div>
                  <p className="font-medium text-foreground text-sm">
                    ECOG&nbsp;<span style={{ color: ecogInfo.color, fontWeight: 700 }}>{ecogScore}</span>
                    {vasScore !== null && <> · ВАШ&nbsp;<span style={{ color: VAS_STEPS[vasScore].color, fontWeight: 700 }}>{vasScore}</span></>}
                    {gad7Total !== null && <> · GAD-7&nbsp;<span style={{ color: gad7Level?.color, fontWeight: 700 }}>{gad7Total}</span></>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{saved ? "Запись сохранена ✓" : "Заполните шкалы и сохраните"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {saved && (
                    <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "hsl(var(--accent))" }}>
                      <Icon name="CheckCircle" size={16} />
                      Сохранено
                    </div>
                  )}
                  <button
                    onClick={handleSaveAll}
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

      {/* ── CALENDAR ── */}
      {section === "calendar" && (
        <main className="max-w-5xl mx-auto px-6 py-12 animate-fade-in">
          <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="font-display text-4xl text-foreground mb-2">Календарь лечения</h2>
              <p className="text-muted-foreground">Обследования, циклы и анализы перед госпитализацией</p>
            </div>
            <button
              onClick={() => openAdd(todayKey)}
              className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity"
            >
              <Icon name="Plus" size={16} />
              Добавить событие
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-8">
            {(Object.entries(EVENT_META) as [EventType, typeof EVENT_META.cycle][]).map(([type, meta]) => (
              <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-sm">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className="text-foreground font-medium">{meta.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-sm ml-auto">
              <Icon name="AlertCircle" size={14} className="text-amber-500" />
              <span className="text-amber-700 font-medium">Анализы годны 5 дней до госпитализации</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar grid */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <Icon name="ChevronLeft" size={18} className="text-foreground" />
                </button>
                <span className="font-semibold text-foreground text-lg">
                  {MONTHS_RU[calMonth]} {calYear}
                </span>
                <button
                  onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <Icon name="ChevronRight" size={18} className="text-foreground" />
                </button>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DOW_RU.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {calCells.map((day, idx) => {
                  if (day === null) return <div key={`e-${idx}`} />;
                  const key = toKey(calYear, calMonth, day);
                  const dayEvents = eventsByDate[key] ?? [];
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDay;
                  return (
                    <button
                      key={key}
                      onClick={() => { setSelectedDay(isSelected ? null : key); }}
                      className={`relative min-h-[52px] rounded-xl p-1.5 text-left transition-all border ${
                        isSelected
                          ? "border-foreground bg-secondary"
                          : isToday
                          ? "border-foreground/30 bg-secondary/60"
                          : "border-transparent hover:border-border hover:bg-secondary/40"
                      }`}
                    >
                      <span className={`text-xs font-semibold block mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "bg-foreground text-background" : "text-foreground"
                      }`}>
                        {day}
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: EVENT_META[ev.type].color }}
                            title={ev.title}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected day detail */}
              {selectedDay && (
                <div className="mt-4 border-t border-border pt-4 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-foreground">
                      {selectedDay.split("-").reverse().slice(0,2).join(".")} {MONTHS_RU[parseInt(selectedDay.split("-")[1])-1]}
                    </span>
                    <button
                      onClick={() => openAdd(selectedDay)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon name="Plus" size={14} />
                      Добавить
                    </button>
                  </div>
                  {(eventsByDate[selectedDay] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет событий. Нажмите «Добавить».</p>
                  ) : (
                    <div className="space-y-2">
                      {(eventsByDate[selectedDay] ?? []).map((ev) => (
                        <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: EVENT_META[ev.type].bg }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: EVENT_META[ev.type].color + "30" }}>
                            <Icon name={EVENT_META[ev.type].icon} size={14} style={{ color: EVENT_META[ev.type].color } as React.CSSProperties} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">{EVENT_META[ev.type].label}</p>
                            {ev.note && <p className="text-xs text-muted-foreground mt-0.5">{ev.note}</p>}
                          </div>
                          <button onClick={() => removeEvent(ev.id)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                            <Icon name="X" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming sidebar */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Ближайшие события</p>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет запланированных событий</p>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((ev) => {
                      const [y, m, d] = ev.date.split("-");
                      const label = `${d}.${m}.${y}`;
                      const daysLeft = Math.round((new Date(ev.date).getTime() - new Date(todayKey).getTime()) / 86400000);
                      return (
                        <div key={ev.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: EVENT_META[ev.type].bg }}>
                            <Icon name={EVENT_META[ev.type].icon} size={15} style={{ color: EVENT_META[ev.type].color } as React.CSSProperties} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            daysLeft === 0 ? "bg-foreground text-background"
                            : daysLeft <= 3 ? "bg-red-100 text-red-600"
                            : daysLeft <= 7 ? "bg-amber-100 text-amber-700"
                            : "bg-secondary text-muted-foreground"
                          }`}>
                            {daysLeft === 0 ? "Сегодня" : `${daysLeft}д`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lab reminder card */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="FlaskConical" size={16} className="text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Анализы перед циклом</p>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Срок годности — <strong>5 дней</strong> до даты госпитализации. Отмечайте дату сдачи анализов за 1–5 дней до начала цикла.
                </p>
                {events.filter(e => e.type === "cycle").length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {events.filter(e => e.type === "cycle").slice(0,3).map(cyc => {
                      const cycDate = new Date(cyc.date);
                      const labFrom = new Date(cycDate); labFrom.setDate(cycDate.getDate() - 5);
                      const labTo   = new Date(cycDate); labTo.setDate(cycDate.getDate() - 1);
                      const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth()+1)}`;
                      return (
                        <p key={cyc.id} className="text-xs text-amber-800 font-medium">
                          · {cyc.title}: сдать {fmt(labFrom)}–{fmt(labTo)}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── ADD EVENT MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground text-lg">Новое событие</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Type selector */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Тип события</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(EVENT_META) as [EventType, typeof EVENT_META.cycle][]).map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => setAddType(type)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                        addType === type ? "border-foreground bg-secondary" : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
                        <Icon name={meta.icon} size={16} style={{ color: meta.color } as React.CSSProperties} />
                      </div>
                      <span className="text-xs font-medium text-foreground leading-tight">{meta.label}</span>
                    </button>
                  ))}
                </div>
                {addType === "lab" && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <Icon name="AlertCircle" size={12} />
                    Анализы действительны 5 дней — планируйте за 1–5 дней до госпитализации
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-2">Дата</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-2">Название</label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder={addType === "cycle" ? "Например: Цикл 3, Доцетаксел" : addType === "exam" ? "Например: МРТ малого таза" : "Например: ОАК, биохимия, коагулограмма"}
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-2">Заметка <span className="normal-case font-normal">(необязательно)</span></label>
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="Учреждение, врач, напоминание..."
                  className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={saveEvent}
                disabled={!addTitle.trim() || !addDate}
                className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REFERENCE ── */}
      {section === "reference" && (
        <main className="max-w-5xl mx-auto px-6 py-12 animate-fade-in">
          {!selectedNosology ? (
            // ── Список нозологий (плашки) ──
            <>
              <div className="mb-10">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Онкоурология</p>
                <h2 className="font-display text-4xl text-foreground mb-3">Справочник нозологий</h2>
                <p className="text-muted-foreground max-w-2xl leading-relaxed">
                  Подробная клиническая информация по каждому заболеванию — симптомы, диагностика, стадии, методы лечения.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {NOSOLOGIES.map((nos) => (
                  <button
                    key={nos.id}
                    onClick={() => { setSelectedNosology(nos.id); setOpenRef(null); }}
                    className="group bg-card border border-border rounded-2xl p-6 text-left hover:border-foreground/30 hover:shadow-md transition-all duration-200 flex flex-col"
                  >
                    {/* Иллюстрация органа */}
                    <div
                      className="w-full aspect-square max-h-36 mb-5 rounded-xl flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: nos.accentColor + "12", color: nos.accentColor }}
                    >
                      <div className="w-24 h-24">
                        {nos.organ}
                      </div>
                    </div>
                    {/* Мета */}
                    <span
                      className="text-xs font-semibold uppercase tracking-widest mb-2"
                      style={{ color: nos.accentColor }}
                    >
                      МКБ-10: {nos.mkb}
                    </span>
                    <h3 className="font-semibold text-foreground text-lg leading-snug mb-2 group-hover:text-foreground">
                      {nos.name}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">{nos.tagline}</p>
                    <div className="flex items-center gap-1.5 mt-4 text-xs font-medium" style={{ color: nos.accentColor }}>
                      Открыть справочник
                      <Icon name="ArrowRight" size={13} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-10 bg-secondary rounded-2xl px-6 py-5 flex items-start gap-4">
                <Icon name="Info" size={18} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Информация носит справочный характер и не заменяет консультацию онколога.
                  Для постановки диагноза и назначения лечения обратитесь к специалисту.
                </p>
              </div>
            </>
          ) : (() => {
            // ── Детальная страница нозологии ──
            const nos = NOSOLOGIES.find((n) => n.id === selectedNosology)!;
            return (
              <>
                {/* Хлебные крошки */}
                <button
                  onClick={() => { setSelectedNosology(null); setOpenRef(null); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
                >
                  <Icon name="ChevronLeft" size={16} />
                  Все нозологии
                </button>

                {/* Шапка */}
                <div className="flex items-start gap-6 mb-10 flex-wrap">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: nos.accentColor + "15", color: nos.accentColor }}
                  >
                    <div className="w-12 h-12">{nos.organ}</div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: nos.accentColor }}>
                      МКБ-10: {nos.mkb}
                    </p>
                    <h2 className="font-display text-4xl text-foreground mb-2">{nos.name}</h2>
                    <p className="text-muted-foreground max-w-2xl leading-relaxed">{nos.tagline}</p>
                  </div>
                </div>

                {/* Разделы аккордеоном */}
                <div className="space-y-3">
                  {nos.sections.map((sec, i) => (
                    <div key={sec.title} className="bg-card border border-border rounded-2xl overflow-hidden">
                      <button
                        className="w-full px-6 py-5 flex items-center justify-between text-left"
                        onClick={() => setOpenRef(openRef === i ? null : i)}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: nos.accentColor + "18" }}
                          >
                            <Icon name={sec.icon} size={17} style={{ color: nos.accentColor } as React.CSSProperties} />
                          </div>
                          <span className="font-semibold text-foreground">{sec.title}</span>
                        </div>
                        <Icon
                          name="ChevronDown"
                          size={18}
                          className="text-muted-foreground flex-shrink-0 transition-transform"
                          style={{ transform: openRef === i ? "rotate(180deg)" : "rotate(0deg)" } as React.CSSProperties}
                        />
                      </button>
                      {openRef === i && (
                        <div className="px-6 pb-6 animate-fade-in">
                          <div className="border-t border-border pt-5 space-y-5">
                            {sec.items.map((item) => (
                              <div key={item.label}>
                                <p
                                  className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                                  style={{ color: nos.accentColor }}
                                >
                                  {item.label}
                                </p>
                                <p className="text-foreground leading-relaxed text-sm">{item.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 bg-secondary rounded-2xl px-6 py-5 flex items-start gap-4">
                  <Icon name="Info" size={18} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Информация носит справочный характер и не заменяет консультацию онколога.
                    Для постановки диагноза и назначения лечения обратитесь к специалисту.
                  </p>
                </div>
              </>
            );
          })()}
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
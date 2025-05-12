type Duration = {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
};

const grammarRules = {
  en: {
    year: (n: number) => (n === 1 ? "year" : "years"),
    month: (n: number) => (n === 1 ? "month" : "months"),
    day: (n: number) => (n === 1 ? "day" : "days"),
    hour: (n: number) => (n === 1 ? "hour" : "hours"),
    joiner: " ",
  },
  ar: {
    year: (n: number) => (n === 1 ? "سنة" : n <= 10 ? "سنوات" : "سنين"),
    month: (n: number) => "أشهر",
    day: (n: number) => "يوماً",
    hour: (n: number) => "ساعة",
    joiner: " و ",
  },
  ru: {
    year: (n: number) =>
      n % 10 === 1 && n % 100 !== 11
        ? "год"
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "года"
        : "лет",
    month: (n: number) =>
      n % 10 === 1 && n % 100 !== 11
        ? "месяц"
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "месяца"
        : "месяцев",
    day: (n: number) =>
      n % 10 === 1 && n % 100 !== 11
        ? "день"
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "дня"
        : "дней",
    hour: (n: number) =>
      n % 10 === 1 && n % 100 !== 11
        ? "час"
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)
        ? "часа"
        : "часов",
    joiner: " ",
  },
};

/**
 * Helper function to convert years float to detailed time components
 */
function convertYearsToDetailedTime(yearsFloat: number) {
  const daysInYear = 365;
  const daysInMonth = 30;
  const hoursInDay = 24;

  // Convert total years to days
  let totalDays = yearsFloat * daysInYear;

  // Extract full years
  const years = Math.floor(totalDays / daysInYear);
  totalDays = totalDays % daysInYear;

  // Extract full months
  const months = Math.floor(totalDays / daysInMonth);
  totalDays = totalDays % daysInMonth;

  // Extract full days
  const days = Math.floor(totalDays);

  // Remaining hours
  const remainingHours = (totalDays - days) * hoursInDay;
  const hours = Math.round(remainingHours);

  return { years, months, days, hours };
}

export function formatDuration(
  { years, months, days, hours }: Duration,
  lang: "en" | "ar" | "ru"
): string {
  const rules = grammarRules[lang];
  const parts: string[] = [];

  if (lang === "ar") {
    if (years) parts.push(`${years} ${rules.year(years)} `);
    if (months) parts.push(`${months} ${rules.month(months)} `);
    if (days) parts.push(`${days} ${rules.day(days)}`);
    if (hours) parts.push(`${hours} ${rules.hour(hours)}`);
  } 
  
  else {
    if (years) parts.push(`${years} ${rules.year(years)}, `);
    if (months) parts.push(`${months} ${rules.month(months)}, `);
    if (days) parts.push(`${days} ${rules.day(days)}, `);
    if (hours) parts.push(`${hours} ${rules.hour(hours)}`);
  }

  return parts.join(rules.joiner);
}

/**
 * Formats Remaining Useful Life (RUL) for both Dashboard and History pages
 * @param rulInSteps RUL value in steps
 * @param options Optional parameters for formatting
 * @returns Formatted RUL string
 */
export function formatRUL(rulInSteps: number, options?: {
  t?: any,                        // Translation function for classic localization
  i18n?: { language: string },    // i18n instance for grammar-based localization
  useGrammarRules?: boolean       // Whether to use grammar rules (true) or t function (false)
}): string {
  // Calculate total time values
  const totalHours = rulInSteps * 12.0;
  const totalDays = totalHours / 24.0;
  const totalMonths = totalDays / 30.0;
  const totalYears = totalMonths / 12.0;
  
  // Get time components
  const duration = convertYearsToDetailedTime(totalYears);
  const { years, months, days, hours } = duration;
  
  // If grammar rules should be used (default for Dashboard.tsx)
  if (options?.useGrammarRules !== false && options?.i18n) {
    // Get language from i18n instance
    const currentLang = options.i18n.language.substring(0, 2) as "en" | "ar" | "ru";
    const lang = ["en", "ar", "ru"].includes(currentLang) ? currentLang : "en";
    
    return formatDuration(duration, lang);
  }
  
  // Otherwise use t function (for History.tsx)
  const t = options?.t;
  if (t) {
    let rul_text = ``;
    if (years >= 1) rul_text += `${years} ${t('years')} `;
    if (months >= 1) rul_text += `${months} ${t('months')} `;
    if (days >= 1) rul_text += `${days} ${t('days')} `;
    if (hours >= 1) rul_text += `${hours} ${t('hours')} `;
    return rul_text.trim() || `${hours} ${t('hours')}`;
  }
  
  // Fallback if neither option is provided
  return `${years ? years + 'y ' : ''}${months ? months + 'm ' : ''}${days ? days + 'd ' : ''}${hours ? hours + 'h' : '0h'}`;
} 
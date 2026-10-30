/**
 * Deterministic reminder templates. They are reviewed copy, not generated
 * text, so a reminder never misstates an amount or a date. For another
 * language or tone the agent writes its own and logs it with log-nudge.
 */
export const REMINDER_LANGUAGES = ["en", "pcm", "es", "fr", "sw"] as const;
export type ReminderLanguage = (typeof REMINDER_LANGUAGES)[number];

export interface ReminderVars {
  first: string;
  circle: string;
  amount: string;
  round: number;
  date: string;
  recipient: string;
  link: string;
  seal: string;
  late: boolean;
}

const TEMPLATES: Record<ReminderLanguage, (v: ReminderVars) => string> = {
  en: (v) =>
    `Hi ${v.first}, ${v.late ? "a gentle reminder" : "a heads-up"} from ${v.circle}: your round ${v.round} contribution of ${v.amount} ${v.late ? "was due on" : "is due on"} ${v.date}. ${v.recipient} collects this round. See your record anytime: ${v.link}\nLedger seal ${v.seal}`,
  pcm: (v) =>
    `Hello ${v.first}, small reminder from ${v.circle}: your ${v.amount} for round ${v.round} ${v.late ? "suppose don land since" : "go due on"} ${v.date}. Na ${v.recipient} go collect this round. You fit check your record anytime: ${v.link}\nLedger seal ${v.seal}`,
  es: (v) =>
    `Hola ${v.first}, un recordatorio de ${v.circle}: tu aporte de ${v.amount} para la ronda ${v.round} ${v.late ? "venció el" : "vence el"} ${v.date}. Esta ronda la cobra ${v.recipient}. Consulta tu registro cuando quieras: ${v.link}\nSello del libro ${v.seal}`,
  fr: (v) =>
    `Bonjour ${v.first}, petit rappel de ${v.circle} : ta cotisation de ${v.amount} pour le tour ${v.round} ${v.late ? "était due le" : "est due le"} ${v.date}. C'est ${v.recipient} qui reçoit ce tour. Consulte ton relevé à tout moment : ${v.link}\nSceau du registre ${v.seal}`,
  sw: (v) =>
    `Habari ${v.first}, ukumbusho kutoka ${v.circle}: mchango wako wa ${v.amount} kwa mzunguko wa ${v.round} ${v.late ? "ulitakiwa tarehe" : "unatakiwa tarehe"} ${v.date}. ${v.recipient} ndiye anapokea mzunguko huu. Angalia rekodi yako wakati wowote: ${v.link}\nMuhuri wa daftari ${v.seal}`,
};

export function renderReminder(lang: ReminderLanguage, vars: ReminderVars): string {
  return TEMPLATES[lang](vars);
}

/** wa.me wants digits only, with country code and no plus sign. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function shortDate(isoDate: string, lang: ReminderLanguage): string {
  const locale = { en: "en-GB", pcm: "en-GB", es: "es", fr: "fr", sw: "sw" }[lang];
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

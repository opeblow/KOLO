import {
  IconArrowRight,
  IconArrowUpRight,
  IconBrandWhatsapp,
  IconCheck,
  IconCircleCheckFilled,
  IconCode,
  IconLock,
  IconMessageChatbot,
  IconPlug,
  IconPlus,
  IconShieldCheck,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

import { addDays } from "../../../shared/schedule";

import { KoloMark, KoloWordmark, Seal } from "../kolo/brand";
import { RotationRing, type RingRound } from "../kolo/RotationRing";
import { AlertPlayground, DEMO_MEMBERS, TamperDemo } from "./demos";

/* Illustrative sample data for the hero. Labelled as such on the page. */
const SAMPLE_MEMBERS = DEMO_MEMBERS.map((name, i) => ({ id: `s${i}`, name }));

const SAMPLE_ROUNDS: RingRound[] = SAMPLE_MEMBERS.map((m, i) => ({
  round: i + 1,
  recipientId: m.id,
  status: i < 4 ? "paid" : i === 4 ? "collecting" : "upcoming",
  collectedMinor: i < 4 ? 40_000_000 : i === 4 ? 30_000_000 : 0,
  potMinor: 40_000_000,
  dueDate: addDays("2026-10-05", i * 7),
}));

const NAMES = [
  ["ajo", "Nigeria"],
  ["esusu", "Nigeria"],
  ["adashi", "Nigeria"],
  ["susu", "Ghana"],
  ["chama", "Kenya"],
  ["stokvel", "South Africa"],
  ["tontine", "West Africa"],
  ["tanda", "Mexico"],
  ["cundina", "Mexico"],
  ["hui", "China"],
  ["kye", "Korea"],
  ["paluwagan", "Philippines"],
  ["chit fund", "India"],
  ["partner", "Jamaica"],
  ["sol", "Haiti"],
] as const;

const FAQ: [string, string][] = [
  [
    "Does Kolo hold or move our money?",
    "No. Money moves between your members' bank accounts exactly as it does today. Kolo reads the alerts you paste, keeps the records, and refuses to record anything that breaks the circle's rules.",
  ],
  [
    "Do I need to connect my bank account?",
    "No bank login, ever. You copy the SMS or app notifications you already receive and paste them in. Kolo reads GTBank, Access, OPay, Moniepoint, M-Pesa and Zelle formats directly; the agent reads anything else.",
  ],
  [
    "Do members need to sign up?",
    "No. Each member gets a private link they open from WhatsApp. Their phone downloads the ledger and checks every entry itself, with nothing to install.",
  ],
  [
    "What stops the organizer, or Kolo, from changing the records?",
    "Three layers. The database refuses to update or delete ledger rows. Every entry is sealed with SHA-256 into a chain, so changing one breaks every seal after it. And members carry the latest seal in their reminders, so even rewriting the whole chain gets caught. Try it above.",
  ],
  [
    "Can the AI pay someone out early if I ask nicely?",
    "No. The agent calls the same guarded actions as the buttons. Payout rules run inside a locked database transaction, so a payout to the wrong person, out of order, or before everyone has paid is refused no matter who asks.",
  ],
  [
    "Which currencies work?",
    "Naira, cedi, shilling, rand, dollar, peso and more. Amounts are stored as whole minor units (kobo, cents), so there are no rounding errors.",
  ],
];

/* ------------------------------------------------------------ primitives */

function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

function SectionHead({
  eyebrow,
  title,
  body,
  dark,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("kolo-reveal max-w-3xl", className)}>
      <p className={cn("kolo-eyebrow", dark ? "text-gold" : "text-primary")}>{eyebrow}</p>
      <h2 className="kolo-text-balance mt-4 font-display text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[3.4rem]">
        {title}
      </h2>
      {body ? (
        <p className={cn("mt-5 max-w-2xl text-lg leading-relaxed", dark ? "text-white/65" : "text-muted-foreground")}>{body}</p>
      ) : null}
    </div>
  );
}

function CtaButton({ to, children, variant = "gold" }: { to: string; children: ReactNode; variant?: "gold" | "light" | "ink" }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex h-12 items-center gap-2 rounded-full pl-6 pr-2 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        variant === "gold" && "bg-gold text-gold-foreground hover:brightness-105",
        variant === "light" && "bg-white text-foreground hover:bg-white/90",
        variant === "ink" && "bg-foreground text-background hover:bg-foreground/85",
      )}
    >
      {children}
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full transition-transform group-hover:translate-x-0.5",
          variant === "gold" ? "bg-gold-foreground text-gold" : variant === "light" ? "bg-foreground text-background" : "bg-background text-foreground",
        )}
      >
        <IconArrowRight className="size-4" />
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------- header */

function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 rounded-full pl-4 pr-2 transition-all duration-300 sm:pl-5",
          scrolled
            ? "border border-white/10 bg-[hsl(158_60%_9%/0.78)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            : "border border-transparent",
        )}
      >
        <Link to="/" aria-label="Kolo home" className="rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
          <KoloWordmark />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 text-sm text-white/70 md:flex">
          {[
            ["#demo", "Try it"],
            ["#features", "Features"],
            ["#proof", "Verification"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-1.5 transition hover:bg-white/10 hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Link to="/circles" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex">
            Sign in
          </Link>
          <Link
            to="/circles/new"
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-foreground transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Start a circle
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ hero */

function AppFrame() {
  const paid = [true, true, false, true, true, false, true, true];
  return (
    <div className="relative">
      <div className="absolute -inset-x-10 -top-10 bottom-10 rounded-[40px] bg-gold/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-background text-foreground shadow-[0_60px_120px_-40px_rgba(0,0,0,0.75)]">
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto rounded-md bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground">kolo.app/circles/yaba-traders</span>
        </div>
        <div className="grid gap-0 sm:grid-cols-[1fr_230px]">
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold leading-tight">Yaba Traders&apos; Ajo</p>
                <p className="text-xs text-muted-foreground">8 members · ₦50,000 weekly</p>
              </div>
              <Seal seal="3def·4ea4" />
            </div>
            <RotationRing members={SAMPLE_MEMBERS} rounds={SAMPLE_ROUNDS} currentRound={5} currency="NGN" className="mx-auto mt-1 max-w-[330px]" />
          </div>
          <div className="hidden border-l border-border bg-card sm:block">
            <div className="border-b border-border p-4">
              <p className="kolo-eyebrow text-[10px] text-muted-foreground">Round 5 of 8</p>
              <p className="mt-1 text-sm font-semibold">Emeka collects</p>
              <p className="kolo-kpi mt-3 text-2xl">₦300,000</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-3/4 rounded-full bg-gold" />
              </div>
            </div>
            <ul className="divide-y divide-border text-[12.5px]">
              {DEMO_MEMBERS.map((n, i) => (
                <li key={n} className="flex items-center gap-2 px-4 py-[7px]">
                  {paid[i] ? (
                    <IconCircleCheckFilled className="size-4 text-primary" />
                  ) : (
                    <span className="size-4 rounded-full border-2 border-dashed border-clay/60" />
                  )}
                  <span className={cn("truncate", !paid[i] && "font-medium")}>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="kolo-pop absolute -left-4 -bottom-10 hidden w-[290px] rounded-2xl border border-clay/30 bg-card p-4 text-foreground shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] md:block lg:-left-14" style={{ animationDelay: "500ms" }}>
        <div className="flex items-center gap-2 text-sm font-semibold text-clay">
          <IconLock className="size-4" /> Payout blocked
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed">
          Round 5 is short <span className="tabular font-semibold">₦100,000</span>. Waiting on Aisha and Bisi.
        </p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">round_not_funded</p>
      </div>

      <div className="kolo-pop absolute -right-3 -top-8 hidden w-[240px] rounded-2xl bg-card p-3.5 text-foreground shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] md:block lg:-right-10" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">EO</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">Emeka Okonkwo</p>
            <p className="truncate text-[11px] text-muted-foreground">“OKONKWO EMEKA J”</p>
          </div>
          <span className="kolo-kpi text-lg text-primary">94%</span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="kolo-ink kolo-grain relative overflow-hidden pb-28 pt-32 sm:pt-40">
      <div className="kolo-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="kolo-gridlines absolute inset-0 -z-10" aria-hidden="true" />
      <Container className="grid items-center gap-16 lg:grid-cols-[1.02fr_1fr] lg:gap-10">
        <div className="kolo-rise">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-xs font-medium text-white/80 backdrop-blur transition hover:border-white/30"
          >
            <span className="rounded-full bg-gold px-2 py-0.5 font-semibold text-gold-foreground">New</span>
            Try the matcher live, no sign-up
            <IconArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
          <h1 className="kolo-text-balance mt-7 font-display text-[3.3rem] font-semibold leading-[0.92] tracking-[-0.045em] sm:text-[5.2rem]">
            Your ajo,
            <br />
            <span className="bg-gradient-to-r from-gold via-[hsl(40_95%_70%)] to-gold bg-clip-text text-transparent">kept honest.</span>
          </h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-white/70 sm:text-xl">
            An AI treasurer for savings circles. Kolo matches every bank alert to the right member, chases late payers on WhatsApp, and keeps
            books the whole group can verify. <span className="text-white">The AI does the bookkeeping. The rules decide who gets paid.</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <CtaButton to="/circles/new">Start a circle</CtaButton>
            <Link
              to="/circles?sample=1"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-[15px] font-semibold text-white transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Explore a sample circle
            </Link>
          </div>
          <ul className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {[
              ["0", "bank logins"],
              ["0", "member sign-ups"],
              ["8", "money rules the AI can't bend"],
            ].map(([n, l]) => (
              <li key={l}>
                <p className="kolo-kpi text-3xl text-white">{n}</p>
                <p className="mt-1.5 text-xs leading-snug text-white/55">{l}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-[600px]">
          <AppFrame />
          <p className="mt-14 text-right text-[11px] text-white/40 md:mt-16">Sample data</p>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------- names */

function Names() {
  return (
    <div className="relative overflow-hidden border-b border-border bg-background py-7" aria-label="Names for savings circles around the world">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <div className="kolo-marquee flex w-max gap-12 whitespace-nowrap">
        {[...NAMES, ...NAMES].map(([name, place], i) => (
          <span key={`${name}-${i}`} className="flex items-baseline gap-2" aria-hidden={i >= NAMES.length}>
            <span className="font-display text-[1.7rem] font-semibold tracking-tight">{name}</span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{place}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- problem */

function Problem() {
  return (
    <section className="py-28 sm:py-36">
      <Container>
        <SectionHead
          eyebrow="One idea, a hundred names"
          title="Run on trust. Held together by screenshots."
          body="Friends pool money every week and take turns collecting the pot. It works until it doesn't, and it usually breaks in one of three places."
        />
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["Midnight reconciliation", "The organizer scrolls forty bank SMS, matching “ADEBAYO T O” to Tunde from memory and hoping nobody was counted twice.", "40+", "alerts a night"],
            ["Nobody likes chasing friends", "Reminders feel personal, so they go out late or not at all. The round stalls and the person waiting for the pot pays the price.", "1 late payer", "stalls everyone"],
            ["Collect, then vanish", "Once someone has had their turn, the group carries the risk. Nobody can see how much, so nobody plans for it.", "₦?", "nobody knows the exposure"],
          ].map(([title, body, stat, statLabel], i) => (
            <article key={title} className="kolo-surface kolo-reveal flex flex-col rounded-[28px] p-7 sm:p-8">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <p className="kolo-kpi mt-10 text-[2.6rem] text-clay">{stat}</p>
              <p className="mt-1 text-sm text-muted-foreground">{statLabel}</p>
              <h3 className="mt-8 font-display text-2xl font-semibold leading-snug tracking-tight">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ demo */

function Demo() {
  return (
    <section id="demo" className="kolo-ink kolo-grain relative scroll-mt-20 overflow-hidden py-28 sm:py-36">
      <div className="kolo-gridlines absolute inset-0 -z-10" aria-hidden="true" />
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <SectionHead
            dark
            eyebrow="Try it: this is the real matcher"
            title={
              <>
                Paste the alerts.
                <br />
                <span className="text-white/45">Kolo shows its working.</span>
              </>
            }
          />
          <p className="max-w-sm text-white/60">
            Edit the alerts or add the tricky ones. The parser and name matcher below are the same code the app runs, working in your browser.
          </p>
        </div>
        <div className="mt-14">
          <AlertPlayground />
        </div>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/55">
          <span>Matching against: {DEMO_MEMBERS.join(", ")}</span>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- features */

function Bento() {
  return (
    <section id="features" className="scroll-mt-20 py-28 sm:py-36">
      <Container>
        <SectionHead
          eyebrow="Everything a treasurer does"
          title={
            <>
              Minus the midnight scrolling.
            </>
          }
          body="Kolo's agent reads, matches, drafts and explains. Code you can audit decides anything to do with money."
        />
        <div className="mt-16 grid auto-rows-[minmax(0,auto)] gap-4 md:grid-cols-6">
          {/* Rules */}
          <article className="kolo-surface kolo-reveal overflow-hidden rounded-[28px] md:col-span-4">
            <div className="grid h-full gap-6 p-7 sm:p-9 lg:grid-cols-[1fr_1.1fr]">
              <div>
                <IconLock className="size-6 text-primary" />
                <h3 className="mt-5 font-display text-[1.75rem] font-semibold leading-tight tracking-tight">The AI can&apos;t bend the money rules.</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Rules run inside a locked database transaction, not in a prompt. Ask the agent to pay someone early and it gets the same refusal a
                  button would.
                </p>
                <ul className="mt-6 space-y-2.5 text-[15px]">
                  {["Rounds pay out in order", "Only when every member has paid in", "Only the scheduled member, only the full pot", "Mistakes are reversed, never erased"].map((r) => (
                    <li key={r} className="flex items-start gap-2.5">
                      <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col justify-center rounded-2xl bg-muted/60 p-4 sm:p-5">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[14px] text-background">
                  Pay Emeka his pot, he needs it today.
                </p>
                <div className="mt-3 rounded-xl border border-border bg-card p-3.5 font-mono text-[12px] leading-6">
                  <p className="text-muted-foreground">→ record-payout {"{"} round: 5 {"}"}</p>
                  <p className="flex items-center gap-1.5 text-clay">
                    <IconX className="size-3.5" /> refused · round_not_funded
                  </p>
                </div>
                <p className="mt-3 max-w-[90%] rounded-2xl rounded-bl-md bg-primary px-4 py-2.5 text-[14px] text-primary-foreground">
                  I can&apos;t yet. Round 5 is short ₦100,000: Aisha and Bisi haven&apos;t paid. Want me to draft reminders?
                </p>
              </div>
            </div>
          </article>

          {/* WhatsApp */}
          <article className="kolo-surface kolo-reveal flex flex-col overflow-hidden rounded-[28px] p-7 md:col-span-2">
            <IconBrandWhatsapp className="size-6 text-primary" />
            <h3 className="mt-5 font-display text-[1.4rem] font-semibold leading-tight tracking-tight">Reminders that don&apos;t feel personal</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Exact amounts from the ledger, in English, Pidgin, French, Spanish or Swahili. One tap opens WhatsApp.</p>
            <div className="mt-6 rounded-2xl bg-[#e7ffdb] p-3.5 text-[13px] leading-relaxed text-[#0b141a] dark:bg-[#005c4b] dark:text-white">
              Hi Bisi 👋 Round 5 of Yaba Traders&apos; Ajo was due Sunday. You owe <b>₦50,000</b>. Check the books: kolo.app/m/…
              <span className="mt-1 block text-right font-mono text-[10.5px] opacity-60">seal 3def·4ea4 ✓✓</span>
            </div>
          </article>

          {/* Exposure */}
          <article className="kolo-surface kolo-reveal rounded-[28px] p-7 md:col-span-2">
            <IconUsers className="size-6 text-primary" />
            <h3 className="mt-5 font-display text-[1.4rem] font-semibold leading-tight tracking-tight">See the risk before it bites</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Trust exposure: what members who already collected still owe the group.</p>
            <p className="kolo-kpi mt-6 text-[2.4rem]">₦600,000</p>
            <div className="mt-3 flex h-2 gap-1">
              <span className="w-[45%] rounded-full bg-clay" />
              <span className="w-[30%] rounded-full bg-gold" />
              <span className="flex-1 rounded-full bg-muted" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Ngozi, Tunde, Aisha · still paying in</p>
          </article>

          {/* Surfaces */}
          <article className="kolo-surface kolo-reveal rounded-[28px] p-7 md:col-span-2">
            <IconPlug className="size-6 text-primary" />
            <h3 className="mt-5 font-display text-[1.4rem] font-semibold leading-tight tracking-tight">One set of actions, every surface</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The app, the agent, the CLI, and Claude via MCP all call the same guarded code. Every entry records who wrote it.</p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {["app", "agent", "mcp", "cli", "job"].map((s) => (
                <span key={s} className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px]">
                  via {s}
                </span>
              ))}
            </div>
          </article>

          {/* Currencies */}
          <article className="kolo-surface kolo-reveal rounded-[28px] p-7 md:col-span-2">
            <IconMessageChatbot className="size-6 text-primary" />
            <h3 className="mt-5 font-display text-[1.4rem] font-semibold leading-tight tracking-tight">Set up by pasting your group&apos;s rules</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Paste the WhatsApp message with your terms and member list. Kolo drafts the circle for you to review.</p>
            <div className="mt-6 flex flex-wrap gap-2 font-display text-xl font-semibold">
              {["₦", "KSh", "GH₵", "R", "$", "MX$"].map((c) => (
                <span key={c} className="grid h-10 min-w-10 place-items-center rounded-xl bg-muted px-2.5">
                  {c}
                </span>
              ))}
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------------- proof */

function Proof() {
  return (
    <section id="proof" className="scroll-mt-20 border-y border-border bg-card py-28 sm:py-36">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <SectionHead
            eyebrow="Go on, try to cook the books"
            title={
              <>
                Don&apos;t trust the organizer.
                <br />
                <span className="text-primary">Check.</span>
              </>
            }
          />
          <p className="max-w-sm text-muted-foreground">
            A real six-entry ledger, sealed with SHA-256 in your browser just now. Use the scissors to secretly change an amount, then try covering it up.
          </p>
        </div>
        <div className="mt-14">
          <TamperDemo />
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- member */

function PhoneMember() {
  return (
    <div className="mx-auto w-[300px] rounded-[3rem] bg-foreground p-2.5 shadow-[0_60px_100px_-40px_hsl(var(--foreground)/0.7)]">
      <div className="overflow-hidden rounded-[2.4rem] bg-background">
        <div className="mx-auto mt-3 h-6 w-24 rounded-full bg-foreground" />
        <div className="kolo-ink kolo-grain relative mx-3 mt-4 overflow-hidden rounded-3xl p-5">
          <div className="kolo-glow absolute inset-0 -z-10" />
          <div className="flex items-center gap-2 text-white/80">
            <KoloMark className="size-5" />
            <span className="text-[11px] font-semibold">Yaba Traders&apos; Ajo</span>
          </div>
          <p className="mt-5 text-xs text-white/60">Hi Bisi, your turn</p>
          <p className="kolo-kpi mt-1 text-[2rem] text-gold">Round 7</p>
          <p className="text-xs text-white/60">Sun 16 Nov · ₦400,000 pot</p>
        </div>
        <div className="space-y-2 p-3">
          <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-muted-foreground">Paid in</p>
              <p className="text-[11px] text-muted-foreground">of ₦400,000</p>
            </div>
            <p className="kolo-kpi mt-1 text-xl">₦250,000</p>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div className="h-full w-[62%] rounded-full bg-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-accent px-3.5 py-3 text-[12px] font-medium text-accent-foreground">
            <IconShieldCheck className="size-5 shrink-0" />
            <span>
              29 of 29 entries verified on this phone
              <span className="block font-mono text-[10.5px] font-normal opacity-70">seal 3def·4ea4</span>
            </span>
          </div>
        </div>
        <div className="mx-auto mb-2 mt-1 h-1 w-28 rounded-full bg-foreground/25" />
      </div>
    </div>
  );
}

function Members() {
  return (
    <section className="py-28 sm:py-36">
      <Container className="grid items-center gap-16 lg:grid-cols-[1fr_auto] lg:gap-24">
        <div>
          <SectionHead
            eyebrow="For members"
            title="Their own link. Their own phone. Their own maths."
            body="Every member gets a private link in their reminder. No app, no account. Their browser downloads the ledger, re-checks every seal from the first entry, and rebuilds the balances itself."
          />
          <dl className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              ["The seal", "Reminders carry the current seal, like 3def·4ea4. Rewrite history and it stops matching."],
              ["Append-only", "The database refuses updates and deletes. Corrections are new entries pointing at the old."],
              ["Private by default", "Unguessable 128-bit links, no phone numbers shown, hidden from search engines."],
            ].map(([t, d]) => (
              <div key={t} className="kolo-reveal border-t border-border pt-5">
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="kolo-reveal">
          <PhoneMember />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- builders */

function Builders() {
  return (
    <section className="pb-28 sm:pb-36">
      <Container>
        <div className="kolo-ink kolo-grain relative overflow-hidden rounded-[32px] p-7 sm:p-12">
          <div className="kolo-gridlines absolute inset-0 -z-10" aria-hidden="true" />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="kolo-eyebrow text-gold">For builders</p>
              <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[2.8rem]">
                Run your circle from Claude, the CLI, or your own agent.
              </h2>
              <p className="mt-4 max-w-lg text-white/65">
                Built on Agent-Native. Each capability is one typed action, exposed to the UI, the in-app agent, MCP clients and the terminal with the same rules.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 font-mono text-[12.5px] leading-7">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-white/50">
                <IconCode className="size-4" /> terminal
              </div>
              <pre tabIndex={0} aria-label="Terminal example" className="overflow-x-auto px-4 py-3 text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">
                <span className="text-white/45">$</span> pnpm action record-payout --round 5{"\n"}
                <span className="text-[hsl(8_80%_70%)]">✗ round_not_funded</span>
                {": Round 5 is short ₦100,000.\n"}
                <span className="text-white/45">$</span> pnpm action verify-ledger{"\n"}
                <span className="text-[hsl(157_60%_60%)]">✓ 29 entries · head 3def·4ea4</span>
              </pre>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------- faq */

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 pb-28 sm:pb-36">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead eyebrow="Questions" title="The careful-treasurer FAQ." />
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="kolo-faq group py-1">
              <summary className="flex items-center justify-between gap-6 rounded-lg py-5 text-left text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {q}
                <span className="kolo-faq-icon grid size-8 shrink-0 place-items-center rounded-full border border-border transition-transform duration-200">
                  <IconPlus className="size-4" />
                </span>
              </summary>
              <p className="max-w-2xl pb-6 pr-12 leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------ cta/footer */

function FinalCta() {
  return (
    <section className="kolo-ink kolo-grain relative overflow-hidden pt-28 sm:pt-36">
      <div className="kolo-glow absolute inset-0 -z-10" aria-hidden="true" />
      <Container className="text-center">
        <h2 className="kolo-text-balance mx-auto max-w-4xl font-display text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[4.6rem]">
          Start your circle in <span className="text-gold">two minutes.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/65">
          Fill in the form, or paste your group&apos;s rules from WhatsApp and Kolo sets it up for you to review.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <CtaButton to="/circles/new">Start a circle</CtaButton>
          <CtaButton to="/circles?sample=1" variant="light">
            Explore a sample
          </CtaButton>
        </div>
      </Container>
      <footer className="mt-28 border-t border-white/10">
        <Container className="flex flex-col gap-6 py-10 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-white">
            <KoloWordmark />
          </div>
          <p>Kolo keeps records. It never holds or moves money.</p>
          <a
            href="https://agent-native.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            Built on Agent-Native <IconArrowUpRight className="size-3.5" />
          </a>
        </Container>
        <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden">
          <p className="-mb-[0.22em] text-center font-display text-[30vw] font-bold leading-none tracking-[-0.06em] text-white/[0.05]">kolo</p>
        </div>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

export default function Landing() {
  // Lets tests (and analytics) know the page is interactive, not just painted.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <div data-hydrated={hydrated ? "true" : "false"} className="min-h-screen overflow-x-clip bg-background text-foreground antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Names />
        <Problem />
        <Demo />
        <Bento />
        <Proof />
        <Members />
        <Builders />
        <Faq />
        <FinalCta />
      </main>
    </div>
  );
}

import {
  IconArrowRight,
  IconBrandWhatsapp,
  IconCheck,
  IconCircleCheckFilled,
  IconClipboardText,
  IconCode,
  IconLink,
  IconLock,
  IconMessageChatbot,
  IconPlugConnected,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

import { addDays } from "../../../shared/schedule";

import { KoloMark, KoloWordmark, Seal } from "../kolo/brand";
import { RotationRing, type RingRound } from "../kolo/RotationRing";

/* Illustrative sample data for the hero. Labelled as such on the page. */
const SAMPLE_MEMBERS = [
  "Ngozi Okafor",
  "Tunde Adebayo",
  "Aisha Mohammed",
  "Chidi Eze",
  "Emeka Okonkwo",
  "Temitope Bello",
  "Bisi Olatunji",
  "Musa Ibrahim",
].map((name, i) => ({ id: `s${i}`, name }));

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

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("px-4 sm:px-6", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-[0.16em] text-primary", className)}>{children}</p>
  );
}

function PrimaryCta({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {children}
      <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ------------------------------------------------------------- fragments */

function AlertReceipt() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_hsl(var(--border)),0_18px_40px_-24px_hsl(var(--foreground)/0.35)]">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Bank alert · SMS</span>
        <span>08:14</span>
      </div>
      <pre className="ruled mt-3 whitespace-pre-wrap font-mono text-[12.5px] leading-7 text-foreground">
        {"Acct: 0123***789\nAmt: "}
        <mark className="rounded bg-gold/30 px-0.5 text-foreground">NGN50,000.00 CR</mark>
        {"\nDesc: TRANSFER FROM "}
        <mark className="rounded bg-primary/15 px-0.5 text-foreground">OKONKWO EMEKA J</mark>
        {"\nAvail Bal: NGN350,000.00"}
      </pre>
    </div>
  );
}

function MatchCard({ compact }: { compact?: boolean }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-[0_18px_40px_-24px_hsl(var(--foreground)/0.35)]">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">EO</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Emeka Okonkwo</p>
          <p className="text-xs text-muted-foreground">₦50,000 · round 5</p>
        </div>
        <span className="font-display text-xl font-semibold text-primary tabular">94%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[94%] rounded-full bg-primary" />
      </div>
      {compact ? null : (
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
          <li className="flex gap-2">
            <IconCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            “Okonkwo Emeka J” matches Emeka Okonkwo
          </li>
          <li className="flex gap-2">
            <IconCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Exactly one contribution, applied to round 5
          </li>
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <span className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          Confirm
        </span>
        <span className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-xs font-medium">
          Someone else
        </span>
      </div>
    </div>
  );
}

function RefusalCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-clay/30 bg-card p-4 shadow-[0_18px_40px_-24px_hsl(var(--foreground)/0.35)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-clay">
        <IconLock className="size-4" /> Payout blocked
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
        Round 5 is short <span className="font-semibold tabular">₦100,000</span>. Waiting on Bisi and Musa.
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-muted-foreground">round_not_funded</span>
        <Seal seal="3def·4ea4" />
      </div>
    </div>
  );
}

function ChainStrip() {
  const blocks = [
    { seq: 27, what: "Bisi paid ₦50,000", hash: "a41c·90e2" },
    { seq: 28, what: "Musa paid ₦50,000", hash: "77f0·1b3d" },
    { seq: 29, what: "Paid Emeka ₦400,000", hash: "3def·4ea4" },
  ];
  return (
    <div className="w-full max-w-md space-y-0">
      {blocks.map((b, i) => (
        <div key={b.seq} className="relative pl-8">
          {i < blocks.length - 1 ? (
            <span className="absolute left-[13px] top-8 h-[calc(100%-1rem)] w-px bg-primary/40" aria-hidden="true" />
          ) : null}
          <span className="absolute left-0 top-3 grid size-7 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            #{b.seq}
          </span>
          <div className="mb-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{b.what}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{b.hash}</span>
            </div>
            <p className="mt-1 font-mono text-[10.5px] text-muted-foreground/80">
              prev {i === 0 ? "c9e1·04aa" : blocks[i - 1]!.hash} → sha256
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pl-8 text-sm font-semibold text-primary">
        <IconShieldCheck className="size-5" /> 29 of 29 entries verified on this phone
      </div>
    </div>
  );
}

function PhoneMember() {
  return (
    <div className="mx-auto w-[280px] rounded-[2.4rem] border-[10px] border-foreground bg-background p-4 shadow-[0_40px_80px_-40px_hsl(var(--foreground)/0.6)]">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-foreground/20" />
      <div className="flex items-center gap-2">
        <KoloMark className="size-6" />
        <span className="text-xs font-semibold">Yaba Traders&apos; Ajo</span>
      </div>
      <p className="mt-4 font-display text-2xl font-semibold leading-tight">Hi Bisi,</p>
      <p className="text-sm text-muted-foreground">here&apos;s where you stand.</p>
      <div className="mt-4 rounded-2xl bg-card p-3 ring-1 ring-border">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Paid in</p>
        <p className="font-display text-xl font-semibold tabular">₦250,000 <span className="text-sm font-normal text-muted-foreground">of ₦400,000</span></p>
        <div className="mt-2 h-1.5 rounded-full bg-muted">
          <div className="h-full w-[62%] rounded-full bg-primary" />
        </div>
      </div>
      <div className="mt-2 rounded-2xl bg-gold/20 p-3">
        <p className="text-[11px] uppercase tracking-wider text-gold-foreground/80">Your turn</p>
        <p className="font-display text-lg font-semibold text-gold-foreground">Round 7 · 14 Dec</p>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-primary">
        <IconCircleCheckFilled className="size-4" /> Verified on this phone · 3def·4ea4
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="Kolo home" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <KoloWordmark />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#rules" className="hover:text-foreground">The rules</a>
            <a href="#verify" className="hover:text-foreground">Verification</a>
            <a href="#everywhere" className="hover:text-foreground">For builders</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/circles" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium hover:bg-muted sm:inline-flex">
              Sign in
            </Link>
            <Link
              to="/circles/new"
              className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/85"
            >
              Start a circle
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* HERO */}
        <Section className="pb-20 pt-14 sm:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="kolo-rise">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="kolo-live-dot size-2 rounded-full bg-primary" />
                An AI treasurer for savings circles
              </span>
              <h1 className="mt-6 font-display text-[3.2rem] font-bold leading-[0.95] tracking-[-0.035em] sm:text-[4.6rem]">
                Your ajo,
                <br />
                <span className="text-primary">kept honest.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Kolo reads your bank alerts, matches every contribution to the right member, chases late payers, and keeps a
                ledger the whole group can check from WhatsApp. The AI does the bookkeeping.{" "}
                <span className="text-foreground">The rules decide who gets paid.</span>
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryCta to="/circles/new">Start a circle</PrimaryCta>
                <Link
                  to="/circles?sample=1"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-[15px] font-semibold transition hover:border-foreground/30"
                >
                  Explore a sample circle
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["No bank login needed", "Members don't need an account", "₦ · KSh · GH₵ · $ · R and more"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <IconCheck className="size-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Yaba Traders&apos; Ajo</p>
                    <p className="text-xs text-muted-foreground">8 members · ₦50,000 weekly</p>
                  </div>
                  <Seal seal="3def·4ea4" />
                </div>
                <RotationRing
                  members={SAMPLE_MEMBERS}
                  rounds={SAMPLE_ROUNDS}
                  currentRound={5}
                  currency="NGN"
                  className="mx-auto mt-2 max-w-[370px]"
                />
                <p className="text-right text-[11px] text-muted-foreground">Sample data</p>
              </div>
              <div className="absolute -right-3 -top-8 hidden w-64 sm:block lg:-right-16">
                <MatchCard compact />
              </div>
              <div className="absolute -bottom-12 -left-3 hidden w-72 sm:block lg:-left-16">
                <RefusalCard />
              </div>
            </div>
          </div>
        </Section>

        {/* NAMES */}
        <div className="overflow-hidden border-y border-border bg-card py-5" aria-label="Names for savings circles around the world">
          <div className="kolo-marquee flex w-max gap-10 whitespace-nowrap">
            {[...NAMES, ...NAMES].map(([name, place], i) => (
              <span key={`${name}-${i}`} className="flex items-baseline gap-2" aria-hidden={i >= NAMES.length}>
                <span className="font-display text-2xl font-semibold">{name}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{place}</span>
              </span>
            ))}
          </div>
        </div>

        {/* PROBLEM */}
        <Section className="py-24">
          <div className="max-w-3xl">
            <Eyebrow>One idea, a hundred names</Eyebrow>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Run on trust. Held together by screenshots.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Friends pool money every week and take turns collecting the pot. It works until it doesn&apos;t, and it usually breaks in one of three places.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
            {[
              ["01", "Forty alerts in one group chat", "The organizer scrolls bank SMS at midnight, matching “ADEBAYO T O” to Tunde from memory, and hoping nobody's transfer got counted twice."],
              ["02", "Nobody likes chasing friends", "Reminders feel personal, so they go out late or not at all. The round stalls and the person waiting for the pot pays the price."],
              ["03", "The one who collects, then vanishes", "Once someone has had their turn, the group carries the risk. Nobody can see how much, so nobody plans for it."],
            ].map(([n, title, body]) => (
              <div key={n} className="bg-card p-8">
                <span className="font-mono text-sm text-primary">{n}</span>
                <h3 className="mt-6 font-display text-2xl font-semibold leading-snug">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* HOW */}
        <Section id="how" className="pb-24">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Paste. Match. Verify.</h2>
          <div className="mt-14 space-y-6">
            {[
              {
                n: "1",
                icon: IconClipboardText,
                title: "Paste the alerts, exactly as they arrive",
                body: "GTBank, Access, OPay, Moniepoint, M-Pesa, Zelle: paste a whole night's worth at once. Kolo reads the amount, sender, date, and reference. The same alert pasted twice is refused, and money going out is never counted as a contribution.",
                art: <AlertReceipt />,
              },
              {
                n: "2",
                icon: IconMessageChatbot,
                title: "Kolo matches each payment and shows its reasoning",
                body: "Every proposal comes with a confidence score and the evidence behind it. Confirm the obvious ones in one tap; the agent reads the messy ones for you. Correct a match once and Kolo remembers that bank's spelling of the name.",
                art: <MatchCard />,
              },
              {
                n: "3",
                icon: IconShieldCheck,
                title: "Members check the books on their own phone",
                body: "Each entry is sealed into a hash chain that links back to the first. Members open their link from WhatsApp and their browser re-checks every entry itself. Change one kobo anywhere in history and the seal breaks.",
                art: <ChainStrip />,
              },
            ].map((step) => (
              <div key={step.n} className="grid items-center gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-2">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
                      {step.n}
                    </span>
                    <step.icon className="size-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-6 font-display text-3xl font-semibold leading-tight">{step.title}</h3>
                  <p className="mt-4 max-w-lg text-[16.5px] leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
                <div className="flex justify-center rounded-2xl bg-background p-6 sm:p-10">{step.art}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* RULES */}
        <section id="rules" className="bg-emerald-ink px-4 py-24 text-background dark:bg-card dark:text-foreground sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">The rules</p>
              <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
                The AI does the work.
                <br />
                The rules hold the money.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed opacity-75">
                Kolo&apos;s agent can read, match, draft, and explain. It cannot bend the circle&apos;s rules. They are enforced inside a
                locked database transaction, not written in a prompt, so no clever wording gets around them.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Rounds pay out in order",
                  "A round pays only when every member has paid in",
                  "Only the scheduled member collects, and only the full pot",
                  "History is append-only: mistakes are reversed, never erased",
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-3 text-[16.5px]">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground">
                      <IconCheck className="size-4" />
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-background p-6 text-foreground shadow-2xl sm:p-8">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KoloMark className="size-5" /> Kolo agent
              </div>
              <p className="mt-3 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-[15px]">
                Pay Emeka his pot, he needs it today.
              </p>
              <div className="mt-4 rounded-xl border border-border bg-card p-4 font-mono text-[12.5px] leading-6">
                <p className="text-muted-foreground">→ record-payout {"{"} round: 5 {"}"}</p>
                <p className="flex items-center gap-1.5 text-clay">
                  <IconX className="size-4" /> refused · round_not_funded
                </p>
                <p className="text-foreground">Round 5 is short ₦100,000. Waiting on Bisi Olatunji, Musa Ibrahim.</p>
              </div>
              <p className="mt-4 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-[15px] text-primary-foreground">
                I can&apos;t pay Emeka yet. Two contributions are missing, from Bisi and Musa. Want me to draft WhatsApp reminders for both?
              </p>
            </div>
          </div>
        </section>

        {/* VERIFY */}
        <Section id="verify" className="py-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_auto]">
            <div className="max-w-xl">
              <Eyebrow>Verification</Eyebrow>
              <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
                Don&apos;t trust the organizer. Check.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                Every member gets a private link. No app to install, no account to create. Their phone downloads the ledger, recomputes every
                hash from the first entry, and rebuilds the balances itself, so the numbers they see weren&apos;t calculated by anyone they have to trust.
              </p>
              <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                {[
                  ["The seal", "Reminders carry the current seal, like 3def·4ea4. If history is rewritten, the seal members already hold stops matching."],
                  ["Locked in the database", "Ledger rows can't be updated or deleted. Corrections are new entries that point at the old one."],
                ].map(([t, d]) => (
                  <div key={t}>
                    <dt className="font-semibold">{t}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PhoneMember />
          </div>
        </Section>

        {/* EVERYWHERE */}
        <Section id="everywhere" className="pb-24">
          <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-12">
            <Eyebrow>Built on Agent-Native</Eyebrow>
            <h2 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight">
              One set of actions. Every surface.
            </h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              Each capability, like <code className="font-mono text-[0.9em] text-foreground">ingest-alerts</code>,{" "}
              <code className="font-mono text-[0.9em] text-foreground">confirm-payment</code>, and{" "}
              <code className="font-mono text-[0.9em] text-foreground">record-payout</code>, is defined once and shared by the app, the agent,
              the CLI, and MCP clients. Same code, same rules, same ledger, and every entry records which surface wrote it.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: IconLink, t: "The app", d: "Tap to confirm a match, record cash, or pay out a round." },
                { icon: IconMessageChatbot, t: "The Kolo agent", d: "“Process this morning's alerts and remind whoever's late.”" },
                { icon: IconPlugConnected, t: "Claude & MCP", d: "Organizers can run their circle from the AI assistant they already use." },
                { icon: IconBrandWhatsapp, t: "WhatsApp", d: "Reminders open in WhatsApp with exact amounts and the member's link." },
              ].map((s) => (
                <div key={s.t} className="rounded-2xl border border-border bg-background p-5">
                  <s.icon className="size-6 text-primary" />
                  <p className="mt-4 font-semibold">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 font-mono text-[12.5px]">
              <IconCode className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                pnpm action record-payout --circleId … --round 5{" "}
                <span className="text-clay">→ Round 5 is short ₦100,000.</span>
              </span>
            </div>
          </div>
        </Section>

        {/* CTA */}
        <Section className="pb-24">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] bg-primary p-8 text-primary-foreground sm:p-14 lg:flex-row lg:items-end">
            <div>
              <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl">Start your circle in two minutes.</h2>
              <p className="mt-3 max-w-xl text-lg opacity-80">
                Fill in the form, or paste your group&apos;s rules from WhatsApp and Kolo will set it up for you to review.
              </p>
            </div>
            <Link
              to="/circles/new"
              className="group inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-gold px-6 text-[15px] font-semibold text-gold-foreground transition hover:brightness-105"
            >
              Start a circle
              <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Section>
      </main>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <KoloWordmark className="text-foreground" />
          <p>Built on Agent-Native for the Builder.io Agent-Native Hackathon, 2026.</p>
          <p>Kolo keeps records. It never holds or moves money.</p>
        </div>
      </footer>
    </div>
  );
}

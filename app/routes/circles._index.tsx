import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconInbox,
  IconPlus,
  IconSparkles,
  IconTestPipe,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { CADENCE_LABEL, KoloMark, Money, Seal, shortDate } from "@/components/kolo/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Circles · Kolo" }];
}

function useSeedSample() {
  const navigate = useNavigate();
  return useActionMutation("seed-demo-circle", {
    onSuccess: (result) => {
      toast.success("Sample circle ready");
      navigate(`/circles/${result.id}`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Couldn't create the sample circle."),
  });
}

function EmptyState() {
  const seed = useSeedSample();
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <KoloMark className="size-12" />
      <h1 className="mt-8 font-display text-[2.8rem] font-semibold leading-none tracking-[-0.035em]">Start your first circle</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Set up the members and the payout order once. After that, Kolo keeps the books and the group checks them from WhatsApp.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <Link to="/circles/new" className="kolo-surface kolo-lift group rounded-[24px] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <IconPlus className="size-5" />
          </span>
          <p className="mt-8 font-semibold">Set it up yourself</p>
          <p className="mt-1 text-sm text-muted-foreground">Name, amount, schedule, and members.</p>
        </Link>
        <button
          type="button"
          onClick={() =>
            sendToAgentChat({
              message:
                "Help me set up my savings circle. I'll paste our group's rules and member list from WhatsApp; create the circle as a draft and show me the payout order.",
              submit: false,
              openSidebar: true,
            })
          }
          className="kolo-surface kolo-lift rounded-[24px] p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-10 place-items-center rounded-full bg-gold text-gold-foreground">
            <IconSparkles className="size-5" />
          </span>
          <p className="mt-8 font-semibold">Paste your group&apos;s rules</p>
          <p className="mt-1 text-sm text-muted-foreground">Kolo reads the WhatsApp message and drafts the circle.</p>
        </button>
        <button
          type="button"
          disabled={seed.isPending}
          onClick={() => seed.mutate({})}
          className="rounded-[24px] border border-dashed border-border p-6 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span className="grid size-10 place-items-center rounded-full bg-muted">
            <IconTestPipe className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-8 font-semibold">{seed.isPending ? "Creating…" : "Explore a sample"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Four weeks of history, two late payers, alerts waiting.</p>
        </button>
      </div>
    </div>
  );
}

type CircleSummary = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  contributionMinor: number;
  currency: string;
  cadence: string;
  seal: string;
  currentRound: number | null;
  currentRecipient: string | null;
  currentDueDate: string | null;
  potMinor: number;
  currentCollectedMinor: number;
  roundsPaid: number;
  latePayers: number;
  pendingSignals: number;
};

function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          className="stroke-gold transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-sm font-semibold tabular">{label}</span>
    </div>
  );
}

function CircleCard({ c }: { c: CircleSummary }) {
  const progress = c.potMinor ? c.currentCollectedMinor / c.potMinor : 0;
  const isActive = c.status === "active" && !!c.currentRound;
  return (
    <Link
      to={`/circles/${c.id}`}
      data-testid="circle-card"
      className="kolo-surface kolo-lift group flex flex-col rounded-[24px] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
    >
      <div className="flex items-start gap-4">
        {isActive ? (
          <ProgressRing value={progress} label={`R${c.currentRound}`} />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-muted">
            <KoloMark className="size-8" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="truncate font-display text-xl font-semibold tracking-tight">{c.name}</h2>
            {c.status === "draft" ? (
              <span className="shrink-0 rounded-full bg-gold/25 px-2.5 py-1 text-xs font-semibold text-gold-foreground">Draft</span>
            ) : c.status === "closed" ? (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">Closed</span>
            ) : (
              <Seal seal={c.seal} className="shrink-0" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {c.memberCount} members · <Money minor={c.contributionMinor} currency={c.currency} />{" "}
            {(CADENCE_LABEL[c.cadence] ?? c.cadence).toLowerCase()}
          </p>
          {isActive ? (
            <p className="mt-3 text-sm">
              <span className="font-semibold">{c.currentRecipient}</span> collects
              {c.currentDueDate ? <span className="text-muted-foreground"> · due {shortDate(c.currentDueDate)}</span> : null}
            </p>
          ) : c.status === "draft" ? (
            <p className="mt-3 text-sm text-muted-foreground">Confirm the payout order, then start the circle.</p>
          ) : null}
        </div>
      </div>

      {isActive ? (
        <div className="mt-5">
          <div className="flex gap-1" role="img" aria-label={`${c.roundsPaid} of ${c.memberCount} rounds paid out`}>
            {Array.from({ length: c.memberCount }, (_, i) => (
              <span
                key={i}
                className={cn("h-1.5 flex-1 rounded-full", i < c.roundsPaid ? "bg-primary" : i === c.roundsPaid ? "bg-gold" : "bg-muted")}
              />
            ))}
          </div>
          <p className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>
              <Money minor={c.currentCollectedMinor} currency={c.currency} className="font-medium text-foreground" /> of{" "}
              <Money minor={c.potMinor} currency={c.currency} /> in the pot
            </span>
            <span className="tabular">
              {c.roundsPaid}/{c.memberCount} paid out
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-xs">
        {c.latePayers ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-clay/10 px-2.5 py-1 font-medium text-clay">
            <IconAlertTriangle className="size-3.5" /> {c.latePayers} late
          </span>
        ) : isActive ? (
          <span className="rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">All on time</span>
        ) : null}
        {c.pendingSignals ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
            <IconInbox className="size-3.5" /> {c.pendingSignals} to match
          </span>
        ) : null}
        <span className="ml-auto grid size-8 place-items-center rounded-full bg-muted transition group-hover:bg-foreground group-hover:text-background">
          <IconArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export default function CirclesRoute() {
  const { data, isPending } = useActionQuery("list-circles", {});
  const [params, setParams] = useSearchParams();
  const seed = useSeedSample();
  const seeded = useRef(false);

  // Landing page's "Explore a sample circle" lands here with ?sample=1.
  useEffect(() => {
    if (params.get("sample") === "1" && !seeded.current) {
      seeded.current = true;
      setParams({}, { replace: true });
      seed.mutate({});
    }
  }, [params, seed, setParams]);

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-10 sm:px-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-28 rounded-[24px]" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-[24px]" />
          ))}
        </div>
      </div>
    );
  }
  const circles = (data?.circles ?? []) as CircleSummary[];
  if (!circles.length) return <EmptyState />;

  const active = circles.filter((c) => c.status === "active");
  const totals = [
    { label: "Active circles", value: active.length, tone: "" },
    { label: "Members", value: circles.reduce((n, c) => n + c.memberCount, 0), tone: "" },
    { label: "Late payments", value: circles.reduce((n, c) => n + (c.latePayers ?? 0), 0), tone: "text-clay" },
    { label: "Alerts to match", value: circles.reduce((n, c) => n + (c.pendingSignals ?? 0), 0), tone: "text-primary" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kolo-eyebrow text-primary">Treasury</p>
          <h1 className="mt-2 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.035em]">Your circles</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" disabled={seed.isPending} onClick={() => seed.mutate({})}>
            {seed.isPending ? "Creating…" : "Add sample"}
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/circles/new">
              <IconPlus className="size-4" /> New circle
            </Link>
          </Button>
        </div>
      </div>

      <dl className="kolo-surface mt-8 grid grid-cols-2 overflow-hidden rounded-[24px] md:grid-cols-4 md:divide-x md:divide-border">
        {totals.map((t) => (
          <div key={t.label} className="p-5 sm:p-6">
            <dt className="text-sm text-muted-foreground">{t.label}</dt>
            <dd className={cn("kolo-kpi mt-3 text-[2.2rem]", t.value ? t.tone : "")}>{t.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {circles.map((c) => (
          <CircleCard key={c.id} c={c} />
        ))}
        <Link
          to="/circles/new"
          className="group grid min-h-[220px] place-items-center rounded-[24px] border border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex flex-col items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-muted transition group-hover:bg-primary group-hover:text-primary-foreground">
              <IconPlus className="size-5" />
            </span>
            <span className="text-sm font-medium">Start another circle</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

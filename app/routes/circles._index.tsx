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
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <KoloMark className="size-12" />
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Start your first circle</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">
        Set up the members and the payout order once. After that, Kolo keeps the books and the group checks them from WhatsApp.
      </p>
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <Link
          to="/circles/new"
          className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
        >
          <IconPlus className="size-5 text-primary" />
          <p className="mt-4 font-semibold">Set it up yourself</p>
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
          className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/40"
        >
          <IconSparkles className="size-5 text-primary" />
          <p className="mt-4 font-semibold">Paste your group&apos;s rules</p>
          <p className="mt-1 text-sm text-muted-foreground">Kolo reads the WhatsApp message and drafts the circle.</p>
        </button>
        <button
          type="button"
          disabled={seed.isPending}
          onClick={() => seed.mutate({})}
          className="rounded-2xl border border-dashed border-border p-5 text-left transition hover:border-primary/40 disabled:opacity-60"
        >
          <IconTestPipe className="size-5 text-muted-foreground" />
          <p className="mt-4 font-semibold">{seed.isPending ? "Creating…" : "Explore a sample"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Four weeks of history, two late payers, alerts waiting.</p>
        </button>
      </div>
    </div>
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
      <div className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    );
  }
  const circles = data?.circles ?? [];
  if (!circles.length) return <EmptyState />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Your circles</h1>
        <div className="flex gap-2">
          <Button variant="outline" disabled={seed.isPending} onClick={() => seed.mutate({})}>
            {seed.isPending ? "Creating…" : "Add sample"}
          </Button>
          <Button asChild>
            <Link to="/circles/new">
              <IconPlus className="size-4" /> New circle
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {circles.map((c) => {
          const progress = c.potMinor ? c.currentCollectedMinor / c.potMinor : 0;
          return (
            <Link
              key={c.id}
              to={`/circles/${c.id}`}
              className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-[0_12px_32px_-20px_hsl(var(--foreground)/0.4)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-semibold">{c.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.memberCount} members · <Money minor={c.contributionMinor} currency={c.currency} />{" "}
                    {(CADENCE_LABEL[c.cadence] ?? c.cadence).toLowerCase()}
                  </p>
                </div>
                {c.status === "draft" ? (
                  <span className="rounded-full bg-gold/25 px-2.5 py-1 text-xs font-semibold text-gold-foreground">Draft</span>
                ) : c.status === "closed" ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">Closed</span>
                ) : (
                  <Seal seal={c.seal} />
                )}
              </div>

              {c.status === "active" && c.currentRound ? (
                <div className="mt-5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>
                      Round {c.currentRound} for <span className="font-semibold">{c.currentRecipient}</span>
                    </span>
                    <span className="text-muted-foreground">{c.currentDueDate ? shortDate(c.currentDueDate) : ""}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <Money minor={c.currentCollectedMinor} currency={c.currency} /> of{" "}
                    <Money minor={c.potMinor} currency={c.currency} /> collected
                  </p>
                </div>
              ) : c.status === "draft" ? (
                <p className="mt-5 text-sm text-muted-foreground">Confirm the payout order, then start the circle.</p>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-xs">
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {c.roundsPaid}/{c.memberCount} paid out
                </span>
                {c.latePayers ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-clay/10 px-2.5 py-1 font-medium text-clay">
                    <IconAlertTriangle className="size-3.5" /> {c.latePayers} late
                  </span>
                ) : null}
                {c.pendingSignals ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
                    <IconInbox className="size-3.5" /> {c.pendingSignals} to match
                  </span>
                ) : null}
                <IconArrowRight className="ml-auto size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { IconCircleCheckFilled, IconLoader2, IconLock, IconShieldCheck, IconShieldX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { describeEntry } from "@/components/circle/LedgerTab";
import { firstName, KoloMark, KoloWordmark, Money, relativeDays, shortDate } from "@/components/kolo/brand";
import { RotationRing, type RingRound } from "@/components/kolo/RotationRing";
import { cn } from "@/lib/utils";

import { foldLedger, latePayments, type CircleState } from "../../../shared/circle-state";
import { sealOf, verifyChain, type AnyEntry, type VerifyResult } from "../../../shared/ledger";
import { todayIn } from "../../../shared/schedule";

interface Bundle {
  circle: {
    name: string;
    currency: string;
    contributionMinor: number;
    cadence: string;
    graceDays: number;
    timezone: string;
    status: string;
    headSeq: number;
    headHash: string;
  };
  members: { id: string; name: string }[];
  entries: AnyEntry[];
  you?: { memberId: string; name: string };
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "verifying"; bundle: Bundle; checked: number }
  | { kind: "done"; bundle: Bundle; result: VerifyResult; state: CircleState | null };

export function PublicCircle({ endpoint }: { endpoint: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(endpoint, { headers: { accept: "application/json" } }).catch(() => null);
      if (!res || !res.ok) {
        if (!cancelled)
          setPhase({
            kind: "error",
            message:
              res?.status === 404
                ? "This link isn't valid, or the circle hasn't started yet."
                : "Couldn't reach Kolo. Check your connection and try again.",
          });
        return;
      }
      const bundle = (await res.json()) as Bundle;
      // Re-verify in small visible steps so the member can watch their phone do it.
      const n = bundle.entries.length;
      for (let i = 1; i <= n; i += Math.max(1, Math.ceil(n / 24))) {
        if (cancelled) return;
        setPhase({ kind: "verifying", bundle, checked: i });
        await new Promise((r) => setTimeout(r, 30));
      }
      const result = await verifyChain(bundle.entries);
      const headOk = result.ok && result.headHash === bundle.circle.headHash;
      const finalResult: VerifyResult =
        result.ok && !headOk
          ? { ok: false, count: result.count, brokenAt: result.count, reason: "prev_hash_mismatch", expected: bundle.circle.headHash, found: result.headHash }
          : result;
      const state = finalResult.ok && n ? foldLedger(bundle.entries) : null;
      if (!cancelled) setPhase({ kind: "done", bundle, result: finalResult, state });
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <KoloWordmark />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <IconLock className="size-3.5" /> Read-only
        </span>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16">
        {phase.kind === "loading" ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading the ledger">
            <div className="kolo-ink h-[260px] animate-pulse rounded-[28px]" />
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : phase.kind === "error" ? (
          <div className="kolo-surface rounded-[28px] p-10 text-center">
            <KoloMark className="mx-auto size-10" />
            <p className="mt-5 font-display text-2xl font-semibold tracking-tight">Can&apos;t open this circle</p>
            <p className="mt-2 text-muted-foreground">{phase.message}</p>
          </div>
        ) : (
          <Body phase={phase} />
        )}
      </main>
    </div>
  );
}

function VerifyBar({ phase, total }: { phase: Extract<Phase, { kind: "verifying" | "done" }>; total: number }) {
  const done = phase.kind === "done";
  const ok = done && phase.result.ok;
  const pct = done ? 100 : Math.round((phase.checked / Math.max(total, 1)) * 100);
  return (
    <div
      aria-live="polite"
      data-testid="verify-status"
      data-state={!done ? "checking" : ok ? "ok" : "broken"}
      className={cn(
        "relative mt-6 overflow-hidden rounded-2xl px-4 py-3.5",
        !done ? "bg-white/10" : ok ? "bg-white/10" : "bg-clay",
      )}
    >
      {!done ? <div className="absolute inset-y-0 left-0 bg-white/10 transition-[width] duration-150" style={{ width: `${pct}%` }} /> : null}
      <div className="relative flex items-center gap-3">
        {!done ? (
          <IconLoader2 className="size-6 shrink-0 animate-spin text-gold" />
        ) : ok ? (
          <IconShieldCheck className="size-6 shrink-0 text-gold" />
        ) : (
          <IconShieldX className="size-6 shrink-0 text-white" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {!done
              ? `Checking entry ${phase.checked} of ${total} on this phone…`
              : ok
                ? `Verified on this phone · all ${total} entries`
                : "Warning: the books don't check out"}
          </p>
          <p className="text-xs text-white/65">
            {!done
              ? "Recomputing every seal from the first entry."
              : ok
                ? "Every number below was calculated here, not by Kolo's servers."
                : `Entry #${(phase.result as Extract<VerifyResult, { ok: false }>).brokenAt} was changed after it was recorded. Tell your group and the organizer.`}
          </p>
        </div>
        {done ? (
          <span className="hidden shrink-0 rounded-full bg-black/20 px-2.5 py-1 font-mono text-[11px] text-white sm:inline">
            {sealOf(phase.bundle.circle.headHash)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Body({ phase }: { phase: Extract<Phase, { kind: "verifying" | "done" }> }) {
  const { bundle } = phase;
  const names = useMemo(() => new Map(bundle.members.map((m) => [m.id, m.name])), [bundle.members]);
  const nameOf = (id: string) => names.get(id) ?? "Member";
  const total = bundle.entries.length;
  const done = phase.kind === "done";
  const state = done ? phase.state : null;
  const today = todayIn(bundle.circle.timezone);
  const you = bundle.you;
  const mine = you && state ? state.members[you.memberId] : undefined;
  const currency = bundle.circle.currency;

  const rounds: RingRound[] =
    state?.rounds.map((r) => ({
      round: r.round,
      recipientId: r.recipientId,
      status: r.payout ? "paid" : r.collectedMinor >= r.potMinor ? "ready" : r.round === state.nextPayoutRound ? "collecting" : "upcoming",
      collectedMinor: r.collectedMinor,
      potMinor: r.potMinor,
      dueDate: r.dueDate,
    })) ?? [];

  const myNextDue = you && state ? state.rounds.find((r) => !r.payout && (r.paidBy[you.memberId] ?? 0) < state.terms.contributionMinor) : undefined;
  const myLate = you && state ? latePayments(state, today).filter((l) => l.memberId === you.memberId) : [];
  const myRound = mine ? state?.rounds[mine.payoutRound - 1] : undefined;
  const totalDue = state ? state.terms.contributionMinor * state.size : 0;

  return (
    <div className="space-y-3">
      <section className="kolo-ink kolo-grain relative overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div className="kolo-glow absolute inset-0 -z-10" aria-hidden="true" />
        <p className="flex items-center gap-2 text-xs font-medium text-white/70">
          <KoloMark className="size-5" /> {bundle.circle.name}
        </p>
        {you ? (
          <>
            <h1 className="mt-6 text-sm text-white/65">Hi {firstName(you.name)}, your turn</h1>
            {myRound ? (
              <>
                <p className="kolo-kpi mt-2 text-[3rem] text-gold">{myRound.payout ? "Collected" : `Round ${mine!.payoutRound}`}</p>
                <p className="mt-2 text-sm text-white/70">
                  {myRound.payout ? (
                    <>
                      <Money minor={myRound.payout.amountMinor} currency={currency} /> paid to you
                    </>
                  ) : (
                    <>
                      {shortDate(myRound.dueDate, { weekday: true })} · {relativeDays(today, myRound.dueDate)} ·{" "}
                      <Money minor={myRound.potMinor} currency={currency} /> pot
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="kolo-kpi mt-2 text-[3rem] text-white/30">…</p>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-[2.2rem] font-semibold leading-none tracking-[-0.035em]">{bundle.circle.name}</h1>
            <p className="mt-2 text-sm text-white/70">
              {bundle.members.length} members · <Money minor={bundle.circle.contributionMinor} currency={currency} /> {bundle.circle.cadence}
            </p>
          </>
        )}
        <VerifyBar phase={phase} total={total} />
      </section>

      {state && mine ? (
        <section className="grid grid-cols-2 gap-3">
          <div className="kolo-surface rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Paid in</p>
            <p className="kolo-kpi mt-2 text-[1.6rem]">
              <Money minor={mine.paidMinor} currency={currency} />
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (mine.paidMinor / Math.max(totalDue, 1)) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              of <Money minor={totalDue} currency={currency} />
            </p>
          </div>
          <div className={cn("kolo-surface rounded-2xl p-4", myLate.length && "border-clay/40 bg-clay/5")}>
            <p className="text-xs text-muted-foreground">Next payment</p>
            {myNextDue ? (
              <>
                <p className={cn("kolo-kpi mt-2 text-[1.6rem]", myLate.length && "text-clay")}>
                  <Money minor={state.terms.contributionMinor - (myNextDue.paidBy[you!.memberId] ?? 0)} currency={currency} />
                </p>
                <p className={cn("mt-3 text-xs", myLate.length ? "font-medium text-clay" : "text-muted-foreground")}>
                  Round {myNextDue.round} · {myLate.length ? `${myLate[0]!.daysLate} days late` : `due ${shortDate(myNextDue.dueDate)}`}
                </p>
              </>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 font-display text-xl font-semibold text-primary">
                <IconCircleCheckFilled className="size-5" /> All paid
              </p>
            )}
          </div>
        </section>
      ) : null}

      {state ? (
        <section className="kolo-surface rounded-[24px] p-4 sm:p-6">
          <RotationRing
            members={bundle.members}
            rounds={rounds}
            currentRound={state.nextPayoutRound}
            currency={currency}
            highlightId={you?.memberId}
            className="mx-auto max-w-[420px]"
          />
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Organizer holds</dt>
              <dd className="mt-1 font-semibold tabular">
                <Money minor={state.heldMinor} currency={currency} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Paid out</dt>
              <dd className="mt-1 font-semibold tabular">
                {state.rounds.filter((r) => r.payout).length} of {state.size}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pot</dt>
              <dd className="mt-1 font-semibold tabular">
                <Money minor={state.potMinor} currency={currency} />
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {done && total ? (
        <section className="kolo-surface overflow-hidden rounded-[24px]">
          <h2 className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <span className="font-display text-lg font-semibold tracking-tight">Ledger</span>
            <span className="text-xs text-muted-foreground">{total} sealed entries</span>
          </h2>
          <ol className="divide-y divide-border">
            {[...bundle.entries].reverse().map((e) => {
              const d = describeEntry(e, nameOf, currency);
              const mineRow = you && "memberId" in e.payload && (e.payload as { memberId?: string }).memberId === you.memberId;
              return (
                <li key={e.seq} className={cn("flex items-center gap-3 px-5 py-3 text-sm", mineRow && "bg-gold/10")}>
                  <span className="w-8 shrink-0 font-mono text-[11px] text-muted-foreground">#{e.seq}</span>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted">
                    <d.icon className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{d.text}</span>
                  {d.amount ? <span className="shrink-0 font-medium tabular">{d.amount}</span> : null}
                  <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">{sealOf(e.hash)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <p className="px-4 pt-3 text-center text-xs leading-relaxed text-muted-foreground">
        Kolo keeps records; it never holds money. The ledger is append-only and hash-chained, and this page checked it without trusting Kolo&apos;s
        servers.
      </p>
    </div>
  );
}

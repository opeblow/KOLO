import { IconCircleCheckFilled, IconLoader2, IconShieldCheck, IconShieldX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { describeEntry } from "@/components/circle/LedgerTab";
import { firstName, KoloWordmark, Money, relativeDays, Seal, shortDate } from "@/components/kolo/brand";
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
          setPhase({ kind: "error", message: res?.status === 404 ? "This link isn't valid, or the circle hasn't started yet." : "Couldn't reach Kolo. Check your connection and try again." });
        return;
      }
      const bundle = (await res.json()) as Bundle;
      // Re-verify in small steps so the member can watch their phone do it.
      const n = bundle.entries.length;
      for (let i = 1; i <= n; i += Math.max(1, Math.ceil(n / 24))) {
        if (cancelled) return;
        setPhase({ kind: "verifying", bundle, checked: i });
        await new Promise((r) => setTimeout(r, 35));
      }
      const result = await verifyChain(bundle.entries);
      const headOk = result.ok && result.headHash === bundle.circle.headHash;
      const finalResult: VerifyResult = result.ok && !headOk
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
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <KoloWordmark />
        <span className="text-xs text-muted-foreground">Read-only member view</span>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {phase.kind === "loading" ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <IconLoader2 className="size-6 animate-spin" />
          </div>
        ) : phase.kind === "error" ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center">
            <p className="font-display text-2xl font-semibold">Can&apos;t open this circle</p>
            <p className="mt-2 text-muted-foreground">{phase.message}</p>
          </div>
        ) : (
          <Body phase={phase} />
        )}
      </main>
    </div>
  );
}

function Body({ phase }: { phase: Extract<Phase, { kind: "verifying" | "done" }> }) {
  const { bundle } = phase;
  const names = useMemo(() => new Map(bundle.members.map((m) => [m.id, m.name])), [bundle.members]);
  const nameOf = (id: string) => names.get(id) ?? "Member";
  const total = bundle.entries.length;
  const done = phase.kind === "done";
  const ok = done && phase.result.ok;
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {you ? `Hi ${firstName(you.name)},` : bundle.circle.name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {you ? `here's where you stand in ${bundle.circle.name}.` : `${bundle.members.length} members · `}
          {!you ? <Money minor={bundle.circle.contributionMinor} currency={currency} /> : null}
          {!you ? ` ${bundle.circle.cadence}` : null}
        </p>
      </div>

      <section
        aria-live="polite"
        className={cn(
          "flex items-center gap-4 rounded-3xl border p-5",
          !done ? "border-border bg-card" : ok ? "border-primary/30 bg-accent" : "border-clay/40 bg-clay/10",
        )}
      >
        {!done ? (
          <IconLoader2 className="size-8 shrink-0 animate-spin text-primary" />
        ) : ok ? (
          <IconShieldCheck className="size-9 shrink-0 text-primary" />
        ) : (
          <IconShieldX className="size-9 shrink-0 text-clay" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {!done
              ? `Checking entry ${phase.checked} of ${total} on this phone…`
              : ok
                ? `Verified on this phone: all ${total} entries`
                : `Warning: the books don't check out`}
          </p>
          <p className="text-sm text-muted-foreground">
            {!done
              ? "Recomputing every seal from the first entry."
              : ok
                ? "Every balance below was calculated here, from the verified ledger."
                : `Entry #${(phase.result as Extract<VerifyResult, { ok: false }>).brokenAt} was changed after it was recorded. Tell your group and the organizer.`}
          </p>
        </div>
        {done ? <Seal seal={sealOf(bundle.circle.headHash)} ok={ok} size="md" className="hidden sm:inline-flex" /> : null}
      </section>

      {state && mine && myRound ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Paid in</p>
            <p className="mt-1 font-display text-2xl font-semibold"><Money minor={mine.paidMinor} currency={currency} /></p>
            <p className="text-xs text-muted-foreground">
              of <Money minor={state.terms.contributionMinor * state.size} currency={currency} />
            </p>
          </div>
          <div className="rounded-2xl bg-gold/20 p-4">
            <p className="text-xs uppercase tracking-wider text-gold-foreground/80">Your turn</p>
            <p className="mt-1 font-display text-2xl font-semibold text-gold-foreground">
              {myRound.payout ? "Paid to you" : `Round ${mine.payoutRound}`}
            </p>
            <p className="text-xs text-gold-foreground/80">
              {myRound.payout ? <Money minor={myRound.payout.amountMinor} currency={currency} /> : `${shortDate(myRound.dueDate)} · ${relativeDays(today, myRound.dueDate)}`}
            </p>
          </div>
          <div className={cn("rounded-2xl border p-4", myLate.length ? "border-clay/40 bg-clay/5" : "border-border bg-card")}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Next payment</p>
            {myNextDue ? (
              <>
                <p className={cn("mt-1 font-display text-2xl font-semibold", myLate.length && "text-clay")}>
                  <Money minor={state.terms.contributionMinor - (myNextDue.paidBy[you!.memberId] ?? 0)} currency={currency} />
                </p>
                <p className="text-xs text-muted-foreground">
                  Round {myNextDue.round} · {myLate.length ? `${myLate[0]!.daysLate} days late` : `due ${shortDate(myNextDue.dueDate)}`}
                </p>
              </>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-semibold text-primary">
                <IconCircleCheckFilled className="size-5" /> All paid
              </p>
            )}
          </div>
        </section>
      ) : null}

      {state ? (
        <section className="rounded-3xl border border-border bg-card p-4 sm:p-6">
          <RotationRing
            members={bundle.members}
            rounds={rounds}
            currentRound={state.nextPayoutRound}
            currency={currency}
            highlightId={you?.memberId}
            className="mx-auto max-w-[460px]"
          />
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Organizer should hold</dt>
              <dd className="font-semibold"><Money minor={state.heldMinor} currency={currency} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rounds paid out</dt>
              <dd className="font-semibold">{state.rounds.filter((r) => r.payout).length} of {state.size}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pot</dt>
              <dd className="font-semibold"><Money minor={state.potMinor} currency={currency} /></dd>
            </div>
          </dl>
        </section>
      ) : null}

      {done && total ? (
        <section className="rounded-3xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-3 font-semibold">Ledger</h2>
          <ol className="divide-y divide-border">
            {[...bundle.entries].reverse().map((e) => {
              const d = describeEntry(e, nameOf, currency);
              const mineRow = you && "memberId" in e.payload && (e.payload as { memberId?: string }).memberId === you.memberId;
              return (
                <li key={e.seq} className={cn("flex items-center gap-3 px-5 py-3 text-sm", mineRow && "bg-gold/10")}>
                  <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">#{e.seq}</span>
                  <d.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{d.text}</span>
                  {d.amount ? <span className="shrink-0 font-medium">{d.amount}</span> : null}
                  <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">{sealOf(e.hash)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <p className="px-2 text-center text-xs text-muted-foreground">
        Kolo keeps records; it never holds money. The ledger is append-only and hash-chained, and this page checked it without trusting Kolo&apos;s servers.
      </p>
    </div>
  );
}

/**
 * Live demos for the landing page. Both run Kolo's real shared code in the
 * visitor's browser: the alert parser and name matcher, and the SHA-256
 * hash chain. Nothing here calls the server.
 */
import {
  IconAlertTriangleFilled,
  IconArrowBackUp,
  IconCircleCheckFilled,
  IconCut,
  IconRefresh,
  IconShieldCheck,
  IconShieldX,
  IconWand,
} from "@tabler/icons-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { normalizeForFingerprint, parseAlert, splitAlerts } from "../../../shared/alerts";
import {
  sealEntry,
  sealOf,
  verifyChain,
  GENESIS_PREV_HASH,
  type AnyEntry,
  type LedgerEntry,
  type UnsealedEntry,
} from "../../../shared/ledger";
import { nameSimilarity } from "../../../shared/matcher";
import { formatMoney } from "../../../shared/money";
import { initials } from "../kolo/brand";

export const DEMO_MEMBERS = [
  "Ngozi Okafor",
  "Tunde Adebayo",
  "Aisha Mohammed",
  "Chidi Eze",
  "Emeka Okonkwo",
  "Temitope Bello",
  "Bisi Olatunji",
  "Musa Ibrahim",
];

const CONTRIBUTION = 5_000_000; // ₦50,000 in kobo

const PRESET_ALERTS = `Acct: 0123***789
Amt: NGN50,000.00 CR
Desc: TRANSFER FROM OKONKWO EMEKA J
Avail Bal: NGN350,000.00
Date: 2026-10-29 08:14

You have received ₦100,000.00 from BISI OLATUNJI. Ref: 261029223344 on 29 Oct 2026

Credit
Amt:NGN50,000.00
Acc:123**789
Desc:NIP/MOHAMMED A/Ajo Oct
DT:29/10/2026 21:40

Acct: 0123***789
Amt: NGN12,500.00 DR
Desc: POS PURCHASE SHOPRITE LEKKI
Date: 2026-10-29 19:02`;

const EXTRA_ALERTS: { label: string; text: string }[] = [
  {
    label: "Paste a duplicate",
    text: "You have received ₦100,000.00 from BISI OLATUNJI. Ref: 261029223344 on 29 Oct 2026",
  },
  {
    label: "Bank truncated name",
    text: "Acct: 0123***789\nAmt: NGN50,000.00 CR\nDesc: TRANSFER FROM ADEBAYO T O\nDate: 2026-10-30 07:51",
  },
  {
    label: "Stranger",
    text: "You have received ₦50,000.00 from KUNLE ADEYEMI. Ref: 261030118870 on 30 Oct 2026",
  },
];

type Row =
  | { kind: "skip"; raw: string; why: string }
  | {
      kind: "match";
      raw: string;
      sender: string;
      amountMinor: number;
      member: string | null;
      confidence: number;
      reasons: string[];
    };

function analyse(text: string): Row[] {
  const seen = new Set<string>();
  return splitAlerts(text).map((raw): Row => {
    const fp = normalizeForFingerprint(raw);
    if (seen.has(fp)) return { kind: "skip", raw, why: "Same alert pasted twice. Refused, so nobody is counted double." };
    seen.add(fp);
    const a = parseAlert(raw);
    if (a.direction === "debit") return { kind: "skip", raw, why: "Money going out. Never counted as a contribution." };
    if (a.amountMinor == null || !a.senderName)
      return { kind: "skip", raw, why: `Couldn't read the ${a.missing.join(" and ")}. The agent reads these for you.` };

    const scored = DEMO_MEMBERS.map((m) => ({ m, s: nameSimilarity(a.senderName!, m) })).sort((x, y) => y.s - x.s);
    const best = scored[0]!;
    const second = scored[1]!;
    const reasons: string[] = [];
    if (best.s < 0.4) {
      reasons.push(`No member resembles “${a.senderName}”. Left for a person to decide.`);
      return { kind: "match", raw, sender: a.senderName, amountMinor: a.amountMinor, member: null, confidence: 0, reasons };
    }
    let conf = best.s;
    reasons.push(`“${a.senderName}” matches ${best.m} (${Math.round(best.s * 100)}% name match)`);
    if (best.s - second.s < 0.15) {
      conf -= 0.3;
      reasons.push(`Also resembles ${second.m}. Check before confirming.`);
    }
    const rounds = a.amountMinor / CONTRIBUTION;
    if (Number.isInteger(rounds) && rounds >= 1) {
      reasons.push(rounds === 1 ? "Exactly one contribution" : `Covers ${rounds} rounds, split in order`);
    } else {
      conf -= 0.1;
      reasons.push("Not a whole contribution. Recorded as part-payment");
    }
    return {
      kind: "match",
      raw,
      sender: a.senderName,
      amountMinor: a.amountMinor,
      member: best.m,
      confidence: Math.max(0, Math.min(100, Math.round(conf * 100))),
      reasons,
    };
  });
}

export function AlertPlayground() {
  const [text, setText] = useState(PRESET_ALERTS);
  const deferred = useDeferredValue(text);
  const rows = useMemo(() => analyse(deferred), [deferred]);
  const matched = rows.filter((r) => r.kind === "match" && r.confidence >= 85).length;

  return (
    <div className="grid overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <label htmlFor="demo-alerts" className="text-sm font-medium text-white/80">
            Bank alerts, pasted as they arrived
          </label>
          <button
            type="button"
            onClick={() => setText(PRESET_ALERTS)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <IconRefresh className="size-3.5" /> Reset
          </button>
        </div>
        <textarea
          id="demo-alerts"
          data-testid="demo-alerts"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="ruled-dark min-h-[320px] flex-1 resize-none bg-transparent px-5 py-4 font-mono text-[12.5px] leading-7 text-white/85 placeholder:text-white/30 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-3">
          {EXTRA_ALERTS.map((x) => (
            <button
              key={x.label}
              type="button"
              onClick={() => setText((t) => `${t.trimEnd()}\n\n${x.text}`)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/75 transition hover:border-gold/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              + {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm">
          <span className="font-medium text-white/80">Kolo&apos;s proposals</span>
          <span className="tabular text-white/55" data-testid="demo-summary" aria-live="polite">
            {rows.length} read · {matched} ready to confirm
          </span>
        </div>
        <ol tabIndex={0} aria-label="Kolo's proposals" className="max-h-[460px] flex-1 space-y-2.5 overflow-y-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold sm:p-5">
          {rows.map((r, i) =>
            r.kind === "skip" ? (
              <li key={`${i}-${r.raw.slice(0, 24)}`} className="kolo-pop flex items-start gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-3" data-testid="demo-row-skip">
                <IconAlertTriangleFilled className="mt-0.5 size-4 shrink-0 text-gold/80" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11.5px] text-white/45">{r.raw.split("\n").find((l) => /amt|received|desc/i.test(l)) ?? r.raw}</p>
                  <p className="mt-0.5 text-[13px] text-white/75">{r.why}</p>
                </div>
              </li>
            ) : (
              <li key={`${i}-${r.raw.slice(0, 24)}`} className="kolo-pop rounded-2xl bg-white p-4 text-foreground shadow-[0_20px_40px_-24px_rgba(0,0,0,0.6)]" data-testid="demo-row-match">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      r.member ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.member ? initials(r.member) : "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.member ?? "No match"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatMoney(r.amountMinor, "NGN")} from “{r.sender}”
                    </p>
                  </div>
                  <span
                    className={cn(
                      "kolo-kpi text-xl",
                      r.confidence >= 85 ? "text-primary" : r.confidence >= 60 ? "text-gold-foreground" : "text-clay",
                    )}
                  >
                    {r.confidence}%
                  </span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      r.confidence >= 85 ? "bg-primary" : r.confidence >= 60 ? "bg-gold" : "bg-clay",
                    )}
                    style={{ width: `${r.confidence}%` }}
                  />
                </div>
                <ul className="mt-2.5 space-y-1 text-[12.5px] text-muted-foreground">
                  {r.reasons.map((why) => (
                    <li key={why} className="flex gap-1.5">
                      <span aria-hidden="true" className="text-primary">›</span>
                      {why}
                    </li>
                  ))}
                </ul>
              </li>
            ),
          )}
          {!rows.length ? <li className="py-16 text-center text-sm text-white/50">Paste a bank alert on the left.</li> : null}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tamper demo */

const RECORDED_AT = "2026-10-05T09:00:00.000Z";

function demoEntries(): UnsealedEntry[] {
  const at = (h: number) => RECORDED_AT.replace("09:00", `${String(9 + h).padStart(2, "0")}:00`);
  const members = DEMO_MEMBERS.slice(0, 4).map((name, i) => ({ id: `m${i}`, name }));
  return [
    {
      seq: 1,
      kind: "circle.opened",
      recordedAt: at(0),
      payload: {
        circleId: "demo",
        name: "Yaba Traders' Ajo",
        currency: "NGN",
        contributionMinor: CONTRIBUTION,
        cadence: "weekly",
        startDate: "2026-10-05",
        graceDays: 2,
        members,
      },
    },
    ...members.map((m, i) => ({
      seq: i + 2,
      kind: "contribution" as const,
      recordedAt: at(i + 1),
      payload: { memberId: m.id, round: 1, amountMinor: CONTRIBUTION, method: "transfer" as const },
    })),
    {
      seq: 6,
      kind: "payout",
      recordedAt: at(6),
      payload: { memberId: "m0", round: 1, amountMinor: CONTRIBUTION * 4 },
    },
  ];
}

async function sealAll(entries: UnsealedEntry[]): Promise<AnyEntry[]> {
  const out: AnyEntry[] = [];
  let prev = GENESIS_PREV_HASH;
  for (const e of entries) {
    const sealed = (await sealEntry(e, prev)) as AnyEntry;
    out.push(sealed);
    prev = sealed.hash;
  }
  return out;
}

function describe(e: AnyEntry) {
  const name = (id: string) => DEMO_MEMBERS[Number(id.slice(1))] ?? id;
  if (e.kind === "circle.opened") return { text: "Circle opened, 4 members", amount: null };
  if (e.kind === "contribution") return { text: `${name(e.payload.memberId)} paid in`, amount: e.payload.amountMinor };
  if (e.kind === "payout") return { text: `Pot paid to ${name(e.payload.memberId)}`, amount: e.payload.amountMinor };
  return { text: e.kind, amount: null };
}

type Mode = "honest" | "edited" | "rewritten";

export function TamperDemo() {
  const [original, setOriginal] = useState<AnyEntry[] | null>(null);
  const [ledger, setLedger] = useState<AnyEntry[] | null>(null);
  const [mode, setMode] = useState<Mode>("honest");
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyChain>> | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    let live = true;
    void sealAll(demoEntries()).then((sealed) => {
      if (!live) return;
      setOriginal(sealed);
      setLedger(sealed);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!ledger) return;
    let live = true;
    void verifyChain(ledger as LedgerEntry[]).then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, [ledger]);

  const memberSeal = original ? sealOf(original[original.length - 1]!.hash) : "····";

  function cut(seq: number) {
    if (!ledger) return;
    setLedger(
      ledger.map((e) =>
        e.seq === seq && e.kind === "contribution" ? { ...e, payload: { ...e.payload, amountMinor: 500_000 } } : e,
      ) as AnyEntry[],
    );
    setMode("edited");
    setShakeKey((k) => k + 1);
  }

  async function rewrite() {
    if (!ledger) return;
    const resealed = await sealAll(ledger.map(({ seq, kind, payload, recordedAt }) => ({ seq, kind, payload, recordedAt }) as UnsealedEntry));
    setLedger(resealed);
    setMode("rewritten");
    setShakeKey((k) => k + 1);
  }

  function restore() {
    setLedger(original);
    setMode("honest");
  }

  const brokenAt = result && !result.ok ? result.brokenAt : null;
  const head = ledger ? sealOf(ledger[ledger.length - 1]!.hash) : "····";
  const sealMismatch = mode === "rewritten" && head !== memberSeal;
  const ok = !!result?.ok && !sealMismatch;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <ol className="space-y-2" aria-label="Sample ledger" data-testid="tamper-ledger">
        {(ledger ?? []).map((e) => {
          const d = describe(e);
          const state =
            brokenAt == null ? "ok" : e.seq < brokenAt ? "ok" : e.seq === brokenAt ? "broken" : "unverified";
          const edited = original && JSON.stringify(original[e.seq - 1]!.payload) !== JSON.stringify(e.payload);
          return (
            <li
              key={e.seq}
              data-state={state}
              className={cn(
                "kolo-surface flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
                state === "broken" && "border-clay/60 bg-clay/[0.06]",
                state === "unverified" && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold",
                  state === "broken" ? "bg-clay text-white" : state === "unverified" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                #{e.seq}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.text}
                  {edited ? <span className="ml-2 rounded bg-clay/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-clay">edited</span> : null}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {sealOf(e.prevHash)} → <span className={state === "broken" ? "text-clay" : "text-foreground"}>{sealOf(e.hash)}</span>
                </p>
              </div>
              {d.amount != null ? (
                <span className={cn("tabular shrink-0 text-sm font-semibold", edited && "text-clay")}>{formatMoney(d.amount, "NGN")}</span>
              ) : null}
              {e.kind === "contribution" && mode === "honest" ? (
                <button
                  type="button"
                  onClick={() => cut(e.seq)}
                  aria-label={`Secretly change entry ${e.seq} to ₦5,000`}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-clay/10 hover:text-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <IconCut className="size-4" />
                </button>
              ) : null}
            </li>
          );
        })}
        {!ledger ? <li className="h-[340px] animate-pulse rounded-2xl bg-muted" /> : null}
      </ol>

      <div className="flex flex-col gap-4">
        <div
          key={shakeKey}
          role="status"
          data-testid="tamper-status"
          data-ok={ok ? "true" : "false"}
          className={cn(
            "rounded-3xl p-6 transition-colors",
            ok ? "bg-primary text-primary-foreground" : "kolo-shake bg-clay text-white",
          )}
        >
          <div className="flex items-center gap-3">
            {ok ? <IconShieldCheck className="size-8" /> : <IconShieldX className="size-8" />}
            <p className="font-display text-2xl font-semibold leading-tight">
              {ok ? "All entries verified" : sealMismatch ? "Seal doesn't match" : `Entry #${brokenAt} was changed`}
            </p>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed opacity-90">
            {ok
              ? "Every hash was just recomputed in your browser, from the first entry forward. Cut any amount with the scissors and see what happens."
              : sealMismatch
                ? `The chain is internally consistent again, but members already hold seal ${memberSeal} from last week's WhatsApp reminder. This one says ${head}. Rewriting history can't fix that.`
                : `Its hash no longer matches its contents, so everything after it can't be trusted either. The app blocks new writes and every member's phone shows this warning.`}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded-full bg-black/15 px-2.5 py-1">members hold {memberSeal}</span>
            <span className="rounded-full bg-black/15 px-2.5 py-1">ledger head {head}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "edited" ? (
            <button
              type="button"
              onClick={() => void rewrite()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <IconWand className="size-4" /> Cover it up: rehash everything after
            </button>
          ) : null}
          {mode !== "honest" ? (
            <button
              type="button"
              onClick={restore}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconArrowBackUp className="size-4" /> Restore the honest ledger
            </button>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconCircleCheckFilled className="size-4 text-primary" /> SHA-256 · Web Crypto · runs on any phone
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

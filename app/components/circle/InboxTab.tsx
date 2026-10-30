import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconAlertCircle,
  IconCheck,
  IconChecks,
  IconClipboardText,
  IconRobot,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Money, shortDate } from "@/components/kolo/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { View } from "./types";

function confidenceTone(c: number) {
  if (c >= 85) return { bar: "bg-primary", text: "text-primary", label: "Confident" };
  if (c >= 60) return { bar: "bg-gold", text: "text-gold-foreground", label: "Check" };
  return { bar: "bg-clay", text: "text-clay", label: "Needs you" };
}

export function InboxTab({ view }: { view: View }) {
  const circleId = view.circle.id;
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const { data, isPending } = useActionQuery("list-payment-inbox", { circleId, status, limit: 100 });

  const ingest = useActionMutation("ingest-alerts", {
    onSuccess: (r) => {
      setText("");
      toast.success(r.message);
      for (const d of r.duplicates) toast.warning(`Duplicate refused: ${d.why}`);
      for (const s of r.skipped) toast.message(`Skipped: ${s.why}`);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't read those alerts."),
  });
  const confirm = useActionMutation("confirm-payment", {
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't confirm that payment."),
  });
  const bulk = useActionMutation("confirm-matches", {
    onSuccess: (r) => {
      toast.success(r.message);
      for (const s of r.skipped) toast.warning(s.why);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Bulk confirm failed."),
  });
  const reject = useActionMutation("reject-payment", {
    onSuccess: () => toast.success("Dismissed"),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't dismiss it."),
  });

  const payments = data?.payments ?? [];
  const pending = payments.filter((p) => p.status === "pending");
  const confident = pending.filter((p) => p.confidence >= 85 && p.memberId).length;
  const byId = new Map(view.members.map((m) => [m.id, m]));

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <form
          className="kolo-surface rounded-2xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) ingest.mutate({ circleId, text });
          }}
        >
          <label htmlFor="alerts" className="flex items-center gap-2 font-semibold">
            <IconClipboardText className="size-4 text-primary" /> Paste bank alerts
          </label>
          <p className="mt-1 text-xs text-muted-foreground">SMS, app notifications, or emails. Put a blank line between alerts.</p>
          <textarea
            id="alerts"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            spellCheck={false}
            placeholder={"Acct: 0123***789\nAmt: NGN50,000.00 CR\nDesc: TRANSFER FROM ADEBAYO TUNDE O\nDate: 2026-11-03 10:22\n\nYou have received ₦50,000.00 from CHIOMA NWOSU."}
            className="ruled mt-3 w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-[12px] leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" className="mt-2 w-full" disabled={!text.trim() || ingest.isPending}>
            {ingest.isPending ? "Reading…" : "Add to inbox"}
          </Button>
        </form>
        <div className="kolo-surface rounded-2xl p-4 text-sm">
          <p className="font-semibold">How matching works</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>The same alert or bank reference can only be counted once.</li>
            <li>Debits are skipped; only money coming in counts.</li>
            <li>Confirming saves the bank&apos;s spelling of the name, so it matches by itself next time.</li>
          </ul>
        </div>
      </aside>

      <section aria-label="Payments to match" className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-muted p-1 text-sm">
            {(["pending", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn("rounded-full px-3 py-1 capitalize", status === s ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}
              >
                {s === "pending" ? `To match (${view.pendingSignals})` : "History"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {pending.length ? (
              <Button
                variant="outline"
                onClick={() =>
                  sendToAgentChat({
                    message: `Review the ${pending.length} pending payment(s) in ${view.circle.name}'s inbox. Fix anything the parser misread, explain the uncertain matches, and tell me what you'd confirm. Don't confirm anything below 85% without asking me.`,
                    context: JSON.stringify({ circleId }),
                    submit: true,
                    openSidebar: true,
                  })
                }
              >
                <IconSparkles className="size-4" /> Ask Kolo to review
              </Button>
            ) : null}
            {confident ? (
              <Button disabled={bulk.isPending} onClick={() => bulk.mutate({ circleId, minConfidence: 85 })}>
                <IconChecks className="size-4" /> Confirm {confident} confident
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {isPending ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
          ) : !payments.length ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <IconCheck className="mx-auto size-8 text-primary" />
              <p className="mt-3 font-semibold">{status === "pending" ? "Nothing waiting" : "No payments yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Paste this week&apos;s alerts to start matching.</p>
            </div>
          ) : (
            payments.map((p) => {
              const tone = confidenceTone(p.confidence);
              const chosen = overrides[p.id] ?? p.memberId ?? "";
              const resolved = p.status !== "pending";
              return (
                <article
                  key={p.id}
                  className={cn(
                    "grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
                    resolved ? "border-border opacity-80" : "border-border",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <span>{p.occurredOn ? shortDate(p.occurredOn) : "No date"}</span>
                      {p.extractedBy === "agent" ? (
                        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-primary">
                          <IconRobot className="size-3.5" /> read by Kolo
                        </span>
                      ) : null}
                    </div>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/60 p-3 font-mono text-[11.5px] leading-5">
                      {p.rawText}
                    </pre>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Amount{" "}
                        <strong className="text-foreground">
                          {p.amountMinor != null ? <Money minor={p.amountMinor} currency={p.currency ?? view.circle.currency} /> : "?"}
                        </strong>
                      </span>
                      <span>
                        From <strong className="text-foreground">{p.senderName ?? "?"}</strong>
                      </span>
                      {p.reference ? <span className="font-mono">ref {p.reference}</span> : null}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col">
                    {resolved ? (
                      <div className="flex items-center gap-2 text-sm">
                        {p.status === "confirmed" ? (
                          <>
                            <IconCheck className="size-4 text-primary" />
                            <span>
                              Recorded for <strong>{byId.get(p.memberId ?? "")?.name}</strong> as entr{p.ledgerSeqs.length > 1 ? "ies" : "y"}{" "}
                              <span className="font-mono">#{p.ledgerSeqs.join(", #")}</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <IconX className="size-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Dismissed{p.resolutionNote ? `: ${p.resolutionNote}` : ""}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <select
                            aria-label="Member who sent this"
                            value={chosen}
                            onChange={(e) => setOverrides((o) => ({ ...o, [p.id]: e.target.value }))}
                            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm font-medium"
                          >
                            <option value="">Who sent this?</option>
                            {view.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <div className="text-right">
                            <p className={cn("font-display text-xl font-semibold leading-none tabular", tone.text)}>{p.confidence}%</p>
                            <p className="text-[10.5px] text-muted-foreground">{tone.label}</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${p.confidence}%` }} />
                        </div>
                        <ul className="mt-3 flex-1 space-y-1 text-[12.5px] text-muted-foreground">
                          {p.reasons.map((r, i) => (
                            <li key={i} className="flex gap-1.5">
                              <IconAlertCircle className="mt-0.5 size-3.5 shrink-0 opacity-60" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={!chosen || confirm.isPending || p.amountMinor == null}
                            onClick={() =>
                              confirm.mutate({
                                circleId,
                                signalId: p.id,
                                ...(chosen && chosen !== p.memberId ? { memberId: chosen } : {}),
                                rememberBankName: true,
                              })
                            }
                          >
                            <IconCheck className="size-4" /> Confirm
                          </Button>
                          <Button
                            variant="outline"
                            disabled={reject.isPending}
                            onClick={() => reject.mutate({ circleId, signalId: p.id, reason: "Not a contribution to this circle" })}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

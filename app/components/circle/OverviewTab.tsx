import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconBrandWhatsapp,
  IconCash,
  IconCheck,
  IconCircleCheckFilled,
  IconClock,
  IconCopy,
  IconInbox,
  IconInfoCircle,
  IconLock,
  IconSend,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { firstName, initials, Money, relativeDays, shortDate } from "@/components/kolo/brand";
import { RotationRing } from "@/components/kolo/RotationRing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { toMajor, type CurrencyCode } from "../../../shared/money";
import { memberMap, type View } from "./types";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-primary text-primary-foreground",
  ready: "bg-gold text-gold-foreground",
  collecting: "bg-accent text-accent-foreground",
  overdue: "bg-clay text-white",
  upcoming: "bg-muted text-muted-foreground",
};

function RecordCashDialog({
  view,
  memberId,
  onClose,
}: {
  view: View;
  memberId: string | null;
  onClose: () => void;
}) {
  const member = view.members.find((m) => m.id === memberId);
  const currency = view.circle.currency as CurrencyCode;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const record = useActionMutation("record-contribution", {
    onSuccess: (r) => {
      toast.success(r.message);
      onClose();
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't record the payment."),
  });
  const owed = memberId
    ? view.rounds.find((r) => !r.payout && (r.paidBy[memberId] ?? 0) < view.circle.contributionMinor)
    : undefined;
  const defaultAmount = owed && memberId ? view.circle.contributionMinor - (owed.paidBy[memberId] ?? 0) : view.circle.contributionMinor;

  return (
    <Dialog open={!!memberId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment from {member?.name}</DialogTitle>
          <DialogDescription>
            For cash or anything without a bank alert. It fills {member ? firstName(member.name) : "their"}&apos;s earliest unpaid
            round{owed ? ` (round ${owed.round})` : ""}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!memberId) return;
            const value = Number((amount || String(toMajor(defaultAmount, currency))).replace(/,/g, ""));
            record.mutate({
              circleId: view.circle.id,
              memberId,
              amount: value,
              method: "cash",
              ...(note.trim() ? { note: note.trim() } : {}),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cash-amount">Amount</Label>
            <Input
              id="cash-amount"
              inputMode="decimal"
              placeholder={String(toMajor(defaultAmount, currency))}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-note">Note (optional)</Label>
            <Input id="cash-note" placeholder="Paid at Sunday meeting" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={record.isPending}>
            {record.isPending ? "Recording…" : "Record payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemindersDialog({ view, open, onClose }: { view: View; open: boolean; onClose: () => void }) {
  const [language, setLanguage] = useState<"en" | "pcm" | "es" | "fr" | "sw">("en");
  const [scope, setScope] = useState<"late" | "unpaid">(view.late.length ? "late" : "unpaid");
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const { data, isPending } = useActionQuery(
    "draft-reminders",
    { circleId: view.circle.id, language, scope, ...(origin ? { origin } : {}) },
    { enabled: open },
  );
  const log = useActionMutation("log-nudge", {
    onSuccess: () => toast.success("Reminder logged"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reminders</DialogTitle>
          <DialogDescription>Exact amounts from the ledger. Tap to open WhatsApp with the message ready; you send it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Who to remind"
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as "late" | "unpaid")}
          >
            <option value="late">Late payers</option>
            <option value="unpaid">Everyone who owes this round</option>
          </select>
          <select
            aria-label="Language"
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
          >
            <option value="en">English</option>
            <option value="pcm">Pidgin</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="sw">Kiswahili</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              sendToAgentChat({
                message: `Draft warmer, personal reminders for ${scope === "late" ? "the late payers" : "everyone who still owes this round"} in ${view.circle.name}. Use the exact amounts from draft-reminders.`,
                context: JSON.stringify({ circleId: view.circle.id }),
                submit: true,
                openSidebar: true,
              })
            }
          >
            Ask Kolo for a personal touch
          </Button>
        </div>
        <div className="mt-2 space-y-3">
          {isPending ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : !data?.drafts.length ? (
            <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">{data?.message ?? "Nobody to remind."}</p>
          ) : (
            data.drafts.map((d) => (
              <div key={d.memberId} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {d.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · owes <Money minor={d.owedMinor} currency={view.circle.currency} />
                      {d.daysLate > 0 ? ` · ${d.daysLate}d late` : ""}
                    </span>
                  </p>
                  {d.lastNudgedAt ? (
                    <span className="text-xs text-muted-foreground">nudged {relativeDays(d.lastNudgedAt.slice(0, 10), view.today)}</span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">{d.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.whatsappUrl ? (
                    <Button asChild size="sm">
                      <a
                        href={d.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() =>
                          log.mutate({ circleId: view.circle.id, memberId: d.memberId, round: d.round, channel: "whatsapp", message: d.message })
                        }
                      >
                        <IconBrandWhatsapp className="size-4" /> Open WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <span className="self-center text-xs text-muted-foreground">No WhatsApp number saved</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(d.message);
                      log.mutate({ circleId: view.circle.id, memberId: d.memberId, round: d.round, channel: "copy", message: d.message });
                    }}
                  >
                    <IconCopy className="size-4" /> Copy
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OverviewTab({ view, onOpenInbox }: { view: View; onOpenInbox: () => void }) {
  const byId = memberMap(view);
  const { circle } = view;
  const current = view.currentRound ? view.rounds[view.currentRound - 1] : undefined;
  const [cashFor, setCashFor] = useState<string | null>(null);
  const [confirmPayout, setConfirmPayout] = useState(false);
  const [reference, setReference] = useState("");
  const [remindersOpen, setRemindersOpen] = useState(false);
  const lateIds = new Set(view.late.filter((l) => l.round === current?.round).map((l) => l.memberId));

  const payout = useActionMutation("record-payout", {
    onSuccess: (r) => {
      toast.success(r.message);
      setConfirmPayout(false);
      setReference("");
    },
    onError: (e) => {
      setConfirmPayout(false);
      toast.error(actionErrorMessage(e) ?? "Payout refused.");
    },
  });

  const recipient = current ? byId.get(current.recipientId) : undefined;
  const funded = current ? current.collectedMinor >= current.potMinor : false;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="kolo-surface rounded-[24px] p-4 sm:p-6" aria-label="Rotation">
          <RotationRing
            members={view.members}
            rounds={view.rounds}
            currentRound={view.currentRound}
            currency={circle.currency}
            className="mx-auto max-w-[520px]"
          />
          <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Paid out</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-primary" /> Collecting</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-border bg-background" /> Upcoming</span>
            <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded-full bg-gold" /> Pot filling</span>
          </div>
        </section>

        <section className="flex flex-col kolo-surface rounded-[24px]" aria-label="Current round">
          {current && recipient ? (
            <>
              <div className="border-b border-border p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Round {current.round} of {view.rounds.length}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-gold font-semibold text-gold-foreground">
                    {initials(recipient.name)}
                  </span>
                  <div>
                    <p className="font-display text-xl font-semibold leading-tight">{recipient.name} collects</p>
                    <p className="text-sm text-muted-foreground">
                      Due {shortDate(current.dueDate, { weekday: true })} · {relativeDays(view.today, current.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="kolo-kpi text-[1.75rem]">
                    <Money minor={current.collectedMinor} currency={circle.currency} />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    of <Money minor={current.potMinor} currency={circle.currency} />
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-700"
                    style={{ width: `${Math.min(100, (current.collectedMinor / current.potMinor) * 100)}%` }}
                  />
                </div>
              </div>
              <ul className="flex-1 divide-y divide-border overflow-y-auto">
                {view.members.map((m) => {
                  const paid = current.paidBy[m.id] ?? 0;
                  const full = paid >= circle.contributionMinor;
                  const late = lateIds.has(m.id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                      {full ? (
                        <IconCircleCheckFilled className="size-5 shrink-0 text-primary" aria-label="paid" />
                      ) : late ? (
                        <IconClock className="size-5 shrink-0 text-clay" aria-label="late" />
                      ) : (
                        <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-border" aria-label="not yet paid" />
                      )}
                      <span className={cn("min-w-0 flex-1 truncate text-sm", full ? "" : "font-medium")}>{m.name}</span>
                      {full ? (
                        <Money minor={paid} currency={circle.currency} className="text-sm text-muted-foreground" />
                      ) : (
                        <>
                          {late ? <span className="text-xs font-medium text-clay">late</span> : null}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCashFor(m.id)}>
                            <IconCash className="size-3.5" /> Record
                          </Button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-border p-4">
                {funded ? (
                  <Button className="h-12 w-full rounded-full text-[15px]" onClick={() => setConfirmPayout(true)}>
                    <IconSend className="size-4" /> Pay out <Money minor={current.potMinor} currency={circle.currency} /> to{" "}
                    {firstName(recipient.name)}
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block">
                        <Button className="h-12 w-full rounded-full text-[15px]" disabled>
                          <IconLock className="size-4" /> Payout locked
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>The ledger only pays a fully funded round.</TooltipContent>
                  </Tooltip>
                )}
                {!funded ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Waiting on {current.waitingOn.map((w) => firstName(w.name)).join(", ")}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <IconCircleCheckFilled className="mx-auto size-10 text-primary" />
                <p className="mt-3 font-display text-xl font-semibold">Every round has paid out</p>
                <p className="mt-1 text-sm text-muted-foreground">Close the circle from Settings to seal the final ledger.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="kolo-surface rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">You should be holding</p>
          <p className="kolo-kpi mt-3 text-[1.9rem]"><Money minor={view.heldMinor} currency={circle.currency} /></p>
          <p className="mt-1 text-xs text-muted-foreground">Collected minus paid out, from the ledger.</p>
        </div>
        <div className="kolo-surface rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">Paid out so far</p>
          <p className="kolo-kpi mt-3 text-[1.9rem]"><Money minor={view.totalPaidOutMinor} currency={circle.currency} /></p>
          <p className="mt-1 text-xs text-muted-foreground">{view.rounds.filter((r) => r.payout).length} of {view.rounds.length} rounds</p>
        </div>
        <div className="kolo-surface rounded-2xl p-5">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Trust exposure
            <Tooltip>
              <TooltipTrigger aria-label="What is trust exposure?">
                <IconInfoCircle className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                What members who already collected still owe the group. If they stop paying, this is what the circle loses.
              </TooltipContent>
            </Tooltip>
          </p>
          <p className="kolo-kpi mt-3 text-[1.9rem]"><Money minor={view.exposure.totalMinor} currency={circle.currency} /></p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {view.exposure.members.length ? view.exposure.members.map((m) => firstName(m.name)).join(", ") : "Nobody owes after collecting"}
          </p>
        </div>
        <button
          type="button"
          onClick={view.pendingSignals ? onOpenInbox : () => setRemindersOpen(true)}
          className={cn(
            "kolo-lift rounded-2xl border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view.pendingSignals ? "border-primary/30 bg-accent hover:border-primary/60" : view.late.length ? "border-clay/30 bg-clay/5 hover:border-clay/50" : "border-border bg-card hover:border-primary/30",
          )}
        >
          {view.pendingSignals ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-medium text-accent-foreground"><IconInbox className="size-4" /> Inbox</p>
              <p className="kolo-kpi mt-3 text-[1.9rem]">{view.pendingSignals} to match</p>
              <p className="mt-1 text-xs text-muted-foreground">Bank alerts waiting for a decision →</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm font-medium"><IconBrandWhatsapp className="size-4" /> Reminders</p>
              <p className="kolo-kpi mt-3 text-[1.9rem]">
                {view.late.length ? `${new Set(view.late.map((l) => l.memberId)).size} late` : "All on time"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Draft WhatsApp reminders →</p>
            </>
          )}
        </button>
      </div>

      {view.late.length ? (
        <section className="kolo-surface rounded-[24px] border-clay/30 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Late payments</h2>
              <p className="text-sm text-muted-foreground">Past the {circle.graceDays}-day grace period.</p>
            </div>
            <Button variant="outline" onClick={() => setRemindersOpen(true)}>
              <IconBrandWhatsapp className="size-4" /> Draft reminders
            </Button>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {view.late.map((l) => (
              <li key={`${l.memberId}-${l.round}`} className="flex items-center gap-3 rounded-xl bg-clay/5 px-3 py-2.5 text-sm">
                <span className="grid size-8 place-items-center rounded-full bg-clay/15 text-xs font-semibold text-clay">{initials(l.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{l.name}</span>
                  <span className="block text-xs text-muted-foreground">Round {l.round} · {l.daysLate} days late</span>
                </span>
                <Money minor={l.owedMinor} currency={circle.currency} className="font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Schedule">
        <h2 className="font-display text-lg font-semibold tracking-tight">Schedule</h2>
        <ol className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {view.rounds.map((r) => (
            <li key={r.round} className={cn("kolo-surface min-w-[156px] rounded-2xl p-4", r.round === view.currentRound && "border-primary ring-2 ring-primary/15")}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">R{r.round}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", STATUS_STYLE[r.status])}>
                  {r.status === "ready" ? "ready to pay" : r.status}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{byId.get(r.recipientId)?.name}</p>
              <p className="text-xs text-muted-foreground">{shortDate(r.dueDate)}</p>
              {r.payout ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-primary"><IconCheck className="size-3" /> paid #{r.payout.seq}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <RecordCashDialog view={view} memberId={cashFor} onClose={() => setCashFor(null)} />
      <RemindersDialog view={view} open={remindersOpen} onClose={() => setRemindersOpen(false)} />

      <AlertDialog open={confirmPayout} onOpenChange={setConfirmPayout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record the round {current?.round} payout?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm you sent <Money minor={current?.potMinor ?? 0} currency={circle.currency} /> to {recipient?.name}. This is sealed into the
              ledger and can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="payout-ref">Transfer reference (optional)</Label>
            <Input id="payout-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 0023117745" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={payout.isPending || !current}
              onClick={(e) => {
                e.preventDefault();
                if (!current) return;
                payout.mutate({
                  circleId: circle.id,
                  round: current.round,
                  memberId: current.recipientId,
                  ...(reference.trim() ? { reference: reference.trim() } : {}),
                });
              }}
            >
              {payout.isPending ? "Sealing…" : "Record payout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

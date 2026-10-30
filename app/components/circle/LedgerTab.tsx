import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconArrowBackUp,
  IconArrowsExchange,
  IconCash,
  IconFlag,
  IconLock,
  IconRobot,
  IconSend,
  IconShieldCheck,
  IconShieldX,
  IconSparkles,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { firstName, Money, Seal } from "@/components/kolo/brand";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { sealOf, verifyChain, type AnyEntry, type VerifyResult } from "../../../shared/ledger";
import { memberMap, type View } from "./types";

type Row = AnyEntry & { recordedVia: string; recordedBy: string; reversed: boolean };

const VIA: Record<string, { label: string; className: string }> = {
  app: { label: "App", className: "bg-muted text-foreground" },
  agent: { label: "Kolo agent", className: "bg-accent text-accent-foreground" },
  mcp: { label: "MCP", className: "bg-gold/25 text-gold-foreground" },
  cli: { label: "CLI", className: "bg-muted text-foreground" },
  automation: { label: "Scheduled", className: "bg-accent text-accent-foreground" },
  demo: { label: "Sample", className: "bg-muted text-muted-foreground" },
};

export function describeEntry(e: AnyEntry, names: (id: string) => string, currency: string) {
  switch (e.kind) {
    case "circle.opened":
      return { icon: IconFlag, text: `Circle opened with ${e.payload.members.length} members`, amount: null };
    case "contribution":
      return {
        icon: IconCash,
        text: `${names(e.payload.memberId)} paid${e.payload.method === "cash" ? " (cash)" : ""} · round ${e.payload.round}`,
        amount: <Money minor={e.payload.amountMinor} currency={currency} sign />,
      };
    case "payout":
      return {
        icon: IconSend,
        text: `Round ${e.payload.round} paid to ${names(e.payload.memberId)}`,
        amount: <Money minor={-e.payload.amountMinor} currency={currency} />,
      };
    case "swap":
      return {
        icon: IconArrowsExchange,
        text: `${firstName(names(e.payload.memberA))} ⇄ ${firstName(names(e.payload.memberB))}: rounds ${e.payload.roundA} and ${e.payload.roundB} · ${e.payload.consent}`,
        amount: null,
      };
    case "reversal":
      return { icon: IconArrowBackUp, text: `Reversed entry #${e.payload.targetSeq}: ${e.payload.reason}`, amount: null };
    case "circle.closed":
      return { icon: IconLock, text: `Circle closed: ${e.payload.reason}`, amount: null };
  }
}

export function LedgerTab({ view }: { view: View }) {
  const circleId = view.circle.id;
  const byId = memberMap(view);
  const names = (id: string) => byId.get(id)?.name ?? "Unknown member";
  const { data, isPending } = useActionQuery("list-ledger", { circleId, limit: 500 });
  const [check, setCheck] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [reverseSeq, setReverseSeq] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const reverse = useActionMutation("reverse-entry", {
    onSuccess: (r) => {
      toast.success(r.message);
      setReverseSeq(null);
      setReason("");
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't reverse that entry."),
  });

  const tamper = useActionMutation("simulate-tamper", {
    onSuccess: (r) => {
      toast.warning(r.message);
      setCheck(null);
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Simulation failed."),
  });

  const rows = (data?.entries ?? []) as Row[];
  const paidRounds = new Set(view.rounds.filter((r) => r.payout).map((r) => r.round));

  async function verifyHere() {
    setChecking(true);
    // Recompute every hash in this browser, oldest first, with the same code members run.
    const ordered = [...rows].sort((a, b) => a.seq - b.seq);
    const result = await verifyChain(ordered);
    await new Promise((r) => setTimeout(r, 450));
    setCheck(result);
    setChecking(false);
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-2xl border p-4",
          check && !check.ok ? "border-clay/40 bg-clay/5" : "border-border bg-card",
        )}
      >
        {check && !check.ok ? (
          <IconShieldX className="size-8 text-clay" />
        ) : (
          <IconShieldCheck className={cn("size-8", check ? "text-primary" : "text-muted-foreground")} />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {check
              ? check.ok
                ? `All ${check.count} entries verified in this browser`
                : `Broken at entry #${check.brokenAt} (${check.reason.replace(/_/g, " ")})`
              : "Hash-chained ledger"}
          </p>
          <p className="text-sm text-muted-foreground">
            {check?.ok
              ? `Head ${sealOf(check.headHash)} matches the circle's seal.`
              : "Each entry's SHA-256 includes the one before it. Editing any past entry breaks every seal after it."}
          </p>
        </div>
        <Seal seal={view.circle.seal} ok={view.integrity.ok && view.integrity.headMatches} size="md" />
        <Button variant="outline" onClick={() => void verifyHere()} disabled={checking || isPending}>
          {checking ? "Recomputing…" : "Verify in this browser"}
        </Button>
        {import.meta.env.DEV ? (
          <Button
            variant="ghost"
            className="text-clay"
            title="Development only: edit an entry directly in the database, like a dishonest admin would"
            disabled={tamper.isPending}
            onClick={() => tamper.mutate({ circleId })}
          >
            Simulate tampering
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isPending ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((e) => {
              const d = describeEntry(e, names, view.circle.currency);
              const via = VIA[e.recordedVia] ?? VIA.app!;
              const reversible =
                e.kind === "contribution" && !e.reversed && !paidRounds.has(e.payload.round) && view.circle.status === "active";
              return (
                <li key={e.seq} className={cn("group flex items-center gap-3 px-4 py-3", e.reversed && "opacity-55")}>
                  <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">#{e.seq}</span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                    <d.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", e.reversed && "line-through")}>{d.text}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span>{new Date(e.recordedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-px font-medium", via.className)}>
                        {e.recordedVia === "agent" ? <IconRobot className="size-3" /> : e.recordedVia === "mcp" ? <IconSparkles className="size-3" /> : null}
                        {via.label}
                      </span>
                      <span className="hidden font-mono sm:inline" title={e.hash}>
                        {sealOf(e.hash)} ← {e.prevHash.startsWith("0000") ? "genesis" : sealOf(e.prevHash)}
                      </span>
                    </p>
                  </div>
                  {d.amount ? <span className="shrink-0 font-semibold">{d.amount}</span> : null}
                  {reversible ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => setReverseSeq(e.seq)}
                    >
                      Reverse
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <AlertDialog open={reverseSeq !== null} onOpenChange={(o) => !o && setReverseSeq(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse entry #{reverseSeq}?</AlertDialogTitle>
            <AlertDialogDescription>
              A new entry cancels it out. The original stays in the ledger for everyone to see. If it came from a bank alert, the alert
              goes back to the inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reverse-reason">Reason</Label>
            <Input id="reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Matched to the wrong member" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={reason.trim().length < 8 || reverse.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (reverseSeq !== null) reverse.mutate({ circleId, seq: reverseSeq, reason: reason.trim() });
              }}
            >
              Reverse entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

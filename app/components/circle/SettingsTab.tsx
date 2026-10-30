import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconArrowsExchange, IconLock } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { memberMap, type View } from "./types";

const selectClass = "h-10 w-full rounded-md border border-input bg-card px-2 text-sm";

export function SettingsTab({ view }: { view: View }) {
  const circleId = view.circle.id;
  const byId = memberMap(view);
  const unpaid = view.rounds.filter((r) => !r.payout);
  const [name, setName] = useState(view.circle.name);
  const [grace, setGrace] = useState(String(view.circle.graceDays));
  const [a, setA] = useState(unpaid[0]?.round ?? 0);
  const [b, setB] = useState(unpaid[1]?.round ?? 0);
  const [consent, setConsent] = useState("");

  const update = useActionMutation("update-circle", {
    onSuccess: () => toast.success("Saved"),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't save."),
  });
  const swap = useActionMutation("swap-turns", {
    onSuccess: (r) => {
      toast.success(r.message);
      setConsent("");
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Swap refused."),
  });
  const close = useActionMutation("close-circle", {
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Can't close yet."),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Details</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ circleId, name: name.trim(), graceDays: Number(grace) || 0 });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-grace">Grace period (days)</Label>
            <Input id="s-grace" type="number" min={0} max={30} value={grace} onChange={(e) => setGrace(e.target.value)} />
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <IconLock className="mt-0.5 size-3.5 shrink-0" /> Amount, schedule, and members were frozen in the ledger when the circle started.
          </p>
          <Button type="submit" disabled={update.isPending}>
            Save
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <IconArrowsExchange className="size-4" /> Swap turns
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">When two members agree to trade rounds. Only unpaid rounds can move.</p>
        {unpaid.length < 2 ? (
          <p className="mt-4 text-sm text-muted-foreground">Fewer than two rounds left to swap.</p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              swap.mutate({ circleId, roundA: a, roundB: b, consent: consent.trim() });
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                [a, setA, "First"],
                [b, setB, "Second"],
              ].map(([value, set, label]) => (
                <select
                  key={label as string}
                  aria-label={`${label} round`}
                  className={selectClass}
                  value={value as number}
                  onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
                >
                  {unpaid.map((r) => (
                    <option key={r.round} value={r.round}>
                      R{r.round} · {byId.get(r.recipientId)?.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consent">How did both agree?</Label>
              <Input id="consent" value={consent} onChange={(e) => setConsent(e.target.value)} placeholder="Both confirmed in the group chat on 12 Nov" />
            </div>
            <Button type="submit" variant="outline" disabled={swap.isPending || a === b || consent.trim().length < 8}>
              Record swap
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <h2 className="font-semibold">Close the circle</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Available after every round pays out. The final seal is the group&apos;s proof that the books balanced.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          disabled={view.currentRound !== null || view.circle.status === "closed" || close.isPending}
          onClick={() => close.mutate({ circleId, reason: "All rounds paid out" })}
        >
          {view.circle.status === "closed" ? "Closed" : "Close circle"}
        </Button>
      </section>
    </div>
  );
}

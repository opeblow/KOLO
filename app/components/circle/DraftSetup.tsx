import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconArrowDown, IconArrowUp, IconDice5, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { initials, Money, shortDate } from "@/components/kolo/brand";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { View } from "./types";

export function DraftSetup({ view }: { view: View }) {
  const navigate = useNavigate();
  const circleId = view.circle.id;
  const order = [...view.members].sort((a, b) => a.position - b.position);
  const onError = (fallback: string) => (e: Error) => toast.error(actionErrorMessage(e) ?? fallback);

  const reorder = useActionMutation("set-payout-order", {
    onSuccess: (r) => toast.success(r.message),
    onError: onError("Couldn't change the order."),
  });
  const activate = useActionMutation("activate-circle", {
    onSuccess: (r) => toast.success(r.message),
    onError: onError("Couldn't start the circle."),
  });
  const remove = useActionMutation("remove-member", { onError: onError("Couldn't remove the member.") });
  const del = useActionMutation("delete-circle", {
    onSuccess: () => {
      toast.success("Draft deleted");
      navigate("/circles");
    },
    onError: onError("Couldn't delete the draft."),
  });

  function move(i: number, d: number) {
    const ids = order.map((m) => m.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate({ circleId, method: "manual", memberIds: ids });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section className="kolo-surface rounded-[24px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Payout order</h2>
            <p className="text-sm text-muted-foreground">Agree on this with the group before starting. It can&apos;t change later without a recorded swap.</p>
          </div>
          <Button variant="outline" disabled={reorder.isPending} onClick={() => reorder.mutate({ circleId, method: "draw" })}>
            <IconDice5 className="size-4" /> Draw lots
          </Button>
        </div>
        <ol className="mt-5 divide-y divide-border rounded-2xl border border-border">
          {order.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 font-mono text-xs text-muted-foreground">{i + 1}</span>
              <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(m.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">Collects {view.rounds[i] ? shortDate(view.rounds[i]!.dueDate) : ""}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                <IconArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Move down"
                disabled={i === order.length - 1 || reorder.isPending}
                onClick={() => move(i, 1)}
              >
                <IconArrowDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${m.name}`}
                disabled={order.length <= 2 || remove.isPending}
                onClick={() => remove.mutate({ circleId, memberId: m.id })}
              >
                <IconTrash className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      </section>

      <aside className="space-y-4">
        <div className="kolo-surface rounded-[24px] p-5">
          <RotationRing
            members={view.members}
            rounds={view.rounds}
            currentRound={1}
            currency={view.circle.currency}
            showCenter={false}
            className="mx-auto max-w-[300px]"
          />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Each pays</dt>
              <dd className="font-semibold"><Money minor={view.circle.contributionMinor} currency={view.circle.currency} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Each pot</dt>
              <dd className="font-semibold"><Money minor={view.circle.potMinor} currency={view.circle.currency} /></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">First due</dt>
              <dd className="font-semibold">{shortDate(view.circle.startDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Grace</dt>
              <dd className="font-semibold">{view.circle.graceDays} days</dd>
            </div>
          </dl>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="mt-5 h-11 w-full">
                <IconPlayerPlay className="size-4" /> Start circle
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start {view.circle.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  The terms and payout order are sealed into the first ledger entry. Members can verify them from their links. After this,
                  only swaps that both members agree to can change the order.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction disabled={activate.isPending} onClick={() => activate.mutate({ circleId })}>
                  Start and seal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Button variant="ghost" className="w-full text-muted-foreground" disabled={del.isPending} onClick={() => del.mutate({ circleId })}>
          Delete draft
        </Button>
      </aside>
    </div>
  );
}

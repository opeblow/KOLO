import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconCopy, IconPencil, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { initials, Money } from "@/components/kolo/brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { View, ViewMember } from "./types";

function EditMember({ view, member, onClose }: { view: View; member: ViewMember | null; onClose: () => void }) {
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [alias, setAlias] = useState("");
  const update = useActionMutation("upsert-member", {
    onSuccess: (r) => {
      toast.success(r.message);
      setAlias("");
    },
    onError: (e) => toast.error(actionErrorMessage(e) ?? "Couldn't update the member."),
  });
  if (!member) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>Phone for reminders, and the names their bank prints on transfers.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ circleId: view.circle.id, memberId: member.id, phone: phone.trim() || null });
          }}
        >
          <Label htmlFor="m-phone">WhatsApp number</Label>
          <div className="flex gap-2">
            <Input id="m-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348031234567" />
            <Button type="submit" variant="outline" disabled={update.isPending}>
              Save
            </Button>
          </div>
        </form>
        <div className="space-y-2">
          <Label htmlFor="m-alias">Bank names</Label>
          <div className="flex flex-wrap gap-1.5">
            {(member.aliases ?? []).length ? (
              member.aliases!.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 font-mono text-xs">
                  {a}
                  <button
                    type="button"
                    aria-label={`Forget ${a}`}
                    className="rounded-full p-0.5 hover:bg-background"
                    onClick={() => update.mutate({ circleId: view.circle.id, memberId: member.id, removeAliases: [a] })}
                  >
                    <IconX className="size-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None yet. Kolo learns them when you confirm a payment.</span>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (alias.trim().length >= 2) update.mutate({ circleId: view.circle.id, memberId: member.id, addAliases: [alias.trim()] });
            }}
          >
            <Input id="m-alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. NWOSU C. ENTERPRISES" />
            <Button type="submit" variant="outline" disabled={update.isPending || alias.trim().length < 2}>
              Add
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MembersTab({ view }: { view: View }) {
  const [editing, setEditing] = useState<string | null>(null);
  const total = view.circle.contributionMinor * view.rounds.length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sorted = [...view.members].sort((a, b) => a.payoutRound - b.payoutRound);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Turn</th>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Paid in</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Still owes</th>
              <th className="px-4 py-3 font-medium sr-only">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">R{m.payoutRound}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(m.name)}
                    </span>
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.phone ?? "No phone"}
                        {m.aliases?.length ? ` · ${m.aliases.length} bank name${m.aliases.length > 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Money minor={m.paidMinor} currency={view.circle.currency} />
                  <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(m.paidMinor / Math.max(total, 1)) * 100}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {m.receivedMinor ? <Money minor={m.receivedMinor} currency={view.circle.currency} className="font-semibold text-primary" /> : "—"}
                </td>
                <td className="px-4 py-3">
                  <Money minor={m.outstandingMinor} currency={view.circle.currency} className={m.receivedMinor && m.outstandingMinor ? "font-semibold text-clay" : ""} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${origin}/m/${m.memberToken}`);
                        toast.success(`Copied ${m.name.split(" ")[0]}'s personal link`);
                      }}
                    >
                      <IconCopy className="size-4" /> Link
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m.id)}>
                      <IconPencil className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EditMember
        key={editing ?? "none"}
        view={view}
        member={view.members.find((m) => m.id === editing) ?? null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

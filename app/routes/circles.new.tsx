import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconArrowDown, IconArrowUp, IconPlus, IconSparkles, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "../../shared/money";
import { addDays, todayIn, type Cadence } from "../../shared/schedule";

export function meta() {
  return [{ title: "New circle · Kolo" }];
}

type Row = { key: number; name: string; phone: string };

const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function NewCircleRoute() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("NGN");
  const [amount, setAmount] = useState("50000");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [startDate, setStartDate] = useState(() => addDays(todayIn("UTC"), 7));
  const [graceDays, setGraceDays] = useState("2");
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({ key: i, name: "", phone: "" })),
  );
  const [paste, setPaste] = useState("");

  const create = useActionMutation("create-circle", {
    onSuccess: (result) => {
      toast.success(`${result.name} created as a draft`);
      navigate(`/circles/${result.id}`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Couldn't create the circle."),
  });

  const members = rows.filter((r) => r.name.trim());
  const amountNum = Number(amount.replace(/,/g, ""));
  const valid = name.trim() && amountNum > 0 && members.length >= 2;

  function move(i: number, d: number) {
    setRows((rs) => {
      const next = [...rs];
      const j = i + d;
      if (j < 0 || j >= next.length) return rs;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function importList() {
    const names = paste
      .split(/\n|,/)
      .map((l) => l.replace(/^\s*\d+[.)-]?\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!names.length) return;
    setRows(names.map((n, i) => {
      const phone = n.match(/\+?\d[\d\s-]{7,}/)?.[0] ?? "";
      return { key: Date.now() + i, name: n.replace(phone, "").trim(), phone: phone.replace(/[\s-]/g, "") };
    }));
    setPaste("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    create.mutate({
      name: name.trim(),
      currency,
      contribution: amountNum,
      cadence,
      startDate,
      graceDays: Number(graceDays) || 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
      members: members.map((m) => ({ name: m.name.trim(), ...(m.phone.trim() ? { phone: m.phone.trim() } : {}) })),
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">New circle</h1>
          <p className="mt-1 text-muted-foreground">It stays a draft until you start it, so nothing here is final yet.</p>
        </div>

        <section className="kolo-surface rounded-2xl p-5 sm:p-6">
          <h2 className="font-semibold">Terms</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Circle name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yaba Traders' Ajo" maxLength={80} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Each member pays</Label>
              <div className="flex gap-2">
                <select aria-label="Currency" className={`${selectClass} w-28`} value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
                  {CURRENCY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCIES[c].symbol} {c}
                    </option>
                  ))}
                </select>
                <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cadence">How often</Label>
              <select id="cadence" className={selectClass} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start">First contribution due</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grace">Grace period (days)</Label>
              <Input id="grace" type="number" min={0} max={30} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="kolo-surface rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Members, in payout order</h2>
            <span className="text-sm text-muted-foreground">{members.length} added</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">The first person collects round 1. You can also draw lots after creating.</p>
          <ol className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-2">
                <span className="w-6 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                <Input
                  aria-label={`Member ${i + 1} name`}
                  value={r.name}
                  placeholder="Name"
                  onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
                />
                <Input
                  aria-label={`Member ${i + 1} WhatsApp`}
                  value={r.phone}
                  placeholder="WhatsApp, e.g. +234…"
                  className="hidden sm:block"
                  onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, phone: e.target.value } : x)))}
                />
                <Button type="button" variant="ghost" size="icon" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <IconArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                  <IconArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  disabled={rows.length <= 2}
                >
                  <IconTrash className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={rows.length >= 50}
            onClick={() => setRows((rs) => [...rs, { key: Date.now(), name: "", phone: "" }])}
          >
            <IconPlus className="size-4" /> Add member
          </Button>
          <details className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Paste a list instead</summary>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={5}
              placeholder={"1. Ngozi Okafor +2348030000001\n2. Tunde Adebayo\n3. Aisha Mohammed"}
              className="mt-2 w-full rounded-md border border-input bg-card p-2 font-mono text-xs"
            />
            <Button type="button" size="sm" className="mt-2" onClick={importList} disabled={!paste.trim()}>
              Use this list
            </Button>
          </details>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="kolo-surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Each pot</p>
          <p className="mt-1 font-display text-4xl font-bold tabular">
            {CURRENCIES[currency].symbol}
            {new Intl.NumberFormat("en").format((amountNum || 0) * members.length)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} members × {CURRENCIES[currency].symbol}
            {new Intl.NumberFormat("en").format(amountNum || 0)}, {members.length} rounds
          </p>
          <Button type="submit" className="mt-5 w-full" disabled={!valid || create.isPending}>
            {create.isPending ? "Creating…" : "Create draft"}
          </Button>
          {!valid ? <p className="mt-2 text-xs text-muted-foreground">Add a name, an amount, and at least two members.</p> : null}
        </div>
        <div className="rounded-2xl border border-dashed border-border p-5">
          <IconSparkles className="size-5 text-primary" />
          <p className="mt-3 font-semibold">Have the rules in WhatsApp?</p>
          <p className="mt-1 text-sm text-muted-foreground">Paste the organizer&apos;s message and Kolo will draft the circle for you to review.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={() =>
              sendToAgentChat({
                message:
                  "Set up a savings circle from our group's WhatsApp message below. Create it as a draft and tell me anything you had to assume.\n\n",
                submit: false,
                openSidebar: true,
              })
            }
          >
            Paste into Kolo
          </Button>
        </div>
      </aside>
    </form>
  );
}

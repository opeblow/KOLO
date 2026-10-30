import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconCopy, IconExternalLink, IconSparkles } from "@tabler/icons-react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { DraftSetup } from "@/components/circle/DraftSetup";
import { InboxTab } from "@/components/circle/InboxTab";
import { LedgerTab } from "@/components/circle/LedgerTab";
import { MembersTab } from "@/components/circle/MembersTab";
import { OverviewTab } from "@/components/circle/OverviewTab";
import { SettingsTab } from "@/components/circle/SettingsTab";
import { CADENCE_LABEL, Money, Seal } from "@/components/kolo/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABS = ["overview", "inbox", "ledger", "members", "settings"] as const;
type Tab = (typeof TABS)[number];

export function meta() {
  return [{ title: "Circle · Kolo" }];
}

export default function CircleRoute() {
  const { circleId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const { data: view, isPending, error } = useActionQuery("get-circle", { circleId });

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-44 rounded-[28px]" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[420px] rounded-[24px]" />
          <Skeleton className="h-[420px] rounded-[24px]" />
        </div>
      </div>
    );
  }
  if (error || !view) {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <p className="font-display text-2xl font-semibold">Circle not found</p>
        <p className="mt-2 text-muted-foreground">It may have been deleted, or you don&apos;t have access.</p>
        <Button asChild className="mt-6">
          <Link to="/circles">Back to circles</Link>
        </Button>
      </div>
    );
  }

  const { circle } = view;
  const active = circle.status !== "draft";
  const verifyUrl = typeof window !== "undefined" && circle.publicToken ? `${window.location.origin}/v/${circle.publicToken}` : "";
  const integrityOk = view.integrity.ok && view.integrity.headMatches;

  function setTab(t: Tab) {
    setParams(t === "overview" ? {} : { tab: t }, { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <header className="kolo-ink kolo-grain relative overflow-hidden rounded-[28px] px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
        <div className="kolo-glow absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <Link to="/circles" className="text-sm text-white/55 transition hover:text-white">
              ← Circles
            </Link>
            <h1 className="mt-2 truncate font-display text-[2rem] font-semibold leading-none tracking-[-0.035em] sm:text-[2.6rem]">{circle.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-white/65">
              <span>{view.members.length} members</span>
              <span aria-hidden="true" className="text-white/30">/</span>
              <span>
                <Money minor={circle.contributionMinor} currency={circle.currency} /> {CADENCE_LABEL[circle.cadence]?.toLowerCase()}
              </span>
              <span aria-hidden="true" className="text-white/30">/</span>
              <span>
                pot <Money minor={circle.potMinor} currency={circle.currency} className="text-white" />
              </span>
              {active ? <Seal seal={circle.seal} ok={integrityOk} className={cn("ml-1", integrityOk ? "border-white/15 bg-white/10 text-white" : "bg-clay text-white")} /> : null}
              {circle.status === "draft" ? (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-gold-foreground">Draft</span>
              ) : null}
              {circle.status === "closed" ? <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">Closed</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {active ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(verifyUrl);
                    toast.success("Verification link copied. Share it in the group.");
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-white/90 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <IconCopy className="size-4" /> Members&apos; link
                </button>
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-white/90 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <IconExternalLink className="size-4" /> View as member
                </a>
              </>
            ) : null}
            <button
              type="button"
              onClick={() =>
                sendToAgentChat({
                  message: active
                    ? `Give me a quick treasurer's check on ${circle.name}: who's late, anything waiting in the inbox, and whether the next round can pay out.`
                    : `Review the draft circle ${circle.name} with me before I start it: terms, payout order, and anything that looks off.`,
                  context: JSON.stringify({ circleId: circle.id }),
                  submit: true,
                  openSidebar: true,
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-gold-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <IconSparkles className="size-4" /> Ask Kolo
            </button>
          </div>
        </div>

        {active ? (
          <nav aria-label="Circle sections" className="-mx-1 mt-7 flex gap-1 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={tab === t ? "page" : undefined}
                className={cn(
                  "relative flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  tab === t ? "bg-white text-foreground shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white",
                )}
              >
                {t}
                {t === "inbox" && view.pendingSignals ? (
                  <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold text-gold-foreground tabular">{view.pendingSignals}</span>
                ) : null}
                {t === "overview" && view.late.length ? <span className="size-1.5 rounded-full bg-clay" aria-label="late payers" /> : null}
              </button>
            ))}
          </nav>
        ) : (
          <div className="h-3" />
        )}
      </header>

      {!integrityOk && active ? (
        <div role="alert" className="mt-5 rounded-2xl border border-clay/40 bg-clay/10 p-4 text-sm text-clay">
          <p className="font-semibold">This ledger failed verification.</p>
          <p className="mt-1">
            {view.integrity.ok
              ? "The newest entries may have been removed outside Kolo."
              : `Entry #${view.integrity.brokenAt} no longer matches its seal: data was changed outside Kolo. New entries are blocked until this is investigated.`}
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        {!active ? (
          <DraftSetup view={view} />
        ) : tab === "inbox" ? (
          <InboxTab view={view} />
        ) : tab === "ledger" ? (
          <LedgerTab view={view} />
        ) : tab === "members" ? (
          <MembersTab view={view} />
        ) : tab === "settings" ? (
          <SettingsTab view={view} />
        ) : (
          <OverviewTab view={view} onOpenInbox={() => setTab("inbox")} />
        )}
      </div>
    </div>
  );
}

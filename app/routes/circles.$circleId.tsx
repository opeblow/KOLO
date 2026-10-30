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
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
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
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/circles" className="text-sm text-muted-foreground hover:text-foreground">
            Circles
          </Link>
          <h1 className="mt-1 truncate font-display text-3xl font-bold tracking-tight sm:text-4xl">{circle.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{view.members.length} members</span>
            <span aria-hidden="true">·</span>
            <span>
              <Money minor={circle.contributionMinor} currency={circle.currency} /> {CADENCE_LABEL[circle.cadence]?.toLowerCase()}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              pot <Money minor={circle.potMinor} currency={circle.currency} />
            </span>
            {active ? <Seal seal={circle.seal} ok={integrityOk} className="ml-1" /> : null}
            {circle.status === "draft" ? (
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-xs font-semibold text-gold-foreground">Draft</span>
            ) : null}
            {circle.status === "closed" ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Closed</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {active ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(verifyUrl);
                  toast.success("Verification link copied. Share it in the group.");
                }}
              >
                <IconCopy className="size-4" /> Members&apos; link
              </Button>
              <Button variant="outline" asChild>
                <a href={verifyUrl} target="_blank" rel="noreferrer">
                  <IconExternalLink className="size-4" /> View as member
                </a>
              </Button>
            </>
          ) : null}
          <Button
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
          >
            <IconSparkles className="size-4" /> Ask Kolo
          </Button>
        </div>
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

      {active ? (
        <nav aria-label="Circle sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={cn(
                "relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium capitalize transition-colors",
                tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {t === "inbox" && view.pendingSignals ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular">
                  {view.pendingSignals}
                </span>
              ) : null}
              {t === "overview" && view.late.length ? <span className="size-1.5 rounded-full bg-clay" aria-label="late payers" /> : null}
            </button>
          ))}
        </nav>
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

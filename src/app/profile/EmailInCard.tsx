"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field, TextInput } from "@/components/ui/Field";
import { EMAIL_IN_DOMAIN } from "@/lib/emailIn";
import { claimEmailAddressAction } from "../emailInActions";

export type EmailInLogRow = {
  id: string;
  when: string;
  from: string;
  subject: string;
  detail: string;
};

/**
 * Email loads to ProfitRig: the driver's own address, how to feed it, the
 * Gmail confirmation code when Gmail asks for one, and what has arrived.
 */
export function EmailInCard({
  address,
  canUse,
  gmail,
  log,
}: {
  address: string | null;
  canUse: boolean;
  gmail: { code: string; from: string | null } | null;
  log: EmailInLogRow[];
}) {
  const [current, setCurrent] = useState(address);
  const [editing, setEditing] = useState(!address);
  const [name, setName] = useState(address ? address.split("@")[0] : "");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function claim(wanted: string) {
    setError(null);
    setSuggestion(null);
    startTransition(async () => {
      const r = await claimEmailAddressAction(wanted);
      if (!r.ok) {
        setError(r.error);
        setSuggestion(r.suggestion ?? null);
        return;
      }
      setCurrent(r.address);
      setName(r.address.split("@")[0]);
      setEditing(false);
    });
  }

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The address is on screen to copy by hand.
    }
  }

  if (!canUse) {
    return (
      <Card>
        <CardHeader
          title="Email loads to ProfitRig"
          description="Forward rate cons to your own ProfitRig address and they wait on your Loads page, filled in and ready to check."
        />
        <p className="text-sm">
          <Link href="/upgrade" className="pr-link font-semibold">
            Comes with ProfitRig Pro
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Email loads to ProfitRig"
        description="Send or forward a rate con or load ticket to your own ProfitRig address. It's read like a scan and waits on your Loads page for you to check and save."
      />

      {gmail && (
        <Notice className="mb-4">
          <span className="font-semibold">Gmail is asking to confirm forwarding</span>
          {gmail.from ? ` from ${gmail.from}` : ""}. Your confirmation code:{" "}
          <span className="pr-figure font-semibold">{gmail.code}</span>. Enter it in Gmail →
          Settings → Forwarding.
        </Notice>
      )}

      {current && !editing ? (
        <div className="mb-4">
          <p className="pr-record-label mb-1">Your address</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="pr-figure break-all text-lg font-semibold text-[var(--pr-rig-green)]">
              {current}
            </span>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <button type="button" className="pr-link text-sm" onClick={() => setEditing(true)}>
              Change
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            claim(name);
          }}
        >
          <Field label={current ? "New address" : "Pick your address"}>
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="dennis"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={40}
                className="max-w-[14rem]"
              />
              <span className="text-sm text-muted">@{EMAIL_IN_DOMAIN}</span>
            </div>
          </Field>
          {error && (
            <Notice tone="error" className="mt-3">
              {error}
              {suggestion && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="pr-link font-semibold"
                    onClick={() => {
                      setName(suggestion);
                      claim(suggestion);
                    }}
                  >
                    Use {suggestion}@{EMAIL_IN_DOMAIN}
                  </button>
                </>
              )}
            </Notice>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="dark" pending={pending}>
              {current ? "Change address" : "Create my address"}
            </Button>
            {current && (
              <button type="button" className="pr-link text-sm" onClick={() => setEditing(false)}>
                Keep {current}
              </button>
            )}
          </div>
          {current && (
            <p className="mt-2 text-xs text-muted">
              Your old address stops working as soon as you change it.
            </p>
          )}
        </form>
      )}

      {current && (
        <details className="mb-4 text-sm">
          <summary className="cursor-pointer font-semibold text-[var(--pr-rig-green)]">
            Three ways to get rate cons here
          </summary>
          <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5 leading-snug">
            <li>
              <span className="font-semibold">Forward it yourself.</span> When a rate con
              arrives, forward the email to {current}. Save the address as a contact
              named &ldquo;ProfitRig Loads&rdquo; so it&apos;s one tap.
            </li>
            <li>
              <span className="font-semibold">Set it up once, then forget it.</span>
              <br />
              <span className="font-semibold">Gmail:</span> Settings → See all settings →
              Forwarding and POP/IMAP → Add a forwarding address → {current}. Gmail sends a
              code here, and it shows at the top of this card. Enter it in Gmail. Then
              search Gmail for{" "}
              <code className="pr-figure">{`{"rate confirmation" "rate con" "load confirmation"} has:attachment`}</code>
              , choose Create filter, tick Forward it to, and pick {current}.
              <br />
              <span className="font-semibold">Outlook:</span> Settings → Mail → Rules →
              Add new rule: Subject includes &ldquo;rate confirmation&rdquo; and Has an
              attachment → Forward to {current}. Some company Outlook accounts don&apos;t
              allow forwarding outside the company.
            </li>
            <li>
              <span className="font-semibold">Give it out.</span> Ask your dispatcher or
              broker to copy {current} on rate cons.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted">
            Attach the PDF or photo — links in an email can&apos;t be opened. Up to 3
            documents per email. For a big phone photo, use Scan on Add a Load instead.
            Each document read uses your AI allowance, like a scan.
          </p>
        </details>
      )}

      {current && (
        <div>
          <p className="pr-record-label mb-2">What arrived</p>
          {log.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {log.map((m) => (
                <li key={m.id} className="border-b border-border pb-2 last:border-0">
                  <p className="text-xs text-muted">
                    {m.when} · {m.from || "unknown sender"}
                  </p>
                  {m.subject && <p className="font-semibold leading-snug">{m.subject}</p>}
                  <p className="leading-snug">{m.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

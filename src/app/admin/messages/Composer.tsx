"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import {
  AUDIENCES,
  AUDIENCE_LABEL,
  DEFAULT_BANNER_DAYS,
  MAX_BANNER,
  defaultBanner,
  emailHtml,
  personalize,
  renderBody,
  type Audience,
} from "@/lib/messages";
import { endAnnouncementAction, saveMessageSettingsAction, sendCampaignAction, sendTestAction } from "./actions";

export type Preset = { label: string; subject: string; body: string; banner: string };

const DRAFT_KEY = "pr.admin.compose.v1";

/**
 * Write an announcement, see it exactly as drivers will, send it to yourself,
 * then to an audience — by email, as an in-app banner, or both. Nobody who
 * opted out is ever counted or sent to; the server works out who gets it.
 */
export function Composer({
  counts,
  ready,
  previewName,
  mailingAddress,
  presets,
}: {
  counts: Record<Audience, number>;
  /** Postmark token and sender settings are in place. */
  ready: boolean;
  previewName: string;
  mailingAddress: string;
  presets: Preset[];
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [sendEmail, setSendEmail] = useState(true);
  const [showInApp, setShowInApp] = useState(false);
  const [bannerText, setBannerText] = useState("");
  const [bannerDays, setBannerDays] = useState(String(DEFAULT_BANNER_DAYS));
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // A draft is kept in this browser as it's typed, and brought back on
  // request — a convenience, nothing more.
  const keep = (next: { subject?: string; body?: string; audience?: Audience }) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, body, audience, ...next }));
    } catch {
      // private window
    }
  };
  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (!d || typeof d !== "object" || (!d.subject && !d.body)) return setNote("No saved draft in this browser.");
      setSubject(String(d.subject ?? ""));
      setBody(String(d.body ?? ""));
      if (AUDIENCES.includes(d.audience)) setAudience(d.audience);
      setNote(null);
    } catch {
      setNote("No saved draft in this browser.");
    }
  }

  const html = useMemo(
    () => emailHtml({ bodyHtml: renderBody(personalize(body, previewName)), mailingAddress: mailingAddress || "Your mailing address" }),
    [body, previewName, mailingAddress]
  );
  const count = counts[audience] ?? 0;
  const input = { subject, body, audience, sendEmail, showInApp, bannerText, bannerDays: Number(bannerDays) };

  function applyPreset(p: Preset) {
    setSubject(p.subject);
    setBody(p.body);
    setBannerText(p.banner);
    setNote(null);
    setError(null);
  }

  return (
    <Card>
      <CardHeader
        title="New message"
        description="Write it once: email it to an audience, show it as a banner in the app, or both."
        className="mb-2"
      />
      <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {presets.map((p) => (
          <button key={p.label} type="button" className="pr-link text-sm" onClick={() => applyPreset(p)}>
            Start from: {p.label}
          </button>
        ))}
        <button type="button" className="pr-link text-sm" onClick={restoreDraft}>
          Restore last draft
        </button>
      </p>
      <div className="grid gap-4">
        <Field label="Subject">
          <TextInput
            id="msg-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              keep({ subject: e.target.value });
            }}
            maxLength={150}
          />
        </Field>
        <Field
          label="Message"
          hint="{{first_name}} becomes each driver's first name. A blank line starts a new paragraph. Lines starting with - make a list. **bold** for bold. Paste links as https://…"
        >
          <textarea
            id="msg-body"
            className="pr-control min-h-[16rem] font-[var(--font-inter)]"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              keep({ body: e.target.value });
            }}
            maxLength={20000}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who gets it">
            <SelectInput
              id="msg-audience"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                keep({ audience: e.target.value as Audience });
              }}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]} ({counts[a] ?? 0})
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input id="msg-email" type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              Email it
            </label>
            <label className="flex items-center gap-2">
              <input
                id="msg-banner"
                type="checkbox"
                checked={showInApp}
                onChange={(e) => {
                  setShowInApp(e.target.checked);
                  if (e.target.checked && !bannerText) setBannerText(defaultBanner(body));
                }}
              />
              Also show it in the app, as a banner every signed-in driver sees
            </label>
          </div>
        </div>
        {showInApp && (
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Field label={`Banner text (${bannerText.length}/${MAX_BANNER})`}>
              <TextInput id="msg-banner-text" value={bannerText} onChange={(e) => setBannerText(e.target.value)} maxLength={MAX_BANNER} />
            </Field>
            <Field label="Show for">
              <div className="flex items-center gap-2">
                <TextInput id="msg-banner-days" value={bannerDays} onChange={(e) => setBannerDays(e.target.value)} inputMode="numeric" maxLength={2} />
                <span className="text-sm text-muted">days</span>
              </div>
            </Field>
          </div>
        )}

        {preview && (
          <iframe
            title="Email preview"
            srcDoc={html}
            sandbox=""
            className="h-[560px] w-full rounded-[var(--pr-radius-input)] border border-border bg-[var(--pr-paper)]"
          />
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {note && <Notice>{note}</Notice>}

        {!confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setPreview((p) => !p)}>
              {preview ? "Hide preview" : "Preview email"}
            </Button>
            <Button
              variant="secondary"
              pending={pending}
              disabled={!ready}
              onClick={() =>
                start(async () => {
                  setError(null);
                  setNote(null);
                  const r = await sendTestAction(input);
                  if (!r.ok) setError(r.error);
                  else setNote(`Test sent to ${r.to}. Check how it looks before sending.`);
                })
              }
            >
              Send test to me
            </Button>
            <Button
              variant="dark"
              disabled={(sendEmail && (!ready || count === 0)) || (!sendEmail && !showInApp)}
              onClick={() => {
                setError(null);
                setNote(null);
                setConfirming(true);
              }}
            >
              {sendEmail ? `Send to ${count} driver${count === 1 ? "" : "s"}…` : "Show banner…"}
            </Button>
          </div>
        ) : (
          <Notice title="Ready to send?">
            <p>
              {sendEmail ? `Email "${subject || "(no subject)"}" to ${count} driver${count === 1 ? "" : "s"} (${AUDIENCE_LABEL[audience]}).` : ""}
              {showInApp ? ` Show the banner to every signed-in driver for ${bannerDays} days.` : ""} This can&apos;t be undone.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                variant="primary"
                pending={pending}
                onClick={() =>
                  start(async () => {
                    const r = await sendCampaignAction(input);
                    setConfirming(false);
                    if (!r.ok) return setError(r.error);
                    setNote(
                      [
                        sendEmail ? `Sent to ${r.sent}.` : "",
                        r.skipped ? `${r.skipped} skipped (unsubscribed or bounced before).` : "",
                        r.failed ? `${r.failed} failed — see History.` : "",
                        r.banner ? "The banner is showing." : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    );
                    try {
                      localStorage.removeItem(DRAFT_KEY);
                    } catch {
                      // fine
                    }
                  })
                }
              >
                {sendEmail ? "Yes, send it" : "Yes, show it"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </div>
          </Notice>
        )}
        {!ready && sendEmail && (
          <p className="text-xs text-muted">Sending is off until the setup above is done. You can still preview and show a banner.</p>
        )}
      </div>
    </Card>
  );
}

/** Sender name, reply-to and the mailing address the law requires on bulk email. */
export function SenderSettingsForm({
  initial,
}: {
  initial: { from_name: string; reply_to: string; mailing_address: string };
}) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Sender settings" description="How every announcement is signed. The mailing address goes in the footer — the law requires it on bulk email." />
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveMessageSettingsAction(s);
            setMsg(r.ok ? "Saved" : r.error);
          });
        }}
      >
        <Field label="Sender name">
          <TextInput id="sender-name" value={s.from_name} onChange={(e) => setS({ ...s, from_name: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Replies go to" hint="Your own inbox.">
          <TextInput id="sender-reply" type="email" value={s.reply_to} onChange={(e) => setS({ ...s, reply_to: e.target.value })} maxLength={200} />
        </Field>
        <Field label="Business mailing address" className="sm:col-span-2">
          <textarea
            id="sender-address"
            className="pr-control min-h-[4.5rem]"
            value={s.mailing_address}
            onChange={(e) => setS({ ...s, mailing_address: e.target.value })}
            maxLength={300}
          />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="dark" pending={pending}>
            Save sender settings
          </Button>
          {msg && <span className={`text-sm ${msg === "Saved" ? "font-semibold text-[var(--pr-rig-green)]" : "text-[var(--pr-loss-deep)]"}`}>{msg}</span>}
        </div>
      </form>
    </Card>
  );
}

export function EndBannerButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="text-sm text-muted">Taken down</span>;
  return (
    <button
      type="button"
      className="pr-link pr-hit text-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await endAnnouncementAction(id);
          if (r.ok) setDone(true);
        })
      }
    >
      Take down
    </button>
  );
}

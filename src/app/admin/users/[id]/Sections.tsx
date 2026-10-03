import type { ReactNode } from "react";

/**
 * The plain building blocks of the Admin driver page: a list of labelled
 * values, a table, and a list of things worth a look. Layout only — every
 * figure arrives formatted by the page.
 */

export function KeyValues({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="pr-record-label">{label}</dt>
          <dd className="mt-0.5 break-words text-sm">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export type Column = { key: string; label: string; align?: "right" };

export function DataTable({
  caption,
  columns,
  rows,
  empty = "Nothing entered.",
}: {
  caption: string;
  columns: Column[];
  rows: (Record<string, ReactNode> & { _key: string; _id?: string; _highlight?: boolean })[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`pr-record-label whitespace-nowrap py-2 pr-4 ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r._key}
              id={r._id}
              className={`scroll-mt-24 border-b border-border align-top last:border-0 ${r._highlight ? "bg-pr-surface-muted" : ""}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`py-2 pr-4 ${c.align === "right" ? "whitespace-nowrap text-right tabular-nums" : ""}`}
                >
                  {r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Flags, each with an optional link to where it is. */
export function CheckList({ items }: { items: { text: string; href?: string; where?: string }[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Nothing stands out.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((c, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true" className="text-[var(--pr-loss-deep)]">●</span>
          <span>
            {c.where && <span className="font-semibold">{c.where}: </span>}
            {c.href ? (
              <a href={c.href} className="pr-link">
                {c.text}
              </a>
            ) : (
              c.text
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

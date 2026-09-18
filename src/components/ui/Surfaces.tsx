import type { ElementType, HTMLAttributes, ReactNode } from "react";

/**
 * The white working surfaces around ProfitRig's financial instruments
 * (design system §8, §10; component board 03–04).
 *
 * The order of emphasis on every screen is
 *   financial instrument → page / section title → working content → support
 * so these stay quiet: white, a hairline border, 14px corners, no shadow,
 * Satoshi titles in Rig Green and Inter copy in the muted text colour.
 *
 *   PageHeader      the one H1 on a page, with an optional eyebrow,
 *                   description and a control on the right
 *   Card            a white section: 16px padding on a phone, 20px on a
 *                   tablet, 24px on a desktop
 *   CardHeader      a card's title (h2), description and optional aside
 *   SectionHeading  a heading that groups several cards
 *   EmptyState      what is missing, and what to do next if the page says so
 *
 * Inner rows and empty states use --pr-surface-muted (Off White) instead of
 * a stray Tailwind grey.
 */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Back link, year picker — shown to the right of the title. */
  action?: ReactNode;
}) {
  // A grid rather than nested rows: the description can then run the full
  // width under the title while the control stays top-right, and the page
  // still reads title → description → control.
  return (
    <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 lg:mb-6">
      <div className="col-start-1 row-start-1 min-w-0">
        {eyebrow && (
          <p className="mb-1 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.01em] text-[var(--pr-rig-green)] lg:text-[34px]">
          {title}
        </h1>
      </div>
      {description && (
        <p className="col-span-2 row-start-2 mt-2 max-w-[68ch] text-sm leading-snug text-muted">
          {description}
        </p>
      )}
      {action && (
        <div className="col-start-2 row-start-1 shrink-0">{action}</div>
      )}
    </header>
  );
}

type CardProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function Card({
  as: Tag = "section",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={`rounded-[var(--pr-radius-card)] border border-border bg-white p-4 sm:p-5 lg:p-6 ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  eyebrow,
  title,
  description,
  aside,
  className = "mb-4",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Something that belongs beside the title: a total, a dismiss link. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-lg font-bold leading-snug text-[var(--pr-rig-green)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-snug text-muted">{description}</p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-[22px] font-bold leading-tight text-[var(--pr-rig-green)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 max-w-[68ch] text-sm leading-snug text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  className = "",
}: {
  /** What is absent. */
  title: ReactNode;
  /** What the user can do next — only when the page already says so. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--pr-radius-card)] border border-border bg-pr-surface-muted px-4 py-4 sm:px-5 sm:py-5 ${className}`}
    >
      <p className="font-display text-base font-bold leading-snug text-[var(--pr-rig-green)]">
        {title}
      </p>
      {children && (
        <p className="mt-1 text-sm leading-snug text-muted">{children}</p>
      )}
    </div>
  );
}

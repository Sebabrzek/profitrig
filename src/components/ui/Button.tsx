import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from "react";

/**
 * ProfitRig's actions (design system §12, component board 03). The styles
 * live in globals.css under "ACTIONS AND INPUTS".
 *
 *   primary      Profit Green. The one commit on a form: Save load, Update
 *                my costs, Save truck, Add week, Save profile.
 *   secondary    White with an outline. Prev / Next, Cancel, Later, an
 *                export range.
 *   dark         Rig Green. Emphasised but neutral — Ask ProfitRig, Open
 *                Calculator, apply a suggestion. It says "do this", not
 *                "this is good".
 *   destructive  Loss. Only for Delete.
 *
 * A form has one primary. Sizes: md is 48px (forms), lg 52px (a page's
 * main action), sm 44px — the smallest touch target ProfitRig uses.
 */
export type ButtonVariant = "primary" | "secondary" | "dark" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type Look = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. For forms and phones — never a desktop default. */
  block?: boolean;
};

export function buttonClass(
  { variant = "secondary", size = "md", block = false }: Look = {},
  className = ""
) {
  return [
    "pr-btn",
    `pr-btn-${variant}`,
    size !== "md" && `pr-btn-${size}`,
    block && "pr-btn-block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  block,
  pending = false,
  disabled,
  className,
  type = "button",
  ...rest
}: Look &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Saving, sending, opening: keeps its colour, can't be pressed twice. */
    pending?: boolean;
  }) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClass({ variant, size, block }, className)}
      {...rest}
    />
  );
}

/** A link that looks like a button — it goes somewhere rather than doing. */
export function ButtonLink({
  variant,
  size,
  block,
  disabled = false,
  className,
  children,
  ...rest
}: Look &
  ComponentProps<typeof Link> & {
    disabled?: boolean;
    children: ReactNode;
  }) {
  return (
    <Link
      aria-disabled={disabled || undefined}
      className={buttonClass({ variant, size, block }, className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

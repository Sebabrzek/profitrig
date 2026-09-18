"use client";

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  cleanDecimalText,
  decimalValueOf,
  fieldTextFor,
  resyncDecimalText,
  tidyDecimalText,
} from "@/lib/numericInput";

/**
 * ProfitRig's form fields (design system §11, component board 03). The
 * styles live in globals.css under "ACTIONS AND INPUTS".
 *
 *   Field        a visible label above, optional helper text, the control
 *   TextInput    text, phone, date — any single-line input
 *   SelectInput  a native select
 *   TextArea     a note
 *   AffixInput   an input with a quiet "$" before or a unit after
 *   NumberField  ProfitRig's decimal field (money, miles, MPG, %)
 *
 * Every control is 48px, white, outlined in --pr-border-strong, Inter at
 * 16px, and outlined in Profit Green while focused.
 */

const cx = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  /** Helper text, under the label and above the control. */
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("pr-field", className)}>
      <span className="pr-field-label">{label}</span>
      {hint && <span className="pr-field-hint">{hint}</span>}
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("pr-control", className)} {...rest} />;
}

export function SelectInput({
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("pr-control", className)} {...rest} />;
}

export function TextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("pr-control", className)} {...rest} />;
}

/** A tap on the "$" or the unit lands in the field, as it always has. */
function focusInput(e: MouseEvent<HTMLElement>) {
  const input = e.currentTarget.querySelector("input");
  if (input && e.target !== input) input.focus();
}

export function AffixInput({
  prefix,
  suffix,
  numeric = false,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string;
  suffix?: string;
  /** Medium weight and even digit widths, for a number being typed. */
  numeric?: boolean;
}) {
  return (
    <span
      className={cx(
        "pr-control pr-control-affixed",
        numeric && "pr-control-numeric",
        className
      )}
      onClick={focusInput}
    >
      {prefix && <span className="pr-affix">{prefix}</span>}
      <input {...rest} />
      {suffix && <span className="pr-affix">{suffix}</span>}
    </span>
  );
}

/**
 * The decimal field used for money, miles, MPG and percentages. It keeps
 * the driver's own text while they type and reports the number on every
 * keystroke; every rule is in src/lib/numericInput.ts and tested there.
 * Zero shows as an empty field.
 */
export function NumberField({
  value,
  onChange,
  prefix,
  suffix,
  id,
  "aria-describedby": describedBy,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState(() => fieldTextFor(value));
  // The number this field last reported or was given. A change to `value`
  // that isn't this one came from outside (a snapshot loaded) and resyncs
  // the text; the driver's own typing never does.
  const lastSeen = useRef(value);

  useEffect(() => {
    const next = resyncDecimalText(value, lastSeen.current, text);
    if (next === null) return;
    if (next !== text) setText(next);
    lastSeen.current = value;
  }, [value, text]);

  return (
    <AffixInput
      id={id}
      aria-describedby={describedBy}
      prefix={prefix}
      suffix={suffix}
      numeric
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const next = cleanDecimalText(e.target.value);
        setText(next);
        const v = decimalValueOf(next);
        lastSeen.current = v;
        onChange(v);
      }}
      onBlur={() => {
        const tidy = tidyDecimalText(text);
        if (tidy !== text) setText(tidy);
      }}
    />
  );
}

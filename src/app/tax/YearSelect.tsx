"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function YearSelect({ taxYear, years }: { taxYear: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="year" className="text-muted">
        Year
      </label>
      <select
        id="year"
        name="year"
        defaultValue={taxYear}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("year", e.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="h-9 px-3 rounded-lg border border-border bg-white text-sm font-semibold"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

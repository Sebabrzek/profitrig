"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SelectInput } from "@/components/ui/Field";

export function YearSelect({ taxYear, years }: { taxYear: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="year" className="text-muted">
        Year
      </label>
      <SelectInput
        id="year"
        name="year"
        defaultValue={taxYear}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("year", e.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="h-11 w-auto pl-3 pr-2 font-semibold"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}

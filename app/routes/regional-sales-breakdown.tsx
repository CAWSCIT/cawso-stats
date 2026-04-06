import { useState, useMemo } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/regional-sales-breakdown";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Regional Sales Breakdown" },
    { name: "description", content: "Geographic breakdown of sales by region" },
  ];
}

interface QuarterOption {
  year: number;
  quarter: number;
  label: string;
  startDate: string;
  endDate: string;
}

function getQuarterDates(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, endMonth, 1));
  return {
    startDate: start.toISOString().replace(".000Z", "Z"),
    endDate: end.toISOString().replace(".000Z", "Z"),
  };
}

function getAvailableQuarters(): QuarterOption[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const minYear = 2025;
  const minQuarter = 2;

  const options: QuarterOption[] = [];

  for (let year = minYear; year <= currentYear; year++) {
    const startQ = year === minYear ? minQuarter : 1;
    const endQ = year === currentYear ? currentQuarter - 1 : 4;

    for (let q = startQ; q <= endQ; q++) {
      const { startDate, endDate } = getQuarterDates(year, q);
      options.push({
        year,
        quarter: q,
        label: `Q${q} ${year}`,
        startDate,
        endDate,
      });
    }
  }

  return options;
}

function buildQuery(option: QuarterOption): string {
  return `processed_at:>=${option.startDate} processed_at:<${option.endDate}`;
}

export default function RegionalSalesBreakdown() {
  const quarters = useMemo(() => getAvailableQuarters(), []);
  const availableYears = useMemo(
    () => [...new Set(quarters.map((q) => q.year))],
    [quarters]
  );

  const [selectedYear, setSelectedYear] = useState(
    quarters[quarters.length - 1]?.year ?? availableYears[0]
  );
  const [selectedQuarter, setSelectedQuarter] = useState(
    quarters[quarters.length - 1]?.quarter ?? 1
  );

  const quartersForYear = useMemo(
    () => quarters.filter((q) => q.year === selectedYear),
    [quarters, selectedYear]
  );

  const selectedOption = useMemo(
    () =>
      quarters.find(
        (q) => q.year === selectedYear && q.quarter === selectedQuarter
      ) ?? null,
    [quarters, selectedYear, selectedQuarter]
  );

  const query = selectedOption ? buildQuery(selectedOption) : "";

  function handleYearChange(year: number) {
    setSelectedYear(year);
    const available = quarters.filter((q) => q.year === year);
    if (!available.find((q) => q.quarter === selectedQuarter)) {
      setSelectedQuarter(available[available.length - 1]?.quarter ?? 1);
    }
  }

  function handleGetReport() {
    // TODO: make API request with query
    console.log("Query:", query);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Regional Sales Breakdown
        </h1>
      </div>

      <div className="flex items-end gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quarter
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {quartersForYear.map((q) => (
              <option key={q.quarter} value={q.quarter}>
                Q{q.quarter}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGetReport}
          disabled={!selectedOption}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Get Report
        </button>
      </div>

      {selectedOption && (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          {query}
        </p>
      )}
    </div>
  );
}

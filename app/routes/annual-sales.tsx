import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Route } from "./+types/annual-sales";
import { useShopSession } from "../shop-context";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Annual Sales by Month" },
    { name: "description", content: "Monthly sales over the past 12 months" },
  ];
}

const GRAPHQL_PROXY =
  "https://throbbing-frog-a6d8.kalob-taulien.workers.dev/graphql";

const SALES_QUERY = `query {
  shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -1y ORDER BY month") {
    tableData {
      columns {
        name
        dataType
        displayName
      }
      rows
    }
    parseErrors
  }
}`;

interface SalesRow {
  month: string;
  label: string;
  totalSales: number;
}

function parseSalesData(data: {
  shopifyqlQuery: {
    tableData: {
      rows: { month: string; total_sales: string }[];
    };
  };
}): SalesRow[] {
  return data.shopifyqlQuery.tableData.rows.map((row) => {
    const date = new Date(row.month + "T00:00:00");
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    return {
      month: row.month,
      label,
      totalSales: parseFloat(row.total_sales),
    };
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

// Module-level cache so data persists across route navigations
let cachedRows: SalesRow[] | null = null;

function useSalesData() {
  const { session } = useShopSession();
  const [rows, setRows] = useState<SalesRow[]>(cachedRows ?? []);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(cachedRows !== null);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  const loadSales = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(GRAPHQL_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: session.shop,
          access_token: session.accessToken,
          query: SALES_QUERY,
        }),
      });
      const json = await res.json();

      if (json.errors) {
        throw new Error(
          json.errors.map((e: { message: string }) => e.message).join(", ")
        );
      }

      const parseErrors = json.data?.shopifyqlQuery?.parseErrors;
      if (parseErrors?.length) {
        throw new Error(parseErrors.join(", "));
      }

      const parsed = parseSalesData(json.data);
      cachedRows = parsed;
      setRows(parsed);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && !loaded && !hasRun.current) {
      hasRun.current = true;
      loadSales();
    }
  }, [session, loaded, loadSales]);

  return { rows, loading, loaded, error };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export default function AnnualSales() {
  const { rows, loading, loaded, error } = useSalesData();

  if (!loaded) {
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
            Annual Sales by Month
          </h1>
        </div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            Loading sales data...
          </p>
        )}
      </div>
    );
  }

  const total = rows.reduce((sum, r) => sum + r.totalSales, 0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            &larr; Back
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Annual Sales by Month
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          12-month total: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(total)}</span>
        </p>
      </div>

      {/* Line Chart */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="totalSales"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: "#2563eb" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Month
              </th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Total Sales
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr
                key={row.month}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {row.label}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(row.totalSales)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

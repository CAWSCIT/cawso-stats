import { Link } from "react-router";
import type { Route } from "./+types/regional-sales-breakdown";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Regional Sales Breakdown" },
    { name: "description", content: "Geographic breakdown of sales by region" },
  ];
}

export default function RegionalSalesBreakdown() {
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
      <p className="text-gray-500 dark:text-gray-400">
        Coming soon.
      </p>
    </div>
  );
}

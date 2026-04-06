import type { Route } from "./+types/regional-sales-breakdown";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Regional Sales Breakdown - CAWSO Stats" },
    { name: "description", content: "Regional sales breakdown by geocoordinate" },
  ];
}

export default function RegionalSalesBreakdown() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Regional Sales Breakdown
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Coming soon.
      </p>
    </main>
  );
}

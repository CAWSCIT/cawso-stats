import { Link, useParams } from "react-router";
import type { Route } from "./+types/collection-breakdown-detail";
import {
  CollectionSalesView,
  useCollectionSales,
} from "../collection-sales";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Collection Breakdown" },
    {
      name: "description",
      content: "Per-product sales and discounts for a Shopify collection",
    },
  ];
}

export default function CollectionBreakdownDetail() {
  const params = useParams();
  const rawId = params.collectionId ?? "";
  const { totals, loading, progress, error, reload } = useCollectionSales(rawId);

  const heading = totals?.collectionTitle
    ? `${totals.collectionTitle} — Sales & Discounts`
    : "Collection Breakdown";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/collection-breakdown"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors shrink-0"
          >
            &larr; Collections
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white truncate">
            {heading}
          </h1>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <CollectionSalesView
        totals={totals}
        loading={loading}
        progress={progress}
        error={error}
      />
    </div>
  );
}

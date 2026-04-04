import { Link } from "react-router";
import type { Route } from "./+types/home";
import { useShopSession } from "../shop-context";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CAWSO Stats" },
    { name: "description", content: "CAWSO Shopify Stats Dashboard" },
  ];
}

export default function Home() {
  const { session, loading, error } = useShopSession();

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        CAWSO Stats
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Welcome to the CAWSO Shopify inventory dashboard.
      </p>

      {loading && (
        <p className="text-gray-500 dark:text-gray-400">Authenticating...</p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-6">
          <p className="text-sm text-red-700 dark:text-red-400">
            Authentication failed: {error}
          </p>
        </div>
      )}

      {session && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connected to <span className="font-medium text-gray-900 dark:text-white">{session.shop}</span>
            </p>
          </div>

          <nav>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/inventory-report"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Inventory Report
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </main>
  );
}

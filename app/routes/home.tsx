import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { useShopSession } from "../shop-context";

const SEND_TEST_EMAIL_ENDPOINT = "https://cawso-stats.dal04.workers.dev/send-test-email";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CAWSO Stats" },
    { name: "description", content: "CAWSO Shopify Stats Dashboard" },
  ];
}

export default function Home() {
  const { session, loading, error } = useShopSession();
  const [emailStatus, setEmailStatus] = useState<
    | { state: "idle" }
    | { state: "sending" }
    | { state: "success"; id?: string }
    | { state: "error"; message: string }
  >({ state: "idle" });

  async function handleSendTestEmail() {
    setEmailStatus({ state: "sending" });
    try {
      const res = await fetch(SEND_TEST_EMAIL_ENDPOINT, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setEmailStatus({
          state: "error",
          message: data?.error?.message || data?.message || `HTTP ${res.status}`,
        });
        return;
      }
      setEmailStatus({ state: "success", id: data?.id });
    } catch (err) {
      setEmailStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        CAWSO Stats
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Welcome to the CAWSO Shopify inventory dashboard. Let the DAL know if you need custom reports that can't be generated via Shopify's reports or other apps.
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
              <li>
                <Link
                  to="/annual-sales"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Annual Sales by Month
                </Link>
              </li>
              <li>
                <Link
                  to="/regional-sales-breakdown"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Regional Sales Breakdown
                </Link>
              </li>
              <li>
                <Link
                  to="/speciality-items"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Speciality Items
                </Link>
              </li>
            </ul>
          </nav>

          {isLocalhost && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div>
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Test email
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sends a test message to kalob.taulien@gmail.com via Resend.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={emailStatus.state === "sending"}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {emailStatus.state === "sending" ? "Sending..." : "Send Test Email"}
            </button>
            {emailStatus.state === "success" && (
              <p className="text-sm text-green-700 dark:text-green-400">
                Email sent{emailStatus.id ? ` (id: ${emailStatus.id})` : ""}.
              </p>
            )}
            {emailStatus.state === "error" && (
              <p className="text-sm text-red-700 dark:text-red-400">
                Failed to send: {emailStatus.message}
              </p>
            )}
          </div>
          )}
        </div>
      )}
    </main>
  );
}

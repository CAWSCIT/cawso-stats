import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/speciality-items";
import { useShopSession } from "../shop-context";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Speciality Items" },
    { name: "description", content: "Orders containing speciality medallion items" },
  ];
}

const GRAPHQL_PROXY = "https://cawso-stats.dal04.workers.dev/graphql";

const SPECIALITY_COLLECTION_ID = "gid://shopify/Collection/452293460201";

const SPECIALITY_QUERY = `query getSpecialityMedallions {
  orders(first: 250, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id
      name
      createdAt
      customer {
        displayName
        addresses {
          formatted
        }
      }
      lineItems(first: 100) {
        nodes {
          product {
            id
            collections(first: 10) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  }
}`;

interface OrderNode {
  id: string;
  name: string;
  createdAt: string;
  customer: {
    displayName: string | null;
    addresses: { formatted: string[] }[];
  } | null;
  lineItems: {
    nodes: {
      product: {
        id: string;
        collections: { nodes: { id: string }[] };
      } | null;
    }[];
  };
}

interface SpecialityOrder {
  id: string;
  name: string;
  createdAt: string;
  customerName: string;
  address: string;
}

function parseAddress(addr: string[] | undefined): string {
  if (!addr || addr.length === 0) return "";
  return addr.join(", ");
}

function parseSpecialityOrders(nodes: OrderNode[]): SpecialityOrder[] {
  return nodes
    .filter((order) =>
      order.lineItems.nodes.some((li) =>
        li.product?.collections.nodes.some(
          (c) => c.id === SPECIALITY_COLLECTION_ID
        )
      )
    )
    .map((order) => {
      const firstAddress = order.customer?.addresses?.[0]?.formatted;
      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        customerName: order.customer?.displayName ?? "—",
        address: parseAddress(firstAddress),
      };
    });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

let cachedOrders: SpecialityOrder[] | null = null;

function useSpecialityData() {
  const { session } = useShopSession();
  const [orders, setOrders] = useState<SpecialityOrder[]>(cachedOrders ?? []);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(cachedOrders !== null);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  const load = useCallback(async () => {
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
          query: SPECIALITY_QUERY,
        }),
      });
      const json = await res.json();

      if (json.errors) {
        throw new Error(
          json.errors.map((e: { message: string }) => e.message).join(", ")
        );
      }

      const parsed = parseSpecialityOrders(json.data?.orders?.nodes ?? []);
      cachedOrders = parsed;
      setOrders(parsed);
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
      load();
    }
  }, [session, loaded, load]);

  return { orders, loading, loaded, error };
}

function orderIdFromGid(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export default function SpecialityItems() {
  const { session } = useShopSession();
  const { orders, loaded, error } = useSpecialityData();

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
            Speciality Items
          </h1>
        </div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">Loading orders...</p>
        )}
      </div>
    );
  }

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
            Speciality Items
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No recent orders contain speciality items.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {session ? (
                      <a
                        href={`https://${session.shop}/admin/orders/${orderIdFromGid(order.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      >
                        {order.name}
                      </a>
                    ) : (
                      order.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {order.customerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {order.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

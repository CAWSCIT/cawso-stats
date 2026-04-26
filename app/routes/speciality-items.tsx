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

function buildOrderDetailsQuery(orderGid: string): string {
  const escaped = orderGid.replace(/"/g, '\\"');
  return `query getSpecialityOrderByGID {
    order(id: "${escaped}") {
      id
      name
      createdAt
      shippingAddress {
        name
        formatted
      }
      lineItems(first: 100) {
        nodes {
          id
          name
          quantity
          sku
          product {
            collections(first: 5) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  }`;
}

interface OrderDetailsResponse {
  id: string;
  name: string;
  createdAt: string;
  shippingAddress: {
    name: string | null;
    formatted: string[];
  } | null;
  lineItems: {
    nodes: {
      id: string;
      name: string;
      quantity: number;
      sku: string | null;
      product: {
        collections: { nodes: { id: string }[] };
      } | null;
    }[];
  };
}

interface OrderDetailsView {
  id: string;
  name: string;
  createdAt: string;
  shippingName: string;
  shippingAddress: string[];
  items: { id: string; name: string; quantity: number; sku: string | null }[];
}

function parseOrderDetails(order: OrderDetailsResponse): OrderDetailsView {
  const items = order.lineItems.nodes
    .filter((li) =>
      li.product?.collections.nodes.some(
        (c) => c.id === SPECIALITY_COLLECTION_ID
      )
    )
    .map((li) => ({
      id: li.id,
      name: li.name,
      quantity: li.quantity,
      sku: li.sku,
    }));

  return {
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    shippingName: order.shippingAddress?.name ?? "",
    shippingAddress: order.shippingAddress?.formatted ?? [],
    items,
  };
}

type DetailsState =
  | { state: "closed" }
  | { state: "loading"; orderId: string }
  | { state: "loaded"; data: OrderDetailsView }
  | { state: "error"; message: string };

export default function SpecialityItems() {
  const { session } = useShopSession();
  const { orders, loaded, error } = useSpecialityData();
  const [details, setDetails] = useState<DetailsState>({ state: "closed" });

  const openDetails = useCallback(
    async (orderGid: string) => {
      if (!session) return;
      setDetails({ state: "loading", orderId: orderGid });
      try {
        const res = await fetch(GRAPHQL_PROXY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: session.shop,
            access_token: session.accessToken,
            query: buildOrderDetailsQuery(orderGid),
          }),
        });
        const json = await res.json();
        if (json.errors) {
          throw new Error(
            json.errors.map((e: { message: string }) => e.message).join(", ")
          );
        }
        if (!json.data?.order) {
          throw new Error("Order not found");
        }
        setDetails({
          state: "loaded",
          data: parseOrderDetails(json.data.order),
        });
      } catch (err) {
        setDetails({
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [session]
  );

  const closeDetails = useCallback(() => setDetails({ state: "closed" }), []);

  useEffect(() => {
    if (details.state === "closed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDetails();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [details.state, closeDetails]);

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
                      onClick={() => openDetails(order.id)}
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

      {details.state !== "closed" && (
        <DetailsModal state={details} onClose={closeDetails} />
      )}
    </div>
  );
}

const SEND_MANUFACTURER_EMAIL_ENDPOINT =
  "https://cawso-stats.dal04.workers.dev/send-manufacturer-email";

type SendStatus =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "success" }
  | { state: "error"; message: string };

function DetailsModal({
  state,
  onClose,
}: {
  state: Exclude<DetailsState, { state: "closed" }>;
  onClose: () => void;
}) {
  const [sendStatus, setSendStatus] = useState<SendStatus>({ state: "idle" });

  async function handleSend() {
    if (state.state !== "loaded") return;
    setSendStatus({ state: "sending" });
    try {
      const res = await fetch(SEND_MANUFACTURER_EMAIL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderName: state.data.name,
          items: state.data.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            sku: i.sku,
          })),
          shippingName: state.data.shippingName,
          shippingAddress: state.data.shippingAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendStatus({
          state: "error",
          message: data?.error?.message || data?.message || `HTTP ${res.status}`,
        });
        return;
      }
      setSendStatus({ state: "success" });
    } catch (err) {
      setSendStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const sendDisabled =
    state.state !== "loaded" ||
    sendStatus.state === "sending" ||
    sendStatus.state === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {state.state === "loaded"
              ? `Order ${state.data.name}`
              : "Order details"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors -mr-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L8.94 10l-5.72 5.72a.75.75 0 1 0 1.06 1.06L10 11.06l5.72 5.72a.75.75 0 1 0 1.06-1.06L11.06 10l5.72-5.72a.75.75 0 0 0-1.06-1.06L10 8.94 4.28 3.22Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {state.state === "loading" && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading order...
            </p>
          )}

          {state.state === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                {state.message}
              </p>
            </div>
          )}

          {state.state === "loaded" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Placed
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(state.data.createdAt)}
                </p>
              </div>

              {(state.data.shippingName || state.data.shippingAddress.length > 0) && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Ship to
                  </p>
                  {state.data.shippingName && (
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {state.data.shippingName}
                    </p>
                  )}
                  {state.data.shippingAddress.map((line, i) => (
                    <p
                      key={i}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Speciality items ({state.data.items.length})
                </p>
                {state.data.items.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No speciality items on this order.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md">
                    {state.data.items.map((item) => (
                      <li
                        key={item.id}
                        className="px-3 py-2 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {item.name}
                          </p>
                          {item.sku && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {item.sku}
                            </p>
                          )}
                        </div>
                        <p className="text-sm tabular-nums text-gray-700 dark:text-gray-300 shrink-0">
                          × {item.quantity}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDisabled}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendStatus.state === "sending"
              ? "Sending..."
              : sendStatus.state === "success"
                ? "Email sent"
                : "Send email to manufacturer"}
          </button>
          {sendStatus.state === "error" && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Failed to send: {sendStatus.message}
            </p>
          )}
          {sendStatus.state === "success" && (
            <p className="text-xs text-green-700 dark:text-green-400">
              Email delivered to wendells@ca.org.
            </p>
          )}
          {sendStatus.state !== "error" && sendStatus.state !== "success" && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              When you send this email to the manufacturer, it will email them along with ast.mgr@ca.org
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

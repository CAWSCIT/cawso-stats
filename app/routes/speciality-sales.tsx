import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/speciality-sales";
import { useShopSession } from "../shop-context";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Specialty Medallion Sales & Discounts" },
    {
      name: "description",
      content: "Total quantity and dollar value sold of speciality items",
    },
  ];
}

const GRAPHQL_PROXY = "https://cawso-stats.dal04.workers.dev/graphql";
const SPECIALITY_COLLECTION_ID = "gid://shopify/Collection/452293460201";

const COLLECTION_PRODUCTS_QUERY = `query getSpecialityCollectionProducts {
  collection(id: "${SPECIALITY_COLLECTION_ID}") {
    products(first: 250) {
      nodes {
        id
        title
      }
    }
  }
}`;

function buildOrdersPageQuery(after: string | null): string {
  const afterArg = after ? `, after: "${after}"` : "";
  return `query getOrdersPage {
    orders(first: 200, sortKey: CREATED_AT, reverse: true${afterArg}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        lineItems(first: 200) {
          nodes {
            quantity
            originalTotalSet {
              shopMoney {
                amount
              }
            }
            discountedTotalSet {
              shopMoney {
                amount
              }
            }
            discountAllocations {
              allocatedAmountSet {
                shopMoney {
                  amount
                }
              }
            }
            product {
              id
            }
          }
        }
      }
    }
  }`;
}

interface CollectionProduct {
  id: string;
  title: string;
}

interface OrderLineItem {
  quantity: number;
  originalTotalSet: { shopMoney: { amount: string } };
  discountedTotalSet: { shopMoney: { amount: string } };
  discountAllocations: {
    allocatedAmountSet: { shopMoney: { amount: string } };
  }[];
  product: { id: string } | null;
}

interface OrderNode {
  id: string;
  name: string;
  lineItems: { nodes: OrderLineItem[] };
}

interface ProductTotal {
  id: string;
  title: string;
  quantity: number;
  amount: number;
  discount: number;
}

interface SalesTotals {
  totalQuantity: number;
  totalAmount: number;
  totalDiscount: number;
  ordersScanned: number;
  ordersWithSpeciality: number;
  perProduct: ProductTotal[];
  collectionProducts: CollectionProduct[];
}

// Shopify usually returns `errors` as `[{ message }]`, but in some cases
// (throttling, network/proxy errors) it's a string or a single object. The
// Cloudflare worker also returns `{ error: "..." }` for its own failures.
// Normalize all of these into a single string.
function extractGraphqlErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  if (Array.isArray(obj.errors)) {
    if (obj.errors.length === 0) return null;
    return obj.errors
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object" && "message" in e) {
          return String((e as { message: unknown }).message);
        }
        return JSON.stringify(e);
      })
      .join(", ");
  }

  if (typeof obj.errors === "string") return obj.errors;
  if (obj.errors && typeof obj.errors === "object") {
    return JSON.stringify(obj.errors);
  }

  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object") {
    return JSON.stringify(obj.error);
  }

  return null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

// Safety cap so an unbounded loop can't run away if Shopify keeps returning pages.
const MAX_ORDER_PAGES = 100;

let cachedTotals: SalesTotals | null = null;

function useSpecialitySales() {
  const { session } = useShopSession();
  const [totals, setTotals] = useState<SalesTotals | null>(cachedTotals);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ pages: number; orders: number }>({
    pages: 0,
    orders: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    setProgress({ pages: 0, orders: 0 });

    try {
      // 1. Get the products in the speciality collection.
      const collectionRes = await fetch(GRAPHQL_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: session.shop,
          access_token: session.accessToken,
          query: COLLECTION_PRODUCTS_QUERY,
        }),
      });
      const collectionJson = await collectionRes.json();
      const collectionErr = extractGraphqlErrorMessage(collectionJson);
      if (collectionErr) {
        throw new Error(collectionErr);
      }
      const collectionProducts: CollectionProduct[] =
        collectionJson.data?.collection?.products?.nodes ?? [];
      const productIds = new Set(collectionProducts.map((p) => p.id));
      const productTitleById = new Map(
        collectionProducts.map((p) => [p.id, p.title])
      );

      // 2. Page through orders, summing matching line items as we go.
      const perProductMap = new Map<string, ProductTotal>();
      let totalQuantity = 0;
      let totalAmount = 0;
      let totalDiscount = 0;
      let ordersScanned = 0;
      let ordersWithSpeciality = 0;

      let after: string | null = null;
      let hasNextPage: boolean = true;
      let page = 0;

      while (hasNextPage && page < MAX_ORDER_PAGES) {
        page += 1;
        const ordersRes: Response = await fetch(GRAPHQL_PROXY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: session.shop,
            access_token: session.accessToken,
            query: buildOrdersPageQuery(after),
          }),
        });
        const ordersJson = await ordersRes.json();
        const ordersErr = extractGraphqlErrorMessage(ordersJson);
        if (ordersErr) {
          throw new Error(ordersErr);
        }

        const ordersData = ordersJson.data?.orders;
        const nodes: OrderNode[] = ordersData?.nodes ?? [];

        for (const order of nodes) {
          ordersScanned += 1;
          let orderHadMatch = false;
          for (const li of order.lineItems.nodes) {
            const pid = li.product?.id;
            if (!pid || !productIds.has(pid)) continue;
            orderHadMatch = true;
            const original = Number(li.originalTotalSet.shopMoney.amount) || 0;
            const discounted =
              Number(li.discountedTotalSet.shopMoney.amount) || 0;
            // Line-level discount + this line's slice of any order-level
            // discount (discountAllocations covers shipping-excluded order
            // discounts allocated to this line).
            const orderLevelDiscount = li.discountAllocations.reduce(
              (sum, a) =>
                sum + (Number(a.allocatedAmountSet.shopMoney.amount) || 0),
              0
            );
            const lineDiscount = original - discounted + orderLevelDiscount;
            totalQuantity += li.quantity;
            totalAmount += original;
            totalDiscount += lineDiscount;

            const existing = perProductMap.get(pid);
            if (existing) {
              existing.quantity += li.quantity;
              existing.amount += original;
              existing.discount += lineDiscount;
            } else {
              perProductMap.set(pid, {
                id: pid,
                title: productTitleById.get(pid) ?? pid,
                quantity: li.quantity,
                amount: original,
                discount: lineDiscount,
              });
            }
          }
          if (orderHadMatch) ordersWithSpeciality += 1;
        }

        setProgress({ pages: page, orders: ordersScanned });

        hasNextPage = ordersData?.pageInfo?.hasNextPage ?? false;
        after = ordersData?.pageInfo?.endCursor ?? null;
        if (!after) hasNextPage = false;
      }

      const perProduct = Array.from(perProductMap.values()).sort(
        (a, b) => b.amount - a.amount
      );

      const result: SalesTotals = {
        totalQuantity,
        totalAmount,
        totalDiscount,
        ordersScanned,
        ordersWithSpeciality,
        perProduct,
        collectionProducts,
      };

      cachedTotals = result;
      setTotals(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && !cachedTotals && !hasRun.current) {
      hasRun.current = true;
      load();
    }
  }, [session, load]);

  return { totals, loading, progress, error, reload: load };
}

export default function SpecialitySales() {
  const { totals, loading, progress, error, reload } = useSpecialitySales();

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
            Specialty Medallion Sales & Discounts
          </h1>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-6">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading && !totals && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Scanning orders... ({progress.orders} orders across {progress.pages}{" "}
          {progress.pages === 1 ? "page" : "pages"})
        </p>
      )}

      {totals && (
        <>
          {loading && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Refreshing... ({progress.orders} orders / {progress.pages} pages)
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total dollar value sold
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totals.totalAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total quantity sold
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {totals.totalQuantity.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total discounted (loss)
              </p>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totals.totalDiscount)}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Scanned {totals.ordersScanned.toLocaleString()} orders;{" "}
            {totals.ordersWithSpeciality.toLocaleString()} contained a
            speciality item. Collection has{" "}
            {totals.collectionProducts.length} products.
          </p>

          {totals.perProduct.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Discounted (loss)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {totals.perProduct.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {row.title}
                      </td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {row.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {formatCurrency(row.amount)}
                      </td>
                      <td
                        className={`px-4 py-2 text-sm text-right tabular-nums ${
                          row.discount > 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500 dark:text-gray-500"
                        }`}
                      >
                        {row.discount > 0
                          ? `-${formatCurrency(row.discount)}`
                          : formatCurrency(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-right tabular-nums text-gray-900 dark:text-gray-100">
                      {totals.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-right tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(totals.totalAmount)}
                    </td>
                    <td
                      className={`px-4 py-2 text-sm font-semibold text-right tabular-nums ${
                        totals.totalDiscount > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {totals.totalDiscount > 0
                        ? `-${formatCurrency(totals.totalDiscount)}`
                        : formatCurrency(0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

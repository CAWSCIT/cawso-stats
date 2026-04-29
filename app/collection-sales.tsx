import { useCallback, useEffect, useRef, useState } from "react";
import { useShopSession } from "./shop-context";

export const GRAPHQL_PROXY = "https://cawso-stats.dal04.workers.dev/graphql";

// Safety cap so an unbounded loop can't run away if Shopify keeps returning pages.
const MAX_ORDER_PAGES = 100;

export const COLLECTION_GID_PREFIX = "gid://shopify/Collection/";

export function toCollectionGid(idOrGid: string): string {
  if (idOrGid.startsWith(COLLECTION_GID_PREFIX)) return idOrGid;
  return `${COLLECTION_GID_PREFIX}${idOrGid}`;
}

export function collectionNumericId(gid: string): string {
  return gid.startsWith(COLLECTION_GID_PREFIX)
    ? gid.slice(COLLECTION_GID_PREFIX.length)
    : gid;
}

export interface CollectionProduct {
  id: string;
  title: string;
}

export interface ProductTotal {
  id: string;
  title: string;
  quantity: number;
  amount: number;
  discount: number;
}

export interface SalesTotals {
  collectionId: string;
  collectionTitle: string;
  totalQuantity: number;
  totalAmount: number;
  totalDiscount: number;
  ordersScanned: number;
  ordersWithMatch: number;
  perProduct: ProductTotal[];
  collectionProducts: CollectionProduct[];
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

function buildCollectionProductsQuery(collectionGid: string): string {
  return `query getCollectionProducts {
    collection(id: "${collectionGid}") {
      id
      title
      handle
      products(first: 250) {
        nodes {
          id
          title
        }
      }
    }
  }`;
}

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

// Shopify usually returns `errors` as `[{ message }]`, but in some cases
// (throttling, network/proxy errors) it's a string or a single object. The
// Cloudflare worker also returns `{ error: "..." }` for its own failures.
export function extractGraphqlErrorMessage(json: unknown): string | null {
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

export function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

// Module-level cache, keyed by collection GID, so navigating away and back
// doesn't re-scan thousands of orders.
const cache = new Map<string, SalesTotals>();

export interface UseCollectionSalesResult {
  totals: SalesTotals | null;
  loading: boolean;
  progress: { pages: number; orders: number };
  error: string | null;
  reload: () => Promise<void>;
}

export function useCollectionSales(
  collectionId: string
): UseCollectionSalesResult {
  const collectionGid = toCollectionGid(collectionId);
  const { session } = useShopSession();
  const [totals, setTotals] = useState<SalesTotals | null>(
    cache.get(collectionGid) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ pages: number; orders: number }>({
    pages: 0,
    orders: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const hasRunFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    setProgress({ pages: 0, orders: 0 });

    try {
      // 1. Get the products + title for this collection.
      const collectionRes = await fetch(GRAPHQL_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: session.shop,
          access_token: session.accessToken,
          query: buildCollectionProductsQuery(collectionGid),
        }),
      });
      const collectionJson = await collectionRes.json();
      const collectionErr = extractGraphqlErrorMessage(collectionJson);
      if (collectionErr) {
        throw new Error(collectionErr);
      }
      const collectionNode = collectionJson.data?.collection;
      if (!collectionNode) {
        throw new Error("Collection not found");
      }
      const collectionTitle: string = collectionNode.title ?? "Collection";
      const collectionProducts: CollectionProduct[] =
        collectionNode.products?.nodes ?? [];
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
      let ordersWithMatch = 0;

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
          if (orderHadMatch) ordersWithMatch += 1;
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
        collectionId: collectionGid,
        collectionTitle,
        totalQuantity,
        totalAmount,
        totalDiscount,
        ordersScanned,
        ordersWithMatch,
        perProduct,
        collectionProducts,
      };

      cache.set(collectionGid, result);
      setTotals(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [session, collectionGid]);

  useEffect(() => {
    // When the collection changes, swap in cached value (if any) and only
    // auto-load if this collection hasn't been fetched yet.
    setTotals(cache.get(collectionGid) ?? null);
    if (
      session &&
      !cache.has(collectionGid) &&
      hasRunFor.current !== collectionGid
    ) {
      hasRunFor.current = collectionGid;
      load();
    }
  }, [session, collectionGid, load]);

  return { totals, loading, progress, error, reload: load };
}

export function CollectionSalesView({
  totals,
  loading,
  progress,
  error,
}: {
  totals: SalesTotals | null;
  loading: boolean;
  progress: { pages: number; orders: number };
  error: string | null;
}) {
  return (
    <>
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
            {totals.ordersWithMatch.toLocaleString()} contained an item from
            this collection. Collection has{" "}
            {totals.collectionProducts.length} products.
          </p>

          {totals.perProduct.length > 0 ? (
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
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No orders contained any product from this collection (in the last{" "}
              {totals.ordersScanned.toLocaleString()} orders scanned).
            </p>
          )}
        </>
      )}
    </>
  );
}

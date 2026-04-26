import { useState, useRef, useCallback } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/inventory-report";
import { useShopSession } from "../shop-context";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inventory Report" },
    { name: "description", content: "Shopify inventory report" },
  ];
}

interface InventoryLevel {
  location: string;
  available: number;
  onHand: number;
  committed: number;
}

interface VariantData {
  title: string;
  sku: string;
  reorderPoint: number | null;
  inventoryLevels: InventoryLevel[];
}

interface ProductGroup {
  title: string;
  manufacturer: string | null;
  variants: VariantData[];
}

const BULK_OPERATION_MUTATION = `mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
            metafields(first: 1, keys: ["custom.associated_manufacturer"]) {
              edges {
                node {
                  key
                  value
                  reference {
                    ... on Metaobject {
                      fields {
                        key
                        value
                      }
                    }
                  }
                }
              }
            }
            variants {
              edges {
                node {
                  id
                  title
                  sku
                  metafields(first: 1, keys: ["custom.reorder_point"]) {
                    edges {
                      node {
                        key
                        value
                      }
                    }
                  }
                  inventoryItem {
                    id
                    tracked
                    inventoryLevels {
                      edges {
                        node {
                          location {
                            name
                          }
                          quantities(names: ["available", "on_hand", "committed"]) {
                            name
                            quantity
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`;

const POLL_QUERY = `query {
  currentBulkOperation {
    id
    status
    url
  }
}`;

const GRAPHQL_PROXY = "https://cawso-stats.dal04.workers.dev/graphql";

async function shopifyGraphQL(shop: string, accessToken: string, query: string) {
  const res = await fetch(GRAPHQL_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop, access_token: accessToken, query }),
  });
  return res.json();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBulkResponse(raw: string): ProductGroup[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines: any[] = raw
    .trim()
    .split("\n")
    .map((line: string) => JSON.parse(line));

  const products: Map<string, ProductGroup> = new Map();
  const variants: Map<string, VariantData> = new Map();

  for (const record of lines) {
    const id: string | undefined = record.id;
    const parentId: string | undefined = record.__parentId;

    if (id?.includes("/Product/") && !parentId) {
      products.set(id, {
        title: record.title,
        manufacturer: null,
        variants: [],
      });
    } else if (id?.includes("/ProductVariant/") && parentId) {
      const variant: VariantData = {
        title: record.title,
        sku: record.sku,
        reorderPoint: null,
        inventoryLevels: [],
      };
      variants.set(id, variant);
      products.get(parentId)?.variants.push(variant);
    } else if (record.key === "custom.associated_manufacturer" && parentId) {
      const name = record.reference?.fields?.find(
        (f: { key: string }) => f.key === "name"
      )?.value ?? null;
      const product = products.get(parentId);
      if (product) product.manufacturer = name;
    } else if (record.key === "custom.reorder_point" && parentId) {
      const variant = variants.get(parentId);
      if (variant) variant.reorderPoint = Number(record.value);
    } else if (record.location && parentId) {
      const variant = variants.get(parentId);
      if (variant) {
        const quantities = record.quantities.reduce(
          (acc: Record<string, number>, q: { name: string; quantity: number }) => {
            acc[q.name] = q.quantity;
            return acc;
          },
          {} as Record<string, number>
        );
        variant.inventoryLevels.push({
          location: record.location.name,
          available: quantities.available ?? 0,
          onHand: quantities.on_hand ?? 0,
          committed: quantities.committed ?? 0,
        });
      }
    }
  }

  return Array.from(products.values());
}

function useInventoryData() {
  const { session } = useShopSession();
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const loadInventory = useCallback(async () => {
    if (!session) return;
    abortRef.current = false;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Start bulk operation
      setStatus("Starting bulk operation...");
      const mutationRes = await shopifyGraphQL(
        session.shop,
        session.accessToken,
        BULK_OPERATION_MUTATION
      );

      const bulkOp = mutationRes.data?.bulkOperationRunQuery?.bulkOperation;
      const userErrors = mutationRes.data?.bulkOperationRunQuery?.userErrors;

      if (userErrors?.length) {
        throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
      }
      if (!bulkOp?.id) {
        throw new Error("Failed to start bulk operation");
      }

      // Step 2: Poll for completion with progressive backoff (5s, 10s, 15s, 20s, 20s, ...)
      const bulkOperationId = bulkOp.id;
      let pollWait = 5000;
      const MAX_POLL_WAIT = 20000;

      let jsonlUrl: string | null = null;
      let pollAttempt = 0;
      while (!abortRef.current) {
        pollAttempt++;
        const waitSeconds = pollWait / 1000;
        setStatus(`Still processing... checking again in ${waitSeconds}s (attempt ${pollAttempt})`);
        await delay(pollWait);
        pollWait = Math.min(pollWait + 5000, MAX_POLL_WAIT);

        const pollRes = await shopifyGraphQL(
          session.shop,
          session.accessToken,
          POLL_QUERY
        );

        const op = pollRes.data?.currentBulkOperation;
        if (!op) {
          continue;
        }

        if (op.status === "COMPLETED") {
          jsonlUrl = op.url;
          break;
        } else if (op.status === "FAILED" || op.status === "CANCELED") {
          throw new Error(`Bulk operation ${op.status.toLowerCase()}`);
        }
      }

      if (!jsonlUrl) {
        throw new Error("Bulk operation completed but no URL returned");
      }

      // Step 3: Fetch and parse the JSONL
      setStatus("Downloading inventory data...");
      const jsonlRes = await fetch(jsonlUrl);
      const raw = await jsonlRes.text();

      setProductGroups(parseBulkResponse(raw));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatus("");
    }
  }, [session]);

  return { productGroups, loading, loaded, status, error, loadInventory };
}

function escapeCsvValue(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(productGroups: ProductGroup[]): string {
  const rows: string[] = [
    ["Product", "Variant", "SKU", "Pref. Vendor", "Location", "Available", "On Hand", "Reorder Point", "On Sales Order"].join(","),
  ];

  for (const product of productGroups) {
    for (const variant of product.variants) {
      for (const level of variant.inventoryLevels) {
        const row = [
          escapeCsvValue(product.title),
          escapeCsvValue(variant.title),
          escapeCsvValue(variant.sku),
          escapeCsvValue(product.manufacturer),
          escapeCsvValue(level.location),
          level.available,
          level.onHand,
          variant.reorderPoint ?? "",
          level.committed,
        ].join(",");
        rows.push(row);
      }
    }
  }

  return rows.join("\n");
}

function downloadCsv(productGroups: ProductGroup[]) {
  const csv = generateCsv(productGroups);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory-report.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function InventoryReport() {
  const { productGroups, loading, loaded, status, error, loadInventory } = useInventoryData();
  const columnHeaders = ["Variant", "SKU", "Pref. Vendor", "Location", "Available", "On Hand", "Reorder Point", "On Sales Order"];
  const printColWidths = ["15%", "12%", "12%", "16%", "10%", "10%", "12%", "13%"];

  const PrintColGroup = () => (
    <colgroup>
      {printColWidths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );

  if (!loaded && !loading) {
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
            Inventory Report
          </h1>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
        <button
          onClick={loadInventory}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          Load Inventory Report
        </button>
      </div>
    );
  }

  if (loading) {
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
            Inventory Report
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Loading entire inventory... this may take a minute or two.</p>
        {status && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{status}</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8 print:p-0 print:ml-1.5">
      <div className="flex items-center justify-between mb-6 print:mb-2">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors print:hidden"
          >
            &larr; Back
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-base">
            Inventory Report
          </h1>
        </div>
        <button
          onClick={() => downloadCsv(productGroups)}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors print:hidden"
        >
          Download CSV
        </button>
      </div>

      {/* Column headers - visible only in print, shown once at the top */}
      <div className="hidden print:block">
        <table className="w-full print:table-fixed">
          <PrintColGroup />
          <thead>
            <tr>
              {columnHeaders.map((header) => (
                <th
                  key={header}
                  className="text-left text-xs font-semibold uppercase tracking-wider py-1 px-1 print:text-base print:font-bold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      <div className="space-y-6 print:space-y-0">
        {productGroups.map((product) => (
          <div
            key={product.title}
            className="rounded-lg border border-gray-200 dark:border-gray-700 print:rounded-none print:border-0"
          >
            <div className="sticky top-0 z-10">
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-baseline gap-3 print:bg-transparent print:px-1 print:py-1 rounded-t-lg border-b border-gray-200 dark:border-gray-700 print:rounded-none print:border-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white print:text-base print:font-bold">
                  {product.title}
                </h2>
                {product.manufacturer && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 print:hidden">
                    Manufacturer: {product.manufacturer}
                  </span>
                )}
              </div>
              <table className="min-w-full print:hidden">
                <PrintColGroup />
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    {columnHeaders.map(
                      (header) => (
                        <th
                          key={header}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
              </table>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0 print:table-fixed">
                <PrintColGroup />
                <thead className="bg-gray-50 dark:bg-gray-800/50 print:hidden">
                  <tr className="sr-only">
                    {columnHeaders.map(
                      (header) => (
                        <th key={header}>{header}</th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0">
                  {product.variants.map((variant) => {
                    const usShopLevel = variant.inventoryLevels.find(
                      (l) => l.location === "US Shop"
                    );
                    const belowReorder =
                      variant.reorderPoint !== null &&
                      usShopLevel !== undefined &&
                      usShopLevel.available < variant.reorderPoint;
                    return variant.inventoryLevels.map((level, li) => {
                      return (
                      <tr
                        key={`${variant.sku}-${level.location}`}
                        className={
                          belowReorder
                            ? "bg-yellow-100 dark:bg-yellow-900/30 print:bg-transparent"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        }
                      >
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium align-top print:px-1 print:py-0.5"
                          >
                            {variant.title}
                          </td>
                        ) : null}
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono align-top print:px-1 print:py-0.5"
                          >
                            {variant.sku}
                          </td>
                        ) : null}
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 align-top print:px-1 print:py-0.5"
                          >
                            {product.manufacturer ?? ""}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 print:px-1 print:py-0.5">
                          {level.location}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5">
                          {level.available.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5">
                          {level.onHand.toLocaleString()}
                        </td>
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 align-middle print:px-1 print:py-0.5"
                          >
                            {variant.reorderPoint?.toLocaleString() ?? ""}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 print:px-1 print:py-0.5">
                          {level.committed.toLocaleString()}
                        </td>
                      </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 print:hidden">
        {productGroups.reduce((sum, p) => sum + p.variants.length, 0)} variants across{" "}
        {productGroups.length} products
      </p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/inventory-report";

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

const BULK_RESPONSE_URL =
  "https://storage.googleapis.com/shopify-tiers-assets-prod-us-east1/bulk-operation-outputs/d2k9ijkxiaoj6bmey2p47bygrqwv-final?GoogleAccessId=assets-us-prod%40shopify-tiers.iam.gserviceaccount.com&Expires=1775873296&Signature=D9Urh1QyPfw8ZYwo9oeEDteCH4ocdDiaNPVkr%2Fi%2FkgK4iQI6uHkVz6r%2FuQ1%2FP6o%2FCzH58rUHo6OP4HRm5OIEP5FmuB84M%2F%2FpZaWAYkEVro90DHOIWjFJtTCLSEED897AGUacDHX%2Bz9FUr1mxfY2E8zN6rV%2B1WdbZVBLWCtcjBDzCBZBHerN77dIY5cxPCOPweEY039LMcIul50zbpwLbfDTANCCUzVKFh2NyD6m2AlIX%2BXfY3a5la54yd2tXQh5wwab9mAXO5o0WbipoFuu3rl15BiVOaQUvC0jNIXY1%2Fhk37ugtyfqRzkG6t%2BystxLl0YTnhyGVq8n7APTlTNBQZw%3D%3D&response-content-disposition=attachment%3B+filename%3D%22bulk-6865694851305.jsonl%22%3B+filename%2A%3DUTF-8%27%27bulk-6865694851305.jsonl&response-content-type=application%2Fjsonl";

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
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(BULK_RESPONSE_URL)
      .then((res) => res.text())
      .then((raw) => {
        setProductGroups(parseBulkResponse(raw));
        setLoading(false);
      });
  }, []);

  return { productGroups, loading };
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
  const rows: string[] = [];

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
  const { productGroups, loading } = useInventoryData();
  const columnHeaders = ["Variant", "SKU", "Pref. Vendor", "Location", "Available", "On Hand", "Reorder Point", "On Sales Order"];
  const printColWidths = ["15%", "12%", "12%", "16%", "10%", "10%", "12%", "13%"];

  const PrintColGroup = () => (
    <colgroup>
      {printColWidths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-8 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading inventory data...</p>
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
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden print:rounded-none print:border-0"
          >
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-baseline gap-3 print:bg-transparent print:px-1 print:py-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white print:text-base print:font-bold">
                {product.title}
              </h2>
              {product.manufacturer && (
                <span className="text-sm text-gray-500 dark:text-gray-400 print:hidden">
                  Manufacturer: {product.manufacturer}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0 print:table-fixed">
                <PrintColGroup />
                <thead className="bg-gray-50 dark:bg-gray-800/50 print:hidden">
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
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-y-0">
                  {product.variants.map((variant) =>
                    variant.inventoryLevels.map((level, li) => {
                      const belowReorder =
                        variant.reorderPoint !== null &&
                        level.available < variant.reorderPoint;
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
                    })
                  )}
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

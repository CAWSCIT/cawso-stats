import type { Route } from "./+types/inventory-report";
import responseData from "../data/response.json";

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

function parseInventoryData(): ProductGroup[] {
  const products = responseData.data.products.nodes;

  return products.map((product) => {
    const manufacturerMetafield = product.metafields.nodes.find(
      (mf) => mf.reference?.fields?.some(
        (f: { key: string; value: string }) => f.key === "name"
      )
    );
    const manufacturer = manufacturerMetafield?.reference?.fields?.find(
      (f: { key: string; value: string }) => f.key === "name"
    )?.value ?? null;

    return {
      title: product.title,
      manufacturer,
      variants: product.variants.nodes.map((variant) => {
      const reorderMetafield = variant.metafields?.nodes?.find(
        (mf: { key: string }) => mf.key === "custom.reorder_point"
      );
      const reorderPoint = reorderMetafield ? Number(reorderMetafield.value) : null;

      return {
      title: variant.title,
      sku: variant.sku,
      reorderPoint,
      inventoryLevels: variant.inventoryItem.inventoryLevels.nodes.map((level) => {
        const quantities = level.quantities.reduce(
          (acc: Record<string, number>, q: { name: string; quantity: number }) => {
            acc[q.name] = q.quantity;
            return acc;
          },
          {} as Record<string, number>
        );
        return {
          location: level.location.name,
          available: quantities.available ?? 0,
          onHand: quantities.on_hand ?? 0,
          committed: quantities.committed ?? 0,
        };
      }),
    };
    }),
  };
  });
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
  const productGroups = parseInventoryData();
  const columnHeaders = ["Variant", "SKU", "Pref. Vendor", "Location", "Available", "On Hand", "Reorder Point", "On Sales Order"];
  const printColWidths = ["15%", "12%", "12%", "16%", "10%", "10%", "12%", "13%"];

  const PrintColGroup = () => (
    <colgroup>
      {printColWidths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8 print:p-0 print:ml-1.5">
      <div className="flex items-center justify-between mb-6 print:mb-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-base">
          Inventory Report
        </h1>
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

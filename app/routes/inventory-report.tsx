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

export default function InventoryReport() {
  const productGroups = parseInventoryData();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Inventory Report
      </h1>
      <div className="space-y-6">
        {productGroups.map((product) => (
          <div
            key={product.title}
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-baseline gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {product.title}
              </h2>
              {product.manufacturer && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Manufacturer: {product.manufacturer}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    {["Variant", "SKU", "Manufacturer", "Reorder Point", "Location", "Available", "On Hand", "Committed"].map(
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
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {product.variants.map((variant) =>
                    variant.inventoryLevels.map((level, li) => (
                      <tr
                        key={`${variant.sku}-${level.location}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium align-top"
                          >
                            {variant.title}
                          </td>
                        ) : null}
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono align-top"
                          >
                            {variant.sku}
                          </td>
                        ) : null}
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 align-top"
                          >
                            {product.manufacturer ?? ""}
                          </td>
                        ) : null}
                        {li === 0 ? (
                          <td
                            rowSpan={variant.inventoryLevels.length}
                            className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100 align-top"
                          >
                            {variant.reorderPoint?.toLocaleString() ?? ""}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {level.location}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                          {level.available.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                          {level.onHand.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                          {level.committed.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        {productGroups.reduce((sum, p) => sum + p.variants.length, 0)} variants across{" "}
        {productGroups.length} products
      </p>
    </div>
  );
}

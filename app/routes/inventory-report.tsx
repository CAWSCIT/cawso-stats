import type { Route } from "./+types/inventory-report";
import responseData from "../data/response.json";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inventory Report" },
    { name: "description", content: "Shopify inventory report" },
  ];
}

interface InventoryRow {
  product: string;
  variant: string;
  sku: string;
  location: string;
  available: number;
  onHand: number;
  committed: number;
  incoming: number;
}

function parseInventoryData(): InventoryRow[] {
  const rows: InventoryRow[] = [];
  const products = responseData.data.products.nodes;

  for (const product of products) {
    for (const variant of product.variants.nodes) {
      for (const level of variant.inventoryItem.inventoryLevels.nodes) {
        const quantities = level.quantities.reduce(
          (acc: Record<string, number>, q: { name: string; quantity: number }) => {
            acc[q.name] = q.quantity;
            return acc;
          },
          {} as Record<string, number>
        );

        rows.push({
          product: product.title,
          variant: variant.title,
          sku: variant.sku,
          location: level.location.name,
          available: quantities.available ?? 0,
          onHand: quantities.on_hand ?? 0,
          committed: quantities.committed ?? 0,
          incoming: quantities.incoming ?? 0,
        });
      }
    }
  }

  return rows;
}

export default function InventoryReport() {
  const rows = parseInventoryData();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Inventory Report
      </h1>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {["Product", "Variant", "SKU", "Location", "Available", "On Hand", "Committed", "Incoming"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate">
                  {row.product}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {row.variant}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {row.sku}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {row.location}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {row.available.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {row.onHand.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {row.committed.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {row.incoming.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {rows.length} inventory records across {responseData.data.products.nodes.length} products
      </p>
    </div>
  );
}

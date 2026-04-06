import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Route } from "./+types/regional-sales-breakdown";
import { useShopSession } from "../shop-context";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Regional Sales Breakdown" },
    { name: "description", content: "Geographic breakdown of sales by region" },
  ];
}

interface QuarterOption {
  year: number;
  quarter: number;
  label: string;
  startDate: string;
  endDate: string;
}

function getQuarterDates(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, endMonth, 1));
  return {
    startDate: start.toISOString().replace(".000Z", "Z"),
    endDate: end.toISOString().replace(".000Z", "Z"),
  };
}

function getAvailableQuarters(): QuarterOption[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const minYear = 2025;
  const minQuarter = 2;

  const options: QuarterOption[] = [];

  for (let year = minYear; year <= currentYear; year++) {
    const startQ = year === minYear ? minQuarter : 1;
    const endQ = year === currentYear ? currentQuarter - 1 : 4;

    for (let q = startQ; q <= endQ; q++) {
      const { startDate, endDate } = getQuarterDates(year, q);
      options.push({
        year,
        quarter: q,
        label: `Q${q} ${year}`,
        startDate,
        endDate,
      });
    }
  }

  return options;
}

const AREAS_URL =
  "https://raw.githubusercontent.com/CAWSCIT/area-maps/refs/heads/main/src/areas/Areas.json";

const GRAPHQL_PROXY =
  "https://throbbing-frog-a6d8.kalob-taulien.workers.dev/graphql";

interface OrderLine {
  name: string;
  amount: number;
  currencyCode: string;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  region: string | null;
}

interface AreaFeature {
  type: "Feature";
  properties: { Name: string; Region: string; WSCRecognized: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

interface AreasGeoJSON {
  type: "FeatureCollection";
  features: AreaFeature[];
}

function pointInPolygon(
  lat: number,
  lng: number,
  polygon: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1]; // lat
    const yi = polygon[i][0]; // lng
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function matchOrderToArea(
  lat: number,
  lng: number,
  features: AreaFeature[]
): { area: string; region: string } | null {
  for (const feature of features) {
    const ring = feature.geometry.coordinates[0];
    if (pointInPolygon(lat, lng, ring)) {
      return {
        area: feature.properties.Name,
        region: feature.properties.Region,
      };
    }
  }
  return null;
}

function parseJSONL(text: string): OrderLine[] {
  const lines = text.trim().split("\n");
  const orders: OrderLine[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    // Skip child nodes (inventory levels etc. that have __parentId)
    if (obj.__parentId) continue;

    const amount = parseFloat(
      obj.currentTotalPriceSet?.shopMoney?.amount ?? "0"
    );
    const currencyCode =
      obj.currentTotalPriceSet?.shopMoney?.currencyCode ?? "USD";
    const lat = obj.shippingAddress?.latitude ?? null;
    const lng = obj.shippingAddress?.longitude ?? null;

    orders.push({
      name: obj.name ?? "",
      amount,
      currencyCode,
      latitude: lat,
      longitude: lng,
      area: null,
      region: null,
    });
  }

  return orders;
}

function buildOrderFilter(option: QuarterOption): string {
  return `processed_at:>=${option.startDate} processed_at:<${option.endDate}`;
}

function buildBulkMutation(orderFilter: string): string {
  return `mutation RunOrdersForGeoClustering {
  bulkOperationRunQuery(
    query: """
    {
      orders(
        query: "${orderFilter}"
        sortKey: PROCESSED_AT
      ) {
        edges {
          node {
            name
            currentTotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            shippingAddress {
              latitude
              longitude
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
}

export default function RegionalSalesBreakdown() {
  const { session } = useShopSession();
  const quarters = useMemo(() => getAvailableQuarters(), []);
  const availableYears = useMemo(
    () => [...new Set(quarters.map((q) => q.year))],
    [quarters]
  );

  const [selectedYear, setSelectedYear] = useState(
    quarters[quarters.length - 1]?.year ?? availableYears[0]
  );
  const [selectedQuarter, setSelectedQuarter] = useState(
    quarters[quarters.length - 1]?.quarter ?? 1
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderLine[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const quartersForYear = useMemo(
    () => quarters.filter((q) => q.year === selectedYear),
    [quarters, selectedYear]
  );

  const selectedOption = useMemo(
    () =>
      quarters.find(
        (q) => q.year === selectedYear && q.quarter === selectedQuarter
      ) ?? null,
    [quarters, selectedYear, selectedQuarter]
  );

  const orderFilter = selectedOption ? buildOrderFilter(selectedOption) : "";

  function handleYearChange(year: number) {
    setSelectedYear(year);
    const available = quarters.filter((q) => q.year === year);
    if (!available.find((q) => q.quarter === selectedQuarter)) {
      setSelectedQuarter(available[available.length - 1]?.quarter ?? 1);
    }
  }

  const shopifyGraphQL = useCallback(
    async (query: string) => {
      if (!session) throw new Error("No session");
      const res = await fetch(GRAPHQL_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: session.shop,
          access_token: session.accessToken,
          query,
        }),
      });
      return res.json();
    },
    [session]
  );

  async function handleGetReport() {
    if (!session || !selectedOption) return;
    setLoading(true);
    setError(null);
    setOrders(null);
    setStatus("Starting bulk operation...");

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    try {
      const mutation = buildBulkMutation(orderFilter);
      const json = await shopifyGraphQL(mutation);

      const bulkOp = json.data?.bulkOperationRunQuery?.bulkOperation;
      const userErrors = json.data?.bulkOperationRunQuery?.userErrors;

      if (userErrors?.length) {
        throw new Error(
          userErrors.map((e: { message: string }) => e.message).join(", ")
        );
      }
      if (!bulkOp?.id) {
        throw new Error("Failed to start bulk operation");
      }

      setStatus(`Polling for completion...`);
      pollForCompletion(bulkOp.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
      setLoading(false);
    }
  }

  function pollForCompletion(operationId: string) {
    const pollQuery = `query { bulkOperation(id: "${operationId}") { id status url } }`;

    pollRef.current = setInterval(async () => {
      try {
        const json = await shopifyGraphQL(pollQuery);
        const op = json.data?.bulkOperation;

        if (!op) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setError("Failed to check bulk operation status");
          setLoading(false);
          return;
        }

        if (op.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          pollRef.current = null;

          if (!op.url) {
            setStatus("Completed but no data returned (0 orders?)");
            setLoading(false);
            return;
          }

          setStatus("Fetching order data...");
          await fetchAndCategorize(op.url);
        } else if (op.status === "FAILED" || op.status === "CANCELED") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setError(`Bulk operation ${op.status.toLowerCase()}`);
          setStatus("");
          setLoading(false);
        } else {
          setStatus(`Polling... (${op.status})`);
        }
      } catch (err) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("");
        setLoading(false);
      }
    }, 3500);
  }

  async function fetchAndCategorize(jsonlUrl: string) {
    try {
      // Fetch JSONL and Areas.json in parallel
      const [jsonlRes, areasRes] = await Promise.all([
        fetch(jsonlUrl),
        fetch(AREAS_URL),
      ]);

      const jsonlText = await jsonlRes.text();
      const areasData: AreasGeoJSON = await areasRes.json();

      setStatus("Matching orders to areas...");

      const parsed = parseJSONL(jsonlText);

      // Categorize each order
      for (const order of parsed) {
        if (order.latitude != null && order.longitude != null) {
          const match = matchOrderToArea(
            order.latitude,
            order.longitude,
            areasData.features
          );
          if (match) {
            order.area = match.area;
            order.region = match.region;
          } else {
            order.area = "Outside of an Area";
            order.region = "Outside of an Area";
          }
        }
        // null lat/lng: area and region stay null
      }

      setOrders(parsed);
      setStatus(`Done. ${parsed.length} orders processed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

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
          Regional Sales Breakdown
        </h1>
      </div>

      <div className="flex items-end gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quarter
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {quartersForYear.map((q) => (
              <option key={q.quarter} value={q.quarter}>
                Q{q.quarter}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGetReport}
          disabled={!selectedOption || loading}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Get Report"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {status && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {status}
        </p>
      )}

      {selectedOption && !orders && (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          {orderFilter}
        </p>
      )}

      {orders && <OrderResults orders={orders} />}
    </div>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

interface RegionSummary {
  region: string;
  areas: { area: string; orderCount: number; totalSales: number }[];
  orderCount: number;
  totalSales: number;
}

function buildRegionSummaries(orders: OrderLine[]): RegionSummary[] {
  const regionMap = new Map<
    string,
    Map<string, { orderCount: number; totalSales: number }>
  >();

  for (const order of orders) {
    const region = order.region ?? "No Shipping Address";
    const area = order.area ?? "No Shipping Address";

    if (!regionMap.has(region)) regionMap.set(region, new Map());
    const areaMap = regionMap.get(region)!;

    const existing = areaMap.get(area) ?? { orderCount: 0, totalSales: 0 };
    existing.orderCount += 1;
    existing.totalSales += order.amount;
    areaMap.set(area, existing);
  }

  const summaries: RegionSummary[] = [];
  for (const [region, areaMap] of regionMap) {
    const areas = [...areaMap.entries()]
      .map(([area, data]) => ({ area, ...data }))
      .sort((a, b) => b.totalSales - a.totalSales);

    summaries.push({
      region,
      areas,
      orderCount: areas.reduce((s, a) => s + a.orderCount, 0),
      totalSales: areas.reduce((s, a) => s + a.totalSales, 0),
    });
  }

  // Sort: "Outside of an Area" and "No Shipping Address" at the end
  summaries.sort((a, b) => {
    const special = ["Outside of an Area", "No Shipping Address"];
    const aSpecial = special.indexOf(a.region);
    const bSpecial = special.indexOf(b.region);
    if (aSpecial !== -1 && bSpecial !== -1) return aSpecial - bSpecial;
    if (aSpecial !== -1) return 1;
    if (bSpecial !== -1) return -1;
    return b.totalSales - a.totalSales;
  });

  return summaries;
}

function OrderMap({ orders }: { orders: OrderLine[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const geoOrders = useMemo(
    () => orders.filter((o) => o.latitude != null && o.longitude != null),
    [orders]
  );

  useEffect(() => {
    if (!mapRef.current || geoOrders.length === 0) return;
    const bounds = L.latLngBounds(
      geoOrders.map((o) => [o.latitude!, o.longitude!])
    );
    mapRef.current.fitBounds(bounds, { padding: [30, 30] });
  }, [geoOrders]);

  if (geoOrders.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      <MapContainer
        center={[39.8, -98.5]}
        zoom={4}
        style={{ height: 420 }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoOrders.map((order, i) => (
          <CircleMarker
            key={`${order.name}-${i}`}
            center={[order.latitude!, order.longitude!]}
            radius={5}
            pathOptions={{
              fillColor: "#2563eb",
              fillOpacity: 0.7,
              color: "#1e40af",
              weight: 1,
            }}
          >
            <Tooltip>
              <span className="font-medium">{order.name}</span>
              <br />
              {formatCurrency(order.amount)}
              {order.area && (
                <>
                  <br />
                  {order.area}
                </>
              )}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function OrderResults({ orders }: { orders: OrderLine[] }) {
  const summaries = useMemo(() => buildRegionSummaries(orders), [orders]);
  const grandTotal = orders.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {orders.length} orders &middot; Grand total:{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(grandTotal)}
          </span>
        </p>
      </div>

      <OrderMap orders={orders} />

      {summaries.map((region) => (
        <div
          key={region.region}
          className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {region.region}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {region.orderCount} orders &middot;{" "}
              {formatCurrency(region.totalSales)}
            </span>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col />
              <col style={{ width: "10rem" }} />
              <col style={{ width: "8rem" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/25">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Total Sales
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {region.areas.map((area) => (
                <tr
                  key={area.area}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {area.area}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {area.orderCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(area.totalSales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

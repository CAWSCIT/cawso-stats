import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("inventory-report", "routes/inventory-report.tsx"),
  route("annual-sales", "routes/annual-sales.tsx"),
  route("regional-sales-breakdown", "routes/regional-sales-breakdown.tsx"),
  route("speciality-items", "routes/speciality-items.tsx"),
  route("collection-breakdown", "routes/collection-breakdown.tsx"),
  route(
    "collection-breakdown/:collectionId",
    "routes/collection-breakdown-detail.tsx"
  ),
] satisfies RouteConfig;

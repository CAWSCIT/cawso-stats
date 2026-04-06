import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("inventory-report", "routes/inventory-report.tsx"),
  route("annual-sales", "routes/annual-sales.tsx"),
] satisfies RouteConfig;

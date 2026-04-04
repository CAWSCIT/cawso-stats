import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("inventory-report", "routes/inventory-report.tsx"),
] satisfies RouteConfig;

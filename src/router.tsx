import { createRouter, createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { HomeRoute } from "./routes/home";
import { SessionRoute } from "./routes/session";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions/$slug",
  component: SessionRoute,
});

const routeTree = rootRoute.addChildren([homeRoute, sessionRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

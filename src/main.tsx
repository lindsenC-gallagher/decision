import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Buffer } from "buffer";
import "./index.css";
import { router } from "./router";

// Polyfill Buffer for browser use (required by gray-matter and friends).
// Tauri's webview is a browser, so this runs in production as well as tests.
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 5, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);

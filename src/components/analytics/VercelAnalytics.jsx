import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

/**
 * Vercel Web Analytics for React Router (Vite SPA).
 * Passes route + path so client-side navigations count as page views.
 */
export function VercelAnalytics() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}${location.hash}`;
  const route = location.pathname;

  if (!import.meta.env.PROD) return null;

  return <Analytics path={path} route={route} />;
}

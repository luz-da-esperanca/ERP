export type StockRouteName = 'stock-catalog' | 'stock-origins';

export type ProtectedRouteName = 'hub' | StockRouteName;

export interface AppRouteMatch {
  readonly name: ProtectedRouteName;
}

const STOCK_ROUTES: Readonly<Record<string, StockRouteName>> = {
  '/stock/catalog': 'stock-catalog',
  '/stock/origins': 'stock-origins',
};

/**
 * Resolves a pathname to a protected application route. Hub identity stays
 * configurable through the hub destination; stock screens have fixed paths.
 * Matching is exact: nested or unknown paths are not protected routes.
 */
export function matchRoute(pathname: string, hubDestination: string): AppRouteMatch | null {
  if (pathname === hubDestination) return { name: 'hub' };
  const stock = STOCK_ROUTES[pathname];
  if (stock === undefined) return null;
  return { name: stock };
}

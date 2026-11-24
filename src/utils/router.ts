import { PageRoute } from '../types/civic';

export const ROUTE_TO_PATH: Record<PageRoute, string> = {
  home: '/',
  report: '/report',
  track: '/track',
  community: '/community',
  impact: '/impact',
  coordinator: '/coordinator',
  auth: '/auth',
};

const PATH_TO_ROUTE: Record<string, PageRoute> = {
  '/': 'home',
  '/report': 'report',
  '/track': 'track',
  '/community': 'community',
  '/impact': 'impact',
  '/coordinator': 'coordinator',
  '/auth': 'auth',
};

export interface ParsedBrowserLocation {
  route: PageRoute;
  trackIssueId: string | null;
  initiativeId: string | null;
}

export function normalizePathname(pathname: string): string {
  const cleaned = pathname.trim().replace(/\/+$/, '');
  return cleaned === '' ? '/' : cleaned.toLowerCase();
}

export function parseBrowserLocation(
  pathname: string,
  search = '',
): ParsedBrowserLocation {
  const normalized = normalizePathname(pathname);
  const route: PageRoute = PATH_TO_ROUTE[normalized] ?? 'home';
  const params = new URLSearchParams(search);
  const idParam = params.get('id')?.trim() || null;

  return {
    route,
    trackIssueId: route === 'track' ? idParam : null,
    initiativeId: route === 'community' ? idParam : null,
  };
}

export function buildRouteUrl(
  route: PageRoute,
  options?: { id?: string | null },
): string {
  const basePath = ROUTE_TO_PATH[route] ?? '/';
  const id = options?.id?.trim();
  if (id && (route === 'track' || route === 'community')) {
    const params = new URLSearchParams({ id });
    return `${basePath}?${params.toString()}`;
  }
  return basePath;
}

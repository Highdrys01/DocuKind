export function getBasePath(pathname = window.location.pathname): string {
  const marker = "/tool/";
  const toolIndex = pathname.indexOf(marker);
  if (toolIndex >= 0) return pathname.slice(0, toolIndex);

  return pathname.replace(/\/(?:index\.html)?$/, "");
}

export function normalizeRoute(): string {
  const params = new URLSearchParams(window.location.search);
  const redirectedRoute = params.get("route");
  const source = redirectedRoute ? new URL(redirectedRoute, window.location.origin).pathname : window.location.pathname;
  const base = getBasePath(window.location.pathname);
  let route = source;

  if (base && route.startsWith(base)) {
    route = route.slice(base.length);
  }

  if (!route.startsWith("/")) route = `/${route}`;
  return route === "" ? "/" : route;
}

export function pathForRoute(route: string): string {
  const base = getBasePath();
  if (route === "/") return `${base || ""}/`;
  return `${base}${route}`;
}

export function navigate(route: string): void {
  window.history.pushState({}, "", pathForRoute(route));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

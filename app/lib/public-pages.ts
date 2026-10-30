/** Routes that render without the signed-in app shell. */
export function isPublicPage(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/v/") || pathname.startsWith("/m/");
}

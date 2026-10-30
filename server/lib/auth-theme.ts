/**
 * Re-skins the framework's sign-in page in Kolo's brand: emerald story panel,
 * paper form panel, Kolo mark. Behaviour (password, magic link, Google, SSO)
 * stays the framework's; only presentation changes.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#F5B83D"/><circle cx="16" cy="16" r="11" fill="none" stroke="#0B3D2C" stroke-opacity=".25" stroke-width="1.25"/>${Array.from(
  { length: 8 },
  (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = (16 + Math.cos(a) * 11).toFixed(2);
    const y = (16 + Math.sin(a) * 11).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${i === 0 ? 3.4 : 1.9}" fill="${i === 0 ? "#0E6B4A" : "#0B3D2C"}"/>`;
  },
).join("")}<circle cx="16" cy="16" r="3.2" fill="#0B3D2C"/></svg>`;

export const KOLO_MARK_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(MARK_SVG)}`;

export const KOLO_AUTH_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter:wght@400;500;600&display=swap");
html body, html body.has-marketing, html body.simplified-auth {
  background: #F5F6F2 !important; color: #101A15 !important;
  font-family: "Inter", system-ui, sans-serif !important;
}
html body .auth-wave-background, html body .app-status-badge, html body .oss-badge, html body .marketing-actions { display: none !important; }
html body .auth-page, html body .auth-page[data-auth-marketing="true"] { background: #F5F6F2 !important; }
html body .marketing-panel, html body .auth-marketing-visual {
  background: #0B3D2C !important; color: #F5F6F2 !important;
}
html body .marketing-panel { background-image: radial-gradient(circle at 85% 15%, rgba(245,184,61,.16) 0 18%, transparent 18.2%) !important; }
html body .app-name-label { font-family: "Bricolage Grotesque", sans-serif !important; font-weight: 800 !important; letter-spacing: -0.03em !important; color: #F5F6F2 !important; text-transform: lowercase; }
html body .brand-mark { width: 36px !important; height: 36px !important; filter: none !important; opacity: 1 !important; background: none !important; }
html body .auth-marketing-headline { font-family: "Bricolage Grotesque", sans-serif !important; font-weight: 700 !important; letter-spacing: -0.035em !important; color: #F5F6F2 !important; }
html body .auth-marketing-description { color: rgba(245,246,242,.72) !important; }
html body .form-panel { background: #F5F6F2 !important; }
html body .card { padding: 2rem 2rem 1.75rem !important; background: #FFFFFF !important; border: 1px solid #DDE1D8 !important; border-radius: 20px !important; box-shadow: 0 24px 60px -36px rgba(16,26,21,.45) !important; color: #101A15 !important; }
html body h1 { font-family: "Bricolage Grotesque", sans-serif !important; color: #101A15 !important; letter-spacing: -0.03em !important; font-weight: 700 !important; }
html body .subtitle, html body label, html body .legal-note, html body .divider { color: #5A665F !important; }
html body .tabs { background: #ECEEE8 !important; border-color: transparent !important; border-radius: 999px !important; }
html body .tab { color: #5A665F !important; border-radius: 999px !important; }
html body .tab.active { background: #FFFFFF !important; color: #101A15 !important; box-shadow: 0 1px 2px rgba(16,26,21,.12) !important; }
html body input { background: #FFFFFF !important; border: 1px solid #D5DAD0 !important; color: #101A15 !important; border-radius: 10px !important; }
html body input:focus { border-color: #0E6B4A !important; box-shadow: 0 0 0 3px rgba(14,107,74,.15) !important; }
html body input::placeholder { color: #9AA59E !important; }
html body .btn-primary, html body button.btn-primary, html body .card button[type="submit"] { background: #0E6B4A !important; color: #FFFFFF !important; border: none !important; border-radius: 999px !important; font-weight: 600 !important; }
html body .btn-primary:hover { background: #0B5A3E !important; }
html body .link-button, html body a { color: #0E6B4A !important; }
html body .google-signin button, html body .sso-signin button { background: #FFFFFF !important; color: #101A15 !important; border: 1px solid #D5DAD0 !important; border-radius: 999px !important; }
html body .locale-trigger { color: #5A665F !important; }
`;

export function themeSignInMarkup(markup: string): string {
  return `<style data-kolo-auth-theme>${KOLO_AUTH_CSS}</style>${markup}`;
}

/**
 * Leaving the editor.
 *
 * The editor is a page of its own, opened from the product page by a plain
 * link, so leaving it is going back to that page. When there is nothing on
 * this site to go back to — the editor was opened in a new tab, or from a link
 * somewhere else — it goes to the page registered here instead: the product
 * page in a storefront, the site's root standalone.
 *
 * Mirrors the module of the same name in the sibling designer-lab project.
 */

let exitUrl = "/";

/**
 * Where leaving goes when there is no page to go back to.
 *
 * Only a page on this site: the URL is built from a global on the page, and
 * leaving must never turn into a redirect somewhere else.
 */
export function setExitUrl(url: string): void {
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin === window.location.origin) {
      exitUrl = target.pathname + target.search + target.hash;
    }
  } catch {
    // Not a URL at all; the root still works.
  }
}

/** Whether the page before this one in the tab is on this site. */
function cameFromThisSite(): boolean {
  if (window.history.length < 2 || !document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Go back to where the editor was opened from.
 *
 * Back rather than a link to the product page, so the shopper lands where
 * they left it — scrolled, filtered — and Forward still returns to the editor.
 */
export function leaveEditor(): void {
  if (cameFromThisSite()) window.history.back();
  else window.location.assign(exitUrl);
}

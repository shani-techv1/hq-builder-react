/**
 * The image service: cutting a background out of uploaded artwork.
 *
 * The same endpoint the storefront customiser already uses, on the same backend
 * as the account service — so a sheet built in the editor and a design built on
 * the shop come back cut out by the same model, rather than by two that
 * disagree about where the edges are.
 *
 * The response *is* the image: PNG bytes in the body, with the service's own
 * copies linked in `X-Image-Link` and `X-Original-Image-Link`. Those links are
 * read opportunistically — cross-origin they arrive only if the service exposes
 * them — and nothing here depends on getting one.
 */

/**
 * Where the image service is listening. Overridable per environment.
 *
 * Two ways in, the split `lib/canva` and `lib/auth` both document: the
 * standalone Next app inlines `NEXT_PUBLIC_IMAGE_API_URL` at build time, while
 * the storefront bundle is built by Vite, which does no such thing, so there
 * the page injects `__IMAGE_API_URL__` instead and one bundle serves every
 * deployment.
 *
 * An origin *and* a base path, like the account service: the deployed backend
 * lives under `/backend`, and `/api/images/...` is appended to whatever this
 * resolves to.
 */
function resolveApiUrl(): string {
  const injected =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as Record<string, unknown>).__IMAGE_API_URL__;
  if (typeof injected === "string" && injected) return injected;

  const fromEnv = process.env.NEXT_PUBLIC_IMAGE_API_URL;
  if (typeof fromEnv === "string" && fromEnv) return fromEnv;

  return "https://highquality.allgovjobs.com/backend";
}

/** Trailing slashes are stripped, so a configured value can carry one safely. */
export const IMAGE_API_URL = resolveApiUrl().replace(/\/+$/, "");

/**
 * Long, because this is a model running on someone else's hardware against a
 * print-resolution file. Short enough that a service which has silently died
 * gives the button back rather than spinning until the tab is closed.
 */
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Which pass the service should run. The storefront sends `2` to re-cut the
 * original after a first attempt was kept; the editor always works from the
 * artwork as it stands, so it only ever asks for the first.
 */
const FIRST_PASS = "1";

/** Absolute URL for a path the service handed back, without doubling slashes. */
const serviceUrl = (path: string): string =>
  `${IMAGE_API_URL}/${path.replace(/^\/+/, "")}`;

/**
 * Longer than the cut-out's own timeout allows for, because this sends print
 * artwork rather than a thumbnail: a 40MB PNG off a phone takes a while to
 * leave the building, and giving up on it means the order loses the file.
 */
const UPLOAD_TIMEOUT_MS = 180_000;

/**
 * File the artwork on the image host, and get back a URL that serves it.
 *
 * The same host the cut-out already files its results on, through its plain
 * upload endpoint: the bytes are stored as they arrive — no re-encode, no
 * resize — and come back byte for byte. That is the whole point of using it.
 * Whoever prints a gang sheet needs the artwork at the resolution it was
 * uploaded at, and a URL costs an order a few hundred bytes where the file
 * itself costs megabytes.
 *
 * Uploads are filed under a name the host's static guard recognises, which is
 * what lets a fulfilment backend fetch one without being on an allowlist.
 *
 * Returns `null` rather than throwing. Hosting is an optimisation on the way
 * to an order, and a design that cannot be saved is worse than one whose
 * artwork travels the slow way — see `collectSheetPieces`, which falls back to
 * carrying the bytes.
 */
export async function hostArtwork(
  source: Blob,
  fileName: string,
): Promise<string | null> {
  const form = new FormData();
  form.append("image", source, fileName);

  try {
    const response = await fetch(`${IMAGE_API_URL}/api/images/upload`, {
      method: "POST",
      body: form,
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    const url =
      typeof payload === "object" && payload !== null
        ? (payload as { url?: unknown }).url
        : undefined;

    // Absolute already — the endpoint returns a complete URL rather than the
    // path the cut-out's headers carry.
    return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
  } catch {
    // Offline, blocked, or slower than the timeout allows.
    return null;
  }
}

/**
 * Crop the empty margin off artwork, and get the result back as bytes.
 *
 * Run on files straight off the user's device, so what lands in the library —
 * and on the sheet, and on the order — is the artwork itself rather than the
 * canvas it was exported on: a transparent border still takes up room on a gang
 * sheet, and the sheet is paid for by the inch.
 *
 * `XMLHttpRequest` rather than `fetch`, because only the former reports bytes
 * sent, and this carries the whole print file up before anything comes back.
 * Listening for that makes the request preflighted, which the service answers
 * like any other route.
 *
 * Returns `null` rather than throwing, like {@link hostArtwork}: trimming
 * improves an upload, and a service that is down must not turn one away. The
 * caller keeps the original instead.
 */
export function trimArtwork(
  source: Blob,
  fileName: string,
  onProgress: (percent: number) => void,
): Promise<Blob | null> {
  const form = new FormData();
  form.append("image", source, fileName);

  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${IMAGE_API_URL}/api/images/trim`);
    request.responseType = "blob";
    // The same allowance as filing the artwork: this carries the same bytes up,
    // and waits for the crop besides.
    request.timeout = UPLOAD_TIMEOUT_MS;

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      const succeeded = request.status >= 200 && request.status < 300;
      const blob: unknown = request.response;
      // A JSON body behind a 200 is a failure envelope, not artwork.
      resolve(
        succeeded &&
          blob instanceof Blob &&
          blob.size > 0 &&
          blob.type.startsWith("image/")
          ? blob
          : null,
      );
    };
    // Offline, blocked, or slower than the timeout allows.
    request.onerror = () => resolve(null);
    request.ontimeout = () => resolve(null);
    request.onabort = () => resolve(null);

    request.send(form);
  });
}

export interface RemovedBackground {
  /** The cut-out artwork. */
  blob: Blob;
  /**
   * The service found nothing to do: the artwork arrived already transparent,
   * and what came back is a re-encode of what went up. Worth knowing, because
   * keeping it would put a second copy of the same picture in the library.
   */
  alreadyRemoved: boolean;
  /** Where the service filed the result, when it says. */
  imageUrl: string | null;
  /** The same for the untouched original. */
  originalUrl: string | null;
}

/**
 * Send artwork to be cut out, and get the result back as bytes.
 *
 * The file name travels with the upload — multipart without one arrives as
 * "blob", which is what the service would then have in its logs for every
 * image anyone ever sent it.
 *
 * Failures throw with a message worth showing: the caller is a toolbar button,
 * and "Could not reach the image service" is the difference between trying
 * again and assuming the artwork is at fault.
 */
export async function removeBackground(
  source: Blob,
  fileName: string,
): Promise<RemovedBackground> {
  const form = new FormData();
  form.append("image", source, fileName);
  form.append("type", FIRST_PASS);

  let response: Response;
  try {
    response = await fetch(`${IMAGE_API_URL}/api/images/remove-bg`, {
      method: "POST",
      body: form,
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // A timeout and an unreachable service are different things to be told:
    // one is worth trying again on a smaller file, the other isn't.
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new Error(
        "The image service took too long. Try again, or scale the artwork down first.",
      );
    }
    throw new Error(
      "We couldn’t reach the image service. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(await failureMessage(response));
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("The image service sent an empty file back.");
  }
  // A JSON body behind a 200 is a failure envelope, not artwork — reading it
  // as an image would put a broken placement on the sheet.
  if (blob.type && !blob.type.startsWith("image/")) {
    throw new Error("The image service didn’t send an image back.");
  }

  const imageLink = response.headers.get("X-Image-Link");
  const originalLink = response.headers.get("X-Original-Image-Link");

  return {
    blob,
    // Sent only when it applies, so its presence is the answer. The service
    // exposes it cross-origin along with the two links.
    alreadyRemoved: response.headers.get("X-Background-Already-Removed") === "true",
    imageUrl: imageLink ? serviceUrl(imageLink) : null,
    originalUrl: originalLink ? serviceUrl(originalLink) : null,
  };
}

/** The service's own words where it gives them, and the status where it doesn't. */
async function failureMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
    ) {
      return (payload as { error: string }).error;
    }
  } catch {
    // Not JSON. The status is all there is to go on.
  }

  return response.status >= 500
    ? "The image service had a problem with that file. Try again in a moment."
    : `The image service refused the file (${response.status}).`;
}

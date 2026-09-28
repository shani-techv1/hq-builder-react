"use client";

import * as React from "react";

import { toast } from "@/components/ui/toast";
import { useAccount } from "@/hooks/use-account";
import type { AssetLibrary } from "@/hooks/use-asset-library";
import {
  addAccountAsset,
  deleteAccountAsset,
  listAccountAssets,
  updateAccountAsset,
  type AccountAssetRecord,
} from "@/lib/account-assets";
import type { Asset } from "@/lib/assets";
import { getAssetFile } from "@/lib/image-cache";
import { hostAssetFile } from "@/lib/sheet-pieces";

/**
 * Whether the account's graphics can be reached, and if not, why not — the
 * same three answers My designs gives.
 */
export type AccountLibraryAccess = "signed-out" | "sign-in-again" | "ready";

export interface AccountLibraryState {
  access: AccountLibraryAccess;
  /** True until the account's graphics have loaded. */
  loading: boolean;
  /** Why they didn't, until the next attempt. */
  error: string | null;
  retry: () => void;
}

/**
 * The asset library, kept on the signed-in account.
 *
 * Deleting is asynchronous here, because a graphic on the account is removed
 * there before it leaves the library — a delete that failed after the fact
 * would come back on the next visit.
 */
export interface AccountLibrary extends Omit<AssetLibrary, "deleteAsset"> {
  /** Resolves `false` when the account couldn't be updated; nothing changed. */
  deleteAsset: (id: string) => Promise<boolean>;
  account: AccountLibraryState;
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error && cause.message
    ? cause.message
    : "Something went wrong. Please try again.";

/**
 * Every upload a signed-in user makes, kept on their account.
 *
 * One rule, applied to the whole library rather than to each way artwork can
 * arrive: while signed in, anything in the library that isn't on the account
 * yet is put there. An upload, a cut-out, a Canva import, a duplicate, and work
 * started before signing in all go the same way — and no future way in can
 * forget to.
 *
 * The account's graphics are merged in as they load, listed from their
 * thumbnails; `ensureLocal` fetches a file the first time it is used. Renaming,
 * favouriting and deleting are sent to the account as well, and undone locally
 * if it refuses.
 *
 * Signed out, the library is exactly what it was: uploads for this session,
 * kept by the draft until the next sign-in brings them into an account.
 */
export function useAccountLibrary(library: AssetLibrary): AccountLibrary {
  const { user, isAuthorized } = useAccount();
  const owner = user?.id ?? null;
  const access: AccountLibraryAccess = !user
    ? "signed-out"
    : isAuthorized
      ? "ready"
      : "sign-in-again";

  /* ------------------------------ Loading ------------------------------- */

  const [attempt, setAttempt] = React.useState(0);
  /** Which load last finished, and how. A load for anything else is still running. */
  const [loaded, setLoaded] = React.useState<{
    key: string;
    error: string | null;
  } | null>(null);
  const loadKey = `${owner}:${attempt}`;
  const settled = loaded?.key === loadKey ? loaded : null;
  const loading = access === "ready" && settled === null;

  /** The account's records, for spotting an upload that is already one of them. */
  const records = React.useRef<{
    owner: string | null;
    list: AccountAssetRecord[];
  }>({ owner: null, list: [] });

  const { addAccountAssets } = library;
  React.useEffect(() => {
    if (access !== "ready" || !owner) return;
    let cancelled = false;

    listAccountAssets().then(
      (list) => {
        if (cancelled) return;
        records.current = { owner, list };
        addAccountAssets(list);
        setLoaded({ key: loadKey, error: null });
      },
      (cause: unknown) => {
        if (!cancelled) setLoaded({ key: loadKey, error: messageOf(cause) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [access, owner, loadKey, addAccountAssets]);

  /* ------------------------------ Keeping ------------------------------- */

  /** Uploads on their way to the account. */
  const pushing = React.useRef(new Set<string>());
  /** Uploads the account refused, not retried until the next sign-in. */
  const refused = React.useRef(new Set<string>());
  /** The library as of the latest render, for pushes that finish after it. */
  const latestAssets = React.useRef(library.assets);
  React.useEffect(() => {
    latestAssets.current = library.assets;
  }, [library.assets]);

  React.useEffect(() => {
    refused.current.clear();
  }, [owner]);

  const { linkAccountAsset } = library;
  const push = React.useCallback(
    async (asset: Asset, file: Blob, as: string) => {
      pushing.current.add(asset.id);
      try {
        // The same file already on the account, and not in the library under
        // its own entry: this upload is that graphic, from before it was linked.
        const url = await hostAssetFile(asset.id, file, asset.name);
        const linked = new Set(
          latestAssets.current.map((entry) => entry.accountAsset?.id),
        );
        const existing = records.current.list.find(
          (record) => record.url === url && !linked.has(record.id),
        );
        const record = existing ?? (await addAccountAsset(asset, file));
        if (records.current.owner !== as) return;

        if (!existing) records.current.list = [record, ...records.current.list];
        linkAccountAsset(asset.id, { id: record.id, url: record.url });

        // Renamed or favourited while it was on its way up.
        const latest = latestAssets.current.find((entry) => entry.id === asset.id);
        if (
          latest &&
          (latest.name !== record.name || latest.favorite !== record.favorite)
        ) {
          void updateAccountAsset(record.id, {
            name: latest.name,
            favorite: latest.favorite,
          }).catch(() => {
            // The graphic is kept; only the label is behind, until it changes.
          });
        }
      } catch (cause) {
        refused.current.add(asset.id);
        toast.error(
          `Couldn’t keep “${asset.name}” on your account`,
          `${messageOf(cause)} It’s still here to use for now.`,
        );
      } finally {
        pushing.current.delete(asset.id);
      }
    },
    [linkAccountAsset],
  );

  const listReady = settled !== null && settled.error === null;
  React.useEffect(() => {
    // After the list, so an upload that is already on it is recognised rather
    // than recorded twice. A list that failed to load holds them back until
    // "Try again" gets it.
    if (access !== "ready" || !owner || !listReady) return;
    for (const asset of library.assets) {
      if (asset.accountAsset) continue;
      if (pushing.current.has(asset.id) || refused.current.has(asset.id)) continue;
      const file = getAssetFile(asset.id);
      if (file) void push(asset, file, owner);
    }
  }, [access, owner, listReady, library.assets, push]);

  /* ------------------------------ Changing ------------------------------ */

  const find = (id: string) => library.assets.find((asset) => asset.id === id);

  const renameAsset = (id: string, name: string) => {
    const asset = find(id);
    const next = name.trim();
    library.renameAsset(id, name);
    if (!asset?.accountAsset || !next || next === asset.name) return;

    updateAccountAsset(asset.accountAsset.id, {
      name: next,
      favorite: asset.favorite,
    }).catch((cause: unknown) => {
      library.renameAsset(id, asset.name);
      toast.error("Couldn’t rename the graphic", messageOf(cause));
    });
  };

  const toggleFavorite = (id: string) => {
    const asset = find(id);
    library.toggleFavorite(id);
    if (!asset?.accountAsset) return;

    updateAccountAsset(asset.accountAsset.id, {
      name: asset.name,
      favorite: !asset.favorite,
    }).catch((cause: unknown) => {
      library.toggleFavorite(id);
      toast.error("Couldn’t update the graphic", messageOf(cause));
    });
  };

  const deleteAsset = async (id: string): Promise<boolean> => {
    const asset = find(id);
    if (asset?.accountAsset) {
      try {
        await deleteAccountAsset(asset.accountAsset.id);
      } catch (cause) {
        toast.error("Couldn’t delete the graphic", messageOf(cause));
        return false;
      }
      const removed = asset.accountAsset.id;
      records.current.list = records.current.list.filter(
        (record) => record.id !== removed,
      );
    }
    library.deleteAsset(id);
    return true;
  };

  return {
    ...library,
    renameAsset,
    toggleFavorite,
    deleteAsset,
    account: {
      access,
      loading,
      error: settled?.error ?? null,
      retry: () => setAttempt((current) => current + 1),
    },
  };
}

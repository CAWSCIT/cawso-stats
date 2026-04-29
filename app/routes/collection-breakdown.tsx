import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/collection-breakdown";
import { useShopSession } from "../shop-context";
import {
  GRAPHQL_PROXY,
  collectionNumericId,
  extractGraphqlErrorMessage,
} from "../collection-sales";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Collection Breakdown" },
    {
      name: "description",
      content: "Pick a collection to see per-product sales and discounts",
    },
  ];
}

const COLLECTIONS_QUERY = `query getCollections {
  collections(first: 50) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}`;

interface CollectionSummary {
  id: string;
  title: string;
  handle: string;
}

let cachedCollections: CollectionSummary[] | null = null;

function useCollections() {
  const { session } = useShopSession();
  const [collections, setCollections] = useState<CollectionSummary[]>(
    cachedCollections ?? []
  );
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(cachedCollections !== null);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(GRAPHQL_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: session.shop,
          access_token: session.accessToken,
          query: COLLECTIONS_QUERY,
        }),
      });
      const json = await res.json();
      const errMsg = extractGraphqlErrorMessage(json);
      if (errMsg) throw new Error(errMsg);

      const edges: { node: CollectionSummary }[] =
        json.data?.collections?.edges ?? [];
      const list = edges.map((e) => e.node);
      list.sort((a, b) => a.title.localeCompare(b.title));
      cachedCollections = list;
      setCollections(list);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && !loaded && !hasRun.current) {
      hasRun.current = true;
      load();
    }
  }, [session, loaded, load]);

  return { collections, loading, loaded, error, reload: load };
}

export default function CollectionBreakdown() {
  const { collections, loaded, error } = useCollections();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Collection Breakdown
        </h1>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Pick a collection to see per-product quantity sold, dollar value, and
        total discounts across all orders.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 mb-6">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {!loaded && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading collections...
        </p>
      )}

      {loaded && collections.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No collections found.
        </p>
      )}

      {loaded && collections.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                to={`/collection-breakdown/${collectionNumericId(c.id)}`}
                className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {c.title}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {c.handle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

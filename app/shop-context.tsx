import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface ShopSession {
  shop: string;
  accessToken: string;
}

interface ShopContextValue {
  session: ShopSession | null;
  loading: boolean;
  error: string | null;
}

const ShopContext = createContext<ShopContextValue>({
  session: null,
  loading: true,
  error: null,
});

export function useShopSession() {
  return useContext(ShopContext);
}

const AUTH_ENDPOINT = "https://cawso-stats.dal04.workers.dev/auth";

export function ShopProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ShopSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Local testing override: ?access_token=xxx&shop=yyy
    const overrideToken = params.get("access_token");
    const overrideShop = params.get("shop");

    if (overrideToken && overrideShop) {
      setSession({ shop: overrideShop, accessToken: overrideToken });
      setLoading(false);
      return;
    }

    // Embedded Shopify flow: forward all URL params to the auth endpoint
    const body: Record<string, string> = {};
    params.forEach((value, key) => {
      body[key] = value;
    });

    if (Object.keys(body).length === 0) {
      setError("No authentication parameters found in URL");
      setLoading(false);
      return;
    }

    fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSession({ shop: data.shop, accessToken: data.access_token });
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <ShopContext.Provider value={{ session, loading, error }}>
      {children}
    </ShopContext.Provider>
  );
}

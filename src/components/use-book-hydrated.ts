import { useEffect, useState } from "react";
import { useBook } from "@/lib/book-store";

export function useBookHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const persist = useBook.persist;
    if (!persist) {
      setReady(true);
      return;
    }
    if (persist.hasHydrated()) setReady(true);
    return persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

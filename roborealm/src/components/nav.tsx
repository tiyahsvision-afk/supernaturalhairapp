"use client";

/**
 * Navigation that works both as a normal Next.js app and as a single-file static
 * build (NEXT_PUBLIC_STATIC=1) hosted where only one page exists: in static mode
 * routes live in the URL hash (#/hub, #/mission/m1-wake-up).
 */
import NextLink from "next/link";
import { useParams as useNextParams, usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";

export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const hashPath = () => {
  const h = window.location.hash.slice(1);
  return h.startsWith("/") ? h : "/";
};

function useHashPath() {
  return useSyncExternalStore(subscribe, hashPath, () => "/");
}

export function usePathname(): string {
  // STATIC is a build-time constant, so the hook order never changes between renders.
  return STATIC ? useHashPath() : useNextPathname();
}

export function useRouter(): { push(p: string): void; replace(p: string): void } {
  if (STATIC) {
    return {
      push: (p) => {
        window.location.hash = p;
        window.scrollTo(0, 0);
      },
      replace: (p) => {
        window.location.replace(`#${p}`);
        window.scrollTo(0, 0);
      },
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNextRouter();
}

export function useParams<T extends Record<string, string>>(): T {
  if (STATIC) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const path = useHashPath();
    const m = /^\/mission\/([^/]+)/.exec(path);
    return (m ? { id: decodeURIComponent(m[1]) } : {}) as T;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useNextParams<T>();
}

export function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  if (STATIC) return <a href={`#${href}`} {...rest} onClick={(e) => (rest.onClick?.(e), window.scrollTo(0, 0))} />;
  return <NextLink href={href} {...rest} />;
}

/** Directory the app's static files (pyodide/, monaco/) are served from. */
export function assetBase(): string {
  return STATIC ? new URL(".", document.baseURI).href : `${window.location.origin}/`;
}

export function matchAllowlist(pathname, patterns) {
  if (!patterns || patterns.length === 0) return true;

  for (const p of patterns) {
    if (p === "*") return true;
    if (p.endsWith("*")) {
      const prefix = p.slice(0, -1);
      if (pathname.startsWith(prefix)) return true;
      continue;
    }
    if (pathname === p) return true;
  }

  return false;
}

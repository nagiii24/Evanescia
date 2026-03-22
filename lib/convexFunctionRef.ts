/**
 * Convex 1.x exposes `api.foo.bar` as Proxy objects (FunctionReference), not functions.
 * Legacy stubs used `() => {}`. Detect real refs via Symbol.toStringTag from convex/server's anyApi.
 */
function isEmptyStubFunction(fn: (...args: unknown[]) => unknown): boolean {
  const fnStr = fn.toString().trim();
  return (
    /^\s*\(\)\s*=>\s*\{\}\s*$/.test(fnStr) ||
    /^\s*function\s*\(\s*\)\s*\{\}\s*$/.test(fnStr) ||
    fnStr === '() => {}' ||
    fnStr === 'function () {}'
  );
}

export function isConvexFunctionRef(ref: unknown): boolean {
  if (ref == null) return false;
  if (typeof ref === 'object') {
    return (ref as Record<symbol, unknown>)[Symbol.toStringTag] === 'FunctionReference';
  }
  if (typeof ref === 'function') {
    return !isEmptyStubFunction(ref as (...args: unknown[]) => unknown);
  }
  return false;
}

export const onceAsync = <T = any>(
  work: () => Promise<T>
): (() => Promise<T>) => {
  let cache: Promise<T> | null;
  return () => {
    cache = cache || work();
    cache.catch(() => (cache = null));
    return cache;
  };
};

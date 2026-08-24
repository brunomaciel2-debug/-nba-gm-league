// PostgREST enforces a hard 1000-row cap PER REQUEST (db-max-rows) — a
// single .range(0, 2999) call still only returns rows 0-999, no matter how
// big the requested range is. The only way to get more than 1000 rows back
// is genuine multi-request pagination: fetch 1000 at a time and keep going
// until a page comes back short. This is why a naive .range() "fix" on a
// query that needs more than 1000 rows (e.g. all 1163 active players)
// silently keeps dropping the same ~160 rows it always did.
export async function fetchAllRows<T = any>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null, error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await queryFactory(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

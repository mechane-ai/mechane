/** Groups of files, each of whose files a pool holds with the others. */
type JoinedPoolsInput = { readonly groups: ReadonlyArray<ReadonlyArray<string>> };

/** The pools so far, and the next group of files to join to them. */
type PoolsWithInput = { readonly pools: ReadonlyArray<ReadonlySet<string>>; readonly group: ReadonlyArray<string> };

/** The groups joined into pools, two pools that share a file being one. */
export function joinedPools({ groups }: JoinedPoolsInput): ReadonlyArray<ReadonlySet<string>> {
  let pools: ReadonlyArray<ReadonlySet<string>> = [];

  for (const group of groups) {
    pools = poolsWith({ pools, group });
  }

  return pools;
}

/** The pools with one group joined: the group and every pool that shares a file with it become one pool, last. */
function poolsWith({ pools, group }: PoolsWithInput): ReadonlyArray<ReadonlySet<string>> {
  const isTouching: (pool: ReadonlySet<string>) => boolean = (pool) => group.some((path) => pool.has(path));
  const touching = pools.filter(isTouching);
  const isApart: (pool: ReadonlySet<string>) => boolean = (pool) => !touching.includes(pool);
  const joined = new Set([...group, ...touching.flatMap((pool) => [...pool])]);

  return [...pools.filter(isApart), joined];
}

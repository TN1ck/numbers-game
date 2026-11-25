export const BASE = 9;

export interface OracleTile {
  v: number;
  active: boolean;
}

export function createInitialBoard(): OracleTile[] {
  const tiles: OracleTile[] = [];
  for (const row of [0, 1]) {
    for (let col = 0; col < BASE; col++) {
      const value = String(row * 10 + col + 1);
      for (const ch of value) {
        tiles.push({ v: Number(ch), active: true });
      }
    }
  }
  return tiles;
}

export function isMatch(v1: number, v2: number): boolean {
  return v1 === v2 || v1 + v2 === BASE + 1;
}

export function findNeighborIndex(tiles: OracleTile[], index: number, step: number): number | null {
  let i = index + step;
  while (i >= 0 && i < tiles.length) {
    if (tiles[i].active) {
      return i;
    }
    i += step;
  }
  return null;
}

export function getMatchingNeighborIndices(tiles: OracleTile[], index: number): number[] {
  if (!tiles[index]?.active) {
    return [];
  }

  const dirs = [-BASE, BASE, -1, 1];
  const seen = new Set<number>();
  const matches: number[] = [];

  for (const step of dirs) {
    const neighbor = findNeighborIndex(tiles, index, step);
    if (
      neighbor !== null &&
      neighbor !== index &&
      !seen.has(neighbor) &&
      isMatch(tiles[index].v, tiles[neighbor].v)
    ) {
      seen.add(neighbor);
      matches.push(neighbor);
    }
  }

  return matches;
}

export function hasAnyMatch(tiles: OracleTile[]): boolean {
  return tiles.some((_, i) => getMatchingNeighborIndices(tiles, i).length > 0);
}

export function expectedTileClass(
  tiles: OracleTile[],
  index: number,
  selectedIndex: number | null,
): string {
  const tile = tiles[index];
  if (!tile.active) {
    return "tile__matched";
  }
  if (selectedIndex === index) {
    return "tile__selected";
  }
  if (selectedIndex !== null && getMatchingNeighborIndices(tiles, selectedIndex).includes(index)) {
    return "tile__good_match";
  }
  const matchCount = getMatchingNeighborIndices(tiles, index).length;
  if (matchCount > 0) {
    return `tile__hint_${matchCount}`;
  }
  return "";
}

export interface ExpectedVisibleRow {
  rowIndex: number;
  active: boolean;
  tiles: Array<{
    index: number;
    v: number;
    expectedClass: string;
  }>;
}

export interface ExpectedRowGroup {
  active: boolean;
  rows: ExpectedVisibleRow[];
  hiddenCountBadge: number | null;
}

export function computeExpectedDomGroups(
  tiles: OracleTile[],
  selectedIndex: number | null,
): ExpectedRowGroup[] {
  const rows: ExpectedVisibleRow[] = [];
  for (let start = 0; start < tiles.length; start += BASE) {
    const slice = tiles.slice(start, start + BASE);
    const active = slice.some((t) => t.active);
    rows.push({
      rowIndex: start / BASE,
      active,
      tiles: slice.map((t, offset) => ({
        index: start + offset,
        v: t.v,
        expectedClass: expectedTileClass(tiles, start + offset, selectedIndex),
      })),
    });
  }

  const groups: ExpectedRowGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.active === row.active) {
      last.rows.push(row);
    } else {
      groups.push({ active: row.active, rows: [row], hiddenCountBadge: null });
    }
  }

  for (const group of groups) {
    if (!group.active && group.rows.length > 1) {
      group.hiddenCountBadge = group.rows.length;
      if (group.rows.length > 2) {
        group.rows = group.rows.slice(0, 2);
      }
    }
  }

  return groups;
}

export function applyRefills(
  tiles: OracleTile[],
  maxIterations = 5,
): { tiles: OracleTile[]; lost: boolean; won: boolean } {
  const next = tiles.map((t) => ({ ...t }));
  const activeCount = next.filter((t) => t.active).length;
  if (activeCount === 0) {
    return { tiles: next, lost: false, won: true };
  }

  let iterations = 0;
  while (!hasAnyMatch(next)) {
    if (iterations >= maxIterations) {
      return { tiles: next, lost: true, won: false };
    }
    const active = next.filter((t) => t.active);
    for (const t of active) {
      next.push({ v: t.v, active: true });
    }
    iterations++;
  }

  return { tiles: next, lost: false, won: false };
}

export function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

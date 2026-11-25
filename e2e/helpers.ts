import { expect, type Page } from "@playwright/test";
import { computeExpectedDomGroups, type OracleTile } from "./oracle";

export interface DomGroupSnapshot {
  rows: Array<{
    hidden: boolean;
    tiles: Array<{ text: string; stateClass: string }>;
  }>;
  badge: number | null;
}

export async function gotoGame(page: Page) {
  await page.goto("./");
  await expect(page.locator(".tile").first()).toBeVisible();
}

export async function readDomState(page: Page): Promise<{
  steps: number;
  groups: DomGroupSnapshot[];
}> {
  return page.evaluate(() => {
    const scoreEl = document.querySelector(".score > div:nth-child(2)");
    const steps = Number(scoreEl?.textContent?.trim() ?? "-1");
    const groupEls = Array.from(document.querySelectorAll(".tile_row__lines"));
    const groups = groupEls.map((groupEl) => {
      const rowEls = Array.from(groupEl.querySelectorAll(":scope > .tile_row"));
      const rows = rowEls.map((rowEl) => {
        const hidden = rowEl.classList.contains("tile_row__hidden");
        const tileEls = Array.from(rowEl.querySelectorAll(".tile"));
        const tiles = tileEls.map((tileEl) => {
          const classes = Array.from(tileEl.classList).filter((c) => c !== "tile");
          return {
            text: tileEl.textContent?.trim() ?? "",
            stateClass: classes.join(" "),
          };
        });
        return { hidden, tiles };
      });
      const badgeEl = groupEl.querySelector(":scope > .tile_row__button");
      const badge = badgeEl ? Number(badgeEl.textContent?.trim()) : null;
      return { rows, badge };
    });
    return { steps, groups };
  });
}

export async function assertMatchesOracle(
  page: Page,
  oracleTiles: OracleTile[],
  expectedSteps: number,
  selectedIndex: number | null,
) {
  const actual = await readDomState(page);
  expect(actual.steps).toBe(expectedSteps);

  const expectedGroups = computeExpectedDomGroups(oracleTiles, selectedIndex);
  expect(actual.groups.length).toBe(expectedGroups.length);

  for (let g = 0; g < expectedGroups.length; g++) {
    const expGroup = expectedGroups[g];
    const actGroup = actual.groups[g];
    expect(actGroup.badge).toBe(expGroup.hiddenCountBadge);
    expect(actGroup.rows.length).toBe(expGroup.rows.length);

    for (let r = 0; r < expGroup.rows.length; r++) {
      const expRow = expGroup.rows[r];
      const actRow = actGroup.rows[r];
      expect(actRow.hidden).toBe(!expRow.active);
      expect(actRow.tiles.length).toBe(expRow.tiles.length);

      for (let c = 0; c < expRow.tiles.length; c++) {
        expect(actRow.tiles[c].text).toBe(String(expRow.tiles[c].v));
        expect(actRow.tiles[c].stateClass).toBe(expRow.tiles[c].expectedClass);
      }
    }
  }
}

export function findVisibleOffset(oracleTiles: OracleTile[], boardIndex: number): number {
  const groups = computeExpectedDomGroups(oracleTiles, null);
  let offset = 0;
  for (const group of groups) {
    for (const row of group.rows) {
      for (const tile of row.tiles) {
        if (tile.index === boardIndex) {
          return offset;
        }
        offset++;
      }
    }
  }
  throw new Error(`Board index ${boardIndex} not visible in DOM`);
}

import { expect, test } from "@playwright/test";
import { assertMatchesOracle, findVisibleOffset, gotoGame } from "./helpers";
import {
  applyRefills,
  createInitialBoard,
  createPrng,
  getMatchingNeighborIndices,
  type OracleTile,
} from "./oracle";

test.describe("Numbers Game Fuzzer", () => {
  const SEEDS = [1, 2, 3, 4, 5, 42, 99, 1337, 2026, 9001];

  for (const seed of SEEDS) {
    test(`random play fuzzer (seed=${seed}) matches oracle on every single step`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(`console.error: ${msg.text()}`);
        }
      });

      const alerts: string[] = [];
      page.on("dialog", async (dialog) => {
        alerts.push(dialog.message());
        await dialog.accept();
      });

      await gotoGame(page);

      const rand = createPrng(seed);
      let oracle: OracleTile[] = createInitialBoard();
      let steps = 0;
      let selected: number | null = null;
      const history: Array<{ tiles: OracleTile[]; steps: number }> = [];

      await assertMatchesOracle(page, oracle, steps, selected);

      const MAX_ACTIONS = 100;
      for (let action = 0; action < MAX_ACTIONS; action++) {
        // After a win/loss, verify Back or New Game recovers cleanly
        if (alerts.length > 0) {
          if (history.length > 0 && rand() < 0.5) {
            alerts.length = 0;
            await page.locator(".new", { hasText: "Back" }).click();
            const prev = history.pop()!;
            oracle = prev.tiles;
            steps = prev.steps;
            selected = null;
          } else {
            alerts.length = 0;
            await page.locator(".new", { hasText: "New Game" }).click();
            oracle = createInitialBoard();
            steps = 0;
            selected = null;
            history.length = 0;
          }
          await assertMatchesOracle(page, oracle, steps, selected);
          continue;
        }

        const roll = rand();

        // 10% chance: click Back
        if (roll < 0.1 && history.length > 0) {
          await page.locator(".new", { hasText: "Back" }).click();
          const prev = history.pop()!;
          oracle = prev.tiles;
          steps = prev.steps;
          selected = null;
          await assertMatchesOracle(page, oracle, steps, selected);
          continue;
        }

        // 3% chance: click New Game
        if (roll < 0.13 && steps > 8) {
          await page.locator(".new", { hasText: "New Game" }).click();
          oracle = createInitialBoard();
          steps = 0;
          selected = null;
          history.length = 0;
          await assertMatchesOracle(page, oracle, steps, selected);
          continue;
        }

        // 7% chance: click an unmatchable active tile (should be a safe no-op)
        if (roll < 0.2) {
          const unmatchable: number[] = [];
          for (let i = 0; i < oracle.length; i++) {
            if (oracle[i].active && getMatchingNeighborIndices(oracle, i).length === 0) {
              unmatchable.push(i);
            }
          }
          if (unmatchable.length > 0) {
            const pick = unmatchable[Math.floor(rand() * unmatchable.length)];
            await page.locator(".tile").nth(findVisibleOffset(oracle, pick)).click();
            await assertMatchesOracle(page, oracle, steps, selected);
            continue;
          }
        }

        // Find all active tiles that have at least one match
        const matchableSources: number[] = [];
        for (let i = 0; i < oracle.length; i++) {
          if (getMatchingNeighborIndices(oracle, i).length > 0) {
            matchableSources.push(i);
          }
        }
        expect(matchableSources.length).toBeGreaterThan(0);

        // 8% chance when selected: re-click selected tile to toggle deselection
        if (selected !== null && roll < 0.28) {
          await page.locator(".tile").nth(findVisibleOffset(oracle, selected)).click();
          selected = null;
          await assertMatchesOracle(page, oracle, steps, selected);
          continue;
        }

        // 15% chance when unselected: select a tile, then switch to a different non-matching tile
        if (roll < 0.43 && selected === null && matchableSources.length > 1) {
          const first = matchableSources[Math.floor(rand() * matchableSources.length)];
          const firstMatches = new Set(getMatchingNeighborIndices(oracle, first));
          const nonMatchingSources = matchableSources.filter(
            (i) => i !== first && !firstMatches.has(i),
          );
          if (nonMatchingSources.length > 0) {
            await page.locator(".tile").nth(findVisibleOffset(oracle, first)).click();
            selected = first;
            await assertMatchesOracle(page, oracle, steps, selected);

            const second = nonMatchingSources[Math.floor(rand() * nonMatchingSources.length)];
            await page.locator(".tile").nth(findVisibleOffset(oracle, second)).click();
            selected = second;
            await assertMatchesOracle(page, oracle, steps, selected);
            continue;
          }
        }

        // Select a source tile or match the currently selected tile
        if (selected === null) {
          const pick = matchableSources[Math.floor(rand() * matchableSources.length)];
          await page.locator(".tile").nth(findVisibleOffset(oracle, pick)).click();
          selected = pick;
          await assertMatchesOracle(page, oracle, steps, selected);
        } else {
          const targets = getMatchingNeighborIndices(oracle, selected);
          expect(targets.length).toBeGreaterThan(0);
          const target = targets[Math.floor(rand() * targets.length)];

          history.push({
            tiles: oracle.map((t) => ({ ...t })),
            steps,
          });
          if (history.length > 100) {
            history.shift();
          }

          await page.locator(".tile").nth(findVisibleOffset(oracle, target)).click();

          oracle[selected].active = false;
          oracle[target].active = false;
          steps++;
          selected = null;

          const refilled = applyRefills(oracle);
          oracle = refilled.tiles;

          if (refilled.won) {
            expect(alerts.length).toBe(1);
            expect(alerts[0]).toMatch(/won/i);
          } else if (refilled.lost) {
            expect(alerts.length).toBe(1);
            expect(alerts[0]).toMatch(/lost/i);
          } else {
            expect(alerts.length).toBe(0);
          }

          await assertMatchesOracle(page, oracle, steps, selected);
        }
      }

      expect(errors).toEqual([]);
    });
  }
});

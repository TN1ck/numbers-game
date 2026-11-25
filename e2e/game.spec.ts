import { expect, test, type Page } from "@playwright/test";
import { assertMatchesOracle, findVisibleOffset, gotoGame } from "./helpers";
import { applyRefills, createInitialBoard, type OracleTile } from "./oracle";

interface TestNumbersGameWindow {
  numbersGame: {
    board: {
      setState: (s: Array<{ x: number; y: number; v: number; active: boolean }>) => void;
      testBoards: {
        infinite: Array<{ x: number; y: number; v: number; active: boolean }>;
      };
    };
    game: {
      pilotRunning: boolean;
      togglePilot: () => void;
    };
  };
}

async function clickVisibleTileByBoardIndex(
  page: Page,
  oracleTiles: OracleTile[],
  targetBoardIndex: number,
) {
  const visibleOffset = findVisibleOffset(oracleTiles, targetBoardIndex);
  await page.locator(".tile").nth(visibleOffset).click();
}

async function loadCustomBoard(page: Page, tiles: OracleTile[]) {
  await page.evaluate((boardTiles) => {
    const ng = (window as unknown as TestNumbersGameWindow).numbersGame;
    ng.board.setState(
      boardTiles.map((t, i) => ({
        x: i % 9,
        y: Math.floor(i / 9),
        v: t.v,
        active: t.active,
      })),
    );
  }, tiles);
}

test.describe("Numbers Game E2E", () => {
  test("renders initial board matching ground-truth rules with no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await gotoGame(page);
    await expect(page).toHaveTitle(/Numbers Game/i);

    const oracle = createInitialBoard();
    await assertMatchesOracle(page, oracle, 0, null);
    expect(errors).toEqual([]);
  });

  test("selecting, toggling deselection, switching selection, and matching tiles works cleanly", async ({
    page,
  }) => {
    await gotoGame(page);
    const oracle = createInitialBoard();

    // Select tile 0 (value 1) -> matches tile 9 (1, below)
    await clickVisibleTileByBoardIndex(page, oracle, 0);
    await assertMatchesOracle(page, oracle, 0, 0);

    // Clicking the already-selected tile deselects it
    await clickVisibleTileByBoardIndex(page, oracle, 0);
    await assertMatchesOracle(page, oracle, 0, null);

    // Re-select tile 0, then click an unmatchable tile (tile 1, value 2) -> safe no-op
    await clickVisibleTileByBoardIndex(page, oracle, 0);
    await clickVisibleTileByBoardIndex(page, oracle, 1);
    await assertMatchesOracle(page, oracle, 0, 0);

    // Switch selection to tile 8 (value 9) -> matches tile 9 (1, right wrap) and tile 17 (1, below)
    await clickVisibleTileByBoardIndex(page, oracle, 8);
    await assertMatchesOracle(page, oracle, 0, 8);

    // Match tile 8 (9) with tile 9 (1) across row boundary
    await clickVisibleTileByBoardIndex(page, oracle, 9);
    oracle[8].active = false;
    oracle[9].active = false;
    await assertMatchesOracle(page, oracle, 1, null);

    // Clicking an inactive tile (tile 8) is a safe no-op
    await clickVisibleTileByBoardIndex(page, oracle, 8);
    await assertMatchesOracle(page, oracle, 1, null);
  });

  test("clearing an entire row marks tiles matched and hides the row", async ({ page }) => {
    await gotoGame(page);

    const customBoard: OracleTile[] = [
      { v: 5, active: true },
      { v: 5, active: true },
      { v: 3, active: false },
      { v: 4, active: false },
      { v: 5, active: false },
      { v: 6, active: false },
      { v: 7, active: false },
      { v: 8, active: false },
      { v: 9, active: false },
      { v: 1, active: true },
      { v: 1, active: true },
      { v: 2, active: true },
    ];

    await loadCustomBoard(page, customBoard);
    await assertMatchesOracle(page, customBoard, 0, null);

    // Select tile 0, then match with tile 1 -> Row 0 becomes completely inactive!
    await page.locator(".tile").nth(0).click();
    await assertMatchesOracle(page, customBoard, 0, 0);

    await page.locator(".tile").nth(1).click();
    customBoard[0].active = false;
    customBoard[1].active = false;

    await assertMatchesOracle(page, customBoard, 1, null);
  });

  test("collapsing 3 consecutive inactive rows shows 2 hidden rows and a count badge of 3", async ({
    page,
  }) => {
    await gotoGame(page);

    const customBoard: OracleTile[] = [
      // Row 0: inactive
      ...Array.from({ length: 9 }, (_, i) => ({ v: i + 1, active: false })),
      // Row 1: inactive
      ...Array.from({ length: 9 }, (_, i) => ({ v: i + 1, active: false })),
      // Row 2: 2 matching tiles left
      { v: 4, active: true },
      { v: 6, active: true },
      ...Array.from({ length: 7 }, () => ({ v: 1, active: false })),
      // Row 3: active
      { v: 2, active: true },
      { v: 8, active: true },
      { v: 3, active: true },
    ];

    await loadCustomBoard(page, customBoard);
    await assertMatchesOracle(page, customBoard, 0, null);

    await clickVisibleTileByBoardIndex(page, customBoard, 18);
    await clickVisibleTileByBoardIndex(page, customBoard, 19);
    customBoard[18].active = false;
    customBoard[19].active = false;

    await assertMatchesOracle(page, customBoard, 1, null);
    await expect(page.locator(".tile_row__button")).toHaveText("3");
    await expect(page.locator(".tile_row__hidden")).toHaveCount(2);
  });

  test("Back undoes moves cleanly, clears selection, and New Game resets everything", async ({
    page,
  }) => {
    await gotoGame(page);
    const oracle = createInitialBoard();

    // Make a match: tile 0 (1) and tile 9 (1)
    await clickVisibleTileByBoardIndex(page, oracle, 0);
    await clickVisibleTileByBoardIndex(page, oracle, 9);
    oracle[0].active = false;
    oracle[9].active = false;
    await assertMatchesOracle(page, oracle, 1, null);

    // Select another tile (tile 8) then click Back
    await clickVisibleTileByBoardIndex(page, oracle, 8);
    await assertMatchesOracle(page, oracle, 1, 8);

    await page.locator(".new", { hasText: "Back" }).click();
    const initial = createInitialBoard();
    await assertMatchesOracle(page, initial, 0, null);

    // Clicking Back at step 0 is a safe no-op
    await page.locator(".new", { hasText: "Back" }).click();
    await assertMatchesOracle(page, initial, 0, null);

    // Make a move and click New Game
    await clickVisibleTileByBoardIndex(page, initial, 0);
    await clickVisibleTileByBoardIndex(page, initial, 9);
    await page.locator(".new", { hasText: "New Game" }).click();
    await assertMatchesOracle(page, initial, 0, null);
  });

  test("rapid clicks without waiting 200ms are never dropped", async ({ page }) => {
    await gotoGame(page);
    const oracle = createInitialBoard();

    // Select tile 0, switch to tile 8, switch back to tile 0, then match with tile 9 — all rapidly!
    await clickVisibleTileByBoardIndex(page, oracle, 0);
    await clickVisibleTileByBoardIndex(page, oracle, 8);
    await clickVisibleTileByBoardIndex(page, oracle, 0);
    await clickVisibleTileByBoardIndex(page, oracle, 9);

    oracle[0].active = false;
    oracle[9].active = false;
    await assertMatchesOracle(page, oracle, 1, null);
  });

  test("winning the game renders final matched state before alerting once", async ({ page }) => {
    await page.addInitScript(() => {
      const originalAlert = window.alert.bind(window);
      const snapshots: Array<{
        message: string;
        steps: string | null;
        matchedCount: number;
      }> = [];
      (
        window as unknown as {
          __alertSnapshots?: typeof snapshots;
        }
      ).__alertSnapshots = snapshots;
      window.alert = (message?: unknown) => {
        snapshots.push({
          message: typeof message === "string" ? message : "",
          steps: document.querySelector(".score > div:nth-child(2)")?.textContent?.trim() ?? null,
          matchedCount: document.querySelectorAll(".tile__matched").length,
        });
        originalAlert(message);
      };
    });

    const alerts: string[] = [];
    page.on("dialog", async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });

    await gotoGame(page);

    const almostWon: OracleTile[] = [
      { v: 3, active: true },
      { v: 7, active: true },
    ];

    await loadCustomBoard(page, almostWon);
    await assertMatchesOracle(page, almostWon, 0, null);

    await page.locator(".tile").nth(0).click();
    await page.locator(".tile").nth(1).click();

    almostWon[0].active = false;
    almostWon[1].active = false;

    const snapshots = await page.evaluate(
      () =>
        (
          window as unknown as {
            __alertSnapshots?: Array<{
              message: string;
              steps: string | null;
              matchedCount: number;
            }>;
          }
        ).__alertSnapshots ?? [],
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/won/i);
    expect(snapshots).toEqual([
      {
        message: "You won the game! Congrats!",
        steps: "1",
        matchedCount: 2,
      },
    ]);
    await assertMatchesOracle(page, almostWon, 1, null);
  });

  test("losing on an unsolvable board stops at 5 refills and Back recovers cleanly", async ({
    page,
  }) => {
    await gotoGame(page);
    const alerts: string[] = [];
    page.on("dialog", async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });

    const infiniteTiles: OracleTile[] = await page.evaluate(() => {
      const ng = (window as unknown as TestNumbersGameWindow).numbersGame;
      ng.board.setState(ng.board.testBoards.infinite);
      return ng.board.testBoards.infinite.map((t) => ({
        v: t.v,
        active: t.active,
      }));
    });

    await assertMatchesOracle(page, infiniteTiles, 0, null);

    // Match the only pair on the infinite board: (2,5)=5 (index 47) and (4,5)=5 (index 49)
    await clickVisibleTileByBoardIndex(page, infiniteTiles, 47);
    await clickVisibleTileByBoardIndex(page, infiniteTiles, 49);

    const afterMatch = infiniteTiles.map((t) => ({ ...t }));
    afterMatch[47].active = false;
    afterMatch[49].active = false;
    const expectedAfterLoss = applyRefills(afterMatch);

    expect(expectedAfterLoss.lost).toBe(true);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/lost/i);
    await assertMatchesOracle(page, expectedAfterLoss.tiles, 1, null);

    // Click Back to undo the losing move — should recover cleanly without re-alerting!
    alerts.length = 0;
    await page.locator(".new", { hasText: "Back" }).click();
    await assertMatchesOracle(page, infiniteTiles, 0, null);

    // Selecting tile 47 after Back must NOT re-trigger loss alert
    await clickVisibleTileByBoardIndex(page, infiniteTiles, 47);
    expect(alerts).toHaveLength(0);
    await assertMatchesOracle(page, infiniteTiles, 0, 47);
  });

  test("togglePilot plays moves and stops cleanly without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoGame(page);
    await page.evaluate(() => {
      (window as unknown as TestNumbersGameWindow).numbersGame.game.togglePilot();
    });

    // Wait for pilot to perform at least 2 moves
    await expect(async () => {
      const steps = Number(await page.locator(".score > div:nth-child(2)").textContent());
      expect(steps).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 3000 });

    // Turn pilot off and verify it stays stopped
    await page.evaluate(() => {
      (window as unknown as TestNumbersGameWindow).numbersGame.game.togglePilot();
    });

    const stepsAfterStop = Number(await page.locator(".score > div:nth-child(2)").textContent());
    await page.waitForTimeout(250);
    const stepsLater = Number(await page.locator(".score > div:nth-child(2)").textContent());
    expect(stepsLater).toBe(stepsAfterStop);
    expect(errors).toEqual([]);
  });
});

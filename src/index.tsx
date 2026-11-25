import * as React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import "./styles.css";

interface NumbersGameGlobal {
  board: Board;
  game: Game;
}

const globalWindow = window as unknown as {
  numbersGame?: NumbersGameGlobal;
};
const numbersGame = (globalWindow.numbersGame ?? {}) as NumbersGameGlobal;
globalWindow.numbersGame = numbersGame;

//
// Utility functions
//

const BASE = 9;
const MAX_HISTORY = 100;
const MAX_REFILL_ITERATIONS = 5;

function toXY(n: number) {
  return {
    y: Math.floor(n / BASE),
    x: n % BASE,
  };
}

function toIndex(x: number, y: number) {
  return y * BASE + x;
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

function randomElement<T>(list: T[]): T | undefined {
  if (list.length === 0) {
    return undefined;
  }
  return list[Math.floor(Math.random() * list.length)];
}

function splitAt<T>(list: T[], fun: (d: T) => boolean): T[][] {
  const splitted: T[][] = [];
  let current: T[] = [];

  list.forEach((d, i) => {
    const result = fun(d);

    if (result) {
      if (current.length > 0) {
        splitted.push(current);
        current = [];
      }
      current.push(d);
    } else {
      current.push(d);
    }

    if (i === list.length - 1) {
      splitted.push(current);
    }
  });

  return splitted;
}

function partitionBy<T, K>(list: T[], fun: (d: T) => K): T[][] {
  const partitioned: T[][] = [];
  let current: T[] = [];
  let lastElemResult: K | undefined;

  list.forEach((d, i) => {
    const result = fun(d);

    if (result === lastElemResult || i === 0) {
      current.push(d);
    } else {
      partitioned.push(current);
      current = [d];
    }

    if (i === list.length - 1) {
      partitioned.push(current);
    }

    lastElemResult = result;
  });

  return partitioned;
}

//
// Classes & Interfaces
//

type GameOutcome = "playing" | "won" | "lost";

interface TileRow {
  rowIndex: number;
  tiles: Tile[];
  active: boolean;
}

const isTile = (tile: Tile | boolean): tile is Tile => {
  return tile !== false;
};

interface SerializedTile {
  x: number;
  v: number;
  y: number;
  active: boolean;
}

type Direction = "above" | "below" | "right" | "left";

class Tile implements SerializedTile {
  board: Board;
  v: number;
  x: number;
  y: number;
  active: boolean;
  matchable: boolean;
  selected: boolean;
  neighbours: Record<Direction, Tile | boolean>;
  static classes = {
    selected: "tile__selected",
    matchable: "tile__good_match",
    hint: ["tile__hint_1", "tile__hint_2", "tile__hint_3", "tile__hint_4"],
    inactive: "tile__matched",
  };
  className = "";

  constructor(v: number, board: Board, appendToBoard = true) {
    this.v = v;
    this.board = board;

    const xy = toXY(board.tiles.length);
    this.y = xy.y;
    this.x = xy.x;

    this.neighbours = {
      above: false,
      below: false,
      right: false,
      left: false,
    };

    this.active = true;
    this.matchable = false;
    this.selected = false;

    if (appendToBoard) {
      board.tiles.push(this);
    }
  }

  toIndex() {
    return toIndex(this.x, this.y);
  }

  deactivate() {
    this.active = false;
    this.selected = false;
    this.matchable = false;

    const below = this.neighbours.below;
    if (isTile(below)) {
      below.neighbours.above = false;
    }
    const above = this.neighbours.above;
    if (isTile(above)) {
      above.neighbours.below = false;
    }
    const right = this.neighbours.right;
    if (isTile(right)) {
      right.neighbours.left = false;
    }
    const left = this.neighbours.left;
    if (isTile(left)) {
      left.neighbours.right = false;
    }

    this.getNeighbours().forEach((t) => {
      t.matchable = false;
    });
  }

  select() {
    this.selected = true;
    this.getMatches().forEach((t) => {
      t.matchable = true;
    });
  }

  deselect() {
    this.selected = false;
    this.getMatches().forEach((t) => {
      t.matchable = false;
    });
  }

  checkMatch(tile: Tile) {
    return tile.v + this.v === BASE + 1 || tile.v === this.v;
  }

  getNeighbour(neighbour: Direction, inc: number): Tile | false {
    let n = this.toIndex() + inc;

    const neighbourTile = this.neighbours[neighbour];
    if (isTile(neighbourTile)) {
      n = neighbourTile.toIndex();
    }

    while (n >= 0 && n < this.board.tiles.length) {
      const candidate = this.board.tiles[n];
      if (candidate.active) {
        return candidate;
      }
      n += inc;
    }

    return false;
  }

  setNeighbours() {
    this.neighbours.above = this.getNeighbour("above", -BASE);
    this.neighbours.below = this.getNeighbour("below", BASE);
    this.neighbours.right = this.getNeighbour("right", 1);
    this.neighbours.left = this.getNeighbour("left", -1);
  }

  getNeighbours(): Tile[] {
    const candidates = [
      this.neighbours.above,
      this.neighbours.below,
      this.neighbours.left,
      this.neighbours.right,
    ];

    return candidates.filter((d): d is Tile => isTile(d) && d.active);
  }

  getMatches(): Tile[] {
    if (!this.active) {
      return [];
    }

    const matches = this.getNeighbours().filter((d) => this.checkMatch(d));
    const seen = new Set<Tile>();
    return matches.filter((t) => {
      if (seen.has(t)) {
        return false;
      }
      seen.add(t);
      return true;
    });
  }

  update() {
    this.setNeighbours();

    if (!this.active) {
      this.className = Tile.classes.inactive;
      return;
    }

    if (this.selected) {
      this.className = Tile.classes.selected;
      return;
    }

    if (this.matchable) {
      this.className = Tile.classes.matchable;
      return;
    }

    const numberOfMatches = this.getMatches().length;

    if (numberOfMatches > 0) {
      this.className = Tile.classes.hint[numberOfMatches - 1];
      return;
    }

    this.className = "";
  }

  serialize(): SerializedTile {
    const { x, y, v, active } = this;

    return {
      x,
      y,
      v,
      active,
    };
  }

  hydrate(tileDict: SerializedTile, board: Board) {
    this.x = tileDict.x;
    this.y = tileDict.y;
    this.v = tileDict.v;
    this.active = tileDict.active;
    this.selected = false;
    this.matchable = false;
    this.neighbours.above = false;
    this.neighbours.below = false;
    this.neighbours.left = false;
    this.neighbours.right = false;
    this.board = board;
  }

  handleClick(): GameOutcome {
    if (!this.active || this.getMatches().length === 0) {
      return "playing";
    }

    const otherTile = this.board.currentlySelected;

    // Matching the clicked tile with the currently selected tile
    if (this.matchable && otherTile && otherTile.active) {
      this.board.save();
      this.board.steps++;
      this.board.currentlySelected = null;

      const matchedTiles = [this, otherTile];
      const affectedTiles = new Set<Tile>([...this.getNeighbours(), ...otherTile.getNeighbours()]);

      matchedTiles.forEach((t) => t.deactivate());

      affectedTiles.forEach((t) => t.update());
      matchedTiles.forEach((t) => t.update());

      return this.board.update();
    }

    // Clicking the already-selected tile toggles selection off
    if (otherTile === this) {
      this.deselect();
      const toUpdate = new Set<Tile>([this, ...this.getNeighbours()]);
      toUpdate.forEach((t) => t.update());
      this.board.currentlySelected = null;
      return "playing";
    }

    const toUpdate = new Set<Tile>();

    if (otherTile) {
      otherTile.deselect();
      toUpdate.add(otherTile);
      otherTile.getNeighbours().forEach((t) => toUpdate.add(t));
    }

    this.select();
    toUpdate.add(this);
    this.getNeighbours().forEach((t) => toUpdate.add(t));

    toUpdate.forEach((t) => t.update());

    this.board.currentlySelected = this;
    return "playing";
  }
}

type SerializedBoard = SerializedTile[];

class Board {
  tiles: Tile[] = [];
  steps = 0;
  boardHistory: SerializedBoard[] = [];
  base: number;
  currentlySelected: Tile | null = null;
  onChange?: () => void;

  constructor(base: number, onChange?: () => void) {
    numbersGame.board = this;
    this.base = base;
    this.onChange = onChange;
    this.init();
  }

  getTile(x: number, y: number) {
    return this.tiles[toIndex(x, y)];
  }

  getRows(): TileRow[] {
    return splitAt(this.tiles, (d) => d.x === 0).map((tiles, rowIndex) => ({
      rowIndex,
      tiles,
      active: tiles.some((t) => t.active),
    }));
  }

  init() {
    [0, 1].forEach((row) => {
      range(BASE).forEach((col) => {
        const value = "" + (row * 10 + col + 1);
        range(value.length).forEach((i) => {
          new Tile(Number(value[i]), this);
        });
      });
    });
    this.tiles.forEach((t) => t.update());
  }

  serialize(): SerializedBoard {
    return this.tiles.map((t) => t.serialize());
  }

  save() {
    this.boardHistory.push(this.serialize());
    if (this.boardHistory.length > MAX_HISTORY) {
      this.boardHistory.shift();
    }
  }

  stepBack() {
    const lastState = this.boardHistory.pop();
    if (!lastState) {
      return;
    }
    this.steps = Math.max(0, this.steps - 1);
    this.setState(lastState);
  }

  setState(state: SerializedBoard) {
    this.currentlySelected = null;
    this.tiles = state.map((tile) => {
      const t = new Tile(0, this, false);
      t.hydrate(tile, this);
      return t;
    });
    this.tiles.forEach((t) => t.update());
    this.onChange?.();
  }

  update(): GameOutcome {
    if (this.activeTiles().length === 0) {
      return "won";
    }

    let iterations = 0;
    while (!this.hasMatches()) {
      if (iterations >= MAX_REFILL_ITERATIONS) {
        return "lost";
      }

      const active = this.activeTiles();
      for (const t of active) {
        new Tile(t.v, this);
      }

      this.tiles.forEach((t) => t.update());
      iterations++;
    }

    return "playing";
  }

  activeTiles() {
    return this.tiles.filter((t) => t.active);
  }

  inactiveTiles() {
    return this.tiles.filter((d) => !d.active);
  }

  hasMatches(): boolean {
    return this.tiles.some((t) => t.active && t.getMatches().length > 0);
  }

  leftMatches(): Tile[] {
    return this.activeTiles().flatMap((t) => t.getMatches());
  }

  testBoards: { infinite: SerializedBoard } = {
    infinite: [
      { x: 0, y: 0, v: 1, active: false },
      { x: 1, y: 0, v: 2, active: true },
      { x: 2, y: 0, v: 3, active: true },
      { x: 3, y: 0, v: 1, active: false },
      { x: 4, y: 0, v: 1, active: false },
      { x: 5, y: 0, v: 1, active: false },
      { x: 6, y: 0, v: 1, active: false },
      { x: 7, y: 0, v: 1, active: false },
      { x: 8, y: 0, v: 1, active: false },

      { x: 0, y: 1, v: 1, active: false },
      { x: 1, y: 1, v: 2, active: false },
      { x: 2, y: 1, v: 3, active: false },
      { x: 3, y: 1, v: 1, active: false },
      { x: 4, y: 1, v: 1, active: false },
      { x: 5, y: 1, v: 1, active: false },
      { x: 6, y: 1, v: 1, active: false },
      { x: 7, y: 1, v: 4, active: true },
      { x: 8, y: 1, v: 4, active: false },

      { x: 0, y: 2, v: 1, active: false },
      { x: 1, y: 2, v: 2, active: false },
      { x: 2, y: 2, v: 3, active: false },
      { x: 3, y: 2, v: 1, active: true },
      { x: 4, y: 2, v: 1, active: false },
      { x: 5, y: 2, v: 1, active: false },
      { x: 6, y: 2, v: 1, active: false },
      { x: 7, y: 2, v: 1, active: false },
      { x: 8, y: 2, v: 4, active: false },

      { x: 0, y: 3, v: 1, active: false },
      { x: 1, y: 3, v: 2, active: false },
      { x: 2, y: 3, v: 3, active: false },
      { x: 3, y: 3, v: 4, active: true },
      { x: 4, y: 3, v: 1, active: false },
      { x: 5, y: 3, v: 1, active: false },
      { x: 6, y: 3, v: 1, active: false },
      { x: 7, y: 3, v: 1, active: false },
      { x: 8, y: 3, v: 4, active: false },

      { x: 0, y: 4, v: 1, active: false },
      { x: 1, y: 4, v: 2, active: false },
      { x: 2, y: 4, v: 3, active: false },
      { x: 3, y: 4, v: 1, active: true },
      { x: 4, y: 4, v: 1, active: false },
      { x: 5, y: 4, v: 1, active: false },
      { x: 6, y: 4, v: 1, active: false },
      { x: 7, y: 4, v: 1, active: false },
      { x: 8, y: 4, v: 4, active: false },

      { x: 0, y: 5, v: 1, active: false },
      { x: 1, y: 5, v: 2, active: false },
      { x: 2, y: 5, v: 5, active: true },
      { x: 3, y: 5, v: 1, active: false },
      { x: 4, y: 5, v: 5, active: true },
      { x: 5, y: 5, v: 1, active: false },
      { x: 6, y: 5, v: 1, active: false },
      { x: 7, y: 5, v: 7, active: true },
      { x: 8, y: 5, v: 1, active: true },

      { x: 0, y: 6, v: 8, active: true },
      { x: 1, y: 6, v: 1, active: true },
    ],
  };
}

class Game {
  root: HTMLElement;
  pilotRunning = false;
  private pilotTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  togglePilot() {
    this.pilotRunning = !this.pilotRunning;

    if (!this.pilotRunning) {
      if (this.pilotTimer !== null) {
        clearTimeout(this.pilotTimer);
        this.pilotTimer = null;
      }
      return;
    }

    const run = () => {
      if (!this.pilotRunning) {
        return;
      }

      const tiles: HTMLElement[] = [];
      for (const tileClass of Tile.classes.hint) {
        const selection = Array.from(document.getElementsByClassName(tileClass)) as HTMLElement[];
        tiles.push(...selection);
      }

      const tile = randomElement(tiles);
      if (!tile) {
        this.pilotRunning = false;
        this.pilotTimer = null;
        return;
      }

      tile.click();

      this.pilotTimer = setTimeout(() => {
        this.pilotTimer = null;
        if (!this.pilotRunning) {
          return;
        }

        const elems = Array.from(
          document.getElementsByClassName(Tile.classes.matchable),
        ) as HTMLElement[];
        const el = randomElement(elems);
        if (!el) {
          this.pilotRunning = false;
          return;
        }

        el.click();

        if (this.pilotRunning) {
          run();
        }
      }, 100);
    };

    run();
  }

  run() {
    createRoot(this.root).render(<ReactGame />);
  }
}

const ReactGame: React.FC = () => {
  const [, setVersion] = React.useState(0);
  const bumpVersion = React.useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const [board, setBoard] = React.useState(() => new Board(BASE, () => bumpVersion()));

  React.useEffect(() => {
    board.onChange = bumpVersion;
    return () => {
      if (board.onChange === bumpVersion) {
        board.onChange = undefined;
      }
    };
  }, [board, bumpVersion]);

  const restartGame = () => {
    setBoard(new Board(BASE, bumpVersion));
  };

  const stepBack = () => {
    board.stepBack();
  };

  const handleTileClick = (tile: Tile) => {
    const outcome = tile.handleClick();
    flushSync(() => {
      bumpVersion();
    });

    if (outcome === "won") {
      window.alert("You won the game! Congrats!");
    } else if (outcome === "lost") {
      window.alert("Oh no you lost!");
    }
  };

  return (
    <div>
      <div className="header">
        <div className="buttons">
          <div className="score">
            <div className="small">{"steps"}</div>
            <div>{board.steps}</div>
          </div>
          <div className="new" onClick={restartGame}>
            {"New Game"}
          </div>
          <div className="new" onClick={stepBack}>
            {"Back"}
          </div>
        </div>
      </div>
      <div className="board">
        <ReactBoard board={board} onTileClick={handleTileClick} />
      </div>
    </div>
  );
};

const ReactBoard: React.FC<{
  board: Board;
  onTileClick: (tile: Tile) => void;
}> = ({ board, onTileClick }) => {
  const rows = board.getRows();
  const splittedRows = partitionBy(rows, (r) => r.active);

  const result = splittedRows.map((splitted) => {
    const groupKey = `${splitted[0].active ? "a" : "h"}-${splitted[0].rowIndex}`;
    let visibleRows = splitted.map((row) => (
      <ReactRow row={row} key={row.rowIndex} onTileClick={onTileClick} />
    ));

    if (splitted.length > 1 && !splitted[0].active) {
      if (visibleRows.length > 2) {
        visibleRows = visibleRows.slice(0, 2);
      }
      visibleRows.push(
        <div className="tile_row__button" key="button">
          {splitted.length}
        </div>,
      );
    }

    return (
      <div className="tile_row__lines" key={groupKey}>
        {visibleRows}
      </div>
    );
  });

  return <div className="table">{result}</div>;
};

const ReactRow: React.FC<{
  row: TileRow;
  onTileClick: (tile: Tile) => void;
}> = ({ row, onTileClick }) => {
  return (
    <div className={row.active ? "tile_row" : "tile_row tile_row__hidden"}>
      {row.tiles.map((tile) => (
        <ReactTile tile={tile} key={tile.toIndex()} onTileClick={onTileClick} />
      ))}
    </div>
  );
};

const ReactTile: React.FC<{
  tile: Tile;
  onTileClick: (tile: Tile) => void;
}> = ({ tile, onTileClick }) => {
  const className = tile.className ? `tile ${tile.className}` : "tile";

  return (
    <div className="tile_cell">
      <div className={className} onClick={() => onTileClick(tile)}>
        {tile.v}
      </div>
    </div>
  );
};

const rootEl = document.getElementById("react");
if (rootEl) {
  const game = new Game(rootEl);
  game.run();
  numbersGame.game = game;
}

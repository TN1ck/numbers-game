import * as React from "react";
import * as ReactDom from "react-dom";

const numbersGame: {
  board: Board;
  game: Game;
} =
  (window as any).numbersGame || {};
(window as any).numbersGame = numbersGame;

//
// Utility functions
//

const BASE = 9;

function toXY(n: number) {
  return {
    y: Math.floor(n / BASE),
    x: n % BASE
  };
}

function toIndex(x: number, y: number) {
  return y * BASE + x;
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

function flatten<T>(list: T[][]): T[] {
  return ([] as T[]).concat(...list);
}

function randomElement<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function splitAt<T>(list: T[], fun: (d: T) => boolean) {
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

function partitionBy<T>(list: T[], fun: (d: T) => any) {
  const partitioned: T[][] = [];
  let current: T[] = [];
  let lastElemResult: any;

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

interface TileRow {
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

class Tile implements SerializedTile {
  board: Board;
  v: number;
  x: number;
  y: number;
  active: boolean;
  matchable: boolean;
  selected: boolean;
  callback: (e: React.MouseEvent<HTMLDivElement>) => void;
  neighbours: {
    above: Tile | boolean;
    below: Tile | boolean;
    right: Tile | boolean;
    left: Tile | boolean;
  };
  static classes = {
    selected: "tile__selected",
    matchable: "tile__good_match",
    hint: ["tile__hint_1", "tile__hint_2", "tile__hint_3", "tile__hint_4"],
    inactive: "tile__matched"
  };
  className: string = "";
  constructor(v: number, board: Board) {
    this.v = v;
    this.board = board;

    const xy = this.toXY();
    this.y = xy.y;
    this.x = xy.x;

    this.neighbours = {
      above: false,
      below: false,
      right: false,
      left: false
    };

    this.active = true;
    this.matchable = false;
    this.selected = false;
    this.callback = this.createCallback();

    board.tiles.push(this);
  }

  toXY() {
    return toXY(this.board.tiles.length);
  }

  toIndex() {
    return toIndex(this.x, this.y);
  }

  deactivate() {
    this.active = false;

    var below = this.neighbours.below;
    if (isTile(below)) {
      below.neighbours.above = false;
    }
    var above = this.neighbours.above;
    if (isTile(above)) {
      above.neighbours.below = false;
    }
    var right = this.neighbours.right;
    if (isTile(right)) {
      right.neighbours.left = false;
    }
    var left = this.neighbours.left;
    if (isTile(left)) {
      left.neighbours.right = false;
    }

    this.getNeighbours().forEach(t => {
      t.matchable = false;
    });
  }

  select() {
    this.selected = true;
    this.getMatches().forEach(function(t) {
      t.matchable = true;
    });
  }

  deselect() {
    this.selected = false;
    this.getMatches().forEach(function(t) {
      t.matchable = false;
    });
  }

  checkMatch(tile) {
    return tile.v + this.v === BASE + 1 || tile.v === this.v;
  }

  getNeighbour(neighbour: "above" | "below" | "right" | "left", inc: number) {
    let n = this.toIndex() + inc;

    const neighbourTile = this.neighbours[neighbour];
    if (isTile(neighbourTile)) {
      n = neighbourTile.toIndex();
    }

    let possibleTile: boolean | Tile = true;

    while (possibleTile && !(possibleTile as Tile).active) {
      possibleTile = this.board.tiles[n];
      n += inc;
    }

    return possibleTile ? possibleTile : false;
  }

  setNeighbours() {
    this.neighbours.above = this.getNeighbour("above", -BASE);
    this.neighbours.below = this.getNeighbour("below", BASE);
    this.neighbours.right = this.getNeighbour("right", 1);
    this.neighbours.left = this.getNeighbour("left", -1);
  }

  getNeighbours(): Tile[] {
    const correct = [
      this.neighbours.above,
      this.neighbours.below,
      this.neighbours.left,
      this.neighbours.right
    ];

    return correct.filter(d => isTile(d) && d.active) as Tile[];
  }

  getMatches() {
    if (!this.active) {
      return [];
    }

    var that = this;

    var matches = that.getNeighbours().filter(function(d) {
      return that.checkMatch(d);
    });

    // remove duplicates
    return matches.filter(function(t, i) {
      var duplicates = matches.filter(function(tt, j) {
        if (i <= j) {
          return false;
        } else {
          return t.x === tt.x && t.y === tt.y;
        }
      });
      return duplicates.length === 0;
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

    var numberOfMatches = this.getMatches().length;

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
      active
    };
  }

  hydrate(tileDict, board) {
    Object.assign(this, tileDict);
    this.neighbours.above = false;
    this.neighbours.below = false;
    this.neighbours.left = false;
    this.neighbours.right = false;
    this.board = board;
    this.callback = this.createCallback();
  }

  createCallback() {
    const tile = this;

    const callback = () => {
      const otherTile = tile.board.currentlySelected as Tile;

      // when matchable, currentlySelected is always a tile
      if (tile.matchable) {
        tile.board.save();

        tile.board.steps++;

        const matchedTiles = [tile, otherTile];
        matchedTiles.forEach(t => t.deactivate());

        const affectedTiles = tile
          .getNeighbours()
          .concat(otherTile.getNeighbours());
        affectedTiles.concat(matchedTiles).forEach(t => t.update());

        tile.board.update();

        return;
      }

      let oldSelection: Tile[] = [];

      if (otherTile) {
        otherTile.deselect();
        oldSelection = otherTile.getNeighbours().concat(otherTile);
      }

      tile.select();
      tile
        .getNeighbours()
        .concat([tile])
        .concat(oldSelection)
        .forEach(t => t.update());

      tile.board.currentlySelected = tile;
      tile.board.update();
    };

    let flag = false;

    const callbackTimeout = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!flag) {
        flag = true;
        setTimeout(() => {
          flag = false;
        }, 200);
        callback();
      }
      e.preventDefault();
    };

    return callbackTimeout;
  }
}

type SerializedBoard = SerializedTile[];

class Board {
  tiles: Tile[] = [];
  steps = 0;
  boardHistory: SerializedBoard[] = [];
  iterations = 0;
  base: number;
  currentlySelected: Tile | null = null;

  constructor(base: number) {
    numbersGame.board = this;
    this.base = base;
    this.init();
  }

  getTile(x: number, y: number) {
    return this.tiles[toIndex(x, y)];
  }

  getRows(): TileRow[] {
    return splitAt(this.tiles, d => {
      return d.x === 0;
    }).map(tiles => {
      return {
        tiles: tiles,
        active: tiles.some(t => t.active)
      };
    });
  }

  init() {
    [0, 1].forEach(row => {
      range(BASE).forEach(col => {
        var value = "" + (row * 10 + col + 1);
        range(value.length).forEach(i => {
          new Tile(Number(value[i]), this);
        });
      });
    });
    this.tiles.forEach(t => t.update());
  }

  serialize(): SerializedBoard {
    return this.tiles.map(t => t.serialize());
  }

  save() {
    this.boardHistory.push(this.serialize());
    if (this.boardHistory.length > 100) {
      this.boardHistory.shift();
    }
  }

  stepBack() {
    if (this.boardHistory.length === 0) {
      return;
    }
    var lastState = this.boardHistory.pop();
    this.setState(lastState);
    this.steps--;
  }

  setState(state) {
    state = state.map(tile => {
      var t = new Tile(0, this);
      t.hydrate(tile, this);
      return t;
    });
    this.tiles = state;
    this.tiles.forEach(t => t.update());
  }

  update() {
    if (this.activeTiles().length === 0) {
      window.alert("You won the game! Congrats!");
      return;
    }

    if (this.leftMatches().length === 0) {
      this.activeTiles().forEach(t => {
        new Tile(t.v, this);
      });

      this.tiles.forEach(t => t.update());
    }

    if (this.iterations >= 5) {
      window.alert("Oh no you lost!");
      return;
    }

    // happens!
    if (this.leftMatches().length === 0) {
      this.iterations++;
      this.update();
    } else {
      this.iterations = 0;
    }
  }

  activeTiles() {
    return this.tiles.filter(t => t.active);
  }

  inactiveTiles() {
    return this.tiles.filter(d => {
      return !d.active;
    });
  }

  leftMatches(): Tile[] {
    return flatten(this.activeTiles().map(t => t.getMatches()));
  }

  testBoards = {
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
      { x: 1, y: 6, v: 1, active: true }
    ]
  };
}

class Game {
  root: HTMLElement;
  pilotRunning: boolean = false;
  constructor(root: HTMLElement) {
    this.root = root;
  }

  togglePilot() {
    this.pilotRunning = !this.pilotRunning;

    const run = () => {
      let leftTiles: Tile[] = [];

      // hints
      numbersGame.board.activeTiles().forEach(tile => {
        const matches = tile.getMatches();
        leftTiles = leftTiles.concat(matches);
      });

      let tiles: HTMLElement[] = [];
      [
        "tile__hint_1",
        "tile__hint_2",
        "tile__hint_3",
        "tile__hint_4"
      ].forEach(tile_class => {
        const selection = Array.from(
          document.getElementsByClassName(tile_class)
        ) as HTMLElement[];
        tiles = tiles.concat(selection);
      });

      const tile = randomElement(tiles);

      if (tile) {
        tile.click();
      }

      setTimeout(() => {
        const elems = document.getElementsByClassName(Tile.classes.matchable);
        const el = randomElement(Array.from(elems)) as HTMLElement;
        el.click();
        if (this.pilotRunning) {
          run();
        }
      }, 100);
    };

    run();
  }

  run() {
    ReactDom.render(<ReactGame />, this.root);
  }
}

class ReactGame extends React.Component<
  {},
  {
    board: Board;
  }
> {
  constructor(props) {
    super(props);
    this.state = {
      board: new Board(BASE)
    };
    this.restartGame = this.restartGame.bind(this);
    this.stepBack = this.stepBack.bind(this);
    this.setBoard = this.setBoard.bind(this);
  }
  setBoard(board) {
    this.setState({ board });
  }
  restartGame() {
    this.setState({ board: new Board(BASE) });
  }
  stepBack() {
    this.state.board.stepBack();
    this.setState({ board: this.state.board });
  }
  render() {
    return (
      <div>
        <div className="header">
          <div className="buttons">
            <div className="score">
              <div className="small">{"steps"}</div>
              <div>{this.state.board.steps}</div>
            </div>
            <div className="new" onClick={this.restartGame}>
              {"New Game"}
            </div>
            <div className="new" onClick={this.stepBack}>
              {"Back"}
            </div>
          </div>
        </div>
        <div className="board">
          <ReactBoard board={this.state.board} setBoard={this.setBoard} />
        </div>
      </div>
    );
  }
}

const ReactBoard: React.StatelessComponent<{
  board: Board;
  setBoard: (board: Board) => void;
}> = ({ board, setBoard }) => {
  // some magic to hide rows
  const rows = board.getRows();
  const splittedRows = partitionBy(rows, r => r.active);

  const result = splittedRows.map(function(splitted, i) {
    const hiddenRows = splitted.map(function(row, j) {
      return <ReactRow row={row} key={j} setBoard={setBoard} />;
    });

    if (splitted.length > 1 && !splitted[0].active) {
      hiddenRows.push(
        <div className="tile_row__button" key="button">
          {splitted.length}
        </div>
      );
    }

    return (
      <div className="tile_row__lines" key={i}>
        {hiddenRows}
      </div>
    );
  });
  return <div className="table">{result}</div>;
};

class ReactRow extends React.Component<{
  row: TileRow;
  setBoard: (board: Board) => void;
}> {
  shouldComponentUpdate(props) {
    return props.row.active;
  }
  render() {
    const { row, setBoard } = this.props;
    const tiles = row.tiles.map((tile, i) => {
      return <ReactTile tile={tile} key={i} setBoard={setBoard} />;
    });
    return (
      <div className={"tile_row" + (row.active ? "" : " tile_row__hidden")}>
        {tiles}
      </div>
    );
  }
}

const ReactTile: React.StatelessComponent<{
  tile: Tile;
  setBoard: (board: Board) => void;
}> = ({ tile, setBoard }) => {
  const callback = e => {
    if (tile.getMatches().length <= 0) {
      return;
    }
    tile.callback(e);
    setBoard(tile.board);
  };

  return (
    <div className="tile_cell">
      <div
        className={["tile", tile.className].join(" ")}
        onTouchStart={callback}
        onClick={callback}
      >
        {tile.v}
      </div>
    </div>
  );
};

const game = new Game(document.getElementById("react") as HTMLElement);
game.run();

numbersGame.game = game;

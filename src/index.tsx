import * as React from 'react';
import * as ReactDom from 'react-dom';
import * as _ from 'lodash';

const numbersGame: {
  board: Board;
  game: Game;
} =
  (window as any).numbersGame || {};
(window as any).numbersGame = numbersGame;

const base = 9;

function toXY(n: number) {
  return {
    y: Math.floor(n / base),
    x: n % base,
  };
}

function toIndex(x: number, y: number) {
  return y * base + x;
}

function splitAt<T>(list: T[], fun: (d: T) => boolean) {
  var splitted: T[][] = [];
  var current: T[] = [];

  list.forEach((d, i) => {
    var result = fun(d);

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
  var partitioned: T[][] = [];
  var current: T[] = [];
  var lastElemResult: any;

  list.forEach((d, i) => {
    var result = fun(d);

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

class Tile {
  board: any;
  v: any;
  x: any;
  y: any;
  active: boolean;
  matchable: boolean;
  selected: boolean;
  listener: any;
  neighbours: {
    above: any;
    below: any;
    right: any;
    left: any;
  };
  classes = {
    selected: 'tile__selected',
    matchable: 'tile__good_match',
    hint: ['tile__hint_1', 'tile__hint_2', 'tile__hint_3', 'tile__hint_4'],
    inactive: 'tile__matched',
  };
  className: string = '';
  constructor(v: any, board: any) {
    this.v = v;
    this.board = board;

    var xy = this.toXY();
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
    this.listener = this.getCallback();

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
    if (below) {
      below.neighbours.above = false;
    }
    var above = this.neighbours.above;
    if (above) {
      above.neighbours.below = false;
    }
    var right = this.neighbours.right;
    if (right) {
      right.neighbours.left = false;
    }
    var left = this.neighbours.left;
    if (left) {
      left.neighbours.right = false;
    }

    this.getNeighbours().forEach(function(t: any) {
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
    return tile.v + this.v === base + 1 || tile.v === this.v;
  }

  getNeighbour(neighbour: any, inc: any) {
    var n = this.toIndex() + inc;

    if (this.neighbours[neighbour]) {
      n = this.neighbours[neighbour].toIndex();
    }

    var possibleTile: boolean | Tile = true;

    while (possibleTile && !(possibleTile as Tile).active) {
      possibleTile = this.board.tiles[n];
      n += inc;
    }

    return possibleTile ? possibleTile : false;
  }

  setNeighbours() {
    this.neighbours.above = this.getNeighbour('above', -base);
    this.neighbours.below = this.getNeighbour('below', base);
    this.neighbours.right = this.getNeighbour('right', 1);
    this.neighbours.left = this.getNeighbour('left', -1);
  }

  getNeighbours(): Tile[] {
    var correct = [
      this.neighbours.above,
      this.neighbours.below,
      this.neighbours.left,
      this.neighbours.right,
    ];

    return correct.filter(function(d) {
      return d && d.active;
    });
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
      this.className = this.classes.inactive;
      return;
    }

    if (this.selected) {
      this.className = this.classes.selected;
      return;
    }

    if (this.matchable) {
      this.className = this.classes.matchable;
      return;
    }

    var numberOfMatches = this.getMatches().length;

    if (numberOfMatches > 0) {
      this.className = this.classes.hint[numberOfMatches - 1];
      return;
    }

    this.className = '';
  }

  serialize() {
    var that = this;

    return {
      x: that.x,
      y: that.y,
      v: that.v,
      active: that.active,
    };
  }

  deserialize(tileDict, board) {
    Object.assign(this, tileDict);
    this.neighbours.above = false;
    this.neighbours.below = false;
    this.neighbours.left = false;
    this.neighbours.right = false;
    this.board = board;
    this.listener = this.getCallback();
  }

  getCallback() {
    var tile = this;

    var callback = function() {
      var otherTile = tile.board.currentlySelected;

      if (tile.matchable) {
        tile.board.save();

        tile.board.steps++;

        var matchedTiles = [tile, otherTile];
        matchedTiles.forEach(t => t.deactivate());

        var affected_tiles = tile
          .getNeighbours()
          .concat(otherTile.getNeighbours());
        affected_tiles.concat(matchedTiles).forEach(t => t.update());

        tile.board.update();

        return;
      }

      var oldSelection = [];

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

    var flag = false;

    var callbackTimeout = function(e) {
      if (!flag) {
        flag = true;
        setTimeout(function() {
          flag = false;
        }, 200);
        callback.bind(this)();
      }
      e.preventDefault();
    };

    return callbackTimeout;
  }
}

class Board {
  tiles: Tile[] = [];
  steps = 0;
  boardHistory: any[] = [];
  iterations = 0;
  base: number;

  constructor(base: number) {
    numbersGame.board = this;
    this.base = base;
    this.init();
  }

  getTile(x: number, y: number) {
    return this.tiles[toIndex(x, y)];
  }

  getRows() {
    return splitAt(this.tiles, d => {
      return d.x === 0;
    }).map(tiles => {
      return {
        tiles: tiles,
        active: _.some(tiles, _.property('active')),
      };
    });
  }

  init() {
    _.each([0, 1], row => {
      _.each(_.range(base), col => {
        var value = '' + (row * 10 + col + 1);
        _.each(_.range(value.length), i => {
          new Tile(Number(value[i]), this);
        });
      });
    });
    this.tiles.forEach(t => t.update());
  }

  save() {
    this.boardHistory.push(this.tiles.map(t => t.serialize));
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
      t.deserialize(tile, this);
      return t;
    });
    this.tiles = state;
    this.tiles.forEach(t => t.update());
  }

  update() {
    if (this.activeTiles().length === 0) {
      window.alert('You won the game! Congrats!');
      return;
    }

    if (this.leftMatches().length === 0) {
      var activeTiles = this.activeTiles();

      _.each(activeTiles, t => {
        new Tile(t.v, this);
      });

      this.tiles.forEach(t => t.update());
    }

    if (this.iterations >= 5) {
      window.alert('Oh no you lost!');
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

  leftMatches() {
    return _.flatten(this.activeTiles().map(t => t.getMatches()));
  }

  testBoards = {
    infinite: [
      {x: 0, y: 0, v: 1, active: false},
      {x: 1, y: 0, v: 2, active: true},
      {x: 2, y: 0, v: 3, active: true},
      {x: 3, y: 0, v: 1, active: false},
      {x: 4, y: 0, v: 1, active: false},
      {x: 5, y: 0, v: 1, active: false},
      {x: 6, y: 0, v: 1, active: false},
      {x: 7, y: 0, v: 1, active: false},
      {x: 8, y: 0, v: 1, active: false},

      {x: 0, y: 1, v: 1, active: false},
      {x: 1, y: 1, v: 2, active: false},
      {x: 2, y: 1, v: 3, active: false},
      {x: 3, y: 1, v: 1, active: false},
      {x: 4, y: 1, v: 1, active: false},
      {x: 5, y: 1, v: 1, active: false},
      {x: 6, y: 1, v: 1, active: false},
      {x: 7, y: 1, v: 4, active: true},
      {x: 8, y: 1, v: 4, active: false},

      {x: 0, y: 2, v: 1, active: false},
      {x: 1, y: 2, v: 2, active: false},
      {x: 2, y: 2, v: 3, active: false},
      {x: 3, y: 2, v: 1, active: true},
      {x: 4, y: 2, v: 1, active: false},
      {x: 5, y: 2, v: 1, active: false},
      {x: 6, y: 2, v: 1, active: false},
      {x: 7, y: 2, v: 1, active: false},
      {x: 8, y: 2, v: 4, active: false},

      {x: 0, y: 3, v: 1, active: false},
      {x: 1, y: 3, v: 2, active: false},
      {x: 2, y: 3, v: 3, active: false},
      {x: 3, y: 3, v: 4, active: true},
      {x: 4, y: 3, v: 1, active: false},
      {x: 5, y: 3, v: 1, active: false},
      {x: 6, y: 3, v: 1, active: false},
      {x: 7, y: 3, v: 1, active: false},
      {x: 8, y: 3, v: 4, active: false},

      {x: 0, y: 4, v: 1, active: false},
      {x: 1, y: 4, v: 2, active: false},
      {x: 2, y: 4, v: 3, active: false},
      {x: 3, y: 4, v: 1, active: true},
      {x: 4, y: 4, v: 1, active: false},
      {x: 5, y: 4, v: 1, active: false},
      {x: 6, y: 4, v: 1, active: false},
      {x: 7, y: 4, v: 1, active: false},
      {x: 8, y: 4, v: 4, active: false},

      {x: 0, y: 5, v: 1, active: false},
      {x: 1, y: 5, v: 2, active: false},
      {x: 2, y: 5, v: 5, active: true},
      {x: 3, y: 5, v: 1, active: false},
      {x: 4, y: 5, v: 5, active: true},
      {x: 5, y: 5, v: 1, active: false},
      {x: 6, y: 5, v: 1, active: false},
      {x: 7, y: 5, v: 7, active: true},
      {x: 8, y: 5, v: 1, active: true},

      {x: 0, y: 6, v: 8, active: true},
      {x: 1, y: 6, v: 1, active: true},
    ],
  };
}

class Game {
  root: HTMLElement;
  pilotRunning: boolean;
  constructor(root: HTMLElement) {
    this.root = root;
  }

  togglePilot() {
    this.pilotRunning = !this.pilotRunning;

    const run = () => {
      var leftTiles: Tile[] = [];

      // hints
      _.each(numbersGame.board.activeTiles(), tile => {
        var matches = tile.getMatches();
        leftTiles = leftTiles.concat(matches);
      });

      var tiles: any[] = [];
      _.each(
        ['tile__hint_1', 'tile__hint_2', 'tile__hint_3', 'tile__hint_4'],
        function(tile_class) {
          var selection = [].slice.call(
            document.getElementsByClassName(tile_class),
          );
          tiles = tiles.concat(selection);
        },
      );

      var tile = tiles[_.random(0, tiles.length - 1)];

      if (tile) {
        tile.click();
      }

      setTimeout(() => {
        var elems = document.getElementsByClassName('tile__good_match');
        var el: any = elems[_.random(elems.length - 1)];
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
    board: any;
  }
> {
  displayName: 'Game';
  constructor(props) {
    super(props);
    this.state = {
      board: new Board(base),
    };
    this.restartGame = this.restartGame.bind(this);
    this.stepBack = this.stepBack.bind(this);
  }
  restartGame() {
    this.setState({board: new Board(base)});
  }
  stepBack() {
    this.state.board.stepBack();
    this.setState({board: this.state.board});
  }
  render() {
    // I see why JSX is recommended
    return React.createElement('div', {}, [
      React.createElement(
        'div',
        {className: 'header', key: 'header'},
        React.createElement('div', {className: 'buttons'}, [
          React.createElement(
            'div',
            {className: 'score', key: 'score'},
            React.createElement('div', {className: 'small'}, 'steps'),
            <div>{this.state.board.steps}</div>,
          ),
          React.createElement(
            'div',
            {className: 'new', key: 'new', onClick: this.restartGame},
            'New Game',
          ),
          React.createElement(
            'div',
            {className: 'new', key: 'back', onClick: this.stepBack},
            'Back',
          ),
        ]),
      ),
      React.createElement(
        'div',
        {className: 'board', key: 'board'},
        <ReactBoard board={this.state.board} game={this} />,
      ),
    ]);
  }
}

const ReactBoard: React.StatelessComponent<{board: any; game: any}> = ({
  board,
  game,
}) => {
  // some magic to hide rows
  var rows: any[] = board.getRows();
  var splittedRows = partitionBy(rows, _.property('active'));

  var result = splittedRows.map(function(splitted, i) {
    var hiddenRows = splitted.map(function(row, j) {
      return <ReactRow row={row} key={j} game={game} />;
    });

    if (splitted.length > 1 && !splitted[0].active) {
      hiddenRows.push(
        <div className="tile_row__button" key="button">
          {splitted.length}
        </div>,
      );
    }

    return React.createElement(
      'div',
      {
        className: 'tile_row__lines',
        key: i,
      },
      hiddenRows,
    );
  });
  return React.createElement('div', {className: 'table'}, result);
};

class ReactRow extends React.Component<any> {
  shouldComponentUpdate(props: any) {
    return props.row.active;
  }
  render() {
    var tiles = this.props.row.tiles.map((tile, i) => {
      return <ReactTile tile={tile} key={i} game={this.props.game} />;
    });
    return React.createElement(
      'div',
      {
        className:
          'tile_row' + (this.props.row.active ? '' : ' tile_row__hidden'),
      },
      tiles,
    );
  }
}

const ReactTile: React.StatelessComponent<any> = props => {
  var callback: any = function(e: any) {
    props.tile.listener.bind(this)(e);
    props.game.setState(props.tile.board);
  };

  callback = props.tile.getMatches().length > 0 ? callback : null;

  var settings: any = {
    className: ['tile', props.tile.className].join(' '),
  };

  if (callback) {
    settings.onTouchStart = callback;
    settings.onClick = callback;
  }

  return React.createElement(
    'div',
    {className: 'tile_cell'},
    React.createElement('div', settings, props.tile.v),
  );
};

var game = new Game(document.getElementById('react') as HTMLElement);
game.run();

numbersGame.game = game;

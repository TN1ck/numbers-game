import * as React from 'react';
import * as ReactDom from 'react-dom';
import * as _ from 'lodash';

const numbers_game: {
    board: Board;
    game: Game;
} = (window as any).numbers_game || {};
(window as any).numbers_game = numbers_game;

var base = 9;

function to_xy(n: number) {
    return {
        y: Math.floor(n / base),
        x: n % base
    };
}

function to_index(x: number, y: number) {
    return y * base + x;
}

function split_at<T>(list: T[], fun: (d: T) => boolean) {

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

        if (i === (list.length - 1)) {
            splitted.push(current);
        }
    });

    return splitted;
};

function partition_by<T>(list: T[], fun: (d: T) => any) {
    var partitioned: T[][] = [];
    var current: T[] = [];
    var last_elem_result: any;
    
    _.each(list, function(d, i) {
        
        var result = fun(d);
        
        if ((result === last_elem_result || i === 0)) {
            current.push(d);
        } else {
            partitioned.push(current);
            current = [d];
        }

        if (i === (list.length - 1)) {
            partitioned.push(current);
        }

        last_elem_result = result;

    });

    return partitioned;
};

// var drop_while = function(array, predicate) {
//     var index = -1, length = array ? array.length : 0;
    
//     while (++index < length && predicate(array[index])) {}
//     return array.splice(index, array.length);
// };

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
        inactive: 'tile__matched'
    }
    className: string = '';
    constructor(v: any, board: any) {
        this.v = v;
        this.board = board;
        
        var xy = this.to_xy();
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
        this.listener = this.get_callback();
        
        board.tiles.push(this);
    }

    to_xy() {
        return to_xy(this.board.tiles.length);
    }

    to_index() {
        return to_index(this.x, this.y);
    }

    deactivate() {
        this.active = false;
        
        var below = this.neighbours.below;
        if (below) { below.neighbours.above = false; }
        var above = this.neighbours.above;
        if (above) { above.neighbours.below = false; }
        var right = this.neighbours.right;
        if (right) { right.neighbours.left = false; }
        var left = this.neighbours.left;
        if (left) { left.neighbours.right = false; }
    
        this.get_neighbours().forEach(function(t: any) {
            t.matchable = false;
        });
    }

    select() {
        this.selected = true;
        this.get_matches().forEach(function(t) {
            t.matchable = true;
        });
    }

    deselect() {
        this.selected = false;
        this.get_matches().forEach(function(t) {
            t.matchable = false;
        });
    }

    check_match(tile) {
        return tile.v + this.v === (base + 1) || tile.v === this.v;
    }

    get_neighbour(neighbour: any, inc: any) {
        var n = this.to_index() + inc;
        
        if (this.neighbours[neighbour]) {
            n = this.neighbours[neighbour].to_index();
        }
    
        var possible_tile: boolean | Tile = true;
    
        while(possible_tile && !(possible_tile as Tile).active) {
            possible_tile = this.board.tiles[n];
            n += inc;
        }
    
        return possible_tile ? possible_tile : false;
    }

    set_neighbours() {
        this.neighbours.above = this.get_neighbour('above', -base);
        this.neighbours.below = this.get_neighbour('below', base);
        this.neighbours.right = this.get_neighbour('right', 1);
        this.neighbours.left = this.get_neighbour('left', -1);
    }

    get_neighbours(): Tile[] {
        var correct = [
            this.neighbours.above,
            this.neighbours.below,
            this.neighbours.left,
            this.neighbours.right
        ];
    
        return correct.filter(function(d) {
            return d && d.active;
        });
    }

    get_matches() {
        if (!this.active) {
            return [];
        }
    
        var that = this;
    
        var matches = that.get_neighbours().filter(function(d) {
            return that.check_match(d);
        });
    
        // remove duplicates
        return matches.filter(function(t, i) {
            var duplicates = matches.filter(function(tt, j) {
                if (i <= j) {
                    return false;
                } else {
                    return (t.x === tt.x) && (t.y === tt.y);
                }
            });
            return duplicates.length === 0;
        });
    }

    update() {
        this.set_neighbours();
        
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
    
        var number_of_matches = this.get_matches().length;
    
        if (number_of_matches > 0) {
            this.className = this.classes.hint[number_of_matches - 1];
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
            active: that.active
        };
        
    }

    deserialize(tile_dict, board) {
        Object.assign(this, tile_dict);
        this.neighbours.above = false;
        this.neighbours.below = false;
        this.neighbours.left = false;
        this.neighbours.right = false;
        this.board = board;
        this.listener = this.get_callback();
    }

    get_callback() {
        var tile = this;
        
        var callback = function() {
    
            var other_tile = tile.board.currently_selected;
    
            if (tile.matchable) {
    
                tile.board.save();
    
                tile.board.steps++;
                
                var matched_tiles = [tile, other_tile];
                _.invoke(matched_tiles, 'deactivate');
                
                var affected_tiles = tile.get_neighbours().concat(other_tile.get_neighbours());
                _.invoke(affected_tiles.concat(matched_tiles), 'update');
    
                tile.board.update();
    
                return;
            }
    
            var old_selection = [];
    
            if (other_tile) {
                other_tile.deselect();
                old_selection = other_tile.get_neighbours().concat(other_tile);
            }
    
            tile.select();
            _.invoke(tile.get_neighbours().concat([tile]).concat(old_selection), 'update');
            
            tile.board.currently_selected = tile;
            tile.board.update();
    
        };
    
        var flag = false;
        
        var callback_timeout = function(e) {
            if (!flag) {
                flag = true;
                setTimeout(function() {
                    flag = false;
                }, 200);
                callback.bind(this)();
            }
            e.preventDefault();
        };
    
        return callback_timeout;
    }
}

class Board {
    tiles: Tile[] = [];
    steps = 0;
    board_history = [];
    iterations = 0;
    base: number;
    
    constructor (base: number) {
        numbers_game.board = this;
        this.base = base;
        this.init();
    }

    get_tile(x: number, y: number) {
        return this.tiles[to_index(x, y)];
    };

    get_rows() {
        return split_at(this.tiles, (d) => {
            return d.x === 0;
        }).map((tiles) => {
            return {
                tiles: tiles,
                active: _.some(tiles, _.property('active'))
            };
        });
    };
    
    init() {
        _.each([0, 1], (row) => {
            _.each(_.range(base),(col) => {
                var value = '' + (row * 10 + col + 1);
                _.each(_.range(value.length),(i) => {
                    new Tile(Number(value[i]), this);
                });
            });
        });

        _.invoke(this.tiles, 'update');
    };

    save() {
        this.board_history.push(_.invoke(this.tiles, 'serialize'));
        if (this.board_history.length > 100) {
            this.board_history.shift();
        }
    };

    step_back() {
        if (this.board_history.length === 0) {
            return;
        }
        var last_state = this.board_history.pop();
        this.set_state(last_state);
        this.steps--;
    };

    set_state (state) {
        state = state.map((tile) => {
            var t = new Tile(0, this);
            t.deserialize(tile, this);
            return t;
        });
        this.tiles = state;
        _.invoke(this.tiles, 'update');
    };

    update() {

        if (this.active_tiles().length === 0) {
            window.alert('You won the game! Congrats!');
            return;
        }

        if (this.left_matches().length === 0) {
            
            var active_tiles = this.active_tiles();
            
            _.each(active_tiles,(t) => {
                new Tile(t.v, this);
            });

            _.invoke(this.tiles, 'update');
        }

        if (this.iterations >= 5) {
            window.alert('Oh no you lost!');
            return;
        }

        // happens!
        if (this.left_matches().length === 0) {
            this.iterations++;
            this.update();
        } else {
            this.iterations = 0;
        }

    };

    active_tiles() {
        return this.tiles.filter(t => t.active);
    };

    inactive_tiles() {
        return this.tiles.filter((d) => {
            return !d.active;
        });
    };

    left_matches() {
        return _.flatten(_.invoke(this.active_tiles(), 'get_matches'));
    };

    test_boards = {
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
        ]
    };
};

class Game {
    root: HTMLElement;
    pilot_running: boolean;
    constructor(root: HTMLElement) {
        this.root = root;
    }

    toggle_pilot() {

        this.pilot_running = !this.pilot_running;

        const run = () => {
            var left_tiles: Tile[] = [];

            // hints
            _.each(numbers_game.board.active_tiles(), (tile) => {
                var matches = tile.get_matches();
                left_tiles = left_tiles.concat(matches);
            });

            var tiles: any[] = [];
            _.each(['tile__hint_1', 'tile__hint_2', 'tile__hint_3', 'tile__hint_4'], function(tile_class) {
                var selection = [].slice.call(document.getElementsByClassName(tile_class));
                tiles = tiles.concat(selection);
            });

            var tile = tiles[_.random(0, tiles.length - 1)];

            if (tile) {
                tile.click();
            }

            setTimeout(() => {
                var elems = document.getElementsByClassName('tile__good_match');
                var el: any = elems[_.random(elems.length - 1)];
                el.click();
                if (this.pilot_running) {
                    run();
                }
            }, 100);
        };

        run();

    };

    run() {
        ReactDom.render(
            <ReactGame />,
            this.root
        );
    };

};

class ReactGame extends React.Component<{}, {
    board: any;
}> {
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
        this.state.board.step_back();
        this.setState({board: this.state.board});
    }
    render() {
        // I see why JSX is recommended
        return React.createElement('div', {}, [
            React.createElement('div', {className: 'header', key: 'header'},
                React.createElement('div', {className: 'buttons'},
                    [React.createElement('div', {className: 'score', key: 'score'},
                        React.createElement('div', {className: 'small'}, 'steps'), this.state.board.steps),
                        React.createElement('div', {className: 'new', key: 'new', onClick: this.restartGame}, 'New Game'),
                        React.createElement('div', {className: 'new', key: 'back', onClick: this.stepBack}, 'Back')
                        ])),
            React.createElement('div', {className: 'board', key: 'board'}, <ReactBoard board={this.state.board} game={this}/>),
        ]);
    }
}

const ReactBoard: React.StatelessComponent<{board: any, game: any}> = ({board, game}) => {

    // some magic to hide rows
    var rows: any[] = board.get_rows();
    var splitted_rows = partition_by(rows, _.property('active'));

    var result = splitted_rows.map(function(splitted, i) {

        var hidden_rows = splitted.map(function(row, j) {
            return <ReactRow row={row} key={j} game={game} />;
        });

        if (splitted.length > 1 && !splitted[0].active) {
            hidden_rows.push(<div className="tile_row__button" key="button">{splitted.length}</div>);
        }

        return React.createElement('div', {
            className: 'tile_row__lines',
            key: i
        }, hidden_rows);
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
        return React.createElement('div', {
            className: 'tile_row' + (this.props.row.active ? '' : ' tile_row__hidden')
        }, tiles);
    }
}

const ReactTile: React.StatelessComponent<any> = (props) => {

    var callback: any = function(e: any) {
        props.tile.listener.bind(this)(e);
        props.game.setState(props.tile.board);
    };

    callback = props.tile.get_matches().length > 0 ? callback : null;

    var settings: any = {
        className: ['tile', props.tile.className].join(' '),
    };

    if (callback) {
        settings.onTouchStart = callback;
        settings.onClick = callback;
    }

    return React.createElement('div', {className: 'tile_cell'},
        React.createElement('div', settings, props.tile.v));
}

var game = new Game(document.getElementById('react') as HTMLElement);
game.run();

numbers_game.game = game;

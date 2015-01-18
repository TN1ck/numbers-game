/* global _, React */

'use strict';

(function() {

    var caro_game = window.caro_game || {};
    window.caro_game = caro_game;

    var base = 9;

    var to_xy = function(n) {
        return {
            y: Math.floor(n / base),
            x: n % base
        };
    };

    var to_index = function(x, y) {
        return y * base + x;
    };

    var split_at = function(list, fun) {

        var splitted = [];
        var current = [];

        _.each(list, function(d, i) {

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

    var partition_by = function(list, fun) {
        var partitioned = [];
        var current = [];
        var last_elem_result;
        
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


    var Tile = function(v, board) {
        
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
        this.selecetd = false;
        this.listener = this.get_callback();

        board.tiles.push(this);
    };

    Tile.prototype.classes = {
        selected: 'tile__selected',
        matchable: 'tile__good_match',
        hint: ['tile__hint_1', 'tile__hint_2', 'tile__hint_3', 'tile__hint_4'],
        inactive: 'tile__matched'
    };

    Tile.prototype.to_xy = function() {
        return to_xy(this.board.tiles.length);
    };

    Tile.prototype.to_index = function() {
        return to_index(this.x, this.y);
    };

    Tile.prototype.deactivate = function() {
        
        this.active = false;
        
        var below = this.neighbours.below;
        if (below) { below.neighbours.above = false; }
        var above = this.neighbours.above;
        if (above) { above.neighbours.below = false; }
        var right = this.neighbours.right;
        if (right) { right.neighbours.left = false; }
        var left = this.neighbours.left;
        if (left) { left.neighbours.right = false; }

        _.each(this.get_neighbours(), function(t) {
            t.matchable = false;
        });
    };

    Tile.prototype.select = function() {
        this.selected = true;
        _.each(this.get_matches(), function(t) {
            t.matchable = true;
        });
    };

    Tile.prototype.deselect = function() {
        this.selected = false;
        _.each(this.get_matches(), function(t) {
            t.matchable = false;
        });
    };

    Tile.prototype.check_match = function(tile) {
        return tile.v + this.v === (base + 1) || tile.v === this.v;
    };

    Tile.prototype.set_above = function() {

        var x = this.x;
        var y = this.y - 1;

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.get_tile(x, y);
            y--;
        }

        if (possible_tile) {
            this.neighbours.above = possible_tile;
        } else {
            this.neighbours.above = false;
        }

    };

    Tile.prototype.set_below = function() {

        var x = this.x;
        var y = this.y + 1;

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.get_tile(x, y);
            y++;
        }

        if (possible_tile) {
            this.neighbours.below = possible_tile;
        } else {
            this.neighbours.below = false;
        }
    };

    Tile.prototype.set_right = function() {

        var n = this.to_index() + 1;

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.tiles[n];
            n++;
        }

        if (possible_tile) {
            this.neighbours.right = possible_tile;
        } else {
            this.neighbours.right = false;
        }
    };

    Tile.prototype.set_left = function() {
        
        var n = this.to_index() - 1;

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.tiles[n];
            n--;
        }

        if (possible_tile) {
            this.neighbours.left = possible_tile;
        } else {
            this.neighbours.left = false;
        }
    };

    Tile.prototype.set_neighbours = function() {

        this.set_above();
        this.set_below();
        this.set_right();
        this.set_left();
    };

    Tile.prototype.get_neighbours = function() {

        var correct = [
            this.neighbours.above,
            this.neighbours.below,
            this.neighbours.left,
            this.neighbours.right
        ];

        return correct.filter(function(d) {
            return d && d.active;
        });
    };

    Tile.prototype.get_matches = function() {

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


    };

    Tile.prototype.update = function() {

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



    };

    Tile.prototype.get_callback = function() {

        var tile = this;

        var callback = function() {


            var other_tile = tile.board.currently_selected;

            if (tile.matchable) {

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
    };


    var Board = function() {
        var that = this;
        
        this.tiles = [];
        this.steps = 0;

        caro_game.board = this;

        this.get_tile = function(x, y) {
            return that.tiles[to_index(x, y)];
        };

        this.get_rows = function() {
            return split_at(this.tiles, function(d) {
                return d.x === 0;
            }).map(function(tiles) {
                return {
                    tiles: tiles,
                    active: _.some(tiles, _.property('active'))
                };
            });
        };
        
        that.init = function() {
            _.each([0, 1], function(row) {
                _.each(_.range(base), function(col) {
                    var value = '' + (row * 10 + col + 1);
                    _.each(_.range(value.length), function(i) {
                        new Tile(Number(value[i]), that);
                    });
                });
            });

            _.invoke(this.tiles, 'update');
        };

        that.update = function() {

            if (this.active_tiles().length === 0) {
                window.alert('You won the game! Congrats!');
                return;
            }

            if (this.left_matches().length === 0) {
                
                var active_tiles = this.active_tiles();
                
                _.each(active_tiles, function(t) {
                    new Tile(t.v, that);
                });

                _.invoke(this.tiles, 'update');
            }

            // happens!
            if (this.left_matches().length === 0) {
                this.update();
            }

        };

        that.active_tiles = function() {
            return that.tiles.filter(_.property('active'));
        };

        that.inactive_tiles = function() {
            return that.tiles.filter(function(d) {
                return !d.active;
            });
        };

        that.left_matches = function() {
            return _.flatten(_.invoke(this.active_tiles(), 'get_matches'));
        };

        that.init();
    };

    var Game = function(root) {

        this.toggle_pilot = function() {

            this.pilot_running = !this.pilot_running;
            var that = this;

            var run = function() {
                var left_tiles = [];

                // hints
                _.each(caro_game.board.active_tiles(), function(tile) {
                    var matches = tile.get_matches();
                    left_tiles = left_tiles.concat(matches);
                });

                var tiles = [];
                _.each(['tile__hint_1', 'tile__hint_2', 'tile__hint_3', 'tile__hint_4'], function(tile_class) {
                    var selection = [].slice.call(document.getElementsByClassName(tile_class));
                    tiles = tiles.concat(selection);
                });

                var tile = tiles[_.random(0, tiles.length - 1)];

                if (tile) {
                    tile.click();
                }

                setTimeout(function() {
                    var elems = document.getElementsByClassName('tile__good_match');
                    var el = elems[_.random(elems.length - 1)];
                    el.click();
                    if (that.pilot_running) {
                        run();
                    }
                }, 100);
            };

            run();

        };

        this.run = function() {
            this.react = new ReactGame();
            React.render(
                this.react,
                root
            );
        };

    };

    var ReactGame = React.createFactory(React.createClass({
        displayName: 'Game',
        getInitialState: function() {
            return {board: new Board(base)};
        },
        restartGame: function() {
            this.setState(this.getInitialState());
        },
        render: function() {
            var that = this;
            // I see why JSX is recommended
            return React.createElement('div', {}, [
                React.createElement('div', {className: 'header', key: 'header'},
                    React.createElement('div', {className: 'buttons'},
                        [React.createElement('div', {className: 'score', key: 'score'},
                            React.createElement('div', {className: 'small'}, 'steps'), that.state.board.steps),
                         React.createElement('div', {className: 'new', key: 'new', onClick: that.restartGame}, 'New Game')
                         ])),
                React.createElement('div', {className: 'board', key: 'board'}, new ReactBoard({board: that.state.board, game: that}))
            ]);
        }
    }));

    var ReactBoard = React.createFactory(React.createClass({
        displayName: 'Board',
        render: function() {
            var that = this;

            // some magic to hide rows
            var rows = that.props.board.get_rows();
            var splitted_rows = partition_by(rows, _.property('active'));

            var result = splitted_rows.map(function(splitted, i) {

                var hidden_rows = [
                    splitted.map(function(row, j) {
                        return new ReactRow({row: row, key: j, game: that.props.game});
                    })
                ];

                if (splitted.length > 1 && !splitted[0].active) {
                    hidden_rows.push(React.createElement('div', {className: 'tile_row__button', key: 'button'}, splitted.length));
                }

                return React.createElement('div', {
                    className: 'tile_row__lines',
                    key: i
                }, hidden_rows);
            });
            return React.createElement('div', {className: 'table'}, result);
        }
    }));

    var ReactRow = React.createFactory(React.createClass({
        displayName: 'Row',
        shouldComponentUpdate: function() {
            return this.props.row.active;
        },
        render: function() {
            var that = this;
            var tiles = this.props.row.tiles.map(function(tile, i) {
                return new ReactTile({tile: tile, key: i, game: that.props.game});
            });
            return React.createElement('div', {
                className: 'tile_row' + (that.props.row.active ? '' : ' tile_row__hidden')
            }, tiles);
        }
    }));

    var ReactTile = React.createFactory(React.createClass({
        displayName: 'Tile',
        render: function() {
            var that = this;

            var callback = function(e) {
                that.props.tile.listener.bind(this)(e);
                that.props.game.setState(that.props.tile.board);
            };

            callback = that.props.tile.get_matches().length > 0 ?  callback : null;

            var settings = {
                className: ['tile', that.props.tile.className].join(' '),
            };

            if (callback) {
                settings.onTouchStart = callback;
                settings.onClick = callback;
            }

            return React.createElement('div', {className: 'tile_cell'},
                React.createElement('div', settings, that.props.tile.v));
        }
    }));

    var game = new Game(document.getElementById('react'));
    game.run();

    caro_game.game = game;
    
})();

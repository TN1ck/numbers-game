/* global $, _, React */

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
                return;
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

    var drop_while = function(array, predicate) {
        var index = -1, length = array ? array.length : 0;
        
        while (++index < length && predicate(array[index])) {}
        return array.splice(index, array.length);
    };


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

        this.set_neighbours();

        this.active = true;
        this.matchable = false;
        this.selecetd = false;

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

        var x, y;

        if (!this.neighbours.above) {
            x = this.x;
            y = this.y - 1;
        } else {
            x = this.neighbours.above.x;
            y = this.neighbours.above.y;
        }

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.get_tile(x, y);
            y--;
        }

        if (possible_tile) {
            this.neighbours.above = possible_tile;
            possible_tile.neighbours.below = this;
        } else {
            this.neighbours.above = false;
        }

    };

    Tile.prototype.set_below = function() {
        
        var x, y;

        if (!this.neighbours.below) {
            x = this.x;
            y = this.y + 1;
        } else {
            x = this.neighbours.below.x;
            y = this.neighbours.below.y;
        }

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.get_tile(x, y);
            y++;
        }

        if (possible_tile) {
            this.neighbours.below = possible_tile;
            possible_tile.neighbours.above = this;
        } else {
            this.neighbours.below = false;
        }
    };

    Tile.prototype.set_right = function() {

        var n;
        
        if (!this.neighbours.right) {
            n = this.to_index() + 1;
        } else {
            n = this.neighbours.right.to_index();
        }

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.tiles[n];
            n++;
        }

        if (possible_tile) {
            this.neighbours.right = possible_tile;
            possible_tile.neighbours.left = this;
        } else {
            this.neighbours.right = false;
        }
    };

    Tile.prototype.set_left = function() {
        
        var n;
        
        if (!this.neighbours.left) {
            n = this.to_index() - 1;
        } else {
            n = this.neighbours.left.to_index();
        }

        var possible_tile = true;
        
        while(possible_tile && !possible_tile.active) {
            possible_tile = this.board.tiles[n];
            n--;
        }

        if (possible_tile) {
            this.neighbours.left = possible_tile;
            possible_tile.neighbours.right = this;
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
        var that = this;

        var matches = that.get_neighbours().filter(function(d) {
            return that.check_match(d);
        });

        // remove duplicates
        return matches.filter(function(t, i) {
            var duplicates = matches.filter(function(tt, j) {
                if (i === j) {
                    return false;
                } else {
                    return (t.x === tt.x) && (t.y === tt.y);
                }
            });
            return duplicates.length === 0;
        });


    };

    Tile.prototype.set_class = function() {

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
                // $score.html(steps);
                
                var matched_tiles = [tile, other_tile];
                _.invoke(matched_tiles, 'deactivate');
                
                var affected_tiles = tile.get_neighbours().concat(other_tile.get_neighbours());
                _.invoke(affected_tiles, 'set_neighbours');
                _.invoke(affected_tiles.concat(matched_tiles), 'set_class');

                tile.board.update();

                return;
            }

            var old_selection = [];

            if (other_tile) {
                other_tile.deselect();
                old_selection = other_tile.get_neighbours().concat(other_tile);
            }

            tile.select();
            _.invoke(tile.get_neighbours().concat([tile]).concat(old_selection), 'set_class');
            
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


    var Board = function(root, game) {
        var that = this;
        
        this.tiles = [];
        this.steps = 0;
        this.root = root;

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

            _.invoke(this.tiles, 'set_class');
        };

        that.update = function() {

            if (this.active_tiles().length === 0) {
                window.alert('You won the game! Congrats!');
                return;
            }

            var left_tiles = _.flatten(_.invoke(this.active_tiles(), 'get_matches'));

            if (left_tiles.length === 0) {
                
                var active_tiles = this.active_tiles();
                
                _.each(active_tiles, function(t) {
                    new Tile(t.v, that);
                });

                _.invoke(this.tiles, 'set_class');
            }

            // game.update();

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
            var result = [];
            _.each(this.active_tiles(), function(tile) {
                var neighbours = tile.get_matches();
                result = result.concat(neighbours);
            });
            return result;
        };

        that.init();
    };

    var Game = function(root) {

        var that = this;

        this.root = root;

        var $score = $('#score_number');
        var $new_game = $('#new_game');

        this.update = function() {
            $score.html(this.board.steps);
        };

        this.run = function() {
            this.board = new Board(this.root, this);
            this.board.draw();
            this.board.update();
            $new_game.bind('click', this.restart);
        };

        this.restart = function() {
            that.root.html('');
            that.run();
            that.update();
        };

        this.win = function() {
            _.each(this.board.tiles, function(tile) {
                tile.deactivate();
                tile.update_dom();
            });
            this.board.update();
            this.update();
        };

        this.toggle_pilot = function() {

            this.pilot_running = !this.pilot_running;
            var that = this;

            var run = function() {
                var left_tiles = [];

                // hints
                _.each(that.board.active_tiles(), function(tile) {
                    var matches = tile.get_matches();
                    left_tiles = left_tiles.concat(matches);
                });

                var tile = left_tiles[_.random(left_tiles.length - 1)];
                tile.dom.click();

                setTimeout(function() {
                    var elems = $('.tile__good_match');
                    var el = $(elems[_.random(elems.length - 1)]);
                    el.click();
                    if (that.pilot_running) {
                        run();
                    }
                }, 5);
            };

            run();

        };

    };

    var ReactGame = React.createFactory(React.createClass({
        displayName: 'Game',
        render: function() {
            return new ReactBoard();
        }
    }));

    var ReactBoard = React.createFactory(React.createClass({
        displayName: 'Board',
        getInitialState: function() {
            return {board: new Board(base)};
        },
        restartGame: function() {
            this.setState(this.getInitialState());
        },
        componentDidMount: function() {

        },
        render: function() {
            var that = this;

            // some magic to hide rows
            var rows = that.state.board.get_rows();
            var splitted_rows = partition_by(rows, _.property('active'));

            var result = splitted_rows.map(function(splitted, i) {
                return React.createElement('div', {
                    className: '',
                    key: i
                },
                splitted.map(function(row, j) {
                    return new ReactRow({row: row, key: j, board: that});
                }));
            });
            return React.createElement('div', {className: 'table'}, result);
        }
    }));

    var ReactRow = React.createFactory(React.createClass({
        displayName: 'Row',
        render: function() {
            var that = this;
            var tiles = this.props.row.tiles.map(function(tile, i) {
                return new ReactTile({tile: tile, key: i, board: that.props.board});
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
                that.props.tile.get_callback().bind(this)(e);
                that.props.board.setState(that.props.tile.board);
            };
            callback = that.props.tile.get_matches().length > 0 ?  callback : null;

            return React.createElement('div', {className: 'tile_cell'},
                React.createElement('div', {
                    className: ['tile', that.props.tile.className].join(' '),
                    onClick: callback
                }, that.props.tile.v));
        }
    }));

    React.render(
        new ReactGame(),
        document.getElementById('game')
    );
    
})();

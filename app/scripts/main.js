/* global $, _, React*/

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

    var drop_while = function(array, predicate) {
        var index = -1, length = array ? array.length : 0;
        
        while (++index < length && predicate(array[index])) {}
        return array.splice(index, array.length);
    };

    var ReactBoard = React.createClass({
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
            var rows = this.props.board.getRows().map(function(row) {
                return new ReactRow({tiles: row, board: this.props.board});
            });
            return React.createElement('div', {className: 'table', children: rows}, null);
        }
    });

    var ReactRow = React.createClass({
        displayName: 'Row',
        render: function() {
            var tiles = this.props.tiles.map(function(tile) {
                return new ReactTile({tile: tile, board: this.props.board});
            });
            return React.createElement('div', {className: 'tile_row', children: tiles}, null);
        }
    });

    var ReactTile = React.createClass({
        displyName: 'Tile',
        render: function() {
            this.draw_tile = function(selector, tile) {
                var tile_td = $('<div></div>').addClass('tile_cell');
                
                tile.dom = $('<div></div>');
                tile.dom_parent = selector;
                tile_td.append(tile.dom);
                selector.append(tile_td);
                
                tile.dom
                    .addClass('tile')
                    .html(tile.v);

                if (!tile.active) {
                    tile.dom.addClass('tile__matched');
                }


                var callback = function() {

                    
                    if (tile.matchable) {

                        steps++;
                        $score.html(steps);
                        
                        var matched_tiles = [tile, that.currently_selected];
                        _.invoke(matched_tiles, 'deactivate');
                        
                        var affected_tiles = tile.get_neighbours().concat(that.currently_selected.get_neighbours());
                        _.invoke(affected_tiles, 'set_neighbours');
                        _.invoke(affected_tiles.concat(matched_tiles), 'update_dom');

                        that.update();

                        return;
                    }

                    var old_selection = [];

                    if (that.currently_selected) {
                        that.currently_selected.deselect();
                        old_selection = that.currently_selected.get_neighbours().concat(that.currently_selected);
                    }

                    tile.select();
                    _.invoke(tile.get_neighbours().concat([tile]).concat(old_selection), 'update_dom');
                    that.currently_selected = tile;

                    that.update();

                };

                var flag = false;
                
                var callback_timeout = function() {
                    if (!flag) {
                        flag = true;
                        setTimeout(function() {
                            flag = false;
                        }, 200);
                        callback.bind(this)();
                    }
                    return false;
                };

                tile.listener = callback_timeout;
                tile.update_dom();

            };
        }
    });


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


    Tile.prototype.bind_listener = function() {
        this.dom.bind('touchstart click', this.listener);
    };

    Tile.prototype.unbind_listener = function() {
        this.dom.unbind('touchstart click');
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

        this.unbind_listener();
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

        // start from current neighbour

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

        return that.get_neighbours().filter(function(d) {
            return that.check_match(d);
        });

    };

    Tile.prototype.setClass = function() {

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

    Tile.prototype.update_dom = function() {
        this.setClass();
        if (this.get_matches().length) {
            this.bind_listener();
        } else {
            this.unbind_listener();
        }
        this.dom.attr('class', 'tile ' + this.className);
    };

    var Board = function(columns) {
        var that = this;
        
        this.columns = columns;
        this.tiles = [];

        this.get_tile = function(x, y) {
            return that.tiles[to_index(x, y)];
        };
        
        that.init = function() {
            _.each([0, 1], function(row) {
                _.each(_.range(that.columns), function(col) {
                    var value = '' + (row * 10 + col + 1);
                    _.each(_.range(value.length), function(i) {
                        new Tile(Number(value[i]), that);
                    });
                });
            });
        };

        this.getRows = function() {
            
            var rows = split_at(this.tiles, function(t) {
                return t.x === 0;
            });

            return rows;
        };

        that.update = function() {

            var active_tiles = this.active_tiles();
            
            _.each(active_tiles, function(t) {
                new Tile(t.v, that);
            });

            _.invoke(active_tiles, 'update_dom');

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
        this.board = new Board(base);

        this.root = root;

        var $score = $('#score_number');
        var $new_game = $('#new_game');

        var steps = 0;

        this.draw_tile = function(selector, tile) {
            var tile_td = $('<div></div>').addClass('tile_cell');
            
            tile.dom = $('<div></div>');
            tile.dom_parent = selector;
            tile_td.append(tile.dom);
            selector.append(tile_td);
            
            tile.dom
                .addClass('tile')
                .html(tile.v);

            if (!tile.active) {
                tile.dom.addClass('tile__matched');
            }


            var callback = function() {

                
                if (tile.matchable) {

                    steps++;
                    $score.html(steps);
                    
                    var matched_tiles = [tile, that.currently_selected];
                    _.invoke(matched_tiles, 'deactivate');
                    
                    var affected_tiles = tile.get_neighbours().concat(that.currently_selected.get_neighbours());
                    _.invoke(affected_tiles, 'set_neighbours');
                    _.invoke(affected_tiles.concat(matched_tiles), 'update_dom');

                    that.update();

                    return;
                }

                var old_selection = [];

                if (that.currently_selected) {
                    that.currently_selected.deselect();
                    old_selection = that.currently_selected.get_neighbours().concat(that.currently_selected);
                }

                tile.select();
                _.invoke(tile.get_neighbours().concat([tile]).concat(old_selection), 'update_dom');
                that.currently_selected = tile;

                that.update();

            };

            var flag = false;
            
            var callback_timeout = function() {
                if (!flag) {
                    flag = true;
                    setTimeout(function() {
                        flag = false;
                    }, 200);
                    callback.bind(this)();
                }
                return false;
            };

            tile.listener = callback_timeout;
            tile.update_dom();

        };

        this.draw_board = function() {

            var tiles = that.board.tiles.filter(function(d) {
                return !d.dom;
            });

            var drawn_tiles = that.board.tiles.filter(function(d) {
                return d.dom;
            });
            
            if (!that.table) {
                that.table = $('<div></div>').addClass('table');
                that.root.append(that.table);
            }
            
            var selector;
            var tr_created;

            _.each(tiles, function(tile) {

                if (drawn_tiles.length && !tr_created) {
                    selector = _.last(drawn_tiles).dom_parent;
                    tr_created = true;
                }

                if (tile.x === 0) {
                    var tr;

                    if (!tr) {
                        tr = $('<div></div>').addClass('tile_row');
                        that.table.append(tr);
                    }
                    selector = tr;
                }

                that.draw_tile(selector, tile);

            });

        };

        this.update = function() {
            var left_tiles = [];

            _.each(this.board.active_tiles(), function(tile) {
                var matches = tile.get_matches();
                left_tiles = left_tiles.concat(matches);
            });

            var partitioned_tiles = partition_by(this.board.tiles, _.property('active'));
            var min_rows = 1;

            var inactive_rows = partitioned_tiles
                .filter(function(d) {
                    return !d[0].active;
                })
                .filter(function(d) {
                    return d.length > (min_rows * base);
                })
                .map(function(d) {
                    var result = drop_while(d, function(dd) {
                        return dd.x !== 0;
                    });

                    var result_reversed = _.clone(result).reverse();

                    result = drop_while(result_reversed, function(dd) {
                        return dd.x !== (base - 1);
                    });

                    return result.reverse();
                })
                .filter(function(d) {
                    return d.length > (min_rows * base);
                });

            _.each(inactive_rows, function(row) {

                var hidden_rows;

                var rows = row.length/base;

                _.each(row, function(tile) {
                    if (tile.dom_parent_parent) {
                        if (hidden_rows && !hidden_rows.is(tile.dom_parent_parent)) {
                            hidden_rows.append(tile.dom_parent_parent.children());
                            if (hidden_rows.dom_parent_parent && !hidden_rows.dom_parent_parent.children().length) {
                                tile.dom_parent_parent.remove();
                            }
                        } else {
                            hidden_rows = tile.dom_parent_parent;
                        }
                    }
                });

                if (!hidden_rows) {
                    hidden_rows = $('<div></div>')
                        .addClass('tile_row__lines');

                    var button = $('<div></div>').addClass('tile_row__button').html(rows);
                    hidden_rows.append(button);

                    row[0].dom_parent.before(hidden_rows);
                }

                _.each(row, function(tile) {
                    if(tile.x === 0 && !tile.is_hidden) {
                        tile.dom_parent.addClass('tile_row__hidden');
                        hidden_rows.append(tile.dom_parent);
                        tile.is_hidden = true;
                        tile.dom_parent_parent = hidden_rows;
                    }
                });

                hidden_rows.find('.tile_row__button').html(rows);

            });

            if (this.board.active_tiles().length === 0) {
                window.alert('You won the game! Congrats!');
                return;
            }

            if (left_tiles.length === 0) {
                this.board.update();
                this.draw_board();
                this.update();
            }

        };

        this.run = function() {
            this.board = new Board(base);
            this.draw_board();
            this.update();
        };

        this.restart = function() {
            $score.html(0);
            steps = 0;
            that.table.html('');
            that.run();
        };

        this.win = function() {
            _.each(this.board.tiles, function(tile) {
                tile.deactivate();
                tile.update_dom();
            });
            this.update();
        };

        this.pilot_running = false;

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
 
        $new_game.bind('click', this.restart);


    };

    var root = $('#game');
    var game = new Game(root);

    game.run();

    caro_game.game = game;
    
})();

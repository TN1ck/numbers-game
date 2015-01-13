/* global $, _ */

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
        board.tiles.push(this);
    };

    Tile.prototype.to_xy = function() {
        return to_xy(this.board.tiles.length);
    };

    Tile.prototype.to_index = function() {
        return to_index(this.x, this.y);
    };

    Tile.prototype.activate = function() {
        this.dom.bind('touchstart click', this.listener);
    };

    Tile.prototype.deactivate = function() {
        this.active = false;
        this.dom.unbind('touchstart click');
    };

    Tile.prototype.check_match = function(tile) {
        return tile.v + this.v === (base + 1) || tile.v === this.v;
    };

    Tile.prototype.set_above = function() {
        // count y as long up as you don't hit the ceiling and a active tile is found
        var x = this.x;
        var y = this.y - 1;

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
        var x = this.x;
        var y = this.y + 1;

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
        var n = this.to_index() + 1;

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
        var n = this.to_index() - 1;

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

        that.update = function() {

            var active_tiles = this.active_tiles();
            
            _.each(active_tiles, function(t) {
                new Tile(t.v, that);

            });

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

        var removeClasses = function(selection) {
            return selection.removeClass('tile__hint_1 tile__hint_2 tile__hint3 tile__hint_4 tile__selected tile__good_match tile__bad_match');
        };

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
                
                if (tile.dom.hasClass('tile__good_match')) {

                    steps++;
                    $score.html(steps);
                    
                    that.currently_selected.dom.addClass('tile__matched');
                    tile.dom.addClass('tile__matched');
                    tile.deactivate();
                    that.currently_selected.deactivate();
                    
                    _.each(that.board.active_tiles(), function(t) {
                        t.set_neighbours();
                    });

                    removeClasses($('.tile'));

                    that.update();

                    return;
                }
                
                removeClasses($('.tile'));

                tile.dom.addClass('tile__selected');

                var neighbours = tile.get_matches();
                _.each(neighbours, function(t) {
                    t.dom.addClass('tile__good_match');
                });

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

            // hints
            _.each(this.board.active_tiles(), function(tile) {
                var matches = tile.get_matches();
                left_tiles = left_tiles.concat(matches);
                if (matches.length > 0) {
                    tile.activate();
                    tile.dom.removeClass('tile__hint_1 tile__hint_2 tile__hint3 tile__hint_4');
                    tile.dom.addClass('tile__hint_' + matches.length);
                }
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
            });
            this.update();
        };

        this.auto_pilot = function() {
            var that = this;
            var left_tiles = [];

            // hints
            _.each(this.board.active_tiles(), function(tile) {
                var matches = tile.get_matches();
                left_tiles = left_tiles.concat(matches);
            });

            var tile = left_tiles[_.random(left_tiles.length - 1)];
            tile.dom.click();

            setTimeout(function() {
                var elems = $('.tile__good_match');
                var el = $(elems[_.random(elems.length - 1)]);
                el.click();
                if (!that.stop_the_pilot) {
                    that.auto_pilot();
                }
            }, 200);

        };

        this.stop_pilot = function() {
            this.stop_the_pilot = true;
        };
 
        $new_game.bind('click', this.restart);


    };

    var root = $('#game');
    var game = new Game(root);

    game.run();

    caro_game.game = game;
    
})();

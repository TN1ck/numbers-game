/* global $, _ */

'use strict';

(function() {

    var to_xy = function(n) {
        return {
            y: Math.floor(n / 9),
            x: n % 9
        };
    };

    var to_index = function(x, y) {
        return y * 9 + x;
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
        return tile.v + this.v === 10 || tile.v === this.v;
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
            var left_tiles = that.tiles.filter(_.property('active'));
            if (left_tiles.length === 0) {
                window.alert('You won the game! Congrats!');
            }
            _.each(left_tiles, function(t) {
                new Tile(t.v, that);
            });
        };

        that.left_matches = function() {
            var result = [];
            _.each(that.tiles.filter(_.property('active')), function(tile) {
                var neighbours = tile.get_neighbours().filter(function(d) {
                    return tile.check_match(d);
                });
                result = result.concat(neighbours);
            });
            return result;
        };

        that.init();
    };

    var Game = function(root) {

        var that = this;
        this.board = new Board(9);

        this.root = root;

        var $score = $('#score_number');
        var $new_game = $('#new_game');

        var steps = 0;

        

        this.draw_tile = function(selector, tile) {
            var tile_td = $('<td></td>');
            var tile_div = $('<div></div>');
            tile_td.append(tile_div);
            selector.append(tile_td);
            
            tile_div
                .addClass('tile')
                .html(tile.v);

            if (!tile.active) {
                tile_div.addClass('tile__matched');
            }

            var callback = function() {
                var el = $(this);
                
                if (el.hasClass('tile__good_match')) {

                    steps++;
                    $score.html(steps);
                    $(that.currently_selected.dom[0]).addClass('tile__matched');
                    el.addClass('tile__matched');
                    tile.deactivate();
                    that.currently_selected.deactivate();
                    _.each(that.board.tiles, function(t) {
                        t.set_neighbours();
                    });


                    $('.tile').removeClass('tile__hint tile__selected tile__good_match tile__bad_match');

                    that.draw_hint();

                    return;
                }
                
                $('.tile').removeClass('tile__hint tile__selected tile__good_match tile__bad_match');

                el.addClass('tile__selected');

                var neighbours = tile.get_neighbours();
                _.each(neighbours, function(t) {
                    var match = tile.check_match(t);
                    if (match) {
                        t.dom.addClass('tile__good_match');
                    } else {
                        t.dom.addClass('tile__bad_match');
                    }
                });

                that.currently_selected = tile;
                that.draw_hint();
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

            tile.dom = tile_div;
            tile.listener = callback_timeout;

        };

        this.draw_board = function() {

            that.root.html('');
            
            var table = $('<table></table>');
            that.root.append(table);
            
            var selector;
            _.each(that.board.tiles, function(tile, i) {
                if (i % 9 === 0) {
                    var tr = $('<tr></tr>').addClass('tile_row');
                    table.append(tr);
                    selector = tr;
                }
                that.draw_tile(selector, tile);
            });

        };

        this.draw_hint = function() {
            var left_matches = that.board.left_matches();
            _.each(left_matches, function(tile) {
                tile.activate();
                tile.dom.addClass('tile__hint');
            });
            // no matches left
            if (left_matches.length === 0) {
                that.board.update();
                that.draw_board();
                that.draw_hint();
            }


        };

        this.run = function() {
            this.board = new Board(9);
            this.draw_board();
            this.draw_hint();
        };

        this.restart = function() {
            $score.html(0);
            steps = 0;
            that.run();
        };
 
        $new_game.bind('click', this.restart);


    };

    var root = $('#game');
    var game = new Game(root);

    game.run();
    
})();


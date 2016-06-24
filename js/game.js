
define(["./map", "./dungeon", "./rng", "./actor", "./item"], function(DMap, Dungeon, rng, Actor, Item) {
  var Game = function(canvas, options) {
    /// Constructor {{{
    this.canvas = canvas;

    this.rng = new rng(options.seed);
    this.dungeon = new Dungeon();


    this.player = options.player;

    this.output = options.output;

    var homeLevel = options.homeLevel || {};
    var dungeon = options.dungeon || {};

    this.config = {
      homeLevel: {
        width: homeLevel.width || 65,
        height: homeLevel.height || 33,
      },
      tileSize: options.tileSize || 15,
      dungeon: {
        width: dungeon.width,
        height: dungeon.height,

        maxRoomSize: dungeon.maxRoomSize,
        minRoomSize: dungeon.minRoomSize,

        numRoomAttempts: dungeon.numRoomAttempts,

        numExtraConnectors: dungeon.numExtraConnectors,

        straightTendency: dungeon.straightTendency,
      },
    };

    this.ticks = 0;

    this.initializeDungeon();

    // The environment stack determines the keybinds for the player.
    // It should be pushed and popped from. The top value will always be the
    // default keybinds, like left/right/up/down and h/j/k/l for movement etc.
    // When you step on an item that requires immediate action, it will push a
    // new state that has only the keybinds for that item.
    //
    // The methods to push and pop from this stack are found in the I/O
    // section.
    this.envStack = [];

    // Push the default keybinds onto the environment stack.
    this.pushEnv(Game.primaryKeybinds);

    // Timers
    // Each timer is of the form {ticksLeft: int, callback: function(game)}
    this.timers = [];

    /// }}}
  };

  /// Initialization {{{

  // This will initialize the dungeon. This will NOT draw all the levels because
  // they are generated on-demand.
  Game.prototype.initializeDungeon = function() {
    this.initializeHomeLevel();

    this.placePlayer(this.dungeon, 0);
  };


  Game.prototype.initializeHomeLevel = function() {
    var width = this.config.homeLevel.width;
    var height = this.config.homeLevel.height;

    var homeLevel = new DMap({
      width: width,
      height: height,
      rng: this.rng,
    });

    homeLevel.fillBorder();

    // Everything on the home level is already known.
    var x, y;
    for (x = 0; x < width; x++) {
      for (y = 0; y < width; y++) {
        homeLevel.setSeen(x, y, DMap.SEEN);
      }
    }

    this.dungeon.addLevel(0, homeLevel);
  };

  Game.prototype.initializeDungeonLevel = function(index) {
    var map = new DMap({
      width: this.config.dungeon.width,
      height: this.config.dungeon.height,
      minRoomSize: this.config.dungeon.minRoomSize,
      maxRoomSize: this.config.dungeon.maxRoomSize,
      numRoomAttempts: this.config.dungeon.numRoomAttempts,
      numExtraConnectors: this.config.dungeon.numExtraConnectors,
      straightTendency: this.config.dungeon.straightTendency,
      rng: this.rng,
    });

    map.generate();

    this.dungeon.addLevel(index, map);

  };

  Game.prototype.placePlayer = function(dungeon, level) {
    var map = this.dungeon.getLevel(level).map;

    // The loop is to ensure that the player doesn't get placed on
    // a wall (or worse, nothing!)
    do {
      this.player.pos.dungeon = dungeon;
      this.player.pos.level = level;
      this.player.pos.x = this.rng.nextInt(1, map.width);
      this.player.pos.y = this.rng.nextInt(1, map.height);
    } while (!DMap.isFloorTile(map.get(this.player.pos.x, this.player.pos.y)));
  };

  /// }}}

  /// Field of view calculation {{{
  // Shamelessly copied from
  // http://www.roguebasin.com/index.php?title=LOS_using_strict_definition
  Game.prototype.castLine = function(map, x0, y0, x1, y1) {
    var sx, sy, xnext, ynext, dx, dy;
    var denom, dist;
    dx = x1 - x0;
    dy = y1 - y0;
    sx = x0 < x1 ? 1 : -1;
    sy = y0 < y1 ? 1 : -1;
    xnext = x0;
    ynext = y0;

    denom = Math.sqrt(dx * dx + dy * dy);
    while (xnext != x1 || ynext != y1) {
      map.setSeen(xnext, ynext, DMap.SEEN);
      if (map.get(xnext, ynext) == DMap.WALL) {
        // It's a wall, so we're done.
        return;
      }

      if (Math.abs(dy * (xnext - x0 + sx) - dx * (ynext - y0)) / denom < 0.5) {
        xnext += sx;
      } else if (Math.abs(dy * (xnext - x0) - dx * (ynext - y0 + sy)) / denom < 0.5) {
        ynext += sy;
      } else {
        xnext += sx;
        ynext += sy;
      }
    }


  };

  // This function updates what the player can see.
  Game.prototype.playerLook = function() {
    var playerPos = this.player.pos;
    var px = playerPos.x, py = playerPos.y;
    var playerLevel = this.dungeon.getLevel(playerPos.level);

    var map = playerLevel.map;

    map.setSeen(playerPos.x, playerPos.y, DMap.SEEN);

    // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
    var x, y, err;
    var radius;
    for (radius = 2; radius <= this.player.stats.lightRadius; radius++) {
      x = radius;
      y = 0;
      err = 0;
      while (x >= y) {
        this.castLine(map, px, py, px + x, py + y);
        this.castLine(map, px, py, px + y, py + x);
        this.castLine(map, px, py, px - y, py + x);
        this.castLine(map, px, py, px - x, py + y);
        this.castLine(map, px, py, px - x, py - y);
        this.castLine(map, px, py, px - y, py - x);
        this.castLine(map, px, py, px + y, py - x);
        this.castLine(map, px, py, px + x, py - y);

        y += 1;
        err += 1 + 2 * y;
        if (2 * (err - x) + 1 > 0) {
          x -= 1;
          err += 1 - 2 * x;
        }

      }
    }

  };

  // This function gets all the monsters/items at x, y of a level
  Game.prototype.getObjectsAt = function(level, x, y) {
    // Note: under normal circumstances, this function should only ever return
    // one monster because there can never be more than one monster on a tile.
    // There, however, can be multiple items on the same tile.
    var result = {items: [], monsters: []};

    var i, item, monster;
    for (i = 0; i < level.items.length; i++) {
      item = level.items[i];
      if (item.pos.x == x && item.pos.y == y) {
        result.items.push(item);
      }
    }

    for (i = 0; i < level.monsters.length; i++) {
      monster = level.monster[i];
      if (monster.pos.x == x && monster.pos.y == y) {
        result.monsters.push(monster);
      }
    }

    return result;
  };

  Game.prototype.getObjectsAtPlayer = function() {
    var pos = this.player.pos;
    var level = this.dungeon.getLevel(pos.level);
    return this.getObjectsAt(level, pos.x, pos.y);
  };
  /// }}}

  /// Rendering {{{
  Game.prototype.draw = function() {
    var height = this.canvas.height;
    var width = this.canvas.width;
    var ctx = this.canvas.getContext("2d");

    var tileSize = this.config.tileSize;
    var horizontalTiles = Math.floor(width / tileSize);
    var verticalTiles = Math.floor(height / tileSize);

    var playerPos = this.player.pos;
    var playerLevel = this.dungeon.getLevel(playerPos.level);

    var map = playerLevel.map;

    var mapWidth = map.width;
    var mapHeight = map.height;

    var x, y, tileX, tileY;

    // the >> 0 is a faster way to get the integer part of the number
    for (x = 0, tileX = playerPos.x - (horizontalTiles / 2 >> 0); x < horizontalTiles; x++, tileX++) {
      for (y = 0, tileY = playerPos.y - (verticalTiles / 2 >> 0); y < verticalTiles; y++, tileY++) {
        // Note: The following is temporary code that I'm using for now.
        var tile = map.get(tileX, tileY);
        var seen = map.getSeen(tileX, tileY) != DMap.UNSEEN;
        if (seen) {
          switch (tile) {
            case DMap.NOTHING:
              ctx.fillStyle = "black"; break;
            case DMap.WALL:
              ctx.fillStyle = "grey"; break;
            case DMap.FLOOR:
              ctx.fillStyle = "lightgrey"; break;
          }
        } else {
          // Unseen tiles are black
          ctx.fillStyle = "black";
        }

        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

        // Check if this tile has any items/monsters to render.
        var objects = this.getObjectsAt(playerLevel, tileX, tileY);

        if (objects.items.length > 0) {
          ctx.fillStyle = "darkgreen";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
        if (objects.monsters.length > 0) {
          ctx.fillStyle = "darkred";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }

        // Mark the player's tile red
        if (tileX == playerPos.x && tileY == playerPos.y) {
          ctx.fillStyle = "red";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }

  };
  /// }}}

  /// Game "tick" {{{
  Game.prototype.tick = function() {
    this.ticks++;

    // Tick monsters

    // Heal player/monsters

    // Decrement timers and run callbacks if timers are up.
    //
    // Note: backwards iteration allows us to delete elements without screwing
    // up the loop index.

    var i, timer;
    for (i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].ticksLeft--;
      if (this.timers[i].ticksLeft === 0) {
        timer = this.timers.splice(i, 1)[0];
        timer.callback(this);
      }
    }

  };

  Game.prototype.setTimer = function(ticks, callback) {
    var timer = {ticksLeft: ticks, callback: callback};
    this.timers.push(timer);
    return timer;
  };
  /// }}}

  /// Player movement {{{

  // The return value of this function is meaningful if the player used the
  // move-until-wall shortcuts. It will return true if the player should keep
  // moving and false if the player should stop; if there's a wall or a new
  // monster comes into view.
  Game.prototype.tryPlayerMove = function(dx, dy) {
    var player = this.player;
    var playerPos = player.pos;
    var level = this.dungeon.getLevel(playerPos.level);
    var map = level.map;

    var newx = playerPos.x + dx;
    var newy = playerPos.y + dy;
    var newTile = map.get(newx, newy);

    if (!DMap.isFloorTile(newTile)) {
      return false;
    }

    playerPos.x = newx;
    playerPos.y = newy;

    this.tick();

    return true;
  };

  /// }}}

  /// Player I/O {{{
  /// Output {{{
  Game.prototype.echo = function(msg, color) {
    this.output(msg, color);
  };
  /// }}}

  /// Input {{{
  /// Key codes {{{
  Game.keys = {
    WAIT: 190, // dot
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
  };

  // Combine the shift and keycode into a single keycode to use
  // key: 0-255
  // shift: true or false
  Game.prepareKey = function(key, shift) {
    var shiftPart = shift ? 1 : 0;
    return (shift << 8) | key;
  };

  // For convenience
  var shift = function(key) {return Game.prepareKey(key, true)};
  ///}}}

  /// Keybind set accessing and switching {{{

  // newEnv should be an object like Game.primaryKeybinds
  Game.prototype.pushEnv = function(newEnv) {
    this.envStack.unshift(newEnv);
  };

  Game.prototype.popEnv = function(newEnv) {
    return this.envStack.shift();
  };

  Game.prototype.getCurrentEnv = function() {
    return this.envStack[0];
  };

  Game.prototype.getActionForKey = function(key) {
    return this.getCurrentEnv()[key];
  };

  /// }}}

  /// Global keybinds {{{
  Game.primaryKeybinds = {};
  Game.primaryKeybinds[Game.keys.WAIT] = function(game) {
    // do nothing
    game.tick();
  };

  Game.primaryKeybinds[Game.keys.RIGHT] = function(game) {
    game.tryPlayerMove(1, 0);
  };
  Game.primaryKeybinds[Game.keys.LEFT] = function(game) {
    game.tryPlayerMove(-1, 0);
  };
  Game.primaryKeybinds[Game.keys.UP] = function(game) {
    game.tryPlayerMove(0, -1);
  };
  Game.primaryKeybinds[Game.keys.DOWN] = function(game) {
    game.tryPlayerMove(0, 1);
  };

  /// }}}

  Game.prototype.handleKey = function(key) {
    // Note: key is not a typical key code; if shift was pressed, it has 256 added to it.

    // Handle the specific key

    var action = this.getActionForKey(key);

    // If key doesn't bind to anything, don't do anything.
    if (!action) return;

    action(this);

    // Render the world.
    this.playerLook();
    this.draw();

  };
  /// }}}

  /// }}}


  return Game;
});

// vim:fdm=marker

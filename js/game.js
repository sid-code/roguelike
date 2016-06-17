
define(["./map", "./dungeon", "./rng", "./actor"], function(DMap, Dungeon, rng, Actor) {
  var Game = function(canvas, options) {
    /// Constructor {{{
    this.canvas = canvas;

    this.rng = new rng(options.seed);
    this.dungeon = new Dungeon();


    this.player = options.player;

    this.output = options.output;

    this.config = {
      homeLevel: {
        width: (options.homeLevel || {}).width || 65,
        height: (options.homeLevel || {}).height || 33,
      },
      tileSize: options.tileSize || 15,
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

    var homeLevel = new DMap({
      width: this.config.homeLevel.width,
      height: this.config.homeLevel.height,
      rng: this.rng,
    });

    homeLevel.fillBorder();

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
    } while (map.get(this.player.pos.x, this.player.pos.y) != DMap.FLOOR);
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
    var playerLevel = playerPos.dungeon.getLevel(playerPos.level);

    var map = playerLevel.map;

    map.setSeen(playerPos.x, playerPos.y, DMap.SEEN);

    // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
    var x, y, err;
    var radius = 30;
    while (radius > 25) {
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

      radius -= 1;
    }

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
    var playerLevel = playerPos.dungeon.getLevel(playerPos.level);

    var map = playerLevel.map;

    var mapWidth = map.width;
    var mapHeight = map.height;
    
    var x, y, tileX, tileY;

    // the >> 0 is a faster way to get the integer part of the number
    for (x = 0, tileX = playerPos.x - (horizontalTiles / 2 >> 0); x < horizontalTiles; x++, tileX++) {
      for (y = 0, tileY = playerPos.y - (verticalTiles / 2 >> 0); y < verticalTiles; y++, tileY++) {
        // Note: The following is temporary code that I'm using for now.

        if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) {
          // The tile is out of bounds.
          ctx.fillStyle = "grey";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        } else {
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

          // Mark the player's tile red
          if (tileX == playerPos.x && tileY == playerPos.y) {
            ctx.fillStyle = "red";
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
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
    var level = playerPos.dungeon.getLevel(playerPos.level);
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
  Game.primaryKeybinds = {}
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
    // Handle the specific key

    var action = this.getActionForKey(key);

    // If key doesn't bind to anything, don't do anything.
    if (!action) return

    // Render the world.
    this.playerLook();
    this.draw();

  };
  /// }}}

  /// }}}


  return Game;
});

// vim:fdm=marker

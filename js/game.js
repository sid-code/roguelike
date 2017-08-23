
define(["./map", "./dungeon", "./rng", "./actor", "./item", "./util"], function(DMap, Dungeon, rng, Actor, Item, Util) {
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
      dungeon: dungeon,
    }

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

    // What the player can see (used for rendering effects - what can be seen
    // is brighter than what has already been seen but can't currently be
    // seen). Coordinates are stored as paired integers (see utils.js, pair
    // function) as keys and the value is always 1 (so if the key exists then
    // it's seen, and if not then it's not.)
    this.currentSeen = {};

    /// }}}
  };

  /// Initialization {{{

  // This will initialize the dungeon.
  Game.prototype.initializeDungeon = function() {
    this.initializeHomeLevel();
    var i;

    this.placeStaircases(0, 1);

    this.placePlayer(0);
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

  Game.prototype.isLevelInitialized = function(index) {
    return !!this.dungeon.getLevel(index);
  };
  Game.prototype.initializeDungeonLevel = function(index) {
    // This creates an object with prototype of this.config.dungeon that will
    // be passed into the map. This DOES NOT clone the dungeon configuration
    // object.
    var mapConfig = Object.create(this.config.dungeon);
    mapConfig.rng = this.rng;
    var map = new DMap(mapConfig);

    // Make sure staircases match up: check the previous and next levels for
    // staircases and keep regenerating until those squares are floor. Then,
    // place staircases there.
    var upStaircasePos = null;
    var downStaircasePos = null;
    var above = this.dungeon.getLevel(index - 1);
    var below = this.dungeon.getLevel(index + 1);
    var i, item;

    if (above) {
      for (i = 0; i < above.items.length; i++) {
        item = above.items[i];
        if (item.constructor == Item.Staircase) {
          upStaircasePos = {x: item.pos.x, y: item.pos.y};
        }
      }
    }
    if (below) {
      for (i = 0; i < below.items.length; i++) {
        item = below.items[i];
        if (item.constructor == Item.Staircase) {
          downStaircasePos = {x: item.pos.x, y: item.pos.y};
        }
      }
    }


    // This is really stupid.
    // TODO: make this not stupid.
    // (it's stupid because it basically just throws a fit and regenerates the
    // map if certain tiles aren't floor tiles (where the staircases need to
    // connect). A more robust way to do this is to modify the map generation
    // algorithm to allow the generator to specify tiles that need to be floor.
    do {
      map.generate();
    } while ((upStaircasePos && !DMap.isFloorTile(map.get(upStaircasePos.x, upStaircasePos.y))) ||
             (downStaircasePos && !DMap.isFloorTile(map.get(downStaircasePos.x, downStaircasePos.x))));

    var randomPos;
    var exclude = [];

    this.dungeon.addLevel(index, map);

    if (!upStaircasePos) {
      randomPos = map.getRandomFloorTile();
      exclude.push(randomPos);
      if (randomPos.x == -1) {
        throw "could not place up staircase because there were no floor tiles on level " + index;
      }

      upStaircasePos = randomPos;
    }

    if (!downStaircasePos) {
      randomPos = map.getRandomFloorTile(exclude);
      exclude.push(randomPos);
      if (randomPos.x == -1) {
        throw "could not place down staircase because there were no floor tiles on level " + index;
      }

      downStaircasePos = randomPos;
    }

    var upsc = new Item.Staircase({up: true});
    this.dungeon.placeItem(index, upStaircasePos.x, upStaircasePos.y, upsc);
    var downsc = new Item.Staircase({up: false});
    this.dungeon.placeItem(index, downStaircasePos.x, downStaircasePos.y, downsc);


    // Now place some monsters
    randomPos = map.getRandomFloorTile(exclude);
    console.log(randomPos);
    var monster = Actor.Monster.create("rat");
    this.dungeon.placeMonster(index, randomPos.x, randomPos.y, monster);


  };

  Game.prototype.placePlayer = function(index) {
    var map = this.dungeon.getLevel(index).map;

    this.player.pos.level = index;

    var randomPos = map.getRandomFloorTile();
    if (randomPos.x == -1) {
      throw "could not place player because there were no floor tiles on level " + index;
    }

    this.player.pos.x = randomPos.x;
    this.player.pos.y = randomPos.y;
  };

  // Places a down staircase on level
  Game.prototype.placeStaircases = function(index) {
    var map = this.dungeon.getLevel(index).map;

    var randomPos = map.getRandomFloorTile();
    if (randomPos.x == -1) {
      throw "could not place staircase because there were no floor tiles on level " + index;
    }


    // fromLevel gets a down staircase and toLevel gets an up staircase
    var sc = new Item.Staircase({up: false});
    this.dungeon.placeItem(index, randomPos.x, randomPos.y, sc);
  };

  /// }}}

  /// Field of view calculation {{{


  // Sets x, y as seen on the map and also adds it to the currently seen "hash
  // set". This is cleared every time the player looks again but the map seen
  // is not.
  Game.prototype.see = function(map, x, y) {
    map.setSeen(x, y, DMap.SEEN);
    this.currentSeen[Util.pair(x, y)] = 1;
  };

  Game.prototype.canCurrentlySee = function(x, y) {
    var key = Util.pair(x, y);
    return key in this.currentSeen;
  }

  // Shamelessly copied from
  // http://www.roguebasin.com/index.php?title=LOS_using_strict_definition
  //
  // Casts a line from (x0, y0) to (x1, y1) stopping if there's a wall in the way.
  // Returns true if (x1, y1) successfully reached, false if not.
  // For each point seen, calls `fn`. If not provided, default of `this.see` is used.
  // If `fn` is null, a dummy empty function is used.
  Game.prototype.castLine = function(map, x0, y0, x1, y1, fn, maxLen) {
    var sx, sy, xnext, ynext, dx, dy, sqsum;
    var denom, dist;

    if (typeof fn === "undefined") {
      fn = this.see.bind(this);
    }

    if (fn === null) {
      fn = function() {};
    }

    if (typeof maxLen === "undefined") {
      maxLen = Infinity;
    }

    dx = x1 - x0;
    dy = y1 - y0;
    sqsum = dx * dx + dy * dy;

    if (sqsum > maxLen * maxLen) {
      return false;
    }

    sx = x0 < x1 ? 1 : -1;
    sy = y0 < y1 ? 1 : -1;
    xnext = x0;
    ynext = y0;

    denom = Math.sqrt(sqsum);
    while (xnext != x1 || ynext != y1) {
      fn(map, xnext, ynext);

      if (map.get(xnext, ynext) == DMap.WALL) {
        // It's a wall, so we're done.
        return false;
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

    return true;
  };

  // This function updates what the player can see.
  Game.prototype.playerLook = function() {
    var playerPos = this.player.pos;

    // This stores what the player can currently see so it can be rendered as
    // such (brighter than the rest), see constructor for more information.
    this.currentSeen = {};

    var px = playerPos.x, py = playerPos.y;
    var playerLevel = this.dungeon.getLevel(playerPos.level);

    var map = playerLevel.map;

    this.see(map, playerPos.x, playerPos.y);

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

  Game.prototype.actorCanSee = function(actor, otherActor) {
    if (actor.pos.level != otherActor.pos.level) return false;

    var map = this.dungeon.getLevel(this.player.pos.level).map;
    var result = this.castLine(map, actor.pos.x, actor.pos.y, otherActor.pos.x, otherActor.pos.y, null, actor.stats.lightRadius);

    return result;
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
      monster = level.monsters[i];
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

  /// Game "tick" {{{
  Game.prototype.tick = function() {
    this.ticks++;

    // Tick monsters
    var index = this.player.pos.level;
    var level = this.dungeon.getLevel(index);
    var monsters = level.monsters, monster;
    var i;
    for (i = 0; i < monsters.length; i++) {
      monsters[i].tick(this);
    }

    // Heal player/monsters

    // Decrement timers and run callbacks if timers are up.
    //
    // Note: backwards iteration allows us to delete elements without screwing
    // up the loop index.

    var timer;
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

    // Check if the tile is a floor tile
    var newTile = map.get(newx, newy);

    if (!DMap.isFloorTile(newTile)) {
      return false;
    }

    // Check if there is a monster on that tile. If so, try to attack it.
    var objects = this.getObjectsAt(level, newx, newy);
    if (objects.monsters.length > 0) {
      // TODO: attack the monster

      this.tick();
      return false;

    } else {
      player.move(dx, dy);

      // Call the announce function of each item on the new tile.
      var i;
      for (i = 0; i < objects.items.length; i++) {
        objects.items[i].announce(this);
      }

      this.tick();
      return true;
    }
  };

  // This function tries to use a staircase. If "up" is true, then it'll try to
  // climb up. If "up" is false then it'll try to climb down.
  Game.prototype.tryStaircase = function(up) {
    var objects = this.getObjectsAtPlayer();

    // These two variables hold whether the current tile has an up or down
    // staircase.
    var upsc = false, downsc = false;

    var i, item;
    for (i = 0; i < objects.items.length; i++) {
      item = objects.items[i];
      if (item.constructor == Item.Staircase) {
        upsc = item.up;
        downsc = !item.up;
        break;
      }
    }

    if (up) {
      if (upsc) {
        this.shiftPlayerLevel(-1);
      } else {
        this.echo("There is no up staircase here.");
      }
    } else {
      if (downsc) {
        this.shiftPlayerLevel(1);
      } else {
        this.echo("There is no down staircase here.");
      }
    }
  };

  Game.prototype.shiftPlayerLevel = function(numLevels) {
    this.player.pos.level += numLevels;
    if (!this.isLevelInitialized(this.player.pos.level)) {
      this.initializeDungeonLevel(this.player.pos.level);
    }
  };

  /// }}}

  /// Player I/O {{{

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
        var currentlySeen = this.canCurrentlySee(tileX, tileY);

        if (seen) {
          switch (tile) {
            case DMap.NOTHING:
              ctx.fillStyle = "black"; break;
            case DMap.WALL:
              ctx.fillStyle = "brown"; break;
            case DMap.FLOOR:
              ctx.fillStyle = "lightgrey"; break;
          }

          // Check if this tile has any items/monsters to render.
          var objects = this.getObjectsAt(playerLevel, tileX, tileY);

          if (objects.items.length > 0) {
            ctx.fillStyle = "darkgreen";
          }
          if (objects.monsters.length > 0) {
            ctx.fillStyle = "darkred";
          }

          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

        } else {
          // Unseen tiles are black
          ctx.fillStyle = "black";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }


        // Mark the player's tile red
        if (tileX == playerPos.x && tileY == playerPos.y) {
          ctx.fillStyle = "red";
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }

        // If the tile has been seen but is not currently visible, then darken
        // it.
        if (!currentlySeen) {
          ctx.fillStyle = "black";
          ctx.globalAlpha = 0.2;
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.globalAlpha = 1;
        }
      }
    }

  };

  /// }}}

  /// Output {{{
  Game.prototype.echo = function(msg, color) {
    this.output(msg, color);
  };
  /// }}}

  /// Input {{{
  /// Key codes {{{

  // Combine the shift and keycode into a single keycode to use
  // key: 0-255
  // shift: true or false
  Game.prepareKey = function(key, shift) {
    var shiftPart = shift ? 1 : 0;
    return (shift << 8) | key;
  };

  // For convenience
  var shift = function(key) {return Game.prepareKey(key, true);};

  // The actual codes
  Game.keys = {
    WAIT: 190, // dot
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,

    LESSTHAN: shift(188),
    GREATERTHAN: shift(190),
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

  Game.primaryKeybinds[Game.keys.LESSTHAN] = function(game) {
    game.tryStaircase(false);
  };
  Game.primaryKeybinds[Game.keys.GREATERTHAN] = function(game) {
    game.tryStaircase(true);
  };

  /// }}}

  Game.prototype.handleKey = function(key) {
    // Note: key is not a typical key code; if shift was pressed, it has 256 added to it.

    // Handle the specific key
    console.log(key);

    var action = this.getActionForKey(key);

    // If key doesn't bind to anything, don't do anything.
    if (!action) return;

    action(this);

    this.playerLook();

  };
  /// }}}

  /// }}}


  return Game;
});

// vim:fdm=marker

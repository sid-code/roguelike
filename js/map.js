/*
 * This code describes a single level of the dungeon, or a "map".
 *
 * The "generate" function generates a rooms-and-corridors map for
 */

define(["./rng"], function(rng) {
  /*
   * Constructor
   *
   * TODO: document options
   */
  var DMap = function(options) {
    this.options = options;
    this.rng = options.rng;

    this.width = options.width;
    this.height = options.height;
    if (this.width % 2 === 0) {
      throw "map width must be odd";
    }
    if (this.height % 2 === 0) {
      throw "map height must be odd";
    }

    this.minRoomSize = options.minRoomSize || 5;
    this.maxRoomSize = options.maxRoomSize || 11;
    this.allowRoomOverlap = !!options.allowRoomOverlap;

    this.numRoomAttempts = options.numRoomAttempts || 100;

    this.cavernWidth = options.cavernWidth || 24;
    this.cavernHeight = options.cavernHeight || 10;
    this.numCaves = options.numCaves || 20;
    this.caveSetting = options.caveSetting || [];

    this.numExtraConnectors = options.numExtraConnectors || 10;
    this.connectorThickness = options.connectorThickness || 1;

    this.straightTendency = options.straightTendency || 0.5;

    if (!this.width || this.width < DMap.limits.width.min ||
                       this.width > DMap.limits.width.max) {
      throw "invalid map width, must be within " +
            DMap.limits.width.min + ".." + DMap.limits.width.max + ".";
    }
    if (!this.height || this.height < DMap.limits.height.min ||
                        this.height > DMap.limits.height.max) {
      throw "invalid map width, must be within " +
            DMap.limits.height.min + ".." + DMap.limits.height.max + ".";
    }

    // The actual tiles
    this.grid = new Uint16Array(this.width * this.height);

    // What the player has seen (1=seen, 0=unseen, maybe more for unseen but
    // magically mapped)
    this.seenGrid = new Uint8Array(this.width * this.height);
  };


  /*
   * Constants
   */
  DMap.NORTH = 0;
  DMap.EAST = 1;
  DMap.SOUTH = 2;
  DMap.WEST = 3;
  DMap.dirs = [DMap.NORTH, DMap.EAST, DMap.SOUTH, DMap.WEST];
  DMap.deltas = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];

  DMap.NOTHING = 0;
  DMap.FLOOR = 1;
  DMap.WALL = 2;
  DMap.TEMP = 3;
  DMap.TEMP2 = 4;
  DMap.DOOR = 5;

  DMap.UNSEEN = 0;
  DMap.SEEN = 1;
  DMap.MAPPED = 2;

  DMap.limits = {
    width: {min: 15, max: 1999},
    height: {min: 15, max: 1999},
  };

  // Helper function to determine whether a given tile is a floor tile (e.g.
  // can be walked on.)
  DMap.isFloorTile = function(tile) {
    return tile == DMap.FLOOR;
  };

  // Helper functions to treat 1-d array as 2-d
  // If x, y is out of bounds, return defaultValue
  var get = function(array, width, height, x, y, defaultValue) {
    if (x >= width || x < 0 || y >= height || y < 0) return defaultValue;
    return array[width * y + x];
  };

  var set = function(array, width, height, x, y, newValue) {
    if (x >= width || x < 0 || y >= height || y < 0) return;
    array[width * y + x] = newValue;
  };

  /*
   * Member functions
   */

  // get and set for normal grid
  DMap.prototype.get = function(x, y) {
    return get(this.grid, this.width, this.height, x, y, DMap.NOTHING);
  };

  DMap.prototype.set = function(x, y, val) {
    set(this.grid, this.width, this.height, x, y, val);
  };

  // get and set for the seen grid
  DMap.prototype.getSeen = function(x, y) {
    return get(this.seenGrid, this.width, this.height, x, y, DMap.UNSEEN);
  };

  DMap.prototype.setSeen = function(x, y, val) {
    set(this.seenGrid, this.width, this.height, x, y, val);
  };

  DMap.prototype.fill = function() {
    var x, y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        this.set(x, y, DMap.WALL);
      }
    }
  };

  // fills the map with a border of a wall. If fillFloor is true (which is the
  // default value), then the floor will be filled too.
  DMap.prototype.fillBorder = function(fillFloor) {
    if (fillFloor == null) {
      fillFloor = true;
    }

    var x, y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        if (x === 0 || y === 0 || x == this.width - 1 || y == this.height - 1) {
          this.set(x, y, DMap.WALL);
        } else {
          if (fillFloor) {
            this.set(x, y, DMap.FLOOR);
          }
        }
      }
    }
  };


  DMap.prototype.generate = function() {
    this.fill();
    this.generateRooms(this.numRoomAttempts);
    this.generateCaves(this.numCaves);
    this.generateMaze();
    this.fixTemporaryWalls();
    this.connectComponents();
    this.addExtraConnectors();
    while (this.killDeadEnds());

    this.killIslands(20);

    this.fillBorder(false);
  };

  DMap.prototype.generateCavern = function(width, height) {
    var grid = new Uint16Array(width * height);

    var i;
    for (i = 0; i < grid.length; i++) {
      grid[i] = (this.rng.next() < 0.25) ? 0 : 1;
    }

    var birth = [];

    if (this.caveSetting.length > 0) {
      for (i = 0; i < this.caveSetting.length; i++) {
        var value = this.caveSetting[i];
        if (value >= 5 || value <= 8) {
          birth.push(value);
        }
      }
    } else {
      // Random, each of {6, 7, 8} has a 0.5 chance of being in the setting.
      // If it ends up being empty, then it'll just be set to [6, 7, 8]
      for (i = 6; i <= 8; i++) {
        var value = this.caveSetting[i];
        if (this.rng.next() < 0.5) {
          birth.push(value);
        }
      }

      if (birth.length === 0) {
        birth = [6, 7, 8];
      }
    }

    console.log(birth);

    for (i = 0; i < 5; i++) {
      runCellularAutomataStep(grid, {
        width: width,
        height: height,
        alive: 1,
        dead: 0,
        rule: {
          birth: birth,
          survive: [4,5,6,7,8]
        }
      });
    }

    return grid;
  };

  // Function to place rooms in the dungeon. The parameter signifies how many
  // attempts should be made.
  DMap.prototype.generateRooms = function(numTries) {
    this.rooms = [];
    var _this = this;

    var i, room;

    for (i = 0; i < numTries; i++) {
      room = DMap.Room.genRandomRoom(this);

      if (room.checkOnMap(this, this.allowRoomOverlap)) {
        room.drawOn(this);
      }
    }

  };

  DMap.prototype.generateCaves = function(numCaves) {
    var x, y, i;
    for (i = 0; i < numCaves; i++) {
      var cavernWidth = this.cavernWidth;
      var cavernHeight = this.cavernHeight;
      var cavern = this.generateCavern(cavernWidth, cavernHeight);
      var offsetX = this.rng.nextInt(1, (this.width - cavernWidth)/2) * 2 + 1;
      var offsetY = this.rng.nextInt(1, (this.height - cavernHeight)/2) * 2 + 1;
      for (x = offsetX; x < offsetX + cavernWidth; x++) {
        for (y = offsetY; y < offsetY + cavernHeight; y++) {
          // NOTE: instead of using DMap.WALL, it uses DMap.TEMP2. This is to
          // prevent the mazes from being drawn between the little cavey rooms.
          // The TEMP2s are converted into WALLs later.
          this.set(x, y, (get(cavern, cavernWidth, cavernHeight, x - offsetX, y - offsetY) == 1) ? DMap.TEMP : DMap.TEMP2);
        }
      }
    }
  };

  // Removes the temporary walls that generateCaves makes
  DMap.prototype.fixTemporaryWalls = function() {
    var x,y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        if (this.get(x, y) == DMap.TEMP2) {
          this.set(x, y, DMap.WALL);
        }
      }
    }
  }

  // Used for maze generation purposes to find out where to start generating the maze.
  DMap.prototype.getFirstBlank = function() {
    for (x = 1; x < this.width - 1; x += 2) {
      for (y = 1; y < this.height - 1; y += 2) {
        if (this.get(x, y) == DMap.WALL) {
          return {x: x, y: y};
        }
      }
    }

    return false;
  };

  // Used whenever we need to place an object on a floor tile.
  //
  // The parameter "exclude" should be an array of points {x: x, y: y} which
  // should NOT be chosen, even if they are floor tiles. If omitted, an empty
  // array is used.
  DMap.prototype.getRandomFloorTile = function(exclude) {
    if (!exclude) {
      exclude = [];
    }

    var x, y, count = 0;
    do {
      x = this.rng.nextInt(1, this.width);
      y = this.rng.nextInt(1, this.height);

      // Make sure we don't have an infinite loop.
      count++;
      if (count > 200) {
        return {x: -1, y: -1};
      }

      // Don't use any points in exclude.
      if (exclude.find(function(p) { return p.x == x && p.y == y; })) {
        continue;
      }


    } while (!DMap.isFloorTile(this.get(x, y)));

    return {x: x, y: y};
  };

  // Generates a maze around the rooms.
  DMap.prototype.generateMaze = function() {
    while (true) {
      var firstBlank = this.getFirstBlank();
      if (!firstBlank) return;

      var pos = firstBlank;
      var stack = [pos];
      var visited = [pos];

      var lastDir;
      var delta;

      while (stack.length > 0) {
        pos = stack.pop();
        visited.push(pos);
        this.set(pos.x, pos.y, DMap.TEMP);

        // Find out where we can go next.
        var nextDirs = [];
        var i;
        for (i = 0; i < DMap.dirs.length; i++) {
          var dir = DMap.dirs[i];
          delta = DMap.deltas[dir];
          if (this.get(pos.x + 2 * delta.x, pos.y + 2 * delta.y) == DMap.WALL) {
            nextDirs.push(dir);
          }
        }

        if (nextDirs.length === 0) {
          // Backtrack one square because there were no more options.
          visited.pop();
          if (visited.length > 0) {
            stack.push(visited.pop());
          }

        } else {
          // Choose a random direction from nextDirs and keep going.
          // OR, use the last direction to make corridors straighter.
          var next;
          if (lastDir && nextDirs.indexOf(lastDir) > -1 &&
              this.rng.next() < this.straightTendency) {
            next = lastDir;
          } else {
            next = this.rng.sample(nextDirs);
            lastDir = next;
          }

          // Carve out in the direction "next".
          delta = DMap.deltas[next];
          pos = {x: pos.x + delta.x, y: pos.y + delta.y};
          this.set(pos.x, pos.y, DMap.TEMP);
          pos = {x: pos.x + delta.x, y: pos.y + delta.y};
          this.set(pos.x, pos.y, DMap.TEMP);

          // Add our new position to the processing stack.
          stack.push(pos);
        }
      }
    }


  };

  // This function replaces some walls with doors (or whatever) to connect
  // the mazes to the rooms.
  DMap.prototype.connectComponents = function() {
    var numTemp = 0;
    var x, y;
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == DMap.TEMP) {
          numTemp++;
        }
      }
    }

    x = 0;
    y = 0;
    while (this.get(x, y) != DMap.TEMP) {
      x = this.rng.nextInt(1, this.width);
      y = this.rng.nextInt(1, this.height);
    }


    numTemp -= this.floodFill(x, y, DMap.FLOOR);

    var connectors;

    while (true) {
      connectors = this.getConnectors(DMap.TEMP, DMap.FLOOR);
      if (connectors.length == 0) break;

      var randomConnector = this.rng.sample(connectors);

      var cx = randomConnector.x, cy = randomConnector.y;

      if (this.get(cx, cy) == DMap.WALL) {
        this.set(cx, cy, DMap.TEMP);
        var numFilled = this.floodFill(cx, cy, DMap.FLOOR) - 1;

        if (numFilled === 0) {
          // Nothing was filled
          this.set(cx, cy, DMap.WALL);
        } else {
          numTemp -= numFilled;

        }

      }

      if (numTemp === 0) {
        break;
      }

    }
  };

  DMap.prototype.getConnectors = function(tileFrom, tileTo) {
    var connectors = [];
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == DMap.WALL && (this.checkIfConnector(x, y, tileFrom, tileTo))) {
          connectors.push({x: x, y: y});
        }
      }
    }

    return connectors;
  };

  DMap.prototype.floodFill = function(x, y, newTile) {
    return genericFloodFill(this.grid, this.width, this.height, x, y, newTile);
  };

  var genericFloodFill = function(grid, width, height, x, y, newValue) {
    var tilesChanged = 0;

    var oldValue = get(grid, width, height, x, y);
    var stack = [{x: x, y: y}];
    while (stack.length > 0) {
      var pos = stack.pop();

      if (get(grid, width, height, pos.x, pos.y) == oldValue) {
        // This should only change when we *actually* change the color of the
        // tile.  The way this algorithm works, it might attempt to change some
        // tiles twice so we don't want those to be overcounted.
        tilesChanged++;
      }

      set(grid, width, height, pos.x, pos.y, newValue);

      var px = pos.x, py = pos.y;
      if (get(grid, width, height, px + 1, py) == oldValue) stack.push({x: px + 1, y: py});
      if (get(grid, width, height, px - 1, py) == oldValue) stack.push({x: px - 1, y: py});
      if (get(grid, width, height, px, py + 1) == oldValue) stack.push({x: px, y: py + 1});
      if (get(grid, width, height, px, py - 1) == oldValue) stack.push({x: px, y: py - 1});
    }

    return tilesChanged;
  };

  // Checks if the tile at x, y has neighbors of both types tileFrom and tileTo
  // The neighbors must also be in opposite directions.
  DMap.prototype.checkIfConnector = function(x, y, tileFrom, tileTo) {
    var north = this.get(x, y + 1), south = this.get(x, y - 1);
    if ((north == tileFrom && south == tileTo) ||
        (north == tileTo && south == tileFrom)) return true;

    var east = this.get(x + 1, y), west = this.get(x - 1, y);
    if ((east == tileFrom && west == tileTo) ||
        (east == tileTo && west == tileFrom)) return true;

    return false;
  };

  // Removes dead ends in the maze.
  DMap.prototype.killDeadEnds = function() {
    var result = false;
    var x, y;
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (DMap.isFloorTile(this.get(x, y)) && this.countTilesAround(x, y, DMap.WALL) == 3) {
          this.set(x, y, DMap.WALL);
          result = true;
        }
      }
    }

    return result;

  };

  DMap.prototype.killIslands = function(maxSize) {
    var x, y, islandSize;
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == DMap.WALL) {
          var islandSize = this.floodFill(x, y, DMap.TEMP);
          if (islandSize < maxSize) {
            this.floodFill(x, y, DMap.FLOOR);
          }
        }
      }
    }
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == DMap.TEMP) {
          this.set(x, y, DMap.WALL);
        }
      }
    }
  };

  DMap.prototype.countTilesAround = function(x, y, tile) {
    var count = 0;

    if (this.get(x + 1, y) == tile) count++;
    if (this.get(x, y + 1) == tile) count++;
    if (this.get(x - 1, y) == tile) count++;
    if (this.get(x, y - 1) == tile) count++;

    return count;
  };


  DMap.prototype.addExtraConnectors = function() {
    var connectors = this.getConnectors(DMap.FLOOR, DMap.FLOOR);
    var numExtraConnectors = this.numExtraConnectors;
    while (numExtraConnectors > 0) {
      if (connectors.length === 0) break;
      var connector = this.rng.sampleAndRemove(connectors);
      var x, y;
      var thickness = this.connectorThickness - 1;
      for (x = connector.x - thickness; x <= connector.x + thickness; x++) {
        for (y = connector.y - thickness; y <= connector.y + thickness; y++) {
          if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
            this.set(x, y, DMap.FLOOR);
          }
        }
      }
      numExtraConnectors--;
    }
  };


  /*
   * Class for representing rooms in the dungeon
   */
  DMap.Room = function(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  };

  DMap.Room.prototype.overlap = function(other) {
    if (this.x + this.w <= other.x || other.x + other.w <= this.x) {
      return false;
    }

    if (this.y >= other.y + other.h || other.y >= this.y + this.h) {
      return false;
    }

    return true;
  };

  // Checks if the room can be drawn on the map. If checkOverlap is true
  // (default value if not provided), then it will be checked to see if it
  // doesn't overlap other rooms.
  DMap.Room.prototype.checkOnMap = function(map, checkOverlap) {
    if (checkOverlap == null) {
      checkOverlap = true;
    }
    var i;

    if (this.x + this.w >= map.width || this.y + this.h >= map.height) {
      return false;
    }

    if (checkOverlap) {
      for (i = 0; i < map.rooms.length; i++) {
        var other = map.rooms[i];
        if (this.overlap(other)) return false;
      }
    }

    return true;
  };

  // draws a room at its position
  DMap.Room.prototype.drawOn = function(map) {
    var px = this.x, py = this.y,
        w = this.w, h = this.h;
    var x, y;
    for (x = px; x <= px + w; x++) {
      for (y = py; y <= py + h; y++) {
        if (x == px || y == py || x == px + w || y == py + h) {
          map.set(x, y, DMap.WALL);
        } else {
          map.set(x, y, DMap.TEMP);
        }
      }
    }

    map.rooms.push(this);

  };

  DMap.Room.genRandomRoom = function(map) {
    var x, y, w, h; // all of these must be odd;

    x = map.rng.nextInt(0, (map.width-1) / 2) * 2;
    y = map.rng.nextInt(0, (map.height-1) / 2) * 2;
    w = map.rng.nextInt((map.minRoomSize-1) / 2, (map.maxRoomSize+1) / 2) * 2;
    h = map.rng.nextInt((map.minRoomSize-1) / 2, (map.maxRoomSize+1) / 2) * 2;

    return new DMap.Room(x, y, w, h);
  };

  // This function runs a 2d cellular automata step on grid (1-d array)
  // options = {
  //   width: int (required, width of the grid)
  //   height: int (required, height of the grid)
  //   rule: { (required, standard 2d cellular automata rule)
  //     birth: [2,3] (example, how many alive neighbors a dead cell needs to be born)
  //     survive: [3] (example, how many alive neighbors an alive cell needs to survive)
  //   }
  //   alive: which value signifies alive, default DMap.WALL
  //   dead: which value signifies dead, default DMap.FLOOR
  // }
  var runCellularAutomataStep = function(grid, options) {
    var width = options.width;
    var height = options.height;
    if (!width || !height) throw "cellular automata needs grid with width and height";

    var rule = options.rule;
    if (!rule) throw "no rule provided";

    var alive = options.alive == null ? DMap.WALL : options.alive;
    var dead = options.dead == null ? DMap.FLOOR : options.dead;

    var gridCopy = grid.slice(0);

    var x, y, x2, y2;

    for (x = 0; x < width; x++) {
      for (y = 0; y < height; y++) {
        var aliveNeighborCount = 0;
        for (x2 = x - 1; x2 <= x + 1; x2++) {
          for (y2 = y - 1; y2 <= y + 1; y2++) if (!(x == x2 && y == y2)) {
            if (get(grid, width, height, x2, y2, dead) == alive) {
              aliveNeighborCount++;
            }
          }
        }

        if (get(grid, width, height, x, y, dead) == dead) {
          if (rule.birth.indexOf(aliveNeighborCount) > -1) {
            set(gridCopy, width, height, x, y, alive);
          }
        } else {
          if (rule.survive.indexOf(aliveNeighborCount) == -1) {
            set(gridCopy, width, height, x, y, dead);
          }
        }
      }
    }

    // Replace the old grid with the new one.
    var i;
    for (i = 0; i < grid.length; i++) {
      grid[i] = gridCopy[i];
    }
  };

  return DMap;

});

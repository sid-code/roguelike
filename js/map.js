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

    this.numRoomAttempts = options.numRoomAttempts;

    this.numExtraConnectors = options.numExtraConnectors || 10;

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
  DMap.DOOR = 4;

  DMap.UNSEEN = 0;
  DMap.SEEN = 1;
  DMap.MAPPED = 2;

  DMap.limits = {
    width: {min: 15, max: 1999},
    height: {min: 15, max: 1999},
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
    return get(this.seenGrid, this.width, this.height, x, y, 0);
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

  DMap.prototype.fillBorder = function() {
    var x, y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        if (x === 0 || y === 0 || x == this.width - 1 || y == this.height - 1) {
          this.set(x, y, DMap.WALL);
        } else {
          this.set(x, y, DMap.FLOOR);
        }
      }
    }
  };


  DMap.prototype.generate = function() {
    this.fill();
    this.generateRooms(this.numRoomAttempts);
    this.generateMaze();
    this.connectComponents();
    while (this.killDeadEnds());
    this.addExtraConnectors();


  };

  // Function to place rooms in the dungeon. The parameter signifies how many
  // attempts should be made.
  DMap.prototype.generateRooms = function(numTries) {
    // checks if the room at px, py with dims w, h is available
    // (e.g. does not overlap any features)
    this.rooms = [];
    var _this = this;

    var checkRoom = function(room) {
      var i;

      if (room.x + room.w >= _this.width || room.y + room.h >= _this.height) {
        return false;
      }

      for (i = 0; i < _this.rooms.length; i++) {
        var other = _this.rooms[i];
        if (room.overlap(other)) return false;
      }

      return true;
    };

    // draws a room at its position
    var drawRoom = function(room) {
      var px = room.x, py = room.y,
          w = room.w, h = room.h;
      var x, y;
      for (x = px; x <= px + w; x++) {
        for (y = py; y <= py + h; y++) {
          if (x == px || y == py || x == px + w || y == py + h) {
            _this.set(x, y, DMap.WALL);
          } else {
            _this.set(x, y, DMap.TEMP);
          }
        }
      }

      _this.rooms.push(room);

    };

    var genRandomRoom = function() {
      var x, y, w, h; // all of these must be odd;

      x = _this.rng.nextInt(0, (_this.width-1) / 2) * 2;
      y = _this.rng.nextInt(0, (_this.height-1) / 2) * 2;
      w = _this.rng.nextInt((_this.minRoomSize-1) / 2, (_this.maxRoomSize+1) / 2) * 2;
      h = _this.rng.nextInt((_this.minRoomSize-1) / 2, (_this.maxRoomSize+1) / 2) * 2;

      return new DMap.Room(x, y, w, h);
    };

    var i, room, rx, ry, rw, rh;
    for (i = 0; i < numTries; i++) {
      room = genRandomRoom();

      if (checkRoom(room)) {
        drawRoom(room);
      }
    }
  };

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

  // Generates a maze around the rooms.
  DMap.prototype.generateMaze = function() {
    while (true) {
      var firstBlank = this.getFirstBlank();
      if (!firstBlank) return;

      var pos = firstBlank;
      var stack = [pos];
      var visited = [pos];
      var _this = this;

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
          if (_this.get(pos.x + 2 * delta.x, pos.y + 2 * delta.y) == DMap.WALL) {
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

    console.log(x, y);
    numTemp -= this.floodFill(x, y, DMap.FLOOR);

    while (true) {
      var connectors = this.getConnectors(DMap.TEMP, DMap.FLOOR);
      if (connectors.length === 0) break;

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
    var tilesChanged = 0;

    var oldTile = this.get(x, y);
    var stack = [{x: x, y: y}];
    while (stack.length > 0) {
      tilesChanged++;

      var pos = stack.pop();
      this.set(pos.x, pos.y, newTile);

      var px = pos.x, py = pos.y;
      if (this.get(px + 1, py) == oldTile) stack.push({x: px + 1, y: py});
      if (this.get(px - 1, py) == oldTile) stack.push({x: px - 1, y: py});
      if (this.get(px, py + 1) == oldTile) stack.push({x: px, y: py + 1});
      if (this.get(px, py - 1) == oldTile) stack.push({x: px, y: py - 1});
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
        if (this.get(x, y) == DMap.FLOOR && this.countWallsAround(x, y) == 3) {
          this.set(x, y, DMap.WALL);
          result = true;
        }
      }
    }

    return result;

  };

  DMap.prototype.countWallsAround = function(x, y) {
    var count = 0;

    if (this.get(x + 1, y) == DMap.WALL) count++;
    if (this.get(x, y + 1) == DMap.WALL) count++;
    if (this.get(x - 1, y) == DMap.WALL) count++;
    if (this.get(x, y - 1) == DMap.WALL) count++;

    return count;
  };


  DMap.prototype.addExtraConnectors = function() {
    var connectors = this.getConnectors(DMap.FLOOR, DMap.FLOOR);
    var numExtraConnectors = this.numExtraConnectors;
    while (numExtraConnectors > 0) {
      if (connectors.length == 0) break;
      var connector = this.rng.sampleAndRemove(connectors);
      this.set(connector.x, connector.y, DMap.FLOOR);
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


  return DMap;

});

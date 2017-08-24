/*
 * This code describes a single level of the dungeon, or a "map".
 *
 * The "generate" function generates a rooms-and-corridors map for
 */

import { PSprng as rng } from "./rng";
import { DungeonOptions } from "./game";
import { CoordPair } from "./interfaces";

export enum Direction {
  NORTH, EAST, SOUTH, WEST
}

var dirs = [
  Direction.NORTH,
  Direction.EAST,
  Direction.SOUTH,
  Direction.WEST
];


interface Delta extends CoordPair {
  x: number;
  y: number;
}
interface DirMap {
  [dir: number]: Delta;
}

var deltas: DirMap = {};
deltas[Direction.NORTH] = {x: 0, y: -1};
deltas[Direction.EAST] = {x: 1, y: 0};
deltas[Direction.SOUTH] = {x: 0, y: 1};
deltas[Direction.WEST] = {x: -1, y: 0};

export enum Tile {
  NOTHING=4, FLOOR, WALL, TEMP, TEMP2, DOOR
}

export enum TileStatus {
  UNSEEN, SEEN, MAPPED
}

interface CellularAutomataOptions<T> {
  width: number; // width of grid
  height: number; // height
  rule: {
    birth: Array<number>; // standard 2d cell automata rules
    survive: Array<number>;
  }
  alive: T; // which value signifies alive?
  dead: T; // which value signifies dead?
}


interface Grid<T> {
  length: number;
  [n: number]: T;
  slice: (n: number) => Grid<T>;
}


// Helper functions to treat 1-d array as 2-d
// If x, y is out of bounds, return defaultValue
function get<T>(array: Grid<T>, width: number, height: number,
                x: number, y: number, defaultValue: T = null): T {

  if (x >= width || x < 0 || y >= height || y < 0) return defaultValue;
  return array[width * y + x];

};

function set<T>(array: Grid<T>, width: number, height: number,
                x: number, y: number, newValue: T) {

  if (x >= width || x < 0 || y >= height || y < 0) return;
  array[width * y + x] = newValue;

};



/*
 * Class for representing rooms in the dungeon
 */
class Room {
  x: number;
  y: number;
  w: number;
  h: number;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  };

  overlap(other: Room): boolean {
    if (this.x + this.w <= other.x || other.x + other.w <= this.x) {
      return false;
    }

    if (this.y >= other.y + other.h || other.y >= this.y + this.h) {
      return false;
    }

    return true;
  }

  // Checks if the room can be drawn on the map. If checkOverlap is true
  // (default value if not provided), then it will be checked to see if it
  // doesn't overlap other rooms.
  checkOnMap(map: DMap, checkOverlap: boolean = true): boolean {
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
  }

  // draws a room at its position
  drawOn(map: DMap) {
    var px = this.x, py = this.y,
        w = this.w, h = this.h;
    var x, y;
    for (x = px; x <= px + w; x++) {
      for (y = py; y <= py + h; y++) {
        if (x == px || y == py || x == px + w || y == py + h) {
          map.set(x, y, Tile.WALL);
        } else {
          map.set(x, y, Tile.TEMP);
        }
      }
    }

    map.rooms.push(this);

  };

  static genRandomRoom(map: DMap): Room {
    var x, y, w, h; // all of these must be odd;

    x = map.rng.nextInt(0, (map.width-1) / 2) * 2;
    y = map.rng.nextInt(0, (map.height-1) / 2) * 2;
    w = map.rng.nextInt((map.minRoomSize-1) / 2, (map.maxRoomSize+1) / 2) * 2;
    h = map.rng.nextInt((map.minRoomSize-1) / 2, (map.maxRoomSize+1) / 2) * 2;

    return new Room(x, y, w, h);
  }
}

interface DMapOptions extends DungeonOptions {
  rng: rng;
}

export class DMap {
  /*
   * Constructor
   */

  options: DMapOptions;
  rng: rng;

  width: number;
  height: number;

  minRoomSize: number;
  maxRoomSize: number;
  allowRoomOverlap: boolean;

  numRoomAttempts: number;

  cavernWidth: number;
  cavernHeight: number;
  numCaves: number;
  caveSetting: Array<number>;

  numExtraConnectors: number;
  connectorThickness: number;
  straightTendency: number;

  grid: Uint16Array;
  seenGrid: Uint8Array;

  rooms: Array<Room>;
  
  constructor(options: DMapOptions) {
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
    this.allowRoomOverlap = options.allowRoomOverlap;

    this.numRoomAttempts = options.numRoomAttempts || 100;

    this.cavernWidth = options.caveWidth || 24;
    this.cavernHeight = options.caveHeight || 10;
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
  }




  static limits = {
    width: {min: 15, max: 1999},
    height: {min: 15, max: 1999},
  };

  // Helper function to determine whether a given tile is a floor tile (e.g.
  // can be walked on.)
  static isFloorTile(tile: Tile): boolean {
    return tile == Tile.FLOOR;
  };

  /*
   * Member functions
   */

  // get and set for normal grid
  get(x: number, y: number): Tile {
    return get(this.grid, this.width, this.height, x, y, Tile.NOTHING);
  }

  set(x: number, y: number, val: Tile) {
    set(this.grid, this.width, this.height, x, y, val);
  }

  // get and set for the seen grid
  getSeen(x: number, y: number): TileStatus {
    return get(this.seenGrid, this.width, this.height, x, y, TileStatus.UNSEEN);
  }

  setSeen(x: number, y: number, val: TileStatus) {
    set(this.seenGrid, this.width, this.height, x, y, val);
  }

  fill() {
    var x, y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        this.set(x, y, Tile.WALL);
      }
    }
  };

  // fills the map with a border of a wall. If fillFloor is true (which is the
  // default value), then the floor will be filled too.
  fillBorder(fillFloor: boolean = true) {
    var x, y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        if (x === 0 || y === 0 || x == this.width - 1 || y == this.height - 1) {
          this.set(x, y, Tile.WALL);
        } else {
          if (fillFloor) {
            this.set(x, y, Tile.FLOOR);
          }
        }
      }
    }
  };


  generate() {
    this.fill();
    this.generateRooms(this.numRoomAttempts);
    this.generateCaves(this.numCaves);
    this.generateMaze();
    this.fixTemporaryWalls();
    this.connectComponents();
    this.addExtraConnectors();


    while (this.killDeadEnds());

    this.killIslands(15);

    this.fillBorder(false);
  };

  generateCavern(width: number, height: number): Uint16Array {
    var cavern = new Uint16Array(width * height);

    var i;
    for (i = 0; i < cavern.length; i++) {
      cavern[i] = (this.rng.next() < 0.35) ? 0 : 1;
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

    for (i = 0; i < 5; i++) {
      this.runCellularAutomataStep(cavern, {
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

    return cavern;
  };

  // Function to place rooms in the dungeon. The parameter signifies how many
  // attempts should be made.
  generateRooms(numTries: number) {
    this.rooms = [];

    var i, room;

    for (i = 0; i < numTries; i++) {
      room = Room.genRandomRoom(this);

      if (room.checkOnMap(this, this.allowRoomOverlap)) {
        room.drawOn(this);
      }
    }

  };

  generateCaves(numCaves: number) {
    var x, y, i;
    for (i = 0; i < numCaves; i++) {
      var cavernWidth = this.cavernWidth;
      var cavernHeight = this.cavernHeight;
      var cavern = this.generateCavern(cavernWidth, cavernHeight);
      var offsetX = this.rng.nextInt(1, (this.width - cavernWidth)/2) * 2 + 1;
      var offsetY = this.rng.nextInt(1, (this.height - cavernHeight)/2) * 2 + 1;
      for (x = offsetX; x < offsetX + cavernWidth; x++) {
        for (y = offsetY; y < offsetY + cavernHeight; y++) {
          // NOTE: instead of using Tile.WALL, it uses DMap.TEMP2. This is to
          // prevent the mazes from being drawn between the little cavey rooms.
          // The TEMP2s are converted into WALLs later.
          this.set(x, y, (get(cavern, cavernWidth, cavernHeight, x - offsetX, y - offsetY) == 1) ? Tile.TEMP : Tile.TEMP2);
        }
      }
    }
  };

  // Removes the temporary walls that generateCaves makes
  fixTemporaryWalls() {
    var x,y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        if (this.get(x, y) == Tile.TEMP2) {
          this.set(x, y, Tile.WALL);
        }
      }
    }
  }

  // Used for maze generation purposes to find out where to start generating the maze.
  getFirstBlank(): CoordPair {
    var x, y;
    for (x = 1; x < this.width - 1; x += 2) {
      for (y = 1; y < this.height - 1; y += 2) {
        if (this.get(x, y) == Tile.WALL) {
          return {x: x, y: y};
        }
      }
    }

    return null;
  };

  // Used whenever we need to place an object on a floor tile.
  //
  // The parameter "exclude" should be an array of points {x: x, y: y} which
  // should NOT be chosen, even if they are floor tiles. If omitted, an empty
  // array is used.
  getRandomFloorTile(exclude: Array<CoordPair>): CoordPair {
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
  generateMaze() {
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
        this.set(pos.x, pos.y, Tile.TEMP);

        // Find out where we can go next.
        var nextDirs = [];
        var i;
        for (i = 0; i < dirs.length; i++) {
          var dir = dirs[i];
          delta = deltas[dir];
          if (this.get(pos.x + 2 * delta.x, pos.y + 2 * delta.y) == Tile.WALL) {
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
          delta = deltas[next];
          pos = {x: pos.x + delta.x, y: pos.y + delta.y};
          this.set(pos.x, pos.y, Tile.TEMP);
          pos = {x: pos.x + delta.x, y: pos.y + delta.y};
          this.set(pos.x, pos.y, Tile.TEMP);

          // Add our new position to the processing stack.
          stack.push(pos);
        }
      }
    }


  };

  // This function replaces some walls with doors (or whatever) to connect
  // the mazes to the rooms.
  connectComponents() {
    var numTemp = 0;
    var x, y;
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == Tile.TEMP) {
          numTemp++;
        }
      }
    }

    x = 0;
    y = 0;
    while (this.get(x, y) != Tile.TEMP) {
      x = this.rng.nextInt(1, this.width);
      y = this.rng.nextInt(1, this.height);
    }


    numTemp -= this.floodFill(x, y, Tile.FLOOR);

    var connectors;

    while (true) {
      connectors = this.getConnectors(Tile.TEMP, Tile.FLOOR);
      if (connectors.length == 0) break;

      var randomConnector: CoordPair = this.rng.sample(connectors);

      var cx = randomConnector.x, cy = randomConnector.y;

      if (this.get(cx, cy) == Tile.WALL) {
        this.set(cx, cy, Tile.TEMP);
        var numFilled = this.floodFill(cx, cy, Tile.FLOOR) - 1;

        if (numFilled === 0) {
          // Nothing was filled
          this.set(cx, cy, Tile.WALL);
        } else {
          numTemp -= numFilled;

        }

      }

      if (numTemp === 0) {
        break;
      }

    }

    // Remove all residual TEMP tiles.
    var x, y;
    for (x = 0; x < this.width; x++) {
      for (y = 0; y < this.height; y++) {
        if (this.get(x, y) == Tile.TEMP) { this.set(x, y, Tile.WALL); }
      }
    }
  };

  getConnectors(tileFrom: Tile, tileTo: Tile): Array<CoordPair> {
    var connectors = [];
    var x, y;

    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == Tile.WALL && (this.checkIfConnector(x, y, tileFrom, tileTo))) {
          connectors.push({x: x, y: y});
        }
      }
    }

    return connectors;
  };

  floodFill(x: number, y: number, newTile: number): number {
    return this.genericFloodFill(this.grid, this.width, this.height, x, y, newTile);
  }

  genericFloodFill<T>(grid: Grid<T>, width: number, height: number, x: number,
                      y: number, newValue: T): number {

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
  checkIfConnector(x: number, y: number, tileFrom: Tile, tileTo: Tile): boolean {
    var north = this.get(x, y + 1), south = this.get(x, y - 1);
    if ((north == tileFrom && south == tileTo) ||
        (north == tileTo && south == tileFrom)) return true;

    var east = this.get(x + 1, y), west = this.get(x - 1, y);
    if ((east == tileFrom && west == tileTo) ||
        (east == tileTo && west == tileFrom)) return true;

    return false;
  };

  // Removes dead ends in the maze.
  killDeadEnds(): boolean {
    var result = false;
    var x, y;
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (DMap.isFloorTile(this.get(x, y)) && this.countTilesAround(x, y, Tile.WALL) == 3) {
          this.set(x, y, Tile.WALL);
          result = true;
        }
      }
    }

    return result;

  };

  killIslands(maxSize: number) {
    var x, y, islandSize;
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == Tile.WALL) {
          islandSize = this.floodFill(x, y, Tile.TEMP);
          if (islandSize < maxSize) {
            this.floodFill(x, y, Tile.FLOOR);
          }
        }
      }
    }
    for (x = 1; x < this.width - 1; x++) {
      for (y = 1; y < this.height - 1; y++) {
        if (this.get(x, y) == Tile.TEMP) {
          this.set(x, y, Tile.WALL);
        }
      }
    }
  }

  countTilesAround(x: number, y: number, tile: Tile) {
    var count = 0;

    if (this.get(x + 1, y) == tile) count++;
    if (this.get(x, y + 1) == tile) count++;
    if (this.get(x - 1, y) == tile) count++;
    if (this.get(x, y - 1) == tile) count++;

    return count;
  }


  addExtraConnectors() {
    var connectors = this.getConnectors(Tile.FLOOR, Tile.FLOOR);
    var numExtraConnectors = this.numExtraConnectors;
    while (numExtraConnectors > 0) {
      if (connectors.length === 0) break;
      var connector = this.rng.sampleAndRemove(connectors);
      var x, y;
      var thickness = this.connectorThickness - 1;
      for (x = connector.x - thickness; x <= connector.x + thickness; x++) {
        for (y = connector.y - thickness; y <= connector.y + thickness; y++) {
          if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
            this.set(x, y, Tile.FLOOR);
          }
        }
      }
      numExtraConnectors--;
    }
  };


  runCellularAutomataStep<T>(grid: Grid<T>, options: CellularAutomataOptions<T>) {
    var width = options.width;
    var height = options.height;

    var rule = options.rule;

    var alive = options.alive == null ? Tile.WALL : options.alive;
    var dead = options.dead == null ? Tile.FLOOR : options.dead;

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

}

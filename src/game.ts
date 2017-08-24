
import { DMap, Tile, TileStatus } from "./map";
import { Dungeon, DungeonLevel } from "./dungeon";
import { PSprng as rng } from "./rng";
import { Actor, Player, Monster } from "./actor";
import { GenericItem, Staircase } from "./item";
import { ObjectList, Timer, TimerCallback, OutputFunc } from "./interfaces";
import { FOV } from "./fov";

import * as Util from "./util";

export interface SeeFunc {
  (map: DMap, x: number, y: number);
}

interface KeyFunc {
  (game: Game);
}

// Just a list of keybinds
interface KeyEnv {
  [code: number]: KeyFunc;
}

export interface DungeonOptions {
  width: number;
  height: number;

  // Room size control
  minRoomSize?: number;
  maxRoomSize?: number;

  // Allow the rooms to overlap? (Allows dungeon to have tons of rooms)
  // Turn off for a more maze-like dungeon.
  allowRoomOverlap?: boolean;

  // Higher = more rooms (can't guarantee how many though)
  numRoomAttempts?: number;

  // Higher = more connected dungeon
  numExtraConnectors?: number;

  // Vague constraints on cave dimensions. This does not guarantee caves of
  // size 24x24 but generally the bigger these get, the fatter or taller
  // caves get.
  caveWidth?: number;
  caveHeight?: number;

  // How many caves should be placed on the map?
  numCaves?: number;

  caveSetting?: Array<number>;

  // How fat should the connectors be? 1 = single square, 2 = 3x3, 3 = 5x5,
  // etc. (A connector is a block of floor tiles randomly placed to connect
  // components of the dungeon together)
  connectorThickness?: number;

  // 0-1, how straight should corridors be?
  straightTendency?: number;
}

interface HomeLevelOptions {
  width: number;
  height: number;
}

interface GameOptions {
  // RNG seed
  seed: number;

  player: Player;
  output: OutputFunc;
  homeLevel: HomeLevelOptions;
  dungeon: DungeonOptions;

  tileSize: number;
}

export class Game {
  canvas: HTMLCanvasElement;
  rng: rng;
  dungeon: Dungeon;
  player: Player;
  output: OutputFunc;

  config: GameOptions;

  ticks: number;

  timers: Array<Timer>;
  envStack: Array<KeyEnv>;

  currentSeen: any; // todo: formalize

  fov: FOV;

  /// Constructor {{{
  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.canvas = canvas;

    this.rng = new rng(options.seed);
    this.dungeon = new Dungeon();


    this.player = options.player;

    this.output = options.output;

    var homeLevel = options.homeLevel || {};
    var dungeon = options.dungeon || {};

    this.config = options;

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

    this.fov = new FOV();

  }
  /// }}}

  /// Initialization {{{

  // This will initialize the dungeon.
  initializeDungeon() {
    this.initializeHomeLevel();
    var i;

    this.placeStaircase(0);

    this.placePlayer(0);
  }


  initializeHomeLevel() {
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
        homeLevel.setSeen(x, y, TileStatus.SEEN);
      }
    }

    this.dungeon.addLevel(0, homeLevel);
  }


  isLevelInitialized(index: number) {
    return !!this.dungeon.getLevel(index);
  }

  initializeDungeonLevel(index: number) {
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
        var itemPos = item.getPos();
        if (item instanceof Staircase) {
          upStaircasePos = {x: itemPos.x, y: itemPos.y};
        }
      }
    }
    if (below) {
      for (i = 0; i < below.items.length; i++) {
        item = below.items[i];
        var itemPos = item.getPos();
        if (item instanceof Staircase) {
          downStaircasePos = {x: itemPos.x, y: itemPos.y};
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
      randomPos = map.getRandomFloorTile(exclude);
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

    var upsc = new Staircase({up: true});
    this.dungeon.placeItem(index, upStaircasePos.x, upStaircasePos.y, upsc);
    var downsc = new Staircase({up: false});
    this.dungeon.placeItem(index, downStaircasePos.x, downStaircasePos.y, downsc);


    // Now place some monsters
    randomPos = map.getRandomFloorTile(exclude);
    console.log(randomPos);
    var monster = Monster.create("rat");
    this.dungeon.placeMonster(index, randomPos.x, randomPos.y, monster);


  }


  placePlayer(index: number) {
    var map = this.dungeon.getLevel(index).map;


    var randomPos = map.getRandomFloorTile([]);
    if (randomPos.x == -1) {
      throw "could not place player because there were no floor tiles on level " + index;
    }

    this.player.setPos({ level: index, x: randomPos.x, y: randomPos.y })
  }

  // Places a down staircase on level
  placeStaircase(index: number) {
    var map = this.dungeon.getLevel(index).map;

    var randomPos = map.getRandomFloorTile([]);
    if (randomPos.x == -1) {
      throw "could not place staircase because there were no floor tiles on level " + index;
    }


    // fromLevel gets a down staircase and toLevel gets an up staircase
    var sc = new Staircase({up: false});
    this.dungeon.placeItem(index, randomPos.x, randomPos.y, sc);
  }

  /// }}}

  /// Field of view calculation {{{


  // Sets x, y as seen on the map and also adds it to the currently seen "hash
  // set". This is cleared every time the player looks again but the map seen
  // is not.
  see(map: DMap, x: number, y: number) {
    map.setSeen(x, y, TileStatus.SEEN);
    this.currentSeen[Util.pair(x, y)] = 1;
  };

  canCurrentlySee(x: number, y: number): boolean {
    var key = Util.pair(x, y);
    return key in this.currentSeen;
  }


  // This function updates what the player can see.
  playerLook() {
    var playerPos = this.player.getPos();

    // This stores what the player can currently see so it can be rendered as
    // such (brighter than the rest), see constructor for more information.
    this.currentSeen = {};

    var px = playerPos.x, py = playerPos.y;
    var playerLevel = this.dungeon.getLevel(playerPos.level);

    var map = playerLevel.map;

    this.see(map, px, py);

    var seeFunc = this.see.bind(this);

    // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
    var x, y;
    var radius = this.player.stats.lightRadius;
    for (x = -radius; x <= radius; x++) {
      for (y = -radius; y <= radius; y++) {
        if (x * x + y * y < radius * radius) {
          this.fov.castLine(map, px, py, px + x, py + y, seeFunc);
        }
      }
    }

  }

  actorCanSee(actor: Actor, otherActor: Actor): boolean {
    var pos1 = actor.getPos();
    var pos2 = otherActor.getPos();
    if (pos1.level != pos2.level) return false;

    var level = this.dungeon.getLevel(pos1.level);
    if (!level) return false;

    var map = level.map;
    var result = this.fov.castLine(map, pos1.x, pos1.y, pos2.x, pos2.y, null, actor.stats.lightRadius);

    return result;
  }

  // This function gets all the monsters/items at x, y of a level
  getObjectsAt(level: DungeonLevel, x: number, y: number): ObjectList {
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
  }

  getObjectsAtPlayer(): ObjectList {
    var pos = this.player.getPos();
    var level = this.dungeon.getLevel(pos.level);
    return this.getObjectsAt(level, pos.x, pos.y);
  }
  /// }}}

  /// Game "tick" {{{
  tick() {
    this.ticks++;

    // Tick monsters
    var index = this.player.getPos().level;
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

  }


  setTimer(ticks: number, callback: TimerCallback) {
    let timer: Timer = {ticksLeft: ticks, callback: callback};
    this.timers.push(timer);
    return timer;
  }
  /// }}}

  /// Actor movement {{{

  // The return value of this function is meaningful if the player used the
  // move-until-wall shortcuts. It will return true if the player should keep
  // moving and false if the player should stop; if there's a wall or a new
  // monster comes into view.
  tryActorMove(actor: Actor, dx: number, dy: number): boolean {
    var pos = actor.getPos();
    var level = this.dungeon.getLevel(pos.level);
    if (!level) {
      throw {
        name: "InvalidMove",
        message: "Attempt to move actor on invalid dungeon level"
      };
    }

    var map = level.map;
    var newX = pos.x + dx;
    var newY = pos.y + dy;

    var newTile = map.get(newX, newY);
    if (!DMap.isFloorTile(newTile)) {
      return false;
    }

    var ppos = this.player.getPos();

    // Check if there is a monster on that tile. If so, try to attack it.
    var objects = this.getObjectsAt(level, newX, newY);

    if (objects.monsters.length > 0) {
      // TODO: attack the monster

      return false;

    } else if (ppos.x == newX && ppos.y == newY && ppos.level == pos.level) {
      // TODO: attack the player 
    } else {
      actor.move(dx, dy);

      if (actor === this.player) {
        // Call the announce function of each item on the new tile.
        var i;
        for (i = 0; i < objects.items.length; i++) {
          objects.items[i].announce(this);
        }


        // If any monsters on this level can see us, return false to signal
        // that the run should be stopped
        for (i = 0; i < level.monsters.length; i++) {
          if (this.actorCanSee(this.player, level.monsters[i])) {
            console.log("CAN SEE RAT");
            return false;
          }
        }
      }
      return true;
    }


  }

  // This function tries to use a staircase. If "up" is true, then it'll try to
  // climb up. If "up" is false then it'll try to climb down.
  tryStaircase(up: boolean) {
    var objects = this.getObjectsAtPlayer();

    // These two variables hold whether the current tile has an up or down
    // staircase.
    var upsc = false, downsc = false;

    var i, item;
    for (i = 0; i < objects.items.length; i++) {
      item = objects.items[i];
      if (item.constructor == Staircase) {
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
  }

  shiftPlayerLevel(numLevels: number) {
    var pos = this.player.getPos();
    pos.level += numLevels;
    if (!this.isLevelInitialized(pos.level)) {
      this.initializeDungeonLevel(pos.level);
    }
  }

  /// }}}

  /// Player I/O {{{

  /// Rendering {{{
  draw() {
    var height = this.canvas.height;
    var width = this.canvas.width;
    var ctx = this.canvas.getContext("2d");

    var tileSize = this.config.tileSize;
    var horizontalTiles = Math.floor(width / tileSize);
    var verticalTiles = Math.floor(height / tileSize);

    var playerPos = this.player.getPos();
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
        var seen = map.getSeen(tileX, tileY) != TileStatus.UNSEEN;
        var currentlySeen = this.canCurrentlySee(tileX, tileY);

        if (seen) {
          switch (tile) {
            case Tile.NOTHING:
              ctx.fillStyle = "black"; break;
            case Tile.WALL:
              ctx.fillStyle = "brown"; break;
            case Tile.FLOOR:
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

  }

  /// }}}

  /// Output {{{
  echo(msg: string, color: string = "") {
    this.output(msg, color);
  };
  /// }}}

  /// Input {{{
  /// Key codes {{{

  // Combine the shift and keycode into a single keycode to use
  // key: 0-255
  // shift: true or false
  static prepareKey(key: number, shift: boolean): number {
    var shiftPart = shift ? 1 : 0;
    return (shiftPart << 8) | key;
  };

  // For convenience
  static shift(key: number): number {
    return Game.prepareKey(key, true);
  }

  // The actual codes
  static keys = {
    WAIT: 190, // dot
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,

    LESSTHAN: Game.shift(188),
    GREATERTHAN: Game.shift(190),
  };
  ///}}}

  /// Keybind set accessing and switching {{{

  // newEnv should be an object like Game.primaryKeybinds
  pushEnv(newEnv: KeyEnv) {
    this.envStack.unshift(newEnv);
  };

  popEnv(): KeyEnv {
    return this.envStack.shift();
  };

  getCurrentEnv(): KeyEnv {
    return this.envStack[0];
  };

  getActionForKey(key: number): KeyFunc {
    return this.getCurrentEnv()[key];
  };

  /// }}}

  handleKey(key: number) {
    // Note: key is not a typical key code; if shift was pressed, it has 256 added to it.

    // Handle the specific key
    console.log(key);

    var action = this.getActionForKey(key);

    // If key doesn't bind to anything, don't do anything.
    if (!action) return;

    action(this);

    this.playerLook();

  }
  /// }}}

  /// }}}

  /// Global keybinds {{{
  static primaryKeybinds: KeyEnv = {
    [Game.keys.WAIT](game) {
      game.tick();
    },

    [Game.keys.RIGHT](game) {
      game.tryActorMove(game.player, 1, 0);
      game.tick();
    },
    [Game.keys.LEFT](game) {
      game.tryActorMove(game.player, -1, 0);
      game.tick();
    },
    [Game.keys.UP](game) {
      game.tryActorMove(game.player, 0, -1);
      game.tick();
    },
    [Game.keys.DOWN](game) {
      game.tryActorMove(game.player, 0, 1);
      game.tick();
    },

    [Game.keys.LESSTHAN](game) {
      game.tryStaircase(false);
    },
    [Game.keys.GREATERTHAN](game) {
      game.tryStaircase(true);
    },
  }
  



  /// }}}

}


// vim:fdm=marker

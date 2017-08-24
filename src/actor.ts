/*
 * This code describes an actor.
 */

import { SimpleOutfit } from "./interfaces";
import { Game } from "./game";
import * as Util from "./util";

interface ActorStats {
  maxhp: number;
  str: number;
  dex: number;
  con: number;
  intl: number;
  wis: number;
  luck: number;

  lightRadius: number;
  speed: number;
  regenRate: number;
}

interface TickActionFunc {
  (game: Game);
}

interface ActorOptions {
  name: string;
  level: number;
  stats: ActorStats;
  tick?: TickActionFunc;
}

export class Actor {
  name: string;
  level: number;
  hp: number;
  pos: Position;
  stats: ActorStats

  affects: Array<string>;

  tick?: TickActionFunc;

  inventory: any; // TODO: formalize this!
  equipped: SimpleOutfit;

  constructor(options: ActorOptions) {
    this.name = options.name;

    let stats = options.stats;

    this.hp = stats.maxhp;
    this.level = options.level;

    this.stats = {
      maxhp: stats.maxhp,


      str: stats.str,
      dex: stats.dex,
      con: stats.con,
      intl: stats.intl,
      wis: stats.wis,
      luck: stats.luck,

      lightRadius: stats.lightRadius,

      speed: stats.speed,
      regenRate: stats.regenRate,

    };

    this.tick = (options.tick || function() {}).bind(this);

    this.affects = [];;
    this.pos = {level: 0, x: 0, y: 0};

    this.inventory = {};
    this.equipped = {
      wielded: null,
      worn: null,
      shield: null
    };
  }

  move(dx: number, dy: number) {
    this.pos.x += dx;
    this.pos.y += dy;
  }

}

/*
 * Extra options on top of Actor's:
 *
 * (none yet)
 *
 */

interface PlayerOptions extends ActorOptions {
  // None yet!
}

export class Player extends Actor {
  constructor(options: PlayerOptions) {
    super(options);
  }
}

interface MonsterOptions extends ActorOptions {
  // None yet 
}


let simpleTickAction: TickActionFunc = function(game: Game) {
  var player = game.player;
  if (game.actorCanSee(this, player)) {
    var dx = Util.sign(player.pos.x - this.pos.x);
    var dy = Util.sign(player.pos.y - this.pos.y);

    game.tryActorMove(this, dx, dy);
  }

};

export class Monster extends Actor {
  constructor(options: MonsterOptions) {
    super(options);
  }

  static create(name: string) {
    return new Monster(Monster.templates[name]);
  }

  static templates: { [name: string]: MonsterOptions } =
    {
      rat: {
        name: "rat",
        stats: {
          maxhp: 100,
          str: 1, dex: 1, con: 1, intl: 1, wis: 1, luck: 1,
          lightRadius: 10,
          speed: 0,
          regenRate: 1,
        },
        level: 1,
        tick: simpleTickAction,
      }

    };
}


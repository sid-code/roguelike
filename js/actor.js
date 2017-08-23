/*
 * This code describes a player.
 */

define([], function() {
  /*
   * TODO: explain all of these
   *
   * options = {
   *   name: the actor's name
   *   stats: {
   *     hp: max HP of actor,
   *     str/dex/con/intl/wis/luck: corresponding stat of actor
   *     speed: speed of actor
   *     regenRate: regeneration rate of actor
   *     lightRadius: distance this actor can see
   *   },
   *
   *   level: level of actor,
   *
   *   tick: a function to be exeuted on each game tick,
   * }
   */
  var Actor = function(options) {
    this.name = options.name || "Anon";
    var stats = options.stats || {};

    this.hp = stats.hp;
    this.level = options.level || 1,

    this.stats = {
      maxhp: stats.hp,

      str: stats.str,
      dex: stats.dex,
      con: stats.con,
      intl: stats.intl,
      wis: stats.wis,
      luck: stats.luck,

      lightRadius: stats.lightRadius || 30,

      speed: stats.speed || 0,
      regenRate: stats.regenRate || 1,

    };

    this.tick = (options.tick || function() {}).bind(this);

    this.affects = [],

    this.pos = {level: 0, x: 0, y: 0};

    this.inventory = {};
    this.equipped = {
      wielded: null,
      worn: null,
      shield: null
    };

  };

  Actor.prototype.move = function(dx, dy) {
    this.pos.x += dx;
    this.pos.y += dy;
  };

  /*
   * Extra options on top of Actor's:
   *
   * (none yet)
   *
   */
  var Player = function(options) {
    Actor.call(this, options);
  };

  Player.prototype = Object.create(Actor.prototype);
  Player.prototype.constructor = Player;

  var Monster = function(options) {
    Actor.call(this, options);
  };

  Monster.prototype = Object.create(Actor.prototype);
  Monster.prototype.constructor = Monster;

  var simpleTickAction = function(game) {
    var player = game.player;
    if (game.actorCanSee(this, player)) {
      var dx = Util.sign(player.pos.x - this.pos.x);
      var dy = Util.sign(player.pos.y - this.pos.y);

      game.tryActorMove(this, dx, dy);
    }

  };

  Monster.monsters = {
    rat: {
      name: "rat",
      stats: {
        hp: 100,
        str: 1, dex: 1, con: 1, intl: 1, wis: 1, luck: 1,
        lightRadius: 10,
        speed: 0,
        regenRate: 1,
      },
      level: 1,
      tick: simpleTickAction,
    }
  };

  Monster.create = function(name) {
    return new Monster(Monster.monsters[name])
  };

  return {
    Actor: Actor,
    Player: Player,
    Monster: Monster
  };
});

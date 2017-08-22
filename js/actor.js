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
   *   },
   *
   *   level: level of actor,
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

      speed: stats.speed || 0,
      regenRate: stats.regenRate || 1,

    };

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
   * lightRadius: how far the player can see
   *
   */
  var Player = function(options) {
    Actor.call(this, options);
    this.stats.lightRadius = options.stats.lightRadius || 30;
  };

  Player.prototype = Object.create(Actor.prototype);
  Player.prototype.constructor = Player;

  var Monster = function(options) {
    Actor.call(this, options);
  };

  Monster.prototype = Object.create(Actor.prototype);
  Monster.prototype.constructor = Monster;

  Monster.monsters = {
    rat: {
      name: "rat",
      stats: {
        hp: 100,
        str: 1, dex: 1, con: 1, intl: 1, wis: 1, luck: 1,
        speed: 0,
        regenRate: 1,
      },
      level: 1
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

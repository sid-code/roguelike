/*
 * This code describes a player.
 */

define([], function() {
  var Actor = function(options) {
    this.name = options.name || "Anon";
    var stats = options.stats || {};

    this.stats = {
      hp: stats.hp,
      maxhp: stats.hp,

      str: stats.str,
      dex: stats.dex,
      con: stats.con,
      intl: stats.intl,
      wis: stats.wis,
      luck: stats.luck,

      speed: stats.speed || 1,

    };

    this.pos = {dungeon: null, level: 0, x: 0, y: 0};

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

  return {
    Actor: Actor,
    Player: Player,
    Monster: Monster
  };
});

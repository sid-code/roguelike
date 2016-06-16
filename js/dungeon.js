/*
 * The code here describes a multi-level dungeon.
 *
 * Each dungeon is comprised of levels (generated on-demand) that link to each
 * other through staircases. The top level of a dungeon may be a "home" level
 * where the player has access to shops etc.
 *
 *
 */

define([], function() {
  var Dungeon = function() {
    this.levels = {};
  };


  Dungeon.prototype.getLevel = function(index) {
    return this.levels[index];
  };
  Dungeon.prototype.addLevel = function(index, map) {
    this.levels[index] = {
      items: [],
      monsters: [],
      attractions: [],
      map: map
    };
  };


  return Dungeon;
});

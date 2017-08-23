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
      map: map
    };
  };

  Dungeon.prototype.placeItem = function(index, x, y, item) {
    var level = this.getLevel(index);
    item.pos.level = index;
    item.pos.x = x;
    item.pos.y = y;
    level.items.push(item);
  };

  Dungeon.prototype.placeMonster = function(index, x, y, monster) {
    var level = this.getLevel(index);
    monster.pos.level = index;
    monster.pos.x = x;
    monster.pos.y = y;
    level.monsters.push(monster);
  };

  Dungeon.prototype.removeItem = function(item) {
    var level = this.getLevel(item.level);
    var index = level.items.indexOf(item);
    if (index > -1) {
      level.items.splice(index, 1);
      item.pos.level = 0;
      item.pos.x = 0;
      item.pos.y = 0;
    }

    return item;
  };


  return Dungeon;
});

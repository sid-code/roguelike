/*
 * The code here describes a multi-level dungeon.
 *
 * Each dungeon is comprised of levels (generated on-demand) that link to each
 * other through staircases. The top level of a dungeon may be a "home" level
 * where the player has access to shops etc.
 *
 *
 */

import { GenericItem } from "./item";
import { Monster } from "./actor";
import { DMap } from "./map";


export interface DungeonLevel {
  items: Array<GenericItem>;
  monsters: Array<Monster>;
  map: DMap;
}

export class Dungeon {
  levels: { [index: number]: DungeonLevel }

  constructor() {
    this.levels = {};
  }


  getLevel(index: number): DungeonLevel {
    return this.levels[index];
  }

  addLevel(index: number, map: DMap) {
    this.levels[index] = {
      items: [],
      monsters: [],
      map: map
    };
  }


  placeItem(index: number, x: number, y: number, item: GenericItem) {
    var level = this.getLevel(index);
    item.setPos({level: index, x: x, y: y});
    level.items.push(item);
  }

  placeMonster(index: number, x: number, y: number, monster: Monster) {
    var level = this.getLevel(index);
    monster.setPos({level: index, x: x, y: y});
    level.monsters.push(monster);
  }

  removeItem(item: GenericItem) {
    var level = this.getLevel(item.getPos().level);
    var index = level.items.indexOf(item);
    if (index > -1) {
      level.items.splice(index, 1);

      item.setPos({level: 0, x: 0, y: 0});
    }

    return item;
  }
}

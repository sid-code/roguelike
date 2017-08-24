// Field of view and line of sight calculations

import { DMap, Tile } from "./map";
import { SeeFunc } from "./game";

export class FOV {
  // Shamelessly copied from
  // http://www.roguebasin.com/index.php?title=LOS_using_strict_definition
  //
  // Casts a line from (x0, y0) to (x1, y1) stopping if there's a wall in the way.
  // Returns true if (x1, y1) successfully reached, false if not.
  // For each point seen, calls `fn`. If not provided, default of `this.see` is used.
  // If `fn` is null, a dummy empty function is used.
  castLine(map: DMap, x0: number, y0: number, x1: number, y1: number, fn: SeeFunc, maxLen = Infinity): boolean {

    var sx, sy, xnext, ynext, dx, dy, sqsum;
    var denom;

    if (typeof maxLen === "undefined") {
      maxLen = Infinity;
    }

    dx = x1 - x0;
    dy = y1 - y0;
    sqsum = dx * dx + dy * dy;

    if (sqsum > maxLen * maxLen) {
      return false;
    }

    sx = x0 < x1 ? 1 : -1;
    sy = y0 < y1 ? 1 : -1;
    xnext = x0;
    ynext = y0;

    denom = Math.sqrt(sqsum);
    while (xnext != x1 || ynext != y1) {
      if (fn) {
        fn(map, xnext, ynext);
      }

      if (map.get(xnext, ynext) == Tile.WALL) {
        // It's a wall, so we're done.
        return false;
      }

      if (Math.abs(dy * (xnext - x0 + sx) - dx * (ynext - y0)) / denom < 0.5) {
        xnext += sx;
      } else if (Math.abs(dy * (xnext - x0) - dx * (ynext - y0 + sy)) / denom < 0.5) {
        ynext += sy;
      } else {
        xnext += sx;
        ynext += sy;
      }
    }

    return true;
  }
  
}

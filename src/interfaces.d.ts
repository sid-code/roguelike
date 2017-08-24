
export as namespace RL;

import { Artifact, GenericItem } from "./item";
import { Monster } from "./actor";
import { Game } from "./game";

interface CoordPair {
  x: number;
  y: number;
}

export interface Position extends CoordPair {
  level: number;
}

export interface TimerCallback {
  (game: Game);
}
export interface Timer {
  ticksLeft: number;
  callback: TimerCallback;
}

export interface SimpleOutfit {
  wielded?: Artifact;
  worn?: Artifact;
  shield?: Artifact;
}

export interface ObjectList {
  monsters: Array<Monster>;
  items: Array<GenericItem>;
}

export interface OutputFunc {
  (msg: string, color: string);
}

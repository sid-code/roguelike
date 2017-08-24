import { Position } from "./interfaces";

export abstract class GenericObject {
  private pos: Position;
  
  setPos(newPos) {
    this.pos = newPos;
  }

  getPos(): Position {
    return this.pos;
  }

}

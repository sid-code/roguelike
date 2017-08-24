/*
 * This code describes an item.
 *
 * There are two kinds of items: regular items and attractions.
 *
 * Regular items (instances of Item): stuff that can be picked up, like weapons, armor, rings,
 * trash, etc.
 *
 * Attractions (instances of Attraction): stuff that cannot be picked up but may have some effect. Gold
 * might seem like an item initially but the actual "item" can't be picked up,
 * rather when you step on the tile you gain as much gold as the item is worth.
 *
 * What happens when the player steps on an item's tile is determined by the
 * item's announce() function.
 */

import { GenericObject } from "./object";
import { Actor } from "./actor";
import { Game } from "./game";

interface GenericItemOptions {
  name?: string;
}

interface ArtifactOptions extends GenericItemOptions {
  weight: number; 
}

interface StaircaseOptions extends GenericItemOptions {
  up: boolean;
}


export class GenericItem extends GenericObject {
  name: string;

  constructor(options: GenericItemOptions) {
    super();
    this.name = options.name;
    this.setPos({ level: 0, x: 0, y: 0 });
  }

  // Override this in subclasses. This is useful to hide the name of
  // scrolls/potions/whatever that the player hasn't discovered yet.
  getName(player: Actor): string {
    return this.name;
  }

  // Override this in subclasses. This function displays the message "you see
  // an x here" or whatever to the player. It can do anything you want, like
  // activate a trap or add gold to the player.
  announce(game: Game) {
    game.echo("There is " + this.getName(game.player) + " here.");
  }

}

export class Artifact extends GenericItem {
  weight: number;

  constructor(options: ArtifactOptions) {
    super(options);
    this.weight = options.weight;
  }

}

export class Attraction extends GenericItem {
  constructor(options: GenericItemOptions) {
    super(options);
  }
}

// In options, use the "up" property to set whether the staircase leads up or
// down.  true means it leads up, false means it leads down.
export class Staircase extends Attraction {
  up: boolean;

  constructor(options: StaircaseOptions) {
    super(options);
    this.name = this.name || "a staircase";

    this.up = !!options.up;
  }

  getName(player: Actor): string {
    return super.getName(player) + " leading " + (this.up ? "up" : "down");
  }

}

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

define([], function() {

  var GenericItem = function(options) {
    this.name = options.name;
    this.pos = {level: 0, x: 0, y: 0};
  };

  // Override this in subclasses. This is useful to hide the name of
  // scrolls/potions/whatever that the player hasn't discovered yet.
  GenericItem.prototype.getName = function(player) {
    return this.name;
  };

  // Override this in subclasses. This function displays the message "you see
  // an x here" or whatever to the player. It can do anything you want, like
  // activate a trap or add gold to the player.
  GenericItem.prototype.announce = function(game) {
    game.echo("There is " + this.getName(game.player) + " here.");
  };

  var Attraction = function(options) {
    GenericItem.call(this, options);
  };

  Attraction.prototype = Object.create(GenericItem.prototype);
  Attraction.prototype.constructor = Attraction;

  // In options, use the "up" property to set whether the staircase leads up or
  // down.  true means it leads up, false means it leads down.
  var Staircase = function(options) {
    Attraction.call(this, options);
    this.name = this.name || "a staircase";

    this.up = !!options.up;
  };

  Staircase.prototype = Object.create(Attraction.prototype);
  Staircase.prototype.constructor = Staircase;

  Staircase.prototype.getName = function(player) {
    return GenericItem.prototype.getName.call(this, player) + " leading " + (this.up ? "up" : "down");
  };

  return {
    GenericItem: GenericItem,
    Attraction: Attraction,
    Staircase: Staircase,
  };

});

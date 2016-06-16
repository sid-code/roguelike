/*
 * This is the code for an extremely simple PRNG I devised to allow re-using
 * seeds to get the same sequence again.
 */
define(function() {
  var PSprng = function(seed) {
    this.seed = seed;
    this.value = seed;

    // discard a lot of values so it isn't too predictable
    for (var i = 0; i < 1000; i++) {
      this.next();
    }
  };

  var multiplier = 100000;
  PSprng.prototype.next = function() {
    this.value = this.seed - 1 / this.value;

    // `this.value` now holds a number n between 0 and 1. However, this value
    // is highly biased because the map taken by itself decreases monotonously
    // until it falls below zero and then increases. This creates a
    // significantly non-random sequence. To eliminate this bias, we ignore the
    // first few digits of the random number so we are left with an almost
    // seemingly random sequence. The value of `multiplier` is an arbitrary
    // power of 10.

    return (Math.abs(this.value) * multiplier) % 1;
  };

  PSprng.prototype.nextInt = function() {
    var min = 0;
    var max;
    if (arguments.length == 0) max = Number.MAX_SAFE_INTEGER;
    if (arguments.length < 2) max = arguments[0]
    if (arguments.length >= 2) {
      min = arguments[0];
      max = arguments[1];
    }

    return parseInt(this.next() * (max - min) + min);
  }

  PSprng.prototype.sample = function(list) {
    var index = this.nextInt(0, list.length);
    return list[index];
  };

  PSprng.prototype.sampleAndRemove = function(list) {
    var index = this.nextInt(0, list.length);
    return list.splice(index, 1)[0];
  };

  return PSprng;

});

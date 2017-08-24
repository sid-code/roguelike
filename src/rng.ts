/*
 * This is the code for an extremely simple PRNG I devised to allow re-using
 * seeds to get the same sequence again.
 */

export class PSprng {
  seed: number;
  value: number;

  constructor(seed: number) {
    this.seed = seed;
    this.value = seed;

    // discard a lot of values so it isn't too predictable
    for (var i = 0; i < 1000; i++) {
      this.next();
    }
  };

  static multiplier = 100000;

  next(): number {
    this.value = this.seed - 1 / this.value;

    // `this.value` now holds a number n between 0 and 1. However, this value
    // is highly biased because the map taken by itself decreases monotonously
    // until it falls below zero and then increases. This creates a
    // significantly non-random sequence. To eliminate this bias, we ignore the
    // first few digits of the random number so we are left with an almost
    // seemingly random sequence. The value of `multiplier` is an arbitrary
    // power of 10.

    return (Math.abs(this.value) * PSprng.multiplier) % 1;
  }

  nextInt(min: number, max: number): number {
    return (this.next() * (max - min) + min) >> 0;
  }

  sample<T>(list: Array<T>): T {
    var index = this.nextInt(0, list.length);
    return list[index];
  }

  sampleAndRemove<T>(list: Array<T>): T {
    var index = this.nextInt(0, list.length);
    return list.splice(index, 1)[0];
  }

}


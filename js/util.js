/*
 * This file holds utility functions.
 */
define([], function() {
  var Util = {};

  // Szudzik's pairing function; more space efficient than the Cantor pairing function.
  // http://szudzik.com/ElegantPairing.pdf
  // Code taken from: http://stackoverflow.com/a/13871379/945873
  //
  // Assumes x, y > 0. CAN OVERFLOW, but since it's used with coordinates in
  // the map, this shouldn't ever be a problem because there isn't enough
  // memory to hold a map big enough to cause this function to overflow.
  Util.pair = function(x, y) {
    return x >= y ? x * x + x + y : x + y * y;
  };

  // Returns the sign of x. (-1, 0, 1)
  // Stolen from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign
  Util.sign = function(x) {
    // If x is NaN, the result is NaN.
    // If x is -0, the result is -0.
    // If x is +0, the result is +0.
    // If x is negative and not -0, the result is -1.
    // If x is positive and not +0, the result is +1.
    return ((x > 0) - (x < 0)) || +x;
    // A more aesthetical persuado-representation is shown below
    //
    // ( (x > 0) ? 0 : 1 )  // if x is negative then negative one
    //          +           // else (because you cant be both - and +)
    // ( (x < 0) ? 0 : -1 ) // if x is positive then positive one
    //         ||           // if x is 0, -0, or NaN, or not a number,
    //         +x           // Then the result will be x, (or) if x is
    //                      // not a number, then x converts to number
  };

  return Util;
});

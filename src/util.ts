/*
 * This file holds utility functions.
 */

// Szudzik's pairing function; more space efficient than the Cantor pairing function.
// http://szudzik.com/ElegantPairing.pdf
// Code taken from: http://stackoverflow.com/a/13871379/945873
//
// Assumes x, y > 0. CAN OVERFLOW, but since it's used with coordinates in
// the map, this shouldn't ever be a problem because there isn't enough
// memory to hold a map big enough to cause this function to overflow.

export function pair(x: number, y: number): number {
  return x >= y ? x * x + x + y : x + y * y;
}

// Returns the sign of x. (-1, 0, 1)

export function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

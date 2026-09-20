/**
 * Re-applies `s.replace(re, replacement)` until the result stops changing.
 *
 * A regex-based strip that runs only once can leave behind a match that only
 * becomes visible once an earlier removal closes the gap around it. The
 * textbook case (from CodeQL's own js/incomplete-multi-character-sanitization
 * help): stripping `<!--` and `-->` from "<!<!-- comment -->>" in one pass
 * leaves "<!-- comment -->" behind, a comment reformed from the leftovers.
 * Looping the SAME replace call to a fixed point is the recognized fix, so
 * every regex-based HTML/markup strip in this repo goes through this helper
 * instead of trusting one `.replace()` call. (The loop has to sit directly
 * around the `.replace()` call itself, in this one function, for static
 * analysis to see that it always runs to a fixed point; passing the removal
 * in as a callback so the `.replace()` lives in the caller instead defeats
 * that, which is why this takes `re` and `replacement` as data.)
 */
export function stabilize(s: string, re: RegExp, replacement: string): string {
  let prev: string;
  do {
    prev = s;
    s = s.replace(re, replacement);
  } while (s !== prev);
  return s;
}

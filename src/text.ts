/**
 * Re-applies `transform` to `s` until the result stops changing.
 *
 * A regex-based strip that runs only once can leave behind a match that only
 * becomes visible once an earlier removal closes the gap around it. The
 * textbook case: removing "ab" from "aabb" in one pass deletes the "ab" in
 * the middle and leaves the outer "a" and "b" newly adjacent, reforming
 * "ab". The same shape of bug lets a crafted input survive a single-pass
 * strip of HTML comments, tags or style blocks (CodeQL:
 * js/incomplete-multi-character-sanitization). Looping to a fixed point is
 * the general fix, so every regex-based HTML/markup strip in this repo goes
 * through this helper instead of trusting one `.replace()` call.
 */
export function stabilize(s: string, transform: (s: string) => string): string {
  let prev: string;
  do {
    prev = s;
    s = transform(s);
  } while (s !== prev);
  return s;
}

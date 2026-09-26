/**
 * @file A small spinning ring shown next to loading text.
 *
 * Decorative (`aria-hidden`): the text beside it is the status screen readers
 * hear. It spins in CSS (`playground.css`) and holds still for people who
 * prefer reduced motion.
 */

/** Render the spinner. */
export function Spinner() {
  return <span className="pg-spinner" aria-hidden="true" data-testid="spinner" />;
}

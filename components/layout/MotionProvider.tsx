"use client";

import { MotionConfig } from "framer-motion";

/**
 * One place that makes every animation on the site respect the setting the
 * visitor already made on their own device.
 *
 * Thirty-four components animate with framer-motion. Two of them called
 * useReducedMotion. The other thirty-two, the booking form among them, played
 * their entrances and slides at somebody who had asked their phone to stop
 * moving things — which for a vestibular disorder is not a matter of taste.
 *
 * reducedMotion="user" is the fix at the root rather than in thirty-two files:
 * every motion component underneath it drops transform and layout animation
 * when the media query is set, keeps opacity so nothing silently vanishes, and
 * is untouched otherwise. Fixing it per component would have meant editing
 * each one and would have reintroduced the bug with the next component
 * somebody wrote.
 *
 * CSS transitions and keyframes are outside framer-motion's reach, so
 * app/globals.css carries the matching @media block for those.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

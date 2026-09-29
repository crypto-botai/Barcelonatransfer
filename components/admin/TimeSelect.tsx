"use client";

/**
 * A pickup time, always on a 24-hour clock.
 *
 * The office used `<input type="time">`, which renders in whatever locale the
 * browser is set to — on an en-US machine that is a 12-hour box with an AM/PM
 * toggle, so the same booking read "4:00 PM" to one person and "16:00" to the
 * next, and the page had no way to force one or the other.
 *
 * A plain select removes the question. Every option is written the way the
 * rest of the site writes a pickup time, and the value handed back is still
 * "HH:mm", so nothing downstream changes.
 */

/** "00:00" through "23:30", every half hour — the same grid customers book on. */
export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  /** Shown when nothing is chosen yet. */
  placeholder?: string;
}

export default function TimeSelect({ value, onChange, className = "", id, placeholder = "Select time" }: Props) {
  // A time already on the booking that is not on the half-hour grid — an
  // 08:45 flight arrival, say — must stay selectable rather than silently
  // snapping to 08:30 the moment somebody opens the form.
  const options = value && !TIME_SLOTS.includes(value)
    ? [...TIME_SLOTS, value].sort()
    : TIME_SLOTS;

  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

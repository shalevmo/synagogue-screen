/**
 * Fixed pair per holy period (locked "B", Sep 14 2026): from the first night
 * through the whole chag/Shabbat, the panel shows ONE pair — the period's
 * entry time (candles of its eve) and the period's final exit time
 * (shkiah+32 of its last day). Every day of the period shows the same pair.
 *
 * A holy period = a maximal run of consecutive holy days (holy = Shabbat ∪
 * CHAG ∪ CHM; a major fast day (YK / Tisha B'Av) continues a run as a
 * "bridge" but is not a member — its fast block covers it).
 */
import { HDate } from '@hebcal/core';
import {
  candlesAt, continuesRun, entryLabelOf, eventsForHDate, fastEndAt,
  hasChag, havdalahAt, shkiahOf, walkBack, walkForward, fmt,
} from './common.js';

/**
 * The period pair for an in-period today, or null when today is a fast
 * bridge (the fast block already shows both instants) or not in period.
 *
 * Supplementary candles: Shabbat eve INSIDE a long run (e.g. Hoshana Rabbah
 * Friday) — tonight's candles lit from an existing flame, in addition to
 * the period pair. Skipped when the run starts today (tonight's candles
 * are already the pair's entry line).
 *
 * @returns {{timed: {label, time}[]}|null}
 */
export function periodPairOf(gloc, today, todayContinues, tomorrow, tomorrowHoly, tomorrowContinues) {
  if (todayContinues) return null;   // fast bridge: the fast block owns the day

  const start = walkBack(today, gloc);
  const end = walkForward(today, gloc);

  const timed = [];
  const periodEve = new HDate(start.abs() - 1);
  timed.push({ label: entryLabelOf(gloc, start), time: fmt(candlesAt(gloc, periodEve)) });

  // Exit: the run's final exit instant (last member incl. bridge).
  // A trailing Tisha B'Av bridge ends at ITS fast end (OH tzais), with
  // the fast label — YK keeps יציאת החג at havdalah (it is a chag).
  // Gabbai decision (Sep 2026): a fast-bridged exit shows BOTH the
  // fast's start and end on the days BEFORE the fast (Shabbat 9 Av
  // nidche → the congregation sees when tonight's fast begins) —
  // never a bare end line. The start follows the fast block's rule:
  // TB begins at shkiah of the eve (the Motzei-Shabbat shkiah).
  const endEvs = eventsForHDate(end, gloc);
  const endIsFastBridge = continuesRun(endEvs) && !hasChag(endEvs);
  if (endIsFastBridge) {
    timed.push({ label: 'תחילת הצום', time: fmt(shkiahOf(gloc, new HDate(end.abs() - 1))) });
    timed.push({ label: 'סיום הצום', time: fmt(fastEndAt(gloc, end)) });
  } else {
    const exitLabel = hasChag(endEvs) ? 'יציאת החג' : 'הבדלה';
    timed.push({ label: exitLabel, time: fmt(havdalahAt(gloc, end)) });
  }

  // Supplementary candles inside the run (see doc header).
  if (today.getDay() === 5 && start.abs() < today.abs()
      && (tomorrowHoly || tomorrowContinues)) {
    timed.push({ label: 'הדלקת נרות', time: fmt(candlesAt(gloc, today)) });
  }

  return { timed };
}
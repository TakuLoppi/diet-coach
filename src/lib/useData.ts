import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db, type Analysis, type DayLog, type Profile } from '../db';
import { currentWeight, hasRecord, isPlateau, predictGoal, streak, targets, weightSeries } from './calc';
import { addDays, diffDays, todayKey } from './dates';

const EMPTY_DAYS: DayLog[] = [];
const EMPTY_AN: Analysis[] = [];
const EMPTY_DATES: string[] = [];

/** 画面間で共有する集計値 */
export function useData(profile: Profile) {
  const days = useLiveQuery(() => db.days.toArray(), [], EMPTY_DAYS);
  const analyses = useLiveQuery(() => db.analyses.toArray(), [], EMPTY_AN);
  const photoDates = useLiveQuery(async () => (await db.photos.orderBy('date').uniqueKeys()) as string[], [], EMPTY_DATES);
  const today = todayKey();

  return useMemo(() => {
    const series = weightSeries(days);
    const weight = currentWeight(series, today) ?? profile.startWeight;
    const tg = targets(profile, weight, today);
    const recordDates = new Set([...days.filter(hasRecord).map((d) => d.date), ...photoDates]);
    const dayMap = new Map(days.map((d) => [d.date, d]));
    const anMap = new Map(analyses.map((a) => [a.date, a]));
    return {
      today,
      days,
      dayMap,
      analyses,
      anMap,
      series,
      weight,
      latestWeight: series.at(-1)?.weight ?? null,
      targets: tg,
      prediction: predictGoal(series, profile.goalWeight, today),
      plateau: isPlateau(series, today),
      streak: streak(recordDates, today),
      dayNumber: Math.max(1, diffDays(profile.startDate, today) + 1),
      yesterday: addDays(today, -1),
    };
  }, [days, analyses, photoDates, profile, today]);
}

export type AppData = ReturnType<typeof useData>;

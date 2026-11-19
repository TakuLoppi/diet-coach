import Dexie, { type Table } from 'dexie';

export type Sex = 'male' | 'female';
export type Activity = 'low' | 'mid' | 'high';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
};

export interface Profile {
  id: 1;
  age: number;
  sex: Sex;
  heightCm: number;
  startWeight: number;
  goalWeight: number;
  goalDate?: string; // 任意
  activity: Activity;
  stepGoal: number;
  notes?: string; // 食事の制限・アレルギー・苦手
  startDate: string;
}

/** 1日分の記録。sleepH は「その日の夜〜翌朝」の睡眠 */
export interface DayLog {
  date: string;
  weight?: number;
  meals: Partial<Record<MealSlot, string>>;
  water?: number; // ml
  exercise?: string;
  exerciseMin?: number;
  steps?: number;
  sleepH?: number;
  sleepQ?: number; // 1-5
  mood?: number; // 1-5（5=良好）
  hunger?: number; // 1-5（5=強い空腹）
  alcohol?: string;
  bowel?: 'yes' | 'no';
  memo?: string;
  sentAt?: number;
}

export interface Photo {
  id?: number;
  date: string;
  slot: MealSlot;
  blob: Blob;
  createdAt: number;
}

export interface MealItem {
  name: string;
  amount?: string;
  kcal?: number;
}

export interface Analysis {
  date: string;
  grade?: string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  meals?: { slot: string; items: MealItem[] }[];
  good: string[];
  bad: string[];
  todo: string[];
  coach?: string;
  raw: string;
  importedAt: number;
  exportedAt?: number; // Obsidian用に書き出した日時
}

export interface Weekly {
  weekEnd: string;
  theme?: string;
  summary?: string;
  raw: string;
  importedAt: number;
  exportedAt?: number;
}

export interface Favorite {
  id?: number;
  name: string;
  text: string;
}

class DietDB extends Dexie {
  profile!: Table<Profile, number>;
  days!: Table<DayLog, string>;
  photos!: Table<Photo, number>;
  analyses!: Table<Analysis, string>;
  weekly!: Table<Weekly, string>;
  favorites!: Table<Favorite, number>;

  constructor() {
    super('diet-coach');
    this.version(1).stores({
      profile: 'id',
      days: 'date',
      photos: '++id, date, [date+slot]',
      analyses: 'date',
      weekly: 'weekEnd',
      favorites: '++id',
    });
  }
}

export const db = new DietDB();

export async function saveDay(date: string, patch: Partial<Omit<DayLog, 'date'>>) {
  await db.transaction('rw', db.days, async () => {
    const cur: DayLog = (await db.days.get(date)) ?? { date, meals: {} };
    await db.days.put({ ...cur, ...patch, meals: { ...cur.meals, ...(patch.meals ?? {}) }, date });
  });
}

import { create } from "zustand";

export interface Coupon {
  id: string;
  code: string;
  title: string;
  percent?: number;
  amount?: number;
  usesLeft: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

const STORAGE_KEY = "coupons";

function load(): Coupon[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function save(items: Coupon[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

interface CouponsState {
  items: Coupon[];
  add: (c: Coupon) => void;
  update: (id: string, patch: Partial<Coupon>) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  refresh: () => void;
}

export const useCouponsStore = create<CouponsState>((set, get) => ({
  items: load(),
  add: (c) => { const items = [...get().items, c]; save(items); set({ items }); },
  update: (id, patch) => { const items = get().items.map(i => i.id === id ? { ...i, ...patch } : i); save(items); set({ items }); },
  remove: (id) => { const items = get().items.filter(i => i.id !== id); save(items); set({ items }); },
  toggle: (id) => { const items = get().items.map(i => i.id === id ? { ...i, active: !i.active } : i); save(items); set({ items }); },
  refresh: () => set({ items: load() })
}));

export function applyBestCoupon(total: number): { total: number; applied?: Coupon } {
  const now = new Date();
  const coupons = useCouponsStore.getState().items.filter(c => c.active && c.usesLeft > 0 && (!c.startDate || new Date(c.startDate) <= now) && (!c.endDate || new Date(c.endDate) >= now));
  let best = undefined as Coupon | undefined;
  let bestTotal = total;
  for (const c of coupons) {
    let t = total;
    if (c.percent) t = Math.max(0, t * (1 - c.percent / 100));
    if (c.amount) t = Math.max(0, t - c.amount);
    if (t < bestTotal) { bestTotal = t; best = c; }
  }
  return { total: bestTotal, applied: best };
}


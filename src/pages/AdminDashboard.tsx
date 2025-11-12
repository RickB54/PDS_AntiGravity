import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CalendarDays, UserPlus, FileText, Package, DollarSign, Calculator, Folder, Users, Grid3X3, CheckSquare, Tag, Settings as Cog } from "lucide-react";
import { Link } from "react-router-dom";
import localforage from "localforage";
import { useAlertsStore } from "@/store/alerts";
import { useBookingsStore } from "@/store/bookings";
import { isViewed } from "@/lib/viewTracker";
import { getInvoices } from "@/lib/db";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/store/alerts";

type Job = { finishedAt: string; totalRevenue: number; status: string };

export default function AdminDashboard() {
  const { toast } = useToast();
  const { latest, unreadCount, markRead, dismiss, dismissAll, refresh } = useAlertsStore();
  const alertsAll = useAlertsStore((s) => s.alerts);
  const { items } = useBookingsStore();
  const [newBookingsToday, setNewBookingsToday] = useState<number>(0);
  const [unpaidInvoices, setUnpaidInvoices] = useState<number>(0);
  const [criticalInventory, setCriticalInventory] = useState<number>(0);
  const [newFilesToday, setNewFilesToday] = useState<number>(0);
  const [totalDue, setTotalDue] = useState<number>(0);
  const [overdueCount, setOverdueCount] = useState<number>(0);

  useEffect(() => {
    const todayStr = new Date().toDateString();
    const count = items.filter(b => new Date(b.date).toDateString() === todayStr && !isViewed("booking", b.id)).length;
    setNewBookingsToday(count);
  }, [items]);

  // Helper: unread alert count by type
  const badgeByType = useMemo(() => {
    return (type: any) => alertsAll.filter((a) => a.type === type && !a.read).length;
  }, [alertsAll]);

  useEffect(() => {
    // Invoices unpaid
    getInvoices<any>().then(list => {
      const count = list.filter((inv: any) => (inv.paymentStatus || "unpaid") !== "paid").length;
      setUnpaidInvoices(count);
    });

    // Materials + Chemicals critical count
    Promise.all([
      localforage.getItem<any[]>("materials"),
      localforage.getItem<any[]>("chemicals")
    ]).then(([mats, chems]) => {
      const mArr = Array.isArray(mats) ? mats : [];
      const cArr = Array.isArray(chems) ? chems : [];
      const mCount = mArr.filter(i => typeof i.lowThreshold === 'number' && (i.quantity || 0) <= (i.lowThreshold || 0)).length;
      const cCount = cArr.filter(c => (c.currentStock || 0) <= (c.threshold || 0)).length;
      const total = mCount + cCount;
      setCriticalInventory(total);
      try { localStorage.setItem('inventory_low_count', String(total)); } catch {}
    });

    // File Manager new files today
    const records = JSON.parse(localStorage.getItem('pdfArchive') || '[]');
    const tStr = new Date().toLocaleDateString().replace(/\//g, '-');
    const countFiles = records.filter((r: any) => String(r.date).includes(tStr) && !isViewed("file", String(r.id))).length;
    setNewFilesToday(countFiles);

    // Payroll Due: use endpoints for count and total; then push alerts/toast
    (async () => {
      try {
        const cRes = await api('/api/payroll/due-count', { method: 'GET' });
        const tRes = await api('/api/payroll/due-total', { method: 'GET' });
        const count = Number(cRes?.count || 0);
        const total = Number(tRes?.total || 0);
        setOverdueCount(count);
        setTotalDue(total);
        if (count > 0) {
          toast({ title: `${count} employees overdue — check Payroll`, description: `Total due $${total.toFixed(2)}` });
          // Push per-employee alerts with estimated amounts
          try {
            const employees = (await localforage.getItem<any[]>('company-employees')) || [];
            const hist = (await localforage.getItem<any[]>('payroll-history')) || [];
            const jobs = JSON.parse(localStorage.getItem('completedJobs') || '[]');
            const adj = JSON.parse(localStorage.getItem('payroll_owed_adjustments') || '{}');
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            const dueEmps = employees.filter((emp:any) => {
              const lastPaidTs = emp.lastPaid ? new Date(emp.lastPaid).getTime() : 0;
              const recentPaid = hist.some(h => String(h.status) === 'Paid' && (String(h.employee) === emp.name || String(h.employee) === emp.email) && (now - new Date(h.date).getTime()) <= sevenDays);
              return (!recentPaid) && ((now - lastPaidTs) > sevenDays);
            });
            dueEmps.forEach((emp:any) => {
              const unpaidJobs = jobs.filter((j:any) => j.status === 'completed' && !j.paid && (String(j.employee) === emp.email || String(j.employee) === emp.name));
              const unpaidSum = unpaidJobs.reduce((s:number, j:any) => s + Number(j.totalRevenue || 0), 0);
              const pendHist = hist.filter((h:any) => String(h.status) === 'Pending' && (String(h.employee) === emp.name || String(h.employee) === emp.email));
              const pendingSum = pendHist.reduce((s:number, h:any) => s + Number(h.amount || 0), 0);
              const adjSum = Number(adj[emp.name] || 0) + Number(adj[emp.email] || 0);
              const owed = Math.max(0, unpaidSum + pendingSum - adjSum);
              const msg = `${emp.name} due $${owed.toFixed(2)} — pay now`;
              // Prevent duplicate unread alerts for same employee within 24h
              const already = alertsAll.some(a => a.type === 'payroll_due' && a.message?.includes(emp.name) && !a.read && (now - new Date(a.timestamp).getTime()) < (24*60*60*1000));
              if (!already) notify('payroll_due', msg, 'system', { employee: emp.name, amount: owed });
            });
          } catch {}
        }
      } catch {}
    })();
  }, []);

  // Real-time Alerts: reflect changes across tabs and actions
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'admin_alerts') {
        try { refresh(); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    try { refresh(); } catch {}
    const onAlertsUpdated = () => { try { refresh(); } catch {} };
    window.addEventListener('admin_alerts_updated' as any, onAlertsUpdated as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('admin_alerts_updated' as any, onAlertsUpdated as any);
    };
  }, [refresh]);

  useEffect(() => {
    const recalc = () => {
      const todayStr = new Date().toDateString();
      setNewBookingsToday(items.filter(b => new Date(b.date).toDateString() === todayStr && !isViewed("booking", b.id)).length);
      // Recompute inventory across materials + chemicals
      Promise.all([
        localforage.getItem<any[]>("materials"),
        localforage.getItem<any[]>("chemicals")
      ]).then(([mats, chems]) => {
        const mArr = Array.isArray(mats) ? mats : [];
        const cArr = Array.isArray(chems) ? chems : [];
        const mCount = mArr.filter(i => typeof i.lowThreshold === 'number' && (i.quantity || 0) <= (i.lowThreshold || 0)).length;
        const cCount = cArr.filter(c => (c.currentStock || 0) <= (c.threshold || 0)).length;
        const total = mCount + cCount;
        setCriticalInventory(total);
        try { localStorage.setItem('inventory_low_count', String(total)); } catch {}
      });
      // Recompute files today
      const records = JSON.parse(localStorage.getItem('pdfArchive') || '[]');
      const tStr = new Date().toLocaleDateString().replace(/\//g, '-');
      setNewFilesToday(records.filter((r: any) => String(r.date).includes(tStr) && !isViewed("file", String(r.id))).length);
    };
    window.addEventListener('storage', recalc);
    return () => window.removeEventListener('storage', recalc);
  }, [items]);

  const RedBox = ({
    title,
    subtitle,
    href,
    Icon,
    badgeCount = 0,
  }: { title: string; subtitle: string; href: string; Icon: any; badgeCount?: number; }) => (
    <Card className="relative p-5 bg-[#18181b] rounded-2xl border border-zinc-800 hover:border-red-700 transition-shadow hover:shadow-[0_0_0_2px_rgba(220,38,38,0.35)]">
      {badgeCount > 0 && (
        <div className="absolute top-2 right-2 bg-red-600/90 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px]">
          {badgeCount}
        </div>
      )}
      <div className="flex items-start">
        <div className="flex-1">
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="text-sm text-zinc-400">{subtitle}</div>
        </div>
        <Icon className="w-8 h-8 text-red-600/80" />
      </div>
      <Link to={href} className="block mt-3">
        <Button size="sm" variant="outline" className="w-full rounded-md border-red-600 text-red-600 hover:bg-red-600/10">Open</Button>
      </Link>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Admin Dashboard" />
      <div className="p-4 space-y-6 max-w-screen-xl mx-auto overflow-x-hidden">
        {/* Real-time Alerts banner with deep purple background */}
        <Card className="p-4 border-purple-500/60 border bg-purple-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-white" />
              <h2 className="font-bold text-white">Real-time Alerts</h2>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-white">Unread: {unreadCount}</span>
              <Button size="sm" className="bg-black text-red-700 border-red-700 hover:bg-red-800/20" onClick={dismissAll}>Dismiss All</Button>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="space-y-2 max-h-48 overflow-auto">
            {[...latest].reverse().slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">{a.title}</span>
                <div className="flex items-center gap-2">
                  <a href={a.href} className="text-xs text-blue-400 hover:underline" onClick={() => markRead(a.id)}>Open</a>
                  <Button size="xs" variant="outline" onClick={() => markRead(a.id)}>Mark read</Button>
                  <Button size="xs" variant="outline" className="bg-black text-red-700 border-red-700 hover:bg-red-800/20" onClick={() => dismiss(a.id)}>Dismiss</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick-action red boxes grid (3 columns at lg and above) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RedBox title="New Booking" subtitle={`New today: ${newBookingsToday}`} href="/bookings" Icon={CalendarDays} badgeCount={Math.max(newBookingsToday, badgeByType('booking_created'))} />
          <RedBox title="Add Customer" subtitle="Find or add customer" href="/search-customer" Icon={UserPlus} badgeCount={badgeByType('customer_added')} />
          <RedBox title="Create Invoice" subtitle={`${unpaidInvoices} unpaid`} href="/invoicing" Icon={FileText} badgeCount={Math.max(unpaidInvoices, badgeByType('invoice_unpaid'))} />
          <RedBox title="Low Inventory" subtitle={`${criticalInventory} items critical`} href="/inventory-control" Icon={Package} badgeCount={criticalInventory} />
          <RedBox title="Payroll Due" subtitle={`${overdueCount} employees due payment this week — $${totalDue.toFixed(2)} total`} href="/payroll" Icon={DollarSign} badgeCount={Math.max(badgeByType('payroll_due'), overdueCount)} />
          <RedBox title="Accounting" subtitle="View P&L" href="/accounting" Icon={Calculator} badgeCount={badgeByType('accounting_update')} />
          <RedBox title="File Manager" subtitle={`${newFilesToday} new file${newFilesToday === 1 ? '' : 's'}`} href="/file-manager" Icon={Folder} badgeCount={Math.max(newFilesToday, alertsAll.filter(a => a.type === 'pdf_saved' && !a.read).length)} />
          <RedBox title="Customer Profiles" subtitle="View Customer Info PDFs" href="/search-customer" Icon={Users} badgeCount={alertsAll.filter(a => a.payload?.recordType === 'Customer' && !a.read).length} />
          <RedBox title="Staff Portal" subtitle="Open menu" href="/employee-dashboard" Icon={Grid3X3} />
          <RedBox title="Todo" subtitle={`Overdue: ${0}`} href="/checklist" Icon={CheckSquare} badgeCount={badgeByType('todo_overdue')} />
          <RedBox title="Package Pricing" subtitle="Update prices" href="/package-pricing" Icon={Tag} badgeCount={badgeByType('pricing_update')} />
          <RedBox title="Company Settings" subtitle="Edit business" href="/settings" Icon={Cog} />
        </div>
      </div>
    </div>
  );
}

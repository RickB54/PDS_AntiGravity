import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Upload, Trash2 } from "lucide-react";
import { postFullSync, postServicesFullSync } from "@/lib/servicesMeta";
import { exportAllData, downloadBackup, restoreFromJSON, SCHEMA_VERSION } from '@/lib/backup';
import { isDriveEnabled, uploadJSONToDrive, pickDriveFileAndDownload } from '@/lib/googleDrive';
import { deleteCustomersOlderThan, deleteInvoicesOlderThan, deleteExpensesOlderThan, deleteInventoryUsageOlderThan, deleteBookingsOlderThan, deleteEverything as deleteAllSupabase } from '@/services/supabase/adminOps';
import localforage from "localforage";
import EnvironmentHealthModal from '@/components/admin/EnvironmentHealthModal';

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("");
  const [preview, setPreview] = useState<{ tables: { name: string; count: number }[] } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<{ preserved: string[]; deleted: string[]; note?: string } | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);

  // Redirect non-admin users
  if (user?.role !== 'admin') {
    navigate('/');
    return null;
  }

  const handleBackup = async () => {
    try {
      const { json } = await exportAllData();
      downloadBackup(json);
      toast({ title: "Backup Created", description: `Backup includes Supabase + local (v${SCHEMA_VERSION}).` });
    } catch (error) {
      toast({ title: "Backup Failed", description: "Could not create backup.", variant: "destructive" });
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await restoreFromJSON(text);
      toast({ title: "Restore Complete", description: "Supabase + local data restored." });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({ title: "Restore Failed", description: "Could not restore data.", variant: "destructive" });
    }
  };

  const handleBackupToDrive = async () => {
    try {
      const { json } = await exportAllData();
      const enabled = await isDriveEnabled();
      if (!enabled) {
        downloadBackup(json);
        window.open('https://drive.google.com/drive/u/0/my-drive', '_blank');
        toast({ title: 'Drive Not Configured', description: 'Downloaded backup. Upload it to Drive manually.' });
        return;
      }
      const id = await uploadJSONToDrive(`pds-backup-${new Date().toISOString().split('T')[0]}.json`, json);
      if (id) {
        toast({ title: 'Backup Uploaded', description: `Google Drive file ID: ${id}` });
      } else {
        downloadBackup(json);
        window.open('https://drive.google.com/drive/u/0/my-drive', '_blank');
        toast({ title: 'Drive Upload Failed', description: 'Downloaded backup for manual upload.' });
      }
    } catch {
      toast({ title: 'Backup Failed', description: 'Unable to create or upload backup.', variant: 'destructive' });
    }
  };

  const handleOpenDriveRestore = async () => {
    try {
      const enabled = await isDriveEnabled();
      if (!enabled) {
        window.open('https://drive.google.com/drive/u/0/my-drive', '_blank');
        toast({ title: 'Drive Not Configured', description: 'Download JSON from Drive, then use Restore Backup.' });
        return;
      }
      const file = await pickDriveFileAndDownload();
      if (file?.content) {
        await restoreFromJSON(file.content);
        toast({ title: 'Restore Complete', description: `Restored from Drive file: ${file.name}` });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast({ title: 'No JSON Found', description: 'Pick a JSON backup in Drive.' });
      }
    } catch {
      toast({ title: 'Restore Failed', description: 'Unable to restore from Drive.', variant: 'destructive' });
    }
  };

  const handlePricingRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.savedPrices) await localforage.setItem('savedPrices', data.savedPrices);
      if (data.packageMeta) localStorage.setItem('packageMeta', JSON.stringify(data.packageMeta));
      if (data.addOnMeta) localStorage.setItem('addOnMeta', JSON.stringify(data.addOnMeta));
      if (data.customPackages) localStorage.setItem('customServicePackages', JSON.stringify(data.customPackages));
      if (data.customAddOns) localStorage.setItem('customAddOns', JSON.stringify(data.customAddOns));
      if (data.customServices) localStorage.setItem('customServices', JSON.stringify(data.customServices));
      await postFullSync();
      await postServicesFullSync();
  try { await fetch(`http://localhost:6061/api/packages/live?v=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }); } catch {}
      toast({ title: "Pricing restored from backup — live site updated" });
    } catch (error) {
      toast({ title: "Restore Failed", description: "Could not restore pricing.", variant: "destructive" });
    }
  };

  const deleteData = async (type: string) => {
    try {
      const now = new Date();
      const days = Number(String(timeRange || '').trim());
      const hasRange = Number.isFinite(days) && days > 0;
      const cutoffDate = new Date(now.getTime() - Math.max(0, days) * 24 * 60 * 60 * 1000);

      // Temporary detailed logs per request: role, filters, responses, audit-log
      const { data: auth } = await (await import('@/lib/supabase')).default.auth.getUser();
      const role = getCurrentUser()?.role;
      console.group(`[Settings] Delete request`);
      console.log('type', type);
      console.log('sessionUserId', auth?.user?.id);
      console.log('role', role);
      console.log('days', days, 'hasRange', hasRange, 'cutoffDate', cutoffDate.toISOString());

      if (type === "customers") {
        // Local cache
        const customers: any[] = await localforage.getItem("customers") || [];
        const filtered = hasRange
          ? customers.filter((c: any) => {
              const dateStr = c.createdAt || c.updatedAt || '';
              const date = dateStr ? new Date(dateStr) : null;
              return date && !Number.isNaN(date.getTime()) && date > cutoffDate;
            })
          : [];
        await localforage.setItem("customers", filtered);
        // Supabase — customers + app_users (role=customer)
        try {
          await deleteBookingsOlderThan(String(days || 0));
          console.log('[Settings] deleteBookingsOlderThan done');
          await deleteCustomersOlderThan(String(days || 0));
          console.log('[Settings] deleteCustomersOlderThan done');
        } catch (e) {
          console.error('[Settings] customers delete error', e);
          throw e;
        }
      } else if (type === "invoices") {
        const invoices: any[] = await localforage.getItem("invoices") || [];
        const filtered = hasRange
          ? invoices.filter((inv: any) => {
              const dateStr = inv.createdAt || inv.date || inv.updatedAt || '';
              const date = dateStr ? new Date(dateStr) : null;
              return date && !Number.isNaN(date.getTime()) && date > cutoffDate;
            })
          : [];
        await localforage.setItem("invoices", filtered);
        try {
          await deleteInvoicesOlderThan(String(days || 0));
          console.log('[Settings] deleteInvoicesOlderThan done');
        } catch (e) {
          console.error('[Settings] invoices delete error', e);
          throw e;
        }
      } else if (type === "accounting") {
        const expenses: any[] = await localforage.getItem("expenses") || [];
        const filtered = hasRange
          ? expenses.filter((exp: any) => {
              const dateStr = exp.date || exp.createdAt || '';
              const date = dateStr ? new Date(dateStr) : null;
              return date && !Number.isNaN(date.getTime()) && date > cutoffDate;
            })
          : [];
        await localforage.setItem("expenses", filtered);
        try {
          await deleteExpensesOlderThan(String(days || 0));
          console.log('[Settings] deleteExpensesOlderThan done');
        } catch (e) {
          console.error('[Settings] expenses delete error', e);
          throw e;
        }
      } else if (type === "inventory") {
        if (hasRange) {
          const usage: any[] = (await localforage.getItem("chemicalUsage")) || [];
          const filtered = usage.filter((u: any) => {
            const dateStr = u.date || '';
            const date = dateStr ? new Date(dateStr) : null;
            return date && !Number.isNaN(date.getTime()) && date > cutoffDate;
          });
          await localforage.setItem("chemicalUsage", filtered);
        } else {
          // Delete all local inventory lists when days are blank
          try { await localforage.removeItem("chemicals"); } catch {}
          try { await localforage.removeItem("materials"); } catch {}
          try { await localforage.removeItem("inventory-estimates"); } catch {}
          try { await localforage.removeItem("chemicalUsage"); } catch {}
        }
        try {
          await deleteInventoryUsageOlderThan(String(days || 0));
          console.log('[Settings] deleteInventoryUsageOlderThan done');
        } catch (e) {
          console.error('[Settings] inventory delete error', e);
          throw e;
        }
      } else if (type === "all") {
        // Supabase: ONLY delete allowed tables and roles
        try {
          await deleteAllSupabase();
          console.log('[Settings] deleteAllSupabase done');
        } catch (e) {
          console.error('[Settings] delete all error', e);
          throw e;
        }
        // Local: selectively remove volatile data, preserve training/exam/admin/employee
        const volatileLfKeys = [
          'customers','invoices','expenses','estimates',
          'chemicals','materials','chemicalUsage','inventory-estimates',
          'faqs','contactInfo','aboutSections','aboutFeatures','testimonials',
          'savedPrices','training-exams'
        ];
        for (const key of volatileLfKeys) {
          try { await localforage.removeItem(key); } catch {}
        }
        const preserveLsKeys = new Set([
          'training_exam_custom','training_exam_progress','training_exam_schedule',
          'handbook_progress','handbook_start_at','employee_training_progress','employee_training_certified',
          'currentUser','packageMeta','addOnMeta','customServicePackages','customAddOns','customServices','savedPrices'
        ]);
        // Remove localStorage items except preserved ones
        try {
          const lsKeys = Object.keys(localStorage);
          for (const k of lsKeys) {
            if (!preserveLsKeys.has(k)) localStorage.removeItem(k);
          }
        } catch {}
        setSummaryData({
          preserved: Array.from(preserveLsKeys),
          deleted: volatileLfKeys,
          note: 'Admin/employee accounts, exam content, training manual, and pricing metadata preserved.'
        });
        setSummaryOpen(true);
        // Revalidate live content endpoints on port 6061
        try { await fetch(`http://localhost:6061/api/packages/live?v=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }); } catch {}
        try { await fetch(`http://localhost:6061/api/addons/live?v=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }); } catch {}
        try { setTimeout(() => window.location.reload(), 300); } catch {}
      }

      const rangeText = type === 'all' ? '' : hasRange ? ` older than ${days} day(s)` : ' (all)';
      toast({ title: "Data Deleted", description: `${type} data${rangeText} removed.` });
      console.groupEnd();
      setDeleteDialog(null);
      setTimeRange("");
    } catch (error) {
      // Surface full Supabase error in console
      try {
        const err = error as any;
        console.error('[Settings] Delete Failed', {
          type,
          error: err,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
        });
      } catch {}
      toast({ title: "Delete Failed", description: "Could not delete data.", variant: "destructive" });
      console.groupEnd();
    }
  };

  // Load dry-run preview when dialog opens or timeRange changes
  useEffect(() => {
    const load = async () => {
      if (!deleteDialog) { setPreview(null); return; }
      const d = String(timeRange || '').trim();
      try {
        if (deleteDialog === 'customers') setPreview(await previewDeleteCustomers(d));
        else if (deleteDialog === 'invoices') setPreview(await previewDeleteInvoices(d));
        else if (deleteDialog === 'accounting') setPreview(await previewDeleteExpenses(d));
        else if (deleteDialog === 'inventory') setPreview(await previewDeleteInventory(d));
        else if (deleteDialog === 'all') setPreview(await previewDeleteAll(d));
      } catch { setPreview(null); }
    };
    load();
  }, [deleteDialog, timeRange]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Settings" />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6 animate-fade-in">
          {/* Backup & Restore */}
          <Card className="p-6 bg-gradient-card border-border">
            <h2 className="text-2xl font-bold text-foreground mb-4">Backup & Restore</h2>
            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-4">Download a backup of all your data or restore from a previous backup.</p>
                <div className="flex gap-4 flex-wrap">
                  <Button onClick={handleBackup} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Backup
                  </Button>
                  <Button onClick={handleBackupToDrive} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Backup then Open Google Drive
                  </Button>
                  <label>
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Restore Backup
                      </span>
                    </Button>
                    <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
                  </label>
                  <Button variant="outline" onClick={handleOpenDriveRestore}>
                    <Upload className="h-4 w-4 mr-2" />
                    Open Drive to fetch backup
                  </Button>
                  <label>
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Restore Pricing from JSON Backup
                      </span>
                    </Button>
                    <input type="file" accept=".json" className="hidden" onChange={handlePricingRestore} />
                  </label>
                  <Button variant="outline" onClick={() => setHealthOpen(true)}>
                    Environment Health Check
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="p-6 bg-gradient-card border-destructive border-2">
            <h2 className="text-2xl font-bold text-destructive mb-4">⚠️ Danger Zone</h2>
            <p className="text-muted-foreground mb-6">These actions cannot be undone. Proceed with caution.</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Delete Customer Records</h3>
                  <p className="text-sm text-muted-foreground">Remove customer records older than specified days</p>
                </div>
                <Button variant="destructive" onClick={() => setDeleteDialog("customers")}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Customers
                </Button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Delete Accounting Records</h3>
                  <p className="text-sm text-muted-foreground">Remove expense records older than specified days</p>
                </div>
                <Button variant="destructive" onClick={() => setDeleteDialog("accounting")}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Accounting
                </Button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Delete Invoices</h3>
                  <p className="text-sm text-muted-foreground">Remove invoices older than specified days</p>
                </div>
                <Button variant="destructive" onClick={() => setDeleteDialog("invoices")}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Invoices
                </Button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Delete Inventory Data</h3>
                  <p className="text-sm text-muted-foreground">Remove inventory usage older than specified days</p>
                </div>
                <Button variant="destructive" onClick={() => setDeleteDialog("inventory")}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Inventory
                </Button>
              </div>

              <div className="border-t border-destructive/50 pt-4 mt-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-bold text-destructive text-lg">DELETE ALL DATA</h3>
                    <p className="text-sm text-muted-foreground">Permanently remove ALL application data</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="bg-destructive text-destructive-foreground font-bold"
                    onClick={() => setDeleteDialog("all")}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    DELETE EVERYTHING
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <AlertDialog open={deleteDialog !== null} onOpenChange={() => { setDeleteDialog(null); setTimeRange(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog === 'all' 
                ? 'This will delete ALL volatile data. Admin/employee accounts, exam questions, training manual, and pricing metadata are preserved.'
                : `This will delete ${deleteDialog} data ${timeRange ? `older than ${timeRange} day(s)` : '(all)' }.`
              }
              {preview && (
                <div className="mt-3 text-sm">
                  <div className="font-medium">Dry-run preview:</div>
                  {(preview.tables || []).map((t) => (
                    <div key={t.name}>{t.name}: {t.count} rows</div>
                  ))}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteDialog !== "all" && (
            <div className="py-4">
              <Label htmlFor="timeRange">Delete records older than (days):</Label>
              <Input
                id="timeRange"
                type="number"
                placeholder="e.g., 30, 90, 365"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">Leave blank to delete all records in this group.</p>
            </div>
          )}
<AlertDialogFooter className="button-group-responsive">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteData(deleteDialog!)}
              className="bg-destructive"
              disabled={false}
            >
              Yes, Delete {deleteDialog === "all" ? "Everything" : "Data"}
            </AlertDialogAction>
</AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Delete Everything Summary Modal */}
      <AlertDialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Everything Summary</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mb-2 text-sm">
                Preserved keys: {summaryData?.preserved?.join(', ') || 'None'}
              </div>
              <div className="mb-2 text-sm">
                Deleted keys: {summaryData?.deleted?.join(', ') || 'None'}
              </div>
              <div className="text-sm">{summaryData?.note}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSummaryOpen(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EnvironmentHealthModal open={healthOpen} onOpenChange={setHealthOpen} />
    </div>
  );
};

export default Settings;

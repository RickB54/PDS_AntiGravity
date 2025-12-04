# Danger Zone Complete Repair - Implementation Plan

## 🎯 Objective
Fix ALL Danger Zone buttons in Settings to work reliably, consistently, and safely with proper delete logic, confirmations, and UI updates.

---

## 📋 Current State Analysis

### Existing Infrastructure
- **File**: `src/pages/Settings.tsx` (1335 lines)
- **Delete Function**: `deleteData(type: string)` exists (lines 202-376)
- **Confirmation Dialog**: AlertDialog with PIN protection exists
- **Backend Functions**: Import from `@/services/supabase/adminOps`:
  - `deleteCustomersOlderThan()`
  - `deleteInvoicesOlderThan()`
  - `deleteExpensesOlderThan()`
  - `deleteInventoryUsageOlderThan()`
  - `deleteBookingsOlderThan()`
  - `deleteEmployeesOlderThan()`
  - `deleteEverything()` (as `deleteAllSupabase`)

### Current Issues
1. **Missing UI Buttons**: No visible delete buttons in the UI for most categories
2. **Incomplete Delete Logic**: Some delete operations don't clean all related data
3. **No "Type DELETE" Confirmation**: Missing secondary confirmation
4. **Inconsistent UI Updates**: Page doesn't always refresh after deletion
5. **Missing Error Handling**: Limited error feedback to user
6. **No Loading States**: Buttons don't show processing state

---

## 🔧 Implementation Steps

### Phase 1: Add Missing Delete Buttons to UI

**Location**: Add to Settings page after existing sections

#### Required Buttons:
```tsx
1. Delete Customer Records
   - Button text: "Delete Customer Records"
   - onClick: () => setDeleteDialog('customers')
   - Icon: Trash2
   - Variant: destructive

2. Delete Accounting Records
   - Button text: "Delete Accounting Records"
   - onClick: () => setDeleteDialog('accounting')
   - Icon: Trash2
   - Variant: destructive

3. Delete Invoices
   - Button text: "Delete Invoices"
   - onClick: () => setDeleteDialog('invoices')
   - Icon: Trash2
   - Variant: destructive

4. Delete Inventory Data
   - Button text: "Delete Inventory Data"
   - onClick: () => setDeleteDialog('inventory')
   - Icon: Trash2
   - Variant: destructive

5. Delete Employee Records
   - Button text: "Delete Employee Records"
   - onClick: () => setDeleteDialog('employees')
   - Icon: Trash2
   - Variant: destructive

6. DELETE ALL DATA
   - Button text: "DELETE ALL DATA"
   - onClick: () => setDeleteDialog('all')
   - Icon: Trash2
   - Variant: destructive
   - Size: lg
   - Additional warning styling
```

---

### Phase 2: Enhanced Confirmation Dialog

**Update AlertDialog to include**:

1. **Two-Step Confirmation**:
   ```tsx
   Step 1: PIN entry (existing)
   Step 2: Type "DELETE" to confirm
   ```

2. **State Variables Needed**:
   ```tsx
   const [confirmText, setConfirmText] = useState("");
   const confirmValid = confirmText.trim().toUpperCase() === "DELETE";
   ```

3. **Updated Dialog Content**:
   ```tsx
   <Input
     placeholder='Type "DELETE" to confirm'
     value={confirmText}
     onChange={(e) => setConfirmText(e.target.value)}
   />
   {confirmText && !confirmValid && (
     <p className="text-xs text-destructive">
       Must type DELETE exactly
     </p>
   )}
   ```

4. **Updated Action Button**:
   ```tsx
   <AlertDialogAction
     disabled={!dangerPin || !pinValid || !confirmValid}
     onClick={() => deleteData(deleteDialog!)}
   >
     Yes, Delete
   </AlertDialogAction>
   ```

---

### Phase 3: Enhanced Delete Logic

#### A) Delete Customer Records
**Current**: Deletes customers and bookings  
**Enhancement Needed**:
```typescript
// Add to deleteData function
if (type === "customers") {
  // Local cleanup
  await localforage.removeItem("customers");
  await localforage.removeItem("customer-vehicles");
  await localforage.removeItem("customer-notes");
  await localforage.removeItem("bookings");
  
  // Supabase cleanup
  await deleteCustomersOlderThan(hasRange ? String(days) : 'all');
  await deleteBookingsOlderThan(hasRange ? String(days) : 'all');
  
  toast({ title: "Customers Deleted", description: "All customer data removed" });
}
```

#### B) Delete Accounting Records
**Current**: Deletes expenses only  
**Enhancement Needed**:
```typescript
if (type === "accounting") {
  // Delete expenses
  await localforage.removeItem("expenses");
  
  // Delete income/receivables
  await localforage.removeItem("receivables");
  
  // Delete budget data
  await localforage.removeItem("budget-categories");
  
  // Supabase
  await deleteExpensesOlderThan(hasRange ? String(days) : 'all');
  
  toast({ title: "Accounting Deleted", description: "All accounting data removed" });
}
```

#### C) Delete Invoices
**Current**: Works correctly  
**Enhancement**: Add better feedback
```typescript
if (type === "invoices") {
  await localforage.removeItem("invoices");
  await localforage.removeItem("estimates");
  await deleteInvoicesOlderThan(hasRange ? String(days) : 'all');
  
  toast({ title: "Invoices Deleted", description: `${hasRange ? `Invoices older than ${days} days` : 'All invoices'} removed` });
}
```

#### D) Delete Inventory Data
**Current**: Partial implementation  
**Enhancement Needed**:
```typescript
if (type === "inventory") {
  if (!hasRange) {
    // Delete ALL inventory
    await localforage.removeItem("chemicals");
    await localforage.removeItem("materials");
    await localforage.removeItem("tools");
    await localforage.removeItem("chemicalUsage");
    await localforage.removeItem("chemical-usage");
    await localforage.removeItem("inventory-estimates");
    await localforage.removeItem("low-stock-warnings");
  } else {
    // Delete usage logs older than X days
    const usage = await localforage.getItem("chemicalUsage") || [];
    const filtered = usage.filter(u => {
      const date = new Date(u.date);
      return date > cutoffDate;
    });
    await localforage.setItem("chemicalUsage", filtered);
  }
  
  await deleteInventoryUsageOlderThan(hasRange ? String(days) : 'all');
  
  toast({ title: "Inventory Deleted", description: "Inventory data removed" });
}
```

#### E) Delete Employee Records
**Current**: Missing entirely  
**New Implementation**:
```typescript
if (type === "employees") {
  const currentUser = getCurrentUser();
  const employees = await localforage.getItem("company-employees") || [];
  
  // Filter out employees but keep current user
  const filtered = hasRange
    ? employees.filter(e => {
        if (e.email === currentUser?.email) return true; // Keep current user
        const date = new Date(e.createdAt || e.joinedAt);
        return date > cutoffDate;
      })
    : employees.filter(e => e.email === currentUser?.email); // Keep only current user
  
  await localforage.setItem("company-employees", filtered);
  
  // Also clean from localStorage
  try {
    const lsEmployees = JSON.parse(localStorage.getItem("company-employees") || "[]");
    const lsFiltered = lsEmployees.filter(e => e.email === currentUser?.email);
    localStorage.setItem("company-employees", JSON.stringify(lsFiltered));
  } catch {}
  
  // Delete payroll history
  await localforage.removeItem("payroll-history");
  
  // Supabase
  await deleteEmployeesOlderThan(hasRange ? String(days) : 'all');
  
  toast({ title: "Employees Deleted", description: "Employee records removed (current user preserved)" });
}
```

#### F) DELETE ALL DATA
**Current**: Partial implementation  
**Enhancement Needed**:
```typescript
if (type === "all") {
  // Supabase: Delete all allowed tables
  await deleteAllSupabase();
  
  // Local: Define protected data
  const protectedKeys = [
    'pricing-packages',
    'pricing-addons',
    'vehicle-classifications',
    'service-templates',
    'standard_chemicals',
    'standard_tools',
    'standard_materials',
    'training-manual',
    'exam-questions',
    'danger-pin',
    'theme',
    'settings'
  ];
  
  // Get all localforage keys
  const allKeys = await localforage.keys();
  
  // Delete everything except protected
  for (const key of allKeys) {
    if (!protectedKeys.includes(key)) {
      await localforage.removeItem(key);
    }
  }
  
  // Clean localStorage (except protected)
  const lsProtected = ['danger-pin', 'theme', 'auth-token'];
  Object.keys(localStorage).forEach(key => {
    if (!lsProtected.includes(key) && !key.startsWith('vite-')) {
      localStorage.removeItem(key);
    }
  });
  
  toast({ 
    title: "All Data Deleted", 
    description: "All user data removed. Protected system data preserved.",
    duration: 5000
  });
  
  // Reload page after 2 seconds
  setTimeout(() => window.location.reload(), 2000);
}
```

---

### Phase 4: Add Loading States

**State Variable**:
```typescript
const [deleting, setDeleting] = useState(false);
```

**Update deleteData function**:
```typescript
const deleteData = async (type: string) => {
  setDeleting(true);
  try {
    // ... existing delete logic ...
  } catch (error) {
    toast({
      title: "Delete Failed",
      description: error.message || "An error occurred",
      variant: "destructive"
    });
  } finally {
    setDeleting(false);
    setDeleteDialog(null);
    setTimeRange("");
    setPinInput("");
    setConfirmText("");
  }
};
```

**Update Button**:
```tsx
<AlertDialogAction
  disabled={!dangerPin || !pinValid || !confirmValid || deleting}
  onClick={() => deleteData(deleteDialog!)}
>
  {deleting ? "Deleting..." : "Yes, Delete"}
</AlertDialogAction>
```

---

### Phase 5: UI Organization

**Create Danger Zone Section**:
```tsx
<Card className="p-6 border-destructive/50">
  <h2 className="text-2xl font-bold text-destructive mb-4 flex items-center gap-2">
    <Trash2 className="h-6 w-6" />
    Danger Zone
  </h2>
  <p className="text-sm text-muted-foreground mb-6">
    Permanently delete data. These actions cannot be undone.
  </p>
  
  <div className="space-y-4">
    {/* Individual Delete Sections */}
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-2">Customer Data</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Delete customer profiles, vehicles, bookings, and notes
      </p>
      <Button
        variant="destructive"
        onClick={() => setDeleteDialog('customers')}
        disabled={!unlocked}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Customer Records
      </Button>
    </div>
    
    {/* Repeat for: Accounting, Invoices, Inventory, Employees */}
    
    {/* Global Delete */}
    <div className="border-t pt-4 mt-6">
      <h3 className="font-semibold text-destructive mb-2">Nuclear Option</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Delete ALL user data. System defaults and protected data will be preserved.
      </p>
      <Button
        variant="destructive"
        size="lg"
        onClick={() => setDeleteDialog('all')}
        disabled={!unlocked}
        className="w-full"
      >
        <Trash2 className="h-5 w-5 mr-2" />
        DELETE ALL DATA
      </Button>
    </div>
  </div>
</Card>
```

---

## 🧪 Testing Checklist

### For Each Delete Button:
- [ ] Button appears in UI
- [ ] Button is disabled when Danger Zone is locked
- [ ] Clicking button opens confirmation dialog
- [ ] PIN entry required
- [ ] "Type DELETE" confirmation required
- [ ] Both confirmations must be valid to enable delete
- [ ] Loading state shows during deletion
- [ ] Success toast appears
- [ ] Error toast appears on failure
- [ ] UI updates/refreshes after deletion
- [ ] Data is actually deleted from localforage
- [ ] Data is actually deleted from Supabase (if applicable)
- [ ] Protected data is NOT deleted

### Specific Tests:
1. **Delete Customers**: Verify customers, vehicles, bookings all removed
2. **Delete Accounting**: Verify expenses and receivables removed
3. **Delete Invoices**: Verify invoices and estimates removed
4. **Delete Inventory**: Verify chemicals, tools, materials, usage removed
5. **Delete Employees**: Verify employees removed but current user preserved
6. **DELETE ALL**: Verify all user data removed, protected data preserved

---

## 🔒 Protected Data Configuration

**Create**: `src/lib/protectedData.ts`
```typescript
export const PROTECTED_LOCALFORAGE_KEYS = [
  'pricing-packages',
  'pricing-addons',
  'vehicle-classifications',
  'service-templates',
  'standard_chemicals',
  'standard_tools',
  'standard_materials',
  'training-manual',
  'exam-questions',
  'danger-pin',
  'theme',
  'settings'
];

export const PROTECTED_LOCALSTORAGE_KEYS = [
  'danger-pin',
  'theme',
  'auth-token'
];

export function isProtectedKey(key: string, storage: 'localforage' | 'localStorage'): boolean {
  if (storage === 'localforage') {
    return PROTECTED_LOCALFORAGE_KEYS.includes(key);
  }
  return PROTECTED_LOCALSTORAGE_KEYS.includes(key) || key.startsWith('vite-');
}
```

---

## 📝 Files to Modify

1. **`src/pages/Settings.tsx`**
   - Add delete buttons UI
   - Enhance deleteData function
   - Add confirmText state
   - Add deleting state
   - Update AlertDialog

2. **`src/lib/protectedData.ts`** (NEW)
   - Define protected keys
   - Export helper functions

3. **`src/services/supabase/adminOps.ts`** (VERIFY)
   - Ensure all delete functions exist
   - Verify they work correctly

---

## ⚠️ Critical Safety Rules

1. **NEVER delete**:
   - Pricing packages
   - Pricing addons
   - Vehicle classifications
   - Service templates
   - Standard inventory lists (chemicals, tools, materials)
   - Training manual
   - Exam questions
   - Current logged-in user
   - System settings

2. **ALWAYS require**:
   - PIN entry
   - "Type DELETE" confirmation
   - Both confirmations valid before enabling delete button

3. **ALWAYS provide**:
   - Clear description of what will be deleted
   - Success feedback
   - Error feedback
   - Loading state

4. **ALWAYS clean**:
   - Both localforage AND localStorage
   - Related data (e.g., delete customer vehicles when deleting customers)
   - Supabase data (if configured)

---

## 🚀 Implementation Priority

### High Priority (Do First):
1. Add DELETE ALL DATA button
2. Add Delete Customers button
3. Add Delete Invoices button
4. Enhance confirmation dialog (Type DELETE)
5. Add loading states

### Medium Priority:
6. Add Delete Accounting button
7. Add Delete Inventory button
8. Add Delete Employees button
9. Create protectedData.ts
10. Enhance delete logic for all types

### Low Priority (Polish):
11. Add time range support for all delete types
12. Add preview/dry-run feature
13. Add undo functionality (advanced)

---

## 📊 Success Criteria

✅ All 6 delete buttons visible and functional  
✅ PIN + "Type DELETE" confirmation working  
✅ Loading states on all buttons  
✅ Success/error toasts for all operations  
✅ UI refreshes after deletion  
✅ Protected data never deleted  
✅ All related data cleaned (no orphans)  
✅ Works on desktop and mobile  
✅ No console errors  
✅ Tested with real data  

---

## 🎯 Next Steps

1. Review this plan
2. Implement Phase 1 (Add buttons)
3. Implement Phase 2 (Enhanced confirmation)
4. Implement Phase 3 (Enhanced delete logic)
5. Implement Phase 4 (Loading states)
6. Implement Phase 5 (UI organization)
7. Test thoroughly
8. Deploy

---

**Estimated Time**: 4-6 hours for complete implementation and testing

**Risk Level**: HIGH - Involves data deletion, requires careful testing

**Recommendation**: Implement in stages, test each stage thoroughly before proceeding

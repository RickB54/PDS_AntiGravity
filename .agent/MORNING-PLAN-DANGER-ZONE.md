# Tomorrow Morning: Simplified Danger Zone Implementation

## 🎯 Goal
Clean up Settings page by removing redundant bulk delete options and keeping only essential functions.

---

## ✅ What to Keep in Danger Zone

1. **DELETE ALL USER DATA**
   - Nuclear option for complete reset
   - Preserves: Pricing, templates, vehicle classifications, system defaults
   - Requires: PIN + Type "DELETE" confirmation

2. **RESTORE DEFAULT IMPORT WIZARD DATA**
   - Resets standard chemicals, tools, materials
   - Already requested and needed

3. **Backup to Google Drive**
   - CRITICAL - Your main safety net
   - Test this FIRST

4. **Restore from Google Drive**
   - CRITICAL - Your recovery method
   - Test this FIRST

---

## ❌ What to Remove from Danger Zone

These are redundant because you have individual delete functionality:

- ❌ Delete Customer Records (use Customers page)
- ❌ Delete Accounting Records (use Transaction Ledger in Accounting)
- ❌ Delete Invoices (use Invoicing page)
- ❌ Delete Inventory Data (rarely needed, can rebuild)
- ❌ Delete Employees (use Company Employees page)

---

## 📋 Morning Workflow (1-2 hours)

### Step 1: Test Backup/Restore (15 minutes)
**PRIORITY: Do this FIRST**

1. Open Settings page
2. Click "Backup to Google Drive"
3. Verify file appears in Google Drive
4. Note the timestamp
5. Click "Restore from Google Drive"
6. Select the backup you just made
7. Verify all data restored correctly
8. ✅ If works: Great! Move to Step 2
9. ❌ If broken: Fix backup/restore before proceeding

### Step 2: Simplify Danger Zone UI (30 minutes)

**File**: `src/pages/Settings.tsx`

**Find the Danger Zone section** (search for "Danger Zone" or look for delete buttons)

**Replace with simplified version**:
```tsx
{/* Danger Zone - Simplified */}
<Card className="p-6 border-destructive/50 bg-destructive/5">
  <h2 className="text-2xl font-bold text-destructive mb-2 flex items-center gap-2">
    <Trash2 className="h-6 w-6" />
    Danger Zone
  </h2>
  <p className="text-sm text-muted-foreground mb-6">
    Critical operations. Use individual delete functions in each module for targeted deletions.
  </p>

  <div className="space-y-6">
    {/* DELETE ALL USER DATA */}
    <div className="border border-destructive/30 rounded-lg p-4">
      <h3 className="font-semibold text-destructive mb-2">Nuclear Option</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Delete ALL user data (customers, invoices, accounting, bookings, etc.)
        <br />
        <strong>Preserves:</strong> Pricing, templates, vehicle classifications, system defaults
      </p>
      <Button
        variant="destructive"
        onClick={() => setDeleteDialog('all')}
        disabled={!unlocked}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        DELETE ALL USER DATA
      </Button>
    </div>

    {/* RESTORE DEFAULT IMPORT WIZARD DATA */}
    <div className="border border-border rounded-lg p-4">
      <h3 className="font-semibold mb-2">Reset Import Wizard Defaults</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Restore standard chemicals, tools, and materials to factory defaults
      </p>
      <Button
        variant="outline"
        onClick={() => {/* existing restore wizard function */}}
        disabled={!unlocked}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Restore Default Import Wizard Data
      </Button>
    </div>
  </div>
</Card>
```

### Step 3: Remove Unused Delete Code (15 minutes)

**In `deleteData` function**, keep only:
- `type === "all"` (DELETE ALL USER DATA)
- Remove cases for: "customers", "invoices", "accounting", "inventory", "employees"

**OR** keep them but don't expose buttons (safer - allows future use if needed)

### Step 4: Test Everything (15 minutes)

1. ✅ Verify "DELETE ALL USER DATA" button appears
2. ✅ Click it - should show confirmation dialog
3. ✅ Verify PIN required
4. ✅ Verify "Type DELETE" required (if implemented)
5. ✅ Cancel - nothing should happen
6. ✅ Test with real deletion (use backup first!)
7. ✅ Verify protected data preserved
8. ✅ Verify user data deleted
9. ✅ Test "Restore Default Import Wizard Data"
10. ✅ Verify backup/restore still works

### Step 5: Clean Up & Document (15 minutes)

1. Remove any orphaned state variables
2. Remove unused imports
3. Add comments explaining what's preserved
4. Update any documentation
5. Test one more time
6. Commit changes

---

## 🎯 Success Criteria

✅ Backup to Google Drive works  
✅ Restore from Google Drive works  
✅ DELETE ALL USER DATA button visible  
✅ DELETE ALL USER DATA works correctly  
✅ Protected data never deleted  
✅ Restore Default Import Wizard Data works  
✅ No redundant bulk delete buttons  
✅ Settings page cleaner and simpler  
✅ No console errors  
✅ All tests pass  

---

## 🛡️ Safety Checklist

Before testing DELETE ALL:
- [ ] Create backup to Google Drive
- [ ] Verify backup file exists in Drive
- [ ] Download backup file to computer (extra safety)
- [ ] Test restore from backup
- [ ] Only then test DELETE ALL

---

## 📝 Notes

**Individual Delete Locations** (for reference):
- Customers: Customers page → individual delete
- Accounting: Accounting page → Transaction Ledger → Edit/Delete
- Invoices: Invoicing page → individual delete
- Employees: Company Employees page → individual delete
- Inventory: Can rebuild from Import Wizard defaults

**Protected Data** (never deleted):
- Pricing packages & addons
- Vehicle classifications
- Service templates
- Standard chemicals/tools/materials (Import Wizard defaults)
- Training manual
- Exam questions
- Current logged-in user
- System settings

---

## ⏱️ Estimated Time

- Test Backup/Restore: 15 min
- Simplify UI: 30 min
- Remove unused code: 15 min
- Test everything: 15 min
- Clean up: 15 min

**Total: 1.5 hours**

---

## 🚀 Quick Start Commands

```bash
# Start dev server (if not running)
npm run dev

# Open Settings page
# Navigate to: http://localhost:5173/settings

# Test backup/restore first!
```

---

**Remember**: Test backup/restore FIRST. That's your safety net for everything else!

Good night! See you in the morning! 🌙

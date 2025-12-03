# Company Budget System Enhancement - Implementation Plan

## Overview
Comprehensive enhancement of the Company Budget system with material consumption tracking, mandatory cost fields, visual improvements, and budget forecasting.

## Phase 1: Update Inventory Data Structure ✓

### 1.1 Add New Fields to Inventory Items
**Files to modify:**
- `src/components/inventory/UnifiedInventoryModal.tsx`
- `src/pages/InventoryControl.tsx`

**New fields for ALL inventory types:**
- `cost` (MANDATORY) - Already exists but needs validation
- `unitOfMeasure` (string) - e.g., "oz", "mL", "pads", "units"
- `consumptionRatePerJob` (number) - Default consumption per job
- `lowThreshold` (MANDATORY) - Already exists but needs validation

**Implementation:**
1. Update TypeScript interfaces
2. Add form fields to UnifiedInventoryModal
3. Add validation to prevent saving without required fields
4. Update save logic to include new fields

## Phase 2: Consumption Tracking System

### 2.1 Create Consumption Tracker Module
**New file:** `src/lib/consumptionTracker.ts`

**Functions:**
- `recordConsumption(jobId, itemId, quantityUsed, jobType)`
- `calculateConsumption(jobType, items)`
- `updateInventoryStock(itemId, quantityUsed)`
- `createBudgetExpense(consumption)`

### 2.2 Integration Points
**Files to modify:**
- `src/pages/ServiceChecklist.tsx` - Hook into job completion
- `src/lib/db.ts` - Add consumption history storage

## Phase 3: Budget Integration

### 3.1 Auto-Expense Creation
**Files to modify:**
- `src/lib/consumptionTracker.ts`
- `src/pages/CompanyBudget.tsx`

**Features:**
- Auto-create expense entries from consumption
- Calculate cost: `cost = costPerUnit × quantityConsumed`
- Update budget totals in real-time

### 3.2 Consumption History
**New storage key:** `consumption-history`

**Schema:**
```typescript
interface ConsumptionRecord {
  id: string;
  itemId: string;
  itemName: string;
  jobId: string;
  jobType: string;
  quantityUsed: number;
  costPerUnit: number;
  totalCost: number;
  date: string;
  category: string;
}
```

## Phase 4: Visual Enhancements to Company Budget

### 4.1 Add Circle/Pie Charts
**Library:** Recharts (already in project)

**Charts to add:**
1. Expense Breakdown by Category (pie chart)
2. Budget vs Actual Progress (donut chart)
3. Top 5 Costly Items (bar chart)

### 4.2 Improve Layout
**Updates to:** `src/pages/CompanyBudget.tsx`

**Improvements:**
- Responsive grid layout
- Card-based sections
- Mobile-optimized spacing
- No horizontal scrolling

### 4.3 Real-Time Totals Dashboard
**New section:** Budget Overview Panel

**Metrics:**
- Total monthly spending
- Total consumption cost
- Remaining budget
- Expense forecast
- Highest-cost category

## Phase 5: Enhanced Features

### 5.1 Monthly Budget Goals
**New storage key:** `monthly-budget-goals`

**Features:**
- Set monthly targets per category
- Visual progress indicators
- Goal vs actual comparison

### 5.2 Budget Alerts
**Integration:** Use existing `pushAdminAlert` system

**Alert triggers:**
- Category exceeds monthly budget
- Consumption causes low inventory
- Projected overspending

### 5.3 CSV Export
**New function:** `exportBudgetToCSV()`

**Export options:**
- Full budget report
- Consumption history
- Category breakdown
- Monthly summary

## Phase 6: Testing & Validation

### 6.1 Validation Rules
- All inventory items must have cost
- All inventory items must have threshold
- Consumption cannot exceed available stock
- Budget calculations must be accurate

### 6.2 Edge Cases
- Zero-cost items (prevent)
- Negative consumption (prevent)
- Missing job types (handle gracefully)

## Implementation Order

1. ✅ Update UnifiedInventoryModal with new fields + validation
2. ✅ Create consumptionTracker.ts module
3. ✅ Integrate consumption tracking into ServiceChecklist
4. ✅ Add auto-expense creation to budget
5. ✅ Add pie/donut charts to CompanyBudget
6. ✅ Create Budget Overview Panel
7. ✅ Add monthly budget goals
8. ✅ Implement budget alerts
9. ✅ Add CSV export functionality
10. ✅ Test and validate all features

## Files to Create
- `src/lib/consumptionTracker.ts`
- `src/components/budget/BudgetOverviewPanel.tsx`
- `src/components/budget/ExpenseBreakdownChart.tsx`
- `src/components/budget/BudgetProgressChart.tsx`
- `src/components/budget/TopItemsChart.tsx`

## Files to Modify
- `src/components/inventory/UnifiedInventoryModal.tsx`
- `src/pages/InventoryControl.tsx`
- `src/pages/CompanyBudget.tsx`
- `src/pages/ServiceChecklist.tsx`
- `src/lib/db.ts`

## Dependencies
- recharts (for charts) - likely already installed
- papaparse (for CSV export) - may need to install

## Notes
- Maintain backward compatibility with existing data
- Use localforage for all data storage (no Supabase)
- Follow existing code patterns and styling
- Ensure mobile responsiveness

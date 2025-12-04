# Employee Payment System - User Guide

## ✅ **COMPLETED**: Enhanced Payment Dialog

### What Was Fixed:
The payment dialog now includes **Type** and **Description** fields, making payroll records much clearer!

---

## 🎯 How to Pay an Employee (Step-by-Step)

### Method 1: From Employee Card (RECOMMENDED - Easiest!)

1. **Go to Company Employees page**
2. **Find the employee card** - it now shows:
   ```
   ┌─────────────────────────────┐
   │ John Doe                    │
   │ john@email.com              │
   │ Role: Employee              │
   │                             │
   │ ┌─────────────────────────┐ │
   │ │ Amount Owed             │ │
   │ │ $150.00                 │ │ ← Highlighted in amber
   │ └─────────────────────────┘ │
   │                             │
   │ [Edit] [Delete] [Pay]       │
   └─────────────────────────────┘
   ```

3. **Click the "Pay" button** (green with wallet icon)

4. **Enhanced Payment Dialog appears**:
   - Shows employee name in color
   - Shows amount owed (if any) in amber box
   - **Amount**: Pre-filled with owed amount (you can change it)
   - **Type** (REQUIRED): Select from dropdown:
     - Job Payment
     - Hourly Wage
     - Bonus
     - Commission
     - Salary
     - Other
   - **Description** (Optional): Add notes like "Week 1 payment" or "December bonus"

5. **Click "Confirm Payment"**
   - Button is disabled until Amount and Type are filled
   - Payment is recorded in:
     ✅ Payroll History (with Type and Description!)
     ✅ Business Reports
     ✅ Accounting as expense

---

### Method 2: From Payroll Page

1. **Go to Payroll page**
2. **Add payment row** (Job Pay, Hours, or Custom)
3. **Fill in details**
4. **Click "Save Payment"** or "Pay Now"

---

## 📊 Where Payments Are Tracked

### 1. **Payroll History** (Payroll page → History tab)
   - Shows all payments with Type and Description
   - Can filter by employee, type, date range
   - Can edit or delete entries

### 2. **Business Reports** (Reports page → Employee tab)
   - Employee Performance Report
   - Shows total paid, jobs completed
   - Payroll Payments section

### 3. **Accounting** (Accounting page)
   - Payments recorded as "Payroll" expenses
   - Shows in Transaction Ledger
   - Affects Profit/Loss Summary

---

## 🎨 Visual Indicators

### Employee Cards:
- **Green** "Amount Owed" box with **$0.00** = All caught up! ✅
- **Amber** "Amount Owed" box with **$150.00** = Money owed ⚠️

### Payment Dialog:
- **Amber warning box** = Missing required fields
- **Checkmark** icons = Field validated correctly
- **Disabled button** = Can't proceed yet

---

## 💡 Pro Tips

1. **Use Type field wisely**:
   - "Job" = For completed service checklist jobs
   - "Hourly" = For hourly employees
   - "Bonus" = For one-time bonuses
   - "Salary" = For salaried employees

2. **Add meaningful descriptions**:
   - Instead of blank, use: "Week 1 (Dec 1-7)"
   - Or: "Performance bonus - Q4"
   - Or: "Full detail job #12345"

3. **Check "Amount Owed" first**:
   - It auto-fills the payment amount
   - You can adjust if paying partial amount

4. **Last Paid date updates automatically**:
   - Tracks when you last paid each employee
   - Helps avoid missed payments

---

## 🔧 Troubleshooting

### "Type field is required" error
- **Solution**: Select a payment type from the dropdown

### Payment not showing in history
- **Check**: Payroll page → History tab
- **Filter**: Make sure filters aren't hiding it

### Mock employee showing weird email
- **Example**: `static+logan.employee4@example.local`
- **Solution**: Use "Clear Mock Employees" button  
- **Location**: Company Employees page, top right

---

## 📝 Summary

**Best Practice Flow**:
1. Employee completes job → Amount Owed increases
2. You see amber highlight on their card
3. Click "Pay" button
4. Select "Job Payment" as type
5. Add description like "Full detail - December"
6. Confirm payment
7. Amount Owed decreases
8. Payment tracked everywhere!

---

This system ensures every payment is:
- ✅ Properly categorized (Type)
- ✅ Well documented (Description)
- ✅ Tracked in multiple places
- ✅ Easy to audit later

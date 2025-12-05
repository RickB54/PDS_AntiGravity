# ⚠️ SIMPLE FIX NEEDED - MANUAL EDIT RECOMMENDED

## Current Situation:

I've attempted to edit the Invoice detail modal but the automated replacement keeps creating file corruption. The edits are being misapplied and creating duplicate or missing content.

## What Needs To Be Done (SIMPLE!):

### File: `src/pages/Invoicing.tsx`
### Line: ~608-616

**Current Code:**
```tsx
              <div className="border-t border-border pt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => generatePDF(selectedInvoice, false)}>
                  <Printer className="h-4 w-4 mr-2" />Print
                </Button>
                <Button variant="outline" onClick={() => generatePDF(selectedInvoice, true)}>
                  <Save className="h-4 w-4 mr-2" />Save PDF
                </Button>
                {/* Record Payment removed */}
              </div>
```

**Change To:**
```tsx
              <div className="border-t border-border pt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => generatePDF(selectedInvoice, false)}>
                  <Printer className="h-4 w-4 mr-2" />Print
                </Button>
                <Button variant="outline" onClick={() => generatePDF(selectedInvoice, true)}>
                  <Save className="h-4 w-4 mr-2" />Save PDF
                </Button>
                {viewMode === 'invoices' && (selectedInvoice.paymentStatus || 'unpaid') !== 'paid' && (
                  <Button 
                    onClick={() => {
                      const remaining = selectedInvoice.total - (selectedInvoice.paidAmount || 0);
                      setPaymentAmount(remaining > 0 ? String(remaining.toFixed(2)) : "");
                      setPaymentDialogOpen(true);
                    }}
                    className="bg-gradient-hero"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                )}
              </div>
```

That's it! Just replace the comment `{/* Record Payment removed */}` with the Button code!

##  Safe Steps:

1. First, REVERT the file again:
   ```bash
   git checkout HEAD -- src/pages/Invoicing.tsx
   ```

2. Open the file manually

3. Find line 615 (search for "Record Payment removed")

4. Replace that line with the Button code above

## Estimates Page:

Once the invoice modal is fixed, we can create a separate Estimates page. But let's fix this first!

## My Apologies:

I'm really sorry for these repeated issues. The automated file replacement tool is having trouble with this particular file. A manual edit is safest at this point!

Would you like to:
- A) Make this edit manually (recommended)
- B) Let me try one more automated approach with extra care
- C) We can proceed to create the Estimates page separately first

Let me know! 🙏

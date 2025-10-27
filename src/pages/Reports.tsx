import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCustomers, getInvoices } from "@/lib/db";
import DateRangeFilter, { DateRangeValue } from "@/components/filters/DateRangeFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Save, FileBarChart } from "lucide-react";
import jsPDF from "jspdf";

const Reports = () => {
  const [dateFilter, setDateFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const custs = await getCustomers();
    const invs = await getInvoices();
    setCustomers(custs as any[]);
    setInvoices(invs as any[]);
  };

  const filterByDate = (items: any[], dateField = "createdAt") => {
    const now = new Date();
    return items.filter(item => {
      const itemDate = new Date(item[dateField] || item.date || item.createdAt);
      let passQuick = true;
      if (dateFilter === "daily") passQuick = itemDate.toDateString() === now.toDateString();
      else if (dateFilter === "weekly") passQuick = itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (dateFilter === "monthly") passQuick = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();

      let passRange = true;
      if (dateRange.from) passRange = itemDate >= new Date(dateRange.from.setHours(0,0,0,0));
      if (passRange && dateRange.to) passRange = itemDate <= new Date(dateRange.to.setHours(23,59,59,999));

      return passQuick && passRange;
    });
  };

  const generateCustomerReport = (download = false) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Customer Report", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: "center" });
    
    let y = 40;
    const filteredCustomers = filterByDate(customers);
    
    filteredCustomers.forEach((cust) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text(`${cust.name}`, 20, y);
      y += 6;
      doc.setFontSize(9);
      doc.text(`Vehicle: ${cust.year} ${cust.vehicle} ${cust.model} | Type: ${cust.vehicleType || 'N/A'}`, 20, y);
      y += 5;
      doc.text(`Email: ${cust.email || 'N/A'} | Phone: ${cust.phone}`, 20, y);
      y += 5;
      doc.text(`Address: ${cust.address || 'N/A'}`, 20, y);
      y += 5;
      doc.text(`Mileage: ${cust.mileage || 'N/A'} | Color: ${cust.color || 'N/A'}`, 20, y);
      y += 5;
      doc.text(`Condition: Inside - ${cust.conditionInside || 'N/A'}, Outside - ${cust.conditionOutside || 'N/A'}`, 20, y);
      y += 5;
      if (cust.notes) {
        doc.text(`Notes: ${cust.notes}`, 20, y);
        y += 5;
      }
      
      // Customer invoices
      const custInvoices = invoices.filter(inv => inv.customerId === cust.id);
      if (custInvoices.length > 0) {
        doc.text(`Invoices (${custInvoices.length}):`, 20, y);
        y += 5;
        custInvoices.forEach(inv => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(`  #${inv.invoiceNumber || 'N/A'} - ${inv.date} - $${inv.total.toFixed(2)} - ${(inv.paymentStatus || 'unpaid').toUpperCase()}`, 25, y);
          y += 4;
        });
      }
      y += 3;
    });

    if (download) doc.save(`CustomerReport_${new Date().toISOString().split('T')[0]}.pdf`);
    else window.open(doc.output('bloburl'), '_blank');
  };

  const generateInvoiceReport = (download = false) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Invoice Report", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: "center" });
    
    let y = 40;
    const filteredInvoices = filterByDate(invoices);
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = totalRevenue - totalPaid;

    doc.setFontSize(12);
    doc.text(`Total Invoices: ${filteredInvoices.length}`, 20, y);
    y += 6;
    doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Total Paid: $${totalPaid.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Total Outstanding: $${totalOutstanding.toFixed(2)}`, 20, y);
    y += 10;

    filteredInvoices.forEach((inv) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.text(`#${inv.invoiceNumber || 'N/A'} | ${inv.customerName} | ${inv.date} | $${inv.total.toFixed(2)} | ${(inv.paymentStatus || 'unpaid').toUpperCase()}`, 20, y);
      y += 5;
      inv.services?.forEach((s: any) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(8);
        doc.text(`  • ${s.name} - $${s.price.toFixed(2)}`, 25, y);
        y += 4;
      });
      y += 2;
    });

    if (download) doc.save(`InvoiceReport_${new Date().toISOString().split('T')[0]}.pdf`);
    else window.open(doc.output('bloburl'), '_blank');
  };

  const generateFinancialReport = (download = false) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Financial Report", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: "center" });
    
    const filteredInvoices = filterByDate(invoices);
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = totalRevenue - totalPaid;

    let y = 40;
    doc.setFontSize(14);
    doc.text("Revenue Summary", 20, y);
    y += 8;
    doc.setFontSize(12);
    doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Total Paid: $${totalPaid.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Total Outstanding: $${totalOutstanding.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Profit (Paid Amount): $${totalPaid.toFixed(2)}`, 20, y);

    if (download) doc.save(`FinancialReport_${new Date().toISOString().split('T')[0]}.pdf`);
    else window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Reports" />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <h1 className="text-3xl font-bold text-foreground">Business Reports</h1>
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                </SelectContent>
              </Select>
              <DateRangeFilter value={dateRange} onChange={setDateRange} storageKey="reports-range" />
            </div>
          </div>

          <Tabs defaultValue="customers" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-4">
              <Card className="p-6 bg-gradient-card border-border">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-foreground">Customer Report</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => generateCustomerReport(false)}>
                      <Printer className="h-4 w-4 mr-2" />Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => generateCustomerReport(true)}>
                      <Save className="h-4 w-4 mr-2" />Save PDF
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Total Customers: <span className="font-semibold text-foreground">{filterByDate(customers).length}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This report includes all customer details, vehicle information, and invoice history for the selected date range.
                  </p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              <Card className="p-6 bg-gradient-card border-border">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-foreground">Invoice Report</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => generateInvoiceReport(false)}>
                      <Printer className="h-4 w-4 mr-2" />Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => generateInvoiceReport(true)}>
                      <Save className="h-4 w-4 mr-2" />Save PDF
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold text-foreground">{filterByDate(invoices).length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">
                      ${filterByDate(invoices).reduce((sum, inv) => sum + (inv.total || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="text-2xl font-bold text-success">
                      ${filterByDate(invoices).reduce((sum, inv) => sum + (inv.paidAmount || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-2xl font-bold text-destructive">
                      ${(filterByDate(invoices).reduce((sum, inv) => sum + (inv.total || 0), 0) - 
                         filterByDate(invoices).reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <Card className="p-6 bg-gradient-card border-border">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-foreground">Financial Report</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => generateFinancialReport(false)}>
                      <Printer className="h-4 w-4 mr-2" />Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => generateFinancialReport(true)}>
                      <Save className="h-4 w-4 mr-2" />Save PDF
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4 bg-primary/10 border-primary/20">
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-3xl font-bold text-primary">
                        ${filterByDate(invoices).reduce((sum, inv) => sum + (inv.total || 0), 0).toFixed(2)}
                      </p>
                    </Card>
                    <Card className="p-4 bg-success/10 border-success/20">
                      <p className="text-sm text-muted-foreground">Total Paid (Profit)</p>
                      <p className="text-3xl font-bold text-success">
                        ${filterByDate(invoices).reduce((sum, inv) => sum + (inv.paidAmount || 0), 0).toFixed(2)}
                      </p>
                    </Card>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This report summarizes revenue and profit for the selected date range based on invoice data.
                  </p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Reports;

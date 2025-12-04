import localforage from 'localforage';
import { upsertCustomer, upsertInvoice } from '@/lib/db';
import { savePDFToArchive } from '@/lib/pdfArchive';
import { servicePackages, addOns, getServicePrice, getAddOnPrice } from '@/lib/services';

type CreatedUser = { id: string; name: string; email: string; role: 'customer' | 'employee' };
type MockJob = {
  id: string;
  customerId: string;
  customerName: string;
  employeeId: string; // stores employee name for filtering
  employeeName: string;
  packageName: string;
  vehicleType: string;
  invoice?: { id?: string; total: number; paidAmount: number; paymentStatus: string; invoiceNumber?: number };
};
type MockInventoryItem = { name: string; category: 'Chemical' | 'Material' };

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function mockEmail(slug: string, role: 'customer' | 'employee', n: number) {
  return `static+${slug}.${role}${n}@example.local`;
}

async function addLocalUserRecord(u: CreatedUser) {
  if (u.role === 'customer') {
    await upsertCustomer({ id: u.id, name: u.name, email: u.email, role: 'customer', isStaticMock: true });
  }
  const users = (await localforage.getItem<any[]>('users')) || [];
  users.push({ id: u.id, name: u.name, email: u.email, role: u.role, isStaticMock: true, updatedAt: new Date().toISOString() });
  await localforage.setItem('users', users);
  if (u.role === 'employee') {
    const emps = (await localforage.getItem<any[]>('company-employees')) || [];
    emps.push({ id: u.id, name: u.name, email: u.email, role: 'employee', isStaticMock: true, updatedAt: new Date().toISOString() });
    await localforage.setItem('company-employees', emps);
  }
}

async function addStaticInventory(): Promise<MockInventoryItem[]> {
  const chemicals = (await localforage.getItem<any[]>("chemicals")) || [];
  const mockChemicals = [
    { id: genId('chem_apc'), name: 'All-Purpose Cleaner', bottleSize: '32 oz', costPerBottle: 12.99, currentStock: 8, threshold: 2, isStaticMock: true },
    { id: genId('chem_glass'), name: 'Glass Cleaner', bottleSize: '16 oz', costPerBottle: 7.49, currentStock: 5, threshold: 2, isStaticMock: true },
    { id: genId('chem_deg'), name: 'Wheel Degreaser', bottleSize: '24 oz', costPerBottle: 9.99, currentStock: 4, threshold: 2, isStaticMock: true },
  ];
  const chemNames = new Set(chemicals.map(c => String(c.name || '').toLowerCase()));
  for (const c of mockChemicals) { if (!chemNames.has(c.name.toLowerCase())) chemicals.push(c); }
  await localforage.setItem("chemicals", chemicals);

  const materials = (await localforage.getItem<any[]>("materials")) || [];
  const nowIso = new Date().toISOString();
  const mockMaterials = [
    { id: genId('mat_rag'), name: 'Microfiber Rag', category: 'Rag', subtype: 'Large', quantity: 30, costPerItem: 1.25, lowThreshold: 10, createdAt: nowIso, isStaticMock: true },
    { id: genId('mat_brush'), name: 'Soft Brush', category: 'Brush', subtype: 'Soft', quantity: 12, costPerItem: 4.99, lowThreshold: 3, createdAt: nowIso, isStaticMock: true },
    { id: genId('mat_clay'), name: 'Detailing Clay', category: 'Clay', subtype: 'Fine', quantity: 6, costPerItem: 7.50, lowThreshold: 2, createdAt: nowIso, isStaticMock: true },
  ];
  const matNames = new Set(materials.map(m => String(m.name || '').toLowerCase()));
  for (const m of mockMaterials) { if (!matNames.has(m.name.toLowerCase())) materials.push(m); }
  await localforage.setItem("materials", materials);

  const inv: MockInventoryItem[] = [
    { name: 'All-Purpose Cleaner', category: 'Chemical' },
    { name: 'Glass Cleaner', category: 'Chemical' },
    { name: 'Wheel Degreaser', category: 'Chemical' },
    { name: 'Microfiber Rag', category: 'Material' },
    { name: 'Soft Brush', category: 'Material' },
    { name: 'Detailing Clay', category: 'Material' },
  ];
  try { window.dispatchEvent(new CustomEvent('inventory-changed')); } catch { }
  return inv;
}

function archiveJobPDFPlaceholder(customerName: string, checklistId: string) {
  const dummy = 'data:application/pdf;base64,' + btoa('Static Mock Job PDF');
  try { savePDFToArchive('Job', customerName, checklistId, dummy, { fileName: `Job_Completion_${customerName}_${new Date().toISOString().split('T')[0]}.pdf` }); } catch { }
}

export async function insertStaticMockData(reporter?: (msg: string) => void) {
  const report = (msg: string) => { try { reporter && reporter(msg); } catch { } };
  const tracker: { users: CreatedUser[]; jobs: string[]; invoices: string[]; jobDetails: MockJob[]; inventory: MockInventoryItem[] } = { users: [], jobs: [], invoices: [], jobDetails: [], inventory: [] };
  const custNames = ['Taylor Frost', 'Jordan Lee', 'Morgan Park'];
  const empNames = ['Sam Rivera', 'Jamie Chen', 'Riley Brooks'];

  report('Creating static customers…');
  for (let i = 0; i < custNames.length; i++) {
    const name = custNames[i];
    const email = mockEmail(name.split(' ')[0].toLowerCase(), 'customer', i + 1);
    const u: CreatedUser = { id: genId('static_cust'), name, email, role: 'customer' };
    await addLocalUserRecord(u);
    tracker.users.push(u);
    report(`Customer created: ${u.name} (${u.email})`);
  }
  report('Creating static employees…');
  for (let i = 0; i < empNames.length; i++) {
    const name = empNames[i];
    const email = mockEmail(name.split(' ')[0].toLowerCase(), 'employee', i + 1);
    const u: CreatedUser = { id: genId('static_emp'), name, email, role: 'employee' };
    await addLocalUserRecord(u);
    tracker.users.push(u);
    report(`Employee created: ${u.name} (${u.email})`);
  }

  // Create 2 static jobs without API calls
  report('Creating static jobs and checklists…');
  const customers = tracker.users.filter(u => u.role === 'customer');
  const employees = tracker.users.filter(u => u.role === 'employee');
  const pkgChoices = [...servicePackages].slice(0, 2);
  const checklists = (await localforage.getItem<any[]>('generic-checklists')) || [];
  for (let j = 0; j < 2; j++) {
    const cust = customers[j % customers.length];
    const emp = employees[j % employees.length];
    const pkg = pkgChoices[j];
    const addOnChoices = [...addOns].slice(0, 2);
    const vehicleType = ['compact', 'midsize', 'truck', 'luxury'][j % 4];
    const tasks = (pkg.steps || []).map((s: any) => ({ id: s.id || s, name: s.name || s, category: s.category || 'exterior', checked: true }));
    const recordId = genId('gc');
    const record = {
      id: recordId,
      packageId: pkg.id,
      vehicleType,
      vehicleTypeNote: '',
      addons: addOnChoices.map(a => a.id),
      tasks,
      progress: 100,
      employeeId: emp.name, // filter expects name
      estimatedTime: `${90 + j * 15} mins`,
      customerId: cust.id,
      createdAt: new Date().toISOString(),
      linkedAt: new Date().toISOString(),
    };
    checklists.push(record);
    archiveJobPDFPlaceholder(cust.name, recordId);
    tracker.jobs.push(recordId);
    // Create invoice
    const items = [
      { name: pkg.name, price: getServicePrice(pkg.id, vehicleType as any) },
      ...addOnChoices.map(a => ({ name: a.name, price: getAddOnPrice(a.id, vehicleType as any) })),
    ];
    const subtotal = items.reduce((s, it) => s + (it.price || 0), 0);
    const total = subtotal;
    const inv: any = await upsertInvoice({
      customerId: cust.id,
      customerName: cust.name,
      services: items,
      total,
      paidAmount: j === 0 ? total : Math.round(total * 0.5),
      paymentStatus: j === 0 ? 'paid' : 'unpaid',
      invoiceNumber: 200 + Math.floor(Math.random() * 100),
      date: new Date().toISOString(),
      isStaticMock: true,
    } as any);
    tracker.invoices.push(inv.id);
    tracker.jobDetails.push({
      id: recordId,
      customerId: cust.id,
      customerName: cust.name,
      employeeId: emp.name,
      employeeName: emp.name,
      packageName: pkg.name,
      vehicleType,
      invoice: { id: inv?.id, total, paidAmount: j === 0 ? total : Math.round(total * 0.5), paymentStatus: j === 0 ? 'paid' : 'unpaid', invoiceNumber: inv?.invoiceNumber },
    });
  }
  await localforage.setItem('generic-checklists', checklists);

  // Add inventory
  report('Adding static inventory…');
  tracker.inventory = await addStaticInventory();

  await localforage.setItem('static-mock-tracker', tracker);
  try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'static-mock-data' } })); } catch { }
  report('Static mock data insertion complete');
  return tracker;
}

export async function removeStaticMockData() {
  const tracker = (await localforage.getItem<any>('static-mock-tracker')) || { users: [], jobs: [], invoices: [] };
  // Remove users
  const users = (await localforage.getItem<any[]>('users')) || [];
  const nextUsers = users.filter(u => !u.isStaticMock && !String(u.email || '').startsWith('static+'));
  await localforage.setItem('users', nextUsers);
  // Employees (both localforage and localStorage)
  const emps = (await localforage.getItem<any[]>('company-employees')) || [];
  const nextEmps = emps.filter(u => !u.isStaticMock && !String(u.email || '').startsWith('static+'));
  await localforage.setItem('company-employees', nextEmps);
  try {
    const lsEmps = JSON.parse(localStorage.getItem('company-employees') || '[]');
    const nextLsEmps = lsEmps.filter((u: any) => !u.isStaticMock && !String(u.email || '').startsWith('static+'));
    localStorage.setItem('company-employees', JSON.stringify(nextLsEmps));
  } catch { }
  // Customers
  const customers = (await localforage.getItem<any[]>('customers')) || [];
  const nextCust = customers.filter(c => !String(c.email || '').startsWith('static+'));
  await localforage.setItem('customers', nextCust);
  // Inventory
  const chemicals = (await localforage.getItem<any[]>('chemicals')) || [];
  const nextChems = chemicals.filter(c => !c.isStaticMock);
  await localforage.setItem('chemicals', nextChems);
  const materials = (await localforage.getItem<any[]>('materials')) || [];
  const nextMats = materials.filter(m => !m.isStaticMock);
  await localforage.setItem('materials', nextMats);
  // Invoices
  const invoices = (await localforage.getItem<any[]>('invoices')) || [];
  const nextInv = invoices.filter(inv => !(tracker.invoices || []).includes(inv.id));
  await localforage.setItem('invoices', nextInv);
  // Checklists
  const gcs = (await localforage.getItem<any[]>('generic-checklists')) || [];
  const nextGcs = gcs.filter(gc => !(tracker.jobs || []).includes(gc.id));
  await localforage.setItem('generic-checklists', nextGcs);
  // PDFs
  try {
    const pdfRaw = JSON.parse(localStorage.getItem('pdfArchive') || '[]');
    const nextPdf = pdfRaw.filter((r: any) => !(tracker.jobs || []).includes(r.recordId));
    localStorage.setItem('pdfArchive', JSON.stringify(nextPdf));
  } catch { }

  await localforage.removeItem('static-mock-tracker');
  try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'static-mock-data-removed' } })); } catch { }
}

export default { insertStaticMockData, removeStaticMockData };

// Basic local-only mock data (no jobs, invoices) for Admin Dashboard popup
export async function insertStaticMockBasic(
  reporter?: (msg: string) => void,
  opts: { customers?: number; employees?: number; chemicals?: number; materials?: number } = { customers: 5, employees: 5, chemicals: 3, materials: 3 }
) {
  const report = (msg: string) => { try { reporter && reporter(msg); } catch { } };
  const tracker: {
    customers: CreatedUser[];
    employees: CreatedUser[];
    inventory: MockInventoryItem[];
    income?: any[];
    expenses?: any[];
    payroll?: any[];
    invoices?: any[];
    categories?: any;
  } = { customers: [], employees: [], inventory: [] };

  const custNames = ['Alex Green', 'Casey Brown', 'Drew White', 'Evan Blue', 'Finn Gray'];
  const empNames = ['Harper Quinn', 'Jesse Lane', 'Kai Morgan', 'Logan Reese', 'Milan Avery'];

  // Create customers
  report('Creating static customers…');
  for (let i = 0; i < (opts.customers || 5); i++) {
    const name = custNames[i % custNames.length];
    const email = mockEmail(name.split(' ')[0].toLowerCase(), 'customer', i + 1);
    const u: CreatedUser = { id: genId('static_cust'), name, email, role: 'customer' };
    await addLocalUserRecord(u);
    tracker.customers.push(u);
    report(`Customer created: ${u.name} (${u.email})`);
  }

  // Create employees
  report('Creating static employees…');
  for (let i = 0; i < (opts.employees || 5); i++) {
    const name = empNames[i % empNames.length];
    const email = mockEmail(name.split(' ')[0].toLowerCase(), 'employee', i + 1);
    const u: CreatedUser = { id: genId('static_emp'), name, email, role: 'employee' };
    await addLocalUserRecord(u);
    tracker.employees.push(u);
    report(`Employee created: ${u.name} (${u.email})`);
  }

  // Create inventory
  report('Adding static inventory…');
  tracker.inventory = await addStaticInventory();

  // Create custom categories
  report('Creating custom categories…');
  const incomeTransactions = [];
  const incomeCategories = ['Detail Package Sales', 'Add-on Services', 'Gift Cards'];
  const now = new Date();

  for (let i = 0; i < 10; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const income = {
      id: genId('income'),
      amount: Math.floor(Math.random() * 300) + 50,
      category: incomeCategories[i % incomeCategories.length],
      source: tracker.customers[i % tracker.customers.length]?.name || 'Customer',
      description: `Mock ${incomeCategories[i % incomeCategories.length]}`,
      date: date.toISOString(),
      createdAt: date.toISOString()
    };
    incomeTransactions.push(income);
  }

  // Save income via receivables
  const { upsertReceivable } = await import('@/lib/receivables');
  for (const inc of incomeTransactions) {
    await upsertReceivable(inc);
  }
  tracker.income = incomeTransactions;
  report(`Created ${incomeTransactions.length} income transactions`);

  // Create expense transactions (debits)
  report('Creating expense transactions…');
  const expenseTransactions = [];
  const expenseCategories = ['Marketing', 'Equipment Purchases', 'Payroll', 'Office Supplies'];

  for (let i = 0; i < 12; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const expense = {
      id: genId('expense'),
      amount: Math.floor(Math.random() * 200) + 30,
      category: expenseCategories[i % expenseCategories.length],
      description: `Mock ${expenseCategories[i % expenseCategories.length]} expense`,
      date: date.toISOString(),
      createdAt: date.toISOString()
    };
    expenseTransactions.push(expense);
  }

  // Save expenses via db
  const { upsertExpense } = await import('@/lib/db');
  for (const exp of expenseTransactions) {
    await upsertExpense(exp);
  }
  tracker.expenses = expenseTransactions;
  report(`Created ${expenseTransactions.length} expense transactions`);

  // Create payroll history
  report('Creating payroll history…');
  const payrollEntries = [];
  for (let i = 0; i < tracker.employees.length; i++) {
    const emp = tracker.employees[i];
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const entry = {
      id: genId('payroll'),
      employee: emp.email,
      employeeName: emp.name,
      amount: Math.floor(Math.random() * 500) + 200,
      type: ['Job Payment', 'Hourly Wage', 'Bonus'][i % 3],
      description: `Mock payment for ${emp.name}`,
      date: date.toISOString(),
      status: 'Paid'
    };
    payrollEntries.push(entry);
  }

  const currentPayroll = (await localforage.getItem<any[]>('payroll-history')) || [];
  await localforage.setItem('payroll-history', [...currentPayroll, ...payrollEntries]);
  tracker.payroll = payrollEntries;
  report(`Created ${payrollEntries.length} payroll entries`);

  // Create sample invoices
  report('Creating sample invoices…');
  const invoices = [];
  for (let i = 0; i < 5; i++) {
    const customer = tracker.customers[i % tracker.customers.length];
    const daysAgo = Math.floor(Math.random() * 20);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const total = Math.floor(Math.random() * 400) + 100;
    const paid = Math.random() > 0.3 ? total : Math.floor(total * 0.5);

    const invoice = {
      id: genId('invoice'),
      invoiceNumber: 1000 + i,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      total,
      paidAmount: paid,
      paymentStatus: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
      date: date.toISOString(),
      dueDate: new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        { name: 'Full Detail Package', quantity: 1, price: total * 0.8 },
        { name: 'Ceramic Coating Add-on', quantity: 1, price: total * 0.2 }
      ]
    };
    invoices.push(invoice);
  }

  const currentInvoices = (await localforage.getItem<any[]>('invoices')) || [];
  await localforage.setItem('invoices', [...currentInvoices, ...invoices]);
  tracker.invoices = invoices;
  report(`Created ${invoices.length} invoices`);

  // Dispatch events
  try {
    window.dispatchEvent(new CustomEvent('content-changed', { detail: { kind: 'users' } }));
    window.dispatchEvent(new CustomEvent('content-changed', { detail: { kind: 'employees' } }));
    window.dispatchEvent(new CustomEvent('content-changed', { detail: { kind: 'customers' } }));
    window.dispatchEvent(new CustomEvent('inventory-changed'));
    window.dispatchEvent(new CustomEvent('accounting-changed'));
    window.dispatchEvent(new CustomEvent('payroll-changed'));
  } catch { }

  report('Static mock data insertion complete with accounting, payroll, invoices, and categories!');
  return tracker;
}

export async function removeStaticMockBasic(reporter?: (msg: string) => void) {
  const report = (msg: string) => { try { reporter && reporter(msg); } catch { } };
  report('Removing static customers, employees, and inventory…');
  // Users
  const users = (await localforage.getItem<any[]>('users')) || [];
  await localforage.setItem('users', users.filter(u => !u.isStaticMock && !String(u.email || '').startsWith('static+')));
  // Employees (both localforage and localStorage)
  const emps = (await localforage.getItem<any[]>('company-employees')) || [];
  await localforage.setItem('company-employees', emps.filter(u => !u.isStaticMock && !String(u.email || '').startsWith('static+')));
  try {
    const lsEmps = JSON.parse(localStorage.getItem('company-employees') || '[]');
    const nextLsEmps = lsEmps.filter((u: any) => !u.isStaticMock && !String(u.email || '').startsWith('static+'));
    localStorage.setItem('company-employees', JSON.stringify(nextLsEmps));
  } catch { }
  // Customers
  const customers = (await localforage.getItem<any[]>('customers')) || [];
  await localforage.setItem('customers', customers.filter(c => !String(c.email || '').startsWith('static+')));
  // Inventory
  const chemicals = (await localforage.getItem<any[]>('chemicals')) || [];
  await localforage.setItem('chemicals', chemicals.filter(c => !c.isStaticMock));
  const materials = (await localforage.getItem<any[]>('materials')) || [];
  await localforage.setItem('materials', materials.filter(m => !m.isStaticMock));
  // Clear residual badges/alerts (payroll_due and others created during mock)
  try {
    const { clearAllAlerts } = await import('@/lib/adminAlerts');
    clearAllAlerts();
  } catch { }
  // Reset computed badge helpers
  try { localStorage.setItem('inventory_low_count', '0'); } catch { }
  try { localStorage.setItem('payroll_owed_adjustments', '{}'); } catch { }
  try {
    window.dispatchEvent(new CustomEvent('content-changed', { detail: { kind: 'users' } }));
    window.dispatchEvent(new CustomEvent('content-changed', { detail: { kind: 'employees' } }));
    window.dispatchEvent(new CustomEvent('content-changed', { detail: { kind: 'customers' } }));
    window.dispatchEvent(new CustomEvent('inventory-changed'));
    window.dispatchEvent(new CustomEvent('admin_alerts_updated'));
  } catch { }
  report('Static mock data removal complete');
}

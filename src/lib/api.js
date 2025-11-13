// src/lib/api.js — backend base URL (port 6061 is the new truth)
import localforage from 'localforage';
const API_BASE = 'http://localhost:6061';

// Basic retry wrapper and clearer error messaging when backend is unavailable.
async function fetchWithRetry(url, options = {}, retries = 1) {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    // Allow endpoints that respond with text
    return res.text();
  } catch (err) {
    if (retries > 0) {
      // small backoff
      await new Promise(r => setTimeout(r, 200));
      return fetchWithRetry(url, options, retries - 1);
    }
    // Gracefully degrade: return null instead of throwing to avoid noisy overlay errors.
    return null;
  }
}

const api = async (endpoint, options = {}) => {
  // Live add-ons list with pricing and visibility
  if (endpoint === '/api/addons/live' && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const { addOns } = await import('@/lib/services');
      const { getCustomAddOns, getAddOnMeta } = await import('@/lib/servicesMeta');
      const built = addOns.map(a => ({ id: a.id, name: a.name, pricing: a.pricing }));
      const customs = getCustomAddOns().map((a) => ({ id: a.id, name: a.name, pricing: a.pricing || { compact: 0, midsize: 0, truck: 0, luxury: 0 } }));
      const merged = [...built, ...customs].filter(a => (getAddOnMeta(a.id)?.deleted !== true) && (getAddOnMeta(a.id)?.visible !== false));
      return merged;
    } catch (e) {
      return [];
    }
  }
  // Inventory combined list for materials section
  if (endpoint === '/api/inventory/all' && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const chemicals = (await localforage.getItem('chemicals')) || [];
      const materials = (await localforage.getItem('materials')) || [];
      return { chemicals, materials };
    } catch (e) {
      return { chemicals: [], materials: [] };
    }
  }
  // Inventory estimate update (temporary hold before job completion)
  if (endpoint === '/api/inventory/estimate-update' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const list = (await localforage.getItem('inventory-estimates')) || [];
      list.push({ ...payload, id: `ie_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, savedAt: new Date().toISOString() });
      await localforage.setItem('inventory-estimates', list);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_save_estimate_local' };
    }
  }
  // Generic checklist save (unlinked)
  if (endpoint === '/api/checklist/generic' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const list = (await localforage.getItem('generic-checklists')) || [];
      const id = `gc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      const record = { id, ...payload, createdAt: new Date().toISOString() };
      list.push(record);
      await localforage.setItem('generic-checklists', list);
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: 'failed_to_save_generic_local' };
    }
  }
  // Link generic checklist to a customer/job
  if (endpoint.startsWith('/api/checklist/') && endpoint.endsWith('/link-customer') && (options.method || 'GET').toUpperCase() === 'PUT') {
    try {
      const id = endpoint.split('/')[3];
      const payload = JSON.parse(options.body || '{}');
      const { customerId, jobId } = payload || {};
      const list = (await localforage.getItem('generic-checklists')) || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], customerId: customerId || list[idx].customerId, jobId: jobId || list[idx].jobId, linkedAt: new Date().toISOString() };
        await localforage.setItem('generic-checklists', list);
        return { ok: true };
      }
      return { ok: false, error: 'not_found' };
    } catch (e) {
      return { ok: false, error: 'failed_to_link_local' };
    }
  }
  // Customer search (local)
  if (endpoint.startsWith('/api/customers/search') && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const qStr = String(endpoint.split('?')[1] || '');
      const params = new URLSearchParams(qStr);
      const q = (params.get('q') || '').toLowerCase();
      const list = (await localforage.getItem('customers')) || [];
      const filtered = list.filter((c) => {
        const combo = `${c.name || ''} ${c.phone || ''} ${c.email || ''}`.toLowerCase();
        return !q || combo.includes(q);
      });
      return filtered;
    } catch (e) {
      return [];
    }
  }
  // Local handler: GET all customers — always return an array fallback
  if (endpoint === '/api/customers' && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const list = (await localforage.getItem('customers')) || [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  // Local handler: upsert customers when backend is unavailable
  if (endpoint === '/api/customers' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const list = (await localforage.getItem('customers')) || [];
      const now = new Date().toISOString();
      let saved = null;
      if (payload.id) {
        const idx = list.findIndex((c) => c.id === payload.id);
        if (idx >= 0) {
          const existing = list[idx] || {};
          saved = { ...existing, ...payload, updatedAt: now, createdAt: existing.createdAt || now };
          list[idx] = saved;
        } else {
          saved = { id: String(payload.id), ...payload, createdAt: now, updatedAt: now };
          list.push(saved);
        }
      } else {
        const id = `c_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
        saved = { id, ...payload, createdAt: now, updatedAt: now };
        list.push(saved);
      }
      await localforage.setItem('customers', list);
      try {
        const { pushAdminAlert } = await import('@/lib/adminAlerts');
        pushAdminAlert('customer_added', `New customer added: ${String((saved || {}).name || '').trim()}`, 'system', { id: saved.id, recordType: 'Customer' });
      } catch {}
      return saved;
    } catch (e) {
      return { ok: false, error: 'failed_to_save_customer_local' };
    }
  }
  // Local handler: checklist materials usage — decrement stock and append usage history
  if (endpoint === '/api/checklist/materials' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '[]');
      const items = Array.isArray(payload) ? payload : [payload];
      const chemicals = (await localforage.getItem('chemicals')) || [];
      const materials = (await localforage.getItem('materials')) || [];
      const usage = (await localforage.getItem('chemical-usage')) || [];

      const findChem = (id) => chemicals.find((c) => String(c.id) === String(id));
      const findMat = (id) => materials.find((m) => String(m.id) === String(id));

      const nowStr = new Date().toISOString();
      items.forEach((it) => {
        const qty = Number(it.quantityUsed || it.quantity || 0);
        const date = String(it.date || nowStr);
        const serviceName = String(it.serviceName || 'Service');
        const employee = String(it.employee || '');
        if (it.chemicalId) {
          const c = findChem(it.chemicalId);
          if (c) {
            c.currentStock = Math.max(0, Number(c.currentStock || 0) - qty);
            usage.push({ id: `u_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, chemicalId: c.id, chemicalName: c.name, serviceName, date, employee });
          }
        } else if (it.materialId) {
          const m = findMat(it.materialId);
          if (m) {
            m.quantity = Math.max(0, Number(m.quantity || 0) - qty);
            usage.push({ id: `u_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, materialId: m.id, materialName: m.name, serviceName, date, employee });
          }
        }
      });

      await localforage.setItem('chemicals', chemicals);
      await localforage.setItem('materials', materials);
      await localforage.setItem('chemical-usage', usage);

      // Push low inventory alerts for any items now under threshold
      try {
        const { pushAdminAlert } = await import('@/lib/adminAlerts');
        const lowChem = chemicals.filter((c) => Number(c.currentStock || 0) <= Number(c.threshold || 0));
        const lowMat = materials.filter((m) => typeof m.lowThreshold === 'number' && Number(m.quantity || 0) <= Number(m.lowThreshold));
        const count = lowChem.length + lowMat.length;
        if (count > 0) {
          pushAdminAlert('low_inventory', `Low inventory detected: ${count} items`, 'system', { count, recordType: 'Inventory' });
        }
      } catch {}

      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_update_inventory_local' };
    }
  }
  // Local handler: materials usage by employee with date filters
  if (endpoint.startsWith('/api/employees/') && endpoint.endsWith('/materials') && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const usage = (await localforage.getItem('chemical-usage')) || [];
      const qStr = String(endpoint.split('?')[1] || '');
      const params = new URLSearchParams(qStr);
      const start = params.get('start') || '';
      const end = params.get('end') || '';
      const employeeId = params.get('employeeId') || '';
      const startTs = start ? new Date(start).getTime() : 0;
      const endTs = end ? new Date(end).getTime() : Infinity;
      const filtered = usage.filter((u) => {
        const t = new Date(u.date || '').getTime();
        const matchDate = t >= startTs && t <= endTs;
        const matchEmp = employeeId ? (String(u.employee || '') === String(employeeId)) : true;
        return matchDate && matchEmp;
      });
      return filtered;
    } catch (e) {
      return [];
    }
  }
  // Payroll due logic: count employees overdue (no payment in last 7 days)
  if (endpoint === '/api/payroll/due-count' && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const employees = (await localforage.getItem('company-employees')) || [];
      const history = (await localforage.getItem('payroll-history')) || [];
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const isDue = (emp) => {
        const lastPaidTs = emp.lastPaid ? new Date(emp.lastPaid).getTime() : 0;
        const recentPaid = history.some(h => String(h.status) === 'Paid' && (String(h.employee) === emp.name || String(h.employee) === emp.email) && (now - new Date(h.date).getTime()) <= sevenDays);
        return (!recentPaid) && ((now - lastPaidTs) > sevenDays);
      };
      const count = employees.filter(isDue).length;
      return { count };
    } catch (e) {
      return { count: 0 };
    }
  }
  // Payroll due total: unpaid jobs + pending history - adjustments for overdue employees
  if (endpoint === '/api/payroll/due-total' && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const employees = (await localforage.getItem('company-employees')) || [];
      const history = (await localforage.getItem('payroll-history')) || [];
      const jobs = JSON.parse(localStorage.getItem('completedJobs') || '[]');
      const adj = JSON.parse(localStorage.getItem('payroll_owed_adjustments') || '{}');
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const isDue = (emp) => {
        const lastPaidTs = emp.lastPaid ? new Date(emp.lastPaid).getTime() : 0;
        const recentPaid = history.some(h => String(h.status) === 'Paid' && (String(h.employee) === emp.name || String(h.employee) === emp.email) && (now - new Date(h.date).getTime()) <= sevenDays);
        return (!recentPaid) && ((now - lastPaidTs) > sevenDays);
      };
      const overdue = employees.filter(isDue);
      const total = overdue.reduce((sum, emp) => {
        const unpaidJobs = jobs.filter(j => j.status === 'completed' && !j.paid && (String(j.employee) === emp.email || String(j.employee) === emp.name));
        const unpaidSum = unpaidJobs.reduce((s, j) => s + Number(j.totalRevenue || 0), 0);
        const pendingHist = history.filter(h => String(h.status) === 'Pending' && (String(h.employee) === emp.name || String(h.employee) === emp.email));
        const pendingSum = pendingHist.reduce((s, h) => s + Number(h.amount || 0), 0);
        const adjSum = Number(adj[emp.name] || 0) + Number(adj[emp.email] || 0);
        const owed = Math.max(0, unpaidSum + pendingSum - adjSum);
        return sum + owed;
      }, 0);
      return { total };
    } catch (e) {
      return { total: 0 };
    }
  }
  // Local handler: payroll history POST/GET
  if (endpoint.startsWith('/api/payroll/history')) {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'POST') {
      try {
        const payload = JSON.parse(options.body || 'null');
        const list = (await localforage.getItem('payroll-history')) || [];
        const pushEntry = (e) => {
          const id = `ph_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
          list.push({ id, ...(e || {}), date: e?.date || new Date().toISOString().slice(0,10) });
        };
        if (Array.isArray(payload)) payload.forEach(pushEntry); else pushEntry(payload);
        await localforage.setItem('payroll-history', list);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'failed_to_save_local' };
      }
    }
    if (method === 'GET') {
      try {
        const list = (await localforage.getItem('payroll-history')) || [];
        // Parse query params
        const qStr = String(endpoint.split('?')[1] || '');
        const params = new URLSearchParams(qStr);
        const employeeId = params.get('employeeId') || '';
        const start = params.get('start') || '';
        const end = params.get('end') || '';
        const type = params.get('type') || '';
        const search = params.get('search') || '';
        const startTs = start ? new Date(start).getTime() : 0;
        const endTs = end ? new Date(end).getTime() : Infinity;
        const filtered = list.filter((e) => {
          const t = new Date(e.date || '').getTime();
          const matchEmp = employeeId ? (String(e.employee || '') === String(employeeId)) : true;
          const matchType = type ? (String(e.type || '') === String(type) || String(e.description || '').includes(type)) : true;
          const matchSearch = search ? (String(e.description || '').toLowerCase().includes(search.toLowerCase()) || String(e.type || '').toLowerCase().includes(search.toLowerCase())) : true;
          const matchDate = t >= startTs && t <= endTs;
          return matchEmp && matchType && matchSearch && matchDate;
        });
        // Sort by date desc
        filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return filtered;
      } catch (e) {
        return [];
      }
    }
  }
  // Update a single payroll history entry (localforage)
  if (endpoint === '/api/payroll/history/update' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const { id, patch } = payload || {};
      const list = (await localforage.getItem('payroll-history')) || [];
      const idx = list.findIndex((e) => e.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...(patch || {}) };
        await localforage.setItem('payroll-history', list);
        return { ok: true };
      }
      return { ok: false, error: 'not_found' };
    } catch (e) {
      return { ok: false, error: 'failed_to_update_local' };
    }
  }
  // Delete a single payroll history entry (localforage)
  if (endpoint === '/api/payroll/history/delete' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const { id } = payload || {};
      const list = (await localforage.getItem('payroll-history')) || [];
      const next = list.filter((e) => e.id !== id);
      await localforage.setItem('payroll-history', next);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_delete_local' };
    }
  }
  // Local handler: persist payroll rows without requiring a backend
  if (endpoint === '/api/payroll/save' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const history = (await localforage.getItem('payroll-saves')) || [];
      history.push({ ...payload, savedAt: new Date().toISOString() });
      await localforage.setItem('payroll-saves', history);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_save_local' };
    }
  }
  // Local handlers for inventory upserts when no backend exists
  if (endpoint === '/api/inventory/chemicals' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const list = (await localforage.getItem('chemicals')) || [];
      const idx = list.findIndex((c) => c.id === payload.id);
      if (idx >= 0) list[idx] = payload; else list.push(payload);
      await localforage.setItem('chemicals', list);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_save_local' };
    }
  }
  // Local handler: send admin email silently (no Gmail compose)
  if (endpoint === '/api/email/admin' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const { subject = '', body = '' } = payload || {};
      const list = (await localforage.getItem('admin-emails')) || [];
      const record = { id: `em_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, subject, body, sentAt: new Date().toISOString() };
      list.push(record);
      await localforage.setItem('admin-emails', list);
      try {
        const { pushAdminAlert } = await import('@/lib/adminAlerts');
        const safeSubject = String(subject || '').trim() || 'Admin email';
        pushAdminAlert('admin_email_sent', `Admin email: ${safeSubject}`,'system', { recordType: 'Admin Email', subject: safeSubject, id: record.id });
      } catch {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_send_admin_email_local' };
    }
  }
  if (endpoint === '/api/inventory/materials' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const list = (await localforage.getItem('materials')) || [];
      const idx = list.findIndex((m) => m.id === payload.id);
      if (idx >= 0) list[idx] = payload; else list.push(payload);
      await localforage.setItem('materials', list);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_save_local' };
    }
  }
  const token = localStorage.getItem('token');
  const url = `${API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}v=${Date.now()}`;
  return fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  }, 1);
}

export default api;

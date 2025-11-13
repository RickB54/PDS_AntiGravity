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
  // =====================
  // Users administration
  // =====================
  if (endpoint === '/api/users' && (options.method || 'GET').toUpperCase() === 'GET') {
    try {
      const list = (await localforage.getItem('users')) || [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // =====================
  // Website Admin content
  // =====================
  // Vehicle Types: manage display labels and descriptions; seed four base keys
  if (endpoint.startsWith('/api/vehicle-types')) {
    const method = (options.method || 'GET').toUpperCase();
    const key = 'vehicleTypes';
    const seed = [
      { id: 'compact', name: 'Compact/Sedan', description: 'Small cars and sedans', hasPricing: true },
      { id: 'midsize', name: 'Mid-Size/SUV', description: 'Mid-size cars and SUVs', hasPricing: true },
      { id: 'truck', name: 'Truck/Van/Large SUV', description: 'Trucks, vans, large SUVs', hasPricing: true },
      { id: 'luxury', name: 'Luxury/High-End', description: 'Luxury and premium vehicles', hasPricing: true },
    ];
    const ensureSeed = async () => {
      const list = (await localforage.getItem(key)) || [];
      if (!Array.isArray(list) || list.length === 0) {
        await localforage.setItem(key, seed);
        return seed;
      }
      // Merge to ensure base keys exist
      const ids = new Set(list.map((v) => v.id));
      const merged = [...list];
      seed.forEach((v) => { if (!ids.has(v.id)) merged.push(v); });
      await localforage.setItem(key, merged);
      return merged;
    };

    // Public live endpoint for vehicle types (visible list with pricing)
    if (method === 'GET' && endpoint === '/api/vehicle-types/live') {
      try {
        const list = await ensureSeed();
        return (Array.isArray(list) ? list : []).filter((v) => v && v.name);
      } catch {
        return seed;
      }
    }

    if (method === 'GET' && endpoint === '/api/vehicle-types') {
      try {
        const list = await ensureSeed();
        return list;
      } catch {
        return seed;
      }
    }
    if (method === 'POST' && endpoint === '/api/vehicle-types') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const list = (await ensureSeed()) || [];
        const id = String(payload.id || `vt_${Date.now()}_${Math.random().toString(36).slice(2,6)}`);
        const record = {
          id,
          name: String(payload.name || 'New Type'),
          description: String(payload.description || ''),
          hasPricing: Boolean(payload.hasPricing),
        };
        // prevent accidental duplicate of base keys
        if (list.some((v) => v.id === id)) {
          return { ok: false, error: 'duplicate_id' };
        }
        list.push(record);
        await localforage.setItem(key, list);
        // Broadcast for immediate UI refresh
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'vehicle-types' } })); } catch {}
        return { ok: true, record };
      } catch (e) {
        return { ok: false, error: 'failed_to_create_local' };
      }
    }
    if (method === 'PUT' && endpoint.startsWith('/api/vehicle-types/')) {
      try {
        const id = endpoint.split('/')[3];
        const payload = JSON.parse(options.body || '{}');
        const list = (await ensureSeed()) || [];
        const idx = list.findIndex((v) => v.id === id);
        if (idx < 0) return { ok: false, error: 'not_found' };
        // Do not allow deleting base keys via update; allow name/description changes
        const prev = list[idx];
        list[idx] = {
          ...prev,
          name: payload.name != null ? String(payload.name) : prev.name,
          description: payload.description != null ? String(payload.description) : prev.description,
          hasPricing: payload.hasPricing != null ? Boolean(payload.hasPricing) : prev.hasPricing,
        };
        await localforage.setItem(key, list);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'vehicle-types' } })); } catch {}
        return { ok: true, record: list[idx] };
      } catch (e) {
        return { ok: false, error: 'failed_to_update_local' };
      }
    }
    if (method === 'DELETE' && endpoint.startsWith('/api/vehicle-types/')) {
      try {
        const id = endpoint.split('/')[3];
        const list = (await ensureSeed()) || [];
        // Protect base pricing keys from deletion to avoid breaking pricing
        if (['compact','midsize','truck','luxury'].includes(id)) {
          return { ok: false, error: 'protected_base_type' };
        }
        const next = list.filter((v) => v.id !== id);
        await localforage.setItem(key, next);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'vehicle-types' } })); } catch {}
        return { ok: true };
      } catch (e) {
        return { ok: false, error: 'failed_to_delete_local' };
      }
    }
  }

  // Pricing utility: apply multiplier to create/update pricing for a new vehicle type
  if (endpoint === '/api/pricing/apply-vehicle-multiplier') {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'POST') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const newTypeId = String(payload.newTypeId || payload.newType || payload.id || '').trim();
        const baseType = String(payload.baseType || 'midsize').trim();
        const multiplier = Number(payload.multiplier || 1);
        if (!newTypeId) {
          return { ok: false, error: 'missing_new_type' };
        }
        if (!['compact','midsize','truck','luxury'].includes(baseType)) {
          return { ok: false, error: 'invalid_base_type' };
        }
        const saved = (await localforage.getItem('savedPrices')) || {};
        let created = 0;
        try {
          const { servicePackages, addOns } = await import('@/lib/services');
          const { getCustomPackages, getCustomAddOns } = await import('@/lib/servicesMeta');
          const allPkgs = [...servicePackages, ...getCustomPackages()];
          const allAddOns = [...addOns, ...getCustomAddOns()];

          // Packages
          for (const p of allPkgs) {
            const baseKey = `package:${p.id}:${baseType}`;
            const newKey = `package:${p.id}:${newTypeId}`;
            const baseVal = saved[baseKey] != null
              ? Number(saved[baseKey])
              : Number((p.pricing && p.pricing[baseType]) || 0);
            const nextVal = Math.round(baseVal * multiplier);
            if (!Number.isNaN(nextVal)) {
              saved[newKey] = String(nextVal);
              created++;
            }
          }
          // Add-ons
          for (const a of allAddOns) {
            const baseKey = `addon:${a.id}:${baseType}`;
            const newKey = `addon:${a.id}:${newTypeId}`;
            const baseVal = saved[baseKey] != null
              ? Number(saved[baseKey])
              : Number((a.pricing && a.pricing[baseType]) || 0);
            const nextVal = Math.round(baseVal * multiplier);
            if (!Number.isNaN(nextVal)) {
              saved[newKey] = String(nextVal);
              created++;
            }
          }
        } catch {}
        await localforage.setItem('savedPrices', saved);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'savedPrices' } })); } catch {}
        return { ok: true, count: created, newTypeId, baseType, multiplier };
      } catch (e) {
        return { ok: false, error: 'failed_to_apply_multiplier_local' };
      }
    }
  }

  // Packages pricing: apply vehicle multiplier using $ Amount semantics
  if (endpoint === '/api/packages/apply-vehicle-multiplier') {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'POST') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const vehicleTypeId = String(payload.vehicleTypeId || payload.newTypeId || '').trim();
        const amount = Number(payload.multiplier || payload.amount || 100);
        if (!vehicleTypeId) return { ok: false, error: 'missing_vehicle_type' };
        // Amount semantics: 100 => 1.00, 175 => 1.75
        const factor = Math.max(0, amount) / 100;
        const saved = (await localforage.getItem('savedPrices')) || {};
        let created = 0;
        try {
          const { servicePackages, addOns } = await import('@/lib/services');
          const { getCustomPackages, getCustomAddOns } = await import('@/lib/servicesMeta');
          const allPkgs = [...servicePackages, ...getCustomPackages()];
          const allAddOns = [...addOns, ...getCustomAddOns()];

          // Base reference: compact pricing values
          const baseType = 'compact';

          for (const p of allPkgs) {
            const baseKey = `package:${p.id}:${baseType}`;
            const newKey = `package:${p.id}:${vehicleTypeId}`;
            if (saved[newKey] == null) {
              const baseVal = saved[baseKey] != null ? Number(saved[baseKey]) : Number(p.pricing?.[baseType] || 0);
              const nextVal = Math.round(baseVal * factor);
              if (!Number.isNaN(nextVal) && nextVal > 0) { saved[newKey] = String(nextVal); created++; }
            }
          }
          for (const a of allAddOns) {
            const baseKey = `addon:${a.id}:${baseType}`;
            const newKey = `addon:${a.id}:${vehicleTypeId}`;
            if (saved[newKey] == null) {
              const baseVal = saved[baseKey] != null ? Number(saved[baseKey]) : Number(a.pricing?.[baseType] || 0);
              const nextVal = Math.round(baseVal * factor);
              if (!Number.isNaN(nextVal) && nextVal >= 0) { saved[newKey] = String(nextVal); created++; }
            }
          }
        } catch {}
        await localforage.setItem('savedPrices', saved);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'savedPrices' } })); } catch {}
        return { ok: true, count: created, vehicleTypeId, amount };
      } catch {
        return { ok: false, error: 'failed_to_apply_amount_local' };
      }
    }
  }

  // Live packages snapshot: accept full-sync payload and serve live data
  if (endpoint.startsWith('/api/packages/')) {
    const method = (options.method || 'GET').toUpperCase();
    // POST /api/packages/full-sync — store live snapshot
    if (method === 'POST' && endpoint === '/api/packages/full-sync') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const snapshot = {
          savedPrices: payload.savedPrices || {},
          packageMeta: payload.packageMeta || {},
          addOnMeta: payload.addOnMeta || {},
          customPackages: Array.isArray(payload.customPackages) ? payload.customPackages : [],
          customAddOns: Array.isArray(payload.customAddOns) ? payload.customAddOns : [],
          version: Date.now(),
        };
        await localforage.setItem('packagesLive', snapshot);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'packages' } })); } catch {}
        return { ok: true, version: snapshot.version };
      } catch {
        return { ok: false, error: 'failed_to_store_packages_live' };
      }
    }
    // GET /api/packages/live — return live snapshot or build fallback
    if (method === 'GET' && endpoint === '/api/packages/live') {
      try {
        const live = await localforage.getItem('packagesLive');
        if (live) return live;
      } catch {}
      try {
        const { buildFullSyncPayload } = await import('@/lib/servicesMeta');
        const payload = await buildFullSyncPayload();
        const snapshot = { ...payload, version: Date.now() };
        await localforage.setItem('packagesLive', snapshot);
        return snapshot;
      } catch {
        return { savedPrices: {}, packageMeta: {}, addOnMeta: {}, customPackages: [], customAddOns: [], version: Date.now() };
      }
    }
  }

  // FAQs: question/answer list
  if (endpoint.startsWith('/api/faqs')) {
    const method = (options.method || 'GET').toUpperCase();
    const key = 'faqs';
    const nowBase = Date.now();
    const defaultFaqs = [
      { id: `faq_${nowBase}_01`, question: 'How often should I get my car detailed?', answer: 'Most customers detail 2–4 times per year. Frequency depends on how you drive, store, and wash your vehicle. Regular detailing protects finishes and keeps interiors fresh.' },
      { id: `faq_${nowBase}_02`, question: 'What should I do to prepare my car for detailing?', answer: 'Please remove personal items and child seats if possible. A quick trash clean-out helps us focus on deep cleaning. We take care of the rest.' },
      { id: `faq_${nowBase}_03`, question: 'How long does a full detail take?', answer: 'Typically 2.5–3.5 hours depending on vehicle size and condition. Add-ons or heavy soil may extend the time slightly.' },
      { id: `faq_${nowBase}_04`, question: 'Do I need to be present during the service?', answer: 'No, you do not need to be present as long as we have access to the vehicle and keys if needed. We will message you when we are finished.' },
      { id: `faq_${nowBase}_05`, question: 'What are your business hours?', answer: 'Appointments are available daily between 8:00 AM and 6:00 PM. For special requests or after-hours slots, please contact us.' },
      { id: `faq_${nowBase}_06`, question: 'Can I book if it\'s raining?', answer: 'Yes—our mobile service can operate under covered areas or garages. For heavy rain with no cover, we\'ll reschedule at your convenience.' },
      { id: `faq_${nowBase}_07`, question: 'Do you provide water/electricity at my location?', answer: 'We provide our own supplies. If you have preferred access to water or power, that helps, but it\'s not required for most services.' },
      { id: `faq_${nowBase}_08`, question: 'What payment methods do you accept?', answer: 'We accept major credit/debit cards, cash, and digital payments. Payment is due upon completion unless pre-arranged.' },
      { id: `faq_${nowBase}_09`, question: 'Do you offer warranties on services like ceramic coating?', answer: 'Yes—ceramic coatings include a service warranty with care instructions. We provide maintenance tips and recommended follow-up intervals.' },
      { id: `faq_${nowBase}_10`, question: 'Do you have pricing for fleets or multiple vehicles?', answer: 'We offer discounted rates for fleets and multi-vehicle bookings. Contact us to set up a plan that fits your needs.' },
    ];
    const ensureSeed = async () => {
      const list = (await localforage.getItem(key)) || [];
      if (!Array.isArray(list) || list.length === 0) {
        await localforage.setItem(key, defaultFaqs);
        return defaultFaqs;
      }
      return list;
    };
    if (method === 'GET' && endpoint === '/api/faqs') {
      try { return await ensureSeed(); } catch { return []; }
    }
    if (method === 'POST' && endpoint === '/api/faqs') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const list = (await ensureSeed()) || [];
        const record = { id: `faq_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, question: String(payload.question || ''), answer: String(payload.answer || '') };
        list.push(record);
        await localforage.setItem(key, list);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'faqs' } })); } catch {}
        return { ok: true, record };
      } catch { return { ok: false, error: 'failed_to_create_local' }; }
    }
    if (method === 'PUT' && endpoint.startsWith('/api/faqs/')) {
      try {
        const id = endpoint.split('/')[3];
        const payload = JSON.parse(options.body || '{}');
        const list = (await ensureSeed()) || [];
        const idx = list.findIndex((f) => f.id === id);
        if (idx < 0) return { ok: false, error: 'not_found' };
        list[idx] = { ...list[idx], question: String(payload.question ?? list[idx].question), answer: String(payload.answer ?? list[idx].answer) };
        await localforage.setItem(key, list);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'faqs' } })); } catch {}
        return { ok: true, record: list[idx] };
      } catch { return { ok: false, error: 'failed_to_update_local' }; }
    }
    if (method === 'DELETE' && endpoint.startsWith('/api/faqs/')) {
      try {
        const id = endpoint.split('/')[3];
        const list = (await ensureSeed()) || [];
        const next = list.filter((f) => f.id !== id);
        await localforage.setItem(key, next);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'faqs' } })); } catch {}
        return { ok: true };
      } catch { return { ok: false, error: 'failed_to_delete_local' }; }
    }
  }

  // Contact info: hours, phone, address, email
  if (endpoint.startsWith('/api/contact')) {
    const method = (options.method || 'GET').toUpperCase();
    const key = 'contactInfo';
    const defaults = { hours: 'Appointments daily 8 AM–6 PM', phone: '(555) 123-4567', address: 'Methuen, MA', email: 'primedetailsolutions.ma.nh@gmail.com' };
    const ensureSeed = async () => {
      const curr = (await localforage.getItem(key)) || null;
      if (!curr) { await localforage.setItem(key, defaults); return defaults; }
      return curr;
    };
    if (method === 'GET' && endpoint === '/api/contact') {
      try { return await ensureSeed(); } catch { return defaults; }
    }
    // Live endpoint for Contact page (no cache)
    if (method === 'GET' && endpoint === '/api/contact/live') {
      try { return await ensureSeed(); } catch { return defaults; }
    }
    // Update via POST to align with admin Save button
    if (method === 'POST' && endpoint === '/api/contact/update') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const curr = await ensureSeed();
        const next = {
          hours: String(payload.hours ?? curr.hours),
          phone: String(payload.phone ?? curr.phone),
          address: String(payload.address ?? curr.address),
          email: String(payload.email ?? curr.email),
        };
        await localforage.setItem(key, next);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'contact' } })); } catch {}
        return { ok: true, record: next };
      } catch { return { ok: false, error: 'failed_to_update_local' }; }
    }
    if (method === 'PUT' && endpoint === '/api/contact') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const curr = await ensureSeed();
        const next = {
          hours: String(payload.hours ?? curr.hours),
          phone: String(payload.phone ?? curr.phone),
          address: String(payload.address ?? curr.address),
          email: String(payload.email ?? curr.email),
        };
        await localforage.setItem(key, next);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'contact' } })); } catch {}
        return { ok: true, record: next };
      } catch { return { ok: false, error: 'failed_to_update_local' }; }
    }
  }

  // About page sections
  if (endpoint.startsWith('/api/about')) {
    const method = (options.method || 'GET').toUpperCase();
    const key = 'aboutSections';
    const seed = [
      { id: `about_${Date.now()}_story`, section: 'Our Story', content: 'Your trusted partner in premium auto care in Methuen, MA.' },
      { id: `about_${Date.now()}_services`, section: 'Services', content: 'Interior and exterior detailing, paint correction, ceramic coatings, mobile services.' },
      { id: `about_${Date.now()}_team`, section: 'Team', content: 'Highly trained professionals with years of experience.' },
    ];
    const ensureSeed = async () => {
      const list = (await localforage.getItem(key)) || [];
      if (!Array.isArray(list) || list.length === 0) { await localforage.setItem(key, seed); return seed; }
      return list;
    };
    if (method === 'GET' && endpoint === '/api/about') {
      try { return await ensureSeed(); } catch { return []; }
    }
    if (method === 'POST' && endpoint === '/api/about') {
      try {
        const payload = JSON.parse(options.body || '{}');
        const list = (await ensureSeed()) || [];
        const record = { id: `about_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, section: String(payload.section || 'Section'), content: String(payload.content || '') };
        list.push(record);
        await localforage.setItem(key, list);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'about' } })); } catch {}
        return { ok: true, record };
      } catch { return { ok: false, error: 'failed_to_create_local' }; }
    }
    if (method === 'PUT' && endpoint.startsWith('/api/about/')) {
      try {
        const id = endpoint.split('/')[3];
        const payload = JSON.parse(options.body || '{}');
        const list = (await ensureSeed()) || [];
        const idx = list.findIndex((a) => a.id === id);
        if (idx < 0) return { ok: false, error: 'not_found' };
        list[idx] = { ...list[idx], section: String(payload.section ?? list[idx].section), content: String(payload.content ?? list[idx].content) };
        await localforage.setItem(key, list);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'about' } })); } catch {}
        return { ok: true, record: list[idx] };
      } catch { return { ok: false, error: 'failed_to_update_local' }; }
    }
    if (method === 'DELETE' && endpoint.startsWith('/api/about/')) {
      try {
        const id = endpoint.split('/')[3];
        const list = (await ensureSeed()) || [];
        const next = list.filter((a) => a.id !== id);
        await localforage.setItem(key, next);
        try { window.dispatchEvent(new CustomEvent('content-changed', { detail: { type: 'about' } })); } catch {}
        return { ok: true };
      } catch { return { ok: false, error: 'failed_to_delete_local' }; }
    }
  }

  if (endpoint === '/api/users/create' && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const payload = JSON.parse(options.body || '{}');
      const { name = '', email = '', password = '', role = 'employee' } = payload || {};
      const now = new Date().toISOString();
      const users = (await localforage.getItem('users')) || [];
      const exists = users.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase());
      if (exists) {
        return { ok: false, error: 'user_exists' };
      }
      const id = `u_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      const passwordHash = await (async () => {
        try {
          if (crypto?.subtle?.digest) {
            const enc = new TextEncoder();
            const buf = await crypto.subtle.digest('SHA-256', enc.encode(password || `${Math.random()}`));
            const bytes = Array.from(new Uint8Array(buf));
            return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
          }
        } catch {}
        // Fallback naive hash
        const s = password || `${Math.random()}`;
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h.toString(16);
      })();
      const record = { id, name, email, role: (role === 'admin' ? 'admin' : 'employee'), createdAt: now, updatedAt: now, lastLogin: null, passwordHash };
      users.push(record);
      await localforage.setItem('users', users);
      try {
        const { pushAdminAlert } = await import('@/lib/adminAlerts');
        pushAdminAlert('user_created', `New user: ${name} (${role})`, 'system', { id, recordType: 'User' });
      } catch {}
      return { ok: true, user: record };
    } catch (e) {
      return { ok: false, error: 'failed_to_create_user_local' };
    }
  }

  if (endpoint.startsWith('/api/users/') && endpoint.endsWith('/role') && (options.method || 'GET').toUpperCase() === 'PUT') {
    try {
      const id = endpoint.split('/')[3];
      const payload = JSON.parse(options.body || '{}');
      const { role } = payload || {};
      const users = (await localforage.getItem('users')) || [];
      const idx = users.findIndex((u) => String(u.id) === String(id));
      if (idx < 0) return { ok: false, error: 'not_found' };
      users[idx] = { ...users[idx], role: (role === 'admin' ? 'admin' : 'employee'), updatedAt: new Date().toISOString() };
      await localforage.setItem('users', users);
      // If currently impersonated or logged in matches, update session role
      try {
        const curr = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (curr && String(curr.email).toLowerCase() === String(users[idx].email).toLowerCase()) {
          localStorage.setItem('currentUser', JSON.stringify({ ...curr, role: users[idx].role }));
          window.dispatchEvent(new CustomEvent('auth-changed', { detail: { ...curr, role: users[idx].role } }));
        }
      } catch {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_update_role_local' };
    }
  }

  if (endpoint.startsWith('/api/users/impersonate/') && (options.method || 'GET').toUpperCase() === 'POST') {
    try {
      const id = endpoint.split('/')[3];
      const users = (await localforage.getItem('users')) || [];
      const target = users.find((u) => String(u.id) === String(id));
      if (!target) return { ok: false, error: 'not_found' };
      // Save admin user for return after logout
      try {
        const prev = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (prev && prev.role === 'admin') {
          localStorage.setItem('impersonator', JSON.stringify(prev));
        }
      } catch {}
      const user = { email: target.email, role: target.role, name: target.name };
      localStorage.setItem('currentUser', JSON.stringify(user));
      // update last login
      target.lastLogin = new Date().toISOString();
      await localforage.setItem('users', users);
      try { window.dispatchEvent(new CustomEvent('auth-changed', { detail: user })); } catch {}
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: 'failed_to_impersonate_local' };
    }
  }

  if (endpoint.startsWith('/api/users/') && (options.method || 'GET').toUpperCase() === 'DELETE') {
    try {
      const id = endpoint.split('/')[3];
      const users = (await localforage.getItem('users')) || [];
      const next = users.filter((u) => String(u.id) !== String(id));
      await localforage.setItem('users', next);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'failed_to_delete_user_local' };
    }
  }

// handlers continue under the same api() scope
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

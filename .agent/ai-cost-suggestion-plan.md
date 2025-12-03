# AI Cost Suggestion Feature - Implementation Plan

## Overview
Add AI-powered cost suggestions for inventory items with realistic pricing from automotive detailing suppliers and preload a comprehensive detailing chemicals database.

## Phase 1: AI Price Suggestion System

### 1.1 Create AI Price Lookup Module
**New file:** `src/lib/aiPriceSuggestion.ts`

**Features:**
- Fetch realistic prices from known detailing brands
- Cache suggestions to avoid repeated lookups
- Provide fallback pricing based on category
- Support manual price refresh

**Data Sources (Priority Order):**
1. Automotive detailing brands (Chemical Guys, Meguiar's, 3D, Griot's, Adams)
2. Retail stores (AutoZone, O'Reilly, Walmart)
3. Amazon pricing
4. Manufacturer MSRPs

### 1.2 Integration with Inventory Modal
**Modify:** `src/components/inventory/UnifiedInventoryModal.tsx`

**Changes:**
- Add "Suggest Price" button next to cost field
- Auto-suggest on new item creation
- Show suggested price with source
- Allow user to accept or override
- Store suggestion metadata

### 1.3 Price Suggestion UI
```tsx
<div className="flex gap-2">
  <Input type="number" value={cost} />
  <Button onClick={suggestPrice}>
    <Sparkles /> Suggest Price
  </Button>
</div>
{suggestedPrice && (
  <p className="text-sm text-muted-foreground">
    Suggested: ${suggestedPrice} (from {source})
  </p>
)}
```

## Phase 2: Preloaded Detailing Chemicals Database

### 2.1 Create Chemical Database
**New file:** `src/data/detailingChemicals.ts`

**Structure:**
```typescript
interface DetailingChemical {
  id: string;
  name: string;
  category: 'exterior' | 'interior' | 'optional';
  subcategory: string;
  priceRange: { min: number; max: number };
  suggestedPrice: number;
  unitOfMeasure: string;
  consumptionRate: number;
  brands: string[];
  description: string;
}
```

### 2.2 Chemical Categories

**EXTERIOR - BARE MINIMUM:**
- Car Shampoo (pH neutral): $10–$15
- APC (All Purpose Cleaner): $12–$18
- Iron Remover: $12–$20
- Tar Remover: $8–$12
- Clay Bar + Lube: $20–$30
- Spray Wax / Sealant: $10–$15
- Glass Cleaner: $4–$8
- Tire Cleaner: $8–$12
- Tire Dressing: $10–$15
- Wheel Cleaner: $6–$12
- Water Spot Remover: $10–$18

**EXTERIOR - OPTIONAL:**
- SiO2 Spray Sealant: $12–$20
- Trim Restorer: $10–$15
- Bug Remover: $6–$10
- Salt Neutralizer: $10–$15
- Metal Polish: $8–$15
- Headlight UV Protectant: $8–$12
- Ceramic Coating: $25–$50
- IPA Panel Wipe: $6–$12

**INTERIOR - BARE MINIMUM:**
- APC (diluted): included
- Interior Cleaner: $8–$12
- Upholstery Cleaner: $6–$12
- Carpet Stain Remover: $5–$8
- Leather Cleaner: $7–$12
- Leather Conditioner: $7–$12
- Vinyl/Plastic Protectant: $7–$12
- Glass Cleaner: included
- Odor Neutralizer (enzyme): $10–$15

**INTERIOR - OPTIONAL:**
- Enzyme Cleaner: $8–$12
- Fabric Protectant: $8–$12
- Leather Coating: $15–$25
- Plastic Restorer: $8–$12
- Anti-fog: $4–$8
- Odor Encapsulator: $10–$15

### 2.3 Quick Import Feature
**Add to Inventory page:**
- "Import Standard Chemicals" button
- Modal showing all chemicals with checkboxes
- Bulk import selected items
- Auto-populate with suggested prices

## Phase 3: Mobile Detailing Tools Database

### 3.1 Create Tools Database
**New file:** `src/data/detailingTools.ts`

**Categories:**

**Exterior / Wash Tools:**
- Pressure washer (compact electric or gas): $150-$400
- 50–100 ft hose: $30-$80
- Foam cannon: $20-$60
- Pump sprayers: $15-$40
- Buckets with grit guards: $20-$40
- Wheel brushes & barrel brushes: $15-$35

**Vacuum & Extraction:**
- Shop vac (4–6 HP): $80-$200
- Portable carpet extractor: $150-$400
- Interior drill brush kit: $20-$50

**Power Tools:**
- Dual-action polisher: $150-$300
- Mini polisher: $80-$150
- Pad set: $30-$60

**Interior Tools:**
- Air compressor: $100-$250
- Tornador-style interior cleaning tool: $40-$100
- Steam cleaner: $100-$300
- Brush sets: $20-$50

**Microfiber System:**
- Microfiber towels (bulk): $30-$80
- Waffle weave drying towels: $15-$30
- Applicator pads: $10-$25

**Water Management:**
- Water tank (50–100 gallons): $100-$300
- Pump: $50-$150
- Hose reel: $30-$80

**Electric / Power:**
- Inverter: $100-$300
- Generator (quiet, compact): $300-$800
- Extension cords: $20-$50

**Storage:**
- Trunk organizers: $30-$80
- Bed storage boxes: $50-$150
- Seat-back equipment mounts: $20-$60
- Tool bags: $30-$100

### 3.2 Mobile Setup Wizard
**New feature in Inventory:**
- "Setup Mobile Detailing Kit" button
- Wizard asking:
  - Vehicle type (truck vs van)
  - Budget level (basic, standard, premium)
  - Service types offered
- Auto-generate recommended tool list
- One-click import to inventory

### 3.3 Space Optimization Guide
**Add notes for each tool:**
- Truck bed placement
- Back seat storage
- Van shelving recommendations
- Load-out priority (frequently used items)

## Implementation Strategy

### Option A: Full AI Integration (Complex)
**Pros:**
- Real-time pricing from actual sources
- Always up-to-date
- Can adapt to market changes

**Cons:**
- Requires API keys (OpenAI, web scraping)
- Slower performance
- Potential costs
- More complex error handling

### Option B: Curated Database with Smart Defaults (Recommended)
**Pros:**
- Fast and reliable
- No external dependencies
- Predictable behavior
- Easy to maintain

**Cons:**
- Prices may become outdated
- Manual updates needed
- Less "AI magic"

### Option C: Hybrid Approach (Best of Both)
**Pros:**
- Fast defaults from database
- Optional AI refresh
- Best user experience
- Flexible

**Cons:**
- More code to maintain
- Requires both systems

## Recommended Implementation: Option C (Hybrid)

### Step 1: Create Static Database (1 hour)
- Build `detailingChemicals.ts` with all products
- Build `detailingTools.ts` with all equipment
- Include realistic price ranges
- Add consumption rates

### Step 2: Add Quick Import (30 min)
- "Import Standard Chemicals" button
- "Setup Mobile Kit" wizard
- Bulk import functionality

### Step 3: Add AI Suggestion (Optional, 1 hour)
- Simple AI prompt to OpenAI/Claude
- "Refresh Price" button per item
- Cache results for 30 days
- Fallback to database prices

### Step 4: Integration (30 min)
- Update UnifiedInventoryModal
- Add suggestion UI
- Test import flows

## Total Estimated Time
- **Without AI**: 2 hours
- **With AI**: 3 hours

## Files to Create
1. `src/data/detailingChemicals.ts`
2. `src/data/detailingTools.ts`
3. `src/lib/aiPriceSuggestion.ts` (optional)
4. `src/components/inventory/ChemicalImportModal.tsx`
5. `src/components/inventory/MobileKitWizard.tsx`

## Files to Modify
1. `src/components/inventory/UnifiedInventoryModal.tsx`
2. `src/pages/InventoryControl.tsx`

## Next Steps
1. Create detailing chemicals database
2. Create detailing tools database
3. Add import functionality
4. Add mobile kit wizard
5. (Optional) Add AI price refresh

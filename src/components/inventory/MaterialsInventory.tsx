import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Printer, Save } from "lucide-react";
import localforage from "localforage";
import jsPDF from "jspdf";

interface MaterialItem {
  id: string;
  name: string;
  category: string; // Rag, Brush, Tool, Other
  subtype?: string; // e.g., microfiber size or brush type
  quantity: number;
  costPerItem?: number;
  notes?: string;
  lowThreshold?: number;
  createdAt: string;
}

export default function MaterialsInventory() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "Rag",
    subtype: "",
    quantity: "0",
    costPerItem: "",
    notes: "",
    lowThreshold: "",
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const list = (await localforage.getItem<MaterialItem[]>("materials")) || [];
    setItems(list);
  };

  const saveList = async (list: MaterialItem[]) => {
    await localforage.setItem("materials", list);
    setItems(list);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", category: "Rag", subtype: "", quantity: "0", costPerItem: "", notes: "", lowThreshold: "" });
    setModalOpen(true);
  };

  const openEdit = (item: MaterialItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      subtype: item.subtype || "",
      quantity: String(item.quantity),
      costPerItem: item.costPerItem ? String(item.costPerItem) : "",
      notes: item.notes || "",
      lowThreshold: item.lowThreshold ? String(item.lowThreshold) : "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const data: MaterialItem = {
      id: editing?.id || `mat-${Date.now()}`,
      name: form.name,
      category: form.category,
      subtype: form.subtype,
      quantity: parseInt(form.quantity) || 0,
      costPerItem: form.costPerItem ? parseFloat(form.costPerItem) : undefined,
      notes: form.notes || undefined,
      lowThreshold: form.lowThreshold ? parseInt(form.lowThreshold) : undefined,
      createdAt: editing?.createdAt || new Date().toISOString(),
    };

    const next = editing ? items.map(i => i.id === editing.id ? data : i) : [...items, data];
    await saveList(next);
    setModalOpen(false);
  };

  const printOrSave = (download = false) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Materials Inventory", 20, 20);
    let y = 35;
    doc.setFontSize(11);
    items.forEach((i) => {
      const cost = i.costPerItem ? `$${i.costPerItem.toFixed(2)}` : "-";
      doc.text(`${i.name} | ${i.category} | ${i.subtype || "-"} | Qty: ${i.quantity} | ${cost}`, 20, y);
      y += 7;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    if (download) doc.save("materials-inventory.pdf"); else window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <Card className="p-6 bg-gradient-card border-border">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground">Materials Inventory</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printOrSave(false)}><Printer className="h-4 w-4 mr-2" />Print</Button>
          <Button variant="outline" onClick={() => printOrSave(true)}><Save className="h-4 w-4 mr-2" />Save PDF</Button>
          <Button onClick={openAdd} className="bg-gradient-hero"><Plus className="h-4 w-4 mr-2" />Add Item</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead className="hidden md:table-cell">Subtype/Size</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead className="hidden md:table-cell">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(i => (
            <TableRow key={i.id} className="cursor-pointer" onClick={() => openEdit(i)}>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell className="hidden md:table-cell">{i.category}</TableCell>
              <TableCell className="hidden md:table-cell">{i.subtype || "-"}</TableCell>
              <TableCell>{i.quantity}</TableCell>
              <TableCell className="hidden md:table-cell">{i.costPerItem ? `$${i.costPerItem.toFixed(2)}` : "-"}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No materials added yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Material" : "Add Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Item Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Microfiber Rags" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option>Rag</option>
                <option>Brush</option>
                <option>Tool</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Subtype / Size</Label>
              <Input value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value })} placeholder="e.g., Microfiber - Large" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Cost per Item</Label>
                <Input type="number" step="0.01" value={form.costPerItem} onChange={(e) => setForm({ ...form, costPerItem: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
            <div className="space-y-1">
              <Label>Low Inventory Threshold</Label>
              <Input type="number" value={form.lowThreshold} onChange={(e) => setForm({ ...form, lowThreshold: e.target.value })} placeholder="Alert when below this quantity" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="bg-gradient-hero">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

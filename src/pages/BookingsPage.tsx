import React, { useState, useMemo, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  addHours
} from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, User, Car, Search, X } from "lucide-react";
import { useBookingsStore, type Booking } from "@/store/bookings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";

// --- Types ---
type ViewMode = "month" | "list";

// --- Components ---

export default function BookingsPage() {
  const { items, add, update, remove, refresh } = useBookingsStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer: "",
    service: "",
    vehicle: "",
    time: "09:00",
    notes: ""
  });

  // Refresh data on mount and focus
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Calendar Grid Generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Filter bookings for the current view
  const monthBookings = useMemo(() => {
    return items.filter(b => {
      const d = parseISO(b.date);
      return isSameMonth(d, currentDate);
    });
  }, [items, currentDate]);

  const getBookingsForDay = (day: Date) => {
    return items.filter(b => isSameDay(parseISO(b.date), day)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Handlers
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setFormData(prev => ({ ...prev, time: "09:00" })); // Reset time default
    setIsAddModalOpen(true);
  };

  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    setFormData({
      customer: booking.customer,
      service: booking.title,
      vehicle: booking.vehicle || "",
      time: format(parseISO(booking.date), "HH:mm"),
      notes: booking.notes || ""
    });
    setIsAddModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.customer || !formData.service) {
      toast.error("Customer and Service are required");
      return;
    }

    const dateBase = selectedDate || new Date();
    const [hours, minutes] = formData.time.split(":").map(Number);
    const date = new Date(dateBase);
    date.setHours(hours, minutes, 0, 0);

    if (selectedBooking) {
      // Update
      update(selectedBooking.id, {
        customer: formData.customer,
        title: formData.service,
        date: date.toISOString(),
        vehicle: formData.vehicle,
        notes: formData.notes
      });
      toast.success("Booking updated");
    } else {
      // Create
      add({
        id: `b-${Date.now()}`,
        customer: formData.customer,
        title: formData.service,
        date: date.toISOString(),
        status: "confirmed",
        vehicle: formData.vehicle,
        notes: formData.notes,
        createdAt: new Date().toISOString()
      });
      toast.success("Booking created");
    }
    setIsAddModalOpen(false);
    setSelectedBooking(null);
    setFormData({ customer: "", service: "", vehicle: "", time: "09:00", notes: "" });
  };

  const handleDelete = () => {
    if (selectedBooking) {
      if (confirm("Are you sure you want to delete this booking?")) {
        remove(selectedBooking.id);
        toast.success("Booking deleted");
        setIsAddModalOpen(false);
        setSelectedBooking(null);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'confirmed': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'in_progress': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'done': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Booking Calendar</h1>
          <p className="text-muted-foreground">Manage appointments and schedule services</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleToday}>Today</Button>
          <div className="flex items-center bg-secondary/50 rounded-md border border-border">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="w-32 text-center font-semibold">{format(currentDate, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => { setSelectedDate(new Date()); setIsAddModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Booking
          </Button>
        </div>
      </div>

      <Card className="p-1 bg-zinc-950/50 border-zinc-800 shadow-2xl overflow-hidden rounded-xl">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 mb-1 text-center py-2 bg-zinc-900/50 rounded-t-lg border-b border-zinc-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{day}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-fr gap-px bg-zinc-800">
          {calendarDays.map((day, dayIdx) => {
            const bookings = getBookingsForDay(day);
            const isSelectedMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[140px] bg-zinc-950 p-2 relative group transition-colors hover:bg-zinc-900/80 cursor-pointer flex flex-col gap-1",
                  !isSelectedMonth && "bg-zinc-950/30 text-muted-foreground/40"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isTodayDate ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {bookings.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">{bookings.length}</span>
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                  {bookings.map(booking => (
                    <div
                      key={booking.id}
                      onClick={(e) => handleBookingClick(e, booking)}
                      className={cn(
                        "text-xs px-2 py-1.5 rounded border truncate transition-all hover:scale-[1.02] shadow-sm",
                        getStatusColor(booking.status)
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-mono opacity-70 text-[10px]">{format(parseISO(booking.date), "HH:mm")}</span>
                        <span className="font-semibold truncate">{booking.customer}</span>
                      </div>
                      <div className="truncate opacity-80 text-[10px]">{booking.title}</div>
                    </div>
                  ))}
                </div>

                {/* Hover Add Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                  <Plus className="h-8 w-8 text-zinc-700/50" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => { if (!open) setSelectedBooking(null); setIsAddModalOpen(open); }}>
        <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {selectedBooking ? 'Edit Booking' : 'New Booking'}
              <Badge variant="outline" className="ml-2 font-normal text-xs">
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : format(new Date(), "MMMM d, yyyy")}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium text-muted-foreground">Time</label>
              <div className="col-span-3 relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  className="pl-9 bg-zinc-900 border-zinc-800"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium text-muted-foreground">Customer</label>
              <div className="col-span-3 relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <CustomerSearchField
                  value={formData.customer}
                  onChange={(val) => setFormData({ ...formData, customer: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium text-muted-foreground">Service</label>
              <div className="col-span-3 relative">
                <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Full Detail, Ceramic Coating"
                  className="pl-9 bg-zinc-900 border-zinc-800"
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium text-muted-foreground">Vehicle</label>
              <div className="col-span-3 relative">
                <Car className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. 2023 Tesla Model Y"
                  className="pl-9 bg-zinc-900 border-zinc-800"
                  value={formData.vehicle}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <label className="text-right text-sm font-medium text-muted-foreground mt-2">Notes</label>
              <div className="col-span-3">
                <textarea
                  className="flex w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between gap-2">
            {selectedBooking ? (
              <Button variant="destructive" onClick={handleDelete} className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-900">
                Delete Booking
              </Button>
            ) : <div></div>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">Save Booking</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Helper Components ---

function CustomerSearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value);
  const [options, setOptions] = useState<any[]>([]);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const search = async () => {
      if (!query || query.length < 2) { setOptions([]); return; }
      try {
        const res = await api(`/api/customers/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
        if (Array.isArray(res)) setOptions(res);
      } catch { setOptions([]); }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <Input
        className="pl-9 bg-zinc-900 border-zinc-800"
        placeholder="Search or enter name..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setShowOptions(true); }}
        onFocus={() => setShowOptions(true)}
        onBlur={() => setTimeout(() => setShowOptions(false), 200)}
      />
      {showOptions && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 shadow-lg max-h-48 overflow-auto">
          {options.map((c) => (
            <div
              key={c.id}
              className="px-3 py-2 text-sm hover:bg-zinc-900 cursor-pointer flex flex-col"
              onMouseDown={() => { onChange(c.name); setQuery(c.name); setShowOptions(false); }}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

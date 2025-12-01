import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, AlertCircle, ArrowLeft, Car, Edit, Trash2, History, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import vehicleDatabase from "@/data/vehicle_db.json";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { savePDFToArchive } from "@/lib/pdfArchive";
import { getCustomers } from "@/lib/db";

type ClassificationType = "Compact" | "Midsize / Sedan" | "SUV / Crossover" | "Truck / Oversized" | "Oversized Specialty";

const CLASSIFICATION_OPTIONS: ClassificationType[] = [
    "Compact",
    "Midsize / Sedan",
    "SUV / Crossover",
    "Truck / Oversized",
    "Oversized Specialty"
];

interface SavedClassification {
    id: string;
    make: string;
    model: string;
    classification: string;
    customer_name?: string;
    customer_id?: string;
    timestamp: string;
}

interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
}

export default function VehicleClassification() {
    const { toast } = useToast();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [selectedMake, setSelectedMake] = useState<string>("");
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [classification, setClassification] = useState<string>("");
    const [overrideModalOpen, setOverrideModalOpen] = useState(false);
    const [makeSearchQuery, setMakeSearchQuery] = useState("");
    const [history, setHistory] = useState<SavedClassification[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");

    // Load history from localStorage on mount
    useEffect(() => {
        loadHistory();
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        const custs = await getCustomers<Customer>();
        setCustomers(custs);
    };

    const loadHistory = () => {
        try {
            const stored = localStorage.getItem("vehicle_classification_history");
            if (stored) {
                setHistory(JSON.parse(stored));
            }
        } catch (error) {
            console.error("Failed to load history:", error);
        }
    };

    // Get all makes from the database
    const allMakes = useMemo(() => {
        return Object.keys(vehicleDatabase).sort();
    }, []);

    // Filter makes based on search
    const filteredMakes = useMemo(() => {
        if (!makeSearchQuery.trim()) return allMakes;
        const query = makeSearchQuery.toLowerCase();
        return allMakes.filter(make => make.toLowerCase().includes(query));
    }, [allMakes, makeSearchQuery]);

    // Get models for selected make
    const availableModels = useMemo(() => {
        if (!selectedMake) return [];
        const models = vehicleDatabase[selectedMake as keyof typeof vehicleDatabase];
        return Object.keys(models || {}).sort();
    }, [selectedMake]);

    const handleMakeSelect = (make: string) => {
        setSelectedMake(make);
        setSelectedModel("");
        setMakeSearchQuery("");
        setStep(2);
    };

    const handleModelSelect = (model: string) => {
        setSelectedModel(model);

        // Determine classification
        const vehicleData = vehicleDatabase[selectedMake as keyof typeof vehicleDatabase];
        const autoClassification = vehicleData?.[model as keyof typeof vehicleData] || "Manual Classification Required";

        setClassification(autoClassification as string);
        setStep(3);
    };

    const handleConfirm = () => {
        saveToLocalStorage();
        setStep(4);
    };

    const handleOverride = (newClassification: string) => {
        setClassification(newClassification);
        setOverrideModalOpen(false);
        toast({
            title: "Classification Updated",
            description: `Changed to: ${newClassification}`
        });
    };

    const saveToLocalStorage = () => {
        const customer = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : null;
        const data: SavedClassification = {
            id: editingId || Date.now().toString(),
            make: selectedMake,
            model: selectedModel,
            classification: classification,
            customer_id: selectedCustomer || undefined,
            customer_name: customer?.name || undefined,
            timestamp: new Date().toISOString()
        };

        // Update history
        let updatedHistory: SavedClassification[];
        if (editingId) {
            // Update existing entry
            updatedHistory = history.map(item => item.id === editingId ? data : item);
        } else {
            // Add new entry
            updatedHistory = [data, ...history];
        }

        setHistory(updatedHistory);
        localStorage.setItem("vehicle_classification_history", JSON.stringify(updatedHistory));
        localStorage.setItem("vehicle_classification", JSON.stringify(data));

        toast({
            title: editingId ? "Classification Updated" : "Classification Saved",
            description: "Vehicle classification stored locally."
        });

        setEditingId(null);
    };

    const handleEdit = (item: SavedClassification) => {
        setEditingId(item.id);
        setSelectedMake(item.make);
        setSelectedModel(item.model);
        setClassification(item.classification);
        setStep(2);
    };

    const handleDelete = (id: string) => {
        if (!confirm("Are you sure you want to delete this classification?")) return;

        const updatedHistory = history.filter(item => item.id !== id);
        setHistory(updatedHistory);
        localStorage.setItem("vehicle_classification_history", JSON.stringify(updatedHistory));

        toast({
            title: "Classification Deleted",
            description: "Vehicle removed from history."
        });
    };

    const handleReset = () => {
        setStep(1);
        setSelectedMake("");
        setSelectedModel("");
        setClassification("");
        setMakeSearchQuery("");
        setSelectedCustomer("");
        setEditingId(null);
    };

    const handleExportPDF = () => {
        if (history.length === 0) {
            toast({ title: "No Data", description: "No vehicle classifications to export.", variant: "destructive" });
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Vehicle Classification History", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        const tableData = history.map((item) => [
            item.make,
            item.model,
            item.classification,
            item.customer_name || "-",
            new Date(item.timestamp).toLocaleDateString()
        ]);

        autoTable(doc, {
            startY: 35,
            head: [["Make", "Model", "Classification", "Customer", "Date"]],
            body: tableData,
        });

        const pdfBlob = doc.output("blob");
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const fileName = `vehicle-classification-${Date.now()}.pdf`;
            savePDFToArchive("Vehicle History", "Admin Export", "export", base64data, { fileName });
            toast({ title: "Export Successful", description: `Saved to File Manager as ${fileName}` });
        };
    };

    const getClassificationColor = (classif: string) => {
        switch (classif) {
            case "Compact": return "text-green-500";
            case "Midsize / Sedan": return "text-blue-500";
            case "SUV / Crossover": return "text-purple-500";
            case "Truck / Oversized": return "text-orange-500";
            case "Oversized Specialty": return "text-red-500";
            default: return "text-yellow-500";
        }
    };

    return (
        <div>
            <PageHeader title="Vehicle Classification" />
            <div className="p-4 max-w-4xl mx-auto">

                {/* Step 1: Select Make */}
                {step === 1 && (
                    <Card className="p-8 bg-zinc-900 border-zinc-800">
                        <div className="flex items-center gap-3 mb-6">
                            <Car className="w-8 h-8 text-blue-500" />
                            <h2 className="text-2xl font-bold text-white">Step 1: Select Vehicle Make</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-zinc-400 mb-2 block">Search Make</label>
                                <Input
                                    placeholder="Type to search makes..."
                                    value={makeSearchQuery}
                                    onChange={(e) => setMakeSearchQuery(e.target.value)}
                                    className="bg-zinc-800 border-zinc-700 text-white mb-4"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-zinc-400 mb-2 block">Select Make</label>
                                <Select value={selectedMake} onValueChange={handleMakeSelect}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                        <SelectValue placeholder="Choose a vehicle make..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[300px]">
                                        {filteredMakes.length === 0 ? (
                                            <div className="p-4 text-center text-zinc-500">No makes found</div>
                                        ) : (
                                            filteredMakes.map((make) => (
                                                <SelectItem key={make} value={make} className="text-white">
                                                    {make}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="text-sm text-zinc-500 mt-4">
                                {allMakes.length} makes available in database
                            </div>
                        </div>
                    </Card>
                )}

                {/* Classification History - Only show on Step 1 */}
                {step === 1 && history.length > 0 && (
                    <Card className="p-6 bg-zinc-900 border-zinc-800 mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <History className="w-6 h-6 text-purple-500" />
                                <h3 className="text-xl font-bold text-white">Classification History</h3>
                                <span className="text-sm text-zinc-500">({history.length} {history.length === 1 ? 'vehicle' : 'vehicles'})</span>
                            </div>
                            <Button onClick={handleExportPDF} className="bg-purple-600 hover:bg-purple-700 text-white">
                                <FileDown className="mr-2 h-4 w-4" /> Save PDF
                            </Button>
                        </div>

                        <Accordion type="single" collapsible className="space-y-2">
                            {history.map((item) => (
                                <AccordionItem key={item.id} value={item.id} className="border border-zinc-800 rounded-lg bg-zinc-800/50">
                                    <AccordionTrigger className="px-4 hover:no-underline hover:bg-zinc-800/80">
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex items-center gap-3">
                                                <Car className="w-5 h-5 text-blue-400" />
                                                <span className="font-semibold text-white">{item.make} {item.model}</span>
                                            </div>
                                            <div className={`text-sm font-medium ${getClassificationColor(item.classification)}`}>
                                                {item.classification}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <div className="space-y-3 pt-2">
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <div className="text-zinc-500">Make</div>
                                                    <div className="text-white font-medium">{item.make}</div>
                                                </div>
                                                <div>
                                                    <div className="text-zinc-500">Model</div>
                                                    <div className="text-white font-medium">{item.model}</div>
                                                </div>
                                                <div>
                                                    <div className="text-zinc-500">Classification</div>
                                                    <div className={`font-medium ${getClassificationColor(item.classification)}`}>
                                                        {item.classification}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-zinc-500">Date</div>
                                                    <div className="text-white font-medium">
                                                        {new Date(item.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-2 border-t border-zinc-700">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(item)}
                                                    className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                                                >
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDelete(item.id)}
                                                    className="flex-1 border-red-700 text-red-500 hover:bg-red-900/20"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </Card>
                )}

                {/* Step 2: Select Model */}
                {step === 2 && (
                    <Card className="p-8 bg-zinc-900 border-zinc-800">
                        <div className="flex items-center gap-3 mb-6">
                            <Car className="w-8 h-8 text-blue-500" />
                            <h2 className="text-2xl font-bold text-white">Step 2: Select Vehicle Model</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
                                <div className="text-sm text-zinc-400">Selected Make</div>
                                <div className="text-xl font-semibold text-white">{selectedMake}</div>
                            </div>

                            <div>
                                <label className="text-sm text-zinc-400 mb-2 block">Select Model</label>
                                <Select value={selectedModel} onValueChange={handleModelSelect}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                        <SelectValue placeholder="Choose a model..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 border-zinc-700 max-h-[300px]">
                                        {availableModels.map((model) => (
                                            <SelectItem key={model} value={model} className="text-white">
                                                {model}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="text-sm text-zinc-500 mt-4">
                                {availableModels.length} models available for {selectedMake}
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => setStep(1)}
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Make Selection
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Step 3: Result & Confirmation */}
                {step === 3 && (
                    <Card className="p-8 bg-zinc-900 border-zinc-800">
                        <div className="flex items-center gap-3 mb-6">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                            <h2 className="text-2xl font-bold text-white">Step 3: Classification Result</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-zinc-800 p-6 rounded-lg border border-zinc-700">
                                <div className="text-sm text-zinc-400 mb-2">Vehicle Selected</div>
                                <div className="text-2xl font-bold text-white mb-4">
                                    {selectedMake} {selectedModel}
                                </div>

                                <div className="border-t border-zinc-700 pt-4 mt-4">
                                    <div className="text-sm text-zinc-400 mb-2">System Classification</div>
                                    <div className={`text-3xl font-bold ${getClassificationColor(classification)}`}>
                                        {classification}
                                    </div>
                                </div>

                                {classification === "Manual Classification Required" && (
                                    <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg flex items-start gap-2">
                                        <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                                        <div className="text-sm text-yellow-200">
                                            This vehicle was not found in our database. Please select a classification manually.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Customer Field (Optional) */}
                            <div>
                                <label className="text-sm text-zinc-400 mb-2 block">Link to Customer (Optional)</label>
                                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                        <SelectValue placeholder="Select a customer (optional)..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 border-zinc-700">
                                        <SelectItem value="" className="text-white">None</SelectItem>
                                        {customers.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-white">
                                                {c.name} {c.email && `(${c.email})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedCustomer && (
                                    <div className="mt-2 text-xs text-zinc-500">
                                        This classification will be linked to the selected customer
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={handleConfirm}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Classification
                                </Button>
                                <Button
                                    onClick={() => setOverrideModalOpen(true)}
                                    variant="outline"
                                    className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                >
                                    Override Classification
                                </Button>
                            </div>

                            <Button
                                variant="ghost"
                                onClick={() => setStep(2)}
                                className="text-zinc-400 hover:text-white"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Model Selection
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Step 4: Saved Confirmation */}
                {step === 4 && (
                    <Card className="p-8 bg-zinc-900 border-zinc-800">
                        <div className="flex items-center gap-3 mb-6">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                            <h2 className="text-2xl font-bold text-white">Vehicle Classification Saved</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-green-900/20 border border-green-700 p-6 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <div className="text-sm text-zinc-400">Make</div>
                                        <div className="text-lg font-semibold text-white">{selectedMake}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-zinc-400">Model</div>
                                        <div className="text-lg font-semibold text-white">{selectedModel}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-zinc-400">Classification</div>
                                        <div className={`text-lg font-semibold ${getClassificationColor(classification)}`}>
                                            {classification}
                                        </div>
                                    </div>
                                </div>
                                {selectedCustomer && (
                                    <div className="mt-4 pt-4 border-t border-green-700">
                                        <div className="text-sm text-zinc-400">Linked Customer</div>
                                        <div className="text-lg font-semibold text-white">
                                            {customers.find(c => c.id === selectedCustomer)?.name}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
                                <div className="text-sm text-zinc-400 mb-2">Storage Location</div>
                                <div className="text-white font-mono text-sm">localStorage: vehicle_classification_history</div>
                            </div>

                            <div className="text-xs text-zinc-500 italic p-3 bg-zinc-800/50 rounded border border-zinc-700">
                                Future: Auto-send classification to Package Pricing module.
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    onClick={handleReset}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Classify Another Vehicle
                                </Button>
                                <Button
                                    onClick={() => window.location.href = "/dashboard"}
                                    variant="outline"
                                    className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                >
                                    Back to Client Intake Tools
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Override Classification Modal */}
                <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
                    <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                        <DialogHeader>
                            <DialogTitle>Manual Classification Override</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-400">
                                Select the correct classification for {selectedMake} {selectedModel}:
                            </p>
                            {CLASSIFICATION_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    onClick={() => handleOverride(option)}
                                    variant="outline"
                                    className={`w-full justify-start border-zinc-700 hover:bg-zinc-800 ${classification === option ? 'bg-zinc-800 border-blue-500' : ''
                                        }`}
                                >
                                    <span className={getClassificationColor(option)}>{option}</span>
                                </Button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

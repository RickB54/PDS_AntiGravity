import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const FAQ = () => {
  const faqs = [
    {
      question: "How often should I detail my vehicle?",
      answer: "We recommend 2–5 times per year, based on usage, storage, and washing habits. Regular detailing preserves paint and boosts resale value."
    },
    {
      question: "What prep is needed before my appointment?",
      answer: "Empty compartments and cargo areas. Inform us of any 'do not clean' zones. We'll bag loose items for you."
    },
    {
      question: "How long does each package take?",
      answer: "• Basic/Interior/Exterior Only: 2 hours\n• Express/Full Detail: 2.5–3 hours\n• Premium: 3–3.5 hours\n(Varies by vehicle condition)"
    },
    {
      question: "What are your hours?",
      answer: "Appointments daily 8 AM–6 PM. Same/next-day available (not guaranteed)."
    },
    {
      question: "Can you detail in bad weather?",
      answer: "No rain/snow. Garage access allows us to proceed."
    },
    {
      question: "Do you need water/power?",
      answer: "Yes — on-site pricing includes utility use."
    },
    {
      question: "What payment methods do you accept?",
      answer: "Cash, Credit/Debit, Venmo, Zelle. Invoices sent post-service."
    },
    {
      question: "Is there a warranty?",
      answer: "48-hour satisfaction guarantee. Re-service free if needed."
    },
    {
      question: "Do you offer fleet/commercial pricing?",
      answer: "Yes — contact for custom quotes."
    },
    {
      question: "Are your products safe?",
      answer: "Eco-friendly, pH-balanced. Safe for paint, leather, and pets."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Link>
        </Button>

        <div className="space-y-6 animate-fade-in">
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-4xl font-bold text-foreground">Frequently Asked Questions</h1>
            <p className="text-muted-foreground text-lg">Everything you need to know about our services</p>
          </div>

          <Card className="p-6 bg-gradient-card border-border">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-lg font-semibold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground whitespace-pre-line">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          <div className="text-center pt-6">
            <p className="text-muted-foreground mb-4">Still have questions?</p>
            <Button asChild className="bg-gradient-hero">
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FAQ;

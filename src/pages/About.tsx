import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-3inch.png";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Video Background */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="https://cdn.pixabay.com/video/2019/10/08/27833-365006009_large.mp4" type="video/mp4" />
        </video>
        <div className="relative z-20 text-center text-white px-4">
          <img src={logo} alt="Prime Detail Solutions" className="w-24 h-24 mx-auto mb-6" />
          <h1 className="text-5xl md:text-6xl font-bold mb-4">About Prime Detail Solutions</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            Your trusted partner in premium auto care
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="space-y-16">
          {/* Mission Statement */}
          <Card className="p-8 md:p-12 bg-gradient-card border-border">
            <h2 className="text-3xl font-bold text-center mb-6 text-foreground">Welcome to Prime Detail Solutions</h2>
            <p className="text-lg text-muted-foreground text-center max-w-4xl mx-auto leading-relaxed mb-8">
              Your trusted partner in premium auto care in <strong>Methuen, MA</strong>. We specialize in high-quality 
              interior and exterior detailing, paint correction, ceramic coatings, and mobile services. 
              With transparent pricing and expert craftsmanship, we deliver showroom results at our optimized detailing facility.
            </p>
            <div className="text-center">
              <a 
                href="https://prime-detail-solutions.netlify.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                prime-detail-solutions.netlify.app
              </a>
            </div>
          </Card>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 bg-gradient-card border-border hover:shadow-glow transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-primary/20 rounded-full mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Expert Team</h3>
                <p className="text-muted-foreground">
                  Highly trained professionals with years of experience in premium auto detailing
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card border-border hover:shadow-glow transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-primary/20 rounded-full mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Eco-Friendly Products</h3>
                <p className="text-muted-foreground">
                  We use only premium, environmentally safe products that protect your vehicle and our planet
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card border-border hover:shadow-glow transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-primary/20 rounded-full mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">100% Satisfaction Guarantee</h3>
                <p className="text-muted-foreground">
                  Your satisfaction is our priority. We stand behind every service we provide
                </p>
              </div>
            </Card>
          </div>

          {/* Testimonials */}
          <section>
            <h2 className="text-3xl font-bold text-center mb-8 text-foreground">What Our Customers Say</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-gradient-card border-border">
                <p className="text-muted-foreground italic mb-4">
                  "Prime Detail Solutions transformed my car! The attention to detail is incredible. 
                  My Tesla looks brand new again. Highly recommend!"
                </p>
                <p className="font-semibold text-foreground">— Michael R.</p>
              </Card>

              <Card className="p-6 bg-gradient-card border-border">
                <p className="text-muted-foreground italic mb-4">
                  "Professional, friendly, and affordable. The ceramic coating has kept my BMW looking 
                  pristine for months. Best detailing service in Methuen!"
                </p>
                <p className="font-semibold text-foreground">— Sarah K.</p>
              </Card>

              <Card className="p-6 bg-gradient-card border-border">
                <p className="text-muted-foreground italic mb-4">
                  "I love their mobile service! They came to my office and detailed my truck while I worked. 
                  Convenient and exceptional results."
                </p>
                <p className="font-semibold text-foreground">— James D.</p>
              </Card>

              <Card className="p-6 bg-gradient-card border-border">
                <p className="text-muted-foreground italic mb-4">
                  "The interior cleaning was amazing. They removed pet hair and odors I thought were 
                  permanent. My SUV smells and looks fantastic!"
                </p>
                <p className="font-semibold text-foreground">— Lisa M.</p>
              </Card>
            </div>
          </section>

          {/* CTA */}
          <Card className="p-12 bg-gradient-hero border-border text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Vehicle?</h2>
            <p className="text-white/90 mb-6 text-lg">
              Book your detailing service today and experience the Prime Detail difference
            </p>
            <Link to="/">
              <Button size="lg" variant="secondary" className="group">
                Book Now
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </Card>

          {/* Footer */}
          <div className="text-center text-muted-foreground text-sm">
            <p>© {new Date().getFullYear()} Prime Detail Solutions. All rights reserved.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;

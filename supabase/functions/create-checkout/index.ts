// supabase/functions/create-checkout/index.ts

import Stripe from "https://esm.sh/stripe@13.5.0?target=deno";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Load Stripe secret from Supabase environment variables
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecret) {
  console.error("❌ STRIPE_SECRET_KEY is NOT set in Supabase!");
}

const stripe = new Stripe(stripeSecret!, {
  apiVersion: "2023-10-16",
});

// Use SITE_URL env (if provided) otherwise default to local dev port 6061
const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:6061";

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const customerEmail: string | undefined = body.customerEmail || undefined;
    const priceId: string | undefined = body.priceId || undefined;
    // Subscriptions are not used; force payment mode
    const mode: "payment" = "payment";

    const PRICE_ID = priceId || "price_1SUqfeAx5DEMIPk4YbyLjL6L"; // fallback

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode,
      customer_email: customerEmail,
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment-success`,
      cancel_url: `${siteUrl}/payment-canceled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Checkout error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
    });
  }
});

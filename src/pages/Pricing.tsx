import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for trying out Yarn",
      features: [
        "Up to 3 meetings per month",
        "30 minutes per meeting",
        "Basic transcription",
        "AI summaries",
        "Up to 5 participants",
      ],
      cta: "Get Started",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$12",
      period: "per user/month",
      description: "For teams who meet regularly",
      features: [
        "Unlimited meetings",
        "Unlimited duration",
        "Advanced transcription",
        "AI analysis & insights",
        "Up to 50 participants",
        "Meeting history",
        "Export transcripts",
        "Priority support",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "contact us",
      description: "For large organizations",
      features: [
        "Everything in Pro",
        "Unlimited participants",
        "Custom AI training",
        "Advanced analytics",
        "SSO & security",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-yarn flex flex-col">
      <Header />
      
      <main className="flex-1 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-yarn-dark mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-yarn-text max-w-3xl mx-auto">
              Choose the plan that works best for you. All plans include our AI assistant Olio.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-white rounded-2xl shadow-lg p-8 ${
                  plan.highlighted
                    ? "border-4 border-indigo-600 relative transform scale-105"
                    : "border border-gray-200"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-yarn-dark mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-extrabold text-yarn-dark">{plan.price}</span>
                    {plan.price !== "Custom" && <span className="text-gray-500 ml-1">/{plan.period}</span>}
                  </div>
                  <p className="text-yarn-text text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full py-6 text-lg ${
                    plan.highlighted
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  }`}
                  onClick={() => navigate("/")}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <h2 className="text-3xl font-bold text-yarn-dark mb-8 text-center">
              Frequently Asked Questions
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">Can I change plans later?</h4>
                <p className="text-yarn-text">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">Is there a free trial?</h4>
                <p className="text-yarn-text">
                  Pro plan includes a 14-day free trial. No credit card required to start.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">What payment methods do you accept?</h4>
                <p className="text-yarn-text">
                  We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">Can I cancel anytime?</h4>
                <p className="text-yarn-text">
                  Absolutely. Cancel anytime with no penalties. Your data will be available for 30 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pricing;


import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send to a backend
    toast.success("Message sent! We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const contactMethods = [
    {
      icon: Mail,
      title: "Email Us",
      description: "General inquiries and support",
      contact: "hello@yarn.ai",
      action: "mailto:hello@yarn.ai",
    },
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Available Mon-Fri, 9am-5pm EST",
      contact: "Start Chat",
      action: "#",
    },
    {
      icon: HelpCircle,
      title: "Help Center",
      description: "Browse our knowledge base",
      contact: "Visit Help Center",
      action: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-yarn flex flex-col">
      <Header />
      
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-yarn-dark mb-4">
              Get in Touch
            </h1>
            <p className="text-xl text-yarn-text max-w-3xl mx-auto">
              Have a question or feedback? We'd love to hear from you. 
              Our team typically responds within 24 hours.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mb-16">
            {/* Contact Form */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-yarn-dark mb-6">Send Us a Message</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us more about your inquiry..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="mt-1"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6"
                >
                  Send Message
                </Button>
              </form>
            </div>

            {/* Contact Methods */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-yarn-dark mb-6">Other Ways to Reach Us</h2>
                <div className="space-y-4">
                  {contactMethods.map((method, index) => (
                    <div
                      key={index}
                      className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <method.icon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-yarn-dark mb-1">{method.title}</h3>
                          <p className="text-sm text-yarn-text mb-2">{method.description}</p>
                          <a
                            href={method.action}
                            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                          >
                            {method.contact} →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Office Info */}
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <h2 className="text-3xl font-bold text-yarn-dark mb-8 text-center">
              Common Questions
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">Do you offer demos?</h4>
                <p className="text-yarn-text">
                  Yes! Check out our Demo page or schedule a personalized walkthrough with our team.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">How fast do you respond?</h4>
                <p className="text-yarn-text">
                  We typically respond to all inquiries within 24 hours during business days.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">Can I schedule a call?</h4>
                <p className="text-yarn-text">
                  Absolutely! Mention your preferred time in the message and we'll arrange a call.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-yarn-dark mb-2">Enterprise inquiries?</h4>
                <p className="text-yarn-text">
                  For enterprise plans and custom solutions, email enterprise@yarn.ai directly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Contact;


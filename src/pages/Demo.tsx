import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Play, Mic, Brain, Users } from "lucide-react";

const Demo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-yarn flex flex-col">
      <Header />
      
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl font-bold text-yarn-dark mb-4 text-center">
            See Yarn in Action
          </h1>
          <p className="text-xl text-yarn-text text-center mb-12 max-w-3xl mx-auto">
            Experience how Yarn transforms your meetings with AI-powered transcription, 
            intelligent summaries, and real-time collaboration.
          </p>

          {/* Demo Video Section */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-16">
            <div className="aspect-video bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-indigo-700 transition-colors">
                  <Play className="w-10 h-10 text-white ml-1" />
                </div>
                <p className="text-gray-700 font-medium">Watch Demo Video</p>
                <p className="text-gray-500 text-sm">2 minutes</p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Mic className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-yarn-dark mb-3">Live Transcription</h3>
              <p className="text-yarn-text">
                Real-time speech-to-text conversion captures every word spoken during your meeting.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-yarn-dark mb-3">AI Analysis</h3>
              <p className="text-yarn-text">
                Olio, our AI assistant, automatically summarizes discussions and identifies action items.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-yarn-dark mb-3">Seamless Collaboration</h3>
              <p className="text-yarn-text">
                Video calls with built-in chat and participant management for smooth teamwork.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-yarn-dark mb-4">
              Ready to Try It Yourself?
            </h2>
            <p className="text-yarn-text mb-8 max-w-2xl mx-auto">
              Start your first meeting with Yarn today and experience the future of intelligent collaboration.
            </p>
            <Button 
              size="lg"
              className="bg-yarn-dark text-white hover:bg-yarn-dark/90 px-8 py-6 text-lg"
              onClick={() => navigate("/")}
            >
              Get Started Free
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Demo;


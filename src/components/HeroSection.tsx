import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import meetingIllustration from "@/assets/meeting-illustration.png";
import JoinYarnDialog from "./JoinYarnDialog";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

const HeroSection = () => {
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for current user
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting session:', error);
        setUser(null);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCreateYarn = () => {
    if (!user) {
      toast.error("Please sign in to create a meeting");
      return;
    }
    // Generate a 6-character uppercase room code
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    navigate(`/meeting/${roomId}`);
  };

  const handleJoinYarn = () => {
    if (!user) {
      toast.error("Please sign in to join a meeting");
      return;
    }
    setShowJoinDialog(true);
  };

  return (
    <section className="flex-1 flex items-center justify-between px-6 py-12">
      <div className="flex-1 max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-bold text-yarn-dark mb-6 leading-tight">
          Meetings with a memory-<br />
          And a <span className="font-black">Brain</span>
        </h1>
        
        <p className="text-lg text-yarn-text mb-8 max-w-xl leading-relaxed">
          An AI-powered meeting platform that transcribes, summarizes, and remembers, 
          for your everyday meets.
        </p>
        
        {!user && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg inline-block">
            <p className="text-sm text-amber-800">
              🔒 Please sign in to create or join meetings
            </p>
          </div>
        )}
        
        <div className="flex items-center space-x-4">
          <Button 
            size="lg" 
            className={`px-8 py-3 rounded-full ${
              user 
                ? 'bg-yarn-purple/20 text-yarn-dark border border-yarn-dark hover:bg-yarn-purple/30' 
                : 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
            }`}
            variant="outline"
            onClick={handleCreateYarn}
          >
            Create a yarn
          </Button>
          <Button 
            size="lg" 
            className={`px-8 py-3 rounded-full ${
              user 
                ? 'bg-yarn-blue/20 text-yarn-dark border border-yarn-dark hover:bg-yarn-blue/30' 
                : 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
            }`}
            variant="outline"
            onClick={handleJoinYarn}
          >
            Join a yarn
          </Button>
        </div>
        
        <JoinYarnDialog 
          open={showJoinDialog} 
          onOpenChange={setShowJoinDialog} 
        />
      </div>
      
      <div className="flex-1 flex justify-center items-center">
        <img 
          src={meetingIllustration} 
          alt="Person in a video meeting with multiple participants"
          className="max-w-xl w-full h-auto"
        />
      </div>
    </section>
  );
};

export default HeroSection;
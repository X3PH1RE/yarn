import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import meetingIllustration from "@/assets/meeting-illustration.png";
import JoinYarnDialog from "./JoinYarnDialog";

const HeroSection = () => {
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const navigate = useNavigate();

  const handleCreateYarn = () => {
    // Generate a 6-character uppercase room code
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    navigate(`/meeting/${roomId}`);
  };

  const handleJoinYarn = () => {
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
        
        <div className="flex items-center space-x-4">
          <Button 
            size="lg" 
            className="bg-yarn-purple/20 text-yarn-dark border border-yarn-dark hover:bg-yarn-purple/30 px-8 py-3 rounded-full"
            variant="outline"
            onClick={handleCreateYarn}
          >
            Create a yarn
          </Button>
          <Button 
            size="lg" 
            className="bg-yarn-blue/20 text-yarn-dark border border-yarn-dark hover:bg-yarn-blue/30 px-8 py-3 rounded-full"
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
          className="max-w-md w-full h-auto"
        />
      </div>
    </section>
  );
};

export default HeroSection;
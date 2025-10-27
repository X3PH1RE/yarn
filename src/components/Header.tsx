import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/ChatGPT_Image_Jul_28__2025__10_52_25_PM-removebg-preview.png";
import AuthDialog from "./AuthDialog";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

const Header = () => {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [user, setUser] = useState<User | null>(null);

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

  const handleSignIn = () => {
    setAuthMode("signin");
    setShowAuthDialog(true);
  };

  const handleSignUp = () => {
    setAuthMode("signup");
    setShowAuthDialog(true);
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
    }
  };

  return (
    <>
      <header className="flex items-center justify-between p-6">
        <Link to="/" className="flex items-center space-x-3">
          <img 
            src={logoImage} 
            alt="Yarn Logo" 
            className="h-12 w-auto"
          />
        </Link>
        
        <nav className="hidden md:flex items-center space-x-8">
          <Link to="/demo" className="text-yarn-text hover:text-yarn-dark transition-colors">View Demo</Link>
          <span className="text-yarn-text">|</span>
          <Link to="/pricing" className="text-yarn-text hover:text-yarn-dark transition-colors">Pricing</Link>
          <span className="text-yarn-text">|</span>
          <Link to="/about" className="text-yarn-text hover:text-yarn-dark transition-colors">About</Link>
          <span className="text-yarn-text">|</span>
          <Link to="/contact" className="text-yarn-text hover:text-yarn-dark transition-colors">Contact</Link>
        </nav>
        
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              <span className="text-sm text-yarn-dark">
                👋 {user.user_metadata?.full_name || user.email}
              </span>
              <Button 
                variant="outline" 
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                className="border-yarn-dark text-yarn-dark hover:bg-yarn-dark hover:text-white"
                onClick={handleSignIn}
              >
                Login
              </Button>
              <Button 
                className="bg-yarn-dark text-white hover:bg-yarn-dark/90"
                onClick={handleSignUp}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </header>
      
      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        mode={authMode}
      />
    </>
  );
};

export default Header;
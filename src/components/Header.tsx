import { Button } from "@/components/ui/button";
import logoImage from "@/assets/ChatGPT_Image_Jul_28__2025__10_52_25_PM-removebg-preview.png";

const Header = () => {
  return (
    <header className="flex items-center justify-between p-6">
      <div className="flex items-center space-x-3">
        <img 
          src={logoImage} 
          alt="Yarn Logo" 
          className="h-12 w-auto"
        />
      </div>
      
      <nav className="hidden md:flex items-center space-x-8">
        <a href="#" className="text-yarn-text hover:text-yarn-dark transition-colors">View Demo</a>
        <span className="text-yarn-text">|</span>
        <a href="#" className="text-yarn-text hover:text-yarn-dark transition-colors">Pricing</a>
        <span className="text-yarn-text">|</span>
        <a href="#" className="text-yarn-text hover:text-yarn-dark transition-colors">About</a>
        <span className="text-yarn-text">|</span>
        <a href="#" className="text-yarn-text hover:text-yarn-dark transition-colors">Contact</a>
      </nav>
      
      <div className="flex items-center space-x-3">
        <Button variant="outline" className="border-yarn-dark text-yarn-dark hover:bg-yarn-dark hover:text-white">
          Login
        </Button>
        <Button className="bg-yarn-dark text-white hover:bg-yarn-dark/90">
          Sign up
        </Button>
      </div>
    </header>
  );
};

export default Header;
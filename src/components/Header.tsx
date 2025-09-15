import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="flex items-center justify-between p-6">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-yarn-dark rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <span className="text-2xl font-bold text-yarn-dark">Yarn</span>
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
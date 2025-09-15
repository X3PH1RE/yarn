import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-animated bg-[length:400%_400%] animate-gradient-move flex flex-col">
      <Header />
      <HeroSection />
    </div>
  );
};

export default Index;

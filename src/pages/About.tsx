import Header from "@/components/Header";
import { Target, Users, Zap, Heart } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "We believe meetings should be productive, not painful. Yarn exists to make every conversation count.",
    },
    {
      icon: Users,
      title: "User-Centric",
      description: "Built by people who understand the challenges of remote work and virtual collaboration.",
    },
    {
      icon: Zap,
      title: "Innovation First",
      description: "Leveraging cutting-edge AI to transform how teams communicate and collaborate.",
    },
    {
      icon: Heart,
      title: "Privacy Focused",
      description: "Your conversations are yours. We prioritize data security and user privacy above all.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-yarn flex flex-col">
      <Header />
      
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-yarn-dark mb-6">
              About Yarn
            </h1>
            <p className="text-xl text-yarn-text max-w-3xl mx-auto leading-relaxed">
              We're on a mission to make meetings more meaningful by giving them a memory 
              and a brain. Yarn combines intelligent transcription with AI-powered insights 
              to help teams remember, understand, and act on what matters.
            </p>
          </div>

          {/* Story Section */}
          <div className="bg-white rounded-2xl shadow-lg p-12 mb-16">
            <h2 className="text-3xl font-bold text-yarn-dark mb-6">Our Story</h2>
            <div className="space-y-4 text-yarn-text leading-relaxed">
              <p>
                Yarn was born from a simple observation: despite having more meetings than ever, 
                we're losing track of important conversations, decisions, and action items. 
                Teams were spending hours in meetings but struggling to remember what was discussed 
                or what needed to be done next.
              </p>
              <p>
                We asked ourselves: What if meetings could remember themselves? What if they could 
                understand context, extract insights, and help teams stay aligned without the mental 
                overhead? That's when Olio, our AI meeting assistant, was born.
              </p>
              <p>
                Today, Yarn is helping thousands of teams turn their conversations into action. 
                Every meeting becomes a resource, every discussion becomes searchable, and no 
                important detail slips through the cracks.
              </p>
            </div>
          </div>

          {/* Values Grid */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-yarn-dark mb-8 text-center">
              What We Stand For
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="bg-white p-8 rounded-xl shadow-lg border border-gray-100"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-yarn-dark mb-3">{value.title}</h3>
                  <p className="text-yarn-text">{value.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team Section */}  
        </div>
      </main>
    </div>
  );
};

export default About;


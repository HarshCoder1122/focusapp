import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Coins, 
  Flame, 
  Target, 
  Shield, 
  Trophy,
  ChevronRight,
  Sparkles,
  BookOpen
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Focus Timer",
      description: "Track your study sessions with an anti-cheat smart timer that ensures honest progress."
    },
    {
      icon: <Coins className="w-6 h-6" />,
      title: "Earn Coins",
      description: "Get rewarded for every focused minute. Complete goals and earn bonus coins."
    },
    {
      icon: <Flame className="w-6 h-6" />,
      title: "Build Streaks",
      description: "Maintain daily streaks to earn massive bonuses. 7-day streak = 200 coins!"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Smart Planner",
      description: "Organize your study schedule with subject-wise task tracking."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Anti-Cheat",
      description: "Our system ensures fair rewards by detecting app switches and distractions."
    },
    {
      icon: <Trophy className="w-6 h-6" />,
      title: "Unlock Rewards",
      description: "Reach milestones to unlock badges, certificates, and reward eligibility."
    }
  ];

  const coinTiers = [
    { coins: "1,000", reward: "Bronze Badge", icon: "🥉" },
    { coins: "5,000", reward: "Certificate", icon: "📜" },
    { coins: "10,000", reward: "₹1,000 Value", icon: "🎁" }
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold tracking-tight">RevealIQ</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
                data-testid="nav-login-btn"
              >
                Login
              </Button>
              <Button 
                onClick={() => navigate("/auth")}
                className="btn-primary"
                data-testid="nav-signup-btn"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Free Study Companion
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Study Daily.
                <br />
                <span className="gradient-text">Earn Rewards.</span>
                <br />
                Stay Consistent.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-lg">
                Build discipline, track your progress, and earn coins for every focused minute. 
                The ultimate motivation system for serious students.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="btn-primary text-lg"
                  data-testid="hero-cta-btn"
                >
                  Start Earning Free
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="btn-secondary"
                  onClick={() => document.getElementById("features").scrollIntoView({ behavior: "smooth" })}
                >
                  How It Works
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.pexels.com/photos/9159088/pexels-photo-9159088.jpeg"
                  alt="Student studying with focus"
                  className="w-full h-[400px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                
                {/* Floating Stats Cards */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute bottom-8 left-4 glass rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Today's Coins</p>
                      <p className="text-xl font-bold">+250</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="absolute top-8 right-4 glass rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Streak</p>
                      <p className="text-xl font-bold">14 Days</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to
              <span className="gradient-text"> Stay Motivated</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete study companion designed to help you build lasting habits and earn rewards.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bento-card card-hover"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Coin Earning Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Earn Coins,
                <br />
                <span className="gradient-text">Unlock Rewards</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Every focused minute counts. Complete study sessions, maintain streaks, 
                and hit your daily goals to earn coins and unlock amazing rewards.
              </p>

              <div className="space-y-4">
                {[
                  { label: "25 min focus session", coins: "+20 coins" },
                  { label: "50 min deep focus", coins: "+50 coins" },
                  { label: "Complete daily goal", coins: "+100 coins" },
                  { label: "7-day streak", coins: "+200 coins" },
                  { label: "30-day streak", coins: "+1000 coins" }
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/50"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-accent font-bold">{item.coins}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h3 className="text-2xl font-bold text-center mb-8">Reward Milestones</h3>
              {coinTiers.map((tier, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="bento-card flex items-center gap-6"
                >
                  <div className="text-4xl">{tier.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Reach</p>
                    <p className="text-2xl font-bold text-accent">{tier.coins} Coins</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{tier.reward}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="hero-gradient rounded-3xl p-12 text-center text-white"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Build Better Study Habits?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Join thousands of students who are earning rewards while building discipline. 
              It's completely free to start!
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="bg-white text-primary hover:bg-white/90 rounded-full px-8 py-3 font-bold text-lg"
              data-testid="cta-signup-btn"
            >
              Start Your Journey Now
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              <span className="font-bold">RevealIQ Study Companion</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 RevealIQ. Building better students, one focus session at a time.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

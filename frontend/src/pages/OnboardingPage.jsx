import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, GraduationCap, Clock, ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const OnboardingPage = ({ user, setUser }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    class_level: "",
    subjects: [],
    daily_target_minutes: 120,
    theme: theme
  });

  const classOptions = [
    { value: "8", label: "Class 8" },
    { value: "9", label: "Class 9" },
    { value: "10", label: "Class 10" },
    { value: "11", label: "Class 11" },
    { value: "12", label: "Class 12" },
    { value: "college", label: "College" }
  ];

  const subjectOptions = [
    "Mathematics", "Physics", "Chemistry", "Biology", 
    "English", "History", "Geography", "Computer Science",
    "Economics", "Accounts", "Business Studies", "Hindi",
    "Political Science", "Psychology", "Sociology"
  ];

  const toggleSubject = (subject) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleSubmit = async () => {
    if (formData.subjects.length === 0) {
      toast.error("Please select at least one subject");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/onboarding`, {
        ...formData,
        theme: theme
      });
      
      if (response.data) {
        setUser(response.data);
        toast.success("Profile setup complete!");
        navigate("/dashboard", { state: { user: response.data } });
      }
    } catch (error) {
      toast.error("Failed to save profile");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <GraduationCap className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold">What's your class?</h2>
              <p className="text-muted-foreground">Help us personalize your experience</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {classOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={formData.class_level === option.value ? "default" : "outline"}
                  className={`h-16 text-lg ${formData.class_level === option.value ? "neon-purple" : ""}`}
                  onClick={() => setFormData({ ...formData, class_level: option.value })}
                  data-testid={`class-${option.value}-btn`}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <Button
              className="w-full btn-primary mt-8"
              disabled={!formData.class_level}
              onClick={() => setStep(2)}
              data-testid="next-step-1-btn"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <BookOpen className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold">Select your subjects</h2>
              <p className="text-muted-foreground">Choose subjects you want to track</p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {subjectOptions.map((subject) => (
                <div
                  key={subject}
                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.subjects.includes(subject)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleSubject(subject)}
                  data-testid={`subject-${subject.toLowerCase().replace(/\s+/g, "-")}-btn`}
                >
                  <Checkbox
                    checked={formData.subjects.includes(subject)}
                    onCheckedChange={() => toggleSubject(subject)}
                  />
                  <span className="text-sm font-medium">{subject}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1 btn-primary"
                disabled={formData.subjects.length === 0}
                onClick={() => setStep(3)}
                data-testid="next-step-2-btn"
              >
                Continue
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Clock className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold">Set your daily goal</h2>
              <p className="text-muted-foreground">How many hours do you want to study daily?</p>
            </div>

            <div className="py-8">
              <div className="text-center mb-8">
                <span className="text-6xl font-bold font-mono text-primary">
                  {Math.floor(formData.daily_target_minutes / 60)}
                </span>
                <span className="text-2xl text-muted-foreground ml-2">hours</span>
                {formData.daily_target_minutes % 60 > 0 && (
                  <>
                    <span className="text-4xl font-bold font-mono text-primary ml-4">
                      {formData.daily_target_minutes % 60}
                    </span>
                    <span className="text-xl text-muted-foreground ml-2">min</span>
                  </>
                )}
              </div>
              
              <Slider
                value={[formData.daily_target_minutes]}
                onValueChange={([value]) => setFormData({ ...formData, daily_target_minutes: value })}
                min={30}
                max={480}
                step={30}
                className="w-full"
                data-testid="daily-target-slider"
              />
              
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>30 min</span>
                <span>8 hours</span>
              </div>
            </div>

            {/* Theme Selection */}
            <div className="border border-border rounded-xl p-4">
              <Label className="text-sm font-medium mb-3 block">Preferred Theme</Label>
              <div className="flex gap-4">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => toggleTheme()}
                  data-testid="theme-light-btn"
                >
                  <Sun className="w-4 h-4 mr-2" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => theme !== "dark" && toggleTheme()}
                  data-testid="theme-dark-btn"
                >
                  <Moon className="w-4 h-4 mr-2" />
                  Dark
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1 btn-primary"
                onClick={handleSubmit}
                disabled={isLoading}
                data-testid="complete-onboarding-btn"
              >
                {isLoading ? "Saving..." : "Start Learning"}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/50" : "w-4 bg-border"
              }`}
            />
          ))}
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            {renderStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingPage;

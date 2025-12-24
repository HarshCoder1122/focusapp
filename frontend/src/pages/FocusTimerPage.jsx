import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { API } from "@/App";
import BottomNav from "@/components/BottomNav";
import ProgressRing from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Play,
    Pause,
    Square,
    Coins,
    AlertTriangle,
    Trophy,
    Flame,
    CheckCircle2,
    RotateCcw,
    ArrowLeft,
    Bell,
    Sparkles
} from "lucide-react";
import {
    getRandomQuote,
    getNextCheckInterval,
    playNotificationSound,
    triggerVibration,
    getCoinPenaltyMultiplier,
    VERIFICATION_TIMEOUT_MS
} from "@/utils/focusVerification";

const DURATIONS = [
    { label: "25 min", value: 25, coins: 20 },
    { label: "50 min", value: 50, coins: 50 },
    { label: "90 min", value: 90, coins: 100 },
];

const FocusTimerPage = ({ user }) => {
    const navigate = useNavigate();

    // Timer state
    const [selectedDuration, setSelectedDuration] = useState(25);
    const [subject, setSubject] = useState(user?.subjects?.[0] || "General");
    const [subjectType, setSubjectType] = useState("Standard"); // "Standard" or "Custom"
    const [timeRemaining, setTimeRemaining] = useState(25 * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Anti-cheat state
    const [interruptions, setInterruptions] = useState(0);
    const [focusScore, setFocusScore] = useState(100);
    const [wasInterrupted, setWasInterrupted] = useState(false);

    // Focus verification state
    const [showVerification, setShowVerification] = useState(false);
    const [currentQuote, setCurrentQuote] = useState(null);
    const [missedChecks, setMissedChecks] = useState(0);
    const [checkCount, setCheckCount] = useState(0);
    const [verificationTimeLeft, setVerificationTimeLeft] = useState(30);

    // Session result
    const [showResult, setShowResult] = useState(false);
    const [sessionResult, setSessionResult] = useState(null);

    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const verificationTimerRef = useRef(null);
    const verificationTimeoutRef = useRef(null);

    // Calculate predicted coins with verification penalty
    const getPredictedCoins = useCallback(() => {
        const durationInfo = DURATIONS.find(d => d.value === selectedDuration);
        if (!durationInfo) return 0;

        const baseCoins = durationInfo.coins;
        const multiplier = 0.5 + (focusScore / 100);
        let coins = Math.round(baseCoins * multiplier);

        if (wasInterrupted) {
            coins = Math.round(coins * 0.7);
        }

        // Apply verification penalty
        coins = Math.round(coins * getCoinPenaltyMultiplier(missedChecks));

        return Math.max(0, coins);
    }, [selectedDuration, focusScore, wasInterrupted, missedChecks]);

    // Anti-cheat: Track visibility changes
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (isRunning && !isPaused && document.hidden) {
                setInterruptions(prev => prev + 1);
                setWasInterrupted(true);
                setFocusScore(prev => Math.max(0, prev - 10));
                toast.warning("Focus interrupted! App switch detected.", {
                    icon: <AlertTriangle className="w-4 h-4" />
                });
            }
        };

        const handleBlur = () => {
            if (isRunning && !isPaused) {
                setInterruptions(prev => prev + 1);
                setWasInterrupted(true);
                setFocusScore(prev => Math.max(0, prev - 5));
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
        };
    }, [isRunning, isPaused]);

    // Focus verification scheduling
    useEffect(() => {
        if (!isRunning || isPaused || showVerification) {
            clearTimeout(verificationTimerRef.current);
            return;
        }

        const elapsedMinutes = Math.floor((selectedDuration * 60 - timeRemaining) / 60);
        const nextInterval = getNextCheckInterval(selectedDuration, elapsedMinutes, checkCount);

        if (nextInterval > 0) {
            // Schedule next verification check
            verificationTimerRef.current = setTimeout(() => {
                triggerVerification();
            }, nextInterval * 1000);
        }

        return () => clearTimeout(verificationTimerRef.current);
    }, [isRunning, isPaused, checkCount, selectedDuration]);

    // Trigger verification popup
    const triggerVerification = () => {
        playNotificationSound();
        triggerVibration();
        setCurrentQuote(getRandomQuote());
        setShowVerification(true);
        setVerificationTimeLeft(30);
        setCheckCount(prev => prev + 1);

        // Start countdown timer
        let countdown = 30;
        verificationTimeoutRef.current = setInterval(() => {
            countdown--;
            setVerificationTimeLeft(countdown);

            if (countdown <= 0) {
                handleVerificationTimeout();
            }
        }, 1000);
    };

    // Handle verification timeout (missed check)
    const handleVerificationTimeout = () => {
        clearInterval(verificationTimeoutRef.current);
        setShowVerification(false);
        setMissedChecks(prev => prev + 1);
        setFocusScore(prev => Math.max(0, prev - 15));
        toast.error("Focus check missed! Coin penalty applied.", {
            icon: <AlertTriangle className="w-4 h-4" />
        });
    };

    // Handle verification confirmation
    const handleVerificationConfirm = () => {
        clearInterval(verificationTimeoutRef.current);
        setShowVerification(false);
        toast.success("Great! Keep up the focus! 💪", {
            icon: <CheckCircle2 className="w-4 h-4" />
        });
    };

    // Timer countdown
    useEffect(() => {
        if (isRunning && !isPaused && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        handleSessionComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [isRunning, isPaused]);

    const handleStart = () => {
        setIsRunning(true);
        setIsPaused(false);
        startTimeRef.current = Date.now();
        setTimeRemaining(selectedDuration * 60);
        setInterruptions(0);
        setFocusScore(100);
        setWasInterrupted(false);
        // Reset verification state
        setMissedChecks(0);
        setCheckCount(0);
        setShowVerification(false);
        clearInterval(verificationTimeoutRef.current);
        toast.success("Focus session started! Stay focused 💪");
    };

    const handlePause = () => {
        setIsPaused(true);
        toast.info("Timer paused");
    };

    const handleResume = () => {
        setIsPaused(false);
        toast.success("Timer resumed");
    };

    const handleStop = () => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000 / 60);
        if (elapsed >= 5) {
            // Minimum 5 minutes to earn coins
            submitSession(elapsed);
        } else {
            clearInterval(timerRef.current);
            setIsRunning(false);
            setIsPaused(false);
            setTimeRemaining(selectedDuration * 60);
            toast.info("Session cancelled. Study at least 5 minutes to earn coins.");
        }
    };

    const handleSessionComplete = async () => {
        await submitSession(selectedDuration);
    };

    const submitSession = async (durationMinutes) => {
        try {
            const response = await axios.post(`${API}/study/session`, {
                subject,
                duration_minutes: durationMinutes,
                focus_score: focusScore,
                was_interrupted: wasInterrupted,
                interruption_count: interruptions
            });

            setSessionResult({
                coins_earned: response.data.coins_earned,
                duration: durationMinutes,
                focus_score: focusScore
            });

            // Update streak if daily goal might be met
            try {
                await axios.post(`${API}/streak/update`);
            } catch { }

            setShowResult(true);
        } catch (error) {
            toast.error("Failed to save session");
        } finally {
            clearInterval(timerRef.current);
            setIsRunning(false);
            setIsPaused(false);
        }
    };

    const handleReset = () => {
        setTimeRemaining(selectedDuration * 60);
        setShowResult(false);
        setSessionResult(null);
        setInterruptions(0);
        setFocusScore(100);
        setWasInterrupted(false);
        // Reset verification state
        setMissedChecks(0);
        setCheckCount(0);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const progress = ((selectedDuration * 60 - timeRemaining) / (selectedDuration * 60)) * 100;

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold">Focus Timer</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
                {/* Subject Selector */}
                {!isRunning && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="bento-card">
                            <CardContent className="pt-6">
                                <label className="text-sm font-medium mb-2 block">Subject</label>
                                <Select
                                    value={subjectType === "Custom" ? "Custom" : subject}
                                    onValueChange={(v) => {
                                        if (v === "Custom") {
                                            setSubjectType("Custom");
                                            setSubject("");
                                        } else {
                                            setSubjectType("Standard");
                                            setSubject(v);
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(user?.subjects?.length > 0 ? user.subjects : ["General", "Mathematics", "Science", "English"]).map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                        <SelectItem value="Custom">Custom Subject...</SelectItem>
                                    </SelectContent>
                                </Select>
                                {subjectType === "Custom" && (
                                    <Input
                                        className="mt-2"
                                        placeholder="Enter custom subject name"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        autoFocus
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Timer Display */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center"
                >
                    <ProgressRing
                        progress={isRunning ? progress : 0}
                        size={280}
                        strokeWidth={16}
                        color={focusScore >= 80 ? "hsl(var(--primary))" : focusScore >= 50 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
                    >
                        <div className="text-center">
                            <p className="text-5xl font-bold font-mono">{formatTime(timeRemaining)}</p>
                            <p className="text-sm text-muted-foreground mt-2">{subject}</p>
                            {isRunning && (
                                <div className="flex items-center gap-1 justify-center mt-2">
                                    <div className={`w-2 h-2 rounded-full ${isPaused ? "bg-accent" : "bg-success"} ${!isPaused && "animate-pulse"}`} />
                                    <span className="text-xs text-muted-foreground">
                                        {isPaused ? "Paused" : "Focusing"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </ProgressRing>
                </motion.div>

                {/* Duration Presets */}
                {!isRunning && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center gap-3"
                    >
                        {DURATIONS.map((d) => (
                            <Button
                                key={d.value}
                                variant={selectedDuration === d.value ? "default" : "outline"}
                                onClick={() => {
                                    setSelectedDuration(d.value);
                                    setTimeRemaining(d.value * 60);
                                }}
                                className={selectedDuration === d.value ? "btn-primary" : ""}
                            >
                                {d.label}
                            </Button>
                        ))}
                    </motion.div>
                )}

                {/* Controls */}
                <div className="flex justify-center gap-4">
                    {!isRunning ? (
                        <Button
                            onClick={handleStart}
                            size="lg"
                            className="btn-primary text-lg px-12"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            Start
                        </Button>
                    ) : (
                        <>
                            {isPaused ? (
                                <Button onClick={handleResume} size="lg" className="btn-primary">
                                    <Play className="w-5 h-5 mr-2" />
                                    Resume
                                </Button>
                            ) : (
                                <Button onClick={handlePause} size="lg" variant="outline">
                                    <Pause className="w-5 h-5 mr-2" />
                                    Pause
                                </Button>
                            )}
                            <Button onClick={handleStop} size="lg" variant="destructive">
                                <Square className="w-5 h-5 mr-2" />
                                Stop
                            </Button>
                        </>
                    )}
                </div>

                {/* Coin Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bento-card bg-gradient-to-br from-amber-500/10 via-yellow-500/10 to-orange-500/10">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Coins className="w-6 h-6 text-accent" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Predicted Coins</p>
                                        <p className="text-2xl font-bold text-accent">+{getPredictedCoins()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Focus Score</p>
                                    <p className={`text-xl font-bold ${focusScore >= 80 ? "text-success" :
                                        focusScore >= 50 ? "text-accent" : "text-destructive"
                                        }`}>
                                        {focusScore}%
                                    </p>
                                </div>
                            </div>
                            {interruptions > 0 && (
                                <div className="flex items-center gap-2 mt-4 text-destructive text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>{interruptions} interruption{interruptions > 1 ? "s" : ""} detected</span>
                                </div>
                            )}
                            {missedChecks > 0 && (
                                <div className="flex items-center gap-2 mt-2 text-accent text-sm">
                                    <Bell className="w-4 h-4" />
                                    <span>{missedChecks} focus check{missedChecks > 1 ? "s" : ""} missed ({Math.round(getCoinPenaltyMultiplier(missedChecks) * 100)}% coins)</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </main>

            {/* Session Result Modal */}
            <Dialog open={showResult} onOpenChange={setShowResult}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="w-6 h-6 text-success" />
                            Session Complete!
                        </DialogTitle>
                        <DialogDescription>
                            Great job staying focused!
                        </DialogDescription>
                    </DialogHeader>

                    {sessionResult && (
                        <div className="space-y-6 py-4">
                            <div className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.2 }}
                                    className="inline-flex items-center gap-3 bg-accent/10 rounded-2xl px-6 py-4"
                                >
                                    <Coins className="w-10 h-10 text-accent" />
                                    <span className="text-4xl font-bold text-accent">
                                        +{sessionResult.coins_earned}
                                    </span>
                                </motion.div>
                                <p className="text-sm text-muted-foreground mt-2">coins earned</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-4 bg-secondary rounded-xl">
                                    <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
                                    <p className="text-lg font-bold">{sessionResult.duration} min</p>
                                    <p className="text-xs text-muted-foreground">Duration</p>
                                </div>
                                <div className="text-center p-4 bg-secondary rounded-xl">
                                    <Flame className="w-6 h-6 text-destructive mx-auto mb-2" />
                                    <p className="text-lg font-bold">{sessionResult.focus_score}%</p>
                                    <p className="text-xs text-muted-foreground">Focus Score</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        handleReset();
                                        setShowResult(false);
                                    }}
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Again
                                </Button>
                                <Button
                                    className="flex-1 btn-primary"
                                    onClick={() => navigate("/dashboard")}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Focus Verification Popup */}
            <Dialog open={showVerification} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bell className="w-6 h-6 text-primary animate-bounce" />
                            Focus Check!
                        </DialogTitle>
                        <DialogDescription>
                            Are you still studying? Confirm to continue.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Motivational Quote */}
                        {currentQuote && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-primary/20"
                            >
                                <Sparkles className="w-5 h-5 text-primary mb-2" />
                                <p className="text-sm italic">"{currentQuote.quote}"</p>
                                <p className="text-xs text-muted-foreground mt-2">— {currentQuote.author}</p>
                            </motion.div>
                        )}

                        {/* Countdown Timer */}
                        <div className="text-center">
                            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-4 ${verificationTimeLeft > 15 ? "border-primary" :
                                verificationTimeLeft > 5 ? "border-accent" : "border-destructive"
                                }`}>
                                <span className={`text-2xl font-bold font-mono ${verificationTimeLeft <= 5 ? "text-destructive animate-pulse" : ""
                                    }`}>
                                    {verificationTimeLeft}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">seconds to respond</p>
                        </div>

                        {/* Confirm Button */}
                        <Button
                            onClick={handleVerificationConfirm}
                            className="w-full btn-primary text-lg py-6"
                        >
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            Yes, I'm Studying! 📚
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <BottomNav />
        </div>
    );
};

export default FocusTimerPage;

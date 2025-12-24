import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { API } from "@/App";
import BottomNav from "@/components/BottomNav";
import CoinDisplay from "@/components/CoinDisplay";
import ProgressRing from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Timer,
    Flame,
    TrendingUp,
    Trophy,
    Sparkles,
    ChevronRight,
    Clock,
    Target,
    BookOpen
} from "lucide-react";

const DashboardPage = ({ user, setUser }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [wallet, setWallet] = useState(null);
    const [tip, setTip] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, walletRes] = await Promise.all([
                    axios.get(`${API}/study/stats`),
                    axios.get(`${API}/wallet`)
                ]);
                setStats(statsRes.data);
                setWallet(walletRes.data);

                // Fetch AI tip in background
                axios.post(`${API}/ai/tip`, { context: "general" })
                    .then(res => setTip(res.data.tip))
                    .catch(() => { });
            } catch (error) {
                console.error("Failed to fetch dashboard data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const dailyProgress = stats
        ? Math.min(100, (stats.today_minutes / stats.daily_target) * 100)
        : 0;

    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background aurora-bg pb-24 md:pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                {user?.picture ? (
                                    <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                    <span className="text-lg font-bold text-primary">
                                        {user?.name?.[0]?.toUpperCase() || "S"}
                                    </span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{getGreeting()}</p>
                                <h1 className="text-lg font-bold">{user?.name || "Student"}</h1>
                            </div>
                        </div>
                        <CoinDisplay
                            coins={wallet?.total_coins || user?.coins || 0}
                            todayCoins={wallet?.today_coins}
                            size="md"
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Today's Progress */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bento-card overflow-hidden">
                        <div className="hero-gradient absolute inset-0 opacity-10" />
                        <CardContent className="relative pt-6">
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <ProgressRing
                                    progress={dailyProgress}
                                    size={140}
                                    strokeWidth={12}
                                >
                                    <div className="text-center">
                                        <p className="text-3xl font-bold">{Math.round(dailyProgress)}%</p>
                                        <p className="text-xs text-muted-foreground">Daily Goal</p>
                                    </div>
                                </ProgressRing>

                                <div className="flex-1 text-center sm:text-left">
                                    <h2 className="text-xl font-bold mb-2">Today's Focus</h2>
                                    <p className="text-3xl font-bold text-primary mb-1">
                                        {formatTime(stats?.today_minutes || 0)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        of {formatTime(stats?.daily_target || 120)} target
                                    </p>
                                    <Button
                                        onClick={() => navigate("/focus")}
                                        className="btn-primary"
                                    >
                                        <Timer className="w-4 h-4 mr-2" />
                                        Start Focus Session
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        {
                            icon: Clock,
                            label: "Today",
                            value: formatTime(stats?.today_minutes || 0),
                            color: "text-primary"
                        },
                        {
                            icon: TrendingUp,
                            label: "This Week",
                            value: formatTime(stats?.week_minutes || 0),
                            color: "text-success"
                        },
                        {
                            icon: Flame,
                            label: "Streak",
                            value: `${stats?.current_streak || 0} days`,
                            color: "text-destructive"
                        },
                        {
                            icon: Trophy,
                            label: "Best Streak",
                            value: `${stats?.longest_streak || 0} days`,
                            color: "text-accent"
                        }
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="bento-card h-full">
                                <CardContent className="pt-4 pb-4">
                                    <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                                    <p className="text-lg font-bold">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card
                            className="bento-card cursor-pointer card-hover"
                            onClick={() => navigate("/planner")}
                        >
                            <CardContent className="pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                                        <Target className="w-6 h-6 text-accent" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Study Planner</h3>
                                        <p className="text-sm text-muted-foreground">Manage your tasks</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Card
                            className="bento-card cursor-pointer card-hover"
                            onClick={() => navigate("/wallet")}
                        >
                            <CardContent className="pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Trophy className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Rewards</h3>
                                        <p className="text-sm text-muted-foreground">View your progress</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* AI Tip */}
                {tip && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <Card className="bento-card bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                        <Sparkles className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-1">Daily Tip</h3>
                                        <p className="text-sm text-muted-foreground">{tip}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Subject Stats */}
                {stats?.daily_breakdown && Object.keys(stats.daily_breakdown).length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <Card className="bento-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5" />
                                    This Week's Activity
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(stats.daily_breakdown)
                                        .sort((a, b) => b[0].localeCompare(a[0]))
                                        .slice(0, 7)
                                        .map(([date, data]) => (
                                            <div key={date} className="flex items-center gap-4">
                                                <span className="text-sm text-muted-foreground w-24">
                                                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(100, (data.minutes / (stats.daily_target || 120)) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium w-16 text-right">
                                                    {formatTime(data.minutes)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </main>

            <BottomNav />
        </div>
    );
};

export default DashboardPage;

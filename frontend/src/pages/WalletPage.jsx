import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { API } from "@/App";
import BottomNav from "@/components/BottomNav";
import CoinDisplay from "@/components/CoinDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ArrowLeft,
    Coins,
    Trophy,
    Star,
    Clock,
    Flame,
    Medal,
    Crown,
    Calendar,
    Gift,
    Lock,
    CheckCircle2
} from "lucide-react";

const iconMap = {
    star: Star,
    clock: Clock,
    flame: Flame,
    trophy: Trophy,
    coins: Coins,
    medal: Medal,
    crown: Crown,
    calendar: Calendar
};

const WalletPage = ({ user }) => {
    const navigate = useNavigate();
    const [wallet, setWallet] = useState(null);
    const [badges, setBadges] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [walletRes, badgesRes, milestonesRes] = await Promise.all([
                    axios.get(`${API}/wallet`),
                    axios.get(`${API}/badges`),
                    axios.get(`${API}/milestones`)
                ]);
                setWallet(walletRes.data);
                setBadges(badgesRes.data);
                setMilestones(milestonesRes.data);
            } catch (error) {
                console.error("Failed to fetch wallet data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold">Wallet & Rewards</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Balance Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bento-card overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20" />
                        <CardContent className="relative pt-8 pb-8 text-center">
                            <motion.div
                                initial={{ scale: 0.5 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.2 }}
                            >
                                <CoinDisplay
                                    coins={wallet?.total_coins || 0}
                                    todayCoins={wallet?.today_coins}
                                    size="xl"
                                    showLabel={true}
                                />
                            </motion.div>
                            <p className="text-sm text-muted-foreground mt-2">Your Total Balance</p>

                            {wallet?.today_coins > 0 && (
                                <div className="mt-4 inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="font-medium">+{wallet.today_coins} coins earned today!</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Milestones */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="bento-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gift className="w-5 h-5 text-primary" />
                                Reward Milestones
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {milestones.map((milestone, index) => (
                                <motion.div
                                    key={milestone.milestone_id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`p-4 rounded-xl border-2 transition-all ${milestone.achieved
                                            ? "border-success bg-success/10"
                                            : "border-border"
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${milestone.achieved ? "bg-success/20" : "bg-secondary"
                                                }`}>
                                                {milestone.achieved ? (
                                                    <CheckCircle2 className="w-5 h-5 text-success" />
                                                ) : (
                                                    <Trophy className={`w-5 h-5 ${milestone.milestone_id === "bronze" ? "text-amber-600" :
                                                            milestone.milestone_id === "silver" ? "text-slate-400" :
                                                                "text-yellow-500"
                                                        }`} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold">{milestone.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {milestone.coins_required.toLocaleString()} coins
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{milestone.reward_description}</p>
                                            <p className="text-xs text-muted-foreground">{milestone.progress}%</p>
                                        </div>
                                    </div>
                                    <Progress value={milestone.progress} className="h-2" />
                                </motion.div>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Badges */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="bento-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Medal className="w-5 h-5 text-accent" />
                                Badge Collection
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 gap-4">
                                {badges.map((badge, index) => {
                                    const IconComponent = iconMap[badge.icon] || Star;

                                    return (
                                        <motion.div
                                            key={badge.badge_id}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${badge.unlocked
                                                    ? "bg-primary/10"
                                                    : "bg-secondary opacity-50"
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${badge.unlocked
                                                    ? "bg-primary/20"
                                                    : "bg-muted"
                                                }`}>
                                                {badge.unlocked ? (
                                                    <IconComponent className="w-6 h-6 text-primary" />
                                                ) : (
                                                    <Lock className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <p className="text-xs font-medium truncate w-full">{badge.name}</p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Transaction History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="bento-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5" />
                                Recent Transactions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-64">
                                <div className="space-y-3">
                                    {wallet?.transactions?.length > 0 ? (
                                        wallet.transactions.map((txn, index) => (
                                            <motion.div
                                                key={txn.transaction_id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                                        <Coins className="w-4 h-4 text-accent" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{txn.reason}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(txn.created_at).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-accent">+{txn.amount}</span>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">
                                            No transactions yet. Start studying to earn coins!
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>

            <BottomNav />
        </div>
    );
};

export default WalletPage;

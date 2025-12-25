import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { API, AUTH_TOKEN_KEY } from "@/App";
import BottomNav from "@/components/BottomNav";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { initializeStudyReminders } from "@/utils/studyReminder";
import {
    ArrowLeft,
    User,
    Moon,
    Sun,
    Target,
    BookOpen,
    Clock,
    Flame,
    Coins,
    LogOut,
    Settings,
    Mail,
    Trophy,
    Bell,
    BellOff,
    Pencil,
    Plus,
    X
} from "lucide-react";

const ProfilePage = ({ user, setUser }) => {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const [dailyTarget, setDailyTarget] = useState(user?.daily_target_minutes || 120);
    const [isSaving, setIsSaving] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationLoading, setNotificationLoading] = useState(false);

    // Edit Subjects State
    const [isEditingSubjects, setIsEditingSubjects] = useState(false);
    const [editingSubjects, setEditingSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState("");

    // Initialize subjects when user data loads or dialog opens
    useEffect(() => {
        if (user?.subjects) {
            setEditingSubjects(user.subjects);
        }
    }, [user, isEditingSubjects]);

    // Check notification permission on mount
    useEffect(() => {
        if ('Notification' in window && 'serviceWorker' in navigator) {
            setNotificationsEnabled(Notification.permission === 'granted' && !!user?.push_subscription);
        }
    }, [user]);

    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h`;
        return `${mins}m`;
    };

    const toggleSubjectRaw = (subject) => {
        setEditingSubjects(prev =>
            prev.includes(subject)
                ? prev.filter(s => s !== subject)
                : [...prev, subject]
        );
    };

    const addCustomSubjectRaw = () => {
        const trimmed = newSubject.trim();
        if (trimmed && !editingSubjects.includes(trimmed)) {
            setEditingSubjects(prev => [...prev, trimmed]);
            setNewSubject("");
        } else if (editingSubjects.includes(trimmed)) {
            toast.error("Subject already added");
        }
    };

    const saveSubjects = async () => {
        if (editingSubjects.length === 0) {
            toast.error("Please select at least one subject");
            return;
        }

        setIsSaving(true);
        try {
            await axios.patch(`${API}/user/settings`, {
                subjects: editingSubjects
            });

            // Update local user state
            setUser(prev => ({ ...prev, subjects: editingSubjects }));
            setIsEditingSubjects(false);
            toast.success("Subjects updated successfully!");
        } catch (error) {
            console.error("Failed to save subjects:", error);
            toast.error("Failed to update subjects");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDailyTargetChange = async (value) => {
        setDailyTarget(value[0]);
    };

    const saveDailyTarget = async () => {
        setIsSaving(true);
        try {
            await axios.patch(`${API}/user/settings`, {
                daily_target_minutes: dailyTarget
            });
            toast.success("Daily target updated!");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleNotificationToggle = async (enabled) => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            toast.error('Push notifications not supported in this browser');
            return;
        }

        setNotificationLoading(true);

        try {
            if (enabled) {
                // Request permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    toast.error('Notification permission denied');
                    setNotificationLoading(false);
                    return;
                }

                // Get VAPID public key from server
                const vapidRes = await axios.get(`${API}/notifications/vapid-key`);
                const vapidPublicKey = vapidRes.data.publicKey;

                // Convert VAPID key to Uint8Array
                const urlBase64ToUint8Array = (base64String) => {
                    const padding = '='.repeat((4 - base64String.length % 4) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i);
                    }
                    return outputArray;
                };

                // Subscribe to push
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                });

                // Send subscription to server
                const subscriptionJson = subscription.toJSON();
                await axios.post(`${API}/notifications/subscribe`, {
                    endpoint: subscriptionJson.endpoint,
                    keys: subscriptionJson.keys
                });

                setNotificationsEnabled(true);
                initializeStudyReminders(true); // Start automatic reminders
                toast.success('🔔 Notifications enabled! You\'ll receive study reminders.');
            } else {
                // Unsubscribe
                await axios.delete(`${API}/notifications/unsubscribe`);
                setNotificationsEnabled(false);
                initializeStudyReminders(false); // Stop automatic reminders
                toast.success('Notifications disabled');
            }
        } catch (error) {
            console.error('Notification toggle error:', error);
            toast.error('Failed to update notification settings');
        } finally {
            setNotificationLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Clear token from localStorage
            localStorage.removeItem(AUTH_TOKEN_KEY);
            await axios.post(`${API}/auth/logout`);
            navigate("/");
        } catch (error) {
            // Still navigate away (token already cleared)
            navigate("/");
        }
    };

    const stats = [
        {
            icon: Clock,
            label: "Total Study Time",
            value: formatTime(user?.total_study_time || 0),
            color: "text-primary"
        },
        {
            icon: Flame,
            label: "Current Streak",
            value: `${user?.current_streak || 0} days`,
            color: "text-destructive"
        },
        {
            icon: Trophy,
            label: "Best Streak",
            value: `${user?.longest_streak || 0} days`,
            color: "text-accent"
        },
        {
            icon: Coins,
            label: "Total Coins",
            value: (user?.coins || 0).toLocaleString(),
            color: "text-yellow-500"
        }
    ];

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold">Profile</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* User Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bento-card">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                    {user?.picture ? (
                                        <img src={user.picture} alt="" className="w-16 h-16 rounded-full" />
                                    ) : (
                                        <User className="w-8 h-8 text-primary" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold">{user?.name || "Student"}</h2>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {user?.email}
                                    </p>
                                    {user?.class_level && (
                                        <Badge variant="outline" className="mt-2">
                                            Class {user.class_level}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Stats Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="grid grid-cols-2 gap-4">
                        {stats.map((stat, index) => (
                            <Card key={index} className="bento-card">
                                <CardContent className="pt-4 pb-4">
                                    <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                                    <p className="text-lg font-bold">{stat.value}</p>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </motion.div>

                {/* Subjects */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <Card className="bento-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <BookOpen className="w-5 h-5" />
                                Your Subjects
                            </CardTitle>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsEditingSubjects(true)}>
                                <Pencil className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {user?.subjects?.length > 0 ? (
                                    user.subjects.map((subject, index) => (
                                        <Badge key={index} variant="secondary" className="px-3 py-1">
                                            {subject}
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">No subjects selected</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Edit Subjects Dialog */}
                <Dialog open={isEditingSubjects} onOpenChange={setIsEditingSubjects}>
                    <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Subjects</DialogTitle>
                            <DialogDescription>
                                Manage the subjects you want to track.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2">
                                {[
                                    "Mathematics", "Physics", "Chemistry", "Biology",
                                    "English", "History", "Geography", "Computer Science",
                                    "Economics", "Accounts", "Business Studies", "Hindi",
                                    "Political Science", "Psychology", "Sociology"
                                ].map((subject) => (
                                    <div
                                        key={subject}
                                        className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${editingSubjects.includes(subject)
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/50"
                                            }`}
                                        onClick={() => toggleSubjectRaw(subject)}
                                    >
                                        <Checkbox
                                            checked={editingSubjects.includes(subject)}
                                            onCheckedChange={() => toggleSubjectRaw(subject)}
                                        />
                                        <span className="text-sm font-medium">{subject}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label>Custom Subjects</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add custom subject..."
                                        value={newSubject}
                                        onChange={(e) => setNewSubject(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && addCustomSubjectRaw()}
                                    />
                                    <Button size="icon" variant="outline" onClick={addCustomSubjectRaw} disabled={!newSubject.trim()}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {editingSubjects
                                        .filter(s => ![
                                            "Mathematics", "Physics", "Chemistry", "Biology",
                                            "English", "History", "Geography", "Computer Science",
                                            "Economics", "Accounts", "Business Studies", "Hindi",
                                            "Political Science", "Psychology", "Sociology"
                                        ].includes(s))
                                        .map((subject, idx) => (
                                            <Badge key={idx} variant="outline" className="flex items-center gap-1 pl-3 pr-1 py-1">
                                                {subject}
                                                <button
                                                    onClick={() => toggleSubjectRaw(subject)}
                                                    className="hover:text-destructive p-1 rounded-full transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditingSubjects(false)}>Cancel</Button>
                            <Button onClick={saveSubjects} disabled={isSaving}>
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Settings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="bento-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Theme Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                                    <div>
                                        <p className="font-medium">Dark Mode</p>
                                        <p className="text-xs text-muted-foreground">
                                            {isDark ? "Currently using dark theme" : "Currently using light theme"}
                                        </p>
                                    </div>
                                </div>
                                <Switch checked={isDark} onCheckedChange={toggleTheme} />
                            </div>

                            {/* Notifications Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {notificationsEnabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5" />}
                                    <div>
                                        <p className="font-medium">Push Notifications</p>
                                        <p className="text-xs text-muted-foreground">
                                            {notificationsEnabled ? "Get study reminders" : "Enable to receive reminders"}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={notificationsEnabled}
                                    onCheckedChange={handleNotificationToggle}
                                    disabled={notificationLoading}
                                />
                            </div>

                            {/* Daily Target */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <Target className="w-5 h-5" />
                                        <div>
                                            <p className="font-medium">Daily Study Goal</p>
                                            <p className="text-xs text-muted-foreground">
                                                Current target: {formatTime(dailyTarget)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-lg font-bold text-primary">{formatTime(dailyTarget)}</span>
                                </div>
                                <Slider
                                    value={[dailyTarget]}
                                    onValueChange={handleDailyTargetChange}
                                    onValueCommit={saveDailyTarget}
                                    min={30}
                                    max={240}
                                    step={15}
                                    className="mb-2"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>30 min</span>
                                    <span>4 hours</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Logout */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                                <LogOut className="w-4 h-4 mr-2" />
                                Log Out
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Log out?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to log out? Your progress is saved and will be here when you return.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground">
                                    Log Out
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </motion.div>

                {/* App Info */}
                <div className="text-center text-xs text-muted-foreground pt-4">
                    <p>RevealIQ Study Companion</p>
                    <p>Version 1.0.0</p>
                </div>
            </main>

            <BottomNav />
        </div>
    );
};

export default ProfilePage;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { API } from "@/App";
import BottomNav from "@/components/BottomNav";
import AIThinking from "@/components/AIThinking";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus,
    Check,
    Trash2,
    Clock,
    Flame,
    ArrowLeft,
    CalendarDays,
    BookOpen,
    Target,
    Sparkles,
    TrendingUp,
    RefreshCw
} from "lucide-react";

const PlannerPage = ({ user }) => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [calendar, setCalendar] = useState({});
    const [loading, setLoading] = useState(true);
    const [showAddTask, setShowAddTask] = useState(false);
    const [subjectType, setSubjectType] = useState("Standard"); // "Standard" or "Custom"

    // AI Study Plan state
    const [aiPlan, setAiPlan] = useState(null);
    const [aiPlanLoading, setAiPlanLoading] = useState(false);
    const [progressInsights, setProgressInsights] = useState(null);
    const [insightsLoading, setInsightsLoading] = useState(false);

    // New task form
    const [newTask, setNewTask] = useState({
        title: "",
        subject: user?.subjects?.[0] || "General",
        estimated_minutes: 30
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tasksRes, calendarRes] = await Promise.all([
                axios.get(`${API}/tasks`),
                axios.get(`${API}/streak/calendar`)
            ]);
            setTasks(tasksRes.data);
            setCalendar(calendarRes.data);
        } catch (error) {
            console.error("Failed to fetch planner data");
        } finally {
            setLoading(false);
        }
    };

    const fetchAIStudyPlan = async () => {
        setAiPlanLoading(true);
        try {
            const response = await axios.post(`${API}/ai/study-plan`, {});
            setAiPlan(response.data);
        } catch (error) {
            console.error("Failed to fetch AI study plan");
            toast.error("Could not generate study plan");
        } finally {
            setAiPlanLoading(false);
        }
    };

    const fetchProgressInsights = async () => {
        setInsightsLoading(true);
        try {
            const response = await axios.get(`${API}/ai/progress-insights`);
            setProgressInsights(response.data);
        } catch (error) {
            console.error("Failed to fetch progress insights");
        } finally {
            setInsightsLoading(false);
        }
    };

    const handleAddTask = async () => {
        if (!newTask.title.trim()) {
            toast.error("Please enter a task title");
            return;
        }

        try {
            const response = await axios.post(`${API}/tasks`, newTask);
            setTasks([response.data, ...tasks]);
            setNewTask({ title: "", subject: user?.subjects?.[0] || "General", estimated_minutes: 30 });
            setShowAddTask(false);
            toast.success("Task added!");
        } catch (error) {
            toast.error("Failed to add task");
        }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            const response = await axios.patch(`${API}/tasks/${taskId}`);
            setTasks(tasks.map(t => t.task_id === taskId ? { ...t, completed: true } : t));
            toast.success(`Task completed! +${response.data.coins_earned} coins 🎉`);
        } catch (error) {
            toast.error("Failed to complete task");
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await axios.delete(`${API}/tasks/${taskId}`);
            setTasks(tasks.filter(t => t.task_id !== taskId));
            toast.success("Task deleted");
        } catch (error) {
            toast.error("Failed to delete task");
        }
    };

    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    // Generate last 30 days for calendar
    const getLast30Days = () => {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            days.push(date.toISOString().split('T')[0]);
        }
        return days;
    };

    const getDayStatus = (date) => {
        const minutes = calendar.calendar?.[date] || 0;
        const target = calendar.daily_target || 120;

        if (minutes >= target) return "complete";
        if (minutes > 0) return "partial";
        return "empty";
    };

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
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <h1 className="text-xl font-bold">Study Planner</h1>
                        </div>
                        <div className="flex items-center gap-2 text-destructive">
                            <Flame className="w-5 h-5" />
                            <span className="font-bold">{calendar.current_streak || 0}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Streak Calendar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bento-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CalendarDays className="w-5 h-5" />
                                30-Day Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-10 gap-1.5">
                                {getLast30Days().map((date, index) => {
                                    const status = getDayStatus(date);
                                    const isToday = date === new Date().toISOString().split('T')[0];

                                    return (
                                        <motion.div
                                            key={date}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: index * 0.02 }}
                                            className={`
                        aspect-square rounded-md border-2 transition-all
                        ${status === "complete" ? "bg-success/30 border-success" : ""}
                        ${status === "partial" ? "bg-accent/30 border-accent" : ""}
                        ${status === "empty" ? "bg-muted/10 border-border" : ""}
                        ${isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
                      `}
                                            title={`${date}: ${calendar.calendar?.[date] || 0} min`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-muted/10 border border-border" />
                                    <span>No activity</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-accent/30 border border-accent" />
                                    <span>Partial</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-success/30 border border-success" />
                                    <span>Goal met</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* AI Study Plan Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="bento-card bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-primary/5 border-purple-500/20">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Sparkles className="w-5 h-5 text-purple-500" />
                                    RevealIQ AI Study Plan
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchAIStudyPlan}
                                    disabled={aiPlanLoading}
                                    className="gap-2"
                                >
                                    <RefreshCw className={`w-4 h-4 ${aiPlanLoading ? 'animate-spin' : ''}`} />
                                    {aiPlan ? 'Regenerate' : 'Generate Plan'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {aiPlanLoading ? (
                                <AIThinking message="RevealIQ AI is analyzing your study patterns..." />
                            ) : aiPlan ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <MarkdownRenderer content={aiPlan.plan} />
                                    {aiPlan.context && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                                            <span className="text-xs bg-purple-500/10 text-purple-500 px-2 py-1 rounded-full">
                                                {aiPlan.context.pending_tasks} pending tasks
                                            </span>
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                                🔥 {aiPlan.context.streak} day streak
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        Click "Generate Plan" to get a personalized AI-powered study schedule based on your tasks and patterns.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* AI Progress Insights */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <Card className="bento-card">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <TrendingUp className="w-5 h-5 text-success" />
                                    AI Progress Insights
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={fetchProgressInsights}
                                    disabled={insightsLoading}
                                >
                                    <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {insightsLoading ? (
                                <AIThinking message="Analyzing your progress..." />
                            ) : progressInsights ? (
                                <div>
                                    <MarkdownRenderer content={progressInsights.insights} className="mb-4" />
                                    {progressInsights.stats && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
                                            <div className="text-center p-2 bg-secondary rounded-lg">
                                                <p className="text-lg font-bold">{progressInsights.stats.total_sessions}</p>
                                                <p className="text-xs text-muted-foreground">Sessions</p>
                                            </div>
                                            <div className="text-center p-2 bg-secondary rounded-lg">
                                                <p className="text-lg font-bold">{Math.round(progressInsights.stats.total_minutes / 60)}h</p>
                                                <p className="text-xs text-muted-foreground">Studied</p>
                                            </div>
                                            <div className="text-center p-2 bg-secondary rounded-lg">
                                                <p className="text-lg font-bold">{progressInsights.stats.avg_focus}%</p>
                                                <p className="text-xs text-muted-foreground">Avg Focus</p>
                                            </div>
                                            <div className="text-center p-2 bg-secondary rounded-lg">
                                                <p className="text-lg font-bold">{progressInsights.stats.completion_rate}%</p>
                                                <p className="text-xs text-muted-foreground">Consistency</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        Click to analyze your study patterns
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Add Task Button */}
                <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
                    <DialogTrigger asChild>
                        <Button className="w-full btn-primary">
                            <Plus className="w-4 h-4 mr-2" />
                            Add New Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent aria-describedby={undefined}>
                        <DialogHeader>
                            <DialogTitle>Add New Task</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Task Title</label>
                                <Input
                                    placeholder="e.g., Complete Chapter 5 notes"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Subject</label>
                                <Select
                                    value={subjectType === "Custom" ? "Custom" : newTask.subject}
                                    onValueChange={(v) => {
                                        if (v === "Custom") {
                                            setSubjectType("Custom");
                                            setNewTask({ ...newTask, subject: "" });
                                        } else {
                                            setSubjectType("Standard");
                                            setNewTask({ ...newTask, subject: v });
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
                                        value={newTask.subject}
                                        onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
                                        autoFocus
                                    />
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Estimated Time</label>
                                <Select
                                    value={String(newTask.estimated_minutes)}
                                    onValueChange={(v) => setNewTask({ ...newTask, estimated_minutes: parseInt(v) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15">15 minutes</SelectItem>
                                        <SelectItem value="30">30 minutes</SelectItem>
                                        <SelectItem value="45">45 minutes</SelectItem>
                                        <SelectItem value="60">1 hour</SelectItem>
                                        <SelectItem value="90">1.5 hours</SelectItem>
                                        <SelectItem value="120">2 hours</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddTask} className="w-full btn-primary">
                                Add Task
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Pending Tasks */}
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        To Do ({pendingTasks.length})
                    </h2>
                    <div className="space-y-3">
                        <AnimatePresence>
                            {pendingTasks.length === 0 ? (
                                <Card className="bento-card">
                                    <CardContent className="pt-6 text-center text-muted-foreground">
                                        <p>No pending tasks. Add one to get started!</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                pendingTasks.map((task, index) => (
                                    <motion.div
                                        key={task.task_id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card className="bento-card">
                                            <CardContent className="pt-4 pb-4">
                                                <div className="flex items-center gap-4">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="shrink-0 rounded-full border-2 hover:bg-success hover:border-success hover:text-white"
                                                        onClick={() => handleCompleteTask(task.task_id)}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate">{task.title}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                                {task.subject}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {task.estimated_minutes} min
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteTask(task.task_id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-muted-foreground">
                            <Check className="w-5 h-5" />
                            Completed ({completedTasks.length})
                        </h2>
                        <div className="space-y-3">
                            {completedTasks.slice(0, 5).map((task, index) => (
                                <motion.div
                                    key={task.task_id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className="bento-card opacity-60">
                                        <CardContent className="pt-4 pb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                                                    <Check className="w-5 h-5 text-success" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate line-through">{task.title}</p>
                                                    <span className="text-xs text-muted-foreground">{task.subject}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
};

export default PlannerPage;

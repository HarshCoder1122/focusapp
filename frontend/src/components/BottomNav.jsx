import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    LayoutDashboard,
    Timer,
    CalendarCheck,
    Wallet,
    User
} from "lucide-react";

const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { path: "/focus", icon: Timer, label: "Focus" },
    { path: "/planner", icon: CalendarCheck, label: "Planner" },
    { path: "/wallet", icon: Wallet, label: "Wallet" },
    { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <nav className="mobile-nav md:hidden">
            <div className="flex items-center justify-around py-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className="flex flex-col items-center gap-1 py-2 px-4 relative"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-primary/10 rounded-xl"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <Icon
                                className={`w-5 h-5 relative z-10 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"
                                    }`}
                            />
                            <span
                                className={`text-xs relative z-10 font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"
                                    }`}
                            >
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;

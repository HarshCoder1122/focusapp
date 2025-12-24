import React from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";

const CoinDisplay = ({
    coins = 0,
    todayCoins = null,
    size = "md",
    showLabel = true,
    animate = true
}) => {
    const sizes = {
        sm: { icon: "w-4 h-4", text: "text-lg", container: "gap-1" },
        md: { icon: "w-5 h-5", text: "text-xl", container: "gap-2" },
        lg: { icon: "w-8 h-8", text: "text-3xl", container: "gap-3" },
        xl: { icon: "w-10 h-10", text: "text-4xl", container: "gap-4" }
    };

    const s = sizes[size] || sizes.md;

    return (
        <div className={`flex items-center ${s.container}`}>
            <motion.div
                animate={animate ? { rotateY: [0, 360] } : {}}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 5 }}
                className={`${s.icon} text-accent`}
            >
                <Coins className="w-full h-full" />
            </motion.div>
            <div className="flex flex-col">
                <motion.span
                    key={coins}
                    initial={animate ? { scale: 1.2 } : {}}
                    animate={{ scale: 1 }}
                    className={`${s.text} font-bold`}
                >
                    {coins.toLocaleString()}
                </motion.span>
                {showLabel && todayCoins !== null && todayCoins > 0 && (
                    <span className="text-xs text-success font-medium">
                        +{todayCoins} today
                    </span>
                )}
            </div>
        </div>
    );
};

export default CoinDisplay;

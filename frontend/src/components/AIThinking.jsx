import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Brain } from "lucide-react";

const AIThinking = ({ message = "RevealIQ AI is thinking..." }) => {
    return (
        <div className="flex flex-col items-center justify-center py-8 px-4">
            {/* Animated Brain Icon */}
            <div className="relative mb-4">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.7, 1, 0.7]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center"
                >
                    <Brain className="w-8 h-8 text-primary" />
                </motion.div>

                {/* Orbiting sparkles */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        animate={{
                            rotate: 360
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear",
                            delay: i * 1
                        }}
                        className="absolute inset-0"
                        style={{ transformOrigin: "center center" }}
                    >
                        <motion.div
                            animate={{
                                scale: [0.8, 1.2, 0.8],
                                opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.3
                            }}
                            className="absolute -top-1 left-1/2 -translate-x-1/2"
                        >
                            <Sparkles className="w-4 h-4 text-accent" />
                        </motion.div>
                    </motion.div>
                ))}
            </div>

            {/* Message with typing effect dots */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                    {message}
                </span>
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{
                                y: [-2, 2, -2],
                                opacity: [0.4, 1, 0.4]
                            }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.2
                            }}
                            className="w-1.5 h-1.5 rounded-full bg-primary"
                        />
                    ))}
                </div>
            </div>

            {/* Pulsing gradient bar */}
            <motion.div
                animate={{
                    scaleX: [0.3, 1, 0.3],
                    opacity: [0.3, 0.7, 0.3]
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500"
            />
        </div>
    );
};

export default AIThinking;

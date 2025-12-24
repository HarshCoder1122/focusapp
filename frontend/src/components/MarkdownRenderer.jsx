import React from "react";

/**
 * Simple Markdown Renderer Component
 * Handles basic markdown: **bold**, *italic*, headers, lists, tables, and emojis
 */
const MarkdownRenderer = ({ content, className = "" }) => {
    if (!content) return null;

    const renderLine = (line, idx) => {
        // Handle headers
        if (line.startsWith("### ")) {
            return <h3 key={idx} className="text-lg font-bold mt-4 mb-2">{parseLine(line.slice(4))}</h3>;
        }
        if (line.startsWith("## ")) {
            return <h2 key={idx} className="text-xl font-bold mt-4 mb-2">{parseLine(line.slice(3))}</h2>;
        }
        if (line.startsWith("# ")) {
            return <h1 key={idx} className="text-2xl font-bold mt-4 mb-3">{parseLine(line.slice(2))}</h1>;
        }

        // Handle horizontal rule
        if (line.trim() === "---") {
            return <hr key={idx} className="my-4 border-border" />;
        }

        // Handle unordered list items
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
            const indent = line.search(/\S/);
            return (
                <div key={idx} className="flex items-start gap-2" style={{ marginLeft: indent > 0 ? indent * 8 : 0 }}>
                    <span className="text-primary mt-1.5">•</span>
                    <span>{parseLine(line.trim().slice(2))}</span>
                </div>
            );
        }

        // Handle numbered list items
        const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
            const indent = line.search(/\S/);
            return (
                <div key={idx} className="flex items-start gap-2" style={{ marginLeft: indent > 0 ? indent * 8 : 0 }}>
                    <span className="text-primary font-medium min-w-[1.5rem]">{numberedMatch[1]}.</span>
                    <span>{parseLine(numberedMatch[2])}</span>
                </div>
            );
        }

        // Handle table rows
        if (line.includes("|") && line.trim().startsWith("|")) {
            const cells = line.split("|").filter(c => c.trim() !== "");
            // Skip separator rows (like |---|---|)
            if (cells.every(c => c.trim().match(/^-+$/))) {
                return null;
            }
            const isHeader = idx === 0 || (content.split("\n")[idx + 1]?.includes("---"));
            return (
                <div key={idx} className={`grid gap-2 py-2 px-2 ${isHeader ? "font-bold bg-muted/50 rounded-t-lg" : "border-b border-border/50"}`}
                    style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
                    {cells.map((cell, i) => (
                        <span key={i} className="text-sm">{parseLine(cell.trim())}</span>
                    ))}
                </div>
            );
        }

        // Handle empty lines
        if (line.trim() === "") {
            return <div key={idx} className="h-2" />;
        }

        // Regular paragraph
        return <p key={idx} className="mb-1">{parseLine(line)}</p>;
    };

    const parseLine = (text) => {
        if (!text) return text;

        // Parse inline formatting
        const parts = [];
        let remaining = text;
        let key = 0;

        // Process **bold** and *italic* patterns
        const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            if (match[1]) {
                // **bold**
                parts.push(<strong key={key++} className="font-bold text-foreground">{match[2]}</strong>);
            } else if (match[3]) {
                // *italic*
                parts.push(<em key={key++} className="italic">{match[4]}</em>);
            } else if (match[5]) {
                // `code`
                parts.push(<code key={key++} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{match[6]}</code>);
            }

            lastIndex = regex.lastIndex;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    const lines = content.split("\n");

    return (
        <div className={`markdown-content text-sm leading-relaxed ${className}`}>
            {lines.map((line, idx) => renderLine(line, idx))}
        </div>
    );
};

export default MarkdownRenderer;

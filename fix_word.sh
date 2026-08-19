sed -i '1795,1805c\
    const pageChunks = chunkRows(rows, 2);\
    const totalPages = Math.max(1, pageChunks.length);\
\
    const formatWordCell = (text: string) => {\
        if (!text) return "";\
        let formatted = text.replace(/</g, "\\&lt;").replace(/>/g, "\\&gt;").replace(/\\n/g, "<br/>");\
        // Highlight lines with alert icon or numbers that are highlighted in UI\
        formatted = formatted.replace(/(.*(?:⚠|⚠️).*)/g, '"'"'<span style="color: #dc2626; font-weight: bold;">$1</span>'"'"');\
        return formatted;\
    };\
' src/components/HandoverView.tsx

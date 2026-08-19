sed -i '2490,2497c\
    const handleDownloadDoc = () => {\
      const formatWordCell = (text: string) => {\
        if (!text) return "";\
        let formatted = text.replace(/</g, "\\&lt;").replace(/>/g, "\\&gt;").replace(/\\n/g, "<br/>");\
        formatted = formatted.replace(/(.*(?:⚠|⚠️).*)/g, '"'"'<span style="color: #dc2626; font-weight: bold;">$1</span>'"'"');\
        return formatted;\
      };\
      let htmlBody = "";\
' src/components/HandoverView.tsx

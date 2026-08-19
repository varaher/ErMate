sed -i '1667,1668c\
      let toBeDoneText = "";\
      if (card?.toBeDone && card.toBeDone.length > 0) {\
        toBeDoneText = card.toBeDone.map(t => `□ ${t}`).join("\\n");\
' src/components/HandoverView.tsx

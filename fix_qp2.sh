sed -i '1657,1670c\
      const doneItems: string[] = [];\
      if (card?.done && card.done.length > 0) {\
        card.done.forEach(d => doneItems.push(`✓ ${d}`));\
      } else {\
        if (qp.vitals) doneItems.push(`✓ Vitals: ${qp.vitals}`);\
        if (planDoneLabsText) doneItems.push(planDoneLabsText);\
      }\
\
      if (invsFullText) doneItems.push(`\\n${invsFullText}`);\
\
      let toBeDoneText = "";\
' src/components/HandoverView.tsx

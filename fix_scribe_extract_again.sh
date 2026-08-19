sed -i '1625,1628c\
    const formattedData = {\
      name: ext.name || "Unknown Patient",\
' server.ts

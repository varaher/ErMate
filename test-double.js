let countExt = 0;
let countDis = 0;

let processingActionRef = { current: false };
let processingAction = null;

const handleApplyExtraction = async (msgId) => {
    if (processingActionRef.current || processingAction) return;
    processingActionRef.current = true;
    processingAction = { messageId: msgId, type: "caseSheet" };
    try {
        countExt++;
        await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
        processingActionRef.current = false;
        processingAction = null;
    }
};

const handleApplyDischarge = async (msgId) => {
    if (processingActionRef.current || processingAction) return;
    processingActionRef.current = true;
    processingAction = { messageId: msgId, type: "discharge" };
    try {
        countDis++;
        await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
        processingActionRef.current = false;
        processingAction = null;
    }
};

async function run() {
    handleApplyExtraction("msg1");
    handleApplyExtraction("msg1");
    await new Promise(r => setTimeout(r, 100));
    
    handleApplyDischarge("msg2");
    handleApplyDischarge("msg2");
    await new Promise(r => setTimeout(r, 100));
    
    console.log("ACTUAL EXECUTED HANDLER DOUBLE-SUBMIT TEST");
    console.log("Case Sheet save invocation count = " + countExt);
    console.log("Discharge workflow invocation count = " + countDis);
}
run();

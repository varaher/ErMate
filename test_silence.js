const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

async function test() {
  try {
    const { stderr } = await execFileAsync("ffmpeg", ["-f", "lavfi", "-i", "aevalsrc=0:d=10", "-af", "silencedetect=noise=-30dB:d=0.5", "-f", "null", "-"]);
    console.log(stderr);
  } catch(err) {
    console.log("ERR", err.stderr);
  }
}
test();

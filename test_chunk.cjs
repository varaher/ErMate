const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function test() {
  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tmpDir, `test_input_${timestamp}.wav`);
  const outputPattern = path.join(tmpDir, `test_output_${timestamp}_%03d.wav`);

  console.log("Generating 35 sec wav file...");
  await execFileAsync('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'aevalsrc=sin(440*2*PI*t)',
    '-t', '35',
    inputPath
  ]);

  console.log("Chunking...");
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-sample_fmt', 's16',
      '-f', 'segment',
      '-segment_time', '29',
      outputPattern
    ]);
    console.log("Chunking succeeded.");
    
    for(let i=0; i<5; i++) {
       const p = path.join(tmpDir, `test_output_${timestamp}_00${i}.wav`);
       if(fs.existsSync(p)) {
          console.log(p, fs.statSync(p).size);
       }
    }
  } catch (e) {
    console.error("Failed:", e);
  }
}
test();

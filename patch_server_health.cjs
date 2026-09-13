const fs = require('fs');

const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

// Update version endpoint
code = code.replace(
  'releaseNotes: "ErMate v3.0.0: Automatic backup server support, friendlier error messages, session clearing between patients, faster case sheet updates."',
  'releaseNotes: "ErMate v3.0.3: ffmpeg production fix, responsive chat composer layout.",\n    ffmpegAvailable: checkFfmpeg()'
);

// Update health check
code = code.replace(
  'anthropicConfigured: hasAnthropicKey,',
  'anthropicConfigured: hasAnthropicKey,\n    ffmpegAvailable: checkFfmpeg(),\n    ffmpegSource: "ffmpeg-static",'
);

// Add checkFfmpeg function above it
code = code.replace(
  '// Version & Build Info Endpoint',
  `function checkFfmpeg() {
  try {
    getFfmpegPath();
    return true;
  } catch (e) {
    return false;
  }
}

// Version & Build Info Endpoint`
);

fs.writeFileSync(path, code);
console.log('Patched server.ts successfully.');

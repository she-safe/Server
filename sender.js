const fs = require("fs/promises");
require("dotenv").config()

const AudioserverURL = process.env.AudioServerURL||"http://localhost:5000"

async function sendAudio(filePath) {
  // Read file fully into memory buffer
  const buffer = await fs.readFile(filePath);

  // Create Blob manually (safe for parallel uploads)
  const blob = new Blob([buffer], { type: "audio/m4a" });

  const form = new FormData();
  form.append("file", blob, "audio.m4a");

  const response = await fetch(`${AudioserverURL}/predict`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

module.exports = { sendAudio };

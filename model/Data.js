import mongoose from "mongoose";

const dataSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  score: Number,
  location: { latitude: Number, longitude: Number },

  //unified motion samples
  motionSamples: [
    [
      {
        t: { type: Number, required: true }, // timestamp in ms/seconds from client
        ax: Number,
        ay: Number,
        az: Number,
        gx: Number,
        gy: Number,
        gz: Number,
      },
    ],
  ],

  //  audio section untouched
  audioFiles: [
    {
      filename: String,
      storedName: String,
      mimeType: String,
      // path: String,
      size: Number,
      dangerIndex: Number,
      timestamp: { type: Date, default: Date.now },
    },
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


export const Data = mongoose.model("Data", dataSchema);
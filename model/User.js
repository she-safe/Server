import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: String,
  username: String,
  passwordHash: String,
});

export default mongoose.model("User", userSchema);

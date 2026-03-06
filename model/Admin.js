import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  adminId: String,
  adminName: String,
  passwordHash: String,
});

export default mongoose.model("Admin", adminSchema);

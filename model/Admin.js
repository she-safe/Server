import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  adminId: String,
  adminName: String,
  passwordHash: String,
});

export const Admin = mongoose.model("Admin", adminSchema);
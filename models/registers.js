const mongoose = require("mongoose");

// const Schema = mongoose.Schema;

const stuSchema = new mongoose.Schema(
  {
    rno: {
      type: Number,
      required: true,
      unique: true,
      min: 9,
    },
    gender: {
      type: String,
      required: true,
    },
    hostels: {
      type: String,
      required: true,
      min: 1,
    },
  },
  { timestamps: true }
);

const Register = new mongoose.model("Register", stuSchema);

module.exports = Register;

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    mobile: String,
    picture: String,
    role: { type: String, default: "user" },
    signature: String,
    conjunctionAgent: String,
    googleId: { type: String, required: true, unique: true },
    profileComplete: { type: Boolean, default: false },
    stripeCustomerId: { type: String }, // Stripe Customer ID
    paymentMethods: [
      {
        type: String, // Stripe Payment Method ID
      },
    ],
    accessToken: String,
    refreshToken: String,
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
module.exports = User;

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'],
    default: 'user'
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
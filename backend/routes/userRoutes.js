import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { NotificationEngine } from '../utils/notificationEngine.js';

const router = express.Router();
const VALID_ROLES = ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team', 'user'];

// GET all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// GET users by role
router.get('/role/:role', authenticate, authorize('admin', 'disaster_officer', 'rescue_team'), async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select('-password');
    res.json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// POST create user/team (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      name = '',
      username = '',
      email = '',
      password = 'Team@123',
      role = 'user',
    } = req.body;

    if (!String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(String(username).trim())) {
      return res.status(400).json({ error: 'Username must be 3-40 characters using letters, numbers, dot, underscore, or dash' });
    }
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid user role' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ username: String(username).trim() });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      username: String(username).trim(),
      email: String(email || '').trim(),
      password: hashed,
      role,
    });

    const safeUser = user.toObject();
    delete safeUser.password;

    await NotificationEngine.alertAdminAction({
      title: role === 'rescue_team' ? 'Rescue Team Created' : 'User Created',
      message: `${role === 'rescue_team' ? 'Rescue team' : 'User'} "${user.name}" was created with role ${user.role}.`,
      severity: 'info',
      target_role: 'admin',
      userId: req.user.id,
    });

    res.status(201).json({ status: 'success', data: safeUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// PUT update user role
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, name, email } = req.body;
    const updateData = {};
    if (role) updateData.role = role;
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const previous = await User.findById(req.params.id).select('-password');
    if (!previous) return res.status(404).json({ error: 'User not found' });

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { returnDocument: "after" }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await NotificationEngine.alertAdminAction({
      title: user.role === 'rescue_team' ? 'Rescue Team Updated' : 'User Updated',
      message: `"${user.name}" was updated${previous.role !== user.role ? ` from ${previous.role} to ${user.role}` : ''}.`,
      severity: 'info',
      target_role: 'admin',
      userId: req.user.id,
    });

    res.json({ status: 'success', data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// DELETE user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await NotificationEngine.alertAdminAction({
      title: user.role === 'rescue_team' ? 'Rescue Team Removed' : 'User Removed',
      message: `"${user.name}" (${user.role}) was removed from the system.`,
      severity: 'warning',
      target_role: 'admin',
      userId: req.user.id,
    });
    res.json({ status: 'success', message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// GET current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ status: 'success', data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
});

export { router as userRouter };


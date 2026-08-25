import User from '../models/User.js';
import bcrypt from 'bcryptjs';

const defaultRescueTeams = [
  { name: 'Team Alpha - Colombo Rescue Unit', username: 'rescue_alpha', email: 'rescue.alpha@relief.lk' },
  { name: 'Team Bravo - Kandy Boat Unit', username: 'rescue_bravo', email: 'rescue.bravo@relief.lk' },
  { name: 'Team Charlie - Southern Medical Rescue', username: 'rescue_charlie', email: 'rescue.charlie@relief.lk' },
  { name: 'Team Delta - Ratnapura Flood Response', username: 'rescue_delta', email: 'rescue.delta@relief.lk' },
  { name: 'Team Echo - Eastern Evacuation Unit', username: 'rescue_echo', email: 'rescue.echo@relief.lk' },
];

const createDefaultAdmin = async () => {
  try {
    const hashedDefaultPassword = await bcrypt.hash('Admin@123', 10);
    const existingAdmin = await User.findOne({ username: 'admin' });

    if (!existingAdmin) {
      await User.create({
        name: 'Administrator',
        username: 'admin',
        password: hashedDefaultPassword,
        role: 'admin',
      });

      console.log('Default admin created (admin / Admin@123)');
    } else {
      console.log('Admin already exists');
    }

    let createdTeamCount = 0;
    for (const team of defaultRescueTeams) {
      const existingTeam = await User.findOne({ username: team.username });
      if (existingTeam) continue;

      await User.create({
        ...team,
        password: hashedDefaultPassword,
        role: 'rescue_team',
      });
      createdTeamCount += 1;
    }

    if (createdTeamCount > 0) {
      console.log(`Default rescue teams created: ${createdTeamCount}`);
    } else {
      console.log('Rescue teams already exist');
    }
  } catch (err) {
    console.error('Default user creation error:', err.message);
  }
};

export default createDefaultAdmin;

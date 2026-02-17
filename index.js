const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/views/index.html');
});

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
});

const User = mongoose.model('User', userSchema);

const exerciseSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	duration: {
		type: Number,
		required: true,
	},
	date: {
		type: Date,
		required: true,
	},
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

app.post('/api/users', async (req, res) => {
	const username = (req.body.username || '').trim();
	if (!username) return res.status(400).json({ error: 'username is required' });

	const user = new User({ username: username });

	try {
		await user.save();
	} catch (error) {
		if (error.code === 11000) {
			return res.status(400).json({ error: 'username must be unique' });
		}
		return res.status(500).json({ error: 'Database error' });
	}
	res.json({
		username: user.username,
		_id: user._id,
	});
});

app.get('/api/users', async (req, res) => {
	const users = await User.find().select('-__v');
	res.json(users);
});

app.post('/api/users/:_id/exercises', async (req, res) => {
	const userId = req.params._id;
	const description = (req.body.description || '').trim();
	if (!description)
		return res.status(400).json({ error: 'description is required' });
	const duration = Number(req.body.duration);
	if (duration <= 0 || Number.isInteger(duration) === false)
		return res
			.status(400)
			.json({ error: 'duration must be an integer and greater than zero' });
	const date = req.body.date ? new Date(req.body.date) : new Date();
	if (isNaN(date.getTime()))
		return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
	const user = await User.findById(userId);

	if (!user) return res.status(404).json({ error: 'User not found' });

	const exercise = new Exercise({ userId, description, duration, date });
	await exercise.save();
	res.json({
		username: user.username,
		description: exercise.description,
		duration: exercise.duration,
		date: exercise.date.toDateString(),
		_id: user._id,
	});
});

app.get('/api/users/:_id/logs', async (req, res) => {
	const userId = req.params._id;
	const user = await User.findById(userId);

	if (!user) return res.status(404).json({ error: 'User not found' });

	const { from, to, limit } = req.query;

	const filter = { userId };

	const dateFilter = {};
	if (from) dateFilter.$gte = new Date(from);
	if (to) dateFilter.$lte = new Date(to);
	if (Object.keys(dateFilter).length > 0) filter.date = dateFilter;

	let query = Exercise.find(filter).sort({ date: 1 });

	if (limit !== undefined) {
		const lim = Number(limit);
		if (!Number.isInteger(lim) || lim < 0) {
			return res
				.status(400)
				.json({ error: 'limit must be a non-negative integer' });
		}
		query = query.limit(lim);
	}

	const totalCount = await Exercise.countDocuments(filter);

	const exercises = await query;

	const log = exercises.map((exercise) => ({
		description: exercise.description,
		duration: exercise.duration,
		date: exercise.date.toDateString(),
	}));
	console.log(log);
	res.json({
		username: user.username,
		count: totalCount,
		_id: user._id,
		log: log,
	});
});

mongoose
	.connect(process.env.MONGO_URI)
	.then(() => {
		const listener = app.listen(process.env.PORT || 3000, () => {
			console.log('Your app is listening on port ' + listener.address().port);
		});
	})
	.catch((err) => {
		console.error(err);
	});

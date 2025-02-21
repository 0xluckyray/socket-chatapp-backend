const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const auth = require('./../../middleware/auth');

const User = require('../../models/User');


router.get('/', auth,
async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/sign-in', 
async (req, res) => {
    try {
        const { email, password } = req.body;

        let user = await User.findOne({ email });

        if (!user){
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            config.get('jwtSecret'),
            { expiresIn: '5 days'},
            (err, token) => {
                if (err) throw err;
                res.json({ token, username: user.username });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.post('/sign-up', 
async (req, res) => {
    try {
        const { name, email, username, password } = req.body;

        let user = await User.findOne({ email });

        if (user) {
            console.log("User already exists", user.email);
            return res.status(400).json({ msg: 'User already exists' });
        }
        
        user = new User({
            name,
            email,
            username,
            password
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.json({ msg: 'Success' });

        // const payload = {
        //     user: {
        //         id: user.id
        //     }
        // };

        // jwt.sign(
        //     payload,
        //     config.get('jwtSecret'),
        //     { expiresIn: '5 days' },
        //     (err, token) => {
        //         if(err) throw err;
        //         res.json({token});
        //     }
        // );
    }
    catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
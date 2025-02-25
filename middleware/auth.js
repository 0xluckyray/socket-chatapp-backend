const jwt = require('jsonwebtoken');
const config = require('config');

module.exports = function(req, res, next){
    // Get token from the header
    const token = req.header('x-auth-token');

    // Check if token is not present
    if(!token){
        return res.status(401).json({msg: 'No token, authorization denied'});
    }

    // Verify token and authenticate user
    try {
        jwt.verify(token, config.get('jwtSecret'), (error, decoded) => {
            if (error) {
                return res.status(401).json({msg: 'Invalid token'});
            }
            else{
                req.user = decoded.user;
                next();
            }
        });
    } catch (error) {
        console.error("Middleware Token Verify error!");
        res.status(500).json({msg: 'Server error'});
    }
}
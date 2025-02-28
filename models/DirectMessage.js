const mongoose = require('mongoose');

const DirectMessageSchema = mongoose.Schema({
    dmid: {
        type: String,
        required: true
    },
    messages: [{
        id: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: String,
            required: true
        },
        sender: {
            type: String,
            required: true
        },
        receiver: {
            type: String,
            required: true
        }
    }]
});

module.exports = mongoose.model('direct-message', DirectMessageSchema);
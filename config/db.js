const config = require('config');
const mongoose = require('mongoose');
const db = config.get('mongoURI');

const connectDB = async () => {
    try{
        await mongoose.connect(db, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // useFindAndModify: false,
            // useCreateIndex: true
        });

        console.log("MongoDB connected ...");
    }
    catch(err){
        console.error(err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
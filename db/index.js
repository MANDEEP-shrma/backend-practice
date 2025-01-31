import mongoose from "mongoose";
import {DB_NAME} from '../src/constants.js'

const connectDB = async()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`MONGODB is connected successfully !!\nDB HOST:${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MONGO Connection Error : " ,error)
        process.exit(1)
    }
}


export default connectDB
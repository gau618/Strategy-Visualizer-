import mongoose from "mongoose";
import { DB_NAME } from "../constants/constants.js";
console.log("DB_NAME", DB_NAME);
export const connectDB = async () => {
       try{
        console.log(`${process.env.MONGODB_URL}/${DB_NAME}`)
        const connectionInstance = await mongoose.connect(
         `${process.env.MONGODB_URL}/${DB_NAME}`
        );
        console.log(
          `MongoDB connected !! at \n ${connectionInstance.connection.host}`
        );
       }catch(error){
        console.log("MONGODB CONNECTION ERROR", error);
        process.exit(1); 
      }
}
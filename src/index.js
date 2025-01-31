import 'dotenv/config'
import connectDB from "../db/index.js";
const PORT = process.env.PORT || 8000

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("App is not able to connect with the database.")
    })

    app.listen(PORT,()=>{
        console.log("Connection Successful with app at Port:",PORT)
    })
})
.catch((err)=>{
    console.log(`Err : connection failed with db : `,err)
})
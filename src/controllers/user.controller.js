import {asyncHandlerMain} from '../utils/asyncHandler.js'

const registerUser = asyncHandlerMain( async (req,res)=>{
    res.status(200).json({
        message:"OK"
    })
})

export {registerUser}
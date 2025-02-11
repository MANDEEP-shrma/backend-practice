import {asyncHandlerMain} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'

const registerUser = asyncHandlerMain( async (req,res)=>{
   //get user details which are needed
   //validation - not empty
   //check if user already exists: username, email
   //check for images and for avatar
   //upload them to cloudinary , does avatar uploaded
   //create user object - create entry in db
   //check for user creation
   //we remove password and tokens field from response
   //return the response

   const {fullName,email,username,password} = req.body
   console.log("fullName: ",fullName)

   //checking not empty validation
   if(
      [fullName,email,username,password].some((eachField)=>{
         return eachField?.trim() === ""
      })
   ){
      throw new ApiError(400,"All fields are compulsory")
   }

   //finding duplicate in the db
   const userExists = User.findOne({
      $or:[{ username },{ email }]
   })
   
   if(userExists){
      throw new ApiError(409,"The username or email already exists")
   }

   const avatarLocalPath = req.files?.Avatar[0]?.path
   const coverImgLocalPath = req.files?.CoverImage[0]?.path

   //checking the avatar
   if(!avatarLocalPath){
      throw new ApiError(400,"Avatar is required")
   }

   //Saving it on Cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImg = await uploadOnCloudinary(coverImgLocalPath)

   //again check the Avatar that it exit or not
   if(!avatar){
      throw new ApiError(400,"Avatar Save failed , Please re-insert the image")
   }

   //Entry in database
   const user = await User.create({
      fullName,
      email,
      avatar:avatar.url,
      coverImage: coverImg? coverImg.url : "",
      username : username.toLowerCase(),
      password
   })

   //checking the user that it got created or not.
   const userCreationCheck = await User.findById(user._id).select(
      "-password -refreshToken"
   )

   if(!userCreationCheck){
      throw new ApiError(500, "Something went wrong while registering the user.")
   }

   //returning the response.
   return res.status(201).json(
      new ApiResponse(200,userCreationCheck,"User Registered Successfully")
   )
})

export {registerUser}
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

   const {fullname,email,username,password} = req.body
   console.log("fullName: ",fullname)

   //checking not empty validation
   if(
      [fullname,email,username,password].some((eachField)=>{
         return eachField?.trim() === ""
      })
   ){
      throw new ApiError(400,"All fields are compulsory")
   }

   //finding duplicate in the db
   const userExists = await User.findOne({
      $or:[{ username },{ email }]
   })
   
   if(userExists){
      throw new ApiError(409,"The username or email already exists")
   }

   const avatarLocalPath = req.files?.avatar[0]?.path
   // const coverImgLocalPath = req.files?.coverImage[0]?.path
   let coverImgLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
      coverImgLocalPath = req.files.coverImage[0].path
   }else{
      coverImgLocalPath = null;
   }

   //checking the avatar
   if(!avatarLocalPath){
      throw new ApiError(400,"Avatar is required")
   }

   //Saving it on Cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   let coverImg;
   if(coverImgLocalPath){
       coverImg = await uploadOnCloudinary(coverImgLocalPath)
   }else{
      coverImg = null
   }

   //again check the Avatar that it exit or not
   if(!avatar){
      throw new ApiError(400,"Avatar Save failed , Please re-insert the image")
   }

   //Entry in database
   const user = await User.create({
      fullname,
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
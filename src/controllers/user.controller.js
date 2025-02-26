import { asyncHandlerMain } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating Access and Refresh Tokens"
    );
  }
};

const registerUser = asyncHandlerMain(async (req, res) => {
  //get user details which are needed
  //validation - not empty
  //check if user already exists: username, email
  //check for images and for avatar
  //upload them to cloudinary , does avatar uploaded
  //create user object - create entry in db
  //check for user creation
  //we remove password and tokens field from response
  //return the response

  const { fullname, email, username, password } = req.body;
  console.log("fullName: ", fullname);

  //checking not empty validation
  if (
    [fullname, email, username, password].some((eachField) => {
      return eachField?.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields are compulsory");
  }

  //finding duplicate in the db
  const userExists = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExists) {
    throw new ApiError(409, "The username or email already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImgLocalPath = req.files?.coverImage[0]?.path
  let coverImgLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImgLocalPath = req.files.coverImage[0].path;
  } else {
    coverImgLocalPath = null;
  }

  //checking the avatar
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  //Saving it on Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  let coverImg;
  if (coverImgLocalPath) {
    coverImg = await uploadOnCloudinary(coverImgLocalPath);
  } else {
    coverImg = null;
  }

  //again check the Avatar that it exit or not
  if (!avatar) {
    throw new ApiError(400, "Avatar Save failed , Please re-insert the image");
  }

  //Entry in database
  const user = await User.create({
    fullname,
    email,
    avatar: avatar.url,
    coverImage: coverImg ? coverImg.url : "",
    username: username.toLowerCase(),
    password,
  });

  //checking the user that it got created or not.
  const userCreationCheck = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreationCheck) {
    throw new ApiError(500, "Something went wrong while registering the user.");
  }

  //returning the response.
  return res
    .status(201)
    .json(
      new ApiResponse(200, userCreationCheck, "User Registered Successfully")
    );
});

const loginUser = asyncHandlerMain(async (req, res) => {
  //req body -> data
  //username or email
  //find the user
  //password check
  //access token and refresh token generation
  //send cookie

  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or Email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User doesn't exists");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password is Invalid");
  }

  const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  //we are sending the loggedInUser as a response to the frontend so I don't want that my password and refreshToken will also pass on.
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  //option for cookies
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn SuccessFully"
      )
    );
});

const logoutUser = asyncHandlerMain(async (req, res) => {
  await User.findByIdAndUpdate(
    //we are able to access id here because of auth.middleware.js there
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User LoggedOut Successfully"));
});

const refreshAccessToken = asyncHandlerMain(async(req,res)=>{
  //here we are taking our refreshToken from cookies (from body if the request is coming from an app.)
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorized Request")
  }

 try {
  //first toh check token humne bnaya hai.
   const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
  //then we will check bhai jo isne data diya hai aisa koi exist bhi karta hai.
   const user = await User.findById(decodedToken?._id)
 
   if(!user){
     throw new ApiError(401,"Invalid Refresh Token")
   }
 
   //database kai token se match karta hai.
   if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError(401,"Refresh is Token is Expired or Invalid")
   }
 
   const options = {
     httpOnly:true,
     secure:true,
   }
   
   //why doing this 1.access token toh banega usi kai liye toh yha aaya hai.
   //2.refresh token :- ek baar woh refresh token nai access token bnaya liya toh abb usko 
   //change kardenge wrna kisi kai haath lag gya toh kat
   const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
   
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",newRefreshToken,options)
   .json(
     new ApiResponse(200,{accessToken,newRefreshToken},"Access Token Refreshed Successfully")
   )
 
 } catch (error) {
    throw new ApiError(401,error?.message || "Invalid Refresh token")
 }
})

const changeCurrentPassword = asyncHandlerMain(async(req,res)=>{
  const {oldPassword,newPassword} = req.body

  const userId = req.user?._id;

  const user = await User.findById(userId)
  
  //because first we check "the password passed by them is correct or not."
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid old Password");
  }

  //we are not doing bcrypt here because it is happening using .pre() in model
  user.password = newPassword;

  await user.save({validateBeforeSave:false})
})

const getCurrentUser = asyncHandlerMain(async(req,res)=>{
  res.status(200)
  .json(200,req.user,"current user fetched successfully")    
})

const updateAccount =  asyncHandlerMain(async(req,res)=>{
  const {fullName,email} = req.body

  if(!fullName || !email){
    throw new ApiError(400,"All fields are required")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,{
    $set:{
      fullName,
      email,
    }
  },{new: true}).select("-password")

  return res.status(200)
  .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateAvatar = asyncHandlerMain(async(req,res)=>{
  const avatarLocalPath = req.file?.path
  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing")
  }
  
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  
  if(!avatar.url){
    throw new ApiError(400,"Error while uploading on cloudinary")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      avatar:avatar.url
    },
    {new:true}
  ).select("-password")


  return res.status(200)
  .json(new ApiResponse(200,user,"Avatar is updated Successfully"))
})

const updateUserCoverImage = asyncHandlerMain(async(req,res)=>{
  const coverImageLocalPath = req.file?.path;
  if(!coverImageLocalPath){
    throw new ApiError(400,"Cover Image is missing.")
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if(!coverImage.url){
    throw new ApiError(400,"Error while uploading on cloudinary");
  }

  const user = await User.findByIdAndUpdate(req.user._id,
    {
      coverImage:coverImage.url
    },
    {new:true}
  ).select("-password")

  return res.status(200)
  .json(new ApiResponse(200,user,"CoverImage is updated Successfully"))
})

export { registerUser, loginUser, logoutUser,refreshAccessToken ,changeCurrentPassword,getCurrentUser,updateAccount,updateAvatar,updateUserCoverImage};

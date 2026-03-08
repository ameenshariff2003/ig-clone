const express =  require("express")
const User = require("../models/user.model")
const crypto = require("crypto")
const jwt = require("jsonwebtoken")

const auth = {
    signup : async(req,res)=>{
        const {userName,email,password,bio,image} = req.body

        const userExist = await User.findOne({
            $or:[
                {userName},
                {email}
            ]
        })

        if(userExist){
                return res.status(409).json({
                msg : "User Exist "
            })
        }

        const hash = crypto.createHash("sha256").update(password).digest("hex")
         

        const result = await User.create({
            userName,
            email,
            password:hash,
            bio,
            image
        })

        const token = jwt.sign(
            {
            id:result._id
            },

            process.env.JWT_Key,
        
            {expiresIn:"1d"}
        )
        res.cookie("token",token)

        res.status(201),json({
            msg : "User Profile Created Successfully",
            user:{
                email:result.email,
                userName:result.userName

            }
        })


    },

    login:async(req,res)=>{

       const {userName,password,email} = req.body;
       const igUser = await User.findOne({
         $or:[
                {userName},
                {email}
            ]
       })

       if(!igUser){
         return res.status(400).json({
                msg : "User Not Found "
        })
       }

       const hash = crypto.createHash("sha256").update(password).digest("hex")

       if(igUser.password === hash){

        const token = jwt.sign(
            {
            id:igUser._id
            },

            process.env.JWT_Key,
        
            {expiresIn:"1d"}
        )
        res.cookie("token",token)

         res.status(200).json({
            msg : "User Logged In Successfully",
            user:{
                email:igUser.email,
                userName:igUser.userName

            }
        })

       }else{
        res.status(401).json({
            msg :"User Name or Passcode may be wrong"
        })
       }


    },

    logout:async(req,res)=>{

        try{
             res.clearCookie("token");

        res.status(200).json({
            msg:"logout success"
        })

        }catch(err){

        res.status(500).json({
            msg:"failed"
        })

        }

       


    }

}

module.exports= auth
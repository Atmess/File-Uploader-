const bcrypt= require("bcryptjs")
const prisma= require("../lib/prisma")
require("dotenv").config();
const {validationResult}= require("express-validator")
const {fs} =require("fs")


const createUserPost = async (req,res)=>{
    const error = validationResult(req);
    if(!error.isEmpty()){
       return res.render("register",{errors:error.array()})
    }
    try{
    const {email,username,password}=req.body
        const hashpassw = await bcrypt.hash(password,10)
        await prisma.user.create({
            data:{
                email:email,
                username:username,
                password:hashpassw,
                

            },
        })
        res.redirect("/log-in")
    }catch(error){
        console.log(error)
        res.status(400).send("Error registering User")
    }
}

const uploadfile = async (req,res)=>{
    try{
    const file = req.file
    if(!file){
        return res.status(400).send("no file send")
    }
    await prisma.file.create({
        data:{
            name: file.originalname,  // The original name from the user's computer
            size: file.size,          // The size in bytes
            url: file.path,           // Where Multer saved the file
            userId: req.user.id       // The logged-in user from Passport
        }
    })
    res.redirect("/")
    }catch(error){
        console.error(error)
        res.status(500).send("error saving the file")
    }
}

const dashboard = async (req,res) => {
    if(!req.user){
       return res.render("index",{user:null , files:[], folders:[]})
    }
    try{
    const folderuser = await prisma.folder.findMany({
        where:{userId:req.user.id}
    })
    const fileuser = await prisma.file.findMany({
        where:{userId: req.user.id,
        folderId: null //
        }
    })

    res.render("index",{user:req.user , files:fileuser, folders:folderuser})
    }catch(error){
        console.error(error)
        res.status(500).send("error loading file")
    }
    
}

const createFolderPost = async (req,res) => {

    if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
        const foldername = req.body.foldername;

        await prisma.folder.create({
            data:{
                name:foldername,
                userId:req.user.id
            }
        })
        res.redirect("/")
    } catch(error){
        console.error(error)
        res.status(500).send("error creating folder")
    }
}

const getFolderGet = async (req,res) => {

    if (!req.user) {
        return res.redirect("/log-in");
    }

try{
    const folder_Id= parseInt(req.params.id);
    const folder = await prisma.folder.findMany({
        where:{userId:req.user.id}
    })
    const fileinFolder = await prisma.file.findMany({
        where:{folderId: folder_Id}
    })

    res.render("index",{user:req.user ,files:fileinFolder , folders:folder})
}catch(error){
    console.error(error)
    res.status(500).send("error in getting Folder")
}
}
module.exports={createUserPost,uploadfile,dashboard,createFolderPost,getFolderGet}
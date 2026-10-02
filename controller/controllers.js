const bcrypt= require("bcryptjs")
const prisma= require("../lib/prisma")
require("dotenv").config();
const {validationResult}= require("express-validator")
const fs =require("fs")


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

const deletefilePost = async (req,res) => {
     if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
        const fileId = parseInt(req.params.id)
       // 1. Find the file FIRST so we know the URL/path on your hard drive
        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        // Security check: Make sure the file exists and the logged-in user actually owns it!
        if (!file || file.userId !== req.user.id) {
            return res.status(403).send("Unauthorized to delete this file.");
        }

        // 2. Delete the actual file from your "uploads" folder
        // We check if it exists first so the server doesn't crash if the file is already gone
        if (fs.existsSync(file.url)) {
            fs.unlinkSync(file.url); 
        }

        // 3. Delete the record from Prisma
        await prisma.file.delete({
            where: { id: fileId }
        });

        // 4. Send the user back to their dashboard!
        res.redirect("/");
    }catch(error){
        console.error(error)
        res.status(500).send("error deleting file")
    }
}

const deletefolderPost = async (req,res) => {
    if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
        const folderId= parseInt(req.params.id)
        const folder = await prisma.folder.findUnique({
            where:{id:folderId}
        }) 
        if(!folder || folder.userId !== req.user.id){
            return res.status(403).send("Unauthorized to delete this folder.")
        }

        // 1. Find ALL files that are inside this folder
        const fileinfolder = await prisma.file.findMany({
            where:{folderId:folderId}
        })
        // 2. Loop through them and delete every physical file from your hard drive
        for(const file in fileinfolder){
            if(fs.existsSync(file.url)){
                fs.unlinkSync(file.url)
            }
        }
        // 3. Delete the file records from the database
        await prisma.file.deleteMany({
            where:{folderId:folderId}
        })
        // 4. Finally, delete the empty folder from the database
        await prisma.folder.delete({
            where: { id: folderId }
        });
        res.redirect("/")

    }catch(error){
        console.error(error)
        res.status(500).send("error deleting folder")
    }
    
}
module.exports={createUserPost,uploadfile,dashboard,createFolderPost,getFolderGet,deletefilePost,deletefolderPost}
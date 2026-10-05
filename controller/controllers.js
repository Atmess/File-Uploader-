const bcrypt= require("bcryptjs")
const prisma= require("../lib/prisma")
require("dotenv").config();
const {validationResult}= require("express-validator")
const fs =require("fs");
const path = require("path");
const multer = require("multer");
const { createClient, AuthWeakPasswordError } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const DURATIONS = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

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
    if (!req.user) return res.redirect('/log-in');
    try{
    const file = req.file
    if(!file){
        return res.status(400).send("no file send")
    }
    const uniqeName = `${Date.now()}-${file.originalname}`
    const {data,error}= await supabase.storage.from('File_upload').upload(uniqeName,file.buffer,{
        contentType:file.mimetype
    })
    if(error) throw error;
    const targetFolderId = parseInt(req.params.id)
    const {data :publicUrlData}= supabase.storage.from('File_upload').getPublicUrl(uniqeName)
    const fileUrl = publicUrlData.publicUrl 
    await prisma.file.create({
        data:{
            name: file.originalname,  // The original name from the user's computer
            size: file.size,          // The size in bytes
            url: fileUrl,           // Where Multer saved the file
            userId: parseInt(req.user.id),
            folderId:req.params.id? targetFolderId:null    // The logged-in user from Passport
        }
    })
        if (targetFolderId) {
            res.redirect(`/folder/${targetFolderId}`);
        } else {
            res.redirect("/");
        }
    }catch(error){
        console.error(error)
        res.status(500).send("error saving the file")
    }
}

const dashboard = async (req,res) => {
    if(!req.user){
       return res.render("index",{user:null , files:[], folders:[] ,currentFolderId: null})
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
   
    res.render("index",{user:req.user , files:fileuser, folders:folderuser,currentFolderId: null})
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

    res.render("index",{user:req.user ,files:fileinFolder , folders:folder ,currentFolderId: folder_Id})
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
        if (!file || file.userId !== parseInt(req.user.id)) {
            return res.status(403).send("Unauthorized to delete this file.");
        }

        const fileName = decodeURIComponent(file.url.split('/').pop())
        const {error:storageError} = await supabase.storage.from('File_upload').remove([fileName])       
        if(storageError){
            console.error("Supabase deletion error:", storageError)
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
        if(!folder || folder.userId !== parseInt(req.user.id)){
            return res.status(403).send("Unauthorized to delete this folder.")
        }

        // 1. Find ALL files that are inside this folder
        const fileinfolder = await prisma.file.findMany({
            where:{folderId:folderId}
        })
        // 2. Loop through them and delete every physical file from your hard drive
       if(fileinfolder.length>0){
        const fileNames = fileinfolder.map(file=>decodeURIComponent(file.url.split('/').pop()))
        const {error:storageError}=await supabase.storage.from('File_upload').remove(fileNames)
        if (storageError) {
                console.error("Supabase folder files deletion error:", storageError);
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

const moveFilePost = async (req,res) => {
      if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
    const fileId = parseInt(req.params.id);
   const tofolderId = req.body.toFolder === "" ? null : parseInt(req.body.toFolder);
    const file = await prisma.file.findUnique({
        where:{id:fileId}
    })
    if (!file || file.userId !== req.user.id) {
            return res.status(403).send("Unauthorized to move this file.");
        }

        await prisma.file.update({
            where:{id:fileId},
            data:{
                folderId:tofolderId
            }
        })
        if (tofolderId === null) {
            res.redirect("/");
        } else {
            res.redirect(`/folder/${tofolderId}`);
        }
    }catch(error){
        console.error(error)
        res.status(500).send("error sending File")
    }
}

const editfoldernamePost = async (req,res)=>{
    if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
    const folderId = parseInt(req.params.id);
    const updatename = req.body.editname;
    const folder = await prisma.folder.findUnique({
        where:{id:folderId}
    })

    if(!folder || folder.userId !== req.user.id){
        return res.status(403).send("Unauthorized to edit this folder.")
    }
        await prisma.folder.update({
            where:{id:folderId},
            data:{
                name:updatename
            }
        })
        res.redirect("/")
    }catch(error){
        console.error(error);
        res.status(500).send("error to change folder name")
        
    }

}
const editfilename = async (req,res) => {
      if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
    const fileId = parseInt(req.params.id);
    const updatename = req.body.editfilename;
    const file = await prisma.file.findUnique({
        where:{id:fileId}
    })

    if(!file || file.userId !== parseInt(req.user.id)){
        return res.status(403).send("Unauthorized to edit this file.")
    }
        await prisma.file.update({
            where:{id:fileId},
            data:{
                name:updatename
            }
        })
        res.redirect("/")
    }catch(error){
        console.error(error);
        res.status(500).send("error to change file name")
        
    }
}

const fileinfoGet=async (req,res)=>{
      if (!req.user) {
        return res.redirect("/log-in");
    }
try{
    const  fileId = parseInt(req.params.id);
    const folder = await prisma.folder.findMany({
        where:{userId:req.user.id}
    })
    const file = await prisma.file.findUnique({
        where:{id:fileId},
        include:{
            user:true,
            folder:true
        }
    })

    if(!file || file.userId !== parseInt(req.user.id)){
        return res.status(403).send("Unauthorized to edit this file.")
    }
    res.render("file-info",{file:file,user:req.user,folders:folder})
}catch(err){
    console.log(err)
    res.status(500).send("error get file info")
}
}

const downloadFileGet = async (req,res)=>{
    if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
    const fileId = parseInt(req.params.id)
    const file = await prisma.file.findUnique({
        where:{id:fileId}
    })
    if(!file || file.userId !== req.user.id){
        return res.status(403).send("Unauthorized to edit this file.")
    }
    const fileUrl = decodeURIComponent(file.url)
    const urlPath = new URL(fileUrl).pathname
    const fileExtension = path.extname(urlPath);
        
        // 2. Check if the file.name already has the extension. If not, add it!
        let downloadName = file.name;
        if (!downloadName.endsWith(fileExtension)) {
            downloadName += fileExtension;
        }
    const response = await fetch(fileUrl);

    if (!response.ok) {
      return res.status(404).send("File not found on remote storage.");
    }
    // 5. Set headers to force browser file download with custom filename
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);

    // 6. Pipe the readable stream directly to Node's express response
    const { Readable } = require('stream');
    Readable.fromWeb(response.body).pipe(res);


    }catch(err){
        console.error(err)
        res.status(500).send("error downloading file")
    }
}

const shareLinkPost = async (req,res)=>{
        if (!req.user) {
        return res.redirect("/log-in");
    }
    try{
        const folderId = parseInt(req.params.id)
        const folder = await prisma.folder.findUnique({
            where:{id:folderId}
        })
        if(!folder || folder.userId !== req.user.id){
            return res.status(403).send("unautorize to do this")
        }
        const duration = req.body.duration
        const durationinMs = DURATIONS[duration] || DURATIONS['1d']
        const expireat = new Date(Date.now() + durationinMs)
        const shareLink = await prisma.shareLink.create({
            data:{
                userId:req.user.id,
                folderId:folderId,
                expiresAt:expireat
            }
        })

        res.redirect(`/share-created/${shareLink.id}`)
    }catch(error){
        console.error(error)
        res.status(500).send("error in creating link")
    }
}

const shareLinkResultGet = async (req, res) => {
  if (!req.user) {
    return res.redirect("/log-in");
  }

  try {
    const shareId = req.params.id;

    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareId }
    });

    // Ensure the link exists and belongs to the logged-in user
    if (!shareLink || shareLink.userId !== req.user.id) {
      return res.status(404).send("Share link not found");
    }

    const shareableUrl = `${req.protocol}://${req.get('host')}/share/${shareLink.id}`;

    res.render('share-result', {
      shareableUrl,
      expiresAt: shareLink.expiresAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading share link details");
  }
};
module.exports={createUserPost,uploadfile,dashboard,createFolderPost,getFolderGet,deletefilePost,deletefolderPost,moveFilePost,editfoldernamePost,editfilename,fileinfoGet,
    downloadFileGet,shareLinkPost,shareLinkResultGet
}
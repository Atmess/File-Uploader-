const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
require("dotenv").config();
const { validationResult } = require("express-validator");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const DURATIONS = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

// Helper: Sanitize Filenames
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_");
}

// User Registration
const createUserPost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render("register", { errors: errors.array(),formData: req.body });
  }

  try {
    const { email, username, password } = req.body;
    const hashpassw = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        username,
        password: hashpassw,
      },
    });

    res.redirect("/log-in");
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(400).send("Error registering User");
  }
};

// File Upload
const uploadfile = async (req, res) => {
  if (!req.user) {
        req.flash('error', 'Please select a file to upload.');
        return res.redirect('/');
    }

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).send("No file uploaded.");
    }

    const userId = Number(req.user.id);
    const targetFolderId = req.params.id ? Number(req.params.id) : null;

    if (targetFolderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: targetFolderId },
      });
      if (!folder || folder.userId !== userId) {
        return res.status(403).send("Unauthorized to upload to this folder.");
      }
    }

    const safeFilename = sanitizeFilename(file.originalname);
    const uniqueName = `${Date.now()}-${safeFilename}`;

    const { error: uploadError } = await supabase.storage
      .from('File_upload')
      .upload(uniqueName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('File_upload')
      .getPublicUrl(uniqueName);

    await prisma.file.create({
      data: {
        name: file.originalname,
        size: file.size,
        url: publicUrlData.publicUrl,
        userId: userId,
        folderId: targetFolderId,
      },
    });

    if (targetFolderId) {
    req.flash('success', 'File uploaded successfully!');
    res.redirect(`/folder/${targetFolderId}`);
    } else {
    req.flash('success', 'File uploaded successfully!');
    res.redirect("/");
    }
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).send("Error saving the file");
  }
};

// Dashboard
const dashboard = async (req, res) => {
  if (!req.user) {
    return res.render("index", { user: null, files: [], folders: [], currentFolderId: null });
  }

  try {
    const userId = Number(req.user.id);
    const folderuser = await prisma.folder.findMany({
      where: { userId },
    });

    const fileuser = await prisma.file.findMany({
      where: {
        userId,
        folderId: null,
      },
    });

    res.render("index", {
      user: req.user,
      files: fileuser,
      folders: folderuser,
      currentFolderId: null,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).send("Error loading dashboard");
  }
};

// Create Folder
const createFolderPost = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const foldername = req.body.foldername;
    const userId = Number(req.user.id);

    await prisma.folder.create({
      data: {
        name: foldername,
        userId,
      },
    });

    res.redirect("/");
  } catch (error) {
    console.error("Create Folder Error:", error);
    res.status(500).send("Error creating folder");
  }
};

// Get Single Folder Contents
const getFolderGet = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const userId = Number(req.user.id);
    const folderId = Number(req.params.id);

    const folders = await prisma.folder.findMany({
      where: { userId },
    });

    const fileinFolder = await prisma.file.findMany({
      where: { folderId, userId },
    });

    res.render("index", {
      user: req.user,
      files: fileinFolder,
      folders,
      currentFolderId: folderId,
    });
  } catch (error) {
    console.error("Get Folder Error:", error);
    res.status(500).send("Error loading folder");
  }
};

// Delete File
const deletefilePost = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const fileId = Number(req.params.id);
    const userId = Number(req.user.id);

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      return res.status(403).send("Unauthorized to delete this file.");
    }

    const fileName = decodeURIComponent(file.url.split("/").pop());
    const { error: storageError } = await supabase.storage
      .from("File_upload")
      .remove([fileName]);

    if (storageError) {
      console.error("Supabase deletion error:", storageError);
    }

    await prisma.file.delete({
      where: { id: fileId },
    });

    res.redirect("/");
  } catch (error) {
    console.error("Delete File Error:", error);
    res.status(500).send("Error deleting file");
  }
};

// Delete Folder
const deletefolderPost = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const folderId = Number(req.params.id);
    const userId = Number(req.user.id);

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).send("Unauthorized to delete this folder.");
    }

    const filesInFolder = await prisma.file.findMany({
      where: { folderId },
    });

    if (filesInFolder.length > 0) {
      const fileNames = filesInFolder.map((file) =>
        decodeURIComponent(file.url.split("/").pop())
      );

      const { error: storageError } = await supabase.storage
        .from("File_upload")
        .remove(fileNames);

      if (storageError) {
        console.error("Supabase storage deletion error:", storageError);
      }
    }

    await prisma.file.deleteMany({
      where: { folderId },
    });

    await prisma.folder.delete({
      where: { id: folderId },
    });

    res.redirect("/");
  } catch (error) {
    console.error("Delete Folder Error:", error);
    res.status(500).send("Error deleting folder");
  }
};

// Move File
const moveFilePost = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const fileId = Number(req.params.id);
    const userId = Number(req.user.id);
    const tofolderId = req.body.toFolder === "" ? null : Number(req.body.toFolder);

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      return res.status(403).send("Unauthorized to move this file.");
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { folderId: tofolderId },
    });

    if (tofolderId === null) {
      res.redirect("/");
    } else {
      res.redirect(`/folder/${tofolderId}`);
    }
  } catch (error) {
    console.error("Move File Error:", error);
    res.status(500).send("Error moving file");
  }
};

// Edit Folder Name
const editfoldernamePost = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const folderId = Number(req.params.id);
    const userId = Number(req.user.id);
    const updatename = req.body.editname;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).send("Unauthorized to edit this folder.");
    }

    await prisma.folder.update({
      where: { id: folderId },
      data: { name: updatename },
    });

    res.redirect("/");
  } catch (error) {
    console.error("Edit Folder Name Error:", error);
    res.status(500).send("Error changing folder name");
  }
};

// Edit File Name
const editfilename = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const fileId = Number(req.params.id);
    const userId = Number(req.user.id);
    const updatename = req.body.editfilename;

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      return res.status(403).send("Unauthorized to edit this file.");
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { name: updatename },
    });

    res.redirect("/");
  } catch (error) {
    console.error("Edit File Name Error:", error);
    res.status(500).send("Error changing file name");
  }
};

// File Info Page
const fileinfoGet = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const fileId = Number(req.params.id);
    const userId = Number(req.user.id);

    const folders = await prisma.folder.findMany({
      where: { userId },
    });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        user: true,
        folder: true,
      },
    });

    if (!file || file.userId !== userId) {
      return res.status(403).send("Unauthorized to view this file.");
    }

    res.render("file-info", { file, user: req.user, folders });
  } catch (err) {
    console.error("File Info Error:", err);
    res.status(500).send("Error retrieving file details");
  }
};

// Download File
const downloadFileGet = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const fileId = Number(req.params.id);
    const userId = Number(req.user.id);

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      return res.status(403).send("Unauthorized to download this file.");
    }

    const fileUrl = decodeURIComponent(file.url);
    const urlPath = new URL(fileUrl).pathname;
    const fileExtension = path.extname(urlPath);

    let downloadName = file.name;
    if (!downloadName.endsWith(fileExtension)) {
      downloadName += fileExtension;
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.status(404).send("File not found on remote storage.");
    }

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);

    const { Readable } = require('stream');
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    console.error("Download Error:", err);
    res.status(500).send("Error downloading file");
  }
};

// Share Link Generation
const shareLinkPost = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const folderId = Number(req.params.id);
    const userId = Number(req.user.id);

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId) {
      return res.status(403).send("Unauthorized to share this folder.");
    }

    const duration = req.body.duration;
    const durationInMs = DURATIONS[duration] || DURATIONS['1d'];
    const expiresAt = new Date(Date.now() + durationInMs);

    const shareLink = await prisma.shareLink.create({
      data: {
        userId,
        folderId,
        expiresAt,
      },
    });

    res.redirect(`/share-created/${shareLink.id}`);
  } catch (error) {
    console.error("Share Link Error:", error);
    res.status(500).send("Error generating share link");
  }
};

// Share Link Result Page
const shareLinkResultGet = async (req, res) => {
  if (!req.user) return res.redirect("/log-in");

  try {
    const shareId = req.params.id;
    const userId = Number(req.user.id);

    const shareLink = await prisma.shareLink.findUnique({
      where: { id: shareId },
    });

    if (!shareLink || shareLink.userId !== userId) {
      return res.status(404).send("Share link not found.");
    }

    const shareableUrl = `${req.protocol}://${req.get('host')}/share/${shareLink.id}`;

    res.render('share-result', {
      shareableUrl,
      expiresAt: shareLink.expiresAt,
    });
  } catch (error) {
    console.error("Share Link Result Error:", error);
    res.status(500).send("Error loading share link page");
  }
};

module.exports = {
  createUserPost,
  uploadfile,
  dashboard,
  createFolderPost,
  getFolderGet,
  deletefilePost,
  deletefolderPost,
  moveFilePost,
  editfoldernamePost,
  editfilename,
  fileinfoGet,
  downloadFileGet,
  shareLinkPost,
  shareLinkResultGet,
};
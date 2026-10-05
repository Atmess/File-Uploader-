const { Router } = require("express");
const multer = require("multer");
const indexRouter = Router();
const controller = require("../controller/controllers");
const { body } = require("express-validator");
const passport = require("../config/passport");
const path = require("path");

// Define allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  // Archives & Compressed (RAR, ZIP, 7Z)
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/octet-stream' // Browsers fall back to binary streams
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.7z'];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_MIME_TYPES.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed files: Images, Docs, ZIP, RAR, 7Z.'), false);
    }
  }
});

// Dashboard & Folders
indexRouter.get("/", controller.dashboard);
indexRouter.post("/folders/new", controller.createFolderPost);
indexRouter.get("/folder/:id", controller.getFolderGet);

// File Operations
indexRouter.post("/deletefile/:id", controller.deletefilePost);
indexRouter.post("/deletefolder/:id", controller.deletefolderPost);
indexRouter.post("/movefile/:id", controller.moveFilePost);
indexRouter.post("/editname/:id", controller.editfoldernamePost);
indexRouter.post("/editfilename/:id", controller.editfilename);
indexRouter.get("/file/:id", controller.fileinfoGet);
indexRouter.get("/download/:id", controller.downloadFileGet);

// Share Links
indexRouter.post("/folders/:id/share", controller.shareLinkPost);
indexRouter.get("/share-created/:id", controller.shareLinkResultGet);

// Authentication - Login
indexRouter.get('/log-in', (req, res) => {
  res.render('log-in', { 
    error: req.flash('error')[0] // Captures Passport login failure messages
  });
});
indexRouter.post("/log-in", passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/log-in", // Changed from /failed to /log-in for retry
  failureMessage: true,
}));

// Authentication - Logout
indexRouter.get("/log-out", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

// Authentication - Register
indexRouter.get("/register", (req, res) => res.render("register"));
indexRouter.post("/register", [
  body("email")
    .trim()
    .isEmail().withMessage("Please enter a valid email address.")
    .normalizeEmail(),

  body("username")
    .trim()
    .notEmpty().withMessage("Username cannot be empty.")
    .escape(),

  body("password")   
    .isLength({ min: 5 }).withMessage("Password must be at least 5 characters long."),

  body("confirmPassword")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }
      return true;
    })
], controller.createUserPost);

// File Upload Route with Multer Middleware Error Catching
indexRouter.post(["/upload", "/upload/:id"], (req, res, next) => {
  upload.single("upload")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).send("File size too large! Maximum limit is 50 MB.");
      }
      return res.status(400).send(`Upload error: ${err.message}`);
    } else if (err) {
      return res.status(400).send(err.message);
    }
    next();
  });
}, controller.uploadfile);

module.exports = indexRouter;
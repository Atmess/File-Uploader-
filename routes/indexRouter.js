const { Router } = require("express");
const multer =require("multer")
const indexRouter = Router();
const controller = require("../controller/controllers");
const { body } = require("express-validator");
const passport = require("../config/passport");
const path = require("path")
const storage = multer.diskStorage({
  // 1. Tell Multer where to put the file
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  // 2. Tell Multer what to name the file
  filename: function (req, file, cb) {
    // Extract the original extension (e.g., ".png")
    const ext = path.extname(file.originalname);
    
    // Create a unique name: timestamp + random number + original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});
const upload = multer({storage:storage})

indexRouter.get("/",controller.dashboard);
indexRouter.post("/folders/new",controller.createFolderPost)
indexRouter.get("/folder/:id",controller.getFolderGet)
indexRouter.post("/deletefile/:id",controller.deletefilePost)
indexRouter.post("/deletefolder/:id",controller.deletefolderPost)
indexRouter.post("/movefile/:id",controller.moveFilePost)
indexRouter.get("/log-in",(req,res)=>res.render("log-in"))
indexRouter.post("/log-in",passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/failed",
    failureMessage: true,
  })
)
indexRouter.get("/log-out", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
})
indexRouter.get("/register",(req,res)=>res.render("register"))
indexRouter.post("/register",[
  // Validates format, normalizes it (lowercase), and removes extra spaces
  body("email")
    .trim()
    .isEmail().withMessage("Please enter a valid email address.")
    .normalizeEmail(),

  // Removes extra spaces, ensures it's not empty, and neutralizes HTML
  body("username")
    .trim()
    .notEmpty().withMessage("Username cannot be empty.")
    .escape(),

  // Checks length, but does NOT modify or escape the raw characters
  body("password")
    .isLength({ min: 5 }).withMessage("Password must be at least 5 characters long."),

  // Compares this field to the password field
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match.");
    }
    return true;
  })
],controller.createUserPost)
indexRouter.post(["/upload","/upload/:id"],upload.single("upload"),controller.uploadfile)
module.exports=indexRouter;
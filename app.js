require("dotenv/config")
const path = require("path")
const express = require("express")
const app = express();
const PORT = process.env.PORT || 8080;
const passport = require("./config/passport")
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const session = require ("express-session")
const prisma = require("./lib/prisma")
const indexRouter = require("./routes/indexRouter")
const flash = require('connect-flash')



app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static("uploads"));
app.set("view engine", "ejs");


app.use(
  session({
    secret: process.env.SESSION_SECRET || "cats",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, // Cleans up expired sessions every 2 minutes
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(flash());
app.use((req, res, next) => {
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));
app.use("/",indexRouter);


app.listen(PORT, (error) => {
  if (error) {
    throw error;
  }
  console.log(`My first Express app - listening on port ${PORT}!`);
});

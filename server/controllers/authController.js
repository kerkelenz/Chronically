const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// bcrypt recommends 10 salt rounds as a good balance between security and performance
// the higher the number the slower the hash - which is actually intentional to slow down hackers
const SALT_ROUNDS = 10;

// register handles creating a new user account
const register = async (req, res) => {
  try {
    // pulling the fields out of the request body that the frontend sends us
    const { username, email, password } = req.body;

    // basic validation - make sure nothing is missing before we do anything else
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // check if someone already signed up with this email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // never store plain text passwords - bcrypt turns it into a hash that can't be reversed
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // create the user in the database with the hashed password, not the original
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // create a JWT token so the user is immediately logged in after registering
    // we put the user's id and username inside the token so we can identify them later
    // token expires in 7 days so they don't have to log in constantly
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // send back the token and basic user info
    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
};

// login handles checking credentials and returning a token if they're valid
const login = async (req, res) => {
  try {
    // login only needs email and password - username isn't required here
    const { email, password } = req.body;

    // make sure both fields were actually sent
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // look up the user by email - if they don't exist we can't log them in
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // using "Invalid credentials" instead of "user not found" on purpose
      // we don't want to tell hackers which emails are registered
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // bcrypt.compare hashes the incoming password and checks it against the stored hash
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // password checks out - generate a fresh JWT token for this session
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // send back the token and user info so the frontend can store it and use it
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
};

// exporting both functions so the routes file can use them
module.exports = { register, login };

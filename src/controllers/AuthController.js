// Import necessary modules and configurations
const { query } = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("../config");

// Get secret key and salt rounds from configuration
const secretKey = config.jwtToken.tokenSecret;
const saltRounds = 10;

// Registration controller
const registration = async (req, res) => {
    const { user_name, password } = req.body; // Destructure user_name and password from request body

    try {
        // Check if a user with the same user_name already exists
        const result = await query(
            "SELECT * FROM users WHERE user_name = ?",
            [user_name]
        );

        if (result.length > 0) {
            // If user already exists, send a 400 status with an error message
            return res.status(400).json({ error: "Sorry, We can not sign up you." });
        }

        // Hash the password using bcrypt
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new user into the database
        const saveUser = await query("INSERT INTO users(user_name, password) VALUES(?, ?)", [
            user_name,
            passwordHash
        ]);

        // Send a success response with the new user's ID
        return res.status(201).json({ message: "User registered successfully", id: saveUser.insertId });
    } catch (error) {
        // Handle any errors that occur during registration
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Login controller
const login = async (req, res) => {
    const { user_name, password } = req.body; // Destructure user_name and password from request body

    try {
        // Check if a user with the given user_name exists
        const result = await query(
            "SELECT * FROM users WHERE user_name = ?",
            [user_name]
        );

        if (result.length === 0) {
            // If no user is found, send a 401 status with an error message
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (result && result.length > 0) {
            const user = result[0]; // Get the first (and only) user from the result
            const hashedPassword = user.password; // Get the hashed password from the user object

            // Compare the provided password with the hashed password
            const passwordMatch = await bcrypt.compare(password, hashedPassword);

            if (!passwordMatch) {
                // If passwords do not match, send a 401 status with an error message
                return res.status(401).json({ error: "Invalid credentials" });
            }

            // Generate a JWT token for the authenticated user
            const token = jwt.sign({ user }, secretKey);

            user.token = token; // Attach the token to the user object
            res.status(200).json(user); // Send a success response with the user object
        }
    } catch (error) {
        // Handle any errors that occur during login
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// Export the registration and login controllers
module.exports = { registration, login };

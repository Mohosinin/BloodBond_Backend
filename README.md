# BloodBond Server

This is the backend server for the BloodBond application, built with Node.js, Express, and MongoDB. It manages the database, authentication verification, and payments.

## 🚀 Getting Started

### Prerequisites
- Node.js installed.
- MongoDB Atlas cluster (or local instance).
- Stripe Secret Key.

### Installation

1.  **Navigate to the server directory:**
    ```bash
    cd server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root of the `server` directory and add the following variables:
    ```env
    DB_USER=your_mongodb_username
    DB_PASS=your_mongodb_password
    ACCESS_TOKEN_SECRET=your_jwt_secret_token
    STRIPE_SECRET_KEY=your_stripe_secret_key
    ```

4.  **Run the server:**
    ```bash
    npm run dev
    ```
    The server will run on `http://localhost:5000` by default.

## 📜 Scripts

-   `npm start`: Runs the server using `node index.js`.
-   `npm run dev`: Runs the server in development mode using `nodemon`.

## 📦 Key Dependencies

-   **Express:** Fast web framework for Node.js.
-   **MongoDB:** Official MongoDB driver for database interaction.
-   **Cors:** Middleware to enable Cross-Origin Resource Sharing.
-   **Dotenv:** Loads environment variables from `.env` file.
-   **JsonWebToken (JWT):** Securely transmitting information between parties as a JSON object; used for verifying user sessions.
-   **Stripe:** Library for interacting with the Stripe API for payments.
-   **Cookie-Parser:** Middleware to parse cookies (if used).

## 🔗 API Overview

The server provides endpoints for:
-   **Authentication:** generating JWT tokens.
-   **Users:** CRUD operations for managing user profiles and roles (Admin/Donor/Volunteer).
-   **Donation Requests:** Creating, updating, and deleting blood donation requests.
-   **Blogs:** Managing educational content.
-   **Funding:** Handling payment intents and storing funding records.

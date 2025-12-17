const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config(); // Load .env from current directory

// Check if email is provided
const email = process.argv[2];

if (!email) {
    console.error('❌ Please provide an email address.');
    console.log('Usage: node scripts/makeAdmin.js <user_email>');
    process.exit(1);
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yucxzfy.mongodb.net/?appName=Cluster0`;
console.log("Connecting with user:", process.env.DB_USER);


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const database = client.db("bloodDonationDB");
        const userCollection = database.collection("users");

        const filter = { email: email };
        const updateDoc = {
            $set: {
                role: 'admin'
            },
        };

        const result = await userCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
            console.log(`⚠️ User with email '${email}' not found.`);
        } else if (result.modifiedCount === 0) {
            console.log(`ℹ️ User '${email}' is already an admin.`);
        } else {
            console.log(`✅ Success! User '${email}' is now an ADMIN.`);
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);

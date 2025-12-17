const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yucxzfy.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    
    const database = client.db("bloodDonationDB");
    const userCollection = database.collection("users");

    // jwt related api
    app.post('/jwt', async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '3h' });
        res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
        // console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
            return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            req.decoded = decoded;
            next();
        })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        next();
    }

    // users related api
    app.get('/users/role/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let role = 'donor';
        if (user) {
            role = user?.role || 'donor';
        }
        res.send({ role });
    })

     app.post('/users', async (req, res) => {
        const user = req.body;
        // insert email if user doesn't exists: 
        // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
            return res.send({ message: 'user already exists', insertedId: null })
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
    });

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
    })

     // Update user status
    app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const status = req.body.status;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: status
            }
        }
        const result = await userCollection.updateOne(query, updatedDoc);
        res.send(result);
    })

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: 'Admin'
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Blood Donation Server is running')
})

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`)
    })
}

module.exports = app;

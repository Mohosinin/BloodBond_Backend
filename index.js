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

    // Make volunteer
    app.patch('/users/volunteer/:id', verifyToken, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: 'Volunteer'
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    // Get specific user by email
    app.get('/users/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        res.send(user);
    })

    app.patch('/users/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const user = req.body;
        // prevent role/status update here
        delete user.role;
        delete user.status;
        
        const updatedDoc = {
            $set: user
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });

    const requestCollection = database.collection("donationRequests");

    app.post('/donation-requests', verifyToken, async (req, res) => {
        const request = req.body;
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (user?.status === 'blocked') {
            return res.status(403).send({ message: 'forbidden: user is blocked' });
        }
        const result = await requestCollection.insertOne(request);
        res.send(result);
    });

    // Stripe Payment Intent
    app.post('/create-payment-intent', verifyToken, async(req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        
        if(!price || amount < 1) return res.send({ clientSecret: null });

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'bdt',
            payment_method_types: ['card']
        });

        res.send({
            clientSecret: paymentIntent.client_secret
        });
    });

    // Funding Collection
    const fundingCollection = database.collection("funding");

    // Save Funding
    app.post('/funding', verifyToken, async(req, res) => {
        const funding = req.body;
        const result = await fundingCollection.insertOne(funding);
        res.send(result);
    });

    // Get Funding
    app.get('/funding', verifyToken, async(req, res) => {
        const result = await fundingCollection.find().sort({ date: -1 }).toArray();
        res.send(result);
    });

    // Admin Stats
    app.get('/admin/stats-summary', verifyToken, async (req, res) => {
        const totalUsers = await userCollection.estimatedDocumentCount();
        const totalRequests = await requestCollection.estimatedDocumentCount();
        
        // Calculate total funding
        const payments = await fundingCollection.find().toArray();
        const totalFunding = payments.reduce((sum, payment) => sum + payment.amount, 0);
        
        res.send({
            totalUsers,
            totalRequests,
            totalFunding
        });
    });

    // Public search for donors
    app.get('/search-donors', async (req, res) => {
        const bloodGroup = req.query.bloodGroup;
        const division = req.query.division;
        const district = req.query.district;
        const upazila = req.query.upazila;

        const query = { role: 'donor', status: 'active' };
        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (division) query.division = division;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;

        const result = await userCollection.find(query).project({ 
            name: 1, 
            bloodGroup: 1, 
            division: 1,
            district: 1, 
            upazila: 1, 
            photo: 1 // Optional: Display avatar, but not contact
        }).toArray();
        res.send(result);
    });

    app.get('/donation-requests/all', verifyToken, async (req, res) => {
        const email = req.decoded.email;
        const user = await userCollection.findOne({ email: email });
        
        if (user.role !== 'admin' && user.role !== 'volunteer') {
             return res.status(403).send({ message: 'forbidden access' });
        }
        
        const result = await requestCollection.find().sort({ donationDate: -1 }).toArray();
        res.send(result);
    });

    app.get('/donation-requests', async (req, res) => {
        const email = req.query.email;
        let query = {};
        if (email) {
            query = { requesterEmail: email }
        } else {
            // If no email, assume public request -> pending only
            // But we should probably allow admin to see all.
            // For simplicity, let's treat "no email" as public "pending" requests list.
            // Or add explicit ?public=true
            query = { status: 'pending' };
        }
        const result = await requestCollection.find(query).sort({ donationDate: 1 }).toArray();
        res.send(result);
    });

    app.delete('/donation-requests/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await requestCollection.deleteOne(query);
        res.send(result);
    });

    app.patch('/donation-requests/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: req.body
        }
        const result = await requestCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })
    
    app.get('/donation-requests/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await requestCollection.findOne(query);
        res.send(result);
    });




    
    // Blog Collection
    const blogCollection = database.collection("blogs");

    // Create Blog
    app.post('/blogs', verifyToken, async (req, res) => {
        const blog = req.body;
        blog.date = new Date().toISOString();
        const result = await blogCollection.insertOne(blog);
        res.send(result);
    });

    // Get All Blogs (Admin/Volunteer)
    app.get('/blogs', verifyToken, async (req, res) => {
        const result = await blogCollection.find().sort({ date: -1 }).toArray();
        res.send(result);
    });

    // Get Published Blogs (Public)
    app.get('/blogs/published', async (req, res) => {
        const result = await blogCollection.find({ status: 'published' }).sort({ date: -1 }).toArray();
        res.send(result);
    });

    // Get Single Blog (Public)
    app.get('/blogs/:id', async (req, res) => {
        const id = req.params.id;
        try {
            const query = { _id: new ObjectId(id) };
            const result = await blogCollection.findOne(query);
            res.send(result);
        } catch (error) {
            res.status(404).send({ message: "Blog not found" });
        }
    });

    // Delete Blog
    app.delete('/blogs/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await blogCollection.deleteOne(query);
        res.send(result);
    });

    // Update Blog Status
    app.patch('/blogs/:id/status', verifyToken, async (req, res) => {
        const id = req.params.id;
        const status = req.body.status;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: { status: status }
        };
        const result = await blogCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });

    // Update Blog Content
    app.put('/blogs/:id', verifyToken, async (req, res) => {
        const id = req.params.id;
        const blog = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                title: blog.title,
                thumbnail: blog.thumbnail,
                content: blog.content,
                status: blog.status
            }
        };
        const result = await blogCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });



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

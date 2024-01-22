const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json());

const verifyJWTToken = (req, res, next) => {
    const authorization = req?.headers?.Authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" });
    };
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y1dis5d.mongodb.net/?retryWrites=true&w=majority`;

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
        client.connect();

        const userCollection = client.db('LingoVerseDB').collection('users');
        const messageCollection = client.db('LingoVerseDB').collection('messages');
        const coursesCollection = client.db('LingoVerseDB').collection('courses');
        const mentorsCollection = client.db('LingoVerseDB').collection('mentors');
        const registeredStudents = client.db('LingoVerseDB').collection('registeredStudents');
        const cartCollection = client.db('LingoVerseDB').collection('cartItem');

        // Sending Token to Client 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "3d" })
            res.send({ token });
        })


        // App User API here 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const isExistUser = await userCollection.findOne(query);
            if (isExistUser) {
                return res.status(403).send({ message: 'user exist already' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // HomePage message API here 
        app.post('/messages', async (req, res) => {
            const message = req.body;
            const result = await messageCollection.insertOne(message);
            res.send(result);
        });

        // Courses API here 
        app.get('/courses', async (req, res) => {
            const cursor = coursesCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // Mentors API Here 
        app.get('/mentors', async (req, res) => {
            const cursor = mentorsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // Student Registration API Here 
        app.post('/register', verifyJWTToken, async (req, res) => {
            const studentData = req.body;
            const result = await registeredStudents.insertOne(studentData);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('LingoVerse Sever Is Running!')
});

app.listen(port, () => {
    console.log(`LingoVerse Server is Running on port ${port}`)
});
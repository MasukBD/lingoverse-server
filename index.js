const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json());

const verifyJWToken = (req, res, next) => {
    const authorization = req.headers.authorization;
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



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const enrolledCollection = client.db('LingoVerseDB').collection('enrolledStudents');

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
        app.post('/register', verifyJWToken, async (req, res) => {
            const studentData = req.body;
            const result = await registeredStudents.insertOne(studentData);
            res.send(result);
        });

        app.get('/register', verifyJWToken, async (req, res) => {
            let query = {};
            const studentEmail = req.query?.email;
            if (req.decoded?.email !== studentEmail) {
                return res.status(401).send({ message: 'Unauthorized Access!' });
            }
            query = { email: studentEmail };
            const result = await registeredStudents.findOne(query);
            res.send(result);
        });

        app.put('/register/:id', verifyJWToken, async (req, res) => {
            const id = req.params?.id;
            const filter = { _id: new ObjectId(id) };
            const updatedData = req.body;
            const options = { upsert: true };
            const updateToDB = {
                $set: {
                    fullName: updatedData.fullName,
                    nationallity: updatedData.nationality,
                    passportNo: updatedData.passport,
                    phoneNo: updatedData.phone,
                    address: updatedData.address
                }
            }
            const result = await registeredStudents.updateOne(filter, updateToDB, options);
            res.send(result);
        })

        // CourseCart API here 
        app.get('/courseCart', verifyJWToken, async (req, res) => {
            let query = {};
            const email = req.query?.email;
            if (req.decoded?.email !== email) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            if (email) {
                query = { studentEmail: email };
            }
            const cursor = cartCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/courseCart', verifyJWToken, async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        });

        app.delete('/courseCart/:id', verifyJWToken, async (req, res) => {
            const id = req.params?.id;
            let query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });

        // Stripe Payment Intent 
        app.post('/create-stripe-payment-intent', verifyJWToken, async (req, res) => {
            const { price } = req.body;
            const grandPrice = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: grandPrice,
                currency: "usd",
                payment_method_types: ["card"],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        });

        // Enroll Student Data API 
        app.get('/enrolledStudents', verifyJWToken, async (req, res) => {
            const email = req.query?.email;
            if (req.decoded?.email !== email) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            let query = { email: email };
            const result = await enrolledCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/enrolledStudents', verifyJWToken, async (req, res) => {
            const enrolledData = req.body;
            // When a student enrolled successfully then here in the code belew decrease available seat 
            const filter = { _id: new ObjectId(enrolledData.courseId) };
            const course = await coursesCollection.findOne(filter);
            if (!course) {
                return res.status(400).send({ error: 'No Course Available!' });
            }
            else if (course.available_seats <= 0) {
                return res.status(400).send({ message: 'No seat Availble!' });
            }
            const update = { $inc: { available_seats: -1 } };
            const options = { returnOriginal: false };
            const decrementedSeatInCourse = await coursesCollection.findOneAndUpdate(filter, update, options);
            const { cartId, ...enrollDataToDb } = enrolledData;
            // Inserting successfull Enrollment Student Data to DB 
            const insertEnrollment = await enrolledCollection.insertOne(enrollDataToDb);
            // After Enrollment Delete Cart Data From CartItem 
            let query = { _id: new ObjectId(enrolledData.cartId) };
            const deleteFromCart = await cartCollection.deleteOne(query);
            res.send({ insertEnrollment, deleteFromCart, decrementedSeatInCourse });
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
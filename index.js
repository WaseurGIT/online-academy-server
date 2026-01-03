const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.febqytm.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("onlineAcademy").collection("users");

    // ************ user related api *************

    // 1. post an user in db
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        if (!user.email || !user.name) {
          return res
            .status(400)
            .json({ message: "Name and email are required" });
        }

        const result = await usersCollection.insertOne(user);
        res.status(201).json({ success: true, result });
      } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 2. get all user from db
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find({}).toArray();
        res.status(200).json({ success: true, data: users });
      } catch (error) {
        console.error("Error getting users:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 3. get a single user from db
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email: email });

        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, data: user });
      } catch (error) {
        console.error("Error getting user:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 4. to get user which is created by firebase
    app.get("/users/uid/:uid", async (req, res) => {
      try {
        const uid = req.params.uid;
        const user = await usersCollection.findOne({ uid: uid });

        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, data: user });
      } catch (error) {
        console.error("Error getting user:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 5. delete user
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.status(200).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 6. update user
    app.put("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        res.status(200).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send(`Online Academy server is running on port ${port}`);
});

app.listen(port, (req, res) => {
  console.log(`Server listening on port ${port}`);
});

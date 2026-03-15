const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// middlewares
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.febqytm.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("onlineAcademy").collection("users");
    const blogsCollection = client.db("onlineAcademy").collection("blogs");
    const assignmentCollection = client
      .db("onlineAcademy")
      .collection("assignments");
    const enrollmentsCollection = client
      .db("onlineAcademy")
      .collection("enrollments");
    const submitCollection = client
      .db("onlineAcademy")
      .collection("assignmentSubmissions");

    // ********** jwt related api ***********
    app.post("/jwt", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const token = jwt.sign(
          { email: user.email, role: user.role },
          process.env.JWT_SECRET,
          {
            expiresIn: "24d",
          },
        );
        res.status(200).json({ token });
      } catch (error) {
        console.error("Error generating JWT:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // admin verify middleware
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.user.email;
        const user = await usersCollection.findOne({ email });
        if (!user || user.role !== "admin") {
          return res.status(403).json({ message: "Admin access required" });
        }
        next();
      } catch (error) {
        console.error("Admin verification error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    };

    // ************ user related api *************
    // 1. post from client to db
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        if (!user.email || !user.name) {
          return res
            .status(400)
            .json({ message: "Name and email are required" });
        }

        const existingUser = await usersCollection.findOne({
          email: user.email,
        });

        if (!existingUser) {
          const insertResult = await usersCollection.insertOne(user);
          return res
            .status(201)
            .json({ success: true, message: "User added", insertResult });
        } else {
          return res.status(200).json({
            success: true,
            message: "User already exists",
            existingUser,
          });
        }
      } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 2. get all user from db
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await usersCollection.find({}).toArray();
        res.status(200).json({ success: true, data: users });
      } catch (error) {
        console.error("Error getting users:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 3. get a single user from db
    app.get("/usersRole/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);

        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }
        res.send({ role: user?.role || "user" });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.send({ error: "An error occurred while fetching the user" });
      }
    });

    // 4. get a single user by email
    app.get("/users/email/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Error fetching user" });
      }
    });

    // 5. delete user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
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
    app.put("/users/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );
        res.status(200).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // submit related api
    app.post("/assignment-submissions", verifyToken, async (req, res) => {
      try {
        const { studentName, studentEmail, assignmentId, fileUrl } = req.body;

        // Basic validation
        if (!studentName || !studentEmail || !assignmentId) {
          return res.status(400).send({
            success: false,
            message: "studentName, studentEmail, and assignmentId are required",
          });
        }

        // Create the submission object
        const submissionDoc = {
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim(),
          assignmentId: assignmentId.trim(),
          fileUrl: fileUrl?.trim() || "",
          submittedAt: new Date(),
        };

        // Insert into `assignmentSubmissions` collection
        const result = await client
          .db("onlineAcademy")
          .collection("assignmentSubmissions")
          .insertOne(submissionDoc);

        res.status(201).send({
          success: true,
          message: "Assignment submitted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Assignment submission error:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // GET submissions by student email
    app.get(
      "/assignment-submissions/by-student",
      verifyToken,
      async (req, res) => {
        try {
          const email = req.query.email;
          if (!email) {
            return res.status(400).send({
              success: false,
              message: "email query param required",
            });
          }

          const submissions = await client
            .db("onlineAcademy")
            .collection("assignmentSubmissions")
            .find({ studentEmail: email.trim() })
            .toArray();

          res.send({ success: true, data: submissions });
        } catch (error) {
          console.error("Error getting student submissions:", error);
          res.status(500).send({
            success: false,
            message: "Internal server error",
          });
        }
      },
    );

    // count submissions by student
    app.get("/submitted-assignments", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({
            success: false,
            message: "email query param required",
          });
        }

        const count = await client
          .db("onlineAcademy")
          .collection("assignmentSubmissions")
          .countDocuments({ studentEmail: email.trim() });

        res.send({ submittedCount: count });
      } catch (error) {
        console.error("Error getting submitted assignments count:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // ******** blog related api *********
    // 1 . post api
    app.post("/blogs", async (req, res) => {
      try {
        const blog = req.body;
        const result = await blogsCollection.insertOne(blog);
        res.status(201).json({
          success: true,
          message: "Blog added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding blog:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // 2. get api
    app.get("/blogs", async (req, res) => {
      try {
        const blogs = await blogsCollection.find().toArray();
        res.send(blogs);
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).send({ message: "Error fetching blogs" });
      }
    });

    // 3. get blogs by email
    app.get("/blogs/email/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = email ? { email } : {};
      const blogs = await blogsCollection.find(query).toArray();
      res.send(blogs);
    });

    // 4. get single blog by id
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const blog = await blogsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!blog) {
        return res
          .status(404)
          .json({ success: false, message: "Blog not found" });
      }

      res.send(blog);
    });

    // 5. delete blog
    app.delete("/blogs/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const blog = await blogsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!blog) {
          return res.status(404).send({ message: "Blog not found" });
        }

        if (blog.email !== req.user.email) {
          return res
            .status(403)
            .send({ message: "Forbidden: You can't delete this blog" });
        }
        const result = await blogsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // *********** assignment related api ************
    // 1. get all from db
    app.get("/assignments", async (req, res) => {
      try {
        const result = await assignmentCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching assignments:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });
    // 2. get a single
    app.get("/assignments/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await assignmentCollection.findOne({ id });

        if (!result) {
          return res.status(404).json({ message: "Assignment not found" });
        }

        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching assignment:", error);
        res.status(500).json({ message: error.message });
      }
    });

    app.get("/assignments/byEmail/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      try {
        const result = await assignmentCollection.find({ email }).toArray();
        if (!result) {
          return res.status(404).json({ message: "Assignment not found" });
        }
        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching assignment:", error);
        res.status(500).json({ message: error.message });
      }
    });

    // 3. post from client
    app.post("/assignments", verifyToken, async (req, res) => {
      try {
        const assignment = req.body;
        const requiredField = [
          "assignment_title",
          "description",
          "marks",
          "deadline",
          "image",
        ];
        const missingField = requiredField.filter(
          (field) => !assignment[field],
        );
        if (missingField.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingField.join(", ")}`,
          });
        }
        const result = await assignmentCollection.insertOne(assignment);
        res.status(201).json({
          success: true,
          message: "Assignment added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding assignment:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });
    // 4. delete an assignment
    app.delete("/assignments/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await assignmentCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Assignment not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Assignment deleted successfully",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Error deleting assignment:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
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

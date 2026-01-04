const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("onlineAcademy").collection("users");
    const courseCollection = client.db("onlineAcademy").collection("courses");
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

    // ************* course related apis **************
    // 1. post api
    app.post("/courses", async (req, res) => {
      try {
        const course = req.body;
        if (!course.course_id || !course.course_name || !course.course_price) {
          return res
            .status(400)
            .send({ message: "Required fields are missing" });
        }

        const existingCourse = await courseCollection.findOne({
          course_id: course.course_id,
        });

        if (existingCourse) {
          return res.status(409).send({
            success: false,
            message: "Course already exists",
          });
        }

        const result = await courseCollection.insertOne(course);
        res.status(201).send({
          success: true,
          message: "Course added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding course:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });
    // 2. get api
    app.get("/courses", async (req, res) => {
      const courses = await courseCollection.find().toArray();
      res.send(courses);
    });
    // 3. get a single course
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const course = await courseCollection.findOne({ course_id: id });

      if (!course) {
        return res.status(404).send({ message: "Course not found" });
      }

      res.send(course);
    });

    // 4. update course
    app.put("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const updateCourse = req.body;

      const result = await courseCollection.updateOne(
        { course_id: id },
        { $set: updateCourse }
      );

      res.send({
        message: "Course updated successfully",
        modifiedCount: result.modifiedCount,
      });
    });

    // 5. delete api
    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const result = await courseCollection.deleteOne({ course_id: id });
      res.send({
        message: "Course deleted successfully",
        deletedCount: result.deletedCount,
      });
    });
    // 6. enrolled course by user
    app.post("/enrollments", async (req, res) => {
      try {
        const { userEmail, courseId } = req.body;

        console.log("Enrollment request:", { userEmail, courseId });

        if (!userEmail || !courseId) {
          return res.status(400).send({
            success: false,
            message: "userEmail and courseId required",
          });
        }

        // Convert to string for consistency
        const courseIdString = courseId.toString().trim();

        // Check if course exists first
        const course = await courseCollection.findOne({
          course_id: courseIdString,
        });

        if (!course) {
          console.log("Course not found:", courseIdString);
          return res.status(404).send({
            success: false,
            message: "Course not found",
          });
        }

        // Check if already enrolled
        const exists = await enrollmentsCollection.findOne({
          userEmail: userEmail.trim(),
          courseId: courseIdString,
        });

        if (exists) {
          console.log("Already enrolled:", {
            userEmail,
            courseId: courseIdString,
          });
          return res.status(409).send({
            success: false,
            message: "Already enrolled in this course",
          });
        }

        // Create enrollment document
        const enrollmentDoc = {
          userEmail: userEmail.trim(),
          courseId: courseIdString,
          courseName: course.course_name, // Store course name for reference
          enrolledAt: new Date(),
          status: "active",
          completed: false,
        };

        console.log("Creating enrollment:", enrollmentDoc);

        const result = await enrollmentsCollection.insertOne(enrollmentDoc);

        res.send({
          success: true,
          message: "Successfully enrolled",
          insertedId: result.insertedId,
          courseName: course.course_name,
        });
      } catch (error) {
        console.error("Enrollment error:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    // 7. get enrolled courses
    app.get("/my-courses", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ message: "email required" });

        // get all enrollments for this user
        const enrollments = await enrollmentsCollection
          .find({ userEmail: email })
          .toArray();

        if (!enrollments.length) return res.send([]);

        // get all course IDs
        const courseIds = enrollments.map((e) => e.courseId);

        // fetch matching course docs
        const courses = await courseCollection
          .find({ course_id: { $in: courseIds } })
          .toArray();

        // combine: inject completed flag into course objects
        const merged = courses.map((course) => {
          const related = enrollments.find(
            (e) => e.courseId.toString() === course.course_id.toString()
          );
          return {
            ...course,
            completed: related?.completed || false,
          };
        });

        res.send(merged);
      } catch (error) {
        console.error("MY-COURSES ERROR:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // mark enrolled course as completed
    app.patch("/enrollments/complete", async (req, res) => {
      try {
        const { userEmail, courseId } = req.body;

        if (!userEmail || !courseId) {
          return res
            .status(400)
            .send({ message: "Email and courseId required" });
        }

        const result = await enrollmentsCollection.updateOne(
          { userEmail, courseId: courseId.toString() },
          { $set: { completed: true } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Enrollment not found" });
        }

        res.send({ success: true, message: "Marked as completed" });
      } catch (error) {
        console.error("Complete update error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/completed-courses", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.status(400).send({ message: "email required" });

        const count = await enrollmentsCollection.countDocuments({
          userEmail: email,
          completed: true,
        });

        res.send({ completedCount: count });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // submit related api
    app.post("/assignment-submissions", async (req, res) => {
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
    app.get("/assignment-submissions/by-student", async (req, res) => {
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
    });

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
    // 1. get api
    app.get("/blogs", async (req, res) => {
      const blogs = await blogsCollection.find().toArray();
      res.send(blogs);
    });

    // 2. get single blog
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const blog = await blogsCollection.findOne({ id: id });

      if (!blog) {
        return res
          .status(404)
          .json({ success: false, message: "Blog not found" });
      }

      res.send(blog);
    });

    // 3. delete blog
    app.delete("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const result = await blogsCollection.deleteOne(id);
      res.send(result);
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

    // 3. post from client
    app.post("/assignments", async (req, res) => {
      try {
        const assignment = req.body;

        const requiredField = [
          "assignment_id",
          "assignment_title",
          "description",
          "marks",
          "deadline",
          "image",
        ];
        const missingField = requiredField.filter(
          (field) => !assignment[field]
        );
        if (missingField.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
        }

        const existing = await assignmentCollection.findOne({
          assignment_id: assignment.assignment_id,
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: "Assignment with this ID already exists",
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
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });
    // 4. delete an assignment
    app.delete("/assignments/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await assignmentCollection.deleteOne({
          assignment_id: id,
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

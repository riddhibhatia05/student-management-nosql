require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const Student = require("./models/Student");
const Subject = require("./models/Subject");
const Attendance = require("./models/Attendance");
const Mark = require("./models/Mark");
const studentRoutes = require("./routes/students");
const subjectRoutes = require("./routes/subjects");
const attendanceRoutes = require("./routes/attendance");
const markRoutes = require("./routes/marks");

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
connectDB();

app.get("/api/health",(req,res)=>res.json({status:"OK",database:"MongoDB"}));
app.use("/api/students",studentRoutes);
app.use("/api/subjects",subjectRoutes);
app.use("/api/attendance",attendanceRoutes);
app.use("/api/marks",markRoutes);

app.get("/api/dashboard", async (req,res)=>{
  try{
    const [students,subjects,attendanceRecords,marks] = await Promise.all([
      Student.countDocuments(), Subject.countDocuments(),
      Attendance.countDocuments(), Mark.countDocuments()
    ]);
    const present = await Attendance.countDocuments({status:"Present"});
    res.json({students,subjects,attendanceRecords,marks,
      attendancePercentage: attendanceRecords ? Math.round(present/attendanceRecords*100) : 0});
  }catch(e){res.status(500).json({message:e.message});}
});

app.get("/api/performance/summary", async (req,res)=>{
  try{
    const result = await Student.aggregate([
      {$lookup:{from:"attendances",localField:"_id",foreignField:"studentId",as:"attendance"}},
      {$lookup:{from:"marks",localField:"_id",foreignField:"studentId",as:"marks"}},
      {$project:{
        name:1,email:1,course:1,semester:1,
        totalAttendance:{$size:"$attendance"},
        presentAttendance:{$size:{$filter:{input:"$attendance",as:"a",cond:{$eq:["$$a.status","Present"]}}}},
        averageMarks:{$round:[{$ifNull:[{$avg:{$map:{input:"$marks",as:"m",in:{$add:["$$m.internal","$$m.external"]}}}},0]},2]}
      }},
      {$project:{
        name:1,email:1,course:1,semester:1,totalAttendance:1,presentAttendance:1,
        attendancePercentage:{$cond:[
          {$gt:["$totalAttendance",0]},
          {$round:[{$multiply:[{$divide:["$presentAttendance","$totalAttendance"]},100]},2]},
          0
        ]},
        averageMarks:1
      }},
      {$sort:{averageMarks:-1,name:1}}
    ]);
    res.json(result);
  }catch(e){res.status(500).json({message:e.message});}
});

app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`));

const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const app=express();
const server=http.createServer(app);
const io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const rooms=new Map();
const bank=[
["Which keyword defines a function in Python?","def",["func","define","function"],"Python"],
["Which Python data type is mutable?","List",["Tuple","String","Integer"],"Python"],
["Which NumPy function creates an array?","np.array()",["np.list()","np.create()","np.data()"],"NumPy"],
["Which Pandas function reads a CSV file?","read_csv()",["read_excel()","load_csv()","csv_read()"],"Pandas"],
["What does df.head() show?","First rows",["Last rows","Only columns","Missing values"],"Pandas"],
["Which method removes duplicate rows?","drop_duplicates()",["remove_duplicates()","delete_duplicates()","unique_remove()"],"Data Cleaning"],
["What is EDA?","Exploratory Data Analysis",["Electronic Data Analysis","Experimental Data Algorithm","Extended Data Application"],"EDA"],
["Which plot shows the relationship between two numerical variables?","Scatter plot",["Pie chart","Bar chart","Histogram"],"Visualization"],
["Which plot helps detect outliers?","Box plot",["Pie chart","Line chart","Area chart"],"Visualization"],
["Which is less affected by extreme values?","Median",["Mean","Variance","Standard deviation"],"Statistics"],
["Learning from labeled data is:","Supervised learning",["Unsupervised learning","Clustering","PCA"],"Machine Learning"],
["Which is a regression algorithm?","Linear Regression",["K-Means","PCA","Apriori"],"Regression"],
["Which is commonly used for classification?","Logistic Regression",["K-Means","PCA","Apriori"],"Classification"],
["Which algorithm is used for clustering?","K-Means",["Linear Regression","Logistic Regression","Random Forest"],"Clustering"],
["Which metric evaluates regression error?","RMSE",["Accuracy","Precision","Recall"],"Model Evaluation"],
["What does R² measure?","Proportion of variance explained",["Number of clusters","Missing values","Classes"],"Model Evaluation"],
["A model good on training but poor on unseen data has:","Overfitting",["Underfitting","Scaling","Encoding"],"Machine Learning"],
["Which algorithm can be used for classification and regression?","Decision Tree",["K-Means","PCA","Apriori"],"Machine Learning"],
["Random Forest is an ensemble of:","Decision trees",["Clusters","SQL queries","Linear models only"],"Machine Learning"],
["KNN predicts mainly using:","Nearest observations",["Principal components","Random rows","Missing values"],"Classification"],
["K in K-Means represents:","Number of clusters",["Number of rows","Number of targets","Number of columns"],"Clustering"],
["Cross-validation is used for:","More reliable model evaluation",["Deleting data","Encoding strings","Making charts"],"Model Evaluation"],
["Which SQL keyword retrieves data?","SELECT",["GET","FETCHROW","DISPLAY"],"SQL"],
["Which SQL clause filters rows?","WHERE",["HAVING","ORDER BY","GROUP BY"],"SQL"],
["Which SQL clause sorts results?","ORDER BY",["SORT BY","GROUP BY","ARRANGE"],"SQL"],
["Which SQL clause filters groups after aggregation?","HAVING",["WHERE","GROUP FILTER","ORDER BY"],"SQL"],
["Which SQL function counts rows?","COUNT()",["TOTAL()","NUMBER()","ROWSUM()"],"SQL"],
["Excel function for arithmetic mean:","AVERAGE",["SUM","COUNT","MAX"],"Excel"],
["Excel feature for summarizing large data:","PivotTable",["WordArt","Mail Merge","Header"],"Excel"],
["Power BI data transformation tool:","Power Query",["PowerPoint","Word","VBA"],"Power BI"],
["Power BI calculations and measures mainly use:","DAX",["SQL only","HTML","CSS"],"Power BI"],
["Tableau is primarily a:","Data visualization and analytics platform",["Programming language","Database engine only","Spreadsheet"],"Tableau"],
["Which library is commonly used for Python ML?","Scikit-learn",["Matplotlib","OpenPyXL","Seaborn"],"Machine Learning"],
["Which library is commonly used for plotting?","Matplotlib",["NumPy","SQL","OpenPyXL"],"Visualization"]
];

function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function makeRoomCode(){let c; do{c=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(c)); return c}

io.on("connection",socket=>{
 socket.on("createRoom",({name,limit=10},cb)=>{
   const code=makeRoomCode();
   rooms.set(code,{host:socket.id,players:new Map(),questions:shuffle(bank).slice(0,Math.min(limit,bank.length)),started:false});
   const room=rooms.get(code); room.players.set(socket.id,{name:name||"Host",score:0,answered:false});
   socket.join(code); cb({ok:true,code});
   io.to(code).emit("lobby", [...room.players.values()]);
 });
 socket.on("joinRoom",({code,name},cb)=>{
   const room=rooms.get(String(code||"").toUpperCase());
   if(!room)return cb({ok:false,error:"Room not found"});
   if(room.started)return cb({ok:false,error:"Test already started"});
   room.players.set(socket.id,{name:name||"Player",score:0,answered:false});
   socket.join(String(code).toUpperCase()); cb({ok:true,code:String(code).toUpperCase()});
   io.to(String(code).toUpperCase()).emit("lobby",[...room.players.values()]);
 });
 socket.on("startGame",({code},cb)=>{
   const room=rooms.get(code); if(!room||room.host!==socket.id)return;
   room.started=true; room.players.forEach(p=>p.answered=false);
   io.to(code).emit("gameStart",{total:room.questions.length,time:room.questions.length*30});
   sendQuestion(code,0);
   cb&&cb({ok:true});
 });
 socket.on("answer",({code,index,answer})=>{
   const room=rooms.get(code); if(!room||!room.started)return;
   const p=room.players.get(socket.id); if(!p||p.answered)return;
   const q=room.questions[index]; if(!q)return;
   p.answered=true; if(answer===q[1])p.score++;
   io.to(code).emit("scores",[...room.players.values()].map(x=>({name:x.name,score:x.score})));
   setTimeout(()=>{p.answered=false},500);
 });
 socket.on("nextQuestion",({code,index})=>{ if(rooms.has(code)) sendQuestion(code,index); });
 socket.on("disconnect",()=>{for(const [code,r] of rooms){if(r.players.delete(socket.id)){io.to(code).emit("lobby",[...r.players.values()]);}}});
});
function sendQuestion(code,index){
 const room=rooms.get(code); if(!room)return;
 if(index>=room.questions.length){io.to(code).emit("finished");return;}
 const q=room.questions[index];
 io.to(code).emit("question",{index,total:room.questions.length,text:q[0],options:shuffle([q[1],...q[2]])});
}
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("DigiChrome Exam Live running on port "+PORT));

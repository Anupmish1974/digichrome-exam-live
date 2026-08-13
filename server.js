const express=require("express"),http=require("http"),{Server}=require("socket.io"),fs=require("fs"),path=require("path");
const app=express(),server=http.createServer(app),io=new Server(server);
const bank=JSON.parse(fs.readFileSync(path.join(__dirname,"public","questions.json"),"utf8"));
app.use(express.static(path.join(__dirname,"public")));
const rooms=new Map();
const shuffle=a=>[...a].sort(()=>Math.random()-0.5);
const makeCode=()=>Math.random().toString(36).slice(2,7).toUpperCase();
function pick(n,topic){let pool=topic?bank.filter(q=>q.topic===topic):bank;return shuffle(pool).slice(0,Math.min(n,pool.length));}
io.on("connection",socket=>{
 socket.on("createRoom",({name,count,topic},cb)=>{
  let code=makeCode();while(rooms.has(code))code=makeCode();
  rooms.set(code,{host:socket.id,players:new Map([[socket.id,{name:name||"Host",score:0}]]),questions:pick(Number(count)||20,topic),started:false,index:0});
  socket.join(code);cb({ok:true,code});io.to(code).emit("lobby",[...rooms.get(code).players.values()]);
 });
 socket.on("joinRoom",({code,name},cb)=>{
  code=(code||"").toUpperCase();let r=rooms.get(code);
  if(!r)return cb({ok:false,error:"Room not found"});if(r.started)return cb({ok:false,error:"Exam already started"});
  r.players.set(socket.id,{name:name||"Player",score:0});socket.join(code);cb({ok:true});io.to(code).emit("lobby",[...r.players.values()]);
 });
 socket.on("startGame",({code})=>{let r=rooms.get(code);if(!r||r.host!==socket.id)return;r.started=true;r.index=0;io.to(code).emit("gameStart",{total:r.questions.length});sendQuestion(code);});
 socket.on("answer",({code,index,answer})=>{let r=rooms.get(code),p=r&&r.players.get(socket.id);if(!r||!p||!r.questions[index])return;if(answer===r.questions[index].answer)p.score++;io.to(code).emit("scores",[...r.players.values()]);});
 socket.on("nextQuestion",({code,index})=>{let r=rooms.get(code);if(!r||r.host!==socket.id)return;if(index>=r.questions.length){io.to(code).emit("finished",[...r.players.values()].sort((a,b)=>b.score-a.score));return;}r.index=index;sendQuestion(code);});
 socket.on("disconnect",()=>{for(const [code,r] of rooms){if(r.players.delete(socket.id))io.to(code).emit("lobby",[...r.players.values()]);}});
});
function sendQuestion(code){let r=rooms.get(code),q=r.questions[r.index];io.to(code).emit("question",{index:r.index,total:r.questions.length,topic:q.topic,text:q.question,options:shuffle(q.options)});}
app.get("/health",(req,res)=>res.json({ok:true,questions:bank.length}));
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log("DigiChrome Exam Live listening on "+PORT));
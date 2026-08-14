const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


// ======================================================
// QUESTIONS FILE
// ======================================================

// First try root/questions.json
// Then try public/questions.json

let questionsPath = path.join(__dirname, "questions.json");

if (!fs.existsSync(questionsPath)) {
  questionsPath = path.join(__dirname, "public", "questions.json");
}

if (!fs.existsSync(questionsPath)) {
  console.error("ERROR: questions.json not found!");
  process.exit(1);
}

const bank = JSON.parse(
  fs.readFileSync(questionsPath, "utf8")
);


// ======================================================
// STATIC FILES
// ======================================================

// Your index.html is currently in the repository root.
app.use(express.static(__dirname));

// Also support public folder if it exists.
if (fs.existsSync(path.join(__dirname, "public"))) {
  app.use(express.static(path.join(__dirname, "public")));
}


// ======================================================
// ROOM STORAGE
// ======================================================

const rooms = new Map();


// ======================================================
// HELPERS
// ======================================================

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}


function makeCode() {
  return Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase();
}


function pickQuestions(count, topic) {

  let pool = bank;

  if (topic && topic.trim()) {

    const topicQuestions = bank.filter(
      q =>
        String(q.topic || "").toLowerCase() ===
        topic.trim().toLowerCase()
    );

    // If matching topic exists, use it.
    // Otherwise use complete question bank.
    if (topicQuestions.length > 0) {
      pool = topicQuestions;
    }
  }

  return shuffle(pool).slice(
    0,
    Math.min(
      Number(count) || 20,
      pool.length
    )
  );
}


// ======================================================
// SOCKET.IO
// ======================================================

io.on("connection", (socket) => {

  console.log("Client connected:", socket.id);


  // ====================================================
  // CREATE ROOM
  // ====================================================

  socket.on(
    "createRoom",
    ({ name, count, topic } = {}, callback) => {

      let code = makeCode();

      while (rooms.has(code)) {
        code = makeCode();
      }


      const questions = pickQuestions(
        Number(count) || 20,
        topic || ""
      );


      if (questions.length === 0) {

        if (typeof callback === "function") {
          callback({
            ok: false,
            error: "No questions available."
          });
        }

        return;
      }


      const room = {

        host: socket.id,

        players: new Map([
          [
            socket.id,
            {
              name: name || "Host",
              score: 0
            }
          ]
        ]),

        questions: questions,

        started: false,

        index: 0
      };


      rooms.set(code, room);

      socket.join(code);


      if (typeof callback === "function") {

        callback({
          ok: true,
          code: code
        });

      }


      io.to(code).emit(
        "lobby",
        [...room.players.values()]
      );


      console.log(
        `Room ${code} created by ${name || "Host"}`
      );

    }
  );


  // ====================================================
  // JOIN ROOM
  // ====================================================

  socket.on(
    "joinRoom",
    ({ code, name } = {}, callback) => {

      code = String(code || "")
        .trim()
        .toUpperCase();


      const room = rooms.get(code);


      if (!room) {

        if (typeof callback === "function") {

          callback({
            ok: false,
            error: "Room not found."
          });

        }

        return;
      }


      if (room.started) {

        if (typeof callback === "function") {

          callback({
            ok: false,
            error: "Exam already started."
          });

        }

        return;
      }


      room.players.set(
        socket.id,
        {
          name: name || "Player",
          score: 0
        }
      );


      socket.join(code);


      if (typeof callback === "function") {

        callback({
          ok: true,
          code: code
        });

      }


      io.to(code).emit(
        "lobby",
        [...room.players.values()]
      );


      console.log(
        `${name || "Player"} joined room ${code}`
      );

    }
  );


  // ====================================================
  // START GAME
  // ====================================================

  socket.on(
    "startGame",
    ({ code } = {}) => {

      const room = rooms.get(code);


      if (!room) return;


      // Only host can start.
      if (room.host !== socket.id) return;


      room.started = true;

      room.index = 0;


      io.to(code).emit(
        "gameStart",
        {
          total: room.questions.length
        }
      );


      sendQuestion(code);

    }
  );


  // ====================================================
  // ANSWER
  // ====================================================

  socket.on(
    "answer",
    ({ code, index, answer } = {}) => {

      const room = rooms.get(code);

      if (!room) return;


      const player =
        room.players.get(socket.id);

      if (!player) return;


      const question =
        room.questions[index];

      if (!question) return;


      if (
        String(answer) ===
        String(question.answer)
      ) {

        player.score++;

      }


      io.to(code).emit(
        "scores",
        [...room.players.values()]
      );

    }
  );


  // ====================================================
  // NEXT QUESTION
  // ====================================================

  socket.on(
    "nextQuestion",
    ({ code } = {}) => {

      const room = rooms.get(code);

      if (!room) return;


      // Only host controls next question.
      if (room.host !== socket.id) return;


      room.index++;


      // Exam finished
      if (
        room.index >=
        room.questions.length
      ) {

        room.started = false;


        const results =
          [...room.players.values()]
            .sort(
              (a, b) =>
                b.score - a.score
            );


        io.to(code).emit(
          "finished",
          results
        );


        return;
      }


      sendQuestion(code);

    }
  );


  // ====================================================
  // DISCONNECT
  // ====================================================

  socket.on(
    "disconnect",
    () => {

      console.log(
        "Client disconnected:",
        socket.id
      );


      for (const [code, room] of rooms) {

        if (
          room.players.has(socket.id)
        ) {

          const wasHost =
            room.host === socket.id;


          room.players.delete(
            socket.id
          );


          // If host leaves, close room.
          if (wasHost) {

            io.to(code).emit(
              "roomClosed",
              {
                message:
                  "Host disconnected. Room closed."
              }
            );


            rooms.delete(code);

            continue;
          }


          io.to(code).emit(
            "lobby",
            [...room.players.values()]
          );

        }

      }

    }
  );

});


// ======================================================
// SEND QUESTION
// ======================================================

function sendQuestion(code) {

  const room = rooms.get(code);

  if (!room) return;


  const question =
    room.questions[room.index];

  if (!question) return;


  io.to(code).emit(
    "question",
    {
      index: room.index,

      total:
        room.questions.length,

      topic:
        question.topic || "",

      text:
        question.question || "",

      options:
        shuffle(question.options || [])
    }
  );

}


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/health",
  (req, res) => {

    res.json({
      ok: true,
      server: "DigiChrome Exam Live",
      questions: bank.length
    });

  }
);


// ======================================================
// START SERVER
// ======================================================

const PORT =
  process.env.PORT || 3000;


server.listen(
  PORT,
  () => {

    console.log(
      `DigiChrome Exam Live running on port ${PORT}`
    );

  }
);

let questionsPath = path.join(__dirname, "questions (1).json");

if (!fs.existsSync(questionsPath)) {
  questionsPath = path.join(__dirname, "questions.json");
}

if (!fs.existsSync(questionsPath)) {
  questionsPath = path.join(__dirname, "public", "questions (1).json");
}

if (!fs.existsSync(questionsPath)) {
  questionsPath = path.join(__dirname, "public", "questions.json");
}

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// static files from "public" dir
app.use(express.static(path.join(__dirname, 'public')));

// fallback
app.use((req, res) => res.send('hi'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
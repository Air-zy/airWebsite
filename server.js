const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res) => res.send('hi'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

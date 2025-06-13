const express = require('express');

const app = express();

app.get('*', (req, res) => {
  res.send('hi');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`express servr running on port ${PORT}`));

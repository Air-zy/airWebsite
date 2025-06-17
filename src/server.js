require('dotenv').config()

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// configs
const PRODUCTION_PUBLIC_DIRECTORY = path.join(__dirname, './compacted_public')

const { startMinify } = require('./minify.js');
startMinify({
  src: path.join(__dirname, './public'),
  dest: PRODUCTION_PUBLIC_DIRECTORY
});


app.use(express.json());
app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));

// routes 
app.get('/home', require('./routes/home.js'));
app.get('/api/projects', require('./routes/api_projects.js'));

app.post('/validate-me', require('./routes/validate_me.js'));
app.post('/api/project-edit', require('./routes/api_project_edit.js'));

app.use((req, res) => {
  res.status(404).send('Not found LOL 🥀💔');
});

const { version } = require('../package.json');
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}, Version ${version}`);
});
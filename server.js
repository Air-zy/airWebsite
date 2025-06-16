const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// static files from "public" dir
app.use(express.static(path.join(__dirname, 'public')));


// routes 
const routeMap = {
  '/home': 'index.html',
};


// TODO add this to route map bruh.
let lastairsiteGet = 0;
app.all(`/api/projects`, async (req, res) => {
  const now = Date.now();
  if (now > lastairsiteGet) {
    console.log("refetching projects")
    lastairsiteGet = now + 30 * 1000;
    //projects = await firedbAirsiteGet();
  }
  res.status(200).send(projects)
})

// handler func for all mapped routes:
function sendMappedFile(req, res, next) {
  const file = routeMap[req.path];
  if (file) {
    const fullPath = path.join(__dirname, 'public', file);
    res.sendFile(fullPath, err => {
      if (err) {
        next(err);
      }
    });
  } else {
    next();
  }
}

const paths = Object.keys(routeMap);
app.get(paths, sendMappedFile);

app.use((req, res) => {
  res.status(404).send('Not found LOL');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
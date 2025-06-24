var express = require('express');
var app = express();
var port = 3000;

app.use(express.static('src'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/src/index.html');
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});


const express = require('express');
const app = express();
app.all('*', (req, res) => res.json({ path: req.path, url: req.url }));
app.listen(3000, () => console.log('Listening on 3000'));

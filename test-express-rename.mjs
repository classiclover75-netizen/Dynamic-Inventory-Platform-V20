import express from 'express';
const app = express();
app.put('/api/pages/:name(*)/rename', (req, res) => res.json({ name: req.params.name }));
app.all('*', (req, res) => res.json({ error: '404' }));
const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/pages/Jan%20%2F%20Feb/rename`, { method: 'PUT' });
  console.log(await res.json());
  server.close();
});

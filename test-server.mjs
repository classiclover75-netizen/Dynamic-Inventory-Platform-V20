import express from 'express';
const app = express();
app.delete('/api/pages/:name', (req, res) => res.json({ match: req.params.name }));
app.all('*', (req, res) => res.json({ error: 'not found', url: req.url }));
const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/pages/Jan%20%2F%20Feb`, { method: 'DELETE' });
  console.log(await res.json());
  server.close();
});

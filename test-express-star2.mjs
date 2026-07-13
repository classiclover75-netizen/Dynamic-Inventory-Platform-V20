import express from 'express';
const app = express();
app.delete('/api/pages/:name(*)', (req, res) => res.json({ name: req.params.name }));
const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/pages/Jan%20%2F%20Feb`, { method: 'DELETE' });
  const text = await res.text();
  console.log('Body:', text);
  server.close();
});

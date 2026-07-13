import express from 'express';
const app = express();
app.patch('/api/pageRows/:name(*)/:rowId', (req, res) => res.json({ name: req.params.name, rowId: req.params.rowId }));
app.all('*', (req, res) => res.json({ error: '404' }));
const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/pageRows/Jan%20%2F%20Feb/123-456`, { method: 'PATCH' });
  console.log(await res.json());
  server.close();
});

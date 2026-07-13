import express from 'express';
const app = express();
app.delete('/api/pages/:name', (req, res) => res.json({ success: true, name: req.params.name }));
app.use((req, res) => res.status(404).send('<!doctype html><html><body>Not Found</body></html>'));
const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/pages/Jan%20%2F%20Feb`, { method: 'DELETE' });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
  server.close();
});

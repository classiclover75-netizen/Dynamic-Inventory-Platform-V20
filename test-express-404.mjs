import express from 'express';
const app = express();
// no delete route
const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/api/pages/test`, { method: 'DELETE' });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text.substring(0, 50));
  server.close();
});

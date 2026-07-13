import express from 'express';
const app = express();
app.delete('/api/pages/:name', (req, res) => res.json({ success: true, name: req.params.name }));
const server = app.listen(0, async () => {
  const port = server.address().port;
  // Simulating double encoding on the client
  const name = "Jan / Feb";
  const doubleEncoded = encodeURIComponent(encodeURIComponent(name));
  console.log("Sending:", doubleEncoded);
  const res = await fetch(`http://localhost:${port}/api/pages/${doubleEncoded}`, { method: 'DELETE' });
  console.log(await res.json());
  server.close();
});

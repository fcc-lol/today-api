import express from 'express';

const app = express();
const port = 3117;

app.get('/', (req, res) => {
  res.send('Today API');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


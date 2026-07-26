import app from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[BuildBridge API] Server running successfully on port ${PORT}`);
});
